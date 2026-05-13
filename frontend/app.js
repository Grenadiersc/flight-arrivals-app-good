function updateClock() {
  const now = new Date();

  document.getElementById("clock").textContent =
    now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

  document.getElementById("date").textContent =
    now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
}

setInterval(updateClock, 1000);
updateClock();

async function loadFlights() {
  const airport = document
    .getElementById("airportInput")
    .value
    .trim()
    .toUpperCase();

  const results = document.getElementById("results");

  if (!airport) {
    results.innerHTML = "<p class='empty'>Entre un code aéroport.</p>";
    return;
  }

  results.innerHTML = `
    <div class="loading-card">
      <div class="loader"></div>
      <p>Chargement des vols pour ${airport}...</p>
    </div>
  `;

  try {
    const response = await fetch(
      `http://localhost:3000/api/arrivals/${airport}`
    );

    const flights = await response.json();

    if (!Array.isArray(flights) || flights.length === 0) {
      results.innerHTML = "<p class='empty'>Aucun vol à venir trouvé.</p>";
      return;
    }

    results.innerHTML = flights
      .map(f => {
        const status = String(f.status || "").toLowerCase();

        const isCancelled = status.includes("cancel");
        const isDelayed = status.includes("delayed");

        let cardClass = "flight-card on-time";
        let badge = "À l'heure";
        let badgeIcon = "●";
        let arrivalText = "Heure inconnue";

        if (isCancelled) {
          cardClass = "flight-card cancelled";
          badge = "Annulé";
          badgeIcon = "■";
          arrivalText = "Vol annulé";
        } else if (isDelayed) {
          cardClass = "flight-card delayed";
          badge = "En retard";
          badgeIcon = "●";
        }

        if (!isCancelled && f.minutesToArrival !== null) {
          if (f.minutesToArrival === 0) {
            arrivalText = "Arrivée imminente";
          } else {
            arrivalText = `Arrive dans ${f.minutesToArrival} min`;
          }
        }

        const flightradarUrl =
          `https://www.flightradar24.com/data/flights/${f.flightNumber.toLowerCase().replace(/\s/g, "")}`;

        return `
          <article class="${cardClass}">
            <div class="status-bar"></div>

            <div class="flight-top">
              <div>
                <span class="flight-label">Vol</span>
                <h2>${f.flightNumber}</h2>
              </div>

              <span class="badge">
                <span>${badgeIcon}</span>
                ${badge}
              </span>
            </div>

            <div class="route">
              <div class="city">
                <span>Départ</span>
                <strong>${f.from}</strong>
              </div>

              <div class="route-line">
                <span></span>
                <div class="plane">✈</div>
                <span></span>
              </div>

              <div class="city right">
                <span>Arrivée</span>
                <strong>${f.to}</strong>
              </div>
            </div>

            <div class="info-grid">
              <div class="info">
                <span>Compagnie</span>
                <strong>${f.airline}</strong>
              </div>

              <div class="info">
                <span>Statut</span>
                <strong>${f.status}</strong>
              </div>

              <div class="info highlight">
                <span>Temps restant</span>
                <strong>${arrivalText}</strong>
              </div>
            </div>

            <div class="time-row">
              <div>
                <span>Heure prévue</span>
                <strong>${formatDate(f.scheduledTime)}</strong>
              </div>

              <div>
                <span>Heure estimée</span>
                <strong>${formatDate(f.estimatedTime || f.actualTime)}</strong>
              </div>
            </div>

            <a class="flight-link" href="${flightradarUrl}" target="_blank">
              Suivre ce vol sur Flightradar24
            </a>
          </article>
        `;
      })
      .join("");

  } catch (err) {
    results.innerHTML = "<p class='empty'>Erreur lors du chargement.</p>";
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";

  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}