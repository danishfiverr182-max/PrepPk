/**
 * src/pages/user/legal/PrivacyPolicyPage.jsx
 *
 * AdSense/GDPR-friendly Privacy Policy. Content is original and written
 * specifically for PrepPK's actual features (mock tests, premium access,
 * free mock tests, blog) rather than generic boilerplate.
 */
import { Link } from "react-router-dom";
import LegalPageLayout from "./LegalPageLayout";
import { SITE_NAME, SITE_URL, CONTACT_EMAIL, COUNTRY } from "./siteInfo";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description={`Read the ${SITE_NAME} Privacy Policy to learn what information we collect, how cookies and advertising work on our site, and how we protect your data.`}
      path="/privacy-policy"
      lastUpdated="July 27, 2026"
    >
      <p>
        {SITE_NAME} ("we," "us," or "our") operates {SITE_URL} (the "Site").
        This Privacy Policy explains what information we collect when you
        visit or use the Site, how we use it, and the choices you have. By
        using {SITE_NAME}, you agree to the collection and use of
        information in accordance with this policy.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We collect information in a few different ways:</p>
      <ul>
        <li>
          <strong>Information you provide directly</strong> such as your
          name and email address when you register for an account, purchase
          premium access, contact us, or leave feedback.
        </li>
        <li>
          <strong>Test and usage data</strong> your mock test attempts,
          scores, section progress, and time spent, which we use to show
          you results and improve our question banks.
        </li>
        <li>
          <strong>Automatically collected information</strong> your IP
          address, browser type, device type, pages visited, and
          approximate location, collected through standard server logs and
          analytics tools when you use the Site.
        </li>
      </ul>

      <h2>2. Cookies and Tracking Technologies</h2>
      <p>
        Like most websites, {SITE_NAME} uses cookies and similar tracking
        technologies (such as local storage) to operate correctly and to
        improve your experience. Cookies are small text files stored on
        your device that help us:
      </p>
      <ul>
        <li>Keep you signed in and remember your preferences</li>
        <li>Understand how visitors use the Site so we can improve it</li>
        <li>Support the advertising described in Section 3 below</li>
      </ul>
      <p>
        You can control or delete cookies through your browser settings. If
        you disable cookies, some parts of the Site such as staying
        logged in or resuming a test may not work as intended.
      </p>

      <h2>3. Google AdSense and Third-Party Advertising</h2>
      <p>
        {SITE_NAME} may display advertisements served by Google AdSense and
        other third-party advertising networks. These partners may use
        cookies, web beacons, or similar technologies to serve ads based on
        your prior visits to this and other websites.
      </p>
      <ul>
        <li>
          Google's use of advertising cookies enables it and its partners
          to serve ads based on your visits to this site and/or other sites
          on the internet.
        </li>
        <li>
          You may opt out of personalized advertising by visiting{" "}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Ads Settings
          </a>
          , or by visiting{" "}
          <a href="https://www.aboutads.info" target="_blank" rel="noreferrer">
            www.aboutads.info
          </a>{" "}
          to opt out of participating third-party vendors' use of cookies.
        </li>
        <li>
          Third-party vendors, including Google, may show {SITE_NAME}'s ads
          on other sites across the internet based on visits to this Site.
        </li>
      </ul>
      <p>
        We do not control the cookies placed by advertising partners, and
        this Privacy Policy does not cover their use of your information.
        Please review the privacy policies of any third-party ad networks
        for more detail.
      </p>

      <h2>4. Google Analytics</h2>
      <p>
        We may use Google Analytics to understand how visitors interact
        with the Site for example, which pages are most popular and how
        long visitors stay. Google Analytics collects information
        anonymously and reports website trends without identifying
        individual visitors. You can learn more about how Google collects
        and processes data at{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noreferrer"
        >
          Google's Privacy & Terms page
        </a>
        , and you can opt out using the{" "}
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          target="_blank"
          rel="noreferrer"
        >
          Google Analytics Opt-out Browser Add-on
        </a>
        .
      </p>

      <h2>5. Data Protection and Security</h2>
      <p>
        We take reasonable technical and organizational measures such as
        encrypted connections (HTTPS), hashed passwords, and access
        controls on our databases to protect your information from
        unauthorized access, alteration, disclosure, or destruction.
        However, no method of transmission over the internet or electronic
        storage is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        Depending on your location, you may have rights regarding your
        personal data, including the right to:
      </p>
      <ul>
        <li>Request access to the personal data we hold about you</li>
        <li>Request correction of inaccurate or incomplete data</li>
        <li>Request deletion of your account and associated data</li>
        <li>Withdraw consent to non-essential cookies at any time</li>
        <li>Object to or restrict certain uses of your data</li>
      </ul>
      <p>
        To exercise any of these rights, contact us using the details in
        Section 10 below. We will respond within a reasonable timeframe.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        {SITE_NAME} is intended for students preparing for competitive
        entrance exams and is not directed at children under 13. We do not
        knowingly collect personal information from children under 13. If
        you believe a child has provided us with personal information,
        please contact us so we can remove it.
      </p>

      <h2>8. Third-Party Links</h2>
      <p>
        Our Site may contain links to external websites that are not
        operated by us, including payment providers and social media
        platforms. We have no control over and assume no responsibility
        for the content, privacy policies, or practices of any third-party
        sites. We encourage you to review the privacy policy of every site
        you visit.
      </p>

      <h2>9. Policy Updates</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect
        changes in our practices or for legal, operational, or regulatory
        reasons. Any changes will be posted on this page with an updated
        "Last updated" date. We encourage you to review this page
        periodically.
      </p>

      <h2>10. Contact Information</h2>
      <p>
        If you have any questions about this Privacy Policy or how your
        data is handled, please contact us:
      </p>
      <ul>
        <li>Website: {SITE_NAME}</li>
        <li>
          Email:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>Country: {COUNTRY}</li>
        <li>
          Or visit our{" "}
          <Link to="/contact-us">Contact Us page</Link>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
