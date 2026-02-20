"use client";

import React, { useState, useRef, useEffect } from "react";
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
import { Send } from "lucide-react";
import { TEST_IDS } from "@/constants/testIds";
import { transcribeAudio } from "@/utils/audioTranscriptionService";
import { synthesizeSpeech, playAudio } from "@/utils/textToSpeechService";
import { useConversationStore } from "@/store/conversationStore";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import CodeBlock from "@/components/MessageCodeBlock";
import TableWrapper from "@/components/MessageTableWrapper";
import { Textarea } from "../basic/textarea";

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
}

interface ChatMessage {
  message: string;
  sender: "user" | "ai";
  direction: "incoming" | "outgoing";
  wasAudioInput?: boolean;
  run_id?: string;
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
}) => {
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
  const [isActive] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recorder = useAudioRecorder();
  const store = useConversationStore();
  const hasInteractedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);

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
    }
  }, [answers, element.name]);

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
    (msg) => msg.sender === "user"
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

  // Scroll to bottom when chat history is loaded (initial load ONLY)
  useEffect(() => {
    const chatHistory = answers[element.name]?.value || [];
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      setTimeout(() => {
        scrollToBottom(false);
        shouldAutoScrollRef.current = true;
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

    if (!shouldAutoScrollRef.current) return;

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

  // Use MutationObserver for smoother handling of DOM changes during streaming
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !streamingMessage) return;

    const observer = new MutationObserver(() => {
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
  }, [streamingMessage]);

  /**
   * Handle scroll events to detect if user is manually scrolling up
   * @returns void
   */
  const handleScroll = () => {
    const nearBottom = isNearBottom();

    if (shouldAutoScrollRef.current && !nearBottom) {
      shouldAutoScrollRef.current = false;
    } else if (!shouldAutoScrollRef.current && nearBottom) {
      shouldAutoScrollRef.current = true;
    }
  };

  /**
   * Handle the completion of a recording.
   * @param blob - The blob of the recording.
   */
  const handleRecordingComplete = async (blob: Blob) => {
    try {
      setIsUserTyping(true);
      const { text: transcribedText, cost: transcriptionCost } =
        await transcribeAudio(blob, userId);
      await handleSend(transcribedText, true, transcriptionCost);
    } catch (error) {
      console.error("Error transcribing audio:", error);
    } finally {
      setIsUserTyping(false);
    }
  };

  const handleSend = async (
    message: string,
    wasAudioInput: boolean = false,
    transcriptionCost?: number
  ) => {
    if (!message.trim() || userMessageCount >= MESSAGE_LIMIT) {
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
    setIsUserTyping(false);
    setIsAssistantTyping(true);

    // Mark that the user has interacted so that future updates will trigger auto-scroll.
    hasInteractedRef.current = true;

    // Update auto-scroll preference based on current position when sending
    shouldAutoScrollRef.current = isNearBottom();

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
        transcriptionCost: transcriptionCost,
        set: (state: any) => {
          if (state.promptResponse) {
            setStreamingMessage(state.promptResponse);
          }
        },
      });

      if (response.success && response.response) {
        const shouldSynthesizeAudio =
          wasAudioInput && (element.enableTts || false);
        setIsSynthesizingAudio(shouldSynthesizeAudio);

        let audioData: string | null = null;
        if (shouldSynthesizeAudio) {
          try {
            audioData = await synthesizeSpeech(
              response.response,
              element.ttsProvider || "openai",
              element.selectedVoiceId || "alloy",
              element.voiceInstructions,
              userId
            );
          } catch (error) {
            console.error("Error synthesizing speech:", error);
          }
        }

        const aiMessage: ChatMessage = {
          message: response.response,
          sender: "ai",
          direction: "incoming",
          run_id: response.run_uuid,
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (audioData) {
          await playAudio(audioData);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  const getErrorMessage = (elementName: string): string | null => {
    const error = errors.find((error) => error.element === elementName);
    return error ? error.error : null;
  };

  const errorMessage = getErrorMessage(element.name);
  const hasError = !!errorMessage;
  const remainingMessages = MESSAGE_LIMIT - userMessageCount;

  const totalCredits = messages.reduce((sum, msg) => {
    if (msg.sender === "ai" && msg.run_id) {
      const run = store.currentConversation?.runs.find(
        (r) => r.id === msg.run_id
      );
      return sum + (run?.credits || 0);
    }
    return sum;
  }, 0);
  const isVisible =
    skipVisibilityCheck ||
    evaluateVisibility(
      element.conditionalLogic || ({} as ConditionalLogic),
      answers
    );
  const questionText = element.text || element.label || element.name;

  return (
    <div className={`${isVisible ? "" : "hidden"}`}>
      {questionText && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {questionText}
          {element.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {element.description && (
        <p className="mt-1 text-sm/6 text-gray-600 mb-2">
          {element.description}
        </p>
      )}

      {hasError && <p className="mt-1 text-sm text-red-600">{errorMessage}</p>}

      {isActive ? (
        <div
          className="border rounded-lg overflow-hidden shadow-sm"
          style={{ height: "400px", position: "relative" }}
        >
          <div className="flex flex-col h-full">
            {/* Messages Container */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
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
                  className={`flex ${
                    message.direction === "outgoing"
                      ? "justify-end"
                      : "justify-start"
                  } items-start gap-1`}
                >
                  {message.sender === "ai" && element.avatarUrl && (
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
                      <Image
                        src={element.avatarUrl}
                        alt="Assistant avatar"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      message.direction === "outgoing"
                        ? "bg-[#5C5EF1] text-white rounded-tr-none"
                        : "bg-[#f0f2f5] text-gray-900 rounded-tl-none"
                    }`}
                  >
                    {message.direction === "outgoing" ? (
                      <div className="text-sm">{message.message}</div>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none">
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
                  </div>
                </div>
              ))}
              {(isAssistantTyping || isSynthesizingAudio) && (
                <div className="flex justify-start items-start gap-1">
                  {element.avatarUrl && (
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
                      <Image
                        src={element.avatarUrl}
                        alt="Assistant avatar"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="bg-[#f0f2f5] rounded-2xl px-4 py-2.5 shadow-sm rounded-tl-none">
                    {streamingMessage ? (
                      <div className="text-sm prose prose-sm max-w-none">
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
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce" />
                        <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce delay-200" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isUserTyping && (
                <div className="flex justify-end items-start gap-1">
                  <div className="bg-[#5C5EF1] rounded-2xl px-4 py-2.5 shadow-sm rounded-tr-none">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-white animate-bounce" />
                      <div className="w-2 h-2 bg-white animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-white animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                {recorder.isRecording ? (
                  <div className="flex-1 rounded-lg p-4 min-w-0 overflow-hidden">
                    <div className="flex items-center space-x-2">
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
                  </div>
                ) : (
                  <div className="flex-1 relative">
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        userMessageCount >= MESSAGE_LIMIT
                          ? "Message limit has been reached"
                          : `Type message here (${remainingMessages} messages remaining)`
                      }
                      disabled={disabled || userMessageCount >= MESSAGE_LIMIT}
                      style={{ minHeight: "45px", maxHeight: "120px" }}
                    />
                  </div>
                )}
                <div className="flex-shrink-0">
                  {!recorder.isRecording && (
                    <button
                      onClick={() => handleSend(inputMessage)}
                      disabled={
                        !inputMessage.trim() ||
                        disabled ||
                        userMessageCount >= MESSAGE_LIMIT
                      }
                      className="p-2 text-[#5C5EF1] hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {element.enableTts && userMessageCount < MESSAGE_LIMIT && (
                  <>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      data-testid={TEST_IDS.CHAT_AUDIO_UPLOAD_INPUT}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleRecordingComplete(file);
                          e.target.value = "";
                        }
                      }}
                    />
                    <div
                      className={`flex-shrink-0 ${
                        recorder.isRecording
                          ? "[&_.audio-recorder-mic]:hidden [&_.audio-recorder-status]:hidden [&_.recording]:!w-auto"
                          : ""
                      }`}
                    >
                      <VoiceRecorder
                        onRecordingComplete={handleRecordingComplete}
                        recorderControls={recorder}
                        downloadFileExtension="webm"
                        showVisualizer={false}
                        classes={{
                          AudioRecorderClass:
                            "!p-0 !bg-transparent !shadow-none hover:!bg-gray-100",
                          AudioRecorderPauseResumeClass: "!p-2",
                          AudioRecorderDiscardClass: "!p-2",
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 p-4 bg-gray-50 rounded-md border">
          <p className="text-sm text-gray-600">Chat ended. History saved.</p>
        </div>
      )}

      {/* Add credits display outside chatbox */}
      {(isOwner || isAdmin) && (
        <div className="flex justify-end mt-2">
          <span className="text-xs text-gray-400">
            Chat Credits Used: {totalCredits}
          </span>
        </div>
      )}
    </div>
  );
};

export default ChatQuestion;
