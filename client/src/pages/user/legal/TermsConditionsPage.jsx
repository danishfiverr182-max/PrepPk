/**
 * src/pages/user/legal/TermsConditionsPage.jsx
 */
import { Link } from "react-router-dom";
import LegalPageLayout from "./LegalPageLayout";
import { SITE_NAME, SITE_URL, CONTACT_EMAIL, COUNTRY } from "./siteInfo";

export default function TermsConditionsPage() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      description={`The Terms & Conditions governing your use of ${SITE_NAME}, including acceptable use, intellectual property, and limitation of liability.`}
      path="/terms-and-conditions"
      lastUpdated="July 27, 2026"
    >
      <p>
        These Terms & Conditions ("Terms") govern your access to and use of
        {" "}
        {SITE_URL} (the "Site"), operated by {SITE_NAME}. By accessing or
        using the Site, you agree to be bound by these Terms. If you do not
        agree, please do not use the Site.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account, purchasing premium access, or otherwise
        using any part of {SITE_NAME}, you confirm that you have read,
        understood, and agree to these Terms and our{" "}
        <Link to="/privacy-policy">Privacy Policy</Link>. We may update
        these Terms from time to time, and continued use of the Site after
        changes are posted constitutes acceptance of the revised Terms.
      </p>

      <h2>2. Intellectual Property Rights</h2>
      <p>
        Unless otherwise stated, all content on {SITE_NAME} including
        mock test questions, explanations, articles, graphics, logos, and
        the underlying software is the property of {SITE_NAME} or its
        licensors and is protected by applicable copyright and intellectual
        property laws. You may not copy, reproduce, distribute, republish,
        or create derivative works from any part of the Site without our
        prior written permission, except for personal, non-commercial study
        use.
      </p>

      <h2>3. User Responsibilities</h2>
      <p>When using {SITE_NAME}, you agree to:</p>
      <ul>
        <li>Provide accurate information when creating an account</li>
        <li>Keep your login credentials confidential and secure</li>
        <li>Use the mock tests and materials for personal exam preparation only</li>
        <li>Comply with all applicable local, national, and international laws</li>
      </ul>

      <h2>4. Prohibited Activities</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Share, resell, or redistribute premium test content or account
          access with others
        </li>
        <li>
          Attempt to copy, scrape, reverse-engineer, or extract our
          question bank through automated means
        </li>
        <li>
          Interfere with or disrupt the Site's servers, security, or normal
          operation, including through malicious code or excessive
          automated requests
        </li>
        <li>
          Impersonate any person or entity, or misrepresent your
          affiliation with any person or entity
        </li>
        <li>
          Use the Site for any unlawful purpose or in violation of these
          Terms
        </li>
      </ul>

      <h2>5. Content Accuracy Disclaimer</h2>
      <p>
        We make reasonable efforts to keep mock test questions, exam
        patterns, and related information accurate and up to date. However,
        exam syllabi, patterns, and eligibility criteria set by the
        Pakistani Armed Forces or other examination authorities can change
        without notice. {SITE_NAME} is a preparation and practice tool and
        does not guarantee that its content perfectly mirrors any official
        examination. Always verify current requirements with the relevant
        official source before relying on any single piece of content.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, {SITE_NAME}, its owners,
        and its team shall not be liable for any indirect, incidental,
        special, or consequential damages including loss of exam
        opportunity, loss of data, or loss of profits arising out of or
        in connection with your use of, or inability to use, the Site.
        Your use of the Site and reliance on any content is entirely at
        your own risk.
      </p>

      <h2>7. External Links</h2>
      <p>
        The Site may contain links to third-party websites, including
        payment gateways, official exam authority pages, or social media.
        We do not endorse and are not responsible for the content,
        accuracy, or practices of any linked third-party site. Accessing
        external links is done at your own discretion.
      </p>

      <h2>8. Changes to These Terms</h2>
      <p>
        We reserve the right to modify or replace these Terms at any time.
        Material changes will be reflected by updating the "Last updated"
        date at the top of this page. It is your responsibility to review
        these Terms periodically for changes.
      </p>

      <h2>9. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with
        the laws of {COUNTRY}, without regard to its conflict of law
        provisions. Any disputes arising under these Terms shall be subject
        to the exclusive jurisdiction of the courts located in {COUNTRY}.
      </p>

      <h2>10. Contact Information</h2>
      <p>
        If you have questions about these Terms & Conditions, please
        contact us:
      </p>
      <ul>
        <li>Website: {SITE_NAME}</li>
        <li>
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>Country: {COUNTRY}</li>
        <li>
          Or visit our <Link to="/contact-us">Contact Us page</Link>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
