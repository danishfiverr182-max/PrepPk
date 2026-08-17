import { useLayoutEffect, useRef, useState } from "react";

// Below this scale, text starts becoming genuinely hard to read — better to
// stop shrinking and let that one oversized question scroll instead.
const MIN_SCALE = 0.72;

/**
 * Shrinks the box in `contentRef` (via CSS transform: scale) just enough
 * that it fits inside the available height of `containerRef`, instead of
 * needing an internal scrollbar. Recalculates whenever anything in `deps`
 * changes (e.g. moving to a new question) and on window resize.
 *
 * `content.scrollHeight` reflects the content's natural, un-scaled layout
 * height even while a transform is already applied (CSS transforms are
 * paint-time only and don't affect layout), so this is safe to re-run on
 * every question without first resetting scale back to 1.
 *
 * For the rare case where content is still too tall even at MIN_SCALE (an
 * unusually long question with several long options), `needsScrollFallback`
 * comes back true — the caller should let that one case scroll rather than
 * shrinking text into illegibility or clipping it.
 */
export default function useFitToContainer(deps = []) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [needsScrollFallback, setNeedsScrollFallback] = useState(false);

  useLayoutEffect(() => {
    function recalc() {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;

      const availableHeight = container.clientHeight;
      const neededHeight = content.scrollHeight;
      if (!availableHeight || !neededHeight) return;

      const ratio = availableHeight / neededHeight;

      if (ratio >= 1) {
        setScale(1);
        setNeedsScrollFallback(false);
      } else if (ratio >= MIN_SCALE) {
        setScale(ratio);
        setNeedsScrollFallback(false);
      } else {
        setScale(MIN_SCALE);
        setNeedsScrollFallback(true);
      }
    }

    recalc();
    // Re-measure a beat later too — images and web fonts can still be
    // settling on the very first paint, which would otherwise leave us
    // measuring a too-short (or too-tall) scrollHeight.
    const raf = requestAnimationFrame(recalc);
    const timeout = setTimeout(recalc, 200);
    window.addEventListener("resize", recalc);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      window.removeEventListener("resize", recalc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, contentRef, scale, needsScrollFallback };
}
