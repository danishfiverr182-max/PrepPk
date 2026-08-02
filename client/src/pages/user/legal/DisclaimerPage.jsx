/**
 * src/pages/user/legal/DisclaimerPage.jsx
 */
import { Link } from "react-router-dom";
import LegalPageLayout from "./LegalPageLayout";
import { SITE_NAME, CONTACT_EMAIL, COUNTRY } from "./siteInfo";

export default function DisclaimerPage() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      description={`Important disclaimers regarding the mock tests, information, and advertising found on ${SITE_NAME}.`}
      path="/disclaimer"
      lastUpdated="July 27, 2026"
    >
      <p>
        The information provided by {SITE_NAME} on this website is for
        general educational and exam-preparation purposes only. All
        information is provided in good faith; however, we make no
        representation or warranty of any kind, express or implied,
        regarding the accuracy, adequacy, validity, reliability,
        availability, or completeness of any information on the Site.
      </p>

      <h2>1. General Information Disclaimer</h2>
      <p>
        Mock tests, questions, explanations, articles, and study material on
        {" "}
        {SITE_NAME} are created for practice and self-assessment purposes.
        They are intended to help you become familiar with question
        formats and patterns commonly associated with Pakistan Armed
        Forces (Army, Navy, and Air Force) entrance tests, and are not
        official material issued by any government or military authority.
        Under no circumstance shall we be liable for any loss or damage of
        any kind incurred as a result of the use of the Site or reliance on
        any information provided.
      </p>

      <h2>2. No Professional Advice</h2>
      <p>
        The content on {SITE_NAME} does not constitute professional,
        legal, medical, career, or admissions advice. Decisions about
        applying for, preparing for, or appearing in any official
        examination should be based on official notifications and guidance
        from the relevant recruiting authority, and, where appropriate, a
        qualified advisor. We recommend always cross-checking exam dates,
        eligibility criteria, and syllabus details with official sources
        before making any decision.
      </p>

      <h2>3. External Links Disclaimer</h2>
      <p>
        The Site may contain links to other websites or content belonging
        to or originating from third parties, including official
        recruitment portals, payment processors, and social media
        platforms. Such external links are not investigated, monitored, or
        checked for accuracy or completeness by us, and we do not guarantee,
        endorse, or assume responsibility for the accuracy or reliability
        of any information offered by those third-party websites.
      </p>

      <h2>4. Affiliate Disclosure</h2>
      <p>
        From time to time, {SITE_NAME} may include affiliate links,
        meaning we may earn a small commission, at no extra cost to you,
        if you make a purchase or take an action through such a link. Any
        affiliate relationship does not influence the honesty of our
        recommendations, and we only link to products or services we
        believe may be useful to our readers.
      </p>

      <h2>5. Advertising Disclosure</h2>
      <p>
        {SITE_NAME} displays advertisements, including through Google
        AdSense and other third-party advertising networks, to help
        support the free content and free mock tests offered on this Site.
        These advertisements are served automatically and are not
        necessarily endorsed by {SITE_NAME}. For more detail on how
        advertising cookies work, please see our{" "}
        <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        Under no circumstance shall {SITE_NAME}, its founders, employees,
        or affiliates be held liable for any direct, indirect, incidental,
        or consequential loss or damage arising from your use of the Site,
        including but not limited to exam performance, application
        outcomes, or reliance on any content, advertisement, or external
        link found here. Your use of the Site is entirely at your own
        risk.
      </p>

      <h2>Contact</h2>
      <p>
        If you have any questions about this Disclaimer, please reach out
        at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or visit our{" "}
        <Link to="/contact-us">Contact Us page</Link>. {SITE_NAME} is based
        in {COUNTRY}.
      </p>
    </LegalPageLayout>
  );
}
