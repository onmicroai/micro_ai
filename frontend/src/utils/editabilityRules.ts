/** Add new values here (e.g. "any" for editable above last successful score) and handle them in isFieldEditable. */
type EditabilityMode = "below_last_successful_score";

export type EditabilityContext = {
  fieldOriginalIndex: number;
  lastSuccessfulScoreBoundary: number;
  mode?: EditabilityMode;
};

export function isFieldEditable({
  fieldOriginalIndex,
  lastSuccessfulScoreBoundary,
  mode = "below_last_successful_score",
}: EditabilityContext): boolean {
  if (mode === "below_last_successful_score") {
    return fieldOriginalIndex > lastSuccessfulScoreBoundary;
  }
  return false;
}

