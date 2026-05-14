const API_BASE_URL = "https://flight-arrivals-app-good-2.onrender.com";

let currentDirection = localStorage.getItem("lastDirection") || "arrivals";
let autoRefreshInterval = null;
let lastAirport = localStorage.getItem("lastAirport") || "";

const AIRPORTS = [
  { code: "TLS", name: "Toulouse", keywords: ["toulouse", "blagnac"] },
  { code: "CDG", name: "Paris Charles de Gaulle", keywords: ["paris", "charles de gaulle", "cdg"] },
  { code: "ORY", name: "Paris Orly", keywords: ["paris", "orly"] },
  { code: "NCE", name: "Nice", keywords: ["nice", "cote d azur", "côte d'azur"] },
  { code: "MRS", name: "Marseille", keywords: ["marseille", "provence"] },
  { code: "LYS", name: "Lyon", keywords: ["lyon", "saint exupery", "saint-exupéry"] },

  { code: "LHR", name: "Londres Heathrow", keywords: ["londres", "london", "heathrow"] },
  { code: "LTN", name: "Londres Luton", keywords: ["londres", "london", "luton"] },
  { code: "LGW", name: "Londres Gatwick", keywords: ["londres", "london", "gatwick"] },
  { code: "STN", name: "Londres Stansted", keywords: ["londres", "london", "stansted"] },

  { code: "AMS", name: "Amsterdam Schiphol", keywords: ["amsterdam", "schiphol"] },
  { code: "MAD", name: "Madrid Barajas", keywords: ["madrid", "barajas"] },
  { code: "BCN", name: "Barcelone El Prat", keywords: ["barcelone", "barcelona"] },
  { code: "FCO", name: "Rome Fiumicino", keywords: ["rome", "fiumicino"] },
  { code: "FRA", name: "Francfort", keywords: ["francfort", "frankfurt"] },
  { code: "MUC", name: "Munich", keywords: ["munich", "münchen"] },
  { code: "DUB", name: "Dublin", keywords: ["dublin"] },

  { code: "JFK", name: "New York JFK", keywords: ["new york", "nyc", "jfk"] },
  { code: "EWR", name: "Newark", keywords: ["new york", "newark", "ewr"] },
  { code: "LGA", name: "New York LaGuardia", keywords: ["new york", "laguardia", "lga"] },
  { code: "LAX", name: "Los Angeles", keywords: ["los angeles", "la", "lax"] },
  { code: "MIA", name: "Miami", keywords: ["miami"] },
  { code: "ORD", name: "Chicago O'Hare", keywords: ["chicago", "ohare", "o'hare"] },

  { code: "DXB", name: "Dubai", keywords: ["dubai", "dubaï"] },
  { code: "DOH", name: "Doha", keywords: ["doha", "qatar"] },
  { code: "IST", name: "Istanbul", keywords: ["istanbul"] },

  { code: "HND", name: "Tokyo Haneda", keywords: ["tokyo", "haneda"] },
  { code: "NRT", name: "Tokyo Narita", keywords: ["tokyo", "narita"] },
  { code: "SIN", name: "Singapour Changi", keywords: ["singapour", "singapore", "changi"] },
  { code: "BKK", name: "Bangkok Suvarnabhumi", keywords: ["bangkok", "suvarnabhumi"] }
];

const AIRPORT_NAMES = Object.fromEntries(
  AIRPORTS.map(airport => [airport.code, airport.name])
);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

function setDirection(direction) {
  currentDirection = direction;

  localStorage.setItem("lastDirection", direction);

  document
    .getElementById("arrivalsBtn")
    .classList.toggle("active", direction === "arrivals");

  document
    .getElementById("departuresBtn")
    .classList.toggle("active", direction === "departures");

  const input = document.getElementById("airportInput");

  if (input.value.trim() !== "") {
    loadFlights();
  }
}

function getAirportCode(value) {
  const cleanValue = normalizeText(value);

  if (cleanValue.length === 3) {
    return cleanValue.toUpperCase();
  }

  const found = AIRPORTS.find(airport => {
    const code = normalizeText(airport.code);
    const name = normalizeText(airport.name);

    return (
      code === cleanValue ||
      name.includes(cleanValue) ||
      airport.keywords.some(keyword =>
        normalizeText(keyword).includes(cleanValue)
      )
    );
  });

  return found ? found.code : cleanValue.toUpperCase();
}

function getAirportDisplay(code) {
  return `${AIRPORT_NAMES[code] || code} (${code})`;
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
      label: "Annulé",
      icon: "✖"
    };
  }

  if (status.includes("delay")) {
    return {
      className: "delayed",
      label: "En retard",
      icon: "⏱"
    };
  }

  if (status.includes("early")) {
    return {
      className: "early",
      label: "En avance",
      icon: "↗"
    };
  }

  return {
    className: "on-time",
    label: "À l'heure",
    icon: "●"
  };
}

