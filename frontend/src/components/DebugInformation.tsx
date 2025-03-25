"use client";

import { FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { useState } from 'react';
import { SurveyJson } from '../app/(authenticated)/app/types';
import type { Conversation } from '../store/conversationStore';

interface DebugInformationProps {
  surveyJson?: SurveyJson | null;
  currentConversation?: Conversation | null;
  conversations?: Conversation[] | null;
  answers?: any;
  base64Images?: any;
  statsData?: any;
  conversations_json?: any;
}

export default function DebugInformation({
  surveyJson,
  currentConversation,
  conversations,
  answers,
  base64Images,
  statsData,
  conversations_json,
}: DebugInformationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-0 right-0 p-4 bg-white border rounded-tl shadow-lg max-w-[90vw] md:max-w-[600px]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
      >
        <span>Debug Info</span>
        {isOpen ? <FaChevronDown /> : <FaChevronUp />}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-6 max-h-[80vh] overflow-auto">
          {surveyJson && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Survey JSON:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(surveyJson, null, 2)}
              </pre>
            </div>
          )}

          {currentConversation && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Current Conversation:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(currentConversation, null, 2)}
              </pre>
            </div>
          )}

          {conversations && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">All Conversations:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(conversations, null, 2)}
              </pre>
            </div>
          )}

          {answers && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Answers:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(answers, null, 2)}
              </pre>
            </div>
          )}

          {base64Images && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Base64 Images:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(base64Images, null, 2)}
              </pre>
            </div>
          )}

          {statsData && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Stats Data:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(statsData, null, 2)}
              </pre>
            </div>
          )}

          {conversations_json && (
            <div className="debug-section">
              <h2 className="text-lg font-semibold mb-2">Conversations JSON:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {JSON.stringify(conversations_json, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 