import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToS3, validateFileType, validateFileSize, generateFileKey } from '@/lib/s3';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'general'; // e.g., 'site-activities'
    const projectId = formData.get('projectId')?.toString() || ''; // Optional for key org

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!validateFileType(file) || !validateFileSize(file, 10)) { // 10MB limit
      return NextResponse.json({ error: 'Invalid file type or size' }, { status: 400 });
    }

    const userId = session.user.id;
    const key = generateFileKey(userId, projectId || 'general', file.name);
    const fullKey = `${folder}/${key}`;

    const result = await uploadFileToS3({
      file,
      key: fullKey,
      contentType: file.type,
      metadata: { uploadedBy: userId, projectId },
    });

    return NextResponse.json({ success: true, url: result.url, key: result.key }, { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}