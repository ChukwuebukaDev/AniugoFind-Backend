const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ---- Proper CORS ----
app.use(
  cors({
    origin: "*",
    methods: ["GET"],
  })
);

app.use(express.json());

// ---- Route: ORS Directions ----
app.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "Missing start or end" });
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing ORS API key" });
    }

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start}&end=${end}`;

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ---- Basic health check ----
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// ---- Start server ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
