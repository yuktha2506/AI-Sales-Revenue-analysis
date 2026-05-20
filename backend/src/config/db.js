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

const pool = mysql.createPool({
  host: env("DB_HOST", "localhost"),
  port: Number(env("DB_PORT", "3306")),
  user: env("DB_USER", "root"),
  password: env("DB_PASSWORD"),
  database: env("DB_NAME", "sales_analytics"),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true,
  ssl: sslOptions()
});

module.exports = { pool };
