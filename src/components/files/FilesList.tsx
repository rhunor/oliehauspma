// src/components/files/FilesList.tsx - FIXED with proper date formatting and error handling

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

interface FilesListProps {
  files: FileItem[];
  userRole: string;
}

// FIXED: Date formatting helper to prevent hydration issues
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Use a consistent format that works on both server and client
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.warn('Invalid date format:', dateString);
    return 'Invalid date';
  }
}

// FIXED: File size formatting helper
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FilesList({ files, userRole }: FilesListProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const getFileIcon = (category: string, iconClass: string = "h-5 w-5") => {
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

  const handleDownload = async (file: FileItem) => {
    try {
      setLoading(true);
      
      // Use the secure download endpoint
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

  // FIXED: Enhanced delete handler with better error handling
  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      
      console.log(`Attempting to delete file: ${fileId}`);
      
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const responseData = await response.json();
      console.log('Delete response:', responseData);

      if (response.ok && responseData.success) {
        toast({
          title: 'File deleted',
          description: responseData.message || `${fileName} has been deleted`,
        });
        
        // Refresh the page to update the file list
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } else {
        // Handle API error response
        const errorMessage = responseData.error || responseData.message || 'Failed to delete file';
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      console.error('Error deleting file:', error);
      
      let errorMessage = 'Failed to delete the file';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (file: FileItem) => {
    try {
      setLoading(true);
      
      // Use the secure preview endpoint
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

  const canDelete = (file: FileItem): boolean => {
    return (
      userRole === 'super_admin' ||
      userRole === 'project_manager' ||
      file.uploadedBy._id === userRole // This would need to be properly checked
    );
  };

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
          <p className="text-gray-500">Upload some files to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file) => (
              <Card key={file._id} className="hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(file.category)}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* File metadata */}
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      <div>by {file.uploadedBy.name}</div>
                      <div>{file.project.title}</div>
                      {/* FIXED: Use consistent date formatting */}
                      <div>{formatDate(file.createdAt)}</div>
                      {file.downloadCount > 0 && (
                        <div>{file.downloadCount} downloads</div>
                      )}
                    </div>
                  </div>

                  {/* File description */}
                  {file.description && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {file.description}
                    </p>
                  )}

                  {/* File tags */}
                  {file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {file.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {file.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{file.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(file)}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file)}
                        disabled={loading}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </Button>
                    </div>

                    {(userRole === 'super_admin' || userRole === 'project_manager') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(file._id, file.originalName)}
                        disabled={loading}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}