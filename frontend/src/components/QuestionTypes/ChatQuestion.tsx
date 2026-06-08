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
import { ArrowDown, Bot, Loader2, Send, User, Volume2 } from "lucide-react";
import { TEST_IDS } from "@/constants/testIds";
import { transcribeAudio } from "@/utils/audioTranscriptionService";
import { synthesizeSpeech, playAudio } from "@/utils/textToSpeechService";
import { useConversationStore } from "@/store/conversationStore";
import { useSurveyStore } from "@/store/runtimeSurveyStore";
import { useRuntimePreview } from "@/context/RuntimePreviewContext";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import CodeBlock from "@/components/MessageCodeBlock";
import TableWrapper from "@/components/MessageTableWrapper";
import { cn } from "@/utils/cn";

function getChatHeightBounds() {
  if (typeof window === "undefined") {
    return { min: 400, max: 600 };
  }
  return {
    min: Math.min(400, window.innerHeight * 0.5),
    max: Math.min(600, window.innerHeight * 0.8),
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

function TtsStatusStrip({ status }: { status: "synthesizing" | "playing" }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 border-t border-primary/10 pt-2 text-xs text-gray-500">
      {status === "synthesizing" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="italic">Preparing audio…</span>
        </>
      ) : (
        <>
          <Volume2 className="h-3 w-3 animate-pulse text-primary" />
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
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Bot className="h-4 w-4 text-primary" />
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
  const dotClass = variant === "assistant" ? "bg-gray-400" : "bg-white";

  return (
    <span className="inline-flex h-5 items-center gap-1">
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recorder = useAudioRecorder();
  const store = useConversationStore();
  const hasInteractedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const isTtsBusyRef = useRef(false);
  const processingRecordingRef = useRef(false);

  // Load chat history from answers when component mounts
  useEffect(() => {
    const chatHistory = answers[element.name]?.value || [];
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const formattedMessages = chatHistory.map((message: string) => {
        const [sender, ...rest] = message.split(": ");
        const fullText = rest.join(": "); // Rejoin in case the message contains colons
        const [text, run_id] = fullText.split("|");
        return {
          message: text,
          sender: sender as "user" | "ai",
          direction: (sender === "ai" ? "incoming" : "outgoing") as
            | "incoming"
            | "outgoing",
          run_id: run_id || undefined,
        };
      });
      setMessages(formattedMessages);
    } else {
      // When answers are cleared (e.g. app restart), reset to the initial greeting
      setMessages([
        {
          message: element.initialMessage || "Hello! How can I help you today?",
          sender: "ai",
          direction: "incoming",
        },
      ]);
    }
  }, [answers, element.name, element.initialMessage]);

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
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      container.scrollTop = container.scrollHeight;
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

    if (streamingMessage) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      // For regular messages, use smooth scrolling
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
    const desired = messagesEl.scrollHeight + inputEl.offsetHeight;
    setChatHeight(Math.min(max, Math.max(min, desired)));
  }, []);

  useLayoutEffect(() => {
    measureChatHeight();
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
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
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
    if (!message.trim() || userMessageCount >= MESSAGE_LIMIT || isTtsBusy) {
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

        const chatHistory = [...messages, userMessage, aiMessage].map((msg) => {
          if (msg.sender === "ai") {
            return `${msg.sender}: ${msg.message}|${msg.run_id || ""}`;
          }
          return `${msg.sender}: ${msg.message}`;
        });
        setInputValue(element.name, chatHistory, "", "chat");
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
  const inputDisabled = disabled || isAtLimit || isTtsBusy;

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
  const questionText = element.text || element.label || element.name;

  return (
    <div className={`${isVisible ? "" : "hidden"}`}>
      {questionText && (
        <label className="block text-sm/6 font-medium text-gray-900">
          {questionText}
          {element.isRequired && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {element.description && (
        <p className="mt-1 text-sm/6 text-gray-600">{element.description}</p>
      )}

      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}

      <div
        className={cn(
          "relative mt-2 overflow-hidden rounded-lg border shadow-sm ring-1 ring-black/[0.04] transition-[height] duration-200 ease-out",
          hasError ? "border-red-300 ring-red-100" : "border-gray-200",
        )}
        style={{ height: chatHeight }}
      >
        <div className="flex h-full flex-col">
          {/* Messages Container */}
          <div className="relative min-h-0 flex-1">
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
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                      message.direction === "outgoing"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-primary/10 text-gray-900",
                    )}
                  >
                    {message.direction === "outgoing" ? (
                      <div className="whitespace-pre-wrap break-words">
                        {message.message}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
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
                      <TtsStatusStrip status={message.ttsStatus} />
                    )}
                  </div>
                  {message.sender === "user" && <UserAvatar />}
                </div>
              ))}
              {isAssistantTyping && (
                <div className="flex items-start justify-start gap-2">
                  <AssistantAvatar avatarUrl={element.avatarUrl} />
                  <div className="rounded-2xl rounded-tl-sm bg-primary/10 px-4 py-2.5 shadow-sm">
                    {streamingMessage ? (
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed">
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
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 shadow-sm">
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
                className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
              >
                <ArrowDown className="h-3 w-3" />
                New messages
              </button>
            )}
          </div>

          {/* Input Area */}
          <div
            ref={inputAreaRef}
            className={cn(
              "flex-shrink-0 border-t border-gray-100 bg-white p-4",
              isAtLimit && "opacity-60",
            )}
          >
            {isAtLimit && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You&apos;ve used all {MESSAGE_LIMIT} messages in this chat.
              </div>
            )}

            <div
              className={cn(
                "flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
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
                  placeholder={
                    element.enableTts
                      ? "Type or speak your message…"
                      : "Type your message…"
                  }
                  disabled={inputDisabled}
                  rows={1}
                  className={cn(
                    "max-h-32 min-h-[24px] flex-1 resize-none overflow-y-auto bg-transparent pl-3 text-left text-sm leading-relaxed text-gray-800 outline-none",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    "placeholder:text-left placeholder:text-gray-400",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                />
              )}

              {element.enableTts && !isAtLimit && (
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
                      "flex-shrink-0",
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
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-200"
                >
                  <Send className="h-4 w-4 text-primary-foreground disabled:text-gray-400" />
                </button>
              )}
            </div>

            {!isAtLimit && (
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
