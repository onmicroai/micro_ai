import { HumeClient } from 'hume';

// Check for required API keys
if (!process.env.NEXT_PUBLIC_HUME_API_KEY) {
  throw new Error('HUME_API_KEY is not defined in environment variables');
}

if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not defined in environment variables');
}

// Initialize clients
const HUME_API_KEY = process.env.NEXT_PUBLIC_HUME_API_KEY;
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const hume = new HumeClient({ apiKey: HUME_API_KEY });

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
}

export const getElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
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

type TTSProvider = 'hume' | 'elevenlabs';

export const synthesizeSpeech = async (
  text: string, 
  description?: string,
  provider: TTSProvider = 'hume',
  voiceId?: string
): Promise<string> => {
  try {
    if (provider === 'hume') {
      const response = await hume.tts.synthesizeJson({
        utterances: [
          {
            text,
            ...(description ? { description } : {})
          }
        ]
      });

      if (response.generations && response.generations[0]) {
        const audioData = response.generations[0].audio;
        return `data:audio/mp3;base64,${audioData}`;
      }
    } else {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'JBFqnCBsd6RMkjVDRZzb'}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
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
      return audioUrl;
    }
    
    throw new Error('No audio data received from TTS provider');
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
