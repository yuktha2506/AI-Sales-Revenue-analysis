const axios = require("axios");

const client = axios.create({
  baseURL: process.env.PYTHON_SERVICE_URL || "http://localhost:8000",
  timeout: 60000
});

async function getAnalytics(filters) {
  const { data } = await client.get("/analytics", { params: filters });
  return data;
}

async function getForecast(months = 6) {
  const params = typeof months === "object" ? months : { months };
  const { data } = await client.get("/predict", { params });
  return data;
}

async function getSummary(filters) {
  const { data } = await client.get("/summary", { params: filters });
  return data;
}

module.exports = { getAnalytics, getForecast, getSummary };
