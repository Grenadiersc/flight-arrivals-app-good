import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const API_KEY = process.env.AERODATABOX_API_KEY;

function getTime(obj) {
  return (
    obj?.revisedTime?.local ||
    obj?.predictedTime?.local ||
    obj?.actualTime?.local ||
    obj?.scheduledTime?.local ||
    null
  );
}

app.get("/api/flights/:iata/:direction", async (req, res) => {
  const iata = req.params.iata.toUpperCase();
  const direction =
    req.params.direction === "departures" ? "Departure" : "Arrival";

  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + 10 * 60 * 60 * 1000);

  const format = d => d.toISOString().slice(0, 16);

  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${iata}/${format(from)}/${format(to)}` +
    `?direction=${direction}&withCancelled=true&withCodeshared=true&withCargo=false&withPrivate=false`;

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

    const list = direction === "Arrival" ? data.arrivals || [] : data.departures || [];

    const result = list
      .map(flight => {
        const movement = flight.movement || {};
        const airport = movement.airport || {};

        const scheduledTime = movement.scheduledTime?.local || null;
        const estimatedTime = getTime(movement);
        const actualTime = movement.runwayTime?.local || movement.actualTime?.local || null;
        const bestTime = actualTime || estimatedTime || scheduledTime;

        const minutesToFlight = bestTime
          ? Math.round((new Date(bestTime) - new Date()) / 60000)
          : null;

        let statusText = flight.status || "Unknown";

        if (scheduledTime && estimatedTime && scheduledTime !== estimatedTime) {
          statusText += " (Delayed)";
        }

        return {
          flightNumber: flight.number || flight.callsign || "N/A",
          callsign: flight.callsign || "",
          airline: flight.airline?.name || flight.callsign || "Unknown",
          airport: airport.name || airport.iata || "Unknown",
          selectedAirport: iata,
          direction: req.params.direction,
          status: statusText,
          scheduledTime,
          estimatedTime,
          actualTime,
          minutesToFlight
        };
      })
      .filter(flight => flight.minutesToFlight === null || flight.minutesToFlight >= 0)
      .sort((a, b) => {
        if (a.minutesToFlight === null) return 1;
        if (b.minutesToFlight === null) return -1;
        return a.minutesToFlight - b.minutesToFlight;
      });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

app.get("/api/arrivals/:iata", async (req, res) => {
  req.params.direction = "arrivals";
  app._router.handle(req, res);
});

app.get("/", (req, res) => {
  res.send("Flight Board API running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Backend running");
});