// server.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// Node 22 fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();


// ===============================
// 🌐 CORS
// ===============================
const allowedOrigins = [
  "http://localhost:5173",
  "https://aniugogeo.vercel.app",
  "https://uzon.netlify.app",
  'http://localhost:3000',
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
  })
);

app.use(express.json());


// ===============================
// 🚦 RATE LIMIT
// ===============================
const routeLimiter = rateLimit({
  windowMs: 2000,
  max: 10,
  message: { error: "Too many requests, slow down!" },
});

app.use("/route", routeLimiter);


// ===============================
// 🧠 CACHE
// ===============================
const routeCache = new Map();


// ===============================
// 🔁 FETCH WITH TIMEOUT + RETRY
// ===============================
async function fetchWithRetry(url, retries = 3, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  } catch (err) {
    clearTimeout(timeoutId);

    if (retries > 0) {
      console.warn("Retrying...", err.message);
      return fetchWithRetry(url, retries - 1, timeout);
    }

    throw err;
  }
}


// ===============================
// 🗺️ ROUTE ENDPOINT
// ===============================
app.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: "Missing start or end parameters",
      });
    }

    const [startLng, startLat] = start.split(",").map(Number);
    const [endLng, endLat] = end.split(",").map(Number);

    if ([startLng, startLat, endLng, endLat].some(isNaN)) {
      return res.status(400).json({
        error: "Invalid coordinates",
      });
    }

    // ✅ Improved cache key
    const cacheKey = `${startLng.toFixed(5)},${startLat.toFixed(5)}_${endLng.toFixed(5)},${endLat.toFixed(5)}`;

    if (routeCache.has(cacheKey)) {
      return res.json({
        ...routeCache.get(cacheKey),
        cached: true,
      });
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    // 🔥 FIXED: use retry fetch
    const response = await fetchWithRetry(url);

    const data = await response.json();

    // Cache for 10 minutes
    routeCache.set(cacheKey, data);
    setTimeout(() => routeCache.delete(cacheKey), 10 * 60 * 1000);

    // Prevent memory blow-up
    if (routeCache.size > 1000) {
      routeCache.clear();
    }

    res.json({ ...data, cached: false });

  } catch (err) {
    console.error("Route fetch error:", err.message);

    res.status(500).json({
      error: "Routing failed",
      details: err.message,
    });
  }
});


// ===============================
// ❤️ HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});


// ===============================
// 🚀 START SERVER (FIXED)
// ===============================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});