import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaRegCopy, FaCopy, FaThumbsUp, FaThumbsDown } from 'react-icons/fa6';
import { Run } from '@/store/conversationStore';
import { proseClasses } from '@/styles/proseClasses';
import { updateRunUtil } from '@/utils/sendPrompts';
import { useUserStore } from '@/store/userStore';

interface AIResponseDisplayProps {
   run: Run | null;
   isOwner?: boolean;
   isAdmin?: boolean;
}

interface RunScoreDisplayProps {
   run: Run | null;
}

export const AIResponseDisplay: React.FC<AIResponseDisplayProps> = ({ run, isOwner = false, isAdmin = false }) => {
   const [copied, setCopied] = useState(false);
   const [liked, setLiked] = useState(false);
   const [disliked, setDisliked] = useState(false);
   const { user } = useUserStore();

   // Initialize liked/disliked states based on run.satisfaction
   useEffect(() => {
      if (run) {
         setLiked(run.satisfaction === 1);
         setDisliked(run.satisfaction === -1);
      }
   }, [run]);

   if (!run) return null;
   
   const handleCopy = async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };

   const handleLike = () => {
      if (!run.id) return;
      const newLiked = !liked;
      setLiked(newLiked);
      setDisliked(false);
      
      // Update on server
      updateRunUtil(
         run.session_id,
         run.id,
         {
            satisfaction: newLiked ? 1 : null
         },
         user?.id || null
      );
   };

   const handleDislike = () => {
      if (!run.id) return;
      const newDisliked = !disliked;
      setDisliked(newDisliked);
      setLiked(false);
      
      // Update on server
      updateRunUtil(
         run.session_id,
         run.id,
         {
            satisfaction: newDisliked ? -1 : null
         },
         user?.id || null
      );
   };

   // Get the last assistant message as the response
   const assistantMessage = run.messages.findLast(m => 
      m.role === 'assistant' || m.role === 'fixed_response'
   );
   if (!assistantMessage?.content) return null;

   return (
      <div className="mt-6 bg-gradient-to-b from-white to-gray-50/50 border border-gray-200/80 rounded-sm p-6 shadow-sm backdrop-blur-sm">
         <div className={proseClasses}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
               {assistantMessage.content || ''}
            </ReactMarkdown>
         </div>
         <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
            <div className="flex space-x-3">
               <button
                  onClick={() => handleCopy(assistantMessage.content)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={copied ? "Copied!" : "Copy to clipboard"}
               >
                  {copied ? <FaCopy /> : <FaRegCopy />}
               </button>
               <button
                  onClick={handleLike}
                  className={`${liked ? 'text-green-500' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Like"
               >
                  <FaThumbsUp />
               </button>
               <button
                  onClick={handleDislike}
                  className={`${disliked ? 'text-red-500' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Dislike"
               >
                  <FaThumbsDown />
               </button>
            </div>
            {(isOwner || isAdmin) && (
               <span className="text-xs text-gray-400">
                  Credits Used: {typeof run.credits === 'string' ? Number(run.credits).toFixed(0) : run.credits?.toFixed(0) || '0'}
               </span>
            )}
         </div>
      </div>
   );
};

export const RunScoreDisplay: React.FC<RunScoreDisplayProps> = ({ run }) => {
   const [isOpen, setIsOpen] = useState(false);
   
   if (!run?.run_score) return null;
   
   const passed = passedTheRubricMinScore(run);
   
   return (
      <div className="mt-3">
         <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex justify-end items-center group"
            type="button"
            tabIndex={-1}
         >
            <div className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
               {passed ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
               ) : (
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
               )}
               <span>Score</span>
               <svg 
                  className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
               >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
               </svg>
            </div>
         </button>
         
         {isOpen && (
            <div className="mt-2 p-3 bg-gray-50/50 rounded-md border border-gray-100">
               <p className="text-sm text-gray-600">
                  Score: <span className="font-medium">{run.run_score}</span>
               </p>
            </div>
         )}
      </div>
   );
};

export const getRunScore = (run: Run | null): string | null => {
   return run?.run_score || null;
};

export const hasNoSubmission = (run: Run | null): boolean => {
   return run?.no_submission === true;
};

export const passedTheRubricMinScore = (run: Run | null): boolean => {
   if (!run) return true;
   return run.run_passed !== false;
};