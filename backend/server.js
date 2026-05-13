import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const API_KEY = process.env.AERODATABOX_API_KEY;

let airportCache = null;

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTime(obj) {
  return (
    obj?.revisedTime?.local ||
    obj?.predictedTime?.local ||
    obj?.actualTime?.local ||
    obj?.scheduledTime?.local ||
    null
  );
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function getAirports() {
  if (airportCache) return airportCache;

  const response = await fetch(
    "https://davidmegginson.github.io/ourairports-data/airports.csv"
  );

  const csv = await response.text();

  airportCache = csv
    .split("\n")
    .slice(1)
    .map(line => parseCSVLine(line))
    .filter(cols => cols[13] && cols[13].length === 3)
    .map(cols => ({
      code: cols[13],
      name: cols[3],
      municipality: cols[10],
      country: cols[8]
    }));

  return airportCache;
}

app.get("/api/airports", async (req, res) => {
  try {
    const q = normalizeText(req.query.q || "");

    if (!q) {
      return res.json([]);
    }

    const airports = await getAirports();

    const scored = airports
      .map(a => {
        const code = normalizeText(a.code);
        const name = normalizeText(a.name);
        const city = normalizeText(a.municipality);
        const country = normalizeText(a.country);

        let score = 0;

        if (code === q) score += 100;
        if (city === q) score += 90;
        if (name.includes(q)) score += 50;
        if (city.startsWith(q)) score += 45;
        if (city.includes(q)) score += 35;
        if (country.includes(q)) score += 10;

        return { ...a, score };
      })
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    res.json(scored);
  } catch (err) {
    res.status(500).json({
      error: "Airport search error",
      details: err.message
    });
  }
});

app.get("/api/arrivals/:iata", async (req, res) => {
  const iata = req.params.iata.toUpperCase();

  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + 10 * 60 * 60 * 1000);

  const format = d => d.toISOString().slice(0, 16);

  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${iata}/${format(from)}/${format(to)}` +
    `?direction=Arrival&withCancelled=true&withCodeshared=true&withCargo=false&withPrivate=false`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const arrivals = data.arrivals || [];

    const result = arrivals
      .map(flight => {
        const movement = flight.movement || {};
        const airport = movement.airport || {};

        const scheduledTime = movement.scheduledTime?.local || null;
        const estimatedTime = getTime(movement);
        const actualTime =
          movement.runwayTime?.local ||
          movement.actualTime?.local ||
          null;

        const bestTime = actualTime || estimatedTime || scheduledTime;

        const minutesToArrival = bestTime
          ? Math.round((new Date(bestTime) - new Date()) / 60000)
          : null;

        let statusText = flight.status || "Unknown";

        if (
          scheduledTime &&
          estimatedTime &&
          scheduledTime !== estimatedTime
        ) {
          statusText += " (Delayed)";
        }

        return {
          flightNumber: flight.number || flight.callsign || "N/A",
          callsign: flight.callsign || "",
          airline: flight.airline?.name || flight.callsign || "Unknown",
          from: airport.name || airport.iata || "Unknown",
          to: iata,
          status: statusText,
          scheduledTime,
          estimatedTime,
          actualTime,
          minutesToArrival
        };
      })
      .filter(flight => {
        return flight.minutesToArrival === null || flight.minutesToArrival >= 0;
      });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});