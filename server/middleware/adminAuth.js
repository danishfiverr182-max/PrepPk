import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { isAllowedAdminEmail } from "../utils/adminAllowlist.js";

export async function protect(req, res, next) {
  try {
    // Support both prod (__Host- prefix) and dev cookie names
    const token = req.cookies?.["__Host-adminToken"] ?? req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    // Support both old payload ({ id }) and new payload ({ adminId })
    const adminId = decoded.adminId ?? decoded.id;
    const admin = await Admin.findById(adminId).select("-password -verificationCode -verificationExpires");
    if (!admin) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    // Same instant-revocation check as verifyAdmin.js — see that file for
    // the full rationale.
    if (!isAllowedAdminEmail(admin.email)) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authenticated." });
  }
}
