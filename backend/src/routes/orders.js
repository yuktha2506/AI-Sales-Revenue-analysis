const express = require("express");
const { z } = require("zod");
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const orderSchema = z.object({
  userId: z.number().int().positive(),
  date: z.string(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1)
});

router.get("/", async (req, res, next) => {
  try {
    const params = [];
    const whereClause = req.user.role === "admin" ? "" : "WHERE o.user_id = ?";
    if (req.user.role !== "admin") params.push(req.user.id);
    const [rows] = await pool.execute(`
      SELECT o.id, o.date, u.name AS customer, SUM(oi.quantity * products.price) AS revenue
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products ON products.id = oi.product_id
      ${whereClause}
      GROUP BY o.id, o.date, u.name
      ORDER BY o.date DESC
      LIMIT 200
    `, params);
    res.json({ orders: rows });
  } catch (error) { next(error); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const body = orderSchema.parse(req.body);
    await conn.beginTransaction();
    const [orderResult] = await conn.execute("INSERT INTO orders (user_id, date) VALUES (?, ?)", [body.userId, body.date]);
    for (const item of body.items) {
      await conn.execute("INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)", [orderResult.insertId, item.productId, item.quantity]);
    }
    await conn.commit();
    const payload = { orderId: orderResult.insertId, userId: body.userId, date: body.date };
    req.app.get("io")?.emit("order:created", payload);
    res.status(201).json(payload);
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

module.exports = router;
