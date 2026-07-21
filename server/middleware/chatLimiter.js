import rateLimit from "express-rate-limit";

// ── chatLimiter ───────────────────────────────────────────────
// Applied to POST /api/chat/message
// 15 requests per 10 minutes per IP address
export const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many chat messages from this IP. Please wait 10 minutes before trying again.",
  },
});
