"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  X,
  Send,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Loader2,
  Undo2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";
import { useSurveyStore } from "../../store/editSurveyStore";
import { AppJsonV2 } from "@/app/(authenticated)/app/types";
import { authorizedFetch } from "@/utils/authorizedFetch";
import { readSseResponse } from "@/utils/readSseStream";
import { toast } from "react-toastify";

export type ChatBuildSidebarHandle = {
  sendMessage: (text: string) => Promise<void>;
};

interface ChatBuildSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  appId: number | null;
}

function ThinkingBlock({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {isStreaming ? (
          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
        ) : expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="italic">{isStreaming ? "Thinking…" : "Thinking"}</span>
      </button>
      <AnimatePresence>
        {expanded && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 pl-4 border-l-2 border-gray-200 text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ChatBuildSidebar = forwardRef<
  ChatBuildSidebarHandle,
  ChatBuildSidebarProps
>(function ChatBuildSidebar({ isOpen, onClose, appId }, ref) {
  const {
    chatBuildMessages,
    addChatBuildMessage,
    updateChatBuildMessage,
    replaceEntireAppJson,
    pushAppBuilderUndoSnapshot,
    undoLastAppBuilderChange,
    appBuilderUndoStack,
  } = useSurveyStore();

  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatBuildMessages]);

  const runSendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || !appId) return;

      const assistantId = `assistant-${Date.now()}`;

      addChatBuildMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: userText.trim(),
        status: "done",
      });

      addChatBuildMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        thinkingContent: undefined,
        status: "streaming",
      });

      setIsStreaming(true);
      isStreamingRef.current = true;
      abortControllerRef.current = new AbortController();

      const history = useSurveyStore
        .getState()
        .chatBuildMessages.filter(
          (m) => m.status === "done" || m.role === "user"
        )
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await authorizedFetch(
          "/api/microapps/app-builder-chat/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: appId,
              message: userText.trim(),
              history,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        for await (const { event, data: dataRaw } of readSseResponse(
          response
        )) {
          let data: { chunk?: string; message?: string; app_json?: unknown };
          try {
            data = JSON.parse(dataRaw) as typeof data;
          } catch {
            continue;
          }

          switch (event) {
            case "thinking":
              useSurveyStore.setState((state) => ({
                chatBuildMessages: state.chatBuildMessages.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        thinkingContent:
                          (msg.thinkingContent ?? "") + (data.chunk ?? ""),
                      }
                    : msg
                ),
              }));
              break;

            case "content":
              useSurveyStore.setState((state) => ({
                chatBuildMessages: state.chatBuildMessages.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + (data.chunk ?? "") }
                    : msg
                ),
              }));
              break;

            case "complete":
              updateChatBuildMessage(assistantId, { status: "done" });
              if (data.app_json) {
                pushAppBuilderUndoSnapshot();
                replaceEntireAppJson(data.app_json as AppJsonV2);
              }
              break;

            case "refused":
              updateChatBuildMessage(assistantId, {
                content:
                  data.message ?? "I can only help with building microapps.",
                status: "refused",
                thinkingContent: undefined,
              });
              break;

            case "error":
              updateChatBuildMessage(assistantId, {
                content:
                  data.message ?? "An error occurred. Please try again.",
                status: "error",
                thinkingContent: undefined,
              });
              break;
            default:
              break;
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          updateChatBuildMessage(assistantId, {
            content: "Something went wrong. Please try again.",
            status: "error",
          });
        }
      } finally {
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [
      appId,
      addChatBuildMessage,
      updateChatBuildMessage,
      replaceEntireAppJson,
      pushAppBuilderUndoSnapshot,
    ]
  );

  const handleUndoAppUpdate = useCallback(async () => {
    if (isStreaming || appBuilderUndoStack.length === 0) return;
    const ok = await undoLastAppBuilderChange();
    if (ok) {
      toast.success("Restored the app to before the last AI update.");
    }
  }, [
    isStreaming,
    appBuilderUndoStack.length,
    undoLastAppBuilderChange,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      sendMessage: async (text: string) => {
        if (!text.trim() || isStreamingRef.current || !appId) return;
        await runSendMessage(text);
      },
    }),
    [runSendMessage, appId]
  );

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !appId) return;
    const userText = inputValue.trim();
    setInputValue("");
    await runSendMessage(userText);
  }, [inputValue, isStreaming, appId, runSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="chat-build-sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 400, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          // Sticky (in-flow) keeps the sidebar pushing the main editor,
          // while the explicit height keeps the input visible below the header.
          className="sticky top-16 bg-white z-50 flex flex-col overflow-hidden border-l border-gray-100 self-start h-[calc(100vh-4rem)]"
          style={{ minWidth: 0, maxWidth: 400 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  App Builder
                </h2>
                <p className="text-xs text-gray-400">AI-powered app generation</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="lg"
                type="button"
                onClick={handleUndoAppUpdate}
                disabled={
                  isStreaming || appBuilderUndoStack.length === 0
                }
                className="h-8 px-2 gap-1 text-gray-500 hover:text-gray-800 disabled:opacity-40"
                title={
                  appBuilderUndoStack.length === 0
                    ? "Nothing to undo yet"
                    : "Undo last AI app update"
                }
              >
                <Undo2 className="h-4 w-4" />
                <span className="text-xs font-medium">Undo</span>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={onClose}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {chatBuildMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Build with AI
                </p>
                <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">
                  Describe what you want to build or change. For example:{" "}
                  <span className="italic">
                    &ldquo;Create an app to practice French vocabulary with
                    MCQs&rdquo;
                  </span>
                </p>
              </div>
            )}

            {chatBuildMessages.map((message) => {
              const isUser = message.role === "user";
              const isThisStreaming = message.status === "streaming";
              const isRefused = message.status === "refused";
              const isError = message.status === "error";

              if (isUser) {
                return (
                  <div key={message.id} className="flex justify-end mb-4">
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex justify-start mb-4">
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      {message.thinkingContent !== undefined && (
                        <ThinkingBlock
                          content={message.thinkingContent}
                          isStreaming={
                            isThisStreaming && !message.content
                          }
                        />
                      )}
                      {isError || isRefused ? (
                        <div
                          className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                            isError
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {message.content}
                        </div>
                      ) : (
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content ? (
                            <>
                              {message.content}
                              {isThisStreaming && (
                                <span className="inline-flex items-center gap-1.5 ml-2 text-xs text-gray-400">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Generating…
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex gap-1 items-center h-5">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                            </span>
                          )}
                          {message.status === "done" && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                              App updated successfully
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-end gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what to build or change…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none min-h-[24px] max-h-32 overflow-y-auto leading-relaxed disabled:opacity-60"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-white" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ChatBuildSidebar;
