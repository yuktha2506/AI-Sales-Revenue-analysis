const express = require("express");
const { getForecast } = require("../services/pythonClient");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const months = Math.min(Number(req.query.months || 6), 6);
    res.json(await getForecast({
      months,
      userId: req.user.role === "admin" ? req.query.userId : req.user.id
    }));
  } catch (error) { next(error); }
});

module.exports = router;
