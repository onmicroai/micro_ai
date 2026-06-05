import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Define the structure of a message
export interface Message {
  role: "user" | "assistant" | "instruction" | "fixed_response";
  content: string;
  timestamp: number;
}

export type ApiMessage = {
  role: string;
  content: unknown;
};

export interface Run {
  id: string;
  aiModel: string;
  cost: number;
  credits: number;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  /** Exact messages sent to the LLM (server authoritative when present). */
  apiMessages?: ApiMessage[];
  run_passed?: boolean;
  run_score?: string;
  no_submission?: boolean;
  satisfaction?: 1 | -1 | null;
  phaseIndex: number;
  tryId?: string;
  tryIndex?: number;
  session_id: string;
  score_expected?: boolean;
  score_explanation?: boolean;
  score_explanation_mode?: "always" | "failed_only" | "passed_only" | "never";
  score_feedback_enabled?: boolean;
  score_feedback_instructions?: string;
  scoreData?: {
    run_score: string;
    run_passed?: boolean;
    minimum_score: number;
    rubric: string;
    scored_run: boolean;
    partial?: boolean;
    score_explanation?: boolean;
    score_explanation_mode?: "always" | "failed_only" | "passed_only" | "never";
    score_feedback_enabled?: boolean;
    score_feedback_instructions?: string;
  };
}

// Define the conversation structure
export interface Conversation {
  id: string;
  systemPrompt: string;
  runs: Run[];
  metadata?: {
    title?: string;
    createdAt: number;
    updatedAt: number;
    appId?: string;
    userId?: string;
  };
}

// Define the store interface
interface ConversationStore {
  // State
  currentConversation: Conversation | null;
  conversations: Conversation[];

  // Actions
  createConversation: (appId?: string, userId?: string) => string;
  getConversation: (conversationId: string) => Conversation | null;
  addRun: (run: Run) => string;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  removeRunsFromPhaseIndex: (startPhaseIndex: number) => void;
  getRunsForTry: (tryId?: string) => Run[];
  getLatestRunForStop: (phaseIndex: number, tryId?: string) => Run | null;
  addMessage: (
    role: Message["role"],
    content: string,
    runId?: string,
    tryId?: string
  ) => void;
  setCurrentConversation: (conversationId: string) => void;
  updateConversationTitle: (title: string) => void;
  deleteConversation: (conversationId: string) => void;
  clearCurrentConversation: () => void;
  ensureConversation: () => string;
  ensureConversationForApp: (appId: string, userId?: string) => string;
  resetAppConversation: (appId: string, userId?: string) => string;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      currentConversation: null,
      conversations: [],

