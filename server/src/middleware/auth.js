const { createClient } = require("@supabase/supabase-js");

// Public-key client verifies web account tokens server-side.
const supabaseAnon =
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
    : null;

async function authMiddleware(req, res, next) {
  if (req.user) return next();
  if (!req.headers.authorization?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to continue." });
  if (!supabaseAnon)
    return res
      .status(503)
      .json({
        error:
          "Sign-in is not configured. Please try again shortly.",
      });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const {
      data: { user },
      error,
    } = await supabaseAnon.auth.getUser(token);
    if (error || !user)
      return res.status(401).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  } catch {
    res
      .status(503)
      .json({
        error:
          "Account verification is temporarily unavailable. Please try again.",
      });
  }
}

module.exports = { authMiddleware };
