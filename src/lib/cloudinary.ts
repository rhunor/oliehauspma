// src/lib/cloudinary.ts
// Cloudinary upload helper — handles all media uploads for OliveHaus PPMA

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  key: string;
  resourceType: string;
  format: string;
  bytes: number;
}

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure delivery URL and public_id.
 */
export async function uploadToCloudinary(params: {
  buffer: Buffer;
  originalName: string;
  folder?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  metadata?: Record<string, string>;
}): Promise<CloudinaryUploadResult> {
  const {
    buffer,
    originalName,
    folder = 'olivehaus',
    resourceType = 'auto',
    metadata = {},
  } = params;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        context: Object.entries(metadata)
          .map(([k, v]) => `${k}=${v}`)
          .join('|'),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          key: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a resource from Cloudinary by its public_id.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Extract a Cloudinary public_id from a secure URL.
 * Input:  https://res.cloudinary.com/{cloud}/{type}/upload/v{ver}/{folder}/{name}.{ext}
 * Output: {folder}/{name}
 */
export function extractCloudinaryPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
