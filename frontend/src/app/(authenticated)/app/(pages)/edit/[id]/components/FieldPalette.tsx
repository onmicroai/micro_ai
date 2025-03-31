"use client";

import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from './ui/card';
import { 
  Type, 
  AlignLeft, 
  CircleDot, 
  CheckSquare, 
  List, 
  SlidersHorizontal, 
  ToggleLeft,
  MessageSquare,
  FileText,
  Bot,
  MessageCircle,
  ImagePlus,
  MessagesSquare
} from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const fields = [
  { id: 'text', label: 'Single Line', icon: Type, type: 'field', helper: 'Collect a single line of text input.'},
  { id: 'textarea', label: 'Long Text', icon: AlignLeft, type: 'field', helper: 'Collect a longer block of text input.'},
  { id: 'richText', label: 'Rich Text', icon: FileText, type: 'field', helper: 'Display text or images to the user.'},
  { id: 'radio', label: 'Radio Buttons', icon: CircleDot, type: 'field', helper: 'Collect a single choice from a list of options.'},
  { id: 'checkbox', label: 'Checkboxes', icon: CheckSquare, type: 'field', helper: 'Collect one or more choices from a list of options.'},
  { id: 'dropdown', label: 'Dropdown', icon: List, type: 'field', helper: 'Collect a single choice from a dropdown menu.'},
  { id: 'slider', label: 'Slider', icon: SlidersHorizontal, type: 'field', helper: 'Collect a numeric value from a slider.'},
  { id: 'boolean', label: 'Boolean', icon: ToggleLeft, type: 'field', helper: 'Collect a true or false value. Often used for conditional logic.'},
  { id: 'imageUpload', label: 'Image Upload', icon: ImagePlus, type: 'field', helper: 'Collect an image or images from the user.'},
  { id: 'chat', label: 'Chatbot', icon: MessagesSquare, type: 'field', helper: 'Add a chat interface for users to interact with the AI.'},
];

const promptFields = [
  { id: 'prompt', label: 'Prompt', icon: MessageSquare, type: 'prompt', helper: 'Prompts are standard text prompts, like you would use in a chatbot. Except that with MicroApps you can include placeholders for fields.'},
  { id: 'aiInstructions', label: 'AI Instructions', icon: Bot, type: 'prompt', helper: 'AI Instructions are instructions for that specific step that you want the AI to follow. Use instructions when you want to give the AI specific instructions for a step.'},
  { id: 'fixedResponse', label: 'Fixed Response', icon: MessageCircle, type: 'prompt', helper: 'Fixed Responses are hard-coded responses that you want to output. The response will be exactly as you write it. You can use field placeholders here too.'},
];

export default function FieldPalette() {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Available Fields</h2>
      <Droppable droppableId="palette-fields" isDropDisabled={true} type="field">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-2"
          >
            {fields.map((field, index) => (
              <Draggable
                key={field.id}
                draggableId={field.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    id={field.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-move transition-colors ${
                      snapshot.isDragging
                        ? 'bg-primary/10 border-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <field.icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{field.label}</span>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild className="ml-auto">
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={5}>
                          <p className="w-[200px] text-sm">
                            {field.helper}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="h-px bg-gray-200 my-4" />
      <h2 className="text-lg font-semibold mb-2">Prompts</h2>
      
      <Droppable droppableId="palette-prompts" isDropDisabled={true} type="prompt">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-2"
          >
            {promptFields.map((field, index) => (
              <Draggable
                key={field.id}
                draggableId={field.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    id={field.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-move transition-colors ${
                      snapshot.isDragging
                        ? 'bg-primary/10 border-primary'
                        : 'border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <field.icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{field.label}</span>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild className="ml-auto">
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={5}>
                          <p className="w-[200px] text-sm">
                            {field.helper}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </Card>
  );
}