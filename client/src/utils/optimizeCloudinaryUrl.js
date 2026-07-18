/**
 * utils/optimizeCloudinaryUrl.js
 *
 * Inserts Cloudinary delivery transformations (auto format, auto quality,
 * and a max width) into an existing Cloudinary URL, without needing to
 * re-upload the source image or change anything on the backend.
 *
 * Cloudinary URLs look like:
 *   https://res.cloudinary.com/<cloud>/image/upload/v169.../category-covers/foo.jpg
 * Inserting transformation params right after "/upload/" applies them
 * on-the-fly at delivery time:
 *   https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_400/v169.../category-covers/foo.jpg
 *
 * f_auto  -> serves WebP/AVIF to browsers that support it, falls back
 *            to the original format otherwise.
 * q_auto  -> Cloudinary picks the lowest quality that looks visually
 *            identical, usually a large size reduction with no visible loss.
 * w_<n>   -> caps the delivered width so a 4000px phone photo isn't sent
 *            to render a 160px-tall card.
 *
 * Non-Cloudinary URLs (e.g. a fallback/local image) are returned unchanged.
 * SVG URLs are also returned unchanged — they're vector graphics, so
 * raster quality/format transforms don't apply, and some Cloudinary
 * account security settings restrict on-the-fly SVG transformations.
 */

export function optimizeCloudinaryUrl(url, { width } = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url; // not a Cloudinary URL   nothing to do
  }

  const pathOnly = url.split("?")[0];
  if (/\.svg$/i.test(pathOnly)) {
    return url; // vector image   deliver exactly as uploaded
  }

  const transforms = ["f_auto", "q_auto"];
  if (width) transforms.push(`w_${width}`);

  return url.replace("/upload/", `/upload/${transforms.join(",")}/`);
}