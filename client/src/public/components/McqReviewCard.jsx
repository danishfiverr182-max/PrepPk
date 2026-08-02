/**
 * src/public/components/McqReviewCard.jsx  (Part 8 Prompt 07)
 *
 * Read-only review of a single MCQ. Colour states are cumulative an
 * option can be both "the correct answer" (green ring) AND "what the user
 * picked" at the same time, in which case it gets the solid green
 * background instead of just the ring.
 *
 * Props:
 *   mcq:           { _id, question, options, imageUrl, correctIndex }
 *   userAnswer:    number | undefined   (option index the user selected)
 *   questionNumber: number              (1-based, for the heading)
 */

import McqImage from "./McqImage";
import Badge from "../../components/ui/Badge";
import { noCopyProps } from "../../utils/noCopyProps";

const OPTION_LABELS = ["A", "B", "C", "D"];

function optionClasses(optionIndex, userAnswer, correctIndex) {
  const isCorrect  = optionIndex === correctIndex;
  const isSelected = optionIndex === userAnswer;

  if (isCorrect && isSelected) {
    // Correctly chosen
    return "bg-success-light border-2 border-success text-success-darker dark:bg-green-900/40 dark:border-green-500 dark:text-green-300";
  }
  if (isSelected && !isCorrect) {
    // Wrongly chosen
    return "bg-danger-light border-2 border-danger text-danger-darker dark:bg-red-900/40 dark:border-red-500 dark:text-red-300";
  }
  if (isCorrect && !isSelected) {
    // Correct answer the user missed outline only, no fill
    return "bg-surface border-2 border-success text-txt-primary dark:bg-dark-surface dark:border-green-500 dark:text-slate-200";
  }
  // Neutral, untouched option
  return "bg-surface border border-border text-txt-primary dark:bg-dark-surface dark:border-dark-border dark:text-slate-300";
}

export default function McqReviewCard({ mcq, userAnswer, questionNumber }) {
  const { question, options = [], imageUrl, correctIndex } = mcq;
  const wasAnswered = userAnswer !== undefined && userAnswer !== null;
  const wasCorrect  = wasAnswered && userAnswer === correctIndex;

  return (
    <div
      className="mcq-no-copy bg-surface rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow duration-200 p-5 mb-4 dark:bg-dark-surface dark:border-dark-border"
      {...noCopyProps}
    >
      {/* Question header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-txt-secondary dark:text-slate-400">Question {questionNumber}</p>
        {!wasAnswered ? (
          <Badge variant="muted" className="shrink-0">Not answered</Badge>
        ) : wasCorrect ? (
          <Badge variant="success" className="shrink-0">Correct</Badge>
        ) : (
          <Badge variant="danger" className="shrink-0">Incorrect</Badge>
        )}
      </div>

      <McqImage src={imageUrl} alt={`Question ${questionNumber} illustration`} />

      <p className="text-txt-primary dark:text-slate-100 font-semibold text-sm leading-relaxed mb-4">{question}</p>

      {/* Options read-only, cursor-default, non-interactive */}
      <div className="space-y-2.5">
        {options.map((opt, i) => (
          <div
            key={i}
            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left cursor-default min-h-[48px] ${optionClasses(
              i,
              userAnswer,
              correctIndex
            )}`}
          >
            <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-bg dark:bg-dark-surface2">
              {OPTION_LABELS[i]}
            </span>
            <span className="text-sm leading-relaxed">{opt}</span>
          </div>
        ))}
      </div>

      {!wasAnswered && (
        <p className="text-txt-muted dark:text-slate-400 text-sm italic mt-3">You skipped this question.</p>
      )}
    </div>
  );
}
