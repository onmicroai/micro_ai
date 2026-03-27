import { create } from "zustand";
import { Answers, Base64Images } from "@/app/(authenticated)/app/types";

export interface StopRuntimeState {
  runId?: string;
  resultVisible: boolean;
  requiredScoreFailed: boolean;
}

export interface FixedResponseRuntimeState {
  fullText: string;
  displayedText: string;
  isAnimating: boolean;
}

export interface TrySnapshot {
  id: string;
  index: number;
  parentTryId: string | null;
  createdAt: number;
  answers: Answers;
  images: Base64Images;
  cursor: number;
  editedFieldIds: string[];
  firstEditedOriginalIndex: number | null;
  hasPostEditInteraction: boolean;
  fixedResponseStateById: Record<string, FixedResponseRuntimeState>;
  stopStateByElementId: Record<string, StopRuntimeState>;
}

export interface DraftRuntimeState {
  answers: Answers;
  images: Base64Images;
  cursor: number;
  fixedResponseStateById: Record<string, FixedResponseRuntimeState>;
  stopStateByElementId: Record<string, StopRuntimeState>;
  editingFieldName: string | null;
  editBaseAnswers: Answers | null;
  editBaseImages: Base64Images | null;
}

interface RuntimeTryStore {
  tryOrder: string[];
  triesById: Record<string, TrySnapshot>;
  activeTryId: string | null;
  draftState: DraftRuntimeState | null;

  reset: () => void;
  initRuntimeTry: (initialAnswers: Answers, initialImages: Base64Images, stableId?: string) => void;
  switchTry: (tryId: string) => void;

  applyDraftAnswers: (updater: (prev: Answers) => Answers) => void;
  applyDraftImages: (updater: (prev: Base64Images) => Base64Images) => void;
  applyDraftCursor: (cursor: number) => void;
  applyDraftFixedResponseState: (
    updater: (
      prev: Record<string, FixedResponseRuntimeState>,
    ) => Record<string, FixedResponseRuntimeState>
  ) => void;
  applyDraftStopState: (
    updater: (
      prev: Record<string, StopRuntimeState>,
    ) => Record<string, StopRuntimeState>
  ) => void;
  setEditingFieldName: (fieldName: string | null) => void;
  beginFieldEdit: (fieldName: string) => void;
  cancelDraftEdits: () => void;

  commitDraftToTry: (overrides?: Partial<TrySnapshot>) => void;
  forkTryFromDraft: (overrides?: Partial<TrySnapshot>) => void;
}

const cloneAnswers = (answers: Answers): Answers => structuredClone(answers || {});
const cloneImages = (images: Base64Images): Base64Images =>
  structuredClone(images || {});

const makeDraftFromTry = (source: TrySnapshot): DraftRuntimeState => ({
  answers: cloneAnswers(source.answers),
  images: cloneImages(source.images),
  cursor: source.cursor,
  fixedResponseStateById: structuredClone(source.fixedResponseStateById || {}),
  stopStateByElementId: structuredClone(source.stopStateByElementId || {}),
  editingFieldName: null,
  editBaseAnswers: null,
  editBaseImages: null,
});