function getAirlineInitials(name) {
  const clean = String(name || "Unknown").trim();

  if (!clean || clean === "Unknown") return "?";

  return clean
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();
}

function getAirlineLogo(airlineName) {
  const name = String(airlineName || "").toLowerCase();

  const domains = {
    "air france": "airfrance.com",
    "ryanair": "ryanair.com",
    "easyjet": "easyjet.com",
    "klm": "klm.com",
    "british": "britishairways.com",
    "lufthansa": "lufthansa.com",
    "transavia": "transavia.com",
    "iberia": "iberia.com",
    "emirates": "emirates.com",
    "vueling": "vueling.com",
    "volotea": "volotea.com",
    "ita": "ita-airways.com"
  };

  const match = Object.keys(domains).find(key =>
    name.includes(key)
  );

  if (!match) return null;

  return `https://www.google.com/s2/favicons?sz=128&domain=${domains[match]}`;
}

function getTimeDetail(minutes, direction) {
  if (minutes === null || minutes === undefined) {
    return "Horaire indisponible";
  }

  if (minutes <= 0) {
    return direction === "arrivals"
      ? "Arrivée imminente"
      : "Départ imminent";
  }

  return direction === "arrivals"
    ? `Arrive dans ${minutes} min`
    : `Départ dans ${minutes} min`;
}

function showSuggestions() {
  const input = document.getElementById("airportInput");
  const suggestions = document.getElementById("suggestions");

  const query = normalizeText(input.value);

  if (!query) {
    suggestions.innerHTML = "";
    suggestions.style.display = "none";
    return;
  }

  const matches = AIRPORTS.filter(airport => {
    const code = normalizeText(airport.code);
    const name = normalizeText(airport.name);

    return (
      code.includes(query) ||
      name.includes(query)
    );
  }).slice(0, 6);

  if (matches.length === 0) {
    suggestions.innerHTML = "";
    suggestions.style.display = "none";
    return;
  }

  suggestions.innerHTML = matches.map(airport => `
    <div class="suggestion-item" onclick="selectSuggestion('${airport.code}')">
      <strong>${airport.code}</strong>
      <span>${airport.name}</span>
    </div>
  `).join("");

  suggestions.style.display = "block";
}

function selectSuggestion(code) {
  document.getElementById("airportInput").value = code;

  document.getElementById("suggestions").innerHTML = "";
  document.getElementById("suggestions").style.display = "none";

  loadFlights();
}

function quickSearch(code) {
  document.getElementById("airportInput").value = code;
  loadFlights();
}

function savePreferences(airport) {
  localStorage.setItem("lastAirport", airport);
  localStorage.setItem("lastDirection", currentDirection);

  lastAirport = airport;
}

function loadPreferences() {
  const input = document.getElementById("airportInput");

  if (lastAirport) {
    input.value = lastAirport;
  }

  setDirection(currentDirection);

  if (lastAirport) {
    loadFlights();
  } else {
    document.getElementById("results").innerHTML = `
      <div class="empty">
        Entrez un aéroport ou cliquez sur un code IATA.
      </div>
    `;
  }
}

function updateLastRefresh() {
  const now = new Date();

  document.getElementById("lastRefresh").textContent =
    `Dernière mise à jour : ${now.toLocaleTimeString("fr-FR")}`;
}

function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  autoRefreshInterval = setInterval(() => {
    const input = document.getElementById("airportInput");

    if (input.value.trim() !== "") {
      loadFlights(true);
    }
  }, 60000);
}

function renderSummary(flights, airport) {
  const summary = document.getElementById("summary");

  const delayedCount = flights.filter(f =>
    String(f.status || "")
      .toLowerCase()
      .includes("delay")
  ).length;

  const nextFlight = flights[0];

  const directionLabel =
    currentDirection === "arrivals"
      ? "arrivées"
      : "départs";

  summary.innerHTML = `
    <div class="summary-card">
      <div class="summary-icon">✈</div>
      <div>
        <span>Vols ${directionLabel}</span>
        <strong>${flights.length}</strong>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-icon green-icon">🛬</div>
      <div>
        <span>Prochain vol</span>
        <strong>${nextFlight ? nextFlight.flightNumber : "N/A"}</strong>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-icon red-icon">⏱</div>
      <div>
        <span>Retards</span>
        <strong>${delayedCount}</strong>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-icon">📍</div>
      <div>
        <span>Aéroport</span>
        <strong>${getAirportDisplay(airport)}</strong>
      </div>
    </div>
  `;
}

