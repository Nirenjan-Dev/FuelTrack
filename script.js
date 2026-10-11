
const tripForm = document.getElementById("tripForm");
const tripList = document.getElementById("tripList");
const summaryButton = document.getElementById("summaryButton");

/* ================================
   MESSAGE POPUP — NO BUTTONS
================================ */

function showMessage(title, message) {
    document.querySelectorAll(".fueltrack-message-overlay").forEach(
        popup => popup.remove()
    );

    const overlay = document.createElement("div");
    overlay.className = "delete-overlay fueltrack-message-overlay";

    const modal = document.createElement("div");
    modal.className = "delete-modal";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    modal.appendChild(heading);
    modal.appendChild(paragraph);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
    }, 2000);
}


/* ================================
   ADD TRIP
================================ */

tripForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const tripName = document.getElementById("tripName").value.trim();
    const distanceInput = document.getElementById("distance").value;
    const mileageInput = document.getElementById("mileage").value;
    const fuelPriceInput = document.getElementById("fuelPrice").value;

    const distance = Number(distanceInput);
    const mileage = Number(mileageInput);
    const fuelPrice = Number(fuelPriceInput);

    if (!tripName) {
        showMessage("Invalid Trip Name", "Please enter a trip name.");
        return;
    }

    if (
        distanceInput === "" ||
        !Number.isFinite(distance) ||
        distance <= 0
    ) {
        showMessage(
            "Invalid Distance",
            "Distance must be greater than zero."
        );
        return;
    }

    if (
        mileageInput === "" ||
        !Number.isFinite(mileage) ||
        mileage <= 0
    ) {
        showMessage(
            "Invalid Mileage",
            "Mileage must be greater than zero."
        );
        return;
    }

    if (
        fuelPriceInput === "" ||
        !Number.isFinite(fuelPrice) ||
        fuelPrice < 0
    ) {
        showMessage(
            "Invalid Fuel Price",
            "Please enter a valid fuel price."
        );
        return;
    }

    const submitButton = tripForm.querySelector(
        'button[type="submit"]'
    );

    const originalText = submitButton
        ? submitButton.textContent
        : "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving Trip...";
    }

    try {
        const response = await fetch("/add-trip", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                trip_name: tripName,
                distance: distance,
                mileage: mileage,
                fuel_price: fuelPrice
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(
                "Unable to Add Trip",
                data.error || "Your trip could not be saved."
            );
            return;
        }

        // Add the trip without a success popup
        createTripCard(data);

        const newestTrip = tripList.lastElementChild;

        if (newestTrip) {
            tripList.prepend(newestTrip);
        }

        tripForm.reset();

    } catch (error) {
        showMessage(
            "Connection Error",
            "Could not save your trip. Please try again."
        );

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }
});


/* ================================
   CREATE TRIP CARD
================================ */

function createTripCard(data) {
    const card = document.createElement("div");
    card.className = "trip-card";
    card.dataset.id = data.id;

    const heading = document.createElement("h3");
    heading.textContent = data.trip_name;

    const info = document.createElement("div");
    info.className = "trip-info";

    const details = [
        ["Distance", `${Number(data.distance).toFixed(2)} km`],
        ["Mileage", `${Number(data.mileage).toFixed(2)} km/L`],
        ["Fuel Used", `${Number(data.fuel_used).toFixed(2)} L`],
        ["Fuel Cost", `₹${Number(data.fuel_cost).toFixed(2)}`],
        ["Cost per KM", `₹${Number(data.cost_per_km).toFixed(2)}`]
    ];

    details.forEach(function ([labelText, valueText]) {
        const item = document.createElement("div");

        const label = document.createElement("span");
        label.textContent = labelText;

        const value = document.createElement("strong");
        value.textContent = valueText;

        item.appendChild(label);
        item.appendChild(value);
        info.appendChild(item);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", function () {
        confirmDelete(data.id, card);
    });

    card.appendChild(heading);
    card.appendChild(info);
    card.appendChild(deleteButton);

    tripList.appendChild(card);
}


