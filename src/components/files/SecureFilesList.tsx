// ========================================
// UPDATED SECURE FILES LIST COMPONENT - Using [id] endpoints
// ========================================

'use client';

import { useState } from 'react';
import { 
  File, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileText,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

interface SecureFilesListProps {
  files: FileItem[];
  userRole: string;
  canDelete?: boolean;
}

export default function SecureFilesList({ files, userRole, canDelete = false }: SecureFilesListProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Secure file preview - FIXED: Using [id] endpoint
  const handlePreview = async (file: FileItem) => {
    try {
      setLoading(true);
      
      // FIXED: Use /api/files/[id]/preview instead of /api/files/[fileId]/preview
      const previewUrl = `/api/files/${file._id}/preview`;
      
      // For images and PDFs, open directly
      if (file.category === 'image' || file.mimeType === 'application/pdf') {
        window.open(previewUrl, '_blank');
      } else {
        // For other file types, show message and offer download
        toast({
          title: 'Preview not available',
          description: `Preview is not available for ${file.category} files. Click download to view the file.`,
        });
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      toast({
        variant: 'destructive',
        title: 'Preview failed',
        description: 'Failed to open file preview',
      });
    } finally {
      setLoading(false);
    }
  };

  // Secure file download - FIXED: Using [id] endpoint
  const handleDownload = async (file: FileItem) => {
    try {
      setLoading(true);
      
      // FIXED: Use /api/files/[id]/download instead of /api/files/[fileId]/download
      const downloadUrl = `/api/files/${file._id}/download`;
      
      // Create hidden link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.originalName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download started',
        description: `Downloading ${file.originalName}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Failed to download the file',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'You do not have permission to delete files',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      // FIXED: Use /api/files/[id] instead of /api/files/[fileId]
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'File deleted',
          description: `${fileName} has been permanently deleted`,
        });
        // Refresh the page to update the file list
        window.location.reload();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete the file',
      });
    } finally {
      setLoading(false);
    }
  };

  // Rest of the component remains the same...
  // (File rendering logic, etc.)

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <File className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Found</h3>
          <p className="text-gray-600">No files have been uploaded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file) => (
        <Card key={file._id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <FileText className="h-8 w-8" />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(file)}
                  disabled={loading}
                  title="Preview file"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  disabled={loading}
                  title="Download file"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file._id, file.originalName)}
                    disabled={loading}
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            
            <h3 className="font-medium text-sm mb-2 line-clamp-2" title={file.originalName}>
              {file.originalName}
            </h3>
            
            <div className="text-xs text-gray-500">
              <div>Project: {file.project.title}</div>
              <div>Uploaded: {new Date(file.createdAt).toLocaleDateString()}</div>
              <div>Downloads: {file.downloadCount}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
