import axiosInstance from "./axiosInstance";

interface S3UploadResponse {
  data: {
    url: string;  // The S3 bucket URL
    fields: {
      key: string;  // The file path/key in the bucket
      policy: string;
      'x-amz-algorithm': string;
      'x-amz-credential': string;
      'x-amz-date': string;
      'x-amz-signature': string;
      'Content-Type': string;
      'success_action_status'?: string;  // Optional, defaults to 201
      'acl'?: string;  // Optional, if you're setting ACLs
    }
  },
  status: number;
}

interface FileUploadResult {
  url?: string;
  filename?: string;
  original_file?: string;
  text_file?: string;
  word_count?: number;
}

interface FileUploadConfig {
  microappId: string;
  endpoint: string;
  cloudFrontDomain?: string;
}

/**
 * Generic file upload service that handles S3 presigned URLs and direct uploads
 */
export class FileUploadService {
  private microappId: string;
  private endpoint: string;
  private cloudFrontDomain: string;

  constructor(config: FileUploadConfig) {
    this.microappId = config.microappId;
    this.endpoint = config.endpoint;
    this.cloudFrontDomain = config.cloudFrontDomain || process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || '';
  }

  /**
   * Uploads a file using S3 presigned URLs
   * @param file - The file to upload
   * @returns Promise<FileUploadResult> - The URL and filename of the uploaded file
   */
  async uploadFile(file: File): Promise<FileUploadResult> {
    const api = axiosInstance();
    const timestamp = new Date().getTime();
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${file.name.split('.')[0]}_${timestamp}.${fileExtension}`;

    // Handle image uploads with presigned URLs
    if (this.endpoint === 'upload-image') {
      // Get pre-signed URL from server
      const presignedResponse = await api.post(`/api/microapps/${this.microappId}/${this.endpoint}/`, {
        filename: uniqueFilename,
        content_type: file.type,
      });

      if (presignedResponse.status !== 200) {
        throw new Error('Failed to get upload URL');
      }

      const { data }: S3UploadResponse = presignedResponse.data;

      // Prepare form data for S3 upload
      const formData = new FormData();
      
      // Add all fields from the presigned URL response
      Object.entries(data.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Add the file last
      formData.append('file', file);

      // Upload directly to S3
      const uploadResponse = await fetch(data.url, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('S3 Upload Error:', errorText);
        throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // Return the CloudFront URL for images
      return {
        url: `https://${this.cloudFrontDomain}/${data.fields.key}`,
        filename: uniqueFilename
      };
    }

    // Handle document uploads through backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', uniqueFilename);
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

    // Return processed document data
    return {
      original_file: data.original_file,
      text_file: data.text_file,
      word_count: data.word_count
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