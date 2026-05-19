const mysql = require("mysql2/promise");
const fs = require("fs");

function sslOptions() {
  const caPath = process.env.DB_SSL_CA_PATH;
  if (!caPath) return undefined;
  return {
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
  };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sales_analytics",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: true,
  ssl: sslOptions()
});

module.exports = { pool };
