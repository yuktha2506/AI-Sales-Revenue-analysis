const mysql = require("mysql2/promise");
const fs = require("fs");

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function sslOptions() {
  const caPath = env("DB_SSL_CA_PATH");
  if (!caPath) return undefined;
  return {
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
  };
}

function poolConfig() {
  const serviceUri = env("DB_SERVICE_URI");
  if (serviceUri) {
    const url = new URL(serviceUri);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace("/", "") || env("DB_NAME", "defaultdb"),
      ssl: sslOptions() || { rejectUnauthorized: false }
    };
  }

  return {
    host: env("DB_HOST", "localhost"),
    port: Number(env("DB_PORT", "3306")),
    user: env("DB_USER", "root"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME", "sales_analytics"),
    ssl: sslOptions()
  };
}

const pool = mysql.createPool({
  ...poolConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true
});

module.exports = { pool };
