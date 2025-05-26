"use client";

import React, { useState } from 'react';
import '@/styles/chatscope.scss';
import { 
  MainContainer, 
  ChatContainer, 
  MessageList, 
  Message, 
  MessageInput, 
  TypingIndicator 
} from '@chatscope/chat-ui-kit-react';
import { Element, ErrorObject, Answers, setInputValue, ConditionalLogic, Prompt } from "@/app/(authenticated)/app/types";
import evaluateVisibility from "@/utils/evaluateVisibility";
import { sendPromptsUtil } from "@/utils/sendPrompts";

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

   // Count only user messages
   const userMessageCount = messages.filter(msg => msg.sender === 'user').length;

   const handleSend = async (message: string) => {
     // Check against user message count only
     if (userMessageCount >= MESSAGE_LIMIT) {
       return;
     }

     const userMessage: ChatMessage = {
       message,
       sender: 'user',
       direction: 'outgoing'
     };
     
     setMessages(prev => [...prev, userMessage]);

     // Show typing indicator
     setIsTyping(true);

     try {
       // Create prompts array with instructions first if present
       const prompts: Prompt[] = [];

       // Add chatbot instructions as aiInstructions if present
       if (element.chatbotInstructions) {
         prompts.push({
           id: `chat-instructions-${Date.now()}`,
           name: 'chat_instructions',
           type: 'aiInstructions',
           text: element.chatbotInstructions,
         });
       }

       // Add user message
       prompts.push({
         id: `chat-${Date.now()}`,
         name: 'chat_message',
         type: 'prompt',
         text: message,
       });

       // Send to AI using sendPromptsUtil
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
         
         // Update form value with complete chat history
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

   const getErrorMessage = (elementName: string): string | null => {
      const error = errors.find((error) => error.element === elementName);
      return error ? error.error : null;
   };

   const errorMessage = getErrorMessage(element.name);
   const hasError = !!errorMessage;

   // Calculate remaining messages based on user messages only
   const remainingMessages = MESSAGE_LIMIT - userMessageCount;

   return (
     <div
       className={`mb-6 ${
         evaluateVisibility(element.conditionalLogic || {} as ConditionalLogic, answers)
           ? ''
           : 'hidden'
       }`}
     >
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
         <div>
          <div className="border rounded-lg overflow-hidden shadow-sm" style={{ height: '500px', position: 'relative', zIndex: 0 }}>
            <MainContainer>
              <ChatContainer>
                <MessageList 
                  typingIndicator={isTyping ? <TypingIndicator content="AI is typing" /> : null}
                  className="p-4"
                >
                  {messages.map((message, i) => (
                    <Message 
                      key={i}
                      model={{
                        message: message.message,
                        sender: message.sender,
                        direction: message.direction,
                        position: "normal"
                      }}
                      className="mb-3"
                    >
                      <Message.Header>
                        {message.sender === 'ai' ? 'Assistant' : 'You'}
                      </Message.Header>
                    </Message>
                  ))}
                </MessageList>
                <MessageInput 
                  placeholder={
                    userMessageCount >= MESSAGE_LIMIT 
                      ? "Message limit has been reached" 
                      : "Type message here (" + remainingMessages + " messages remaining)"
                  }
                  onSend={handleSend}
                  disabled={disabled || userMessageCount >= MESSAGE_LIMIT}
                  attachButton={false}
                  className="px-4 py-3 border-t"
                  style={{
                    background: 'white',
                    borderTop: '1px solid #e5e7eb'
                  }}
                />

              </ChatContainer>
            </MainContainer>
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