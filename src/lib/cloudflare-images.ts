// src/lib/cloudflare-images.ts
// Cloudflare Images upload helper — replaces AWS S3 for image hosting

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_HASH = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;

export interface CloudflareUploadResult {
  url: string;
  key: string;
  imageId: string;
}

/**
 * Upload a file to Cloudflare Images.
 * Returns a public delivery URL: https://imagedelivery.net/{accountHash}/{imageId}/public
 */
export async function uploadToCloudflare(params: {
  file: File;
  metadata?: Record<string, string>;
}): Promise<CloudflareUploadResult> {
  if (!ACCOUNT_ID || !API_TOKEN || !ACCOUNT_HASH) {
    throw new Error(
      'Cloudflare Images not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_IMAGES_ACCOUNT_HASH environment variables.'
    );
  }

  const form = new FormData();
  form.append('file', params.file);

  if (params.metadata) {
    form.append('metadata', JSON.stringify(params.metadata));
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Images upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      `Cloudflare Images API error: ${data.errors?.map((e: { message: string }) => e.message).join(', ')}`
    );
  }

  const imageId: string = data.result.id;
  const publicUrl = `https://imagedelivery.net/${ACCOUNT_HASH}/${imageId}/public`;

  return {
    url: publicUrl,
    key: imageId,
    imageId,
  };
}

/**
 * Delete an image from Cloudflare Images by its image ID.
 */
export async function deleteFromCloudflare(imageId: string): Promise<void> {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('Cloudflare Images not configured.');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1/${imageId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Images delete failed (${response.status}): ${errorText}`);
  }
}

/**
 * Extract a Cloudflare image ID from a delivery URL.
 * Input:  https://imagedelivery.net/{accountHash}/{imageId}/public
 * Output: {imageId}
 */
export function extractCloudflareImageId(url: string): string | null {
  const match = url.match(/imagedelivery\.net\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}
