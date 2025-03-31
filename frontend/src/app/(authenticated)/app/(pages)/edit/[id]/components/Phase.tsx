"use client";

import { PhaseType, ChoiceType, ConditionalLogic } from '../types';
import Field from './Field';
import { Droppable } from '@hello-pangea/dnd';
import { Checkbox } from "./ui/checkbox";
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';


interface PhaseProps {
  phase: PhaseType;
  appPhases: PhaseType[];
  onUpdatePhase: (phaseId: string, updates: Partial<PhaseType>) => void;
  onUpdateFieldLabel: (fieldId: string, newLabel: string, isPrompt: boolean) => void;
  onUpdateFieldName: (fieldId: string, newName: string, isPrompt: boolean) => void;
  onDeleteField: (fieldId: string, isPrompt: boolean) => void;
  onUpdateFieldDescription: (fieldId: string, description: string, isPrompt: boolean) => void;
  onUpdateFieldRequired: (fieldId: string, isRequired: boolean, isPrompt: boolean) => void;
  onUpdateFieldValidation: (fieldId: string, minChars: number | null, maxChars: number | null, isPrompt: boolean) => void;
  onUpdateFieldDefaultValue: (fieldId: string, defaultValue: string | string[] | number | boolean) => void;
  onUpdateFieldPlaceholder: (fieldId: string, placeholder: string) => void;
  onUpdateFieldChoices: (fieldId: string, choices: ChoiceType[]) => void;
  onUpdateFieldShowOther: (fieldId: string, showOther: boolean) => void;
  onUpdateFieldSliderProps: (fieldId: string, updates: { minValue?: number; maxValue?: number; step?: number; }) => void;
  onUpdateFieldSliderValue: (fieldId: string, value: number) => void;
  onUpdatePromptText: (fieldId: string, text: string) => void;
  onUpdateRichText: (fieldId: string, html: string) => void;
  onUpdateConditionalLogic: (fieldId: string, logic: ConditionalLogic | null, isPrompt: boolean) => void;
  onUpdateImageUploadSettings: (
    fieldId: string,
    settings: {
      multiple?: boolean;
      maxFiles?: number;
      maxFileSize?: number;
      allowedFileTypes?: string[];
    }
  ) => void;
  onUpdateFieldMaxMessages: (fieldId: string, maxMessages: number) => void;
  onUpdateFieldInitialMessage: (fieldId: string, initialMessage: string) => void;
  onUpdateChatbotInstructions: (fieldId: string, instructions: string) => void;
}

