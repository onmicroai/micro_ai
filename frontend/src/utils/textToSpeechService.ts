import axiosInstance from "@/utils/axiosInstance";
import { useConversationStore } from "@/store/conversationStore";

export interface VoicePreview {
  audio_base_64: string;
  generated_voice_id: string;
  media_type: string;
  duration_secs: number;
}

export const synthesizeSpeech = async (
  text: string,
  provider: string,
  voiceId: string = "alloy",
  instructions?: string,
  userId?: number | null,
): Promise<string> => {
  try {
    const store = useConversationStore.getState();
    const currentRun =
      store.currentConversation?.runs[
        store.currentConversation?.runs.length - 1
      ];
    const run_id = currentRun?.id ?? null;

    const payload = {
      text,
      provider,
      voice: voiceId,
      instructions,
      run_id,
    };

    let responseData: { audio_base64: string; cost: number; credits: number };

    if (userId) {
      const api = axiosInstance();
      const response = await api.post("/api/microapps/tts/", payload);
      responseData = response.data;
    } else {
      const response = await fetch("/api/microapps/tts/anonymous/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      responseData = await response.json();
    }

    // Decode base64 audio to a blob URL
    const binaryString = atob(responseData.audio_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);

    // Update local store with the cost/credits returned by the backend
    if (run_id) {
      store.updateRun(run_id, {
        cost: responseData.cost,
        credits: responseData.credits,
      });
    }

    return audioUrl;
  } catch (error) {
    console.error("Error synthesizing speech:", error);
    throw error;
  }
};

let activePlayback: {
  audio: HTMLAudioElement;
  audioData: string;
  stop: () => void;
} | null = null;

export const stopAudio = (): void => {
  activePlayback?.stop();
};

export const playAudio = (audioData: string): Promise<void> => {
  stopAudio();

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioData);

    const cleanup = () => {
      if (audioData.startsWith("blob:")) {
        URL.revokeObjectURL(audioData);
      }
    };

    let settled = false;
    const finish = (result: "ended" | "stopped" | "error", error?: Error) => {
      if (settled) return;
      settled = true;
      activePlayback = null;
      cleanup();
      if (result === "error") {
        reject(error ?? new Error("Audio playback failed"));
      } else {
        resolve();
      }
    };

    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
      finish("stopped");
    };

    activePlayback = { audio, audioData, stop };

    audio.onended = () => finish("ended");

    audio.onerror = () => {
      finish("error", new Error("Audio playback failed"));
    };

    audio.play().catch((error) => {
      console.error("Error playing audio:", error);
      finish("error", error);
    });
  });
};
