/**
 * scripts/cleanupOptionLabels.js
 *
 * OPTIONAL. Not required for correct behavior — Section, FreeMockSection,
 * and Mcq documents already have their option text cleaned automatically
 * on every read (see the post-find hooks in those models), so old MCQs
 * display correctly with no migration at all.
 *
 * This script exists only if you'd also like to permanently strip the
 * redundant "A) "/"B."/"C -"/"D:" style label prefixes out of the stored
 * option text itself, rather than relying on the read-time cleanup.
 *
 * It ONLY ever rewrites the `options` array text (and only the label
 * prefix at the very start of each option). It never touches `question`,
 * `correctIndex`/`correctOption`, `explanation`, images, or any other
 * field, and it never deletes any document.
 *
 * DRY RUN BY DEFAULT — prints what it would change without writing
 * anything. Pass --apply to actually perform the updates.
 *
 * Usage:
 *   node scripts/cleanupOptionLabels.js            # dry run, all collections
 *   node scripts/cleanupOptionLabels.js --apply     # actually rewrite
 *
 * Requires the same MONGODB_URI / .env setup as the main server.
 */

import "dotenv/config";
import mongoose from "mongoose";
import Section from "../models/Section.js";
import FreeMockSection from "../models/FreeMockSection.js";
import Mcq from "../models/Mcq.js";
import { stripOptionLabelPrefix } from "../utils/optionLabelCleaner.js";

const APPLY = process.argv.includes("--apply");

function cleanArray(options) {
  if (!Array.isArray(options)) return { changed: false, cleaned: options };
  const cleaned = options.map((o) => (typeof o === "string" ? stripOptionLabelPrefix(o) : o));
  const changed = cleaned.some((c, i) => c !== options[i]);
  return { changed, cleaned };
}

// NOTE: these deliberately use the raw native-driver collection
// (Model.collection), NOT Model.find(). Section/FreeMockSection/Mcq all
// have a post-find hook that already cleans option labels on the way out
// for the app's normal read paths — going through Model.find() here would
// mean every document already looks "clean" by the time this script sees
// it, so nothing would ever get flagged or rewritten. Reading the raw
// collection sees the actual bytes on disk.

// ── Section / FreeMockSection: embedded mcqs array ─────────────
async function cleanEmbedded(Model, label) {
  const cursor = Model.collection.find({}, { projection: { mcqs: 1 } });
  let docsTouched = 0;
  let optionsTouched = 0;

  for await (const doc of cursor) {
    if (!Array.isArray(doc.mcqs) || doc.mcqs.length === 0) continue;

    let docChanged = false;
    const updates = [];

    doc.mcqs.forEach((mcq) => {
      const { changed, cleaned } = cleanArray(mcq.options);
      if (changed) {
        docChanged = true;
        optionsTouched += 1;
        updates.push({ mcqId: mcq._id, options: cleaned });
      }
    });

    if (!docChanged) continue;
    docsTouched += 1;

    console.log(`  [${label} ${doc._id}] ${updates.length} MCQ option array(s) would be cleaned`);

    if (APPLY) {
      for (const u of updates) {
        await Model.collection.updateOne(
          { _id: doc._id, "mcqs._id": u.mcqId },
          { $set: { "mcqs.$.options": u.options } }
        );
      }
    }
  }

  console.log(
    `${label}: ${docsTouched} document(s) / ${optionsTouched} MCQ(s) ${APPLY ? "cleaned" : "would be cleaned"}.`
  );
}

// ── Mcq: standalone collection, one doc per MCQ ─────────────────
async function cleanMcqCollection() {
  const cursor = Mcq.collection.find({}, { projection: { options: 1 } });
  let touched = 0;
  const bulkOps = [];

  for await (const doc of cursor) {
    const { changed, cleaned } = cleanArray(doc.options);
    if (!changed) continue;
    touched += 1;
    console.log(`  [Mcq ${doc._id}] options would be cleaned`);
    bulkOps.push({
      updateOne: { filter: { _id: doc._id }, update: { $set: { options: cleaned } } },
    });
  }

  if (APPLY && bulkOps.length > 0) {
    await Mcq.collection.bulkWrite(bulkOps);
  }

  console.log(`Mcq collection: ${touched} document(s) ${APPLY ? "cleaned" : "would be cleaned"}.`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run this from the server/ directory with your .env in place.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify data)" : "DRY RUN (no changes)"}\n`);

  await cleanEmbedded(Section, "Section");
  console.log("");
  await cleanEmbedded(FreeMockSection, "FreeMockSection");
  console.log("");
  await cleanMcqCollection();

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to actually perform these changes.");
  } else {
    console.log("\nDone.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
