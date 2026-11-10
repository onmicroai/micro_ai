"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import Image from "next/image";
import {
  Element,
  ErrorObject,
  Answers,
  setInputValue,
  ConditionalLogic,
  Prompt,
} from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { sendPromptsUtil } from "@/utils/sendPrompts";
import { LiveAudioVisualizer } from "react-audio-visualize";
import {
  AudioRecorder as VoiceRecorder,
  useAudioRecorder,
} from "react-audio-voice-recorder";
import {
  ArrowDown,
  Bot,
  Loader2,
  Send,
  Square,
  User,
  Volume2,
} from "lucide-react";
import { TEST_IDS } from "@/constants/testIds";
import { transcribeAudio } from "@/utils/audioTranscriptionService";
import {
  synthesizeSpeech,
  playAudio,
  stopAudio,
} from "@/utils/textToSpeechService";
import { useConversationStore } from "@/store/conversationStore";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useRuntimePreview } from "@/context/RuntimePreviewContext";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import CodeBlock from "@/components/MessageCodeBlock";
import TableWrapper from "@/components/MessageTableWrapper";
import { cn } from "@/utils/cn";
import {
  parseChatHistoryEntry,
  serializeChatHistoryEntry,
} from "@/utils/chatHistory";
import { checkCompletionCriteria } from "@/utils/completionCriteriaService";
import ChatCompletionCriteriaList, {
  areAllCompletionCriteriaMet,
  getActiveCompletionCriteria,
} from "@/components/ChatCompletionCriteriaList";

function getChatHeightBounds() {
  if (typeof window === "undefined") {
    return { min: 400, max: 600 };
  }
  return {
    min: Math.min(480, window.innerHeight * 0.6),
    max: Math.min(680, window.innerHeight * 0.8),
  };
}

interface ChatQuestionProps {
  element: Element;
  answers: Answers;
  setInputValue: setInputValue;
  errors: ErrorObject[];
  disabled: boolean;
  skipVisibilityCheck?: boolean;
  appId: number;
  userId: number | null;
  surveyJson: any;
  currentPhaseIndex: number;
  isOwner?: boolean;
  isAdmin?: boolean;
  activeTryId?: string;
  activeTryIndex?: number;
}

interface ChatMessage {
  message: string;
  sender: "user" | "ai";
  direction: "incoming" | "outgoing";
  wasAudioInput?: boolean;
  run_id?: string;
  ttsStatus?: "synthesizing" | "playing";
}

function TtsStatusStrip({
  status,
  onStop,
}: {
  status: "synthesizing" | "playing";
  onStop?: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5 border-t border-primary/10 pt-2 text-xs text-gray-500">
      {status === "synthesizing" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="italic">Preparing audio…</span>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onStop}
            title="Stop speaking"
            aria-label="Stop speaking"
            className="group/icon flex-shrink-0 rounded p-0.5 transition-colors hover:bg-primary/10"
          >
            <Volume2 className="h-3 w-3 animate-pulse text-primary group-hover/icon:hidden" />
            <Square className="hidden h-3 w-3 fill-primary text-primary group-hover/icon:block" />
          </button>
          <span className="italic">Speaking…</span>
        </>
      )}
    </div>
  );
}

function AssistantAvatar({ avatarUrl }: { avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full shadow-sm ring-2 ring-white">
        <Image
          src={avatarUrl}
          alt="Assistant avatar"
          width={32}
          height={32}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary">
      <Bot className="h-4 w-4 text-primary-foreground" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
      <User className="h-4 w-4 text-gray-500" />
    </div>
  );
}

function TypingDots({ variant }: { variant: "assistant" | "user" }) {
  const dotClass =
    variant === "assistant"
      ? "bg-primary/60 motion-reduce:animate-pulse"
      : "bg-white motion-reduce:animate-pulse";

  return (
    <span
      role="status"
      aria-label={
        variant === "assistant" ? "Assistant is typing" : "Transcribing your message"
      }
      className="inline-flex h-5 items-center gap-1"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]",
          dotClass,
        )}
      />
      <span
        className={cn(
          "h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]",
          dotClass,
        )}
      />
      <span
        className={cn(
          "h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]",
          dotClass,
        )}
      />
    </span>
  );
}

