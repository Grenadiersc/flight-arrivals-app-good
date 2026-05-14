const API_BASE_URL = "https://flight-arrivals-app-good.onrender.com";

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

function getStatusData(statusText) {
  const status = String(statusText || "").toLowerCase();

  if (status.includes("cancel")) {
    return {
      className: "cancelled",
      label: "Annulé"
    };
  }

  if (status.includes("delay")) {
    return {
      className: "delayed",
      label: "En retard"
    };
  }

  return {
    className: "on-time",
    label: "À l'heure"
  };
}

async function loadFlights() {
  const input = document.getElementById("airportInput");
  const results = document.getElementById("results");
  const airport = getAirportCode(input.value);

  if (!airport) {
    results.innerHTML = `<div class="empty">Entre une ville ou un code IATA.</div>`;
    return;
  }

  input.value = airport;

  results.innerHTML = `
    <div class="loading-card">
      <div class="loader"></div>
      <p>Chargement des vols pour ${airport}...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/api/arrivals/${airport}`);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${response.status} - ${text}`);
    }

    const flights = await response.json();

    if (!Array.isArray(flights) || flights.length === 0) {
      results.innerHTML = `<div class="empty">Aucun vol trouvé pour ${airport}.</div>`;
      return;
    }

    results.innerHTML = flights.map(f => {
      const statusData = getStatusData(f.status);

      const flightId = String(f.flightNumber || "")
        .toLowerCase()
        .replace(/\s/g, "");

      const remainingText =
        f.minutesToArrival !== null
          ? `Arrive dans ${f.minutesToArrival} min`
          : "N/A";

      return `
        <article class="flight-card ${statusData.className}">
          <div class="flight-content">

            <div class="flight-top">
              <div>
                <span class="flight-label">Vol</span>
                <h3>${f.flightNumber}</h3>
              </div>

              <div class="badge">${statusData.label}</div>
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
                <strong>${remainingText}</strong>
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

    results.innerHTML = `
      <div class="empty">
        Erreur lors du chargement :
        <br><br>
        ${err.message}
      </div>
    `;
  }
}

document.getElementById("airportInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    loadFlights();
  }
});

loadFlights();