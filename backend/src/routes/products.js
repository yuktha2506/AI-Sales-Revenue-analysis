const express = require("express");
const { z } = require("zod");
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const productSchema = z.object({ name: z.string().min(1), category: z.string().min(1), price: z.number().nonnegative() });

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT id, name, category, price FROM products ORDER BY category, name LIMIT 500");
    res.json({ products: rows });
  } catch (error) { next(error); }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    const [result] = await pool.execute("INSERT INTO products (name, category, price) VALUES (?, ?, ?)", [body.name, body.category, body.price]);
    res.status(201).json({ product: { id: result.insertId, ...body } });
  } catch (error) { next(error); }
});

module.exports = router;
