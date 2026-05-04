const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// ----------------- CORS -----------------
const allowedOrigins = [
  "http://localhost:5173",
  "https://uzon.netlify.app",
  "https://aniugogeo.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

app.use(express.json());

// ----------------- Rate Limiter -----------------
const routeLimiter = rateLimit({
  windowMs: 2000,
  max: 10,
  message: { error: "Too many requests, slow down!" },
});

app.use("/route", routeLimiter);

// ----------------- Cache -----------------
const routeCache = new Map();

// ----------------- Mapbox Route Endpoint -----------------
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

    const [startLng, startLat] = start.split(",").map(Number);
    const [endLng, endLat] = end.split(",").map(Number);

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&steps=true&overview=full&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    // Cache for 10 minutes
    routeCache.set(cacheKey, data);
    setTimeout(() => routeCache.delete(cacheKey), 10 * 60 * 1000);

    res.json({ ...data, cached: false });
  } catch (err) {
    console.error("Route fetch error:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});

// ----------------- Health -----------------
app.get("/", (req, res) => res.send("Backend is running ✅"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
