require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const { Server } = require("socket.io");
const logger = require("./utils/logger");
const { requireAuth } = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(",") || "*";
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins }
});

io.on("connection", socket => {
  logger.info({ socketId: socket.id }, "Socket connected");
  socket.emit("connected", { message: "Live analytics channel ready" });
});

app.set("io", io);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120 }));
app.use(pinoHttp({ logger }));

app.get("/health", (req, res) => res.json({ status: "ok", service: "sales-api" }));
app.use("/auth", require("./routes/auth"));
app.use("/users", requireAuth, require("./routes/users"));
app.use("/products", requireAuth, require("./routes/products"));
app.use("/orders", requireAuth, require("./routes/orders"));
app.use("/analytics", requireAuth, require("./routes/analytics"));
app.use("/predict", requireAuth, require("./routes/predict"));
app.use("/chat", requireAuth, require("./routes/chat"));

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
  req.log.error(err);
  if (err.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: err.errors });
  res.status(err.response?.status || 500).json({ error: err.response?.data?.detail || err.message || "Internal server error" });
});

server.listen(port, () => logger.info(`API running on port ${port}`));