      createConversation: (appId?: string, userId?: string) => {
        const newConversation: Conversation = {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          systemPrompt: "",
          runs: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            appId,
            userId,
          },
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          currentConversation: newConversation,
        }));

        return newConversation.id;
      },

      getConversation: (conversationId: string) => {
        return (
          get().conversations.find((conv) => conv.id === conversationId) || null
        );
      },

      ensureConversation: () => {
        const currentConversation = get().currentConversation;
        if (currentConversation) {
          return currentConversation.id;
        }
        return get().createConversation();
      },

      ensureConversationForApp: (appId: string, userId?: string) => {
        const state = get();
        const existing = state.conversations.find(
          (c) => c.metadata?.appId === appId && c.metadata?.userId === userId
        );
        if (existing) {
          set({ currentConversation: existing });
          return existing.id;
        }
        return get().createConversation(appId, userId);
      },

      resetAppConversation: (appId: string, userId?: string) => {
        set((s) => ({
          conversations: s.conversations.filter(
            (c) =>
              !(c.metadata?.appId === appId && c.metadata?.userId === userId)
          ),
        }));
        return get().createConversation(appId, userId);
      },

      addRun: (run: Run) => {
        const conversationId = get().ensureConversation();

        // Ensure all optional fields are properly initialized
        const now = Date.now();
        const runWithDefaults: Run = {
          ...run,
          run_passed: run.run_passed ?? true, // Default to true if not specified
          run_score: run.run_score ?? undefined,
          no_submission: run.no_submission ?? false,
          satisfaction: run.satisfaction ?? null,
          phaseIndex: run.phaseIndex ?? 0,
          tryId: run.tryId ?? undefined,
          tryIndex: run.tryIndex ?? undefined,
          session_id: run.session_id ?? "",
          updatedAt: run.updatedAt ?? run.createdAt ?? now,
        };

        set((state) => {
          const targetConversation = state.conversations.find(
            (conv) => conv.id === conversationId
          );
          if (!targetConversation) return state;

          const updatedConversation: Conversation = {
            ...targetConversation,
            runs: [...targetConversation.runs, runWithDefaults],
            metadata: {
              ...targetConversation.metadata!,
              updatedAt: Date.now(),
            },
          };

          const updatedConversations = state.conversations.map((conv) =>
            conv.id === conversationId ? updatedConversation : conv
          );

          return {
            currentConversation: updatedConversation,
            conversations: updatedConversations,
          };
        });

        return run.id;
      },

      updateRun: (runId: string, updates: Partial<Run>) => {
        set((state) => {
          if (!state.currentConversation) return state;

          const shouldBumpTime =
            updates.run_score !== undefined ||
            updates.scoreData !== undefined ||
            updates.run_passed !== undefined;

          const updatedRuns = state.currentConversation.runs.map((run) => {
            if (run.id !== runId) return run;
            const merged = { ...run, ...updates } as Run;
            if (shouldBumpTime) {
              merged.updatedAt = Date.now();
            }
            return merged;
          });

          const updatedConversation: Conversation = {
            ...state.currentConversation,
            runs: updatedRuns,
            metadata: {
              ...state.currentConversation.metadata!,
              updatedAt: Date.now(),
            },
          };

          return {
            ...state,
            currentConversation: updatedConversation,
            conversations: state.conversations.map((conv) =>
              conv.id === updatedConversation.id ? updatedConversation : conv
            ),
          };
        });
      },

      removeRunsFromPhaseIndex: (startPhaseIndex: number) => {
        set((state) => {
          if (!state.currentConversation) return state;

          const filteredRuns = state.currentConversation.runs.filter(
            (run) => run.phaseIndex < startPhaseIndex
          );

          const updatedConversation: Conversation = {
            ...state.currentConversation,
            runs: filteredRuns,
            metadata: {
              ...state.currentConversation.metadata!,
              updatedAt: Date.now(),
            },
          };

          return {
            ...state,
            currentConversation: updatedConversation,
            conversations: state.conversations.map((conv) =>
              conv.id === updatedConversation.id ? updatedConversation : conv
            ),
          };
        });
      },

      getRunsForTry: (tryId?: string) => {
        const conversation = get().currentConversation;
        if (!conversation) return [];
        if (!tryId) return conversation.runs;
        return conversation.runs.filter((run) => run.tryId === tryId);
      },

      getLatestRunForStop: (phaseIndex: number, tryId?: string) => {
        const conversation = get().currentConversation;
        if (!conversation) return null;
        const scoped = conversation.runs
          .filter(
            (run) =>
              run.phaseIndex === phaseIndex &&
              (tryId ? run.tryId === tryId : true)
          )
          .sort((a, b) => b.createdAt - a.createdAt);
        return scoped[0] || null;
      },

      addMessage: (role, content, runId, tryId) => {
        set((state) => {
          if (!state.currentConversation) return state;

          const currentRun =
            runId || tryId
              ? state.currentConversation.runs.find(
                  (run) =>
                    (runId ? run.id === runId : true) &&
                    (tryId ? run.tryId === tryId : true)
                ) || null
              : state.currentConversation.runs[
                  state.currentConversation.runs.length - 1
                ];
          if (!currentRun) return state;

          const newMessage: Message = {
            role,
            content,
            timestamp: Date.now(),
          };

          const updatedRun = {
            ...currentRun,
            messages: [...currentRun.messages, newMessage],
          };

          const updatedConversation = {
            ...state.currentConversation,
            runs: state.currentConversation.runs.map((run) =>
              run.id === currentRun.id ? updatedRun : run
            ),
            metadata: {
              ...state.currentConversation.metadata!,
              updatedAt: Date.now(),
            },
          };

          return {
            ...state,
            currentConversation: updatedConversation,
            conversations: state.conversations.map((conv) =>
              conv.id === updatedConversation.id ? updatedConversation : conv
            ),
          };
        });
      },

      setCurrentConversation: (conversationId) => {
        set((state) => ({
          currentConversation:
            state.conversations.find((conv) => conv.id === conversationId) ||
            null,
        }));
      },

      updateConversationTitle: (title) => {
        set((state) => {
          if (!state.currentConversation) return state;

          const updatedConversation = {
            ...state.currentConversation,
            metadata: {
              ...state.currentConversation.metadata!,
              title,
              updatedAt: Date.now(),
            },
          };

          const updatedConversations = state.conversations.map((conv) =>
            conv.id === updatedConversation.id ? updatedConversation : conv
          );

          return {
            currentConversation: updatedConversation,
            conversations: updatedConversations,
          };
        });
      },

      deleteConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.filter(
            (conv) => conv.id !== conversationId
          ),
          currentConversation:
            state.currentConversation?.id === conversationId
              ? null
              : state.currentConversation,
        }));
      },

      clearCurrentConversation: () => {
        set({ currentConversation: null });
      },

      reset: () =>
        set({
          currentConversation: null,
          conversations: [],
        }),
    }),
    {
      name: "conversation-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentConversation: state.currentConversation,
        conversations: state.conversations,
      }),
    }
  )
);
