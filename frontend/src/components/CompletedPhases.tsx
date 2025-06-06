"use client";

import React, { useState, useEffect } from 'react';
import evaluateVisibility from "@/utils//evaluateVisibility";
import RenderQuestion from '@/components/RenderQuestion';
import { useSurveyStore } from '../store/runtimeSurveyStore';
import { ConditionalLogic } from '../app/(authenticated)/app/types';
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
                     <div className="border rounded-lg overflow-hidden shadow-sm" style={{ height: '500px', position: 'relative' }}>
                        <div className="flex flex-col h-full">
                           {/* Messages Container */}
                           <div className="flex-1 overflow-y-auto p-4 space-y-4">
                              {Array.isArray(chatHistory) ? chatHistory.map((message: string, i: number) => {
                                 const [sender, text] = message.split(': ');
                                 const direction = sender === 'ai' ? 'incoming' : 'outgoing';
                                 
                                 return (
                                    <div
                                       key={i}
                                       className={`flex ${direction === 'outgoing' ? 'justify-end' : 'justify-start'} items-start gap-1`}
                                    >
                                       {sender === 'ai' && element.avatarUrl && (
                                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
                                             <img
                                                src={element.avatarUrl}
                                                alt="Assistant avatar"
                                                className="w-full h-full object-cover"
                                             />
                                          </div>
                                       )}
                                       <div
                                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                             direction === 'outgoing'
                                                ? 'bg-[#5C5EF1] text-white rounded-tr-none'
                                                : 'bg-[#f0f2f5] text-gray-900 rounded-tl-none'
                                          }`}
                                       >
                                          <div className="text-sm whitespace-pre-wrap">{text}</div>
                                       </div>
                                    </div>
                                 );
                              }) : null}
                           </div>
                           
                           {/* Footer to indicate this is a completed conversation */}
                           <div className="border-t border-gray-200 p-4 bg-gray-50">
                              <p className="text-sm text-gray-600 text-center">
                                 Chat completed
                              </p>
                           </div>
                        </div>
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
