/**
 * routes/chatRoutes.js
 *
 * AI chatbot feature ("PrepPk AI Study Assistant").
 *
 * POST /api/chat/message
 *   chatLimiter  → 15 requests / 10 min per IP
 *   optionalUser → attaches req.user if logged-in premium user, but never
 *                  blocks guests from using the chatbot
 *   chatGuestId  → attaches req.chatGuestId, a stable anonymous identity
 *                  (cookie-backed) used to enforce the guest lifetime
 *                  message cap in chatController   see that middleware
 *                  for why this can't just be IP or sessionStorage.
 *   chatController.sendMessage
 */

import { Router } from "express";
import { chatLimiter } from "../middleware/chatLimiter.js";
import { optionalUser } from "../middleware/optionalUser.js";
import { chatGuestId } from "../middleware/chatGuestId.js";
import { sendMessage, submitFeedback } from "../controllers/chatController.js";

const router = Router();

router.post("/message", chatLimiter, optionalUser, chatGuestId, sendMessage);

// Thumbs-up/down feedback on an assistant reply (Part 11   Prompt 5).
// No chatLimiter here deliberately   sharing that limiter's counter would
// eat into the same 15/10min budget as real chat messages, for an action
// that's low-risk and much cheaper than a Groq call.
router.post("/feedback", optionalUser, submitFeedback);

export default router;
