// server.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const fetch = require("node-fetch"); // Ensure node-fetch installed v3+ for ESM, or use native fetch in Node 18+

const app = express();

// ---- CORS: allow only your frontend (replace with your domain) ----
app.use(
  cors({
    origin: ["http://localhost:3000", "https://yourfrontend.com"], // frontend URLs
    methods: ["GET"],
  }),
);

// ---- JSON parser ----
app.use(express.json());

// ---- Rate Limiter: max 1 request/sec per IP ----
const orsLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 1,
  message: { error: "Too many requests, slow down!" },
});
app.use("/route", orsLimiter);

// ---- Simple in-memory cache ----
const routeCache = new Map();

// ---- Route: ORS Directions ----
app.get("/route", async (req, res) => {
  try {
    const { start, end } = req.query;

    // ---- Validate query params ----
    if (!start || !end) {
      return res.status(400).json({ error: "Missing start or end parameters" });
    }

    // ---- Check cache first ----
    const cacheKey = `${start}_${end}`;
    if (routeCache.has(cacheKey)) {
      return res.json({ ...routeCache.get(cacheKey), cached: true });
    }

    // ---- Check API key ----
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Missing ORS API key in environment" });
    }

    // ---- Fetch from OpenRouteService ----
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start}&end=${end}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    // ---- Cache route for 10 minutes ----
    routeCache.set(cacheKey, data);
    setTimeout(() => routeCache.delete(cacheKey), 10 * 60 * 1000); // 10 min TTL

    res.json({ ...data, cached: false });
  } catch (error) {
    console.error("Route fetch error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// ---- Health check ----
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// ---- Start server ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
