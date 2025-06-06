import { useUserStore } from '@/store/userStore';

if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not defined in environment variables');
}

if (!process.env.NEXT_PUBLIC_HUME_API_KEY) {
  throw new Error('HUME_API_KEY is not defined in environment variables');
}

if (!process.env.NEXT_PUBLIC_ELEVENLABS_COST_PER_CHARACTER) {
  throw new Error('NEXT_PUBLIC_ELEVENLABS_COST_PER_CHARACTER is not defined in environment variables');
}

if (!process.env.NEXT_PUBLIC_HUME_COST_PER_CHARACTER) {
   throw new Error('NEXT_PUBLIC_HUME_COST_PER_CHARACTER is not defined in environment variables');
 }

import { useConversationStore } from '@/store/conversationStore';
import { updateRunUtil } from './sendPrompts';

// Initialize clients
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const HUME_API_KEY = process.env.NEXT_PUBLIC_HUME_API_KEY;
const ELEVENLABS_COLLECTION_ID = process.env.NEXT_PUBLIC_ELEVENLABS_COLLECTION_ID;
const ELEVENLABS_COST_PER_CHARACTER = parseFloat(process.env.NEXT_PUBLIC_ELEVENLABS_COST_PER_CHARACTER);
const HUME_COST_PER_CHARACTER = parseFloat(process.env.NEXT_PUBLIC_HUME_COST_PER_CHARACTER);

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export interface VoicePreview {
  audio_base_64: string;
  generated_voice_id: string;
  media_type: string;
  duration_secs: number;
}

export interface VoicePreviewResponse {
  previews: VoicePreview[];
  text: string;
}

export interface HumeVoiceResponse {
  voiceId: string;
  audioBase64: string;
  duration: number;
}

export const getElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  try {
    // Build the API URL with optional collection_id parameter
    let apiUrl = 'https://api.elevenlabs.io/v2/voices';
    if (ELEVENLABS_COLLECTION_ID) {
      apiUrl += `?collection_id=${ELEVENLABS_COLLECTION_ID}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Xi-Api-Key': `${ELEVENLABS_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch voices');
    }

    const data = await response.json();
    return data.voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category
    }));
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [];
  }
};

const updateTTSCosts = async (text: string, provider: 'elevenlabs' | 'hume') => {
  const store = useConversationStore.getState();
  const currentRun = store.currentConversation?.runs[store.currentConversation?.runs.length - 1];

  if (currentRun) {
    const userStore = useUserStore.getState();
    const user = userStore.user;

    // Calculate cost based on text length and provider
    const costPerCharacter = provider === 'elevenlabs' ? ELEVENLABS_COST_PER_CHARACTER : HUME_COST_PER_CHARACTER;
    const ttsCost = text.length * costPerCharacter;

    // Update the run with TTS costs
    await updateRunUtil(
      currentRun.id,
      {
        cost: (currentRun.cost || 0) + ttsCost,
      },
      user?.id || null
    );
  }
};

export const synthesizeElevenLabsSpeech = async (
  text: string,
  voiceId: string
): Promise<string> => {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'JBFqnCBsd6RMkjVDRZzb'}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'Xi-Api-Key': `${ELEVENLABS_API_KEY}`
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('ElevenLabs API request failed');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Update costs
    await updateTTSCosts(text, 'elevenlabs');

    return audioUrl;
  } catch (error) {
    console.error('Error synthesizing speech with ElevenLabs:', error);
    throw error;
  }
};

export const synthesizeSpeech = async (
  text: string, 
  provider: string,
  voiceId?: string
): Promise<string> => {
  try {
    if (provider === 'elevenlabs') {
      return await synthesizeElevenLabsSpeech(text, voiceId || '');
    } else if (provider === 'hume') {
      return await synthesizeHumeSpeech(text, voiceId || '');
    }
    throw new Error('Invalid TTS provider');
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

export const generateAndSaveHumeVoice = async (
  text: string,
  description: string
): Promise<HumeVoiceResponse> => {
  try {
    // First, generate the voice
    const generateResponse = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        utterances: [
          {
            text,
            description
          }
        ]
      })
    });

    if (!generateResponse.ok) {
      throw new Error('Failed to generate voice with Hume');
    }

    const generateData = await generateResponse.json();
    const generationId = generateData.generations[0].generation_id;
    const audioBase64 = generateData.generations[0].audio;
    const duration = generateData.generations[0].duration;

    // Then save the voice
    const saveResponse = await fetch('https://api.hume.ai/v0/tts/voices', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Custom Voice ${new Date().toISOString()}`,
        generation_id: generationId
      })
    });

    if (!saveResponse.ok) {
      throw new Error('Failed to save voice with Hume');
    }

    const saveData = await saveResponse.json();
    console.log("Voice saved with ID:", saveData.id);

    return {
      voiceId: saveData.id,  // Use the id from the save response
      audioBase64,
      duration
    };
  } catch (error) {
    console.error('Error generating and saving Hume voice:', error);
    throw error;
  }
};

export const synthesizeHumeSpeech = async (
  text: string,
  voiceId: string
): Promise<string> => {
  try {
    const response = await fetch('https://api.hume.ai/v0/tts', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        utterances: [
          {
            text,
            voice: {
              id: voiceId
            }
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to synthesize speech with Hume');
    }

    const data = await response.json();
    const audioBase64 = data.generations[0].audio;

    // Update costs
    await updateTTSCosts(text, 'hume');
    
    // Convert base64 to blob URL
    const audioBlob = new Blob([Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))], {
      type: 'audio/mpeg'
    });
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('Error synthesizing speech with Hume:', error);
    throw error;
  }
};
