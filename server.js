// server.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://aniugogeo.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(express.json());

// Rate limiter for /route
const orsLimiter = rateLimit({
  windowMs: 2000, // 2 seconds
  max: 10,
  message: { error: "Too many requests, slow down!" },
});
app.use("/route", orsLimiter);

// Simple in-memory cache
const routeCache = new Map();

// Route endpoint
app.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "Missing start or end parameters" });
    }

    const cacheKey = `${start}_${end}`;
    if (routeCache.has(cacheKey)) {
      return res.json({ ...routeCache.get(cacheKey), cached: true });
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ORS API key is missing in environment" });
    }
console.log('hello from aniugo')
    // Convert start/end to numbers
    const [startLng, startLat] = start.split(",").map(Number);
    const [endLng, endLat] = end.split(",").map(Number);

    // Validate coordinates
    if ([startLng, startLat, endLng, endLat].some(isNaN)) {
      return res.status(400).json({ error: "Invalid start or end coordinates" });
    }

    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [startLng, startLat],
          [endLng, endLat],
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    // Cache the result for 10 minutes
    routeCache.set(cacheKey, data);
    setTimeout(() => routeCache.delete(cacheKey), 10 * 60 * 1000);

    res.json({ ...data, cached: false });
  } catch (error) {
    console.error("Route fetch error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));