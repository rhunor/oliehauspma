// src/components/files/FilesListAdapter.tsx - FIXED: Interface compatibility layer
'use client';

import FilesList from '@/components/files/FilesList';
import type { FileData, UserRole } from '@/types/files';

// FIXED: Interface adapter for FilesList compatibility
interface FileItem {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  project: {
    _id: string;
    title: string;
  };
  createdAt: string;
  downloadCount: number;
}

interface FilesListAdapterProps {
  files: FileData[];
  userRole: UserRole;
}

// FIXED: Adapter function to convert FileData to FileItem
function convertToFileItem(file: FileData): FileItem {
  return {
    ...file,
    category: file.category as 'image' | 'video' | 'audio' | 'document' | 'other'
  };
}

export default function FilesListAdapter({ files, userRole }: FilesListAdapterProps) {
  // FIXED: Convert FileData[] to FileItem[] for FilesList compatibility
  const adaptedFiles = files.map(convertToFileItem);

  return <FilesList files={adaptedFiles} userRole={userRole} />;
}