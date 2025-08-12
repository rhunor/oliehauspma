// src/components/files/FilesList.tsx
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
  MoreVertical,
  Search,
  Grid,
  List
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import Image from 'next/image';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);

  // Filter and sort files
  const filteredFiles = files
    .filter(file => {
      const matchesSearch = file.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.originalName.localeCompare(b.originalName);
        case 'size':
          return b.size - a.size;
        case 'downloads':
          return b.downloadCount - a.downloadCount;
        default:
          return 0;
      }
    });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (category: string) => {
    const iconClass = "h-8 w-8";
    
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
      
      // Create a download link
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count (optional API call)
      try {
        await fetch(`/api/files/${file._id}/download`, {
          method: 'POST'
        });
      } catch (error) {
        // Non-critical error, don't show to user
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

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
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
          description: 'The file has been permanently deleted',
        });
        // Refresh the page to update the file list
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
      // Open image in new tab for preview
      window.open(file.url, '_blank');
    } else if (file.category === 'document' && file.mimeType === 'application/pdf') {
      // Open PDF in new tab
      window.open(file.url, '_blank');
    } else {
      // For other file types, just download
      handleDownload(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="downloads">Downloads</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Display */}
      {filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <File className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-500">
              {searchTerm || categoryFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Upload your first file to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFiles.map((file) => (
            <Card key={file._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {/* File Preview/Icon */}
                <div className="aspect-square bg-gray-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                  {file.category === 'image' ? (
                    <div className="relative w-full h-full cursor-pointer" onClick={() => handlePreview(file)}>
                      <Image
                        src={file.url}
                        alt={file.originalName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="cursor-pointer" onClick={() => handlePreview(file)}>
                      {getFileIcon(file.category)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm line-clamp-2 flex-1">
                      {file.originalName}
                    </h4>
                    
                    <div className="relative group ml-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                      <div className="absolute right-0 top-6 bg-white border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-32">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handlePreview(file)}
                        >
                          <Eye className="h-3 w-3 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleDownload(file)}
                          disabled={loading}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Download
                        </Button>
                        {(userRole === 'super_admin' || file.uploadedBy._id === userRole) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-red-600"
                            onClick={() => handleDelete(file._id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {file.category}
                    </Badge>
                    {file.isPublic && (
                      <Badge variant="secondary" className="text-xs">
                        Public
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>{formatFileSize(file.size)}</div>
                    <div>by {file.uploadedBy.name}</div>
                    <div>{file.project.title}</div>
                    <div>{new Date(file.createdAt).toLocaleDateString()}</div>
                    {file.downloadCount > 0 && (
                      <div>{file.downloadCount} downloads</div>
                    )}
                  </div>

                  {file.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {file.description}
                    </p>
                  )}

                  {file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {file.tags.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {file.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{file.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredFiles.map((file) => (
                <div key={file._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* File Icon */}
                    <div className="flex-shrink-0">
                      {file.category === 'image' ? (
                        <div className="relative w-12 h-12 rounded cursor-pointer" onClick={() => handlePreview(file)}>
                          <Image
                            src={file.url}
                            alt={file.originalName}
                            fill
                            className="object-cover rounded"
                            sizes="48px"
                          />
                        </div>
                      ) : (
                        <div className="cursor-pointer" onClick={() => handlePreview(file)}>
                          {getFileIcon(file.category)}
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {file.originalName}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {file.category}
                        </Badge>
                        {file.isPublic && (
                          <Badge variant="secondary" className="text-xs">
                            Public
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-4">
                          <span>{formatFileSize(file.size)}</span>
                          <span>by {file.uploadedBy.name}</span>
                          <span>{file.project.title}</span>
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          {file.downloadCount > 0 && (
                            <span>{file.downloadCount} downloads</span>
                          )}
                        </div>
                      </div>

                      {file.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                          {file.description}
                        </p>
                      )}

                      {file.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {file.tags.slice(0, 5).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {file.tags.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{file.tags.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(file)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file)}
                        disabled={loading}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {(userRole === 'super_admin' || file.uploadedBy._id === userRole) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file._id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      <div className="text-center text-sm text-gray-500">
        Showing {filteredFiles.length} of {files.length} files
      </div>
    </div>
  );
}