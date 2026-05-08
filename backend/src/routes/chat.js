const express = require("express");
const { z } = require("zod");
const { getSummary } = require("../services/pythonClient");
const { askInsightsAssistant } = require("../services/openaiService");

const router = express.Router();
const schema = z.object({ question: z.string().min(3).max(500), filters: z.object({}).passthrough().optional() });

router.post("/", async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const context = await getSummary({
      ...(body.filters || {}),
      userId: req.user.role === "admin" ? body.filters?.userId : req.user.id
    });
    context.viewer = { id: req.user.id, name: req.user.name, role: req.user.role };
    const answer = await askInsightsAssistant(body.question, context);
    res.json({ ...answer, groundedIn: { generatedAt: new Date().toISOString(), filters: body.filters || {} } });
  } catch (error) { next(error); }
});

module.exports = router;
