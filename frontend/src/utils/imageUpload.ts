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
  status?: string;
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

    // Images use a timestamp suffix to guarantee unique S3 keys (presigned POST).
    // Documents use the sanitized original name so re-uploading the same file
    // hits the same S3 key and the backend can skip re-embedding.
    const timestamp = new Date().getTime();
    const fileExtension = file.name.split('.').pop();
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const imageFilename = `${baseName}_${timestamp}.${fileExtension}`;
    const documentFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '');

    // Handle image uploads with presigned URLs
    if (this.endpoint === 'upload-image') {
      // Get pre-signed URL from server
      const presignedResponse = await api.post(`/api/microapps/${this.microappId}/${this.endpoint}/`, {
        filename: imageFilename,
        content_type: file.type,
      });

      if (presignedResponse.status !== 200) {
        throw new Error('Failed to get upload URL');
      }

      const { data }: S3UploadResponse = presignedResponse.data;

      // Prepare form data for S3 upload
      const formData = new FormData();
      
      // Add only the fields that are explicitly allowed in the policy
      const allowedFields = [
        'key',
        'policy',
        'x-amz-algorithm',
        'x-amz-credential',
        'x-amz-date',
        'x-amz-signature',
        'Content-Type'
      ];
      
      Object.entries(data.fields).forEach(([key, value]) => {
        if (allowedFields.includes(key)) {
          formData.append(key, value);
        }
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
        filename: imageFilename
      };
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