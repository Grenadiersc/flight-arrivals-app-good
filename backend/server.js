const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.AVIATIONSTACK_API_KEY;

const cache = {};
const CACHE_DURATION = 1000 * 60 * 60 * 12;

let monthlyApiCalls = 0;
const MONTHLY_LIMIT = 100;

function getCacheKey(iata, direction) {
  return `${iata}_${direction}`;
}

function getStatus(scheduled, estimated) {
  if (!scheduled || !estimated) {
    return "Unknown";
  }

  const scheduledDate = new Date(scheduled);
  const estimatedDate = new Date(estimated);

  const diffMinutes = Math.round((estimatedDate - scheduledDate) / 60000);

  if (diffMinutes >= 5) {
    return "Delayed";
  }

  if (diffMinutes <= -5) {
    return "Early";
  }

  return "On Time";
}

app.get("/", (req, res) => {
  res.send("Flight Board API running");
});

app.get("/api/quota", (req, res) => {
  res.json({
    used: monthlyApiCalls,
    remaining: Math.max(MONTHLY_LIMIT - monthlyApiCalls, 0),
    limit: MONTHLY_LIMIT,
    cacheDurationHours: 12,
    note: "Compteur approximatif côté serveur. Le vrai quota officiel est visible sur AviationStack."
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
      console.log("Serving from cache:", cacheKey);
      return res.json(cache[cacheKey].data);
    }

    const type = direction === "departures" ? "departure" : "arrival";

    monthlyApiCalls++;

    const response = await axios.get(
      "http://api.aviationstack.com/v1/flights",
      {
        params: {
          access_key: API_KEY,
          limit: 100,
          [`${type}_iata`]: iata
        }
      }
    );

    if (response.data.error) {
      return res.status(429).json(response.data.error);
    }

    const now = new Date();
    const maxHoursAhead = 12;

    const flights = (response.data.data || [])
      .map(flight => {
        const scheduledTime =
          type === "arrival"
            ? flight.arrival?.scheduled
            : flight.departure?.scheduled;

        const estimatedTime =
          type === "arrival"
            ? flight.arrival?.estimated
            : flight.departure?.estimated;

        const actualTime =
          type === "arrival"
            ? flight.arrival?.actual
            : flight.departure?.actual;

        const airport =
          type === "arrival"
            ? flight.departure?.airport
            : flight.arrival?.airport;

        const flightTime = new Date(estimatedTime || scheduledTime);

        const minutesToFlight =
          scheduledTime || estimatedTime
            ? Math.round((flightTime - now) / 60000)
            : null;

        return {
          flightNumber: flight.flight?.iata || "Unknown",
          airline: flight.airline?.name || "Unknown",
          airport: airport || "Unknown",
          scheduledTime,
          estimatedTime,
          actualTime,
          status: getStatus(scheduledTime, estimatedTime),
          minutesToFlight,
          selectedAirport: iata
        };
      })
      .filter(flight => {
        if (!flight.scheduledTime && !flight.estimatedTime) return false;
        if (flight.flightNumber === "Unknown") return false;
        if (flight.airport === "Unknown") return false;
        if (flight.minutesToFlight === null) return false;

        return (
          flight.minutesToFlight >= -30 &&
          flight.minutesToFlight <= maxHoursAhead * 60
        );
      })
      .sort((a, b) => a.minutesToFlight - b.minutesToFlight);

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: flights
    };

    res.json(flights);

  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Erreur récupération vols",
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});