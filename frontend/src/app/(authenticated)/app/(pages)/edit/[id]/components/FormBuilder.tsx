"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { DragDropContext } from "@hello-pangea/dnd";
import {
  Plus,
  ChevronDown,
  Upload,
  X,
  FileText,
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  List,
  SlidersHorizontal,
  ToggleLeft,
  Bot,
  MessageCircle,
  ImagePlus,
  MessagesSquare,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { AddSectionPopover } from "./ui/add-section-popover";
import JsonPreview from "./JsonPreview";
import Field from "./Field";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Input } from "../../../../../../../components/basic/input";
import { useSurveyStore } from "../store/editSurveyStore";
import AppRuntimeView from "@/components/AppRuntimeView";
import ShareModal from "@/app/(authenticated)/(dashboard)/dashboard/[tab]/components/ShareModal";
import type { AppSerialized } from "@/app/(authenticated)/(dashboard)/types";
import MicroappStatsContent from "@/app/(authenticated)/app/(pages)/[id]/stats/MicroappStatsContent";
import { checkIsOwner } from "@/utils/checkRoles";
import { useUserStore } from "@/store/userStore";
import { showUndoToast } from "@/components/UndoToast";
import {
  Element,
  Choice,
  ConditionalLogic,
} from "@/app/(authenticated)/app/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { createFileUploader } from "@/utils/imageUpload";
import axiosInstance from "@/utils/axiosInstance";
import ConditionalLogicSidebar from "./ui/conditional-logic-sidebar";
import ChatBuildSidebar, {
  type ChatBuildSidebarHandle,
} from "./ui/chat-build-sidebar";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import Logo from "@/img/logos/onMicroAI_logo_horiz_color-cropped.svg";
import Image from "next/image";
import MonitorPreview from "./ui/monitor-preview";
import { TagFocusProvider } from "./TagFocusContext";
import { Textarea } from "@/components/basic/textarea";
import { AxiosInstance } from "axios";

export const AVAILABLE_SECTIONS = [
  {
    label: "Display",
    color: "blue",
    sections: [
      {
        id: "title",
        label: "Title",
        icon: Type,
        helper: "Static title text shown to the user.",
      },
      {
        id: "richText",
        label: "Rich Text",
        icon: FileText,
        helper: "Display text or images to the user.",
      },
    ],
  },
  {
    label: "Input",
    color: "green",
    sections: [
      {
        id: "text",
        label: "Single Line",
        icon: Type,
        helper: "Collect a single line of text input.",
      },
      {
        id: "textarea",
        label: "Long Text",
        icon: AlignLeft,
        helper: "Collect a longer block of text input.",
      },
      {
        id: "radio",
        label: "Radio Buttons",
        icon: CircleDot,
        helper: "Collect a single choice from a list of options.",
      },
      {
        id: "checkbox",
        label: "Checkboxes",
        icon: CheckSquare,
        helper: "Collect one or more choices from a list of options.",
      },
      {
        id: "dropdown",
        label: "Dropdown",
        icon: List,
        helper: "Collect a single choice from a dropdown menu.",
      },
      {
        id: "slider",
        label: "Slider",
        icon: SlidersHorizontal,
        helper: "Collect a numeric value from a slider.",
      },
      {
        id: "boolean",
        label: "Boolean",
        icon: ToggleLeft,
        helper:
          "Collect a true or false value. Often used for conditional logic.",
      },
      {
        id: "imageUpload",
        label: "Image Upload",
        icon: ImagePlus,
        helper: "Collect an image or images from the user.",
      },
    ],
  },
  {
    label: "Response",
    color: "brown",
    sections: [
      {
        id: "aiResponse",
        label: "AI Response",
        icon: Bot,
        helper: "Stops the flow and runs the AI when the user clicks Run.",
      },
      {
        id: "fixedResponse",
        label: "Response",
        icon: MessageCircle,
        helper: "Stops the flow and shows static text (no AI call).",
      },
      {
        id: "scoring",
        label: "Scoring",
        icon: SlidersHorizontal,
        helper:
          "Stops the flow and runs rubric scoring when the user clicks Run.",
      },
    ],
  },
  {
    label: "Chat",
    color: "violet",
    sections: [
      {
        id: "chat",
        label: "Chatbot",
        icon: MessagesSquare,
        helper: "Add a chat interface for users to interact with the AI.",
      },
    ],
  },
];

const BLANK_APP_STARTER_PROMPTS = [
  "Build me a Multiple Choice Question Generator",
  "Build an AI-Powered Debate",
  "Create a Simple Clinical Scenario",
  "Build a Language Practice Chatbot",
] as const;

const normalizeTagBase = (type: string) =>
  type.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const buildDefaultTag = (type: string, usedNames: Set<string>) => {
  const base = normalizeTagBase(type);
  let index = 1;
  while (usedNames.has(`${base}${index}`)) {
    index += 1;
  }
  const name = `${base}${index}`;
  usedNames.add(name);
  return name;
};

const shouldDefaultQuestionLabel = (type: string) =>
  ![
    "title",
    "aiResponse",
    "fixedResponse",
    "scoring",
    "richText",
    "prompt",
    "aiInstructions",
    "chat",
  ].includes(type);

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "text/plain": [".txt", ".log"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/tiff": [".tiff"],
  "image/bmp": [".bmp"],
};

//TO-DO: Just use the backend max file size
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB max file size

const MAX_DESCRIPTION_LENGTH = 200;

type EmbeddingStatus = "pending" | "processing" | "ready" | "failed";

interface UploadedFile {
  name: string;
  url?: string;
  size: number;
  word_count?: number;
  original_filename: string;
  text_filename: string;
  description?: string;
  status?: EmbeddingStatus | "duplicate";
  error?: string;
  pendingFile?: File;
}