function openFlightDetails(flight) {

  const modal = document.getElementById("flightModal");
  const content = document.getElementById("modalContent");

  content.innerHTML = `
    <div class="modal-header">

      <div class="modal-flight">

        <div class="modal-flight-number">
          ${flight.flightNumber}
        </div>

        <div class="modal-airline">
          ${flight.airline}
        </div>

      </div>

      <div class="modal-status">
        ${flight.status || "Unknown"}
      </div>

    </div>

    <div class="modal-grid">

      <div class="modal-card">
        <span>Compagnie</span>
        <strong>${flight.airline}</strong>
      </div>

      <div class="modal-card">
        <span>Statut</span>
        <strong>${flight.status || "Unknown"}</strong>
      </div>

      <div class="modal-card">
        <span>Heure prévue</span>
        <strong>${formatDate(flight.scheduledTime)}</strong>
      </div>

      <div class="modal-card">
        <span>Heure estimée</span>
        <strong>${formatDate(
          flight.estimatedTime || flight.actualTime
        )}</strong>
      </div>

    </div>
  `;

  modal.classList.add("show");
}

function closeFlightModal() {
  document
    .getElementById("flightModal")
    .classList.remove("show");
}

async function loadFlights(isAutoRefresh = false) {
  const input = document.getElementById("airportInput");
  const results = document.getElementById("results");
  const summary = document.getElementById("summary");

  const airport = getAirportCode(input.value);

  if (!airport) {
    return;
  }

  input.value = airport;

  savePreferences(airport);

  if (!isAutoRefresh) {
    results.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/flights/${airport}/${currentDirection}`
    );

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const flights = await response.json();

    renderSummary(flights, airport);
    updateLastRefresh();

    results.innerHTML = flights.map(f => {
      const statusData = getStatusData(f.status);

      const airlineInitials = getAirlineInitials(f.airline);

      const airlineLogo = getAirlineLogo(f.airline);

      const remainingText =
        getTimeDetail(f.minutesToFlight, currentDirection);

      let leftLabel;
      let leftValue;
      let rightLabel;
      let rightValue;

      if (currentDirection === "arrivals") {
        leftLabel = "Départ de";
        leftValue = f.airport;
        rightLabel = "Arrivée à";
        rightValue = getAirportDisplay(f.selectedAirport);
      } else {
        leftLabel = "Départ de";
        leftValue = getAirportDisplay(f.selectedAirport);
        rightLabel = "Destination";
        rightValue = f.airport;
      }

      const flightId = String(f.flightNumber || "")
        .toLowerCase()
        .replace(/\s/g, "");

      return `
        <article class="flight-card ${statusData.className}">

          <div class="flight-top">

            <div class="flight-title-row">

              <div class="airline-logo">
                ${
                  airlineLogo
                    ? `<img src="${airlineLogo}" alt="${f.airline}">`
                    : airlineInitials
                }
              </div>

              <div>
                <span class="flight-label">
                  ${currentDirection === "arrivals" ? "Arrivée" : "Départ"}
                </span>

                <h3>${f.flightNumber}</h3>
              </div>

            </div>

            <div class="badge">
              ${statusData.icon} ${statusData.label}
            </div>

          </div>

          <div class="route">

            <div>
              <span>${leftLabel}</span>
              <strong>${leftValue}</strong>
            </div>

            <div class="arrow">✈</div>

            <div>
              <span>${rightLabel}</span>
              <strong>${rightValue}</strong>
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

            <div class="action-row">

              <button
                class="detail-btn"
                onclick='openFlightDetails(${JSON.stringify({
  flightNumber: f.flightNumber,
  airline: f.airline,
  status: f.status,
  scheduledTime: f.scheduledTime,
  estimatedTime: f.estimatedTime,
  actualTime: f.actualTime,
  airport: f.airport,
  selectedAirport: f.selectedAirport,
  direction: currentDirection,
  minutesToFlight: f.minutesToFlight
})})'
              >
                Détails
              </button>

              <a
                class="flight-link"
                target="_blank"
                href="https://www.flightradar24.com/data/flights/${flightId}"
              >
                Suivre
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
        Erreur lors du chargement.
      </div>
    `;

    summary.innerHTML = "";
  }
}

document
  .getElementById("airportInput")
  .addEventListener("keydown", e => {
    if (e.key === "Enter") {
      loadFlights();
    }
  });

document.addEventListener("click", e => {
  if (!e.target.closest(".search-wrapper")) {
    document.getElementById("suggestions").style.display = "none";
  }
});

function applySavedTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");

  const isDark =
    document.body.classList.contains("dark-mode");

  localStorage.setItem(
    "theme",
    isDark ? "dark" : "light"
  );
}

applySavedTheme();
loadPreferences();
startAutoRefresh();