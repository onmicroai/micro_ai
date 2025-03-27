import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Define the structure of a message
export interface Message {
  role: 'user' | 'assistant' | 'instruction'| 'fixed_response';
  content: string;
  timestamp: number;
}

export interface Run {
    id: string;
    aiModel: string;
    cost: number;
    credits: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: number;
    updatedAt: number;
    messages: Message[];
    run_passed?: boolean;
    run_score?: string;
    no_submission?: boolean;
    satisfaction?: 1 | -1 | null;
    phaseIndex: number;
    session_id: string;
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
  };
}

// Define the store interface
interface ConversationStore {
  // State
  currentConversation: Conversation | null;
  conversations: Conversation[];
  
  // Actions
  createConversation: () => string;
  getConversation: (conversationId: string) => Conversation | null;
  addRun: (run: Run) => string;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  addMessage: (role: Message['role'], content: string) => void;
  setCurrentConversation: (conversationId: string) => void;
  updateConversationTitle: (title: string) => void;
  deleteConversation: (conversationId: string) => void;
  clearCurrentConversation: () => void;
  ensureConversation: () => string;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      currentConversation: null,
      conversations: [],

      createConversation: () => {
        const newConversation: Conversation = {
          id: crypto.randomUUID(),
          systemPrompt: '',
          runs: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          currentConversation: newConversation,
        }));

        return newConversation.id;
      },

      getConversation: (conversationId: string) => {
        return get().conversations.find((conv) => conv.id === conversationId) || null;
      },

      ensureConversation: () => {
        const currentConversation = get().currentConversation;
        if (currentConversation) {
          return currentConversation.id;
        }
        return get().createConversation();
      },

      addRun: (run: Run) => {
        const conversationId = get().ensureConversation();
        
        // Ensure all optional fields are properly initialized
        const runWithDefaults: Run = {
          ...run,
          run_passed: run.run_passed ?? true,  // Default to true if not specified
          run_score: run.run_score ?? undefined,
          no_submission: run.no_submission ?? false,
          satisfaction: run.satisfaction ?? null,
          phaseIndex: run.phaseIndex ?? 0,
          session_id: run.session_id ?? ''
        };

        set((state) => {
          const targetConversation = state.conversations.find(conv => conv.id === conversationId);
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

          const updatedRuns = state.currentConversation.runs.map((run) =>
            run.id === runId ? { ...run, ...updates } : run
          );

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

      addMessage: (role, content) => {
        
        set((state) => {
          if (!state.currentConversation) return state;
          
          const currentRun = state.currentConversation.runs[state.currentConversation.runs.length - 1];
          if (!currentRun) return state;

          const newMessage: Message = {
            role,
            content,
            timestamp: Date.now(),
          };

          const updatedRun = {
            ...currentRun,
            messages: [...currentRun.messages, newMessage]
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
          currentConversation: state.conversations.find((conv) => conv.id === conversationId) || null,
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
          conversations: state.conversations.filter((conv) => conv.id !== conversationId),
          currentConversation:
            state.currentConversation?.id === conversationId
              ? null
              : state.currentConversation,
        }));
      },

      clearCurrentConversation: () => {
        set({ currentConversation: null });
      },

      reset: () => set({
        currentConversation: null,
        conversations: [],
      }),
    }),
    {
      name: 'conversation-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentConversation: state.currentConversation,
        conversations: state.conversations,
      }),
    }
  )
);
