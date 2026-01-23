import type { AppJsonV2, Element, ElementInstruction, Prompt } from '@/app/(authenticated)/app/types';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const getPromptText = (p: any): string => {
  // runtime Prompt shape: { text }
  if (isNonEmptyString(p?.text)) return p.text;
  // builder Element prompt shape: { text }
  if (isNonEmptyString(p?.aiPromptProperty)) return p.aiPromptProperty;
  return '';
};

const isLegacyPromptType = (t: any): t is 'prompt' | 'aiInstructions' | 'fixedResponse' =>
  t === 'prompt' || t === 'aiInstructions' || t === 'fixedResponse';

/**
 * Migrates legacy phase-based app_json to V2 elements[] app_json.
 * - Preserves order: phase title/description → fields → response cards.
 * - Combines prompt + aiInstructions into one aiResponse card (instructions[]).
 * - Combines fixedResponse prompts into one fixedResponse card (text).
 * - Converts scoredPhase → scoring card.
 */
export function migratePhasesToElements(appJson: any): AppJsonV2 {
  const phases = asArray<any>(appJson?.phases);
  const elements: Element[] = [];

  let titleCount = 0;
  let aiResponseCount = 0;
  let fixedResponseCount = 0;
  let scoringCount = 0;

  phases.forEach((phase: any, phaseIdx: number) => {
    const phaseId = phase?.id ?? String(phaseIdx + 1);

    // Phase title → static title element
    if (isNonEmptyString(phase?.title)) {
      titleCount += 1;
      elements.push({
        id: `title-${phaseId}`,
        type: 'title',
        name: `title${titleCount}`,
        label: phase.title,
        isRequired: false,
        text: phase.title,
      });
    }

    // Phase description → static title element (or richText later)
    if (isNonEmptyString(phase?.description)) {
      titleCount += 1;
      elements.push({
        id: `title-${phaseId}-description`,
        type: 'title',
        name: `title${titleCount}`,
        label: phase.description,
        isRequired: false,
        text: phase.description,
      });
    }

    // Fields can be stored as phase.elements (builder) or phase.fields (debugger / older)
    const phaseFields = asArray<Element>(phase?.elements).length
      ? asArray<Element>(phase?.elements)
      : asArray<Element>(phase?.fields);

    phaseFields.forEach((f: any) => {
      // pass through as-is; runtime/editor will validate types
      elements.push(f as Element);
    });

    const phasePrompts = asArray<any>(phase?.prompts);
    const promptPieces = phasePrompts.filter((p: any) => isLegacyPromptType(p?.type) && p.type !== 'fixedResponse');
    const fixedPieces = phasePrompts.filter((p: any) => p?.type === 'fixedResponse');

    // prompt + aiInstructions → aiResponse.instructions[]
    const instructions: ElementInstruction[] = promptPieces
      .map((p: Prompt | any) => ({
        text: getPromptText(p),
        conditionalLogic: p?.conditionalLogic,
      }))
      .filter(i => isNonEmptyString(i.text));

    if (instructions.length > 0) {
      aiResponseCount += 1;
      elements.push({
        id: `aiResponse-${phaseId}-${aiResponseCount}`,
        type: 'aiResponse',
        name: `aiResponse${aiResponseCount}`,
        label: '',
        isRequired: false,
        instructions,
      });
    }

    // fixedResponse prompts → one fixedResponse element (no API)
    const fixedText = fixedPieces
      .map((p: any) => getPromptText(p))
      .filter(isNonEmptyString)
      .join('\n');

    if (isNonEmptyString(fixedText)) {
      fixedResponseCount += 1;
      elements.push({
        id: `fixedResponse-${phaseId}-${fixedResponseCount}`,
        type: 'fixedResponse',
        name: `fixedResponse${fixedResponseCount}`,
        label: '',
        isRequired: false,
        text: fixedText,
      });
    }

    // scoredPhase → scoring card
    if (phase?.scoredPhase) {
      scoringCount += 1;
      elements.push({
        id: `scoring-${phaseId}-${scoringCount}`,
        type: 'scoring',
        name: `scoring${scoringCount}`,
        label: '',
        isRequired: phase?.skipPhase ? false : true,
        rubric: isNonEmptyString(phase?.rubric) ? phase.rubric : '',
        minScore: typeof phase?.minScore === 'number' ? phase.minScore : 0,
      });
    }
  });

  return {
    title: appJson?.title,
    description: appJson?.description,
    privacySettings: appJson?.privacySettings,
    clonable: appJson?.clonable,
    completedHtml: appJson?.completedHtml,
    attachedFiles: asArray(appJson?.attachedFiles),
    aiConfig: appJson?.aiConfig,
    elements,
  };
}

/**
 * Normalizes any app_json (legacy or v2) into a v2 shape with elements[].
 */
export function normalizeAppJsonToV2(appJson: any): AppJsonV2 {
  if (Array.isArray(appJson?.elements)) {
    return {
      title: appJson?.title,
      description: appJson?.description,
      privacySettings: appJson?.privacySettings,
      clonable: appJson?.clonable,
      completedHtml: appJson?.completedHtml,
      attachedFiles: asArray(appJson?.attachedFiles),
      aiConfig: appJson?.aiConfig,
      elements: appJson.elements as Element[],
    };
  }

  if (Array.isArray(appJson?.phases)) {
    return migratePhasesToElements(appJson);
  }

  return {
    title: appJson?.title,
    description: appJson?.description,
    privacySettings: appJson?.privacySettings,
    clonable: appJson?.clonable,
    completedHtml: appJson?.completedHtml,
    attachedFiles: asArray(appJson?.attachedFiles),
    aiConfig: appJson?.aiConfig,
    elements: [],
  };
}

