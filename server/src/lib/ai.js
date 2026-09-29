const {clientIp} = require("./clientIp");
const crypto = require("node:crypto");
const { supabase } = require("./supabase");

const limit = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const limits = () => ({
  userDay: limit("AI_USER_DAILY_LIMIT", 3),
  userMonth: limit("AI_USER_MONTHLY_LIMIT", 10),
  ipDay: limit("AI_IP_DAILY_LIMIT", 10),
  globalDay: limit("AI_GLOBAL_DAILY_LIMIT", 20),
  globalMonth: limit("AI_GLOBAL_MONTHLY_LIMIT", 100),
  cooldown: limit("AI_COOLDOWN_SECONDS", 60),
});
const aiEnabled = () =>
  process.env.AI_ENABLED === "true" && !!process.env.CLAUDE_API_KEY;

function createAiGuard({
  database = supabase,
  enabled = aiEnabled,
  getLimits = limits,
} = {}) {
  return async (req, res, next) => {
    if (!req.user?.id)
      return res
        .status(401)
        .json({ error: "Sign in to use optional AI features." });
    if (!req.user.email_confirmed_at)
      return res
        .status(403)
        .json({ error: "Confirm your email before using AI." });
    if (!enabled())
      return res
        .status(503)
        .json({
          error:
            "AI reading is currently turned off. You can enter the details yourself.",
        });
    if (!database)
      return res
        .status(503)
        .json({
          error:
            "AI usage protection is unavailable. Please enter the details yourself.",
        });
    try {
      const budget = getLimits();
      const ipHash = crypto
        .createHmac(
          "sha256",
          process.env.AI_IP_HASH_SECRET ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            "local-disabled",
        )
        .update(clientIp(req))
        .digest("hex");
      const { data, error } = await database.rpc("consume_ai_quota", {
        p_user: req.user.id,
        p_ip_hash: ipHash,
        p_user_day: budget.userDay,
        p_user_month: budget.userMonth,
        p_ip_day: budget.ipDay,
        p_global_day: budget.globalDay,
        p_global_month: budget.globalMonth,
        p_cooldown: budget.cooldown,
      });
      if (error || !data || typeof data.allowed !== "boolean")
        throw new Error("Quota unavailable");
      if (!data.allowed) {
        res.set(
          "Retry-After",
          String(Math.max(1, Number(data.retryAfter) || 60)),
        );
        return res
          .status(429)
          .json({
            error:
              "The AI allowance has been reached. You can still enter details and find routes without AI.",
            retryAfter: data.retryAfter,
          });
      }
      next();
    } catch {
      // Never call the paid provider when the shared, durable budget cannot be checked.
      res
        .status(503)
        .json({
          error:
            "AI usage protection is temporarily unavailable. Please enter the details yourself.",
        });
    }
  };
}

async function callAi(system, messages, fetcher = fetch) {
  const model = process.env.AI_MODEL || "claude-sonnet-5-5";
  const response = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      // Sonnet 5.5 otherwise spends the shared output budget on thinking first.
      // These short, tool-free reading requests need the budget for their answer.
      ...(model === "claude-sonnet-5-5"
        ? {
            thinking: { type: "between_tools" },
            output_config: { effort: "medium" },
          }
        : {}),
      max_tokens: 768,
      system,
      messages,
    }),
  });
  if (!response.ok)
    throw new Error(
      "AI reading is unavailable. Please try entering the details yourself.",
    );
  const result = await response.json();
  if (result.stop_reason === "max_tokens")
    throw new Error(
      "The image could not be read completely. Try a clearer crop, or enter the details.",
    );
  return (result.content || [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
module.exports = { createAiGuard, callAi, aiEnabled, limits };
