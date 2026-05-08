const express = require("express");
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.role, COUNT(o.id) AS totalOrders
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY u.created_at DESC
      LIMIT 200
    `);
    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
