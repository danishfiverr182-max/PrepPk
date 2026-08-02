/**
 * utils/noCopyProps.js
 *
 * Spread onto the container wrapping an MCQ's question + options during
 * test-taking and review, so a user can't select the question text, copy
 * it, and paste it into a search engine to find the answer.
 *
 * Two layers, because either one alone is bypassable:
 *   - CSS `user-select: none` (via the "mcq-no-copy" class in
 *     globals.css) stops click-drag selection and touch long-press
 *     selection in the first place.
 *   - onCopy/onCut/onContextMenu/onDragStart here block the copy action
 *     itself (e.g. Ctrl+C still fires a "copy" event even when nothing
 *     is visibly selected in some browsers) and block right-click →
 *     "Copy" / drag-to-another-tab as an escape hatch around the CSS.
 *
 * This is a deterrent, not a hard guarantee — a determined user can
 * always read the DOM directly via devtools. It stops the casual
 * "select → search in a new tab" path, which is the actual ask.
 *
 * Usage:
 *   <div className={`mcq-no-copy ${otherClasses}`} {...noCopyProps}>
 *     ...question + options...
 *   </div>
 */

function block(e) {
  e.preventDefault();
  return false;
}

export const noCopyProps = {
  onCopy: block,
  onCut: block,
  onContextMenu: block,
  onDragStart: block,
};
