/**
 * src/pages/user/legal/AboutUsPage.jsx
 */
import { Link } from "react-router-dom";
import LegalPageLayout from "./LegalPageLayout";
import { SITE_NAME, CONTACT_EMAIL, COUNTRY } from "./siteInfo";

export default function AboutUsPage() {
  return (
    <LegalPageLayout
      title="About Us"
      description={`Learn about ${SITE_NAME}'s mission to help students across Pakistan prepare for Army, Navy, and Air Force entrance tests with structured, reliable mock tests.`}
      path="/about-us"
    >
      <p>
        {SITE_NAME} was built with a simple goal: give students preparing
        for Pakistan's Armed Forces entrance tests a practice experience
        that actually resembles the real thing clear sections, realistic
        timing, instant scoring, and detailed review, all in one place.
      </p>

      <h2>Our Mission</h2>
      <p>
        Every year, thousands of candidates across {COUNTRY} prepare for
        Army, Navy, and Air Force initial tests, often with scattered
        photocopied notes and no reliable way to practice under real exam
        conditions. Our mission is to close that gap by offering
        structured, well-organized mock tests covering verbal, non-verbal,
        and academic sections, so candidates can walk into their actual
        test with confidence instead of guesswork.
      </p>

      <h2>What You Can Expect</h2>
      <ul>
        <li>
          <strong>Realistic mock tests</strong> modeled on the sectioned
          format used in Armed Forces initial tests, with timers and a
          question navigator so you get comfortable with real exam
          pacing.
        </li>
        <li>
          <strong>Free and premium options</strong> free mock tests to
          get started at no cost, and premium test series for candidates
          who want deeper, more extensive practice.
        </li>
        <li>
          <strong>Instant results and review</strong>, including
          section-wise scoring and a question-by-question review so you
          can learn from every attempt, not just see a final number.
        </li>
        <li>
          <strong>Regularly refreshed content</strong>, as our team
          continues to expand and refine the question bank based on
          feedback and evolving exam patterns.
        </li>
      </ul>

      <h2>Our Commitment to Quality and Accuracy</h2>
      <p>
        We take the accuracy of our test content seriously. Questions are
        reviewed for clarity and correctness before publishing, and we
        actively welcome user feedback to catch and correct errors quickly.
        That said, {SITE_NAME} is an independent, privately run preparation
        platform, we are not affiliated with, endorsed by, or an official
        representative of the Pakistan Army, Navy, Air Force, or any
        government recruiting authority. We always encourage candidates to
        confirm official exam details directly with the relevant
        recruiting body.
      </p>

      <h2>Contact and Feedback</h2>
      <p>
        {SITE_NAME} is shaped by the students who use it. If you spot an
        error, have a suggestion, or simply want to share how your
        preparation is going, we'd genuinely like to hear from you. Reach
        us anytime at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or through
        our <Link to="/contact-us">Contact Us page</Link>.
      </p>

      <p>
        Thank you for trusting {SITE_NAME} as part of your preparation
        journey, we wish you the very best in your exam.
      </p>
    </LegalPageLayout>
  );
}
