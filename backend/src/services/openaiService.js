const OpenAI = require("openai");

function buildFallbackAnswer(question, context) {
  const bestCategory = context.categoryRevenue?.[0];
  const topProduct = context.topProducts?.[0];
  const trend = context.monthlyRevenue || [];
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const direction = latest && previous
    ? latest.revenue >= previous.revenue ? "up" : "down"
    : "not enough monthly history";

  return {
    answer: [
      `Based on the current data, total revenue is ${context.currency || "INR"} ${Number(context.totalRevenue || 0).toLocaleString()} across ${context.totalOrders || 0} orders.`,
      bestCategory ? `The strongest category is ${bestCategory.category}, contributing ${context.currency || "INR"} ${Number(bestCategory.revenue).toLocaleString()}.` : "",
      topProduct ? `The top product/SKU is ${topProduct.name} with ${Number(topProduct.quantity).toLocaleString()} units sold.` : "",
      latest && previous ? `The latest month is trending ${direction} versus the previous month.` : "",
      `Question received: "${question}". Add OPENAI_API_KEY for richer narrative explanations.`
    ].filter(Boolean).join(" ")
  };
}

async function askInsightsAssistant(question, context) {
  if (!process.env.OPENAI_API_KEY?.trim()) return buildFallbackAnswer(question, context);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), timeout: 15000, maxRetries: 0 });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a sales analytics assistant. Answer only from the supplied JSON context. If the data is insufficient, say what is missing. Be concise, business-focused, and include numbers."
        },
        {
          role: "user",
          content: `Question: ${question}\n\nData context JSON:\n${JSON.stringify(context, null, 2)}`
        }
      ]
    });

    return { answer: response.choices[0]?.message?.content || "No insight generated." };
  } catch (error) {
    if ([401, 403, 408, 429, 500, 502, 503, 504].includes(error.status) || error.code || /timeout/i.test(error.message || "")) {
      const fallback = buildFallbackAnswer(question, context);
      return {
        answer: `${fallback.answer} OpenAI could not be used right now, so this answer used local analytics data.`
      };
    }
    throw error;
  }
}

module.exports = { askInsightsAssistant };
