const AIRPORT_MAP = {
  toulouse: "TLS",
  nice: "NCE",
  paris: "CDG",
  orly: "ORY",
  marseille: "MRS",
  lyon: "LYS",
  londres: "LHR",
  london: "LHR",
  luton: "LTN",
  dubai: "DXB",
  tokyo: "HND",
  singapour: "SIN",
  singapore: "SIN"
};

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

function getAirportCode(value) {
  const text = value.trim().toLowerCase();

  if (text.length === 3) {
    return text.toUpperCase();
  }

  return AIRPORT_MAP[text] || text.toUpperCase();
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

async function loadFlights() {
  const input = document.getElementById("airportInput");
  const results = document.getElementById("results");
  const airport = getAirportCode(input.value);

  if (!airport) {
    results.innerHTML = `<div class="empty">Entre une ville ou un code IATA.</div>`;
    return;
  }

  results.innerHTML = `<div class="loading-card">Chargement des vols pour ${airport}...</div>`;

  try {
    const response = await fetch(`https://flight-arrivals-app-good.onrender.com/api/arrivals/${airport}`);
    const flights = await response.json();

    if (!Array.isArray(flights) || flights.length === 0) {
      results.innerHTML = `<div class="empty">Aucun vol trouvé pour ${airport}.</div>`;
      return;
    }

    results.innerHTML = flights.map(f => {
      const status = String(f.status || "").toLowerCase();

      const delayed = status.includes("delay");
      const cancelled = status.includes("cancel");

      let cardClass = "flight-card";
      let badge = "À l'heure";

      if (delayed) {
        cardClass += " delayed";
        badge = "En retard";
      }

      if (cancelled) {
        cardClass += " cancelled";
        badge = "Annulé";
      }

      const flightId = String(f.flightNumber || "")
        .toLowerCase()
        .replace(/\s/g, "");

      return `
        <article class="${cardClass}">
          <div class="aircraft-photo">
            <img
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=900&auto=format&fit=crop"
              alt="Avion"
            />
          </div>

          <div class="flight-content">
            <div class="flight-top">
              <div>
                <span class="flight-label">Vol</span>
                <h3>${f.flightNumber}</h3>
              </div>

              <div class="badge">${badge}</div>
            </div>

            <div class="route">
              <div>
                <span>Départ</span>
                <strong>${f.from}</strong>
              </div>

              <div class="arrow">✈</div>

              <div>
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
                <strong>
                  ${
                    f.minutesToArrival !== null
                      ? `Arrive dans ${f.minutesToArrival} min`
                      : "N/A"
                  }
                </strong>
              </div>
            </div>

            <div class="bottom-row">
              <div class="time-row">
                <div class="time-box">
                  <span>Heure prévue</span>
                  <strong>${formatDate(f.scheduledTime)}</strong>
                </div>

                <div class="time-box">
                  <span>Heure estimée</span>
                  <strong>${formatDate(f.estimatedTime || f.actualTime)}</strong>
                </div>
              </div>

              <a
                class="flight-link"
                target="_blank"
                href="https://www.flightradar24.com/data/flights/${flightId}"
              >
                Suivre ce vol
              </a>
            </div>
          </div>
        </article>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
    results.innerHTML = `<div class="empty">Erreur serveur.</div>`;
  }
}

document.getElementById("airportInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    loadFlights();
  }
});

loadFlights();