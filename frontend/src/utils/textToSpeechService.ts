if (!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not defined in environment variables');
}

if (!process.env.NEXT_PUBLIC_HUME_API_KEY) {
  throw new Error('HUME_API_KEY is not defined in environment variables');
}

// Initialize clients
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
const HUME_API_KEY = process.env.NEXT_PUBLIC_HUME_API_KEY;
const ELEVENLABS_COLLECTION_ID = process.env.NEXT_PUBLIC_ELEVENLABS_COLLECTION_ID || 'SePLgcqc28jzdsYca2gm';

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

export const generateVoicePreviews = async (voiceDescription: string): Promise<VoicePreviewResponse> => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/create-previews', {
      method: 'POST',
      headers: {
        'Xi-Api-Key': `${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voice_description: voiceDescription,
        auto_generate_text: true
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate voice previews');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating voice previews:', error);
    throw error;
  }
};

export const playBase64Audio = (base64Audio: string, mediaType: string = 'audio/mpeg'): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const audioBlob = new Blob([Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))], {
        type: mediaType
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Error playing audio'));
      };
      
      audio.play().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

export const saveVoiceFromPreview = async (
  voiceName: string,
  voiceDescription: string,
  generatedVoiceId: string
): Promise<string> => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview', {
      method: 'POST',
      headers: {
        'Xi-Api-Key': `${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voice_name: voiceName,
        voice_description: voiceDescription,
        generated_voice_id: generatedVoiceId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save voice');
    }

    const data = await response.json();
    return data.voice_id;
  } catch (error) {
    console.error('Error saving voice:', error);
    throw error;
  }
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
