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
  url: string;
  filename: string;
}

interface FileUploadConfig {
  microappId: string;
  endpoint: string;  // The specific endpoint to use (e.g., 'upload-image' or 'upload-file')
  cloudFrontDomain?: string;  // Optional CloudFront domain for URL construction
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

    // Generate a unique filename by adding a timestamp
    const timestamp = new Date().getTime();
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${file.name.split('.')[0]}_${timestamp}.${fileExtension}`;

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
    
    // Add all fields from the presigned URL response EXCEPT filename
    // The order of fields is important for S3
    if (data.fields['success_action_status']) {
      formData.append('success_action_status', data.fields['success_action_status']);
    }
    if (data.fields['Content-Type']) {
      formData.append('Content-Type', data.fields['Content-Type']);
    }
    formData.append('key', data.fields.key);
    formData.append('policy', data.fields.policy);
    formData.append('x-amz-algorithm', data.fields['x-amz-algorithm']);
    formData.append('x-amz-credential', data.fields['x-amz-credential']);
    formData.append('x-amz-date', data.fields['x-amz-date']);
    formData.append('x-amz-signature', data.fields['x-amz-signature']);
    if (data.fields['acl']) {
      formData.append('acl', data.fields['acl']);
    }
    
    // Add the file last
    formData.append('file', file);

    try {
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

      // Construct the final URL
      const fileKey = data.fields.key;
      const finalUrl = `https://${this.cloudFrontDomain}/${fileKey}`;
      
      return {
        url: finalUrl,
        filename: uniqueFilename
      };

    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
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