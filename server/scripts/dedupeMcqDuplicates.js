/**
 * scripts/dedupeMcqDuplicates.js
 *
 * One-off cleanup for the double-flush autosave bug in AdminCustomTestPage
 * / AdminFreeCustomTestPage: navigating back to the dashboard right after
 * an autosave could re-send the same trailing batch a second time, since
 * the unmount cleanup effect read a stale `lastSavedIndex` and re-posted
 * MCQs that were already saved. That created exact duplicate Mcq
 * documents (same testId + testModel + question + options + correctOption)
 * with different `order` values.
 *
 * This script finds those duplicate groups per test and deletes every
 * copy except the one with the lowest `order` (i.e. the original), then
 * corrects the test's denormalized `mcqCount` to match reality and
 * compacts the remaining `order` values to a clean 0..N-1 sequence (so
 * there are no gaps left behind by the deletions).
 *
 * DRY RUN BY DEFAULT — prints what it would do without changing anything.
 * Pass --apply to actually perform the deletions and fixes.
 *
 * Usage:
 *   node scripts/dedupeMcqDuplicates.js                # dry run, all tests
 *   node scripts/dedupeMcqDuplicates.js --apply         # actually fix, all tests
 *   node scripts/dedupeMcqDuplicates.js --testId=<id>   # scope to one test
 *   node scripts/dedupeMcqDuplicates.js --testId=<id> --apply
 *
 * Requires the same MONGODB_URI / .env setup as the main server.
 */

import "dotenv/config";
import mongoose from "mongoose";
import Mcq from "../models/Mcq.js";
import Test from "../models/Test.js";
import FreeCustomTest from "../models/FreeCustomTest.js";

const APPLY = process.argv.includes("--apply");
const testIdArg = process.argv.find((a) => a.startsWith("--testId="));
const scopedTestId = testIdArg ? testIdArg.split("=")[1] : null;

const MODEL_BY_NAME = {
  Test,
  FreeCustomTest,
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run this from the server/ directory with your .env in place.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify data)" : "DRY RUN (no changes)"}`);

  const match = scopedTestId
    ? { testId: new mongoose.Types.ObjectId(scopedTestId) }
    : {};

  // Group by (testId, testModel, question, options, correctOption) — an
  // exact duplicate means every one of these fields matches.
  const groups = await Mcq.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          testId: "$testId",
          testModel: "$testModel",
          question: "$question",
          options: "$options",
          correctOption: "$correctOption",
        },
        ids: { $push: "$_id" },
        orders: { $push: "$order" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (groups.length === 0) {
    console.log("No duplicate MCQs found.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${groups.length} duplicated question(s) across ${
    new Set(groups.map((g) => String(g._id.testId))).size
  } test(s).`);

  // Bucket by test so we can fix mcqCount / compact order per test.
  const byTest = new Map(); // testId -> { testModel, idsToDelete: [] }

  for (const g of groups) {
    const testKey = String(g._id.testId);
    if (!byTest.has(testKey)) {
      byTest.set(testKey, { testModel: g._id.testModel, idsToDelete: [] });
    }
    // Pair ids with their order, keep the lowest-order copy, mark the rest for deletion.
    const pairs = g.ids.map((id, i) => ({ id, order: g.orders[i] }));
    pairs.sort((a, b) => a.order - b.order);
    const [, ...toDelete] = pairs; // keep pairs[0], delete the rest
    byTest.get(testKey).idsToDelete.push(...toDelete.map((p) => p.id));

    console.log(
      `  [test ${testKey}] "${g._id.question.slice(0, 60)}${g._id.question.length > 60 ? "…" : ""}" — ${g.count} copies, keeping order=${pairs[0].order}, deleting ${toDelete.length}`
    );
  }

  let totalDeleted = 0;

  for (const [testId, { testModel, idsToDelete }] of byTest) {
    console.log(`\nTest ${testId} (${testModel}): ${idsToDelete.length} duplicate document(s) to remove.`);

    if (APPLY) {
      const { deletedCount } = await Mcq.deleteMany({ _id: { $in: idsToDelete } });
      totalDeleted += deletedCount;

      // Re-fetch remaining MCQs in their current order and compact 0..N-1
      // so there are no gaps left where duplicates used to sit.
      const remaining = await Mcq.find({ testId, testModel })
        .sort({ order: 1 })
        .select("_id")
        .lean();

      const bulkOps = remaining.map((doc, i) => ({
        updateOne: { filter: { _id: doc._id }, update: { $set: { order: i } } },
      }));
      if (bulkOps.length > 0) {
        await Mcq.bulkWrite(bulkOps);
      }

      const TestModel = MODEL_BY_NAME[testModel];
      if (TestModel) {
        await TestModel.findByIdAndUpdate(testId, { $set: { mcqCount: remaining.length } });
      }

      console.log(`  Deleted ${deletedCount}. mcqCount corrected to ${remaining.length}. Order compacted.`);
    } else {
      totalDeleted += idsToDelete.length;
      console.log(`  (dry run — would delete ${idsToDelete.length}, then compact order + fix mcqCount)`);
    }
  }

  console.log(
    `\n${APPLY ? "Done." : "Dry run complete."} ${APPLY ? "Deleted" : "Would delete"} ${totalDeleted} duplicate document(s) total.`
  );
  if (!APPLY) {
    console.log("Re-run with --apply to actually perform these changes.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
