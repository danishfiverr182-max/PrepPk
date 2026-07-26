/**
 * controllers/testGroupController.js
 *
 * Handles CRUD for TestGroup documents (custom categories only).
 *
 * createGroup     admin: create a named group within a custom category
 * getGroupsByCategory   public: list all groups for a category slug
 * deleteGroup     admin: delete a group and all its tests
 */

import TestGroup from "../models/TestGroup.js";
import Test from "../models/Test.js";
import Category from "../models/Category.js";
import FreeCustomTest from "../models/FreeCustomTest.js";
import Mcq from "../models/Mcq.js";
import { generateSlug } from "../utils/slugify.js";

// ── POST /api/test-groups ─────────────────────────────────────
// Admin only. Creates a new TestGroup within a custom category.
export async function createGroup(req, res) {
  try {
    const { name, categoryId, description } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({ message: "name and categoryId are required." });
    }

    // Verify the category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // Reject if this is a default category (Army, Navy, Air Force)
    if (category.isDefault) {
      return res
        .status(400)
        .json({ message: "Default categories do not use test groups." });
    }

    const slug = generateSlug(name);

    // Check for duplicate slug within this category
    const existing = await TestGroup.findOne({ categoryId, slug });
    if (existing) {
      return res
        .status(400)
        .json({ message: "A group with this name already exists in this category." });
    }

    const group = await TestGroup.create({
      name,
      slug,
      categoryId,
      categorySlug: category.slug,
      description: description || "",
    });

    return res.status(201).json(group);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/test-groups/:categorySlug ────────────────────────
// Public. Returns all groups for a given category slug,
// sorted by order ascending then createdAt ascending.
export async function getGroupsByCategory(req, res) {
  try {
    const { categorySlug } = req.params;

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .select("name slug description blogContent seoTitle seoDescription order categorySlug categoryId testCount freeTestCount publishedFreeTestCount createdAt updatedAt")
      .lean();

    return res.json(groups);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/test-groups/:categorySlug/:groupSlug ─────────────
// Public. Returns a single TestGroup (all fields, including SEO fields
// and blogContent) by its category slug + own slug, plus a lightweight
// summary of its published tests (both premium Test and free
// FreeCustomTest documents) so the frontend can render a chapter's own
// page — and list its tests — without a second round trip.
export async function getGroupBySlug(req, res) {
  try {
    const { categorySlug, groupSlug } = req.params;

    const group = await TestGroup.findOne({
      categorySlug,
      slug: groupSlug,
    }).lean();

    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }

    const [premiumTests, freeTests] = await Promise.all([
      Test.find({ groupId: group._id, isStandalone: true, status: "published" })
        .sort({ testNumber: 1 })
        .select("_id testNumber status")
        .lean(),
      FreeCustomTest.find({ groupId: group._id, status: "published" })
        .sort({ testNumber: 1 })
        .select("_id testNumber status")
        .lean(),
    ]);

    const tests = [
      ...premiumTests.map((t) => ({
        _id: t._id,
        testNumber: t.testNumber,
        isFree: false,
        status: t.status,
      })),
      ...freeTests.map((t) => ({
        _id: t._id,
        testNumber: t.testNumber,
        isFree: true,
        status: t.status,
      })),
    ];

    return res.json({ ...group, tests });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── DELETE /api/test-groups/:groupId ─────────────────────────
// Admin only. Deletes the TestGroup and all Test documents in it.
export async function deleteGroup(req, res) {
  try {
    const { groupId } = req.params;

    const group = await TestGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }

    // Collect every test that belongs to this group across BOTH models —
    // premium standalone Tests and free FreeCustomTests — so their MCQs
    // (stored separately in the Mcq collection) don't get left behind.
    const [premiumTests, freeTests] = await Promise.all([
      Test.find({ groupId }, "_id"),
      FreeCustomTest.find({ groupId }, "_id"),
    ]);

    const premiumTestIds = premiumTests.map((t) => t._id);
    const freeTestIds = freeTests.map((t) => t._id);

    await Promise.all([
      premiumTestIds.length > 0
        ? Mcq.deleteMany({ testId: { $in: premiumTestIds }, testModel: "Test" })
        : Promise.resolve(),
      freeTestIds.length > 0
        ? Mcq.deleteMany({ testId: { $in: freeTestIds }, testModel: "FreeCustomTest" })
        : Promise.resolve(),
    ]);

    // Delete all tests (both kinds) that belong to this group
    await Test.deleteMany({ groupId });
    await FreeCustomTest.deleteMany({ groupId });

    // Delete the group itself
    await TestGroup.findByIdAndDelete(groupId);

    return res.json({ message: "Test group and all its tests have been deleted." });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}
