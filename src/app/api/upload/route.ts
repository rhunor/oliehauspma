import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToS3, validateFileType, validateFileSize, generateFileKey } from '@/lib/s3';
import { auth, authOptions } from '@/lib/auth';
import { validateFile, sanitizeFilename } from '@/lib/file-validation';
import { rateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { logInfo, logError, logAudit } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Apply rate limiting for uploads
    const rateLimitResult = await rateLimit(request, rateLimitPresets.upload);
    if (rateLimitResult) return rateLimitResult;

    // 3. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'general';
    const projectId = formData.get('projectId')?.toString() || '';

    if (!file) {
      logError('File upload attempt with no file', undefined, 'UPLOAD');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 4. Server-side file validation (comprehensive)
    const validationResult = await validateFile(file, {
      maxSizeBytes: 50 * 1024 * 1024, // 50MB for general uploads
      checkMagicNumbers: true, // Verify actual file type
    });

    if (!validationResult.isValid) {
      logError('File validation failed', { 
        error: validationResult.error,
        fileName: file.name,
        fileType: file.type,
        userId: session.user.id 
      }, 'UPLOAD');
      
      return NextResponse.json({ 
        error: validationResult.error || 'Invalid file' 
      }, { status: 400 });
    }

    // Log warnings if any
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      logInfo('File validation warnings', { 
        warnings: validationResult.warnings,
        fileName: file.name 
      }, 'UPLOAD');
    }

    // 5. Additional legacy validation (keeping for backward compatibility)
    if (!validateFileType(file) || !validateFileSize(file, 50)) {
      return NextResponse.json({ error: 'Invalid file type or size' }, { status: 400 });
    }

    // 6. Sanitize filename
    const sanitizedName = sanitizeFilename(file.name);

    // 7. Generate secure key and upload
    const userId = session.user.id;
    const key = generateFileKey(userId, projectId || 'general', sanitizedName);
    const fullKey = `${folder}/${key}`;

    logInfo('Starting file upload', {
      fileName: sanitizedName,
      fileSize: file.size,
      fileType: file.type,
      folder,
      projectId,
      userId
    }, 'UPLOAD');

    const result = await uploadFileToS3({
      file,
      key: fullKey,
      contentType: file.type,
      metadata: { uploadedBy: userId, projectId },
    });

    // 8. Audit log successful upload
    logAudit('File uploaded successfully', userId, {
      fileName: sanitizedName,
      fileSize: file.size,
      url: result.url,
      projectId,
      folder
    });

    return NextResponse.json({ 
      success: true, 
      url: result.url, 
      key: result.key 
    }, { status: 200 });

  } catch (error) {
    logError('File upload failed', error, 'UPLOAD');
    return NextResponse.json({ 
      error: 'Upload failed. Please try again.' 
    }, { status: 500 });
  }
}