export default function Phase({
  appPhases,
  phase, 
  onUpdatePhase, 
  onUpdateFieldLabel, 
  onUpdateFieldName,
  onDeleteField,
  onUpdateFieldDescription,
  onUpdateFieldValidation,
  onUpdateFieldDefaultValue,
  onUpdateFieldPlaceholder,
  onUpdateFieldRequired,
  onUpdateFieldChoices,
  onUpdateFieldShowOther,
  onUpdateFieldSliderProps,
  onUpdateFieldSliderValue,
  onUpdatePromptText,
  onUpdateRichText,
  onUpdateConditionalLogic,
  onUpdateImageUploadSettings,
  onUpdateFieldMaxMessages,
  onUpdateFieldInitialMessage,
  onUpdateChatbotInstructions,
}: PhaseProps) {

   /**
    * Get all elements from all phases
    * @param phases - The phases to get elements from
    * @returns All elements from all phases
    */
  const getAllElementsFromPhases = (phases: PhaseType[]) => {
    return phases.flatMap(phase => phase.elements);
  };

  const renderField = (field: any, index: number) => {
    return (
      <Field 
        field={field} 
        index={index} 
        phaseFields={phase.elements}
        appFields={getAllElementsFromPhases(appPhases)}
        onUpdateFieldLabel={onUpdateFieldLabel}
        onUpdateFieldName={onUpdateFieldName}
        onDeleteField={onDeleteField}
        onUpdateFieldDescription={onUpdateFieldDescription}
        onUpdateFieldRequired={onUpdateFieldRequired}
        onUpdateFieldValidation={onUpdateFieldValidation}
        onUpdateFieldDefaultValue={onUpdateFieldDefaultValue}
        onUpdateFieldPlaceholder={onUpdateFieldPlaceholder}
        onUpdateFieldChoices={onUpdateFieldChoices}
        onUpdateFieldShowOther={onUpdateFieldShowOther}
        onUpdateFieldSliderProps={onUpdateFieldSliderProps}
        onUpdateFieldSliderValue={onUpdateFieldSliderValue}
        onUpdatePromptText={onUpdatePromptText}
        onUpdateRichText={onUpdateRichText}
        onUpdateConditionalLogic={(fieldId, logic) => 
          onUpdateConditionalLogic(fieldId, logic, false)
        }
        onUpdateImageUploadSettings={onUpdateImageUploadSettings}
        onUpdateFieldMaxMessages={onUpdateFieldMaxMessages}
        onUpdateFieldInitialMessage={onUpdateFieldInitialMessage}
        onUpdateChatbotInstructions={onUpdateChatbotInstructions}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-gray-500">Fields</h3>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <p className="w-[200px] text-sm">
                  Drag fields onto this area to collect inputs from your user. You&apos;ll be able to use these inputs later in your prompts. 
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Droppable 
          droppableId={`fields-${phase.id}`}
          type="field"
        >
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[200px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                snapshot.isDraggingOver
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-gray-200'
              }`}
            >
              {phase.elements?.map((field, index) => (
                <div key={field.id}>
                  {renderField(field, index)}
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-gray-500">Prompts</h3>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <p className="w-[200px] text-sm">
                  Drag prompts onto this area that will be sent to the AI. You can include user inputs inside your prompts by using the input&apos;s name in brackets {`{}`}. 
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Droppable 
          droppableId={`prompts-${phase.id}`}
          type="prompt"
        >
          {(provided, snapshot) => (
            <div
              id={`prompts-${phase.id}`}
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[200px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                snapshot.isDraggingOver
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-gray-200'
              }`}
            >
              {Array.isArray(phase.prompts) && phase.prompts.map((prompt, index) => (
                <Field 
                  key={prompt.id} 
                  field={prompt} 
                  index={index}
                  phaseFields={phase.elements}
                  appFields={getAllElementsFromPhases(appPhases)}
                  onUpdateFieldLabel={(fieldId, newLabel) => onUpdateFieldLabel(fieldId, newLabel, true)}
                  onUpdateFieldName={(fieldId, newName) => onUpdateFieldName(fieldId, newName, true)}
                  onDeleteField={(fieldId) => onDeleteField(fieldId, true)}
                  onUpdateFieldDescription={(fieldId, description) => onUpdateFieldDescription(fieldId, description, true)}
                  onUpdateFieldValidation={(fieldId, minChars, maxChars) => onUpdateFieldValidation(fieldId, minChars, maxChars, true)}
                  onUpdateFieldDefaultValue={(fieldId, defaultValue) => onUpdateFieldDefaultValue(fieldId, defaultValue)}
                  onUpdateFieldPlaceholder={(fieldId, placeholder) => onUpdateFieldPlaceholder(fieldId, placeholder)}
                  onUpdateFieldRequired={(fieldId, required) => onUpdateFieldRequired(fieldId, required, true)}
                  onUpdateFieldChoices={(fieldId, choices) => onUpdateFieldChoices(fieldId, choices)}
                  onUpdateFieldShowOther={(fieldId, showOther) => onUpdateFieldShowOther(fieldId, showOther)}
                  onUpdateFieldSliderProps={onUpdateFieldSliderProps}
                  onUpdateFieldSliderValue={onUpdateFieldSliderValue}
                  onUpdatePromptText={onUpdatePromptText}
                  onUpdateRichText={onUpdateRichText}
                  onUpdateConditionalLogic={(fieldId, logic) => 
                    onUpdateConditionalLogic(fieldId, logic, true)
                  }
                  onUpdateFieldMaxMessages={onUpdateFieldMaxMessages}
                  onUpdateFieldInitialMessage={onUpdateFieldInitialMessage}
                  onUpdateChatbotInstructions={onUpdateChatbotInstructions}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
      <div className="space-y-4 border-b border-gray-200 pb-6">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`skipPhase-${phase.id}`}
              checked={phase.skipPhase}
              onCheckedChange={(checked) => 
                onUpdatePhase(phase.id, { skipPhase: checked as boolean })
              }
            />
            <label
              htmlFor={`skipPhase-${phase.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
                peer-disabled:opacity-70"
            >
              Can user skip this phase?
            </label>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  <p className="w-[200px] text-sm">
                    If true, user can skip this phase. Recommended if this is a phase 
                    where the AI can make scoring mistakes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-2 ml-6">
            <Checkbox
              id={`scored-${phase.id}`}
              checked={phase.scoredPhase}
              onCheckedChange={(checked) => 
                onUpdatePhase(phase.id, { scoredPhase: checked as boolean })
              }
            />
            <label
              htmlFor={`scored-${phase.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
                peer-disabled:opacity-70"
            >
              Scored Phase?
            </label>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  <p className="w-[200px] text-sm">
                    Scored phases use AI to assess the content in a prompt according to a scoring rubric. Users will not be able to advance beyond this phase until they&apos;ve achieved the minimum score.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {phase.scoredPhase && (
          <div className="space-y-2">
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-gray-700">Minimum Score</label>
              <input
                type="number"
                value={phase.minScore || ''}
                onChange={(e) => onUpdatePhase(phase.id, { 
                  minScore: e.target.value ? Number(e.target.value) : undefined 
                })}
                className="w-full rounded-md border border-gray-300 
                  px-3 py-2 text-gray-900 focus:border-primary 
                  focus:ring-primary"
                placeholder="Enter minimum score..."
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <label className="text-sm font-medium text-gray-700">Rubric</label>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={5}>
                    <p className="w-[400px] text-sm">
                      Any human-readable text can be used as a scoring rubric. For rubrics with multiple dimensions, the total score will be used to determine if the user has passed the phase.
                      <br />
                      E.g. <br />
                      Name:<br />
                        1 point - The user has entered a valid name. <br />
                        0 points - The user has not entered a valid name.<br />
                      Content:<br />
                        5 points - The user has described how precipitation works. <br />
                        0 points - The user has not described how precipitation works.<br />
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <textarea
              value={phase.rubric || ''}
              onChange={(e) => onUpdatePhase(phase.id, { rubric: e.target.value })}
              className="w-full min-h-[100px] rounded-md border border-gray-300 
                px-3 py-2 text-gray-900 focus:border-primary 
                focus:ring-primary resize-y"
              placeholder="Enter scoring rubric..."
            />
          </div>
        )}
      </div>
    </div>
  );
}