// Markdown styling for assistant messages. Scoped to the chat so the shared
// table/code components used elsewhere are left untouched.
const CHAT_PROSE = cn(
  "prose prose-sm max-w-none",
  "prose-a:text-primary prose-a:underline prose-headings:text-gray-900",
  "prose-p:my-2 prose-hr:my-4 prose-hr:border-gray-300",
  "prose-blockquote:rounded-lg prose-blockquote:border-0 prose-blockquote:bg-white prose-blockquote:px-3.5 prose-blockquote:py-1",
  "[&_blockquote_p::after]:content-none [&_blockquote_p::before]:content-none",
  "[&_thead]:bg-primary/10 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-gray-900 [&_td]:px-3 [&_td]:py-2",
);

// Shared bubble shapes. The typing-dots bubble, the streaming bubble and the
// final message all use the same class so the hand-off never changes width.
// Rows are top-aligned so the avatar and tail stay put while text streams in.
const AI_BUBBLE =
  "min-w-0 max-w-[80%] rounded-[18px] rounded-tl-sm bg-primary/10 px-4 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm";
const USER_BUBBLE =
  "min-w-0 max-w-[80%] rounded-[18px] rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm";

const ChatQuestion: React.FC<ChatQuestionProps> = ({
  element,
  answers,
  setInputValue,
  errors = [],
  disabled,
  skipVisibilityCheck = false,
  appId,
  userId,
  surveyJson,
  currentPhaseIndex,
  isOwner = false,
  isAdmin = false,
  activeTryId,
  activeTryIndex,
}) => {
  const defaultAiModel = useSurveyStore((s) => s.defaultAiModel);
  const isPreview = useRuntimePreview();
  const MESSAGE_LIMIT = element.maxMessages || 10;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      message: element.initialMessage || "Hello! How can I help you today?",
      sender: "ai",
      direction: "incoming",
    },
  ]);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [chatHeight, setChatHeight] = useState(() => getChatHeightBounds().min);
  const [completionStatus, setCompletionStatus] = useState<
    Record<string, boolean>
  >(() => {
    return (
      answers[element.name]?.completionStatus ||
      useConversationStore.getState().getChatCompletionStatus(element.name) ||
      {}
    );
  });
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recorder = useAudioRecorder();
  const store = useConversationStore();
  const hasInteractedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const isTtsBusyRef = useRef(false);
  const processingRecordingRef = useRef(false);
  // True while we are the ones moving the scroller, so that adjustment is not
  // treated as the user scrolling away from the stream.
  const programmaticScrollRef = useRef(false);
  const completionCheckSeqRef = useRef(0);
  const activeCriteria = getActiveCompletionCriteria(element.completionCriteria);

  // Load chat history from answers when component mounts
  useEffect(() => {
    const chatHistory = answers[element.name]?.value || [];
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      setCompletionStatus(
        answers[element.name]?.completionStatus ||
          useConversationStore
            .getState()
            .getChatCompletionStatus(element.name) ||
          {},
      );
      const formattedMessages = chatHistory.map((message: string) => {
        const { sender, message: text, run_id } = parseChatHistoryEntry(
          message,
        );
        return {
          message: text,
          sender,
          direction: (sender === "ai" ? "incoming" : "outgoing") as
            | "incoming"
            | "outgoing",
          run_id,
        };
      });
      setMessages(formattedMessages);
    } else {
      // When answers are cleared (e.g. app restart), reset to the initial greeting
      setCompletionStatus({});
      setMessages([
        {
          message: element.initialMessage || "Hello! How can I help you today?",
          sender: "ai",
          direction: "incoming",
        },
      ]);
    }
  }, [answers, element.name, element.initialMessage]);

  const persistChatAnswer = useCallback(
    (
      chatHistory: string[],
      status: Record<string, boolean> | undefined,
    ) => {
      const otherValue =
        status && Object.keys(status).length > 0
          ? JSON.stringify(status)
          : "";
      setInputValue(element.name, chatHistory, otherValue, "chat");
      if (status && Object.keys(status).length > 0) {
        useConversationStore
          .getState()
          .setChatCompletionStatus(element.name, status);
      }
    },
    [element.name, setInputValue],
  );

  // Add timeout to stop recording after 30 seconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (recorder.isRecording) {
      timeoutId = setTimeout(() => {
        recorder.stopRecording();
      }, 30000); // 30 seconds
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [recorder]);

  // Count only user messages
  const userMessageCount = messages.filter(
    (msg) => msg.sender === "user",
  ).length;

  /**
   * Check if user is near the bottom of the chat.
   * @returns boolean
   */
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 200;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    return distanceFromBottom <= threshold;
  };

  /**
   * Scroll to bottom of the chat.
   * @param smooth - Whether to scroll smoothly or instantly.
   */
  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    programmaticScrollRef.current = true;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      // Keep ignoring scroll events until the animation finishes. Clearing on
      // the next frame lets the in-flight smooth scroll look like the user
      // scrolled up, which turns follow mode off and hides the stream.
      let settled = false;
      const stopIgnoring = () => {
        if (settled) return;
        settled = true;
        programmaticScrollRef.current = false;
        container.removeEventListener("scrollend", stopIgnoring);
      };
      container.addEventListener("scrollend", stopIgnoring);
      window.setTimeout(stopIgnoring, 700);
    } else {
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  };

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
    scrollToBottom(true);
  };

  // Scroll to bottom when chat history is loaded (initial load ONLY)
  useEffect(() => {
    const chatHistory = answers[element.name]?.value || [];
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      setTimeout(() => {
        scrollToBottom(false);
        shouldAutoScrollRef.current = true;
        setShowScrollToBottom(false);
      }, 0);
    }
  }, [element.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling for streaming messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // For initial load
    if (!hasInteractedRef.current) {
      scrollToBottom(false);
      return;
    }

    if (!shouldAutoScrollRef.current) {
      setShowScrollToBottom(true);
      return;
    }

    if (streamingMessage || isAssistantTyping) {
      // Instant pin while tokens are arriving. A smooth scroll here fires
      // scroll events that look like the user left the bottom.
      programmaticScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    } else {
      scrollToBottom(true);
    }
  }, [
    messages,
    isUserTyping,
    isAssistantTyping,
    isSynthesizingAudio,
    streamingMessage,
  ]);

  const isTtsBusy =
    isSynthesizingAudio ||
    messages.some(
      (m) => m.ttsStatus === "synthesizing" || m.ttsStatus === "playing",
    );

  useEffect(() => {
    isTtsBusyRef.current = isTtsBusy;
  }, [isTtsBusy]);

  const measureChatHeight = useCallback(() => {
    const messagesEl = messagesContainerRef.current;
    const inputEl = inputAreaRef.current;
    if (!messagesEl || !inputEl) return;

    const { min, max } = getChatHeightBounds();
    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const desired =
      headerHeight + messagesEl.scrollHeight + inputEl.offsetHeight;
    setChatHeight(Math.min(max, Math.max(min, desired)));
  }, []);

  useLayoutEffect(() => {
    measureChatHeight();

    // Pin before paint. The height transition used to lag behind each token, so
    // the newest text stayed clipped until the reply finished and then appeared
    // all at once. Jumping here keeps the stream in view on the same frame.
    const container = messagesContainerRef.current;
    if (!container || !hasInteractedRef.current || !shouldAutoScrollRef.current) {
      return;
    }
    if (!streamingMessage && !isAssistantTyping) return;

    programmaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [
    measureChatHeight,
    messages,
    streamingMessage,
    isAssistantTyping,
    isUserTyping,
    isTtsBusy,
  ]);

  useLayoutEffect(() => {
    const messagesEl = messagesContainerRef.current;
    const inputEl = inputAreaRef.current;
    if (!messagesEl) return;

    const observer = new ResizeObserver(() => measureChatHeight());
    observer.observe(messagesEl);
    if (inputEl) observer.observe(inputEl);
    if (headerRef.current) observer.observe(headerRef.current);

    window.addEventListener("resize", measureChatHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureChatHeight);
    };
  }, [measureChatHeight]);

  // Use MutationObserver for smoother handling of DOM changes during streaming
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !streamingMessage) return;

    const observer = new MutationObserver(() => {
      measureChatHeight();
      if (shouldAutoScrollRef.current) {
        programmaticScrollRef.current = true;
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
      }
    });

    // Observe changes to the container's children
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [streamingMessage, measureChatHeight]);

  /**
   * Handle scroll events to detect if user is manually scrolling up
   * @returns void
   */
  const handleScroll = () => {
    if (programmaticScrollRef.current) return;

    const nearBottom = isNearBottom();

    if (shouldAutoScrollRef.current && !nearBottom) {
      shouldAutoScrollRef.current = false;
      setShowScrollToBottom(true);
    } else if (!shouldAutoScrollRef.current && nearBottom) {
      shouldAutoScrollRef.current = true;
      setShowScrollToBottom(false);
    }
  };

  /**
   * Handle the completion of a recording.
   * @param blob - The blob of the recording.
   */
  const handleRecordingComplete = async (blob: Blob) => {
    if (processingRecordingRef.current || isTtsBusyRef.current) {
      return;
    }

    processingRecordingRef.current = true;
    try {
      setIsUserTyping(true);
      const { text: transcribedText, cost: transcriptionCost } =
        await transcribeAudio(blob, userId);
      if (!transcribedText.trim() || isTtsBusyRef.current) {
        return;
      }
      await handleSend(transcribedText, true, transcriptionCost);
    } catch (error) {
      console.error("Error transcribing audio:", error);
    } finally {
      setIsUserTyping(false);
      processingRecordingRef.current = false;
    }
  };

  const handleSend = async (
    message: string,
    wasAudioInput: boolean = false,
    transcriptionCost?: number,
  ) => {
    const criteriaComplete = areAllCompletionCriteriaMet(
      activeCriteria,
      completionStatus,
    );
    if (
      !message.trim() ||
      userMessageCount >= MESSAGE_LIMIT ||
      isTtsBusy ||
      criteriaComplete
    ) {
      return;
    }

    const userMessage: ChatMessage = {
      message,
      sender: "user",
      direction: "outgoing",
      wasAudioInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage(""); // Clear input after sending
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setIsUserTyping(false);
    setIsAssistantTyping(true);

    // Mark that the user has interacted so that future updates will trigger auto-scroll.
    hasInteractedRef.current = true;

    // Update auto-scroll preference based on current position when sending
    shouldAutoScrollRef.current = isNearBottom();
    if (!shouldAutoScrollRef.current) {
      setShowScrollToBottom(true);
    }

    try {
      const prompts: Prompt[] = [];

      if (element.chatbotInstructions) {
        prompts.push({
          id: `chat-instructions-${Date.now()}`,
          name: "chat_instructions",
          type: "aiInstructions",
          text: element.chatbotInstructions,
        });
      }

      prompts.push({
        id: `chat-${Date.now()}`,
        name: "chat_message",
        type: "prompt",
        text: message,
      });

      const response = await sendPromptsUtil({
        prompts: prompts,
        answers: answers,
        appId: appId,
        appConfig: surveyJson,
        pageIndex: currentPhaseIndex,
        userId: userId,
        requestSkip: false,
        skipScoredRun: true,
        runSource: "chat",
        webSearch: Boolean(element.enableWebSearch),
        isPreview,
        transcriptionCost: transcriptionCost,
        defaultAiModel: defaultAiModel,
        set: (state: any) => {
          if (state.promptResponse) {
            setStreamingMessage(state.promptResponse);
          }
        },
        runtimeMeta: activeTryId
          ? { tryId: activeTryId, tryIndex: activeTryIndex }
          : undefined,
      });

      if (response.success && response.response) {
        const shouldSynthesizeAudio =
          wasAudioInput && (element.enableTts || false);

        const aiMessage: ChatMessage = {
          message: response.response,
          sender: "ai",
          direction: "incoming",
          run_id: response.run_uuid,
          ...(shouldSynthesizeAudio ? { ttsStatus: "synthesizing" as const } : {}),
        };

        setIsAssistantTyping(false);
        setStreamingMessage("");
        if (shouldSynthesizeAudio) {
          isTtsBusyRef.current = true;
        }
        setMessages((prev) => [...prev, aiMessage]);

        const chatHistory = [...messages, userMessage, aiMessage].map((msg) =>
          serializeChatHistoryEntry(msg),
        );
        persistChatAnswer(chatHistory, completionStatus);

        const completionCheckPromise =
          activeCriteria.length > 0 && response.run_uuid
            ? (async () => {
                const checkSeq = ++completionCheckSeqRef.current;
                setIsCheckingCompletion(true);
                try {
                  const checkResponse = await checkCompletionCriteria({
                    appId,
                    runUuid: response.run_uuid as string,
                    criteria: activeCriteria,
                    userId,
                  });
                  if (checkSeq !== completionCheckSeqRef.current) {
                    return;
                  }
                  setCompletionStatus(checkResponse.results);
                  persistChatAnswer(chatHistory, checkResponse.results);
                } catch (error) {
                  console.error("Error checking completion criteria:", error);
                } finally {
                  if (checkSeq === completionCheckSeqRef.current) {
                    setIsCheckingCompletion(false);
                  }
                }
              })()
            : null;

        const patchAiMessage = (
          runId: string | undefined,
          patch: Partial<Pick<ChatMessage, "ttsStatus">>,
        ) => {
          setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].sender === "ai" && next[i].run_id === runId) {
                next[i] = { ...next[i], ...patch };
                break;
              }
            }
            return next;
          });
        };

        let audioData: string | null = null;
        if (shouldSynthesizeAudio) {
          setIsSynthesizingAudio(true);
          try {
            audioData = await synthesizeSpeech(
              response.response,
              element.ttsProvider || "openai",
              element.selectedVoiceId || "alloy",
              element.voiceInstructions,
              userId,
            );
          } catch (error) {
            console.error("Error synthesizing speech:", error);
            patchAiMessage(response.run_uuid, { ttsStatus: undefined });
          } finally {
            setIsSynthesizingAudio(false);
          }
        }

        if (audioData) {
          patchAiMessage(response.run_uuid, { ttsStatus: "playing" });
          try {
            await playAudio(audioData);
          } catch (error) {
            console.error("Error playing audio:", error);
          }
          patchAiMessage(response.run_uuid, { ttsStatus: undefined });
        }

        if (completionCheckPromise) {
          await completionCheckPromise;
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
    } finally {
      setIsAssistantTyping(false);
      setIsSynthesizingAudio(false);
      setStreamingMessage(""); // Clear streaming message
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  const handleInputResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const getErrorMessage = (elementName: string): string | null => {
    const error = errors.find((error) => error.element === elementName);
    return error ? error.error : null;
  };

  const errorMessage = getErrorMessage(element.name);
  const hasError = !!errorMessage;
  const remainingMessages = MESSAGE_LIMIT - userMessageCount;
  const isAtLimit = userMessageCount >= MESSAGE_LIMIT;
  const isCriteriaComplete = areAllCompletionCriteriaMet(
    activeCriteria,
    completionStatus,
  );
  const inputDisabled =
    disabled || isAtLimit || isTtsBusy || isCriteriaComplete;

  const totalCredits = messages.reduce((sum, msg) => {
    if (msg.sender === "ai" && msg.run_id) {
      const run = store.currentConversation?.runs.find(
        (r) => r.id === msg.run_id,
      );
      return sum + (run?.credits || 0);
    }
    return sum;
  }, 0);
  const isVisible =
    skipVisibilityCheck ||
    evaluateVisibility(
      element.conditionalLogic || ({} as ConditionalLogic),
      answers,
    );
  // Header strip: the chat's label as the title, its description as the
  // subtitle. chatbotInstructions is the system prompt and stays hidden.
  const headerTitle = element.text || element.label;
  const showCompletionCriteria = activeCriteria.length > 0;
  const showHeader = Boolean(
    headerTitle || element.description || showCompletionCriteria,
  );
  const inputPlaceholder = isCriteriaComplete
    ? "All completion criteria are met. This chat is complete."
    : element.enableTts
      ? "Type or speak your message…"
      : "Type your message…";

  return (
    <div className={`${isVisible ? "" : "hidden"}`}>
      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}

      <div
        className={cn(
          // overflow-visible so the header completion dropdown can paint above
          // the message list; clipping stays on the scrollable messages pane.
          "relative mt-2 overflow-visible rounded-2xl border shadow-sm ring-1 ring-black/[0.04]",
          // Animating height while tokens arrive restarts a 200ms ease on every
          // chunk. The box never catches the text, so the reply stays clipped
          // and then pops in when the stream ends.
          !isAssistantTyping && "transition-[height] duration-200 ease-out",
          hasError ? "border-red-300 ring-red-100" : "border-gray-200",
        )}
        style={{ height: chatHeight }}
      >
        <div className="flex h-full flex-col rounded-2xl">
          {showHeader && (
            <div
              ref={headerRef}
              className="relative z-20 flex flex-shrink-0 items-center gap-3 rounded-t-2xl border-b border-gray-100 bg-gray-50/70 px-4 py-3"
            >
              <AssistantAvatar avatarUrl={element.avatarUrl} />
              <div className="min-w-0 flex-1">
                {headerTitle && (
                  <h3 className="truncate text-sm font-semibold leading-5 text-gray-900">
                    {headerTitle}
                    {element.isRequired && (
                      <>
                        <span aria-hidden="true" className="ml-1 text-red-500">
                          *
                        </span>
                        <span className="sr-only"> (required)</span>
                      </>
                    )}
                  </h3>
                )}
                {element.description && (
                  <p className="line-clamp-2 text-xs leading-4 text-gray-600">
                    {element.description}
                  </p>
                )}
              </div>
              {showCompletionCriteria && (
                <ChatCompletionCriteriaList
                  criteria={activeCriteria}
                  status={completionStatus}
                  isChecking={isCheckingCompletion}
                  variant="header"
                />
              )}
            </div>
          )}

          {/* Messages + input stay clipped so streaming content can't spill */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl">
          {/* Messages Container */}
          <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
            <div
              ref={messagesContainerRef}
              className="h-full space-y-4 overflow-y-auto p-4"
              onScroll={handleScroll}
              style={{
                transform: "translateZ(0)",
                willChange: "scroll-position",
                scrollBehavior: streamingMessage ? "auto" : "smooth",
              }}
            >
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2",
                    message.direction === "outgoing"
                      ? "justify-end"
                      : "justify-start",
                  )}
                >
                  {message.sender === "ai" && (
                    <AssistantAvatar avatarUrl={element.avatarUrl} />
                  )}
                  <div
                    className={
                      message.direction === "outgoing" ? USER_BUBBLE : AI_BUBBLE
                    }
                  >
                    {message.direction === "outgoing" ? (
                      <div className="whitespace-pre-wrap break-words">
                        {message.message}
                      </div>
                    ) : (
                      <div className={CHAT_PROSE}>
                        <ReactMarkdown
                          remarkPlugins={[gfm]}
                          components={{
                            code: CodeBlock,
                            table: TableWrapper,
                          }}
                        >
                          {message.message}
                        </ReactMarkdown>
                      </div>
                    )}
                    {message.sender === "ai" && message.ttsStatus && (
                      <TtsStatusStrip
                        status={message.ttsStatus}
                        onStop={
                          message.ttsStatus === "playing" ? stopAudio : undefined
                        }
                      />
                    )}
                  </div>
                  {message.sender === "user" && <UserAvatar />}
                </div>
              ))}
              {isAssistantTyping && (
                <div className="flex items-start justify-start gap-2">
                  <AssistantAvatar avatarUrl={element.avatarUrl} />
                  <div className={AI_BUBBLE}>
                    {streamingMessage ? (
                      <div className={CHAT_PROSE}>
                        <ReactMarkdown
                          remarkPlugins={[gfm]}
                          components={{
                            code: CodeBlock,
                            table: TableWrapper,
                          }}
                        >
                          {streamingMessage}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <TypingDots variant="assistant" />
                    )}
                  </div>
                </div>
              )}
              {isUserTyping && (
                <div className="flex items-start justify-end gap-2">
                  <div className={USER_BUBBLE}>
                    <TypingDots variant="user" />
                  </div>
                  <UserAvatar />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {showScrollToBottom && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-3 left-1/2 z-10 inline-flex min-h-[40px] -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary-600"
              >
                <ArrowDown className="h-4 w-4" />
                New messages
              </button>
            )}
          </div>

          {/* Input Area */}
          <div
            ref={inputAreaRef}
            className={cn(
              "flex-shrink-0 border-t border-gray-100 bg-white p-4",
              (isAtLimit || isCriteriaComplete) && "opacity-60",
            )}
          >
            {isAtLimit && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You&apos;ve used all {MESSAGE_LIMIT} messages in this chat.
              </div>
            )}

            <div
              className={cn(
                "flex items-end gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-3 py-2 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
              )}
            >
              {recorder.isRecording ? (
                <div className="min-w-0 flex-1 overflow-hidden rounded-lg p-2">
                  {recorder.mediaRecorder && (
                    <LiveAudioVisualizer
                      mediaRecorder={recorder.mediaRecorder}
                      width={600}
                      height={24}
                      barWidth={4}
                      gap={2}
                      barColor="rgb(99, 102, 241)"
                      fftSize={1024}
                      maxDecibels={-20}
                      minDecibels={-80}
                      smoothingTimeConstant={0.8}
                    />
                  )}
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onInput={handleInputResize}
                  placeholder={inputPlaceholder}
                  disabled={inputDisabled}
                  rows={1}
                  className={cn(
                    // 40px tall (py-2 + 24px line) to match the send button, so one
                    // line of text sits centered; grows upward for more lines.
                    "max-h-32 min-h-[40px] flex-1 resize-none overflow-y-auto bg-transparent py-2 pl-3 text-left text-base leading-6 text-gray-800 outline-none",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "placeholder:text-left placeholder:text-gray-400",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                />
              )}

              {element.enableTts && !isAtLimit && !isCriteriaComplete && (
                <>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    data-testid={TEST_IDS.CHAT_AUDIO_UPLOAD_INPUT}
                    disabled={isTtsBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && !isTtsBusyRef.current) {
                        handleRecordingComplete(file);
                        e.target.value = "";
                      }
                    }}
                  />
                  <div
                    className={cn(
                      "flex h-10 flex-shrink-0 items-center",
                      isTtsBusy && "pointer-events-none opacity-40",
                      recorder.isRecording &&
                        "[&_.audio-recorder-mic]:hidden [&_.audio-recorder-status]:hidden [&_.recording]:!w-auto",
                    )}
                  >
                    <VoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                      recorderControls={recorder}
                      downloadFileExtension="webm"
                      showVisualizer={false}
                      classes={{
                        AudioRecorderClass:
                          "!p-0 !bg-transparent !shadow-none hover:!bg-gray-100 !rounded-lg",
                        AudioRecorderPauseResumeClass: "!p-2",
                        AudioRecorderDiscardClass: "!p-2",
                      }}
                    />
                  </div>
                </>
              )}

              {!recorder.isRecording && (
                <button
                  type="button"
                  onClick={() => handleSend(inputMessage)}
                  disabled={!inputMessage.trim() || inputDisabled}
                  aria-label="Send message"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-200"
                >
                  <Send className="h-5 w-5 text-primary-foreground disabled:text-gray-400" />
                </button>
              )}
            </div>

            {!isAtLimit && !isCriteriaComplete && (
              <p className="mt-1.5 px-1 text-[10px] text-gray-400">
                {isTtsBusy ? (
                  <span className="italic">
                    {isSynthesizingAudio ||
                    messages.some((m) => m.ttsStatus === "synthesizing")
                      ? "Generating voice response…"
                      : "Playing voice response…"}
                  </span>
                ) : (
                  <>
                    {remainingMessages} message
                    {remainingMessages !== 1 ? "s" : ""} remaining · Enter to
                    send · Shift+Enter for new line
                  </>
                )}
              </p>
            )}
          </div>
          </div>
        </div>
      </div>

      {(isOwner || isAdmin) && (
        <div className="mt-2 flex justify-end">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Chat credits: {totalCredits}
          </span>
        </div>
      )}
    </div>
  );
};

export default ChatQuestion;
