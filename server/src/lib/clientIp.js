const { isIP } = require("node:net");
function clientIp(req) {
  // Vercel overwrites this header at its edge; never trust it on arbitrary hosts.
  if (process.env.VERCEL === "1") {
    const value = String(req.headers?.["x-vercel-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    if (isIP(value)) return value;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
module.exports = { clientIp };
