"use client";

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Plus, Trash2, ChevronDown, Upload, X, FileText } from 'lucide-react';
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import FieldPalette from './FieldPalette';
import Phase from './Phase';
import JsonPreview from './JsonPreview';
import { Checkbox } from "./ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Input } from "./ui/input";
import { useSurveyStore } from '../store/editSurveyStore';
import { PhaseType, Element, Choice, ConditionalLogic } from '@/app/(authenticated)/app/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { createFileUploader } from "@/utils/imageUpload";

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt', '.log'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/tiff': ['.tiff'],
  'image/bmp': ['.bmp']
};

//TO-DO: Just use the backend max file size
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size

const MAX_DESCRIPTION_LENGTH = 200;

interface UploadedFile {
  name: string;
  url?: string;
  size: number;
  word_count?: number;
  original_filename: string;
  text_filename: string;
  description?: string;
}

export default function FormBuilder() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const {
    phases,
    privacy,
    clonable,
    completedHtml,
    collectionId,
    description,
    title,
    collections,
    availableModels,
    isLoadingCollections,
    aiConfig,
    attachedFiles,
    setPhases,
    setTitle,
    setDescription,
    setCollectionId,
    setPrivacy,
    setClonable,
    setCompletedHtml,
    setAIConfig,
    addAttachedFile,
    removeAttachedFile,
    fetchCollections,
    fetchModels,
    appId,
    setAttachedFiles,
  } = useSurveyStore();

  const fileUploader = createFileUploader(appId?.toString() || '');

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const result = await fileUploader.uploadFile(file);

      console.log('File upload result:', result);
      
      // Extract filename from original_file path
      const original_filename = result.original_file?.split('/').pop();
      const text_filename = result.text_file?.split('/').pop();
      if (!original_filename || !text_filename) {
        throw new Error('No filename returned from upload');
      }

      const fileData = {
        original_filename,
        text_filename,
        size: file.size,
        word_count: result.word_count,
      };

      setUploadedFiles(prev => [...prev, {
        name: file.name,
        url: result.url,
        original_filename,
        text_filename,
        size: file.size,
        word_count: result.word_count
      }]);

      await addAttachedFile(fileData);

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [fileUploader, addAttachedFile]);

  const removeFile = useCallback(async (index: number) => {
    const file = uploadedFiles[index];
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    if (!file.original_filename) {
      throw new Error('No filename found for file');
    }
    await removeAttachedFile(file.original_filename);
  }, [uploadedFiles, removeAttachedFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach(file => handleFileUpload(file));
    },
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading
  });

  // Initialize phases with default phase if phases is empty
  useEffect(() => {
    // Set default AI config values if not present
    if (!aiConfig.aiModel) {
      setAIConfig({
        ...aiConfig,
        aiModel: 'gpt-4o-mini'
      });
    }
    if (!aiConfig.temperature) {
      setAIConfig({
        ...aiConfig,
        temperature: 0.7
      });
    }
  }, [phases, aiConfig, setPhases, setAIConfig]);

  // Initialize uploadedFiles from attachedFiles
  useEffect(() => {
    if (attachedFiles && attachedFiles.length > 0) {
      const files = attachedFiles
        .filter(file => file && file.original_filename)
        .map(file => ({
          name: file.original_filename.split('_')[0],
          original_filename: file.original_filename,
          text_filename: file.text_filename,
          url: `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${file.original_filename}`,
          size: file.size,
          word_count: file.word_count,
          description: file.description
        }));
      setUploadedFiles(files);
    } else {
      setUploadedFiles([]);
    }
  }, [attachedFiles]);

  // Add initial render debug log
  useEffect(() => {
    console.log('FormBuilder initial render:', {
      attachedFiles,
      uploadedFiles,
      appId
    });
  }, []);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  //Load models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  /**
   * Handles the completion of a drag-and-drop operation within the form builder.
   * 
   * @param result - The result object from react-beautiful-dnd containing source and destination information
   * 
   * This method is the core of the form builder's drag-and-drop functionality, enabling:
   * 1. Adding new fields from the palette to a specific phase
   * 2. Reordering fields within the same phase
   * 3. Moving fields between different phases
   * 
   * It maintains the integrity of the form structure while providing an intuitive
   * interface for users to build and organize their forms without writing code.
   */
  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const [sourceType, sourcePhaseId] = source.droppableId.split('-');
    const [destType, destPhaseId] = destination.droppableId.split('-');

    // Handle dropping from palette
    if (sourceType === 'palette') {
      const existingFieldsCount = phases.reduce((count: number, phase: PhaseType) => {
        const elementCount = phase.elements?.filter(f => f.type === draggableId).length ?? 0;
        const promptCount = phase.prompts?.filter(f => f.type === draggableId).length ?? 0;
        return count + elementCount + promptCount;
      }, 0);

      const newField = {
        id: `${draggableId}-${Date.now()}`,
        type: draggableId as Element['type'],
        label: '',
        name: `${draggableId}${existingFieldsCount + 1}`,
        isRequired: false,
        // Add default values for image upload fields
        ...(draggableId === 'imageUpload' && {
          multiple: false,
          maxFiles: 1,
          maxFileSize: 5,
          allowedFileTypes: ['image/jpeg', 'image/png'],
        }),
        // Add default values for chat fields
        ...(draggableId === 'chat' && {
          maxMessages: 10,
          initialMessage: 'Hello! How can I help you today?',
          enableTts: false,
          ttsProvider: 'elevenlabs',
          selectedVoiceId: '',
          voiceInstructions: '',
          avatarUrl: '',
        }),
      };

      const updatedPhases = phases.map((phase: PhaseType) => {
        if (Number(phase.id) === Number(destPhaseId)) {
          if (destType === 'fields') {
            const elements = [...(phase.elements || [])];
            elements.splice(destination.index, 0, newField);
            return {
              ...phase,
              elements
            };
          } else {
            const prompts = [...(phase.prompts || [])];
            prompts.splice(destination.index, 0, newField);
            return {
              ...phase,
              prompts
            };
          }
        }
        return phase;
      });
      
      setPhases(updatedPhases);

    }

    // Handle reordering within the same list
    if (source.droppableId === destination.droppableId) {
      
      const updatedPhases = phases.map((phase: PhaseType) => {
        if (Number(phase.id) === Number(sourcePhaseId)) {
          const items = sourceType === 'fields' ? [...phase.elements] : [...phase.prompts];
          const [removed] = items.splice(source.index, 1);
          items.splice(destination.index, 0, removed);
          return {
            ...phase,
            [sourceType === 'fields' ? 'elements' : 'prompts']: items
          };
        }
        return phase;
      });
      
      setPhases(updatedPhases);
    }
  };

  /**
   * Adds a new phase to the form builder.
   * 
   * This method is crucial for creating multi-step forms and surveys, allowing
   * users to organize their content into logical sections. Each phase represents
   * a distinct step in the user journey, with its own set of fields and prompts.
   * 
   * The method automatically assigns an incremental ID and default title to maintain
   * consistency and provide a good starting point for customization.
   */
  const addPhase = () => {
    const newPhaseNumber = (phases?.length || 0) + 1;
    setPhases([...(phases || []), { 
      id: String(newPhaseNumber), 
      name: `phase${newPhaseNumber}`,
      title: `Phase ${newPhaseNumber}`, 
      description: '', 
      elements: [], 
      prompts: [],
      skipPhase: false,
      scoredPhase: false,
      rubric: '',
      minScore: 0
    }]);
    
  };

  /**
   * Removes a phase from the form builder.
   * 
   * @param phaseId - The ID of the phase to remove
   * 
   * This method enables users to delete unwanted phases, helping to streamline
   * the form structure. It's essential for maintaining a clean and focused user
   * experience by removing unnecessary steps in the form flow.
   */
  const removePhase = (phaseId: string) => {
    setPhases(phases.filter((phase: PhaseType) => phase.id !== phaseId));
  };

  /**
   * Updates the title of a specific phase.
   * 
   * @param phaseId - The ID of the phase to update
   * @param newTitle - The new title for the phase
   * 
   * Clear and descriptive phase titles are essential for both form creators and
   * end-users to understand the purpose of each section. This method allows
   * customization of phase names to better reflect their content and function
   * within the overall form flow.
   */
  const updatePhaseName = (phaseId: string, newTitle: string) => {
    const updatedPhases = phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return { ...phase, title: newTitle };
      }
      return phase;
    });
    setPhases(updatedPhases); 
  };

  /**
   * Updates the label of a field within a specific phase.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param newLabel - The new label for the field
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Field labels are critical for user experience as they provide context and instructions
   * to form users. This method allows form creators to customize these labels to improve
   * clarity and guide users through the form completion process effectively.
   */
  const updateFieldLabel = (phaseId: string, fieldId: string, newLabel: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.map(field => 
          field.id === fieldId ? { ...field, label: newLabel } : field
        );
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the internal name/identifier of a field.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param newName - The new internal name for the field
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Field names serve as unique identifiers for data processing and API interactions.
   * This method ensures that each field has a proper identifier for data collection,
   * validation, and submission, which is essential for accurate data handling and
   * integration with backend systems.
   */
  const updateFieldName = (phaseId: string, fieldId: string, newName: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.map(field => 
          field.id === fieldId ? { ...field, name: newName } : field
        );
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Sets whether a field is required for form submission.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param isRequired - Whether the field is required (true) or optional (false)
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Required fields ensure that users provide necessary information before proceeding.
   * This method helps form creators enforce data completeness and quality by preventing
   * submissions with missing critical information, improving the overall reliability
   * of collected data.
   */
  const updateFieldRequired = (phaseId: string, fieldId: string, isRequired: boolean, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.map(field => 
          field.id === fieldId ? { ...field, isRequired } : field
        );
        return {
          ...phase,
          // Right now, we only allow elements to be required. 
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Removes a field from a specific phase.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to remove
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * This method allows form creators to remove unnecessary or redundant fields,
   * helping to streamline the form and improve user experience. It's essential for
   * maintaining a clean, focused interface that collects only relevant information
   * and reduces user friction.
   */
  const deleteField = (phaseId: string, fieldId: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.filter(field => field.id !== fieldId);
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the description of a field within a specific phase.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param description - The new description for the field
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Field descriptions provide additional context and guidance beyond the label,
   * helping users understand exactly what information is being requested and why.
   * This method enables form creators to add detailed instructions, examples, or
   * explanations that improve form clarity and completion accuracy.
   */
  const updateFieldDescription = (phaseId: string, fieldId: string, description: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.map(field => 
          field.id === fieldId ? { ...field, description } : field
        );
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Sets character count validation rules for text-based fields.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param minChars - The minimum number of characters required (null for no minimum)
   * @param maxChars - The maximum number of characters allowed (null for no maximum)
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Input validation is crucial for ensuring data quality and guiding users to provide
   * appropriate responses. This method allows form creators to set character limits
   * that enforce response length requirements, which is particularly important for
   * text fields where response size may impact data processing or storage.
   */
  const updateFieldValidation = (
    phaseId: string, 
    fieldId: string, 
    minChars: number | null, 
    maxChars: number | null, 
    isPrompt: boolean = false
  ) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        const arrayToUpdate = isPrompt ? phase.prompts : phase.elements;
        const updatedArray = arrayToUpdate.map(field => 
          field.id === fieldId ? { 
            ...field, 
            minChars: minChars ?? undefined,
            maxChars: maxChars ?? undefined
          } : field
        );
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: updatedArray
        };
      }
      return phase;
    }));
  };

  /**
   * Updates multiple properties of a phase at once.
   * 
   * @param phaseId - The ID of the phase to update
   * @param updates - An object containing the properties to update and their new values
   * 
   * This method provides a flexible way to modify multiple phase properties in a single
   * operation, improving code efficiency and reducing state updates. It's particularly
   * useful for complex phase configurations like scoring settings, skip logic, or when
   * updating related properties that should change together.
   */
  const updatePhase = (phaseId: string, updates: Partial<PhaseType>) => {
    setPhases(phases.map((phase: PhaseType) => 
      phase.id === phaseId 
        ? { ...phase, ...updates }
        : phase
    ));
  };

  /**
   * Sets the default value for a field.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param value - The default value to set (can be string, array, number, or boolean)
   * 
   * Default values improve user experience by pre-populating fields with common or
   * expected responses. This method allows form creators to set initial values that
   * can speed up form completion, demonstrate the expected input format, or reflect
   * the most common response, reducing user effort and potential errors.
   */
  const updateFieldDefaultValue = (
    phaseId: string, 
    fieldId: string, 
    value: string | string[] | number | boolean
  ) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map(field =>
            field.id === fieldId ? { ...field, defaultValue: value } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Sets the placeholder text for a field.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param placeholder - The placeholder text to display
   * 
   * Placeholders provide subtle guidance to users about the expected input format
   * or content without taking up additional space. This method enables form creators
   * to add helpful examples or formatting hints that appear when the field is empty,
   * improving form usability and reducing input errors.
   */
  const updateFieldPlaceholder = (phaseId: string, fieldId: string, placeholder: string) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, placeholder } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the available choices for selection-type fields (radio, checkbox, dropdown).
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param choices - Array of choice objects with value and text properties
   * 
   * Selection fields require a predefined set of options for users to choose from.
   * This method allows form creators to define, modify, or expand these options,
   * which is essential for creating structured data collection with consistent
   * response categories that can be easily analyzed and processed.
   */
  const updateFieldChoices = (phaseId: string, fieldId: string, choices: Choice[]) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, choices } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Toggles the "Other" option for selection-type fields.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param showOther - Whether to show an "Other" option (true) or not (false)
   * 
   * The "Other" option is crucial for capturing responses that don't fit predefined
   * categories, preventing data loss and ensuring comprehensive feedback collection.
   * This method allows form creators to enable this option when they want to collect
   * unexpected or unique responses that weren't anticipated in the choice list.
   */
  const updateFieldShowOther = (phaseId: string, fieldId: string, showOther: boolean) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, showOtherItem: showOther } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the configuration properties of a slider field.
   * 
   * @param phaseId - The ID of the phase containing the slider field
   * @param fieldId - The ID of the slider field to update
   * @param updates - Object containing slider properties to update (min, max, step values)
   * 
   * Slider fields require specific configuration to define their range and granularity.
   * This method allows form creators to customize these parameters to match the specific
   * measurement needs of their form, ensuring that users can provide precise numeric
   * responses within appropriate boundaries.
   */
  const updateFieldSliderProps = (
    phaseId: string, 
    fieldId: string, 
    updates: {
      minValue?: number;
      maxValue?: number;
      step?: number;
    }
  ) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, ...updates } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Sets the default value for a slider field.
   * 
   * @param phaseId - The ID of the phase containing the slider field
   * @param fieldId - The ID of the slider field to update
   * @param value - The numeric value to set as default
   * 
   * Setting an appropriate default value for sliders helps users understand the
   * expected range and provides a starting point for their response. This method
   * allows form creators to position the slider at a meaningful initial position,
   * which can represent a neutral point, average value, or recommended setting.
   */
  const updateFieldSliderValue = (phaseId: string, fieldId: string, value: number) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, defaultValue: value } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the text content of a text-based field across all phases.
   * 
   * @param fieldId - The ID of the field to update
   * @param text - The new text content
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * This method is essential for updating static text elements and prompts that provide
   * instructions, context, or explanatory content to users. Unlike other field updates
   * that target a specific phase, this method searches across all phases to find and
   * update the field, ensuring consistent text content throughout the form.
   */
  const updateFieldText = (fieldId: string, text: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      // Only update fields in phases that contain the field with the matching ID
      const fieldExists = phase[isPrompt ? 'prompts' : 'elements'].some((field: Element) => field.id === fieldId);
      
      if (fieldExists) {
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: phase[isPrompt ? 'prompts' : 'elements'].map((field: Element) =>
            field.id === fieldId ? { ...field, text } : field
          )
        };
      }
      
      return phase;
    }));
  };

  /**
   * Updates the HTML content of a rich text field across all phases.
   * 
   * @param fieldId - The ID of the field to update
   * @param html - The new HTML content
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Rich text fields enable advanced formatting, embedded media, and complex layouts
   * that enhance the visual presentation and clarity of form content. This method
   * allows form creators to update formatted content across all phases, ensuring
   * consistent styling and presentation throughout the user experience.
   */
  const updateFieldRichText = (fieldId: string, html: string, isPrompt: boolean = false) => {
    setPhases(phases.map((phase: PhaseType) => {
      // Only update fields in phases that contain the field with the matching ID
      const fieldExists = phase[isPrompt ? 'prompts' : 'elements'].some((field: Element) => field.id === fieldId);
      
      if (fieldExists) {
        return {
          ...phase,
          [isPrompt ? 'prompts' : 'elements']: phase[isPrompt ? 'prompts' : 'elements'].map((field: Element) =>
            field.id === fieldId ? { ...field, html } : field
          ),
        };
      }
      
      return phase;
    }));
  };

  /**
   * Updates the conditional display logic for a field.
   * 
   * @param phaseId - The ID of the phase containing the field
   * @param fieldId - The ID of the field to update
   * @param logic - The conditional logic configuration or null to remove conditions
   * @param isPrompt - Whether the field is a prompt (true) or an element (false)
   * 
   * Conditional logic enables dynamic form behavior by showing or hiding fields based
   * on user responses to other fields. This method allows form creators to implement
   * complex branching logic that creates personalized form experiences, reduces form
   * complexity, and ensures users only see relevant questions.
   */
  const handleUpdateConditionalLogic = (phaseId: string, fieldId: string, logic: ConditionalLogic | null, isPrompt: boolean) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id !== phaseId) return phase;

      const collection = isPrompt ? 'prompts' : 'elements';
      const items = phase[collection].map((item: Element) => {
        if (item.id !== fieldId) return item;
        return {
          ...item,
          conditionalLogic: logic || undefined
        };
      });

      return {
        ...phase,
        [collection]: items
      };
    }));
  };

  /**
   * Updates the configuration for image upload fields.
   * 
   * @param phaseId - The ID of the phase containing the image upload field
   * @param fieldId - The ID of the image upload field to update
   * @param settings - Object containing image upload settings (multiple, maxFiles, maxFileSize, allowedFileTypes)
   * 
   * Image upload fields require specific configuration to control what users can upload.
   * This method allows form creators to define file type restrictions, size limits, and
   * quantity constraints that ensure uploaded images meet technical requirements and
   * prevent abuse or excessive resource consumption.
   */
  const updateImageUploadSettings = (
    phaseId: string, 
    fieldId: string, 
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    }
  ) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field) => {
            if (field.id === fieldId) {
              return {
                ...field,
                ...settings,
              };
            }
            return field;
          }),
        };
      }
      return phase;
    }));
  };

  /**
   * Sets the maximum number of messages allowed in a chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param maxMessages - The maximum number of messages allowed
   * 
   * Chat fields need limits to prevent excessive resource usage and maintain performance.
   * This method allows form creators to set appropriate boundaries for conversation length,
   * ensuring the chat interaction remains focused and efficient while preventing potential
   * abuse or system overload from unlimited exchanges.
   */
  const updateFieldMaxMessages = (phaseId: string, fieldId: string, maxMessages: number) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, maxMessages } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Sets the initial message displayed in a chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param initialMessage - The message to display at the start of the chat
   * 
   * The initial message sets the tone and direction for chat interactions, providing
   * context and guidance to users. This method allows form creators to customize the
   * opening message to establish the purpose of the chat, set expectations, or provide
   * specific instructions that help users engage effectively with the chat interface.
   */
  const updateFieldInitialMessage = (phaseId: string, fieldId: string, initialMessage: string) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, initialMessage } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the chatbot instructions for a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param instructions - The new instructions for the chatbot
   * 
   * This method is essential for configuring the AI behavior in chat components,
   * allowing survey creators to define how the chatbot should respond to users.
   * The instructions provide context and guidance to the AI model, ensuring
   * it delivers appropriate and relevant responses within the chat interface.
   */
  const updateChatbotInstructions = (phaseId: string, fieldId: string, instructions: string) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, chatbotInstructions: instructions } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the TTS provider setting for a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param provider - The TTS provider to use (currently 'elevenlabs')
   * 
   * This method allows form creators to choose between different TTS providers
   * for audio synthesis in chat interactions, enabling customization of voice
   * quality and characteristics based on the specific needs of the chat interface.
   */
  const updateTtsProvider = (phaseId: string, fieldId: string, provider: string) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, ttsProvider: provider } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the selected voice ID for ElevenLabs TTS in a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param voiceId - The ElevenLabs voice ID to use for audio synthesis
   * 
   * This method enables form creators to select specific voices when using
   * ElevenLabs as the TTS provider, allowing for customization of the audio
   * characteristics and personality of the chatbot's spoken responses.
   */
  const updateTtsVoiceId = (phaseId: string, fieldId: string, voiceId: string) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { 
              ...field, 
              selectedVoiceId: voiceId,
              ttsProvider: voiceId === 'custom' ? 'hume' : 'elevenlabs'  // Set both values in one update
            } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the custom voice ID for generated custom voices in a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param voiceId - The generated custom voice ID to use for audio synthesis
   * 
   * This method stores the ID of the generated custom voice when using the
   * "Design your own Voice" option, allowing the system to use the correct
   * voice ID for audio synthesis while maintaining the 'custom' selection state.
   */
  const updateCustomVoiceId = (phaseId: string, fieldId: string, voiceId: string) => {
    console.log("Updating custom voice ID:", { phaseId, fieldId, voiceId });
    console.log("VoiceId type:", typeof voiceId);
    console.log("VoiceId length:", voiceId.length);
    console.log("Current phases:", phases);
    
    if (typeof voiceId !== 'string') {
      console.error("Invalid voiceId type:", typeof voiceId);
      return;
    }
    
    setPhases(phases.map((phase: PhaseType) => {
      console.log("Checking phase:", { phaseId: phase.id, hasField: phase.elements.some(e => e.id === fieldId) });
      if (phase.id === phaseId) {
        const updatedPhase = {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { 
              ...field, 
              customVoiceId: voiceId,
              ttsProvider: 'hume'  // Set both values in one update
            } : field
          )
        };
        console.log("Updated phase:", updatedPhase);
        console.log("Updated field:", updatedPhase.elements.find(e => e.id === fieldId));
        return updatedPhase;
      }
      return phase;
    }));
  };

  /**
   * Toggles TTS functionality for a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param enabled - Whether TTS should be enabled (true) or disabled (false)
   * 
   * This method allows form creators to enable or disable text-to-speech
   * functionality for chat interactions, providing control over whether
   * AI responses should be converted to audio or remain text-only.
   */
  const updateTtsEnabled = (phaseId: string, fieldId: string, enabled: boolean) => {
    setPhases(phases.map((phase: PhaseType) => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map((field: Element) =>
            field.id === fieldId ? { ...field, enableTts: enabled } : field
          )
        };
      }
      return phase;
    }));
  };

  /**
   * Updates the voice instructions for custom voice design in a specific chat field.
   * 
   * @param phaseId - The ID of the phase containing the chat field
   * @param fieldId - The ID of the chat field to update
   * @param instructions - The voice characteristic instructions for AI voice generation
   * 
   * This method allows form creators to specify custom voice characteristics when
   * using the "Design your own Voice" option, enabling personalized voice synthesis
   * based on detailed descriptions of desired vocal properties.
   */
  const updateVoiceInstructions = (phaseId: string, fieldId: string, instructions: string) => {
    setPhases(phases.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map(field => {
            if (field.id === fieldId) {
              return {
                ...field,
                voiceInstructions: instructions
              };
            }
            return field;
          })
        };
      }
      return phase;
    }));
  };

  const updateAvatarUrl = (phaseId: string, fieldId: string, avatarUrl: string) => {
    setPhases(phases.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          elements: phase.elements.map(field => {
            if (field.id === fieldId) {
              return {
                ...field,
                avatarUrl
              };
            }
            return field;
          })
        };
      }
      return phase;
    }));
  };

  const updateFileDescription = (index: number, description: string) => {
    const truncatedDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);
    console.log('Updating description:', { index, description: truncatedDescription });
    
    setUploadedFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, description: truncatedDescription } : file
    ));

    // Update description in store
    const file = uploadedFiles[index];
    if (file) {
      console.log('File to update:', file);
      const updatedFiles = attachedFiles.map(attachedFile => {
        console.log('Comparing:', {
          attached: attachedFile.original_filename,
          current: file.original_filename
        });
        return attachedFile.original_filename === file.original_filename
          ? { ...attachedFile, description: truncatedDescription }
          : attachedFile;
      });
      console.log('Updated files:', updatedFiles);
      setAttachedFiles(updatedFiles);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium text-gray-500">App Details</h3>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  <p className="w-[200px] text-sm">
                    Provide a name and a description for your app that will be displayed to users.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="space-y-6 mb-8">
          <input
            type="text"
            value={title}
            onFocus={() => {
              if (title === "Untitled App") setTitle("");
            }}
            onChange={(e) => setTitle(e.target.value)}
            className="text-3xl font-bold bg-transparent 
              border-2 border-dashed border-gray-200 hover:border-gray-400 
              focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary/20 w-full cursor-text
              placeholder:text-gray-400"
            placeholder="Untitled App"
          />
          
          <textarea
            value={description}
            onFocus={() => {
              if (description === "Tell the user what your app does...") setDescription("");
            }}
            onChange={(e) => setDescription(e.target.value)}
            className="text-lg bg-transparent w-full 
              border-2 border-dashed border-gray-200 hover:border-gray-400 
              focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] 
              resize-y cursor-text placeholder:text-gray-400"
            placeholder="Tell the user what your app does..."
          />

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-2 -mt-2">
                <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">Additional App Settings</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={5}>
                        <p className="text-sm">
                          Optional settings to customize the privacy settings and AI behavior in your app. 
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Collection</label>
                  <Select
                    value={collectionId?.toString() || ''}
                    onValueChange={(value) => setCollectionId(parseInt(value))}
                    disabled={isLoadingCollections}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={
                        isLoadingCollections 
                          ? "Loading collections..." 
                          : "Select a collection"
                      } />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {collections?.length > 0 ? (
                        collections.map((collection) => (
                          <SelectItem 
                            key={collection.value} 
                            value={collection.value.toString()}
                          >
                            {collection.text}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          {isLoadingCollections 
                            ? "Loading collections..." 
                            : "No collections available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Privacy Settings</label>
                  <Select
                    value={privacy}
                    onValueChange={(value) => setPrivacy(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select privacy setting" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clonable"
                  checked={clonable}
                  onCheckedChange={(checked) => setClonable(checked as boolean)}
                />
                <label
                  htmlFor="clonable"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
                    peer-disabled:opacity-70"
                >
                  Allow others to clone this app
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Completion Message</label>
                <input
                  type="text"
                  value={completedHtml}
                  onChange={(e) => setCompletedHtml(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 
                    text-gray-900 focus:border-primary focus:ring-primary"
                  placeholder="Message to show when the form is completed"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-medium">Attached Files</h3>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={5}>
                        <p className="w-[200px] text-sm">
                          Upload files that will be available to users of your app. Supports PDF, PPT, DOC, TXT, CSV, JSON, and MD files.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div
                  {...getRootProps()}
                  className={`
                    mt-2 border-2 border-dashed rounded-lg p-6 transition-colors duration-150 ease-in-out
                    ${isDragActive ? 'border-primary-400 bg-primary-50' : isUploading ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-600'}
                    ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="text-center">
                    <Upload className={`mx-auto h-12 w-12 ${isDragActive || isUploading ? 'text-primary-400' : 'text-gray-400'}`} />
                    <p className="mt-2 text-sm text-gray-600">
                      {isDragActive ? "Drop files here" : "Drag and drop files here, or click to select files"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PDF, PPT, DOC, TXT, CSV, JSON, MD (Max 50MB)
                    </p>
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
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-700">{file.name}</p>
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
                        <div className="relative">
                          <input
                            type="text"
                            value={file.description || ''}
                            onChange={(e) => updateFileDescription(index, e.target.value)}
                            placeholder="Add a description so the AI understands the content of this file better (optional)"
                            maxLength={MAX_DESCRIPTION_LENGTH}
                            className="w-full px-3 py-1 text-sm border border-gray-200 rounded-md 
                              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                              placeholder:text-gray-400"
                          />
                          <div className="absolute right-2 bottom-1 text-xs text-gray-400">
                            {(file.description?.length || 0)}/{MAX_DESCRIPTION_LENGTH}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium">AI Configuration</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">System Prompt</label>
                    <textarea
                      value={aiConfig.systemPrompt}
                      onChange={(e) => setAIConfig({ ...aiConfig, systemPrompt: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 
                        text-gray-900 focus:border-primary focus:ring-primary min-h-[80px] resize-y"
                      placeholder="Enter system prompt for the AI model..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">AI Model</label>
                      <Select
                        value={aiConfig.aiModel}
                        onValueChange={(value) => setAIConfig({ ...aiConfig, aiModel: value })}
                        // disabled={isLoadingModels}
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
                      <label className="text-sm font-medium">Temperature</label>
                      <Input
                        type="number"
                        step="0.01"
                        min={availableModels[aiConfig.aiModel || 'gpt-4o-mini']?.min ?? 0}
                        max={availableModels[aiConfig.aiModel || 'gpt-4o-mini']?.max ?? 2}
                        value={aiConfig.temperature}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            const min = availableModels[aiConfig.aiModel]?.min ?? 0;
                            const max = availableModels[aiConfig.aiModel]?.max ?? 2;
                            setAIConfig({
                              ...aiConfig,
                              temperature: Math.min(max, Math.max(min, Number(value.toFixed(2))))
                            });
                          }
                        }}
                        className="w-full"
                        placeholder={`Enter temperature (${availableModels[aiConfig.aiModel]?.min ?? 0}-${availableModels[aiConfig.aiModel]?.max ?? 2})`}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Max Response Tokens</label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={aiConfig.maxResponseTokens || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          setAIConfig({ ...aiConfig, maxResponseTokens: value });
                        }}
                        className="w-full"
                        placeholder="Leave empty for no limit"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-3">
            <div className="sticky top-8 transition-all duration-200 hover:translate-y-[-2px]">
              <FieldPalette />
            </div>
          </div>

          <div className="col-span-9 space-y-8">
            {Array.isArray(phases) && phases.map((phase: PhaseType) => (
              <Card key={phase.id} className="p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Phase</h3>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={5}>
                        <p className="w-[200px] text-sm">
                          A phase is a &ldquo;turn&rdquo; in the conversation with AI, where the user provides inputs and the AI provides a response. Give your phase a title and optionally, a description.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center gap-4">
                    <input
                      type="text"
                      value={phase.title}
                      onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                      onFocus={(e) => {
                        if (/^Phase \d+$/.test(phase.title)) {
                          e.target.select();
                        }
                      }}
                      className="text-xl font-semibold bg-transparent flex-1
                        border-2 border-dashed border-gray-200 hover:border-gray-400 
                        focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-text"
                      placeholder="Enter Phase Name"
                    />
                    {phases.length > 1 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removePhase(phase.id)}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <textarea
                    value={phase.description}
                    onChange={(e) => updatePhase(phase.id, { description: e.target.value })}
                    className="w-full text-gray-600 bg-transparent
                      border-2 border-dashed border-gray-200 hover:border-gray-400 
                      focus:border-gray-600 rounded-lg px-4 py-2 transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] 
                      resize-y cursor-text placeholder:text-gray-400"
                    placeholder="Enter a description for this phase..."
                  />
                  
                  <Phase
                    appPhases={phases} 
                    phase={phase}
                    onUpdatePhase={updatePhase}
                    onUpdateFieldLabel={(fieldId, newLabel, isPrompt) => 
                      updateFieldLabel(phase.id, fieldId, newLabel, isPrompt)
                    }
                    onUpdateFieldName={(fieldId, newName, isPrompt) =>
                      updateFieldName(phase.id, fieldId, newName, isPrompt)
                    }
                    onDeleteField={(fieldId, isPrompt) =>
                      deleteField(phase.id, fieldId, isPrompt)
                    }
                    onUpdateFieldDescription={(fieldId, description, isPrompt) =>
                      updateFieldDescription(phase.id, fieldId, description, isPrompt)
                    }
                    onUpdateFieldRequired={(fieldId: string, required: boolean, isPrompt: boolean) =>
                      updateFieldRequired(phase.id, fieldId, required, isPrompt)
                    }
                    onUpdateFieldValidation={(fieldId, minChars, maxChars, isPrompt) =>
                      updateFieldValidation(phase.id, fieldId, minChars, maxChars, isPrompt)
                    }
                    onUpdateFieldDefaultValue={(fieldId, defaultValue) =>
                      updateFieldDefaultValue(phase.id, fieldId, defaultValue)
                    }
                    onUpdateFieldPlaceholder={(fieldId, placeholder) =>
                      updateFieldPlaceholder(phase.id, fieldId, placeholder)
                    }
                    onUpdateFieldChoices={(fieldId, choices) =>
                      updateFieldChoices(phase.id, fieldId, choices)
                    }
                    onUpdateFieldShowOther={(fieldId, showOther) =>
                      updateFieldShowOther(phase.id, fieldId, showOther)
                    }
                    onUpdateFieldSliderProps={(fieldId, updates) =>
                      updateFieldSliderProps(phase.id, fieldId, updates)
                    }
                    onUpdateFieldSliderValue={(fieldId, value) =>
                      updateFieldSliderValue(phase.id, fieldId, value)
                    }
                    onUpdatePromptText={(fieldId, text) =>
                      updateFieldText(fieldId, text, true)
                    }
                    onUpdateRichText={(fieldId, html) =>
                      updateFieldRichText(fieldId, html, false)
                    }
                    onUpdateConditionalLogic={(fieldId, logic, isPrompt) =>
                      handleUpdateConditionalLogic(phase.id, fieldId, logic, isPrompt)
                    }
                    onUpdateImageUploadSettings={(fieldId, settings) => 
                      updateImageUploadSettings(phase.id, fieldId, settings)
                    }
                    onUpdateFieldMaxMessages={(fieldId, maxMessages) =>
                      updateFieldMaxMessages(phase.id, fieldId, maxMessages)
                    }
                    onUpdateFieldInitialMessage={(fieldId, initialMessage) =>
                      updateFieldInitialMessage(phase.id, fieldId, initialMessage)
                    }
                    onUpdateChatbotInstructions={(fieldId, instructions) =>
                      updateChatbotInstructions(phase.id, fieldId, instructions)
                    }
                    onUpdateTtsProvider={(fieldId, provider) =>
                      updateTtsProvider(phase.id, fieldId, provider)
                    }
                    onUpdateTtsVoiceId={(fieldId, voiceId) =>
                      updateTtsVoiceId(phase.id, fieldId, voiceId)
                    }
                    onUpdateCustomVoiceId={(fieldId, voiceId) =>
                      updateCustomVoiceId(phase.id, fieldId, voiceId)
                    }
                    onUpdateTtsEnabled={(fieldId, enabled) =>
                      updateTtsEnabled(phase.id, fieldId, enabled)
                    }
                    onUpdateVoiceInstructions={(fieldId, instructions) =>
                      updateVoiceInstructions(phase.id, fieldId, instructions)
                    }
                    onUpdateAvatarUrl={(fieldId, avatarUrl) =>
                      updateAvatarUrl(phase.id, fieldId, avatarUrl)
                    }
                    appId={appId}
                  />
                </div>
              </Card>
            ))}
            
            <Button 
              onClick={addPhase} 
              id="add-phase-button"
              className="w-full bg-primary text-primary-foreground gap-2 mt-4 hover:bg-primary-600 transition-transform"
            >
              <Plus className="h-4 w-4" />
              Add Phase
            </Button>

            <Collapsible
              open={isOpen}
              onOpenChange={setIsOpen}
              className="mt-8"
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex items-center justify-between p-4">
                    <span className="text-lg font-semibold">JSON Preview</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 border-t">
                    <JsonPreview 
                      phases={phases}
                      title={title || ''}
                      description={description || ''}
                      collection={collectionId || 0}
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

      </div>
    </DragDropContext>
  );
}