export const useRuntimeTryStore = create<RuntimeTryStore>((set, get) => ({
  tryOrder: [],
  triesById: {},
  activeTryId: null,
  draftState: null,

  reset: () =>
    set({
      tryOrder: [],
      triesById: {},
      activeTryId: null,
      draftState: null,
    }),

  initRuntimeTry: (initialAnswers, initialImages, stableId?) => {
    const current = get();
    if (current.tryOrder.length > 0) return;
    const tryId = stableId ?? crypto.randomUUID();
    const initialTry: TrySnapshot = {
      id: tryId,
      index: 1,
      parentTryId: null,
      createdAt: Date.now(),
      answers: cloneAnswers(initialAnswers),
      images: cloneImages(initialImages),
      cursor: 0,
      editedFieldIds: [],
      firstEditedOriginalIndex: null,
      hasPostEditInteraction: false,
      fixedResponseStateById: {},
      stopStateByElementId: {},
    };

    set({
      tryOrder: [tryId],
      triesById: { [tryId]: initialTry },
      activeTryId: tryId,
      draftState: makeDraftFromTry(initialTry),
    });
  },

  switchTry: (tryId) => {
    const state = get();
    const target = state.triesById[tryId];
    if (!target) return;
    set({
      activeTryId: tryId,
      draftState: makeDraftFromTry(target),
    });
  },

  applyDraftAnswers: (updater) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: {
          ...state.draftState,
          answers: updater(cloneAnswers(state.draftState.answers)),
        },
      };
    }),

  applyDraftImages: (updater) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: {
          ...state.draftState,
          images: updater(cloneImages(state.draftState.images)),
        },
      };
    }),

  applyDraftCursor: (cursor) =>
    set((state) => {
      if (!state.draftState) return state;
      return { draftState: { ...state.draftState, cursor } };
    }),

  applyDraftFixedResponseState: (updater) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: {
          ...state.draftState,
          fixedResponseStateById: updater(
            structuredClone(state.draftState.fixedResponseStateById || {}),
          ),
        },
      };
    }),

  applyDraftStopState: (updater) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: {
          ...state.draftState,
          stopStateByElementId: updater(
            structuredClone(state.draftState.stopStateByElementId || {}),
          ),
        },
      };
    }),

  setEditingFieldName: (fieldName) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: { ...state.draftState, editingFieldName: fieldName },
      };
    }),

  beginFieldEdit: (fieldName) =>
    set((state) => {
      if (!state.draftState) return state;
      return {
        draftState: {
          ...state.draftState,
          editingFieldName: fieldName,
          editBaseAnswers: cloneAnswers(state.draftState.answers),
          editBaseImages: cloneImages(state.draftState.images),
        },
      };
    }),

  cancelDraftEdits: () =>
    set((state) => {
      if (!state.draftState) return state;
      if (!state.draftState.editBaseAnswers || !state.draftState.editBaseImages) {
        return {
          draftState: {
            ...state.draftState,
            editingFieldName: null,
            editBaseAnswers: null,
            editBaseImages: null,
          },
        };
      }
      return {
        draftState: {
          ...state.draftState,
          answers: cloneAnswers(state.draftState.editBaseAnswers),
          images: cloneImages(state.draftState.editBaseImages),
          editingFieldName: null,
          editBaseAnswers: null,
          editBaseImages: null,
        },
      };
    }),

  commitDraftToTry: (overrides) =>
    set((state) => {
      if (!state.activeTryId || !state.draftState) return state;
      const target = state.triesById[state.activeTryId];
      if (!target) return state;
      const {
        fixedResponseStateById: _ignoredFixedState,
        stopStateByElementId: _ignoredStopState,
        ...safeOverrides
      } = overrides || {};

      // Why: these two maps represent the rendered stop timeline for a try.
      // They must come from draft only; allowing override payloads here can reintroduce
      // stale cross-try visuals during rapid edit/fork/switch flows.
      const updated: TrySnapshot = {
        ...target,
        answers: cloneAnswers(state.draftState.answers),
        images: cloneImages(state.draftState.images),
        cursor: state.draftState.cursor,
        fixedResponseStateById: structuredClone(
          state.draftState.fixedResponseStateById || {},
        ),
        stopStateByElementId: structuredClone(
          state.draftState.stopStateByElementId || {},
        ),
        ...safeOverrides,
      };
      return {
        triesById: {
          ...state.triesById,
          [state.activeTryId]: updated,
        },
        draftState: makeDraftFromTry(updated),
      };
    }),

  forkTryFromDraft: (overrides) =>
    set((state) => {
      if (!state.activeTryId || !state.draftState) return state;
      const parent = state.triesById[state.activeTryId];
      if (!parent) return state;
      const {
        fixedResponseStateById: _ignoredFixedState,
        stopStateByElementId: _ignoredStopState,
        ...safeOverrides
      } = overrides || {};
      const newTryId = crypto.randomUUID();
      const nextIndex = state.tryOrder.length + 1;
      // Why: a new fork must inherit the exact draft stop/fixed maps to preserve
      // what the user just saw before branching, independent from parent snapshots.
      const forked: TrySnapshot = {
        id: newTryId,
        index: nextIndex,
        parentTryId: state.activeTryId,
        createdAt: Date.now(),
        answers: cloneAnswers(state.draftState.answers),
        images: cloneImages(state.draftState.images),
        cursor: state.draftState.cursor,
        editedFieldIds: [...(parent.editedFieldIds || [])],
        firstEditedOriginalIndex: parent.firstEditedOriginalIndex,
        hasPostEditInteraction: false,
        fixedResponseStateById: structuredClone(
          state.draftState.fixedResponseStateById || {},
        ),
        stopStateByElementId: structuredClone(
          state.draftState.stopStateByElementId || {},
        ),
        ...safeOverrides,
      };
      return {
        tryOrder: [...state.tryOrder, newTryId],
        triesById: {
          ...state.triesById,
          [newTryId]: forked,
        },
        activeTryId: newTryId,
        draftState: makeDraftFromTry(forked),
      };
    }),
}));

