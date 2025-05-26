"use client";

import React, { useState, useEffect } from 'react';
import evaluateVisibility from "@/utils//evaluateVisibility";
import RenderQuestion from '@/components/RenderQuestion';
import { useSurveyStore } from '../store/runtimeSurveyStore';
import { ConditionalLogic } from '../app/(authenticated)/app/(pages)/edit/[id]/types';
import { 
  MainContainer, 
  ChatContainer, 
  MessageList, 
  Message 
} from '@chatscope/chat-ui-kit-react';
import '@/styles/chatscope.scss';
import {
   AIResponseDisplay,
   RunScoreDisplay,
} from '@/utils/phaseResultDisplay';
import { useConversationStore } from '@/store/conversationStore';
import { useUserStore } from '@/store/userStore';
import { checkIsOwner, checkIsAdmin } from '@/utils/checkRoles';

interface CompletedPhaseProps {
   pageIndex: number;
   page: any;
}

/**
 * Component that that shows completed survey pages
 * 
 * @param pageIndex - index of the page
 * @param page - page to be rendered
 * @returns 
 */
const CompletedPhase: React.FC<CompletedPhaseProps> = ({
   pageIndex,
   page,
}) => {
   const {
      answers,
      handleInputChange,
      setInputValue,
      setImages,
      surveyJson,
      setElements,
   } = useSurveyStore();
   const [isOwner, setIsOwner] = useState(false);
   const [isAdmin, setIsAdmin] = useState(false);
   const user = useUserStore(state => state.user);

   const { currentConversation } = useConversationStore();
   // Get the most recent run for this completed phase
   const currentRun = currentConversation?.runs
      ?.filter(run => run.phaseIndex === pageIndex)
      ?.sort((a, b) => b.createdAt - a.createdAt)[0] || null;

   // Check user roles when component mounts
   useEffect(() => {
      const controller = new AbortController();
      
      const checkRoles = async () => {
         if (user && surveyJson?.hashId) {
            const ownerResult = await checkIsOwner(surveyJson.hashId, user.id, controller.signal);
            const adminResult = await checkIsAdmin(surveyJson.hashId, user.id, controller.signal);
            setIsOwner(ownerResult.isOwner);
            setIsAdmin(adminResult.isAdmin);
         }
      };
      
      checkRoles();
      
      return () => controller.abort();
   }, [user, surveyJson?.hashId]);

   // Add this effect to load elements
   useEffect(() => {
      if (surveyJson?.phases) {
         // Get all elements from all phases
         const allElements = surveyJson.phases.flatMap(phase => phase.elements || []);
         setElements(allElements);
      }
   }, [surveyJson, setElements]);

   return (
      <div key={page.name} className="space-y-6">
         {page.title && page.title.length > 0 && (
            <div>
               <h2 className="text-base/7 font-semibold text-gray-900">{page.title}</h2>
               <p className="mt-1 text-sm/6 text-gray-600">{page.description}</p>
            </div>
         )}
         {page.elements.map((element: any) => {
            if (element.type === 'chat') {
               const chatHistory = answers[element.name]?.value || [];
               const isVisible = evaluateVisibility(
                  element.conditionalLogic || {} as ConditionalLogic,
                  answers
               );
               
               if (!isVisible) {
                  return null;
               }

               return (
                  <div key={element.name} className="mt-6">
                     {element.label && (
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                           {element.label}
                        </label>
                     )}
                     <div className="border rounded-lg overflow-hidden shadow-sm" style={{ height: '500px' }}>
                        <MainContainer>
                           <ChatContainer>
                              <MessageList className="p-4">
                                 {Array.isArray(chatHistory) ? chatHistory.map((message: string, i: number) => {
                                    const [sender, text] = message.split(': ');
                                    return (
                                       <Message 
                                          key={i}
                                          model={{
                                             message: text,
                                             sender: sender,
                                             direction: sender === 'ai' ? 'incoming' : 'outgoing',
                                             position: "normal"
                                          }}
                                          className="mb-3"
                                       >
                                          <Message.Header>
                                             {sender === 'ai' ? 'Assistant' : 'You'}
                                          </Message.Header>
                                       </Message>
                                    );
                                 }) : null}
                              </MessageList>
                           </ChatContainer>
                        </MainContainer>
                     </div>
                  </div>
               );
            }
            const isVisible = evaluateVisibility(
               element.conditionalLogic || {} as ConditionalLogic,
               answers
            );

            return (
               <RenderQuestion
                  key={element.name}
                  element={element}
                  answers={answers}
                  errors={[]}
                  disabled={true}
                  handleInputChange={handleInputChange}
                  setInputValue={setInputValue}
                  setImages={setImages}
                  visible={isVisible}
                  appId={surveyJson?.id || 0}
                  userId={null}
                  surveyJson={surveyJson}
                  currentPhaseIndex={pageIndex}
               />
            );
         })}

         <AIResponseDisplay run={currentRun} isOwner={isOwner} isAdmin={isAdmin} />
         <RunScoreDisplay run={currentRun} />
      </div>
   );
};

export default CompletedPhase;
