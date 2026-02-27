import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logInfo, logError, logAudit } from '@/lib/logger';

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // Video
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
]);

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting
    const rateLimitResult = await rateLimit(request, rateLimitPresets.upload);
    if (rateLimitResult) return rateLimitResult;

    // 3. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'olivehaus/general';
    const projectId = formData.get('projectId')?.toString() || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 4. Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // 5. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      logError('File upload rejected — disallowed type', { type: file.type, userId: session.user.id }, 'UPLOAD');
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed.` },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    logInfo('Starting Cloudinary upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folder,
      projectId,
      userId,
    }, 'UPLOAD');

    // 6. Convert File to Buffer (required by Cloudinary Node SDK)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Upload to Cloudinary
    const result = await uploadToCloudinary({
      buffer,
      originalName: file.name,
      folder: projectId ? `olivehaus/projects/${projectId}` : `olivehaus/${folder}`,
      metadata: {
        uploadedBy: userId,
        projectId: projectId || 'general',
        originalName: file.name,
      },
    });

    logAudit('File uploaded to Cloudinary', userId, {
      fileName: file.name,
      fileSize: file.size,
      url: result.secureUrl,
      publicId: result.publicId,
      projectId,
      folder,
    });

    return NextResponse.json(
      { success: true, url: result.secureUrl, key: result.publicId },
      { status: 200 }
    );

  } catch (error) {
    logError('File upload failed', error, 'UPLOAD');
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
