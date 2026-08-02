/**
 * src/pages/user/legal/ContactUsPage.jsx
 *
 * Contact Us page with a lightweight form. There is currently no backend
 * endpoint for contact-form submissions, so the form composes a
 * pre-filled email (via a `mailto:` link) to CONTACT_EMAIL when submitted
 * — no server round trip required. If a `/api/contact` endpoint is added
 * later, swap the `handleSubmit` body for a fetch() call and this page
 * won't need any other changes.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import LegalPageLayout from "./LegalPageLayout";
import { SITE_NAME, SITE_URL, CONTACT_EMAIL } from "./siteInfo";

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com/yourpage" },
  { label: "Instagram", href: "https://instagram.com/yourpage" },
  { label: "WhatsApp", href: "https://wa.me/923000000000" },
];

export default function ContactUsPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const subject = encodeURIComponent(
      form.subject || `Message from ${form.name || "PrepPK visitor"}`
    );
    const body = encodeURIComponent(
      `${form.message}\n\n ${form.name} (${form.email})`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <LegalPageLayout
      title="Contact Us"
      description={`Get in touch with the ${SITE_NAME} team for questions, feedback, corrections, or partnership inquiries.`}
      path="/contact-us"
    >
      <p>
        We'd love to hear from you. Whether you have a question about a
        mock test, spotted an error in a question, want to share feedback,
        or are interested in a business or partnership opportunity, the
        {" "}
        {SITE_NAME} team is just a message away.
      </p>

      <h2>Contact Information</h2>
      <ul>
        <li>Website: {SITE_NAME}</li>
        <li>
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          Website URL:{" "}
          <a href={SITE_URL} target="_blank" rel="noreferrer">
            {SITE_URL}
          </a>
        </li>
        <li>
          Social:{" "}
          {SOCIAL_LINKS.map((s, i) => (
            <span key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.label}
              </a>
              {i < SOCIAL_LINKS.length - 1 ? ", " : ""}
            </span>
          ))}
        </li>
      </ul>
      <p className="text-sm">
        We typically respond within <strong>24–72 hours</strong> on
        business days.
      </p>

      <h2>Send Us a Message</h2>

      {sent ? (
        <div className="not-prose rounded-xl border border-success/30 bg-success-light/40 dark:bg-success/10 px-4 py-4 text-sm text-txt-primary">
          Thanks, {form.name || "there"}! Your email client should now be
          open with your message ready to send. If nothing opened, you can
          email us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">
            {CONTACT_EMAIL}
          </a>
          .
        </div>
      ) : (
        <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-surface p-5 md:p-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-name" className="text-sm font-medium text-txt-primary">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Your full name"
              className="rounded-lg border border-slate-300 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-email" className="text-sm font-medium text-txt-primary">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="rounded-lg border border-slate-300 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="contact-subject" className="text-sm font-medium text-txt-primary">
              Subject
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              required
              value={form.subject}
              onChange={handleChange}
              placeholder="What's this about?"
              className="rounded-lg border border-slate-300 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="contact-message" className="text-sm font-medium text-txt-primary">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={5}
              value={form.message}
              onChange={handleChange}
              placeholder="Tell us how we can help including any test name or question number if you're reporting an error."
              className="rounded-lg border border-slate-300 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-y"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-brand hover:bg-brand-dark text-white font-semibold text-sm px-6 py-2.5 transition"
            >
              Send Message
            </button>
          </div>
        </div>
      )}

      <h2>Reporting Errors or Content Updates</h2>
      <p>
        Found a wrong answer, a typo, or an outdated detail in a mock test?
        Please use the form above (or email us directly) and include the
        test name, section, and question number if possible. This helps
        us fix it quickly. We review every report and appreciate every bit
        of feedback that helps improve {SITE_NAME} for future students.
      </p>

      <h2>Privacy Notice</h2>
      <p>
        Any information you submit through this contact form your name,
        email address, and message is used solely to respond to your
        inquiry. We do not sell or share this information with third
        parties for marketing purposes. See our{" "}
        <Link to="/privacy-policy">Privacy Policy</Link> for full details
        on how we handle data.
      </p>

      <p>
        Thank you for reaching out, we look forward to hearing from you
        and helping however we can.
      </p>
    </LegalPageLayout>
  );
}
