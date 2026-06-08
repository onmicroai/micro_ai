import { AnswerValue, Element } from "@/app/(authenticated)/app/types";

/**
 * Maps a stored choice value to its human-readable label for choice-based
 * elements (radio, checkbox, dropdown). Falls back to the raw value when no
 * matching choice is found.
 */
export function mapChoiceValueToText(element: Element, rawValue: string): string {
  const choices = element.choices || [];
  for (const choice of choices) {
    if (typeof choice === "string") {
      if (choice === rawValue) return choice;
    } else if (choice.value === rawValue) {
      return choice.text;
    }
  }
  return rawValue;
}

/**
 * Checks whether the answer selected the "other" option.
 */
export function isOtherValue(values: string[] | string): boolean {
  if (Array.isArray(values)) {
    return values.includes("other");
  }
  return values === "other";
}

/**
 * Resolves a single answer to its human-readable display text.
 *
 * Shared by prompt placeholder injection and the form-context builder so the
 * two can never diverge in how they render choice labels and "other" values.
 * Returns an empty string when the answer has no meaningful value.
 */
export function resolveAnswerText(
  element: Element | undefined,
  answer: AnswerValue | undefined,
): string {
  if (!answer) return "";

  const value = answer.value;
  const otherValue = answer.otherValue || "";
  const isOtherExists = isOtherValue(value);
  let valueString: string | undefined;

  if (Array.isArray(value)) {
    const notOtherValues = value.filter((val) => val !== "other");
    if (notOtherValues.length > 0) {
      const mapped = element?.choices
        ? notOtherValues.map((v) => mapChoiceValueToText(element, v))
        : notOtherValues;
      valueString = mapped.join(", ");
    }
  } else {
    const notOtherValue =
      typeof value === "string" && value !== "" && value !== "other";
    if (notOtherValue) {
      valueString = element?.choices
        ? mapChoiceValueToText(element, value)
        : value;
    }
  }

  if (valueString !== undefined && isOtherExists) {
    return `${valueString}, ${String(otherValue)}`;
  }

  if (valueString !== undefined) {
    return valueString;
  }

  if (isOtherExists) {
    return String(otherValue);
  }

  return "";
}
