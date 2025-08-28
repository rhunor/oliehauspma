// src/components/files/FilesClient.tsx - FIXED WITH PROPER PROJECT SELECTION
'use client';

import { useState } from 'react';
import SecureFileUpload from '@/components/files/SecureFileUpload';
import FilesListAdapter from '@/components/files/FilesListAdapter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { File, Image as ImageIcon, Video, FileText, Download } from 'lucide-react';
// FIXED: Separate imports for types vs constants
import type { FileData, FileStats, UserProject, FilesClientProps } from '@/types/files';
import { ACCEPTED_FILE_TYPES } from '@/constants/files';

export default function FilesClient({ files, stats, userProjects, userRole }: FilesClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUploadComplete = (file: FileData): void => {
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(stats.totalSize)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.byCategory.image || 0}
            </div>
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
            <div className="text-2xl font-bold">
              {stats.byCategory.document || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              PDFs & docs
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

      {/* CRITICAL FIX: Replace hardcoded FileUpload with SecureFileUpload for proper project selection */}
      {userProjects.length > 0 && (userRole === 'super_admin' || userRole === 'project_manager') && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <p className="text-sm text-gray-600">
              Select a project and upload files with proper permissions
            </p>
          </CardHeader>
          <CardContent>
            {/* FIXED: Use shared ACCEPTED_FILE_TYPES constant */}
            <SecureFileUpload 
              userRole={userRole}
              onUploadComplete={handleUploadComplete}
              maxFiles={10}
              acceptedTypes={ACCEPTED_FILE_TYPES}
            />
          </CardContent>
        </Card>
      )}

      {/* Show message if no projects available */}
      {userProjects.length === 0 && (userRole === 'super_admin' || userRole === 'project_manager') && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Available</h3>
            <p className="text-gray-600">
              You need at least one project assigned to upload files. Contact your administrator or create a project first.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      <FilesListAdapter key={refreshKey} files={files} userRole={userRole} />
    </div>
  );
}