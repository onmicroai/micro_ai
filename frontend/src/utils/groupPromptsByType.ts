import { Prompt } from "@/app/(authenticated)/app/types";

const groupPromptsByType = (prompts: Prompt[]): Record<string, Prompt[]> => {
   return prompts.reduce((acc, prompt) => {
      const type = prompt.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(prompt);
      return acc;
   }, {} as Record<string, Prompt[]>);
};

export default groupPromptsByType;