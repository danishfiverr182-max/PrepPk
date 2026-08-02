/**
 * components/admin/MarksSettingsEditor.jsx
 *
 * Reusable admin input for a section/test's total marks and optional
 * negative marking. Total marks used to be implicitly 100 (1 mark per
 * MCQ) with no way to change it — this makes it an explicit, editable
 * field, and adds a toggle + per-wrong-answer deduction for exams that
 * use negative marking.
 *
 * Each MCQ is worth (totalMarks / totalMCQs) marks at scoring time.
 *
 * Props:
 *   totalMarks      string   current total marks value (e.g. "100")
 *   negMarkEnabled  boolean  whether negative marking is on
 *   negMarkValue    string   marks deducted per wrong answer (e.g. "0.25")
 *   onChange        (patch) => void   patch may contain any of
 *                    { totalMarks, negMarkEnabled, negMarkValue }
 */

export default function MarksSettingsEditor({
  totalMarks,
  negMarkEnabled,
  negMarkValue,
  onChange,
}) {
  return (
    <div className="space-y-4">
      {/* ── Total marks ─────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-txt-primary mb-1.5">
          Total marks
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={totalMarks}
          onChange={(e) => onChange({ totalMarks: e.target.value })}
          placeholder="100"
          className="w-32 bg-bg border border-border hover:border-txt-muted focus:ring-2 focus:ring-accent/30 rounded-lg px-3 py-2 text-txt-primary text-sm font-semibold focus:outline-none transition-colors"
        />
        <p className="text-xs text-txt-muted mt-1">
          Defaults to 100. Each question is worth totalMarks ÷ number of questions.
        </p>
      </div>

      {/* ── Negative marking ────────────────────────────────── */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={negMarkEnabled}
            onChange={(e) => onChange({ negMarkEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border accent-accent"
          />
          <span className="text-sm font-medium text-txt-primary">Enable negative marking</span>
        </label>

        {negMarkEnabled && (
          <div className="mt-2">
            <label className="block text-xs text-txt-muted mb-1.5">
              Marks deducted per wrong answer
            </label>
            <input
              type="number"
              min="0"
              step="0.05"
              value={negMarkValue}
              onChange={(e) => onChange({ negMarkValue: e.target.value })}
              placeholder="0.25"
              className="w-32 bg-bg border border-border hover:border-txt-muted focus:ring-2 focus:ring-accent/30 rounded-lg px-3 py-2 text-txt-primary text-sm font-semibold focus:outline-none transition-colors"
            />
            <p className="text-xs text-txt-muted mt-1">
              Unanswered questions are never penalised — only attempted wrong answers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