export default function FormBuilder() {
  const params = useParams() ?? {};
  const router = useRouter();
  const hashId = (params.id as string) || "";

  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [addSectionOpenFor, setAddSectionOpenFor] = useState<string | null>(
    null
  );
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [backgroundTheme] = useState<"white" | "gray">("gray");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  type EditorTab = "build" | "preview" | "share" | "stats";
  const [activeTab, setActiveTab] = useState<EditorTab>("build");
  const [editorIsOwner, setEditorIsOwner] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isAppDetailsEditMode, setIsAppDetailsEditMode] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>(
    undefined
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const lastBuildSidebarOpenRef = useRef(false);
  const chatBuildRef = useRef<ChatBuildSidebarHandle>(null);
  const blankWelcomeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [hideBlankAppWelcome, setHideBlankAppWelcome] = useState(false);
  const [welcomeIdeaText, setWelcomeIdeaText] = useState("");
  const [pendingChatBootstrap, setPendingChatBootstrap] = useState<
    string | null
  >(null);
  const [domainInput, setDomainInput] = useState("");
  const [domainsSaving, setDomainsSaving] = useState(false);

  const {
    elements,
    privacy,
    permittedDomains,
    clonable,
    completedHtml,
    collectionIds,
    description,
    title,
    collections,
    availableModels,
    defaultAiModel,
    isLoadingCollections,
    aiConfig,
    attachedFiles,
    setElements,
    setTitle,
    setDescription,
    addCollection,
    removeCollection,
    setPrivacy,
    setPermittedDomains,
    setClonable,
    setCompletedHtml,
    setAIConfig,
    addAttachedFile,
    removeAttachedFile,
    fetchCollections,
    fetchLiteLLMModels,
    appId,
    setAttachedFiles,
    conditionalSidebarOpen,
    setConditionalSidebarOpen,
    setConditionalSidebarContext,
    conditionalSidebarContext,
    saveState,
    chatBuildSidebarOpen,
    setChatBuildSidebarOpen,
  } = useSurveyStore();

  const userId = useUserStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!hashId || userId == null) {
      setEditorIsOwner(false);
      return;
    }
    const ac = new AbortController();
    void checkIsOwner(hashId, userId, ac.signal)
      .then(({ isOwner }) => {
        setEditorIsOwner(isOwner);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [hashId, userId]);

  const shareAppForModal: AppSerialized | null = useMemo(() => {
    if (appId == null) return null;
    return {
      id: appId,
      hashId,
      title: title || "Untitled App",
      explanation: description || "",
      privacy,
      permittedDomains: permittedDomains ?? [],
      temperature: aiConfig.temperature ?? 0.7,
      copyAllowed: clonable,
      appJson: "",
      ...(collectionIds[0] != null ? { collectionId: collectionIds[0] } : {}),
      role: editorIsOwner ? "owner" : "admin",
    };
  }, [
    appId,
    hashId,
    title,
    description,
    privacy,
    permittedDomains,
    clonable,
    collectionIds,
    aiConfig.temperature,
    editorIsOwner,
  ]);

  const handleShareModalVisibility = useCallback(() => {}, []);

  const handlePrivacySavedFromShare = useCallback(
    (newPrivacy: string) => {
      void setPrivacy(newPrivacy, true);
    },
    [setPrivacy]
  );

  const handlePermittedDomainsSavedFromShare = useCallback(
    (domains: string[]) => {
      setPermittedDomains(domains);
    },
    [setPermittedDomains]
  );

  const isSavingIndicator = saveState.isDebouncing || saveState.isSaving;

  const tabButtonClass = (tab: EditorTab) =>
    `px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
      activeTab === tab
        ? "bg-white text-primary shadow-sm"
        : "text-gray-600 hover:text-gray-900"
    }`;

  const handleTabChange = (tab: EditorTab) => {
    if (tab === activeTab) return;
    if (tab === "preview" || tab === "share" || tab === "stats") {
      lastBuildSidebarOpenRef.current = sidebarOpen;
      setSidebarOpen(false);
      setConditionalSidebarOpen(false);
    }
    if (tab === "build") {
      setSidebarOpen(lastBuildSidebarOpenRef.current);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    if (activeTab === "build") {
      lastBuildSidebarOpenRef.current = sidebarOpen;
    }
  }, [activeTab, sidebarOpen]);
  const handleSaveConditionalLogic = async (logic: ConditionalLogic) => {
    if (!conditionalSidebarContext?.field.id) {
      setConditionalSidebarOpen(false);
      return;
    }

    // Handle instruction conditional logic
    if (conditionalSidebarContext.instructionIndex !== undefined) {
      const field = conditionalSidebarContext.field;
      const instructions = field.instructions || [];
      const updatedInstructions = instructions.map((inst, idx) =>
        idx === conditionalSidebarContext.instructionIndex
          ? { ...inst, conditionalLogic: logic }
          : inst
      );

      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === field.id ? { ...el, instructions: updatedInstructions } : el
        )
      );
    } else {
      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === conditionalSidebarContext.field.id
            ? { ...el, conditionalLogic: logic }
            : el
        )
      );
    }
    setConditionalSidebarOpen(false);
  };

  const restoreConditionalLogic = async (logic: ConditionalLogic) => {
    if (!conditionalSidebarContext?.field.id) {
      return;
    }

    if (conditionalSidebarContext.instructionIndex !== undefined) {
      const field = conditionalSidebarContext.field;
      const instructions = field.instructions || [];
      const updatedInstructions = instructions.map((inst, idx) =>
        idx === conditionalSidebarContext.instructionIndex
          ? { ...inst, conditionalLogic: logic }
          : inst
      );

      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === field.id ? { ...el, instructions: updatedInstructions } : el
        )
      );
    } else {
      await setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === conditionalSidebarContext.field.id
            ? { ...el, conditionalLogic: logic }
            : el
        )
      );
    }

    setConditionalSidebarContext({
      field: conditionalSidebarContext.field,
      currentLogic: logic,
      instructionIndex: conditionalSidebarContext.instructionIndex,
    });
  };

  const handleClearConditionalLogic = () => {
    if (!conditionalSidebarContext?.field.id) {
      return;
    }

    const previousLogic = conditionalSidebarContext.currentLogic;

    // Handle instruction conditional logic
    if (conditionalSidebarContext.instructionIndex !== undefined) {
      const field = conditionalSidebarContext.field;
      const instructions = field.instructions || [];
      const updatedInstructions = instructions.map((inst, idx) =>
        idx === conditionalSidebarContext.instructionIndex
          ? { ...inst, conditionalLogic: undefined }
          : inst
      );

      setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === field.id ? { ...el, instructions: updatedInstructions } : el
        )
      );
    } else {
      setElements(
        (Array.isArray(elements) ? elements : []).map((el) =>
          el.id === conditionalSidebarContext.field.id
            ? { ...el, conditionalLogic: undefined }
            : el
        )
      );
    }

    if (previousLogic) {
      showUndoToast({
        message: "Conditional logic cleared.",
        onUndo: () => {
          void restoreConditionalLogic(previousLogic);
        },
      });
    }
  };

  const fileUploader = createFileUploader(appId?.toString() || "");

  const uploadFile = useCallback(
    async (file: File) => {
      try {
        setIsUploading(true);
        const result = await fileUploader.uploadFile(file);

        const original_filename = result.original_file;
        if (!original_filename) {
          throw new Error("No filename returned from upload");
        }

        setUploadedFiles((prev) => [
          ...prev,
          {
            name: original_filename,
            url: result.url,
            original_filename,
            text_filename: original_filename,
            size: file.size,
            word_count: undefined,
            status: "pending",
          },
        ]);

        await addAttachedFile({
          original_filename,
          text_filename: original_filename,
          size: file.size,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Failed to upload file");
      } finally {
        setIsUploading(false);
      }
    },
    [fileUploader, addAttachedFile]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        alert("File size must be less than 20MB");
        return;
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
      if (
        uploadedFiles.some(
          (f) =>
            f.original_filename === sanitizedName && f.status !== "duplicate"
        )
      ) {
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: sanitizedName,
            original_filename: sanitizedName,
            text_filename: sanitizedName,
            size: file.size,
            status: "duplicate",
            pendingFile: file,
          },
        ]);
        return;
      }

      await uploadFile(file);
    },
    [uploadedFiles, uploadFile]
  );

  const keepDuplicate = useCallback(
    async (index: number) => {
      const file = uploadedFiles[index];
      if (!file.pendingFile) return;

      const pendingFile = file.pendingFile;
      const sanitizedName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "");

      // Remove duplicate placeholder + original entry from UI
      setUploadedFiles((prev) =>
        prev
          .filter((_, i) => i !== index)
          .filter((f) => f.original_filename !== sanitizedName)
      );

      // Delete original
      try {
        const api: AxiosInstance = axiosInstance();
        await removeAttachedFile(sanitizedName);
        await api.delete(`/api/microapps/${appId}/delete-file/`, {
          data: { filename: sanitizedName },
        });
      } catch (error) {
        console.error("Failed to delete original file:", error);
      }

      // Upload new file
      await uploadFile(pendingFile);
    },
    [uploadedFiles, removeAttachedFile, appId, uploadFile]
  );

  const removeFile = useCallback(
    async (index: number) => {
      const file = uploadedFiles[index];

      // Duplicate placeholder was never uploaded - just remove from UI
      if (file.status === "duplicate") {
        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
        return;
      }

      // Find a pending duplicate for this file before removing
      const pendingDuplicate = uploadedFiles.find(
        (f, i) =>
          i !== index &&
          f.original_filename === file.original_filename &&
          f.status === "duplicate"
      );

      // Remove original (and duplicate placeholder if any)
      setUploadedFiles((prev) =>
        prev
          .filter((_, i) => i !== index)
          .filter(
            (f) =>
              !(
                f.original_filename === file.original_filename &&
                f.status === "duplicate"
              )
          )
      );

      // Delete from store + backend
      await removeAttachedFile(file.original_filename);
      try {
        const api: AxiosInstance = axiosInstance();
        await api.delete(`/api/microapps/${appId}/delete-file/`, {
          data: { filename: file.original_filename },
        });
      } catch (error) {
        console.error("Failed to delete file chunks:", error);
      }

      // If a duplicate was waiting, upload it now
      if (pendingDuplicate?.pendingFile) {
        await uploadFile(pendingDuplicate.pendingFile);
      }
    },
    [uploadedFiles, removeAttachedFile, appId, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => handleFileUpload(file));
    },
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
  });

  useEffect(() => {
    // Set default AI config values if not present
    if (!aiConfig.aiModel && defaultAiModel) {
      setAIConfig({
        ...aiConfig,
        aiModel: defaultAiModel,
      });
    }
    if (!aiConfig.temperature) {
      setAIConfig({
        ...aiConfig,
        temperature: 0.7,
      });
    }
  }, [aiConfig, setAIConfig]);

  // Initialize uploadedFiles from attachedFiles
  useEffect(() => {
    if (attachedFiles && attachedFiles.length > 0) {
      setUploadedFiles((prev) => {
        const prevMap = new Map(prev.map((f) => [f.original_filename, f]));
        return attachedFiles
          .filter((file) => file && file.original_filename)
          .map((file) => {
            const existing = prevMap.get(file.original_filename);
            return {
              name: file.original_filename,
              original_filename: file.original_filename,
              text_filename: file.text_filename,
              url: `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${file.original_filename}`,
              size: file.size,
              word_count: existing?.word_count ?? file.word_count,
              description: file.description,
              // preserve polled status; undefined until first poll resolves
              status: existing?.status ?? undefined,
              error: existing?.error,
            };
          });
      });
    } else {
      setUploadedFiles([]);
    }
  }, [attachedFiles]);

  const hasPending = uploadedFiles.some(
    (f) =>
      f.status === "pending" ||
      f.status === "processing" ||
      f.status === undefined
  );

  // Poll /file-status/ while any file is pending or processing
  useEffect(() => {
    if (!appId || !hasPending) return;

    const api = axiosInstance();
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/api/microapps/${appId}/file-status/`);
        const statusMap: Record<
          string,
          {
            status: EmbeddingStatus;
            chunk_count?: number;
            word_count?: number;
            error?: string;
          }
        > = res.data;
        setUploadedFiles((prev) =>
          prev.map((f) => {
            const s = statusMap[f.original_filename];
            if (!s) return f;
            return {
              ...f,
              status: s.status,
              word_count: s.word_count ?? f.word_count,
              error: s.error ?? undefined,
            };
          })
        );
      } catch (e) {
        console.warn("file-status poll failed:", e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);

    return () => clearInterval(interval);
  }, [hasPending, appId]);

  // Ensure at least one element exists and open sidebar on mount
  const elementCount = Array.isArray(elements) ? elements.length : 0;
  const showBlankAppWelcome = elementCount === 0 && !hideBlankAppWelcome;

  useEffect(() => {
    if (elementCount > 0) {
      setHideBlankAppWelcome(false);
    }
  }, [elementCount]);

  // Open the app-details sidebar on mount (left panel)
  useEffect(() => {
    setSidebarOpen(true);
  }, []);

  const handleWelcomeDescribeSubmit = useCallback(() => {
    const text = welcomeIdeaText.trim();
    if (!text) return;
    setHideBlankAppWelcome(true);
    setWelcomeIdeaText("");
    setChatBuildSidebarOpen(true);
    setPendingChatBootstrap(text);
  }, [welcomeIdeaText, setChatBuildSidebarOpen]);

  const handleStarterPromptChip = useCallback((prompt: string) => {
    setWelcomeIdeaText(prompt);
    queueMicrotask(() => blankWelcomeTextareaRef.current?.focus());
  }, []);

  const handleWelcomeBuildFromScratch = useCallback(() => {
    setHideBlankAppWelcome(true);
    setWelcomeIdeaText("");
  }, []);

  useEffect(() => {
    if (!pendingChatBootstrap || !chatBuildSidebarOpen) return;
    const text = pendingChatBootstrap;
    setPendingChatBootstrap(null);
    void chatBuildRef.current?.sendMessage(text);
  }, [pendingChatBootstrap, chatBuildSidebarOpen]);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  //Load models on mount - using LiteLLM by default
  useEffect(() => {
    fetchLiteLLMModels();
  }, [fetchLiteLLMModels]);

  //   useEffect(() => {
  //     const current = Array.isArray(elements) ? elements : [];
  //     const usedNames = new Set<string>();
  //     current.forEach((element) => {
  //       const name = element.name?.trim();
  //       if (name) {
  //         usedNames.add(name.toLowerCase());
  //       }
  //     });

  //     let changed = false;
  //     const updated = current.map((element) => {
  //       const name = element.name?.trim();
  //       const label = element.label?.trim();
  //       const nextElement = { ...element };
  //       if (!name) {
  //         changed = true;
  //         nextElement.name = buildDefaultTag(element.type, usedNames);
  //       }
  //       if (!label && shouldDefaultQuestionLabel(element.type)) {
  //         changed = true;
  //         nextElement.label = "Question";
  //       }
  //       return nextElement;
  //     });

  //     if (changed) {
  //       setElements(updated);
  //     }
  //   }, [elements, setElements]);

  const activeElement = elements.find(
    (element) => element.id === activeFieldId
  );
  const isTagFocusActive =
    conditionalSidebarOpen || activeElement?.type === "aiResponse";

  useEffect(() => {
    if (!conditionalSidebarOpen) return;

    const contextFieldId = conditionalSidebarContext?.field?.id;
    if (!contextFieldId) return;

    if (!activeFieldId || activeFieldId !== contextFieldId) {
      setConditionalSidebarOpen(false);
    }
  }, [
    activeFieldId,
    conditionalSidebarContext?.field?.id,
    conditionalSidebarOpen,
    setConditionalSidebarOpen,
  ]);

  /**
   * V2 builder: elements are stored as a single ordered list.
   */
  const updateElement = useCallback(
    (elementId: string, updates: Partial<Element>) => {
      const current = Array.isArray(elements) ? elements : [];
      setElements(
        current.map((el) => (el.id === elementId ? { ...el, ...updates } : el))
      );
    },
    [elements, setElements]
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      const current = Array.isArray(elements) ? elements : [];
      const index = current.findIndex((el) => el.id === elementId);
      if (index === -1) return null;
      const removed = current[index];
      setElements(current.filter((el) => el.id !== elementId));
      return { element: removed, index };
    },
    [elements, setElements]
  );

  /**
   * Handles the completion of a drag-and-drop operation within the form builder.
   * Reorders elements within the single elements[] list.
   */
  const handleDragEnd = (result: any) => {
    const { source, destination } = result;

    if (!destination) return;
    const current = Array.isArray(elements) ? elements : [];
    const updated = [...current];
    const [moved] = updated.splice(source.index, 1);
    updated.splice(destination.index, 0, moved);
    setElements(updated);
  };

  /**
   * Adds a new element into the app (V2 builder).
   */
  const addElementToApp = (type: string, insertAfter?: number | null) => {
    const current = Array.isArray(elements) ? elements : [];
    const usedNames = new Set(
      current
        .map((element) => element.name?.trim().toLowerCase())
        .filter(Boolean) as string[]
    );
    const defaultName = buildDefaultTag(type, usedNames);

    const base: Element = {
      id: `${type}-${Date.now()}`,
      type: type as Element["type"],
      label: shouldDefaultQuestionLabel(type) ? "Question" : "",
      name: defaultName,
      isRequired: false,
    };

    const newElement: Element = {
      ...base,
      ...(type === "title" && {
        label: "Title",
        text: "Title",
      }),
      ...(type === "aiResponse" && {
        instructions: [{ text: "" }],
      }),
      ...(type === "fixedResponse" && { text: "" }),
      ...(type === "scoring" && {
        rubric: JSON.stringify([
          {
            criteria: "Category 1",
            lines: [
              { score: 1, description: "" },
              { score: 0, description: "" },
            ],
          },
        ]),
        minScore: 0,
        scoreFeedbackEnabled: true,
        scoreFeedbackInstructions: "",
        isRequired: true,
      }),
      ...(type === "imageUpload" && {
        multiple: false,
        maxFiles: 1,
        maxFileSize: 5,
        allowedFileTypes: ["image/jpeg", "image/png"],
      }),
      ...(type === "chat" && {
        maxMessages: 10,
        initialMessage: "Hello! How can I help you today?",
        enableTts: false,
        ttsProvider: "openai",
        selectedVoiceId: "",
        voiceInstructions: "",
        avatarUrl: "",
      }),
    };

    const updated = [...current];
    if (insertAfter !== null && insertAfter !== undefined) {
      updated.splice(insertAfter + 1, 0, newElement);
    } else {
      updated.push(newElement);
    }

    setElements(updated);
    setActiveFieldId(newElement.id);
    setAddSectionOpenFor(null);
    setInsertAfterIndex(null);
  };

  /**
   * Updates the label of an element.
   */
  const updateFieldLabel = (
    fieldId: string,
    newLabel: string,
    _isPrompt: boolean = false
  ) => {
    // For title elements we also mirror label into text for display.
    updateElement(fieldId, { label: newLabel, text: newLabel });
  };

  /**
   * Updates the internal name/identifier of an element.
   */
  const updateFieldName = (
    fieldId: string,
    newName: string,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { name: newName });
  };

  /**
   * Sets whether a field is required for form submission.
   */
  const updateFieldRequired = (
    fieldId: string,
    isRequired: boolean,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { isRequired });
  };

  /**
   * Removes an element.
   */
  const deleteField = (fieldId: string, _isPrompt: boolean = false) => {
    const deleted = deleteElement(fieldId);
    if (!deleted) return;
    showUndoToast({
      message: "Field deleted.",
      onUndo: () => {
        const latestElements = Array.isArray(useSurveyStore.getState().elements)
          ? useSurveyStore.getState().elements
          : [];
        if (latestElements.some((el) => el.id === deleted.element.id)) {
          return;
        }
        const restored = [...latestElements];
        const insertIndex = Math.min(deleted.index, restored.length);
        restored.splice(insertIndex, 0, deleted.element);
        void setElements(restored);
      },
    });
  };

  /**
   * Updates the description of a field within a specific phase.
   */
  const updateFieldDescription = (
    fieldId: string,
    description: string,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { description });
  };

  /**
   * Sets character count validation rules for text-based fields.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldValidation = (
    fieldId: string,
    minChars: number | null,
    maxChars: number | null,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, {
      minChars: minChars ?? undefined,
      maxChars: maxChars ?? undefined,
    });
  };

  /**
   * Sets the default value for a field.
   */
  const updateFieldDefaultValue = (
    fieldId: string,
    value: string | string[] | number | boolean
  ) => {
    updateElement(fieldId, { defaultValue: value });
  };

  /**
   * Sets the placeholder text for a field.
   */
  const updateFieldPlaceholder = (fieldId: string, placeholder: string) => {
    updateElement(fieldId, { placeholder });
  };

  /**
   * Updates the available choices for selection-type fields (radio, checkbox, dropdown).
   */
  const updateFieldChoices = (fieldId: string, choices: Choice[]) => {
    updateElement(fieldId, { choices });
  };

  /**
   * Toggles the "Other" option for selection-type fields.
   */
  const updateFieldShowOther = (fieldId: string, showOther: boolean) => {
    updateElement(fieldId, { showOtherItem: showOther });
  };

  /**
   * Updates the configuration properties of a slider field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldSliderProps = (
    fieldId: string,
    updates: {
      minValue?: number;
      maxValue?: number;
      step?: number;
    }
  ) => {
    updateElement(fieldId, updates);
  };

  /**
   * Sets the default value for a slider field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldSliderValue = (fieldId: string, value: number) => {
    updateElement(fieldId, { defaultValue: value });
  };

  /**
   * Updates the type of a field, preserving common properties and resetting type-specific ones.
   */
  const updateFieldType = (fieldId: string, newType: string) => {
    const element = elements.find((el) => el.id === fieldId);
    if (!element) return;

    const baseProperties: any = {
      type: newType,
      id: element.id,
      name: element.name,
      label: element.label,
      description: element.description,
      isRequired: element.isRequired,
      conditionalLogic: element.conditionalLogic,
    };

    const typeSpecificDefaults: any = {};

    switch (newType) {
      case "radio":
      case "checkbox":
      case "dropdown":
        typeSpecificDefaults.choices = [
          { value: "Option 1", text: "Option 1" },
          { value: "Option 2", text: "Option 2" },
        ];
        typeSpecificDefaults.showOther = false;
        break;
      case "slider":
        typeSpecificDefaults.minValue = 0;
        typeSpecificDefaults.maxValue = 100;
        typeSpecificDefaults.step = 1;
        typeSpecificDefaults.defaultValue = 50;
        break;
      case "boolean":
        typeSpecificDefaults.defaultValue = false;
        break;
      case "chat":
        typeSpecificDefaults.maxMessages = 10;
        typeSpecificDefaults.initialMessage = "Hello! How can I help you?";
        typeSpecificDefaults.ttsEnabled = false;
        typeSpecificDefaults.selectedVoiceId = "ash";
        typeSpecificDefaults.ttsProvider = "openai";
        break;
      case "imageUpload":
        typeSpecificDefaults.multiple = false;
        typeSpecificDefaults.maxFiles = 5;
        typeSpecificDefaults.maxFileSize = 5242880; // 5MB
        break;
      case "richText":
        typeSpecificDefaults.html = "<p>Enter your content here...</p>";
        break;
      case "aiResponse":
        typeSpecificDefaults.text = "";
        typeSpecificDefaults.instructions = [];
        typeSpecificDefaults.isRequired = false;
        break;
      case "fixedResponse":
        typeSpecificDefaults.text = "";
        typeSpecificDefaults.isRequired = false;
        break;
      case "scoring":
        typeSpecificDefaults.rubric = "";
        typeSpecificDefaults.minScore = 0;
        typeSpecificDefaults.scoreFeedbackEnabled = true;
        typeSpecificDefaults.scoreFeedbackInstructions = "";
        break;
      case "text":
      case "textarea":
        typeSpecificDefaults.placeholder = "";
        typeSpecificDefaults.defaultValue = "";
        break;
    }

    updateElement(fieldId, { ...baseProperties, ...typeSpecificDefaults });
  };

  /**
   * Updates the text content of a text-based field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldText = (
    fieldId: string,
    text: string,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { text });
  };

  /**
   * Updates the HTML content of a rich text field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldRichText = (
    fieldId: string,
    html: string,
    _isPrompt: boolean = false
  ) => {
    updateElement(fieldId, { html });
  };

  /**
   * Updates the conditional display logic for a field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const handleUpdateConditionalLogic = (
    fieldId: string,
    logic: ConditionalLogic | null,
    _isPrompt: boolean
  ) => {
    const currentField = (Array.isArray(elements) ? elements : []).find(
      (element) => element.id === fieldId
    );
    const previousLogic = currentField?.conditionalLogic;
    updateElement(fieldId, { conditionalLogic: logic || undefined });
    if (!logic && previousLogic) {
      showUndoToast({
        message: "Conditional logic cleared.",
        onUndo: () => {
          updateElement(fieldId, { conditionalLogic: previousLogic });
        },
      });
    }
  };

  /**
   * Updates the configuration for image upload fields.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateImageUploadSettings = (
    fieldId: string,
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    }
  ) => {
    updateElement(fieldId, settings);
  };

  /**
   * Sets the maximum number of messages allowed in a chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldMaxMessages = (fieldId: string, maxMessages: number) => {
    updateElement(fieldId, { maxMessages });
  };

  /**
   * Sets the initial message displayed in a chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateFieldInitialMessage = (
    fieldId: string,
    initialMessage: string
  ) => {
    updateElement(fieldId, { initialMessage });
  };

  /**
   * Updates the chatbot instructions for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateChatbotInstructions = (fieldId: string, instructions: string) => {
    updateElement(fieldId, { chatbotInstructions: instructions });
  };

  /**
   * Updates the TTS provider setting for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsProvider = (fieldId: string, provider: string) => {
    updateElement(fieldId, { ttsProvider: provider });
  };

  /**
   * Updates the selected voice ID for TTS in a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsVoiceId = (fieldId: string, voiceId: string) => {
    updateElement(fieldId, {
      selectedVoiceId: voiceId,
      ttsProvider: "openai", //TODO: Support other TTS providers
    });
  };

  /**
   * Toggles TTS functionality for a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateTtsEnabled = (fieldId: string, enabled: boolean) => {
    updateElement(fieldId, { enableTts: enabled });
  };

  /**
   * Updates the voice instructions for custom voice design in a specific chat field.
   * Now works with the flattened view by finding the phase automatically.
   */
  const updateVoiceInstructions = (fieldId: string, instructions: string) => {
    updateElement(fieldId, { voiceInstructions: instructions });
  };

  const updateAvatarUrl = (fieldId: string, avatarUrl: string) => {
    updateElement(fieldId, { avatarUrl });
  };

  const updateFileDescription = (index: number, description: string) => {
    const truncatedDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);

    setUploadedFiles((prev) =>
      prev.map((file, i) =>
        i === index ? { ...file, description: truncatedDescription } : file
      )
    );

    // Update description in store
    const file = uploadedFiles[index];
    if (file) {
      const updatedFiles = attachedFiles.map((attachedFile) => {
        return attachedFile.original_filename === file.original_filename
          ? { ...attachedFile, description: truncatedDescription }
          : attachedFile;
      });
      setAttachedFiles(updatedFiles);
    }
  };

  useEffect(() => {
    if (!isAppDetailsEditMode) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsAppDetailsEditMode(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAppDetailsEditMode]);

  // Render Additional App Settings content (moved to sidebar)
  const renderAdditionalAppSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-left">Collections</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
              disabled={isLoadingCollections}
            >
              {isLoadingCollections
                ? "Loading collections..."
                : collectionIds.length === 0
                ? "Select collections"
                : `${collectionIds.length} collection${
                    collectionIds.length === 1 ? "" : "s"
                  } selected`}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] bg-white p-0"
            align="start"
          >
            <div className="max-h-[280px] overflow-y-auto p-2">
              {collections?.length > 0 ? (
                collections.map((collection) => {
                  const isChecked = collectionIds.includes(collection.value);
                  return (
                    <label
                      key={collection.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            addCollection(collection.value);
                          } else {
                            removeCollection(collection.value);
                          }
                        }}
                      />
                      <span className="text-sm">{collection.text}</span>
                    </label>
                  );
                })
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {isLoadingCollections
                    ? "Loading collections..."
                    : "No collections available"}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-left">
          Privacy Settings
        </label>
        <Select value={privacy} onValueChange={(value) => setPrivacy(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select privacy setting" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {privacy === "restricted" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-left">
            Permitted embed domains
          </label>
          <p className="text-xs text-muted-foreground">
            Add website hostnames where this app can be embedded (e.g.
            example.com, blog.mysite.com).
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!appId) return;
              const host = domainInput
                .trim()
                .toLowerCase()
                .replace(/^https?:\/\//, "")
                .split("/")[0]
                .split(":")[0];
              if (!host || host.length < 2 || permittedDomains.includes(host)) {
                setDomainInput("");
                return;
              }
              const next = [...permittedDomains, host];
              setPermittedDomains(next);
              setDomainInput("");
              setDomainsSaving(true);
              try {
                const api = axiosInstance();
                await api.patch(`/api/microapps/${appId}`, {
                  permitted_domains: next,
                });
              } catch {
                setPermittedDomains(permittedDomains);
              } finally {
                setDomainsSaving(false);
              }
            }}
            className="flex gap-2"
          >
            <Input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="example.com"
              disabled={domainsSaving}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={domainsSaving || !domainInput.trim() || !appId}
            >
              {domainsSaving ? "…" : "Add"}
            </Button>
          </form>
          {permittedDomains.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No domains added. The app will show &quot;Not authorized&quot;
              when embedded anywhere until you add at least one domain.
            </p>
          ) : (
            <ul className="space-y-1">
              {permittedDomains.map((domain) => (
                <li
                  key={domain}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-muted/50 group"
                >
                  <span className="text-sm font-mono truncate">{domain}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={domainsSaving || !appId}
                    onClick={async () => {
                      if (!appId) return;
                      const next = permittedDomains.filter((d) => d !== domain);
                      setPermittedDomains(next);
                      setDomainsSaving(true);
                      try {
                        const api = axiosInstance();
                        await api.patch(`/api/microapps/${appId}`, {
                          permitted_domains: next,
                        });
                      } catch {
                        setPermittedDomains(permittedDomains);
                      } finally {
                        setDomainsSaving(false);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="clonable"
          checked={clonable}
          onCheckedChange={(checked) => setClonable(checked as boolean)}
        />
        <label
          htmlFor="clonable"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
            peer-disabled:opacity-70 text-left"
        >
          Allow others to clone this app
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-left">
          Completion Message
        </label>
        <Textarea
          value={completedHtml}
          onChange={(e) => setCompletedHtml(e.target.value)}
          className="mb-4"
          placeholder="Enter your message here"
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-left uppercase text-gray-500">
            Attached Files
          </h3>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <p className="w-[200px] text-sm">
                  Upload files that will be available to users of your app.
                  Supports PDF, PPT, DOC, TXT, CSV, JSON, and MD files.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          {...getRootProps()}
          className={`
            mt-2 border-2 border-dashed rounded-lg p-4 transition-colors duration-150 ease-in-out
            ${
              isDragActive
                ? "border-primary-400 bg-primary-50"
                : isUploading
                ? "border-primary-300 bg-primary-50"
                : "border-gray-300 hover:border-primary-600"
            }
            ${isUploading ? "cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload
              className={`mx-auto h-8 w-8 ${
                isDragActive || isUploading
                  ? "text-primary-400"
                  : "text-gray-400"
              }`}
            />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? "Drop files here"
                : "Drag and drop files here, or click to select files"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              PDF, PPT, DOC, TXT, CSV, JSON, MD
            </p>
            <p className="mt-1 text-xs text-gray-500">Max file size: 20MB</p>
            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            )}
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-700">
                          {file.name}
                        </p>
                        {file.status === "duplicate" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">
                            Duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {file.word_count && ` • ${file.word_count} words`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                {file.status === "duplicate" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-600">
                      A file with this name is already attached. Replace it?
                    </span>
                    <button
                      onClick={() => keepDuplicate(index)}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Replace
                    </button>
                  </div>
                )}
                {(file.status === "pending" ||
                  file.status === "processing" ||
                  file.status === "ready") && (
                  <div className="space-y-1">
                    <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:
                            file.status === "pending"
                              ? "30%"
                              : file.status === "processing"
                              ? "85%"
                              : "100%",
                          backgroundColor:
                            file.status === "ready" ? "#22c55e" : "#3b82f6",
                          transition:
                            file.status === "processing"
                              ? `width ${Math.max(
                                  4,
                                  Math.round(file.size / 6 / 300)
                                )}s linear`
                              : "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs block ${
                        file.status === "ready"
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {file.status === "pending"
                        ? "Queued…"
                        : file.status === "processing"
                        ? "Processing…"
                        : "✓ Ready"}
                    </span>
                  </div>
                )}
                {file.status === "failed" && (
                  <span
                    className="text-xs text-red-600 block"
                    title={file.error ?? ""}
                  >
                    ✕ Failed{file.error ? `: ${file.error}` : ""}
                  </span>
                )}
                <div className="relative">
                  <Input
                    type="text"
                    value={file.description || ""}
                    onChange={(e) =>
                      updateFileDescription(index, e.target.value)
                    }
                    placeholder="Add a description so the AI understands the content of this file better (optional)"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    className="text-sm pr-12"
                  />
                  <div className="absolute right-2 bottom-1 text-xs text-gray-400">
                    {file.description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-left uppercase text-gray-500">
          AI Configuration
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-left">
              System Prompt
            </label>
            <Textarea
              value={aiConfig.systemPrompt}
              onChange={(e) =>
                setAIConfig({ ...aiConfig, systemPrompt: e.target.value })
              }
              placeholder="Enter your prompt here"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">AI Model</label>
            <Select
              value={aiConfig.aiModel}
              onValueChange={(value) =>
                setAIConfig({ ...aiConfig, aiModel: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(availableModels).map((modelName) => (
                  <SelectItem key={modelName} value={modelName}>
                    {modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">Temperature</label>
            <Input
              type="number"
              step="0.01"
              min={
                availableModels[aiConfig.aiModel || defaultAiModel]?.min ?? 0
              }
              max={
                availableModels[aiConfig.aiModel || defaultAiModel]?.max ?? 2
              }
              value={aiConfig.temperature}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  const min = availableModels[aiConfig.aiModel]?.min ?? 0;
                  const max = availableModels[aiConfig.aiModel]?.max ?? 2;
                  setAIConfig({
                    ...aiConfig,
                    temperature: Math.min(
                      max,
                      Math.max(min, Number(value.toFixed(2)))
                    ),
                  });
                }
              }}
              className="w-full text-sm"
              placeholder={`Enter temperature (${
                availableModels[aiConfig.aiModel]?.min ?? 0
              }-${availableModels[aiConfig.aiModel]?.max ?? 2})`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-left">
              Max Response Tokens
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              value={aiConfig.maxResponseTokens || ""}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setAIConfig({ ...aiConfig, maxResponseTokens: value });
              }}
              className="w-full text-sm"
              placeholder="Leave empty for no limit"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <TagFocusProvider isTagFocusActive={isTagFocusActive}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className={`min-h-screen ${
            backgroundTheme === "gray" ? "bg-secondary-grey-100" : "bg-white"
          }`}
        >
          <div className="bg-white sticky top-0 z-40 h-16">
            <div className="flex items-center h-full w-full px-4 relative">
              <div
                className="flex items-center h-full cursor-pointer"
                onClick={() => router.push("/dashboard")}
              >
                <Image
                  src={Logo}
                  alt="Micro AI"
                  width={175}
                  height={56}
                  className="w-[175px] h-[56px] object-contain"
                  priority
                />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 max-w-[min(100vw-10rem,28rem)]">
                <div className="relative flex flex-wrap items-center justify-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handleTabChange("build")}
                    className={tabButtonClass("build")}
                  >
                    Build
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("preview")}
                    className={tabButtonClass("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("share")}
                    className={tabButtonClass("share")}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("stats")}
                    className={tabButtonClass("stats")}
                  >
                    Statistics
                  </button>
                </div>
                <AnimatePresence>
                  {isSavingIndicator && (
                    <motion.span
                      key="saving-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-700 whitespace-nowrap"
                      aria-live="polite"
                    >
                      Saving...
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="text-primary hover:text-primary/80 flex items-center gap-2 text-sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  <span>Back to Home page</span>
                </Button>
              </div>
            </div>
          </div>

          {activeTab === "build" && !sidebarOpen && (
            <div className="flex">
              <AnimatePresence>
                <motion.button
                  key="sidebar-open"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={() => setSidebarOpen(true)}
                  className={`
                  fixed left-6 top-[96px] z-30 flex items-center
                  bg-white p-2 rounded-full shadow-sm hover:bg-gray-100 transition-colors
                  ${
                    !conditionalSidebarOpen
                      ? "xl:bg-white xl:border xl:border-gray-200 xl:rounded-md xl:shadow-sm xl:px-3 xl:py-3 xl:hover:bg-gray-50 xl:gap-2"
                      : ""
                  }
                  `}
                  aria-label="Open sidebar"
                >
                  {!conditionalSidebarOpen && (
                    <span className="hidden xl:inline text-[16px] font-semibold text-black whitespace-nowrap mb-1">
                      App settings
                    </span>
                  )}
                  <PanelLeft className="h-6 w-6 text-gray-400" />
                </motion.button>
              </AnimatePresence>
            </div>
          )}
          {activeTab === "build" && !chatBuildSidebarOpen && (
            <AnimatePresence>
              <motion.button
                key="chat-build-open"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={() => {
                  setChatBuildSidebarOpen(true);
                  setConditionalSidebarOpen(false);
                }}
                className={`
                fixed right-6 top-[96px] z-30 flex items-center gap-2
                bg-white p-2 rounded-full shadow-sm hover:bg-gray-100 transition-colors
                xl:bg-white xl:border xl:border-gray-200 xl:rounded-md xl:shadow-sm xl:px-3 xl:py-3 xl:hover:bg-gray-50
                `}
                aria-label="Open App Builder"
              >
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <span className="hidden xl:inline text-[16px] font-semibold text-black whitespace-nowrap">
                  App Builder
                </span>
                <PanelRight className="h-6 w-6 text-gray-400" />
              </motion.button>
            </AnimatePresence>
          )}
          <div className="flex-1 flex">
            <AnimatePresence>
              {activeTab === "build" && sidebarOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0, x: -12 }}
                  animate={{ width: 360, opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: -12 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-[360px] bg-white sticky top-16 self-start h-screen flex flex-col z-30 overflow-hidden"
                  style={{ minWidth: 0 }}
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-white">
                    <span className="text-base font-medium text-black">
                      App settings
                    </span>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Close sidebar"
                    >
                      <PanelLeftClose className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4 pb-20">
                      {renderAdditionalAppSettings()}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 flex justify-center">
              <div
                className={
                  activeTab === "stats"
                    ? "flex-1 min-w-0 w-full max-w-none px-2 sm:px-4"
                    : "flex-1 min-w-0 w-full max-w-[900px] px-2 sm:px-4"
                }
              >
                {activeTab === "build" && (
                  <div className="pt-8 pb-24">
                    <>
                      {/* This motion.div animates the App Details card when switching between edit and preview modes,
                      as well as when its layout changes.
                      The 'layout' prop enables smooth transitions for position and size changes,
                      and the custom spring transition provides a natural, responsive feel. */}
                      <motion.div
                        ref={cardRef}
                        layout={!isAppDetailsEditMode}
                        initial={false}
                        className={`relative mb-4 rounded-lg bg-white p-5 group transition-shadow duration-200 min-h-[160px]
                        ${
                          isAppDetailsEditMode
                            ? "shadow-soft before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-lg before:bg-gradient-to-b before:from-[#5C5EF1] before:to-[#4CFFD4] before:pointer-events-none"
                            : ""
                        }`}
                        onClick={() => {
                          if (!isAppDetailsEditMode)
                            setIsAppDetailsEditMode(true);
                        }}
                        transition={{
                          duration: 0.3,
                          ease: "easeInOut",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-sm font-medium text-gray-500">
                            App Details
                          </h3>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" sideOffset={5}>
                                <p className="w-[200px] text-sm">
                                  Provide a name and a description for your app
                                  that will be displayed to users.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        <AnimatePresence mode="wait">
                          {isAppDetailsEditMode ? (
                            <motion.div
                              key="edit"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.4,
                                ease: [0.4, 0, 0.2, 1],
                              }}
                            >
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                                className="space-y-4"
                              >
                                <Input
                                  type="text"
                                  value={title}
                                  onFocus={() => {
                                    if (title === "Untitled App") setTitle("");
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setTitle(e.target.value)}
                                  style={{ fontSize: 24 }}
                                  placeholder="Untitled App"
                                />
                                <Textarea
                                  value={description}
                                  onFocus={() => {
                                    if (
                                      description ===
                                      "Tell the user what your app does..."
                                    )
                                      setDescription("");
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    setDescription(e.target.value)
                                  }
                                  placeholder="Tell the user what your app does..."
                                />
                              </motion.div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="preview"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.18 }}
                            >
                              <div className="font-semibold text-2xl mb-2 text-gray-900">
                                {title || "Untitled App"}
                              </div>
                              <div className="text-sm text-gray-600">
                                {description ||
                                  "Here you can write the description about your app"}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <AnimatePresence>
                        {showBlankAppWelcome && (
                          <motion.div
                            key="blank-app-welcome"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="relative mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/[0.04] before:pointer-events-none before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-lg before:bg-gradient-to-b before:from-[#5C5EF1] before:to-[#4CFFD4]"
                          >
                            <button
                              type="button"
                              onClick={handleWelcomeBuildFromScratch}
                              className="absolute right-3 top-3 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                              aria-label="Dismiss and build from scratch"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <div className="flex flex-wrap items-start gap-3 pr-8">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                                <Sparkles
                                  className="h-5 w-5 text-indigo-600"
                                  aria-hidden
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Describe what you want to build
                                </h3>
                                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                                  Your app will automatically be drafted using
                                  the AI, and you can edit it as you like.
                                </p>
                                <label
                                  htmlFor="blank-app-welcome-input"
                                  className="sr-only"
                                >
                                  Describe your app
                                </label>
                                <Textarea
                                  ref={blankWelcomeTextareaRef}
                                  id="blank-app-welcome-input"
                                  value={welcomeIdeaText}
                                  onChange={(e) =>
                                    setWelcomeIdeaText(e.target.value)
                                  }
                                  placeholder="e.g. Build me an MCQ generator…"
                                  className="mt-3 min-h-[100px] resize-y border-gray-200 bg-gray-50/80 text-sm focus-visible:bg-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      (e.metaKey || e.ctrlKey)
                                    ) {
                                      e.preventDefault();
                                      handleWelcomeDescribeSubmit();
                                    }
                                  }}
                                />
                                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                                  Or, choose from a list of starter ideas
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {BLANK_APP_STARTER_PROMPTS.map((prompt) => (
                                    <button
                                      key={prompt}
                                      type="button"
                                      onClick={() =>
                                        handleStarterPromptChip(prompt)
                                      }
                                      className="max-w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium leading-snug text-gray-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 sm:max-w-[calc(50%-0.25rem)]"
                                    >
                                      {prompt}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <Button
                                    type="button"
                                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
                                    disabled={!welcomeIdeaText.trim()}
                                    onClick={handleWelcomeDescribeSubmit}
                                  >
                                    Continue with App Builder
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={handleWelcomeBuildFromScratch}
                                    className="w-full text-center text-sm text-gray-500 underline-offset-4 hover:text-gray-700 hover:underline sm:w-auto sm:text-left"
                                  >
                                    Build from scratch instead
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-col min-h-[calc(100vh-320px)]">
                        <div className="flex-1">
                          <LayoutGroup>
                            <Droppable
                              droppableId="all-elements"
                              type="element"
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`min-h-[200px] transition-colors ${
                                    snapshot.isDraggingOver
                                      ? "bg-primary/5"
                                      : ""
                                  }`}
                                >
                                  {(() => {
                                    const visibleElements = Array.isArray(
                                      elements
                                    )
                                      ? elements
                                      : [];

                                    return visibleElements.map(
                                      (element, index, array) => {
                                        const isLastElement =
                                          index === array.length - 1;

                                        return (
                                          <React.Fragment key={element.id}>
                                            <Draggable
                                              draggableId={element.id}
                                              index={index}
                                            >
                                              {(
                                                providedDraggable,
                                                snapshotDraggable
                                              ) => (
                                                <motion.div
                                                  layout={
                                                    !snapshotDraggable.isDragging
                                                      ? "position"
                                                      : false
                                                  }
                                                  transition={{
                                                    duration: 0.3,
                                                    ease: "easeInOut",
                                                  }}
                                                  initial={false}
                                                  style={{
                                                    ...providedDraggable
                                                      .draggableProps.style,
                                                    ...(snapshotDraggable.isDragging
                                                      ? {}
                                                      : { transform: "none" }),
                                                  }}
                                                  ref={
                                                    providedDraggable.innerRef
                                                  }
                                                  {...providedDraggable.draggableProps}
                                                  className={`${
                                                    snapshotDraggable.isDragging
                                                      ? "opacity-80"
                                                      : ""
                                                  }`}
                                                >
                                                  <Field
                                                    field={element}
                                                    index={index}
                                                    phaseFields={
                                                      visibleElements
                                                    }
                                                    appFields={visibleElements}
                                                    appId={appId}
                                                    dragHandleProps={
                                                      providedDraggable.dragHandleProps
                                                    }
                                                    isActive={
                                                      activeFieldId ===
                                                      element.id
                                                    }
                                                    onActivate={() =>
                                                      setActiveFieldId(
                                                        element.id
                                                      )
                                                    }
                                                    onDeactivate={() =>
                                                      setActiveFieldId(
                                                        undefined
                                                      )
                                                    }
                                                    onUpdateFieldLabel={(
                                                      fieldId,
                                                      newLabel,
                                                      isPrompt
                                                    ) =>
                                                      updateFieldLabel(
                                                        fieldId,
                                                        newLabel,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldName={(
                                                      fieldId,
                                                      newName,
                                                      isPrompt
                                                    ) =>
                                                      updateFieldName(
                                                        fieldId,
                                                        newName,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldType={(
                                                      fieldId,
                                                      newType
                                                    ) =>
                                                      updateFieldType(
                                                        fieldId,
                                                        newType
                                                      )
                                                    }
                                                    onDeleteField={(
                                                      fieldId,
                                                      isPrompt
                                                    ) =>
                                                      deleteField(
                                                        fieldId,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldDescription={(
                                                      fieldId,
                                                      description,
                                                      isPrompt
                                                    ) =>
                                                      updateFieldDescription(
                                                        fieldId,
                                                        description,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldRequired={(
                                                      fieldId,
                                                      required,
                                                      isPrompt
                                                    ) =>
                                                      updateFieldRequired(
                                                        fieldId,
                                                        required,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldValidation={(
                                                      fieldId,
                                                      minChars,
                                                      maxChars,
                                                      isPrompt
                                                    ) =>
                                                      updateFieldValidation(
                                                        fieldId,
                                                        minChars,
                                                        maxChars,
                                                        isPrompt
                                                      )
                                                    }
                                                    onUpdateFieldDefaultValue={(
                                                      fieldId,
                                                      defaultValue
                                                    ) =>
                                                      updateFieldDefaultValue(
                                                        fieldId,
                                                        defaultValue
                                                      )
                                                    }
                                                    onUpdateFieldPlaceholder={(
                                                      fieldId,
                                                      placeholder
                                                    ) =>
                                                      updateFieldPlaceholder(
                                                        fieldId,
                                                        placeholder
                                                      )
                                                    }
                                                    onUpdateFieldChoices={(
                                                      fieldId,
                                                      choices
                                                    ) =>
                                                      updateFieldChoices(
                                                        fieldId,
                                                        choices
                                                      )
                                                    }
                                                    onUpdateFieldShowOther={(
                                                      fieldId,
                                                      showOther
                                                    ) =>
                                                      updateFieldShowOther(
                                                        fieldId,
                                                        showOther
                                                      )
                                                    }
                                                    onUpdateFieldSliderProps={(
                                                      fieldId,
                                                      updates
                                                    ) =>
                                                      updateFieldSliderProps(
                                                        fieldId,
                                                        updates
                                                      )
                                                    }
                                                    onUpdateFieldSliderValue={(
                                                      fieldId,
                                                      value
                                                    ) =>
                                                      updateFieldSliderValue(
                                                        fieldId,
                                                        value
                                                      )
                                                    }
                                                    onUpdatePromptText={(
                                                      fieldId,
                                                      text
                                                    ) =>
                                                      updateFieldText(
                                                        fieldId,
                                                        text,
                                                        true
                                                      )
                                                    }
                                                    onUpdateRichText={(
                                                      fieldId,
                                                      html
                                                    ) =>
                                                      updateFieldRichText(
                                                        fieldId,
                                                        html,
                                                        false
                                                      )
                                                    }
                                                    onUpdateConditionalLogic={(
                                                      fieldId,
                                                      logic
                                                    ) =>
                                                      handleUpdateConditionalLogic(
                                                        fieldId,
                                                        logic,
                                                        false
                                                      )
                                                    }
                                                    onUpdateAiResponseInstructions={(
                                                      fieldId,
                                                      instructions
                                                    ) =>
                                                      updateElement(fieldId, {
                                                        instructions,
                                                      })
                                                    }
                                                    onUpdateScoringSettings={(
                                                      fieldId,
                                                      updates
                                                    ) =>
                                                      updateElement(
                                                        fieldId,
                                                        updates
                                                      )
                                                    }
                                                    onUpdateImageUploadSettings={(
                                                      fieldId,
                                                      settings
                                                    ) =>
                                                      updateImageUploadSettings(
                                                        fieldId,
                                                        settings
                                                      )
                                                    }
                                                    onUpdateFieldMaxMessages={(
                                                      fieldId,
                                                      maxMessages
                                                    ) =>
                                                      updateFieldMaxMessages(
                                                        fieldId,
                                                        maxMessages
                                                      )
                                                    }
                                                    onUpdateFieldInitialMessage={(
                                                      fieldId,
                                                      initialMessage
                                                    ) =>
                                                      updateFieldInitialMessage(
                                                        fieldId,
                                                        initialMessage
                                                      )
                                                    }
                                                    onUpdateChatbotInstructions={(
                                                      fieldId,
                                                      instructions
                                                    ) =>
                                                      updateChatbotInstructions(
                                                        fieldId,
                                                        instructions
                                                      )
                                                    }
                                                    onUpdateTtsProvider={(
                                                      fieldId,
                                                      provider
                                                    ) =>
                                                      updateTtsProvider(
                                                        fieldId,
                                                        provider
                                                      )
                                                    }
                                                    onUpdateTtsVoiceId={(
                                                      fieldId,
                                                      voiceId
                                                    ) =>
                                                      updateTtsVoiceId(
                                                        fieldId,
                                                        voiceId
                                                      )
                                                    }
                                                    onUpdateTtsEnabled={(
                                                      fieldId,
                                                      enabled
                                                    ) =>
                                                      updateTtsEnabled(
                                                        fieldId,
                                                        enabled
                                                      )
                                                    }
                                                    onUpdateVoiceInstructions={(
                                                      fieldId,
                                                      instructions
                                                    ) =>
                                                      updateVoiceInstructions(
                                                        fieldId,
                                                        instructions
                                                      )
                                                    }
                                                    onUpdateAvatarUrl={(
                                                      fieldId,
                                                      avatarUrl
                                                    ) =>
                                                      updateAvatarUrl(
                                                        fieldId,
                                                        avatarUrl
                                                      )
                                                    }
                                                    isDragging={
                                                      snapshotDraggable.isDragging
                                                    }
                                                    appHashId={hashId}
                                                  />
                                                </motion.div>
                                              )}
                                            </Draggable>

                                            {/* Plus button between cards on its own line with always-visible silver line */}
                                            {!isLastElement && (
                                              <div className="relative flex items-center justify-center h-4 my-1 w-full group">
                                                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-300 transition-opacity duration-200 opacity-0 group-hover:opacity-100" />{" "}
                                                <button
                                                  className="absolute left-0 w-full h-4 bg-transparent border-none outline-none cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  tabIndex={-1}
                                                  aria-label="Add section"
                                                  onClick={(e) => {
                                                    setPopoverPosition({
                                                      x: e.clientX,
                                                      y: e.clientY - 400,
                                                    });
                                                    setAddSectionOpenFor(
                                                      `between-${element.id}`
                                                    );
                                                    setInsertAfterIndex(index);
                                                  }}
                                                  type="button"
                                                />
                                                <AddSectionPopover
                                                  open={
                                                    addSectionOpenFor ===
                                                    `between-${element.id}`
                                                  }
                                                  onOpenChange={(open) => {
                                                    setAddSectionOpenFor(
                                                      open
                                                        ? `between-${element.id}`
                                                        : null
                                                    );
                                                    if (!open) {
                                                      setInsertAfterIndex(null);
                                                    }
                                                  }}
                                                  trigger={
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="absolute top-1/2 -translate-y-1/2 -left-5 h-6 w-6 rounded-full p-0 bg-gray-100 border-2 border-gray-300 hover:border-gray-400 hover:bg-primary/5 z-10 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                                      onClick={() => {
                                                        setInsertAfterIndex(
                                                          index
                                                        );
                                                      }}
                                                    >
                                                      <Plus className="h-3 w-3" />
                                                    </Button>
                                                  }
                                                  sections={AVAILABLE_SECTIONS}
                                                  onSelect={(sectionId) => {
                                                    addElementToApp(
                                                      sectionId,
                                                      insertAfterIndex
                                                    );
                                                    setAddSectionOpenFor(null);
                                                  }}
                                                  contentAlign="center"
                                                  contentSide="bottom"
                                                  contentStyle={
                                                    popoverPosition
                                                      ? {
                                                          position: "fixed",
                                                          left: popoverPosition.x,
                                                        }
                                                      : undefined
                                                  }
                                                />
                                              </div>
                                            )}
                                          </React.Fragment>
                                        );
                                      }
                                    );
                                  })()}
                                  {provided.placeholder}
                                  {!showBlankAppWelcome && (
                                    <>
                                      {/* Add Section button at the end */}
                                      <div className="mt-4 flex justify-start">
                                        <AddSectionPopover
                                          open={
                                            addSectionOpenFor === "end-button"
                                          }
                                          onOpenChange={(open) => {
                                            setAddSectionOpenFor(
                                              open ? "end-button" : null
                                            );
                                            if (!open) {
                                              setInsertAfterIndex(null);
                                            }
                                          }}
                                          trigger={
                                            <Button
                                              variant="default"
                                              size="lg"
                                              className="bg-primary text-primary-foreground hover:bg-primary-600"
                                              onClick={() =>
                                                setInsertAfterIndex(null)
                                              }
                                            >
                                              <Plus className="h-5 w-5 mr-2" />
                                              Add Section
                                            </Button>
                                          }
                                          sections={AVAILABLE_SECTIONS}
                                          onSelect={(sectionId) => {
                                            addElementToApp(
                                              sectionId,
                                              insertAfterIndex
                                            );
                                            setAddSectionOpenFor(null);
                                          }}
                                          contentAlign="start"
                                          contentSide="bottom"
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </Droppable>
                          </LayoutGroup>
                        </div>
                        <div className="mt-8">
                          <Collapsible
                            open={isOpen}
                            onOpenChange={setIsOpen}
                            className="!mt-8"
                          >
                            <Card>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full flex items-center justify-between p-4"
                                >
                                  <span className="text-lg font-semibold">
                                    JSON Preview
                                  </span>
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                      isOpen ? "transform rotate-180" : ""
                                    }`}
                                  />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-4 border-t">
                                  <JsonPreview
                                    elements={
                                      Array.isArray(elements) ? elements : []
                                    }
                                    title={title || ""}
                                    description={description || ""}
                                    collections={collectionIds}
                                    privacySettings={privacy}
                                    clonable={clonable}
                                    completedHtml={completedHtml}
                                    attachedFiles={attachedFiles}
                                    aiConfig={aiConfig}
                                  />
                                </div>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        </div>
                      </div>
                    </>
                  </div>
                )}
                {activeTab === "preview" && (
                  <MonitorPreview
                    previewUrl={`${window.location.origin}/app/${hashId}`}
                  >
                    <AppRuntimeView hashId={hashId} showEditLink={false} />
                  </MonitorPreview>
                )}
                {activeTab === "share" && shareAppForModal && (
                  <div className="pt-8 pb-24 w-full min-w-0">
                    <ShareModal
                      app={shareAppForModal}
                      showModal={true}
                      setShowModal={handleShareModalVisibility}
                      isOwner={editorIsOwner}
                      variant="inline"
                      onPrivacySaved={handlePrivacySavedFromShare}
                      onPermittedDomainsSaved={
                        handlePermittedDomainsSavedFromShare
                      }
                    />
                  </div>
                )}
                {activeTab === "stats" && (
                  <MicroappStatsContent hashId={hashId} />
                )}
              </div>
            </div>
            <ConditionalLogicSidebar
              isOpen={conditionalSidebarOpen}
              onClose={() => setConditionalSidebarOpen(false)}
              onSave={handleSaveConditionalLogic}
              onClear={handleClearConditionalLogic}
              availableFields={Array.isArray(elements) ? elements : []}
              currentLogic={conditionalSidebarContext?.currentLogic}
              targetFieldName={conditionalSidebarContext?.field.name}
              instructionIndex={conditionalSidebarContext?.instructionIndex}
            />
            <ChatBuildSidebar
              ref={chatBuildRef}
              isOpen={chatBuildSidebarOpen}
              onClose={() => setChatBuildSidebarOpen(false)}
              appId={appId}
            />
          </div>
        </div>
      </DragDropContext>
    </TagFocusProvider>
  );
}
