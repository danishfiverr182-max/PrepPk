/**
 * src/pages/user/legal/siteInfo.js
 *
 * Single source of truth for the identity fields (name, URL, contact
 * email, country) that appear across all the legal/info pages. Update
 * this file once instead of hunting through five different pages.
 */
export const SITE_NAME = "PrepPK";
export const SITE_URL =
  import.meta.env.VITE_PUBLIC_URL || "https://www.prepkp.com";
export const CONTACT_EMAIL = "support@prepkp.com";
export const COUNTRY = "Pakistan";
