// src/components/files/FilesClient.tsx - NEW CLIENT COMPONENT
'use client';

import { useState } from 'react';
import FileUpload from '@/components/files/FileUpload';
import FilesList from '@/components/files/FilesList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { File, Image as ImageIcon, Video, FileText, Download } from 'lucide-react';

// Define proper TypeScript interfaces
interface FileData {
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

interface FileStats {
  total: number;
  totalSize: number;
  byCategory: Record<string, number>;
}

interface UserProject {
  _id: string;
  title: string;
}

interface FilesClientProps {
  files: FileData[];
  stats: FileStats;
  userProjects: UserProject[];
  userRole: string;
}

export default function FilesClient({ files, stats, userProjects, userRole }: FilesClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUploadComplete = () => {
    setRefreshKey(prev => prev + 1);
    // Refresh the page to show new files
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Files</h1>
          <p className="text-gray-600 mt-1">
            Manage project files, images, and documents.
          </p>
        </div>
      </div>

      {/* File Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(stats.totalSize)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.image || 0}</div>
            <p className="text-xs text-muted-foreground">
              Photos & graphics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.document || 0}</div>
            <p className="text-xs text-muted-foreground">
              PDFs & docs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.video || 0}</div>
            <p className="text-xs text-muted-foreground">
              Video files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Other</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.byCategory.audio || 0) + (stats.byCategory.other || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Audio & misc
            </p>
          </CardContent>
        </Card>
      </div>

      {/* File Upload Section */}
      {userProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload 
              projectId={userProjects[0]._id}
              onUploadComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      <FilesList key={refreshKey} files={files} userRole={userRole} />
    </div>
  );
}