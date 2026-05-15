const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.AERODATABOX_API_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "aerodatabox.p.rapidapi.com";

const cache = {};
const CACHE_DURATION = 1000 * 60 * 15;

let monthlyApiCalls = 0;
const MONTHLY_LIMIT = 2400;

function getCacheKey(iata, direction) {
  return `${iata}_${direction}`;
}

function formatDateForApi(date) {
  return date.toISOString().slice(0, 16);
}

function getBestTime(movement) {
  return (
    movement?.revisedTime?.local ||
    movement?.predictedTime?.local ||
    movement?.actualTime?.local ||
    movement?.scheduledTime?.local ||
    null
  );
}

function getStatus(scheduledTime, bestTime, rawStatus) {
  const status = String(rawStatus || "").toLowerCase();

  if (status.includes("cancel")) {
    return "Cancelled";
  }

  if (!scheduledTime || !bestTime) {
    return rawStatus || "Unknown";
  }

  const scheduled = new Date(scheduledTime);
  const estimated = new Date(bestTime);

  const diffMinutes = Math.round((estimated - scheduled) / 60000);

  if (diffMinutes >= 5) {
    return "Delayed";
  }

  if (diffMinutes <= -5) {
    return "Early";
  }

  return rawStatus || "On Time";
}

app.get("/", (req, res) => {
  res.send("Flight Board API running with AeroDataBox");
});

app.get("/api/quota", (req, res) => {
  res.json({
    used: monthlyApiCalls,
    remaining: Math.max(MONTHLY_LIMIT - monthlyApiCalls, 0),
    limit: MONTHLY_LIMIT,
    cacheDurationMinutes: 15,
    note: "Compteur approximatif côté serveur. Le vrai quota officiel est visible sur RapidAPI."
  });
});

app.get("/api/flights/:iata/:direction", async (req, res) => {
  try {
    const iata = req.params.iata.toUpperCase();
    const direction = req.params.direction;

    if (!["arrivals", "departures"].includes(direction)) {
      return res.status(400).json({
        error: "Direction invalide. Utilise arrivals ou departures."
      });
    }

    const cacheKey = getCacheKey(iata, direction);

    if (
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].timestamp < CACHE_DURATION
    ) {
      return res.json(cache[cacheKey].data);
    }

    const apiDirection = direction === "departures" ? "Departure" : "Arrival";

    const now = new Date();
    const from = now;
const to = new Date(now.getTime() + 11 * 60 * 60 * 1000);
    monthlyApiCalls++;

    const response = await axios.get(
      `https://${RAPIDAPI_HOST}/flights/airports/iata/${iata}/${formatDateForApi(from)}/${formatDateForApi(to)}`,
      {
        params: {
          direction: apiDirection,
          withCancelled: true,
          withCodeshared: false,
          withCargo: false,
          withPrivate: false,
          withLocation: false
        },
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": RAPIDAPI_HOST
        }
      }
    );

    const data = response.data || {};
    const rawFlights =
      direction === "arrivals"
        ? data.arrivals || []
        : data.departures || [];

    const flights = rawFlights
      .map(flight => {
        const movement = flight.movement || {};
        const relatedAirport = movement.airport || {};

        const scheduledTime = movement.scheduledTime?.local || null;
        const estimatedTime = getBestTime(movement);
        const actualTime =
          movement.actualTime?.local ||
          movement.runwayTime?.local ||
          null;

        const bestTime = actualTime || estimatedTime || scheduledTime;

        const minutesToFlight = bestTime
          ? Math.round((new Date(bestTime) - now) / 60000)
          : null;

        return {
          flightNumber: flight.number || flight.callsign || "Unknown",
          callsign: flight.callsign || "",
          airline: flight.airline?.name || "Unknown",
          airport: relatedAirport.name || relatedAirport.iata || "Unknown",
          airportCode: relatedAirport.iata || "",
          selectedAirport: iata,
          direction,
          status: getStatus(scheduledTime, bestTime, flight.status),
          rawStatus: flight.status || "Unknown",
          scheduledTime,
          estimatedTime,
          actualTime,
          minutesToFlight
        };
      })
      .filter(flight => {
        if (flight.flightNumber === "Unknown") return false;
        if (flight.airport === "Unknown") return false;
        if (flight.minutesToFlight === null) return false;

        return flight.minutesToFlight >= -30 && flight.minutesToFlight <= 12 * 60;
      })
      .sort((a, b) => a.minutesToFlight - b.minutesToFlight);

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: flights
    };

    res.json(flights);

  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(err.response?.status || 500).json({
      error: "Erreur récupération vols AeroDataBox",
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});