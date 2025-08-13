// src/app/(dashboard)/manager/files/page.tsx - MANAGER FILES
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  FileText, 
  Upload, 
  Download, 
  Search, 
  Video,
  Music,
  File,
  Trash2,
  Eye,
  FolderOpen,
  Grid3X3,
  List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTimeAgo } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface ProjectFile {
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

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'image': return <div className="h-5 w-5 bg-blue-100 rounded flex items-center justify-center"><span className="text-blue-600 text-xs">🖼️</span></div>;
    case 'video': return <Video className="h-5 w-5 text-purple-600" />;
    case 'audio': return <Music className="h-5 w-5 text-green-600" />;
    case 'document': return <FileText className="h-5 w-5 text-red-600" />;
    default: return <File className="h-5 w-5 text-gray-600" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ManagerFilesPage() {
  const { data: _session } = useSession();
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState<Array<{_id: string, title: string}>>([]);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files?manager=true');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.data.files || []);
        setStats(data.data.stats || null);
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      console.error('Error fetching files:', _error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load files",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?manager=true&limit=100');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data.data || []);
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      console.error('Error fetching projects:', _error);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchProjects();
  }, [fetchFiles, fetchProjects]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload files smaller than 10MB",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', selectedProject === 'all' ? projects[0]?._id || '' : selectedProject);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "File uploaded",
          description: "File has been uploaded successfully",
        });
        await fetchFiles();
      } else {
        throw new Error('Upload failed');
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload file",
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const downloadFile = async (file: ProjectFile) => {
    try {
      const response = await fetch(`/api/files/${file._id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Failed to download file",
      });
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "File deleted",
          description: "File has been deleted successfully",
        });
        await fetchFiles();
      } else {
        throw new Error('Delete failed');
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete file",
      });
    }
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = searchQuery === '' || 
      file.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesProject = selectedProject === 'all' || file.project._id === selectedProject;
    
    return matchesSearch && matchesCategory && matchesProject;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Files</h1>
          <p className="text-gray-600 mt-1">Manage files for your projects</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label htmlFor="file-upload">
            <Button disabled={uploading} className="flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Files</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                {formatFileSize(stats.totalSize)} total size
              </div>
            </CardContent>
          </Card>

          {Object.entries(stats.byCategory).map(([category, count]) => (
            <Card key={category}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 capitalize">{category}s</p>
                    <p className="text-3xl font-bold text-gray-900">{count}</p>
                  </div>
                  {getCategoryIcon(category)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Display */}
      <Card>
        <CardHeader>
          <CardTitle>
            Files ({filteredFiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || selectedCategory !== 'all' || selectedProject !== 'all'
                  ? 'No files match your current filters.'
                  : 'No files have been uploaded yet.'
                }
              </p>
              {(searchQuery || selectedCategory !== 'all' || selectedProject !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedProject('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <div 
                  key={file._id} 
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {getCategoryIcon(file.category)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{file.originalName}</h3>
                      <Badge variant="outline" className="text-xs">
                        {file.category}
                      </Badge>
                      {file.isPublic && (
                        <Badge variant="secondary" className="text-xs">
                          Public
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.project.title}</span>
                      <span>•</span>
                      <span>Uploaded by {file.uploadedBy.name}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(new Date(file.createdAt))}</span>
                      {file.downloadCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{file.downloadCount} downloads</span>
                        </>
                      )}
                    </div>
                    
                    {file.description && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-1">{file.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteFile(file._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <Card key={file._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-center h-16 mb-3">
                      {file.category === 'image' ? (
                        <Image 
                          src={file.url} 
                          alt={`Preview of ${file.originalName}`}
                          width={64}
                          height={64}
                          className="h-16 w-16 object-cover rounded"
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-100 rounded flex items-center justify-center">
                          {getCategoryIcon(file.category)}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2">
                      {file.originalName}
                    </h3>
                    
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                      <span>{formatFileSize(file.size)}</span>
                      <Badge variant="outline" className="text-xs">
                        {file.category}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => downloadFile(file)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteFile(file._id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}