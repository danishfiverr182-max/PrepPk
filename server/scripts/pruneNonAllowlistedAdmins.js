/**
 * scripts/pruneNonAllowlistedAdmins.js
 *
 * Run this ONCE, right after deploying the ADMIN_ALLOWED_EMAILS restriction,
 * to check whether anyone registered an admin account before the allowlist
 * existed (e.g. if your admin secret URL was ever discovered).
 *
 * By default this only REPORTS — it does not delete anything until you pass
 * --delete explicitly, so you always see what's there first.
 *
 * Usage:
 *   node scripts/pruneNonAllowlistedAdmins.js            (dry run — report only)
 *   node scripts/pruneNonAllowlistedAdmins.js --delete   (actually remove them)
 */

import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import { getAdminAllowlist, maskEmail } from "../utils/adminAllowlist.js";

async function main() {
  const shouldDelete = process.argv.includes("--delete");
  const allowlist = getAdminAllowlist();

  if (allowlist.length === 0) {
    console.error("❌ ADMIN_ALLOWED_EMAILS is empty — refusing to run (would flag every admin as stray).");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connected. Allowlist has ${allowlist.length} address(es) (not printed).`);

  const allAdmins = await Admin.find({}).select("email fullName createdAt googleId");
  const stray = allAdmins.filter((a) => !allowlist.includes(a.email.toLowerCase()));

  console.log(`\nTotal admin accounts in DB: ${allAdmins.length}`);
  console.log(`Allow-listed accounts:      ${allAdmins.length - stray.length}`);
  console.log(`Stray (NOT allow-listed):   ${stray.length}\n`);

  if (stray.length === 0) {
    console.log("Nothing to do — every existing admin account is on the allowlist.");
  } else {
    console.log("Stray admin accounts found:");
    stray.forEach((a) => {
      console.log(
        `  - ${maskEmail(a.email)} | name: ${a.fullName} | created: ${a.createdAt?.toISOString()} | via Google: ${!!a.googleId}`
      );
    });

    if (shouldDelete) {
      const ids = stray.map((a) => a._id);
      const result = await Admin.deleteMany({ _id: { $in: ids } });
      console.log(`\n🗑️  Deleted ${result.deletedCount} stray admin account(s).`);
    } else {
      console.log(
        "\nThis was a dry run — no changes made. Re-run with --delete to remove these accounts."
      );
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
