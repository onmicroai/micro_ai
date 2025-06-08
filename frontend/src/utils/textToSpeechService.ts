import { useUserStore } from '@/store/userStore';
import axiosInstance from "@/utils/axiosInstance";

if (!process.env.NEXT_PUBLIC_OPENAI_COST_PER_CHARACTER) {
   throw new Error('NEXT_PUBLIC_OPENAI_COST_PER_CHARACTER is not defined in environment variables');
}
   

import { useConversationStore } from '@/store/conversationStore';
import { updateRunUtil } from './sendPrompts';

// Initialize clients
const OPENAI_COST_PER_CHARACTER = parseFloat(process.env.NEXT_PUBLIC_OPENAI_COST_PER_CHARACTER) || 0.000009;



export interface VoicePreview {
  audio_base_64: string;
  generated_voice_id: string;
  media_type: string;
  duration_secs: number;
}


const updateTTSCosts = async (text: string, provider: 'openai') => {
  const store = useConversationStore.getState();
  const currentRun = store.currentConversation?.runs[store.currentConversation?.runs.length - 1];

  if (currentRun) {
    const userStore = useUserStore.getState();
    const user = userStore.user;

    // TODO: Support other TTS providers
    if (provider !== 'openai') {
      throw new Error(`Unsupported TTS provider: ${provider}. Only 'openai' is currently supported.`);
    }
    const costPerCharacter = OPENAI_COST_PER_CHARACTER;
    const ttsCost = text.length * costPerCharacter;

    // Update the run with TTS costs in the backend
    const updateResponse = await updateRunUtil(
      currentRun.id,
      {
        cost: (currentRun.cost || 0) + ttsCost,
      },
      user?.id || null
    );

    // updateRunUtil already handles the store update, no need to do it again
    if (!updateResponse.success) {
      console.error('Failed to update run costs:', updateResponse.error);
    }
  }
};
export const synthesizeSpeech = async (
  text: string,
  provider: string,
  voiceId: string = 'alloy',
  instructions?: string
): Promise<string> => {
  try {
    const api = axiosInstance();
    const response = await api.post('/api/microapps/tts/', {
      text,
      provider: provider,
      voice: voiceId,
      instructions
    }, {
      responseType: 'blob'  // Important: This tells axios to handle the response as a blob
    });

    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    // Update costs
    await updateTTSCosts(text, 'openai');

    return audioUrl;
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
};

export const playAudio = (audioData: string): void => {
   const audio = new Audio(audioData);
   audio.play().catch(error => {
     console.error('Error playing audio:', error);
   });
};

