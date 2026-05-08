const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { pool } = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "8h" }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [body.name, body.email.toLowerCase(), passwordHash, body.role || "user"]
    );
    const user = { id: result.insertId, name: body.name, email: body.email.toLowerCase(), role: body.role || "user" };
    res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already registered" });
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const [rows] = await pool.execute("SELECT id, name, email, password, role FROM users WHERE email = ?", [body.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    delete user.password;
    res.json({ user, token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, (req, res) => {
  res.json({ message: "Logout successful. Remove the JWT from client storage." });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
