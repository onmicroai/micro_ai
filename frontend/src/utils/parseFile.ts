import axiosInstance from "./axiosInstance";
import axios from "axios";

export interface ParseFileResult {
  text: string;
  word_count: number;
  filename: string;
}

export class ParseFileError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ParseFileError";
    this.status = status;
  }
}

/**
 * Send a document to the backend for on-the-fly text extraction. The backend
 * must be authenticated.
 */
export async function parseFile(file: File): Promise<ParseFileResult> {
  const api = axiosInstance();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  formData.append("content_type", file.type);

  try {
    const response = await api.post("/api/microapps/parse-file/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data.data as ParseFileResult;
  } catch (error) {
    let message = "Failed to parse file.";
    let status: number | undefined;

    if (axios.isAxiosError(error)) {
      status = error.response?.status;
      // backend sends {error: "msg"}
      const backendMsg = (error.response?.data as any)?.error;
      if (backendMsg) message = backendMsg;
      else if (status === 401) message = "You need to log in to upload files.";
      else if (status === 403) message = "You don't have permission to upload files.";
    }

    throw new ParseFileError(message, status);
  }
} 