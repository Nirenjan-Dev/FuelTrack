from flask import Flask, request, jsonify, send_from_directory, session
import sqlite3
import uuid
import time


app = Flask(__name__)


# ======================================
# Flask Session
# ======================================

app.secret_key = "fueltrack-secret-key-change-later"


# ======================================
# Database
# ======================================

DATABASE = "fueltrack.db"


# Session expires after 30 minutes
# of inactivity

SESSION_TIMEOUT = 30 * 60


# ======================================
# Database Connection
# ======================================

def get_connection():

    return sqlite3.connect(
        DATABASE,
        timeout=10
    )


# ======================================
# Create Database
# ======================================

def create_database():

    connection = get_connection()

    cursor = connection.cursor()


    # Trips table

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trips (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            session_id TEXT NOT NULL,

            trip_name TEXT NOT NULL,

            distance REAL NOT NULL,

            mileage REAL NOT NULL,

            fuel_price REAL NOT NULL,

            fuel_used REAL NOT NULL,

            fuel_cost REAL NOT NULL,

            cost_per_km REAL NOT NULL

        )
    """)


    # Sessions table

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (

            session_id TEXT PRIMARY KEY,

            last_active REAL NOT NULL

        )
    """)


    connection.commit()

    connection.close()


# ======================================
# Get Session ID
# ======================================

def get_session_id():

    # If this browser doesn't have
    # a session ID, create one.

    if "session_id" not in session:

        session["session_id"] = str(
            uuid.uuid4()
        )


    return session["session_id"]


# ======================================
# Clean Old Sessions
# ======================================

def clean_old_sessions():

    connection = get_connection()

    cursor = connection.cursor()


    current_time = time.time()


    old_time = (
        current_time - SESSION_TIMEOUT
    )


    # Delete trips belonging to
    # expired sessions

    cursor.execute("""
        DELETE FROM trips

        WHERE session_id IN (

            SELECT session_id

            FROM sessions

            WHERE last_active < ?

        )
    """, (
        old_time,
    ))


    # Delete expired sessions

    cursor.execute("""
        DELETE FROM sessions

        WHERE last_active < ?
    """, (
        old_time,
    ))


    connection.commit()

    connection.close()


# ======================================
# Update Session Activity
# ======================================

def update_session():

    session_id = get_session_id()


    connection = get_connection()

    cursor = connection.cursor()


    current_time = time.time()


    cursor.execute("""
        INSERT OR REPLACE INTO sessions (

            session_id,

            last_active

        )

        VALUES (?, ?)
    """, (
        session_id,
        current_time
    ))


    connection.commit()

    connection.close()


    return session_id


# ======================================
# Home Page
# ======================================

@app.route("/")
def home():

    clean_old_sessions()

    update_session()


    return send_from_directory(
        ".",
        "index.html"
    )


# ======================================
# CSS
# ======================================

@app.route("/style.css")
def css():

    return send_from_directory(
        ".",
        "style.css"
    )


# ======================================
# JavaScript
# ======================================

@app.route("/script.js")
def javascript():

    return send_from_directory(
        ".",
        "script.js"
    )


# ======================================
# Favicon
# ======================================

@app.route("/favicon.png")
def favicon():

    return send_from_directory(
        ".",
        "favicon.png"
    )


# ======================================
# Add Trip
# ======================================

@app.route(
    "/add-trip",
    methods=["POST"]
)
def add_trip():

    clean_old_sessions()

    session_id = update_session()


    data = request.get_json()


    trip_name = data.get(
        "trip_name"
    )


    distance = float(
        data.get("distance")
    )


    mileage = float(
        data.get("mileage")
    )


    fuel_price = float(
        data.get("fuel_price")
    )


    # ==================================
    # Validation
    # ==================================

    if not trip_name:

        return jsonify({
            "error": "Please enter a trip name."
        }), 400


    if distance <= 0:

        return jsonify({
            "error": "Distance must be greater than 0."
        }), 400


    if mileage <= 0:

        return jsonify({
            "error": "Mileage must be greater than 0."
        }), 400


    if fuel_price <= 0:

        return jsonify({
            "error": "Fuel price must be greater than 0."
        }), 400


    # ==================================
    # Calculations
    # ==================================

    fuel_used = (
        distance / mileage
    )


    fuel_cost = (
        fuel_used * fuel_price
    )


    cost_per_km = (
        fuel_cost / distance
    )


    # ==================================
    # Save Trip
    # ==================================

    connection = get_connection()

    cursor = connection.cursor()


    cursor.execute("""
        INSERT INTO trips (

            session_id,

            trip_name,

            distance,

            mileage,

            fuel_price,

            fuel_used,

            fuel_cost,

            cost_per_km

        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (

        session_id,

        trip_name,

        distance,

        mileage,

        fuel_price,

        fuel_used,

        fuel_cost,

        cost_per_km

    ))


    trip_id = cursor.lastrowid


    connection.commit()

    connection.close()


    # ==================================
    # Send Result
    # ==================================

    return jsonify({

        "id": trip_id,

        "trip_name": trip_name,

        "distance": distance,

        "mileage": mileage,

        "fuel_used": round(
            fuel_used,
            2
        ),

        "fuel_cost": round(
            fuel_cost,
            2
        ),

        "cost_per_km": round(
            cost_per_km,
            2
        )

    })


# ======================================
# Get Trips
# ======================================

@app.route(
    "/get-trips",
    methods=["GET"]
)
def get_trips():

    clean_old_sessions()

    session_id = update_session()


    connection = get_connection()

    cursor = connection.cursor()


    cursor.execute("""
        SELECT

            id,

            trip_name,

            distance,

            mileage,

            fuel_used,

            fuel_cost,

            cost_per_km

        FROM trips

        WHERE session_id = ?

        ORDER BY id DESC
    """, (
        session_id,
    ))


    rows = cursor.fetchall()


    connection.close()


    trips = []


    for row in rows:

        trips.append({

            "id": row[0],

            "trip_name": row[1],

            "distance": row[2],

            "mileage": row[3],

            "fuel_used": row[4],

            "fuel_cost": row[5],

            "cost_per_km": row[6]

        })


    return jsonify(trips)


# ======================================
# Delete Trip
# ======================================

@app.route(
    "/delete-trip/<int:trip_id>",
    methods=["DELETE"]
)
def delete_trip(trip_id):

    clean_old_sessions()

    session_id = update_session()


    connection = get_connection()

    cursor = connection.cursor()


    cursor.execute("""
        DELETE FROM trips

        WHERE id = ?

        AND session_id = ?
    """, (
        trip_id,
        session_id
    ))


    deleted = cursor.rowcount


    connection.commit()

    connection.close()


    if deleted == 0:

        return jsonify({
            "error": "Trip not found."
        }), 404


    return jsonify({

        "message":
            "Trip deleted successfully."

    })


# ======================================
# Run FuelTrack
# ======================================

if __name__ == "__main__":

    create_database()

    app.run(
        debug=False
    )
