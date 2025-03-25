import { Answers, ConditionalLogic } from "@/app/(authenticated)/app/types";
import { useSurveyStore } from '@/store/runtimeSurveyStore';

/**
 * Currently this option is switched off into edit survey page.
 * 
 * TODO: need to be reviewed the logic for that method and restored
 * 
 * Evaluates the visibility of a question based on the visibleIf property.
 * 
 * @param conditionalLogic - The conditional logic property of the question.
 * @param answers - The answers state.
 * @returns true if the question is visible, false otherwise.
 */
const evaluateVisibility = (
   conditionalLogic: ConditionalLogic | undefined,
   answers: Answers
): boolean => {
   // If no conditional logic, always show the field
   if (!conditionalLogic) {
      return true;
   }

   const { value, operator, sourceFieldId } = conditionalLogic;
   
   // Get the elements from the store
   const elements = useSurveyStore.getState().elements;
   
   // Find the source element by ID and get its name
   const sourceElement = elements?.find(q => q.id === sourceFieldId);
   if (!sourceElement) {
      return true; // If we can't find the source question, show the field
   }

   const sourceAnswer = answers[sourceElement.name]?.value;

   // Handle empty checks first
   if (operator === 'is_empty') {
      return !sourceAnswer || sourceAnswer.length === 0;
   }
   if (operator === 'is_not_empty') {
      return !!sourceAnswer && sourceAnswer.length > 0;
   }

   // If we need to compare values but don't have a source answer, hide the field until the user has selected an answer
   if (sourceAnswer === undefined) {
      return false;
   }

   switch (operator.toLowerCase()) {
      case 'contains':
         return String(sourceAnswer).toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
         return !String(sourceAnswer).toLowerCase().includes(String(value).toLowerCase());
      case 'equals':
         return String(sourceAnswer).toLowerCase() === String(value).toLowerCase();
      case 'not_equals':
      case 'notequals': // Support legacy operator name
         return String(sourceAnswer).toLowerCase() !== String(value).toLowerCase();
      case 'greater_than':
         return Number(sourceAnswer) > Number(value);
      case 'less_than':
         return Number(sourceAnswer) < Number(value);
      case 'greater_than_or_equal':
         return Number(sourceAnswer) >= Number(value);
      case 'less_than_or_equal':
         return Number(sourceAnswer) <= Number(value);
      default:
         return true;
   }
};

export default evaluateVisibility;