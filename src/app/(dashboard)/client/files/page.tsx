// src/app/(dashboard)/client/files/page.tsx - CLIENT FILES
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  FileText, 
  Download, 
  Search, 
  Video,
  Music,
  File,
  Eye,
  Share,
  FolderOpen,
  Grid3X3,
  List,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTimeAgo } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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
  recent: number;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'image': return <Image src="/icons/image-icon.svg" alt="Image file" width={20} height={20} className="text-blue-600" />;
    case 'video': return <Video className="h-5 w-5 text-purple-600" />;
    case 'audio': return <Music className="h-5 w-5 text-green-600" />;
    case 'document': return <FileText className="h-5 w-5 text-red-600" />;
    default: return <File className="h-5 w-5 text-gray-600" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'image': return 'bg-blue-100 text-blue-800';
    case 'video': return 'bg-purple-100 text-purple-800';
    case 'audio': return 'bg-green-100 text-green-800';
    case 'document': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ClientFilesPage() {
  const { data: _session } = useSession(); // Prefixed with underscore to indicate intentionally unused
  const { toast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [projects, setProjects] = useState<Array<{_id: string, title: string}>>([]);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files?client=true');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.data.files || []);
        setStats(data.data.stats || null);
      }
    } catch (_error) {
      // Prefixed with underscore to indicate intentionally unused
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
      const response = await fetch('/api/projects?client=true&limit=100');
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
        
        toast({
          title: "Download started",
          description: `Downloading ${file.originalName}`,
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Failed to download file",
      });
    }
  };

  const shareFile = async (file: ProjectFile) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: file.originalName,
          text: `Check out this file: ${file.originalName}`,
          url: file.url
        });
      } else {
        // Fallback - copy to clipboard
        await navigator.clipboard.writeText(file.url);
        toast({
          title: "Link copied",
          description: "File link copied to clipboard",
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Share failed",
        description: "Failed to share file",
      });
    }
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = searchQuery === '' || 
      file.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesProject = selectedProject === 'all' || file.project._id === selectedProject;
    
    return matchesSearch && matchesCategory && matchesProject;
  });

  // Group files by category for better organization
  const filesByCategory = filteredFiles.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {} as Record<string, ProjectFile[]>);

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
          <p className="text-gray-600 mt-1">Access all your project documents, designs, and updates</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <Link href="/client/messages">
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Request Files
            </Button>
          </Link>
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
                {formatFileSize(stats.totalSize)} total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Designs & Images</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.byCategory.image || 0}</p>
                </div>
                <div className="h-8 w-8 bg-purple-100 rounded flex items-center justify-center">
                  <span className="text-purple-600 text-lg">🎨</span>
                </div>
              </div>
              <div className="mt-4 text-sm text-purple-600 font-medium">
                Visual content
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.byCategory.document || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-red-600" />
              </div>
              <div className="mt-4 text-sm text-red-600 font-medium">
                Reports & contracts
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Files</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {files.filter(f => {
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return new Date(f.createdAt) > weekAgo;
                    }).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <div className="mt-4 text-sm text-green-600 font-medium">
                This week
              </div>
            </CardContent>
          </Card>
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
                placeholder="Search files by name, description, or tags..."
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
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
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
      <div className="space-y-6">
        {filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery || selectedCategory !== 'all' || selectedProject !== 'all'
                    ? 'No files match your current filters.'
                    : 'No files have been shared with you yet.'
                  }
                </p>
                <div className="flex justify-center gap-3">
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
                  <Link href="/client/messages">
                    <Button>Request Files</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFiles.map((file) => (
              <Card key={file._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-center h-20 mb-4 bg-gray-50 rounded-lg">
                    {file.category === 'image' ? (
                      <Image 
                        src={file.url} 
                        alt={`${file.originalName} preview`}
                        width={80}
                        height={80}
                        className="h-20 w-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        {getCategoryIcon(file.category)}
                        <Badge className={`${getCategoryColor(file.category)} mt-2 text-xs`}>
                          {file.category}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2">
                    {file.originalName}
                  </h3>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{formatTimeAgo(new Date(file.createdAt))}</span>
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
                      onClick={() => shareFile(file)}
                    >
                      <Share className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          Object.keys(filesByCategory).map((category) => (
            <Card key={category}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {getCategoryIcon(category)}
                  <CardTitle className="capitalize">{category}s ({filesByCategory[category].length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filesByCategory[category].map((file) => (
                    <div 
                      key={file._id} 
                      className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {file.category === 'image' ? (
                          <Image 
                            src={file.url} 
                            alt={`${file.originalName} preview`}
                            width={48}
                            height={48}
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                            {getCategoryIcon(file.category)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">{file.originalName}</h3>
                          {file.tags.length > 0 && (
                            <div className="flex gap-1">
                              {file.tags.slice(0, 2).map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
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
                          onClick={() => shareFile(file)}
                        >
                          <Share className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>File Organization Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 bg-blue-100 rounded flex items-center justify-center">
                  <span className="text-blue-600 text-xs">🎨</span>
                </div>
                <span className="font-medium">Design Files</span>
              </div>
              <p className="text-gray-600">
                Mood boards, 3D renders, floor plans, and design concepts for your review and approval.
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-red-600" />
                <span className="font-medium">Documents</span>
              </div>
              <p className="text-gray-600">
                Contracts, invoices, progress reports, and other important project documentation.
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Progress Updates</span>
              </div>
              <p className="text-gray-600">
                Photos and videos showing the current state of your project and completed work.
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Can&apos;t find a specific file? Use the search bar above or message your project manager to request specific documents or updated designs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}