import { convertToWav } from './audioUtils';
import axiosInstance from './axiosInstance';

export const transcribeAudio = async (blob: Blob, userId?: number | null): Promise<{ text: string; cost: number }> => {
  try {
    const wavBlob = await convertToWav(blob);
    const formData = new FormData();
    formData.append('audio', wavBlob, 'audio.wav');

    let response;
    if (userId) {
      // Authenticated request using axiosInstance
      const api = axiosInstance();
      response = await api.post('/api/microapps/transcribe/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.status !== 200) {
        throw new Error('Transcription failed');
      }
      return {
        text: response.data.text,
        cost: response.data.cost
      };
    } else {
      // Anonymous request using fetch to the anonymous endpoint
      response = await fetch('/api/microapps/transcribe/anonymous/', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      const data = await response.json();
      return {
        text: data.text,
        cost: data.cost
      };
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}; 