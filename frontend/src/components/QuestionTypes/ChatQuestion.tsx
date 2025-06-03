"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Element, ErrorObject, Answers, setInputValue, ConditionalLogic, Prompt } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { sendPromptsUtil } from "@/utils/sendPrompts";
import { LiveAudioVisualizer } from 'react-audio-visualize';
import { AudioRecorder as VoiceRecorder, useAudioRecorder } from 'react-audio-voice-recorder';
import { Send } from 'lucide-react';
import { transcribeAudio } from '@/utils/audioTranscriptionService';

interface ChatQuestionProps {
   element: Element;
   answers: Answers;
   setInputValue: setInputValue;
   errors: ErrorObject[];
   disabled: boolean;
   appId: number;
   userId: number | null;
   surveyJson: any;
   currentPhaseIndex: number;
}

interface ChatMessage {
  message: string;
  sender: 'user' | 'ai';
  direction: 'incoming' | 'outgoing';
}

const ChatQuestion: React.FC<ChatQuestionProps> = ({
   element,
   answers,
   setInputValue,
   errors = [],
   disabled,
   appId,
   userId,
   surveyJson,
   currentPhaseIndex,
}) => {
   const MESSAGE_LIMIT = element.maxMessages || 10;
   const [messages, setMessages] = useState<ChatMessage[]>([
     {
       message: element.initialMessage || 'Hello! How can I help you today?',
       sender: 'ai',
       direction: 'incoming'
     }
   ]);
   const [isTyping, setIsTyping] = useState(false);
   const [isActive] = useState(true);
   const [inputMessage, setInputMessage] = useState('');
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const recorder = useAudioRecorder();

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
   }, [recorder.isRecording]);

   // Count only user messages
   const userMessageCount = messages.filter(msg => msg.sender === 'user').length;

   // Auto-scroll to bottom when messages change
   useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);

   const handleRecordingComplete = async (blob: Blob) => {
     try {
       setIsTyping(true);
       const transcribedText = await transcribeAudio(blob, userId);
       await handleSend(transcribedText);
     } catch (error) {
       console.error('Error transcribing audio:', error);
     } finally {
       setIsTyping(false);
     }
   };

   const handleSend = async (message: string) => {
     if (!message.trim() || userMessageCount >= MESSAGE_LIMIT) {
       return;
     }

     const userMessage: ChatMessage = {
       message,
       sender: 'user',
       direction: 'outgoing'
     };
     
     setMessages(prev => [...prev, userMessage]);
     setInputMessage(''); // Clear input after sending
     setIsTyping(true);

     try {
       const prompts: Prompt[] = [];

       if (element.chatbotInstructions) {
         prompts.push({
           id: `chat-instructions-${Date.now()}`,
           name: 'chat_instructions',
           type: 'aiInstructions',
           text: element.chatbotInstructions,
         });
       }

       prompts.push({
         id: `chat-${Date.now()}`,
         name: 'chat_message',
         type: 'prompt',
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
         skipScoredRun: true
       });

       if (response.success && response.response) {
         const aiMessage: ChatMessage = {
           message: response.response,
           sender: 'ai',
           direction: 'incoming'
         };

         setMessages(prev => [...prev, aiMessage]);
         
         const chatHistory = [...messages, userMessage, aiMessage]
           .map(msg => `${msg.sender}: ${msg.message}`);
         setInputValue(element.name, chatHistory, '', 'chat');
       }
     } catch (error) {
       console.error('Error getting AI response:', error);
     } finally {
       setIsTyping(false);
     }
   };

   const handleKeyPress = (e: React.KeyboardEvent) => {
     if (e.key === 'Enter' && !e.shiftKey) {
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

   return (
     <div className={`mb-6 ${
       evaluateVisibility(element.conditionalLogic || {} as ConditionalLogic, answers)
         ? ''
         : 'hidden'
     }`}>
       {element.label && (
         <label className="block text-sm font-medium text-gray-700 mb-2">
           {element.label}
           {element.isRequired && (
             <span className="text-red-500 ml-1">*</span>
           )}
         </label>
       )}

       {element.description && (
         <p className="mt-1 text-sm/6 text-gray-600 mb-2">
           {element.description}
         </p>
       )}

       {hasError && (
         <p className="mt-1 text-sm text-red-600">
           {errorMessage}
         </p>
       )}

       {isActive ? (
         <div className="border rounded-lg overflow-hidden shadow-sm" style={{ height: '500px', position: 'relative' }}>
           <div className="flex flex-col h-full">
             {/* Messages Container */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {messages.map((message, i) => (
                 <div
                   key={i}
                   className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                 >
                   <div
                     className={`max-w-[80%] rounded-lg px-4 py-2 ${
                       message.direction === 'outgoing'
                         ? 'bg-[#5C5EF1] text-white'
                         : 'bg-[#f0f2f5] text-gray-900'
                     }`}
                   >
                     <div className="text-xs font-medium mb-1">
                       {message.sender === 'ai' ? 'Assistant' : 'You'}
                     </div>
                     <div className="text-sm whitespace-pre-wrap">{message.message}</div>
                   </div>
                 </div>
               ))}
               {isTyping && (
                 <div className="flex justify-start">
                   <div className="bg-[#f0f2f5] rounded-lg px-4 py-2">
                     <div className="flex space-x-2">
                       <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce" />
                       <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce delay-100" />
                       <div className="w-2 h-2 bg-[#5C5EF1] animate-bounce delay-200" />
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
                     <textarea
                       value={inputMessage}
                       onChange={(e) => setInputMessage(e.target.value)}
                       onKeyPress={handleKeyPress}
                       placeholder={
                         userMessageCount >= MESSAGE_LIMIT 
                           ? "Message limit has been reached" 
                           : `Type message here (${remainingMessages} messages remaining)`
                       }
                       disabled={disabled || userMessageCount >= MESSAGE_LIMIT}
                       className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5C5EF1] focus:border-transparent resize-none"
                       rows={1}
                       style={{ minHeight: '40px', maxHeight: '120px' }}
                     />
                   </div>
                 )}
                 <div className="flex-shrink-0">
                   {!recorder.isRecording && (
                     <button
                       onClick={() => handleSend(inputMessage)}
                       disabled={!inputMessage.trim() || disabled || userMessageCount >= MESSAGE_LIMIT}
                       className="p-2 text-[#5C5EF1] hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Send className="w-5 h-5" />
                     </button>
                   )}
                 </div>
                 <div className={`flex-shrink-0 ${recorder.isRecording ? '[&_.audio-recorder-mic]:hidden [&_.audio-recorder-status]:hidden [&_.recording]:!w-auto' : ''}`}>
                   <VoiceRecorder
                     onRecordingComplete={handleRecordingComplete}
                     recorderControls={recorder}
                     downloadFileExtension="webm"
                     showVisualizer={false}
                     classes={{
                       AudioRecorderClass: '!p-0 !bg-transparent !shadow-none hover:!bg-gray-100',
                       AudioRecorderPauseResumeClass: '!p-2',
                       AudioRecorderDiscardClass: '!p-2',
                     }}
                   />
                 </div>
               </div>
             </div>
           </div>
         </div>
       ) : (
         <div className="mt-2 p-4 bg-gray-50 rounded-md border">
           <p className="text-sm text-gray-600">Chat ended. History saved.</p>
         </div>
       )}
     </div>
   );
};

export default ChatQuestion; 