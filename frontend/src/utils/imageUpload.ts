import axiosInstance from "./axiosInstance";

interface S3UploadResponse {
  data: {
    url: string;
    fields: {
      key: string;
      policy: string;
      'x-amz-algorithm': string;
      'x-amz-credential': string;
      'x-amz-date': string;
      'x-amz-signature': string;
      'Content-Type': string;
      'success_action_status'?: string;
      'acl'?: string;
    }
  },
  status: number;
}

interface FileUploadResult {
  url?: string;
  filename?: string;
  original_file?: string;
  status?: string;
}

interface FileUploadConfig {
  microappId: string;
  endpoint: string;
}

export class FileUploadService {
  private microappId: string;
  private endpoint: string;

  constructor(config: FileUploadConfig) {
    this.microappId = config.microappId;
    this.endpoint = config.endpoint;
  }

  async uploadFile(file: File): Promise<FileUploadResult> {
    const api = axiosInstance();
    const documentFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '');

    if (this.endpoint === 'upload-image') {
      const isS3 = Boolean(process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN);

      if (isS3) {
        // Original S3 presigned URL flow
        const timestamp = new Date().getTime();
        const fileExtension = file.name.split('.').pop();
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const imageFilename = `${baseName}_${timestamp}.${fileExtension}`;

        const presignedResponse = await api.post(`/api/microapps/${this.microappId}/upload-image/`, {
          filename: imageFilename,
          content_type: file.type,
        });

        if (presignedResponse.status !== 200) {
          throw new Error('Failed to get upload URL');
        }

        const { data }: S3UploadResponse = presignedResponse.data;

        const formData = new FormData();
        const allowedFields = ['key', 'policy', 'x-amz-algorithm', 'x-amz-credential', 'x-amz-date', 'x-amz-signature', 'Content-Type'];
        Object.entries(data.fields).forEach(([key, value]) => {
          if (allowedFields.includes(key)) formData.append(key, value);
        });
        formData.append('file', file);

        const uploadResponse = await fetch(data.url, { method: 'POST', body: formData });
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('S3 upload error:', errorText);
          throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        return {
          url: `https://${process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN}/${data.fields.key}`,
          filename: imageFilename,
        };
      }

      // Local filesystem upload
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post(
        `/api/microapps/${this.microappId}/upload-image/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.status !== 200) {
        throw new Error('Failed to upload image');
      }

      const imageUrl = response.data.data.image_url;
      const url = imageUrl.startsWith('/')
        ? `${process.env.NEXT_PUBLIC_API_URL || ''}${imageUrl}`
        : imageUrl;
      return { url, filename: file.name };
    }

    // Handle document uploads through backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', documentFilename);
    formData.append('content_type', file.type);

    const uploadResponse = await api.post(
      `/api/microapps/${this.microappId}/${this.endpoint}/`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (uploadResponse.status !== 200) {
      throw new Error('Failed to upload file');
    }

    const { data } = uploadResponse.data;

    return {
      original_file: data.original_filename,
      status: data.status,
    };
  }
}

// Create pre-configured instances for common upload types
export const createImageUploader = (microappId: string) => {
  return new FileUploadService({
    microappId,
    endpoint: 'upload-image',
  });
};

export const createFileUploader = (microappId: string) => {
  return new FileUploadService({
    microappId,
    endpoint: 'upload-file',
  });
}; 