const express = require("express");
const { stringify } = require("csv-stringify/sync");
const { getAnalytics } = require("../services/pythonClient");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await getAnalytics({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      category: req.query.category,
      userId: req.user.role === "admin" ? req.query.userId : req.user.id
    });
    res.json(data);
  } catch (error) { next(error); }
});

router.get("/export.csv", async (req, res, next) => {
  try {
    const data = await getAnalytics({
      ...req.query,
      userId: req.user.role === "admin" ? req.query.userId : req.user.id
    });
    const rows = [
      ["metric", "value"],
      ["totalRevenue", data.kpis.totalRevenue],
      ["totalOrders", data.kpis.totalOrders],
      ["averageOrderValue", data.kpis.averageOrderValue],
      [],
      ["month", "revenue"],
      ...data.monthlyRevenue.map(row => [row.month, row.revenue])
    ];
    res.header("Content-Type", "text/csv");
    res.attachment("sales-analytics-report.csv");
    res.send(stringify(rows));
  } catch (error) { next(error); }
});

module.exports = router;
