// src/components/files/SecureFileUpload.tsx - SECURE FILE UPLOAD WITH PROJECT ACCESS
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, File, Image as ImageIcon, Video, Music, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

// Define proper TypeScript interfaces
interface FileUploadResponse {
  success: boolean;
  data: FileData;
  message: string;
}

interface FileData {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: string;
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
}

interface UserProject {
  _id: string;
  title: string;
}

interface SecureFileUploadProps {
  userRole: string;
  onUploadComplete?: (file: FileData) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  preSelectedProjectId?: string;
}

interface UploadFile {
  file: File;
  id: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'text/plain', 'text/csv'
];

export default function SecureFileUpload({ 
  userRole, 
  onUploadComplete, 
  maxFiles = 10, 
  acceptedTypes = ACCEPTED_TYPES,
  preSelectedProjectId 
}: SecureFileUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(preSelectedProjectId || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's uploadable projects
  const fetchUserProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/files/projects');
      if (response.ok) {
        const data = await response.json();
        setUserProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'project_manager') {
      fetchUserProjects();
    }
  }, [userRole, fetchUserProjects]);

  const handleFileSelect = useCallback((fileList: FileList) => {
    const newFiles = Array.from(fileList).slice(0, maxFiles - files.length);
    
    // Validate each file
    const validFiles = newFiles.filter(file => {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} exceeds 50MB limit`
        });
        return false;
      }
      
      if (!acceptedTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: `${file.name} is not an allowed file type`
        });
        return false;
      }
      
      return true;
    });

    const newUploadFiles: UploadFile[] = validFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newUploadFiles]);
  }, [files.length, maxFiles, acceptedTypes, toast]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    if (!selectedProjectId) {
      throw new Error('Please select a project');
    }

    const formData = new FormData();
    formData.append('file', uploadFile.file);
    formData.append('projectId', selectedProjectId);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('isPublic', isPublic.toString());

    try {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result: FileUploadResponse = await response.json();

      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));

      onUploadComplete?.(result.data);

      toast({
        title: 'Success',
        description: `${uploadFile.file.name} uploaded successfully`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: errorMessage }
          : f
      ));

      throw error;
    }
  };

  const uploadAllFiles = async () => {
    if (!selectedProjectId) {
      toast({
        variant: 'destructive',
        title: 'Project required',
        description: 'Please select a project before uploading'
      });
      return;
    }

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      return;
    }

    setLoading(true);
    
    try {
      for (const file of pendingFiles) {
        await uploadFile(file);
      }
      
      // Clear form after successful upload
      setDescription('');
      setTags('');
      setIsPublic(false);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  }, [handleFileSelect]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-6 w-6" />;
    if (mimeType.startsWith('video/')) return <Video className="h-6 w-6" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-6 w-6" />;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="h-6 w-6" />;
    return <File className="h-6 w-6" />;
  };

  // Only allow upload for super admin and project managers
  if (userRole === 'client') {
    return (
      <Card className="border-2 border-gray-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            File uploads are not available for clients. Please contact your project manager to upload files.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      {!preSelectedProjectId && (
        <div className="space-y-2">
          <Label htmlFor="project">Select Project *</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a project to upload files to" />
            </SelectTrigger>
            <SelectContent>
              {userProjects.map(project => (
                <SelectItem key={project._id} value={project._id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {userProjects.length === 0 && (
            <p className="text-sm text-gray-500">
              No projects available for file upload
            </p>
          )}
        </div>
      )}

      {/* Upload Area */}
      <Card className={`border-2 border-dashed transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-gray-300'
      }`}>
        <CardContent className="p-8">
          <div
            className="text-center"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to upload
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Support for images, documents, videos, and audio files (max 50MB each)
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedProjectId}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={acceptedTypes.join(',')}
              onChange={handleInputChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* File Details */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe these files..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="design, final, approved"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <div className="mt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Make files publicly accessible</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Files to Upload ({files.length})</h3>
            <Button 
              onClick={uploadAllFiles}
              disabled={files.every(f => f.status !== 'pending') || loading || !selectedProjectId}
            >
              {loading ? 'Uploading...' : 'Upload All'}
            </Button>
          </div>

          <div className="space-y-2">
            {files.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                {/* File Icon/Preview */}
                <div className="flex-shrink-0">
                  {uploadFile.preview ? (
                    <div className="relative w-12 h-12">
                      <Image
                        src={uploadFile.preview}
                        alt={uploadFile.file.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                      {getFileIcon(uploadFile.file.type)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{uploadFile.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(uploadFile.file.size)}</p>
                  
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-2">
                      <Progress value={uploadFile.progress} className="h-1" />
                    </div>
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center space-x-2">
                  {uploadFile.status === 'success' && (
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                  )}
                  
                  {uploadFile.status === 'uploading' && (
                    <div className="w-6 h-6">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    disabled={uploadFile.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}