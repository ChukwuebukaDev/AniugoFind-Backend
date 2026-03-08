const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const fetch = require("node-fetch");

const app = express();

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
  }),
);

app.use(express.json());

// ---- Rate Limiter: max 2 request/sec per IP ----
const orsLimiter = rateLimit({
  windowMs: 1000,
  max: 20,
  message: { error: "Too many requests, slow down!" },
});
app.use("/route", orsLimiter);

const routeCache = new Map();

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
//ORS_API_KEY=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjcwYmQxOWQyYzVhOGVmZThiYWFmYzVmMGZiOWVkODJkMTkwMTVhZjdlMGI2MjA3Y2Y5OWJjZjA4IiwiaCI6Im11cm11cjY0In0=

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
