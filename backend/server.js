const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.AVIATIONSTACK_API_KEY;

const cache = {};

const CACHE_DURATION = 1000 * 60 * 30;

function getCacheKey(iata, direction) {
  return `${iata}_${direction}`;
}

function getStatus(scheduled, estimated) {
  if (!scheduled || !estimated) {
    return "Unknown";
  }

  const scheduledDate = new Date(scheduled);
  const estimatedDate = new Date(estimated);

  const diffMinutes =
    (estimatedDate - scheduledDate) / 60000;

  if (diffMinutes >= 5) {
    return "Delayed";
  }

  if (diffMinutes <= -5) {
    return "Early";
  }

  return "On Time";
}

app.get("/api/flights/:iata/:direction", async (req, res) => {
  try {
    const iata = req.params.iata.toUpperCase();
    const direction = req.params.direction;

    const cacheKey = getCacheKey(iata, direction);

    if (
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].timestamp < CACHE_DURATION
    ) {
      console.log("Serving from cache:", cacheKey);

      return res.json(cache[cacheKey].data);
    }

    const type =
      direction === "departures"
        ? "departure"
        : "arrival";

    const response = await axios.get(
      "http://api.aviationstack.com/v1/flights",
      {
        params: {
          access_key: API_KEY,
          limit: 20,
          [`${type}_iata`]: iata
        }
      }
    );

    const flights = (response.data.data || []).map(flight => {
      const scheduledTime =
        type === "arrival"
          ? flight.arrival?.scheduled
          : flight.departure?.scheduled;

      const estimatedTime =
        type === "arrival"
          ? flight.arrival?.estimated
          : flight.departure?.estimated;

      const airport =
        type === "arrival"
          ? flight.departure?.airport
          : flight.arrival?.airport;

      return {
        flightNumber:
          flight.flight?.iata || "Unknown",

        airline:
          flight.airline?.name || "Unknown",

        airport:
          airport || "Unknown",

        scheduledTime,

        estimatedTime,

        actualTime:
          type === "arrival"
            ? flight.arrival?.actual
            : flight.departure?.actual,

        status: getStatus(
          scheduledTime,
          estimatedTime
        ),

        minutesToFlight: scheduledTime
          ? Math.round(
              (new Date(scheduledTime) - new Date()) /
              60000
            )
          : null,

        selectedAirport: iata
      };
    });

    cache[cacheKey] = {
      timestamp: Date.now(),
      data: flights
    };

    res.json(flights);

  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Erreur récupération vols"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});