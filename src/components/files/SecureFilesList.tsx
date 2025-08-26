// src/components/files/SecureFilesList.tsx - FIXED: Responsive with icon-only buttons
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
import { Badge } from '@/components/ui/badge';
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (category: string, iconClass: string = "h-8 w-8") => {
    switch (category) {
      case 'image':
        return <ImageIcon className={`${iconClass} text-green-500`} />;
      case 'video':
        return <Video className={`${iconClass} text-blue-500`} />;
      case 'audio':
        return <Music className={`${iconClass} text-purple-500`} />;
      case 'document':
        return <FileText className={`${iconClass} text-red-500`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  // Secure file preview - Using [id] endpoint
  const handlePreview = async (file: FileItem) => {
    try {
      setLoading(true);
      
      const previewUrl = `/api/files/${file._id}/preview`;
      
      if (file.category === 'image' || file.mimeType === 'application/pdf') {
        window.open(previewUrl, '_blank');
      } else {
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

  // Secure file download - Using [id] endpoint
  const handleDownload = async (file: FileItem) => {
    try {
      setLoading(true);
      
      const downloadUrl = `/api/files/${file._id}/download`;
      
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
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'File deleted',
          description: `${fileName} has been permanently deleted`,
        });
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

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 sm:p-12 text-center">
          <File className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Files Found</h3>
          <p className="text-gray-600">No files have been uploaded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {files.map((file) => (
        <Card key={file._id} className="group hover:shadow-lg transition-all duration-200">
          <CardContent className="p-3 sm:p-4">
            {/* File Icon and Actions Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-shrink-0">
                {getFileIcon(file.category, "h-6 w-6 sm:h-8 sm:w-8")}
              </div>
              
              {/* Icon-Only Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handlePreview(file)}
                  disabled={loading}
                  title="Preview file"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                    onClick={() => handleDelete(file._id, file.originalName)}
                    disabled={loading}
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* File Name - Responsive Text with Proper Line Clamping */}
            <h3 className="font-medium text-sm sm:text-base mb-2 line-clamp-2 leading-tight break-words" title={file.originalName}>
              {file.originalName}
            </h3>
            
            {/* File Details - Mobile Optimized */}
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs px-2 py-0">
                  {file.category}
                </Badge>
                <span className="text-xs">{formatFileSize(file.size)}</span>
              </div>
              
              {/* Project info - with proper text truncation */}
              <div className="line-clamp-1 break-words" title={`Project: ${file.project.title}`}>
                <span className="font-medium">Project:</span> {file.project.title}
              </div>
              
              {/* Date and downloads - responsive layout */}
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{new Date(file.createdAt).toLocaleDateString()}</span>
                <span className="flex-shrink-0 ml-2">{file.downloadCount} downloads</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}