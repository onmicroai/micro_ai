"use client";
import React from "react";
import { setInputValue, handleInputChange } from "@/app/(authenticated)/app/types";
import { questionType } from "../app/(authenticated)/app/constants";

// Import the new components
import BooleanQuestion from "./QuestionTypes/BooleanQuestion";
import CheckboxQuestion from "./QuestionTypes/CheckboxQuestion";
import DropdownQuestion from "./QuestionTypes/DropdownQuestion";
import RadioQuestion from "./QuestionTypes/RadioQuestion";
import SliderQuestion from "./QuestionTypes/SliderQuestion";
import TextAreaQuestion from "./QuestionTypes/TextAreaQuestion";
import TextQuestion from "./QuestionTypes/TextQuestion";
import RichText from "./QuestionTypes/RichText";
import { ErrorObject, Element, Base64Images } from "@/app/(authenticated)/app/types";
import ImageUploadQuestion from "./QuestionTypes/ImageUploadQuestion";
import ChatQuestion from "./QuestionTypes/ChatQuestion";

interface RenderElementProps {
   element: Element;
   answers: Record<string, any>;
   setInputValue: setInputValue;
   setImages: (updater: (prev: Base64Images) => Base64Images) => void;
   handleInputChange: handleInputChange;
   visible: boolean;
   errors: ErrorObject[];
   disabled: boolean;
   completedPhase?: boolean;
   appId: number;
   userId: number | null;
   surveyJson: any;
   currentPhaseIndex: number;
   isOwner?: boolean;
   isAdmin?: boolean;
}

const RenderQuestion = ({
   element,
   answers,
   setInputValue,
   setImages,
   handleInputChange,
   visible,
   errors,
   disabled,
   appId,
   userId,
   surveyJson,
   currentPhaseIndex,
   isOwner = false,
   isAdmin = false,
}: RenderElementProps) => {
   if (!visible || !element) {
      return null;
   }

   switch (element.type) {
      case questionType.text:
         return (
            <TextQuestion
               element={element}
               answers={answers}
               handleInputChange={handleInputChange}
               errors={errors}
               disabled={disabled}
            />
         );

      case questionType.textarea:
         return (
            <TextAreaQuestion
               element={element}
               answers={answers}
               handleInputChange={handleInputChange}
               errors={errors}
               disabled={disabled}
            />
         );
      
      case questionType.radio:
         return (
            <RadioQuestion
               element={element}
               answers={answers}
               setInputValue={setInputValue}
               errors={errors}
               disabled={disabled}
            />
         );

         case questionType.slider:
            return (
               <SliderQuestion
                  element={element}
                  answers={answers}
                  setInputValue={setInputValue}
                  errors={errors}
                  disabled={disabled}
               />
            );

      case questionType.dropdown:
         return (
            <DropdownQuestion
               element={element}
               answers={answers}
               setInputValue={setInputValue}
               errors={errors}
               disabled={disabled}
            />
         );

      case questionType.checkbox:
         return (
            <CheckboxQuestion
               element={element}
               answers={answers}
               setInputValue={setInputValue}
               errors={errors}
               disabled={disabled}
            />
         );

      case questionType.boolean:
         return (
            <BooleanQuestion
               element={element}
               answers={answers}
               setInputValue={setInputValue}
               errors={errors}
               disabled={disabled}
            />
         );

      case questionType.richText:
         return (
            <RichText
               element={element}
               answers={answers}
               errors={errors}
               disabled={disabled}
            />
         );

      case questionType.imageUpload:
         return (
            <ImageUploadQuestion
               element={element}
               setInputValue={setInputValue}
               setImages={setImages}
               errors={errors}
               disabled={disabled}
               answers={answers}
            />
         );

      case questionType.chat:
         return (
            <ChatQuestion
               element={element}
               answers={answers}
               setInputValue={setInputValue}
               errors={errors}
               disabled={disabled}
               appId={appId}
               userId={userId}
               surveyJson={surveyJson}
               currentPhaseIndex={currentPhaseIndex}
               isOwner={isOwner}
               isAdmin={isAdmin}
            />
         );

      default:
         return null;
   }

};

export default RenderQuestion;