/* ================================
   DELETE CONFIRMATION
================================ */

function confirmDelete(tripId, card) {
    const overlay = document.createElement("div");
    overlay.className = "delete-overlay";

    overlay.innerHTML = `
        <div class="delete-modal">
            <h3>Delete Trip?</h3>
            <p>Are you sure you want to delete this trip?</p>
            <div class="delete-modal-buttons">
                <button class="cancel-delete" type="button">
                    Cancel
                </button>
                <button class="confirm-delete" type="button">
                    Delete
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".cancel-delete").addEventListener(
        "click",
        function () {
            overlay.remove();
        }
    );

    overlay.querySelector(".confirm-delete").addEventListener(
        "click",
        async function () {
            const button = overlay.querySelector(".confirm-delete");

            button.disabled = true;
            button.textContent = "Deleting...";

            try {
                const response = await fetch(
                    `/delete-trip/${tripId}`,
                    { method: "DELETE" }
                );

                const data = await response.json();

                if (!response.ok) {
                    overlay.remove();

                    showMessage(
                        "Unable to Delete",
                        data.error || "Please try again."
                    );
                    return;
                }

                card.remove();
                overlay.remove();

            } catch (error) {
                overlay.remove();

                showMessage(
                    "Connection Error",
                    "Could not delete this trip. Please try again."
                );
            }
        }
    );
}


/* ================================
   TOTAL SUMMARY
================================ */

summaryButton.addEventListener("click", function () {
    const cards = tripList.querySelectorAll(".trip-card");

    if (cards.length === 0) {
        showMessage(
            "No Trips Yet",
            "Add a trip to view your summary."
        );
        return;
    }

    let totalDistance = 0;
    let totalFuel = 0;
    let totalCost = 0;

    cards.forEach(function (card) {
        const values = card.querySelectorAll(".trip-info strong");

        totalDistance += parseFloat(values[0].textContent) || 0;
        totalFuel += parseFloat(values[2].textContent) || 0;

        totalCost += parseFloat(
            values[3].textContent.replace("₹", "")
        ) || 0;
    });

    const averageCost =
        totalDistance > 0 ? totalCost / totalDistance : 0;

    const overlay = document.createElement("div");
    overlay.className = "summary-overlay";

    overlay.innerHTML = `
        <div class="summary-modal">
            <h3>Total Summary</h3>

            <div class="summary-row">
                <span>Total Trips</span>
                <strong>${cards.length}</strong>
            </div>

            <div class="summary-row">
                <span>Total Distance</span>
                <strong>${totalDistance.toFixed(2)} km</strong>
            </div>

            <div class="summary-row">
                <span>Total Fuel Used</span>
                <strong>${totalFuel.toFixed(2)} L</strong>
            </div>

            <div class="summary-row">
                <span>Total Fuel Cost</span>
                <strong>₹${totalCost.toFixed(2)}</strong>
            </div>

            <div class="summary-row">
                <span>Average Cost per KM</span>
                <strong>₹${averageCost.toFixed(2)}</strong>
            </div>

            <button class="close-summary" type="button">
                Close
            </button>

            <p class="summary-disclaimer">
                Fuel consumption and costs are approximate.
            </p>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".close-summary").addEventListener(
        "click",
        function () {
            overlay.remove();
        }
    );

    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) {
            overlay.remove();
        }
    });
});


/* ================================
   LOAD SAVED TRIPS
================================ */

async function loadTrips() {
    try {
        const response = await fetch("/get-trips");

        if (!response.ok) {
            throw new Error("Unable to load trips.");
        }

        const trips = await response.json();

        tripList.innerHTML = "";

        trips.forEach(function (trip) {
            createTripCard(trip);
        });

    } catch (error) {
        showMessage(
            "Unable to Load Trips",
            "Could not load saved trips. Please refresh the page."
        );
    }
}

loadTrips();
