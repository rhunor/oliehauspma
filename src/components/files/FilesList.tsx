// src/components/files/FilesList.tsx - FIXED: Responsive with icon-only buttons
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
  Trash2,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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

export default function FilesList({ files, userRole }: FilesListProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Filter files based on search and category
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.project.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

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

  const handleDownload = async (file: FileItem) => {
    try {
      setLoading(true);
      
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count
      try {
        await fetch(`/api/files/${file._id}/download`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Error updating download count:', error);
      }

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
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Failed to delete the file',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (file: FileItem) => {
    if (file.category === 'image') {
      window.open(file.url, '_blank');
    } else if (file.category === 'document' && file.mimeType === 'application/pdf') {
      window.open(file.url, '_blank');
    } else {
      handleDownload(file);
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
    <div className="space-y-4 sm:space-y-6">
      {/* Search and Filter Bar - Mobile Optimized */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 sm:h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400 sm:hidden" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-10 sm:h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Files</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredFiles.map((file) => (
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
                  
                  {(userRole === 'super_admin' || file.uploadedBy._id === userRole) && (
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
              
              {/* File Name - Responsive Text */}
              <h3 className="font-medium text-sm sm:text-base mb-2 line-clamp-2 leading-tight" title={file.originalName}>
                {file.originalName}
              </h3>
              
              {/* File Details */}
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs px-2 py-0">
                    {file.category}
                  </Badge>
                  <span>{formatFileSize(file.size)}</span>
                </div>
                
                {/* Project info - truncated for mobile */}
                <div className="line-clamp-1" title={file.project.title}>
                  <span className="font-medium">Project:</span> {file.project.title}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  <span>{file.downloadCount} downloads</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results Summary */}
      <div className="text-center text-sm text-gray-500 pt-4">
        Showing {filteredFiles.length} of {files.length} files
      </div>
    </div>
  );
}