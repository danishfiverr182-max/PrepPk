/**
 * models/ChatFeedback.js  (Part 11   Prompt 5)
 *
 * Thumbs-up / thumbs-down rating on an individual assistant reply.
 * Only a short snippet of the message is stored (first 100 chars, capped
 * server-side regardless of what the client sends) so the admin can spot
 * patterns in bad answers without full conversations ever being retained.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const chatFeedbackSchema = new Schema({
  // First 100 chars of the assistant reply being rated   context only,
  // never the full conversation.
  messageSnippet: {
    type: String,
    default: "",
    maxlength: 100,
  },
  rating: {
    type: String,
    enum: ["up", "down"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("ChatFeedback", chatFeedbackSchema);
