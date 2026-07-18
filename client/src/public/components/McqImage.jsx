/**
 * src/public/components/McqImage.jsx  (Part 8 Prompt 06)
 *
 * Renders a Non-Verbal MCQ's Cloudinary image with graceful fallback.
 *
 * - Wrapped in React.memo, keyed by a stable `src` prop, so the timer
 *   ticking every second on the parent (TestSectionPage) does not cause
 *   this <img> to remount/re-fetch.
 * - On load failure (404, network error, corrupted URL), swaps to a local
 *   placeholder SVG and shows an "Image unavailable" caption, never letting
 *   the browser's broken-image icon show.
 * - Renders nothing at all if src is empty/null/undefined, so Verbal and
 *   Academic questions (which never have an image) leave no blank gap.
 * - Supports `isNonVerbal` prop for larger image display in non-verbal tests.
 */

import { memo, useState, useEffect } from "react";
import { optimizeCloudinaryUrl } from "../../utils/optimizeCloudinaryUrl";

const PLACEHOLDER_SRC = "/assets/image-placeholder.svg";

function McqImageInner({ src, alt = "Question image", isNonVerbal = false }) {
  const [failed, setFailed] = useState(false);

  // Reset the failed state when we get a genuinely new image URL
  // (e.g. navigating to a different question), so a previous failure
  // doesn't bleed into the next question's image.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src) return null;

  // Cap delivered width to what the layout actually displays (no-ops on
  // non-Cloudinary URLs, e.g. the local placeholder). isNonVerbal renders
  // in a large ~55% viewport pane so gets a bigger cap; the compact
  // (review/custom-test) layout is capped at max-h-64 so needs far less.
  const optimizedSrc = optimizeCloudinaryUrl(src, { width: isNonVerbal ? 900 : 500 });

  return (
    <div className="text-center w-full h-full flex items-center justify-center">
      <img
        src={failed ? PLACEHOLDER_SRC : optimizedSrc}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`block rounded-xl border border-gray-200 shadow-sm transition-all duration-300 mx-auto ${
          isNonVerbal
            ? "w-full h-full object-contain"
            : "max-w-full max-h-64 object-contain"
        }`}
      />
      {failed && (
        <p className="text-xs text-gray-400 mt-2">Image unavailable</p>
      )}
    </div>
  );
}

// Only re-render when src (or alt) actually changes, not on every parent
// re-render caused by the countdown timer.
const McqImage = memo(McqImageInner, (prev, next) => prev.src === next.src && prev.alt === next.alt && prev.isNonVerbal === next.isNonVerbal);

export default McqImage;