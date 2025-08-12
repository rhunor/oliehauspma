// src/components/files/FileUpload.tsx
'use client';

import { useState, useRef } from 'react';
import { Upload, X, File, Image as ImageIcon, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  createdAt: string;
}

interface FileUploadProps {
  projectId: string;
  onUploadComplete?: (file: FileData) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

interface UploadFile {
  file: File;
  id: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface ValidationResult {
  valid: File[];
  invalid: Array<{ file: File; error: string }>;
}

export default function FileUpload({
  projectId,
  onUploadComplete,
  maxFiles = 10,
  acceptedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'video/mp4', 'video/mpeg', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ]
}: FileUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-8 w-8" />;
    if (mimeType.startsWith('video/')) return <Video className="h-8 w-8" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-8 w-8" />;
    return <File className="h-8 w-8" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFiles = (fileList: FileList): ValidationResult => {
    const valid: File[] = [];
    const invalid: Array<{ file: File; error: string }> = [];

    Array.from(fileList).forEach(file => {
      if (!acceptedTypes.includes(file.type)) {
        invalid.push({ file, error: 'File type not supported' });
      } else if (file.size > 50 * 1024 * 1024) { // 50MB
        invalid.push({ file, error: 'File size too large (max 50MB)' });
      } else if (files.length + valid.length >= maxFiles) {
        invalid.push({ file, error: `Maximum ${maxFiles} files allowed` });
      } else {
        valid.push(file);
      }
    });

    return { valid, invalid };
  };

  const handleFileSelect = (fileList: FileList) => {
    const { valid, invalid } = validateFiles(fileList);

    // Show errors for invalid files
    invalid.forEach(({ file, error }) => {
      toast({
        variant: 'destructive',
        title: 'File rejected',
        description: `${file.name}: ${error}`
      });
    });

    // Add valid files
    const newFiles: UploadFile[] = valid.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    formData.append('projectId', projectId);
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

      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: `${uploadFile.file.name}: ${errorMessage}`
      });
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  return (
    <div className="space-y-6">
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
              disabled={files.every(f => f.status !== 'pending')}
            >
              Upload All
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
                    <div className="relative h-12 w-12 rounded overflow-hidden">
                      <Image
                        src={uploadFile.preview}
                        alt={uploadFile.file.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                      {getFileIcon(uploadFile.file.type)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(uploadFile.file.size)}
                  </p>
                  
                  {/* Progress/Status */}
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <p className="text-sm text-red-600 mt-1">{uploadFile.error}</p>
                  )}
                  
                  {uploadFile.status === 'success' && (
                    <p className="text-sm text-green-600 mt-1">Uploaded successfully</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  {uploadFile.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}