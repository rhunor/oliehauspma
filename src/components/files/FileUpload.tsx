// src/components/files/FileUpload.tsx - FIXED: Mobile responsive with proper layout
'use client';

import { useState, useRef } from 'react';
import { Upload, X, File, Image as ImageIcon, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export default function FileUpload({ 
  projectId, 
  onUploadComplete, 
  maxFiles = 10, 
  acceptedTypes = ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt']
}: FileUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-8 w-8 text-green-500" />;
    } else if (file.type.startsWith('video/')) {
      return <Video className="h-8 w-8 text-blue-500" />;
    } else if (file.type.startsWith('audio/')) {
      return <Music className="h-8 w-8 text-purple-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: UploadFile[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Check file count limit
      if (uploadFiles.length + newFiles.length >= maxFiles) {
        toast({
          variant: 'destructive',
          title: 'File limit reached',
          description: `Maximum ${maxFiles} files allowed`,
        });
        break;
      }

      // Generate preview for images
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }

      const uploadFile: UploadFile = {
        file,
        id: `${file.name}-${Date.now()}-${i}`,
        preview,
        progress: 0,
        status: 'pending'
      };

      newFiles.push(uploadFile);
    }

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const uploadSingleFile = async (uploadFile: UploadFile): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('projectId', projectId);
      formData.append('description', description);
      formData.append('tags', tags);

      // Update status to uploading
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f)
      );

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result: FileUploadResponse = await response.json();

      if (result.success) {
        // Update status to success
        setUploadFiles(prev => 
          prev.map(f => f.id === uploadFile.id ? { ...f, status: 'success' as const, progress: 100 } : f)
        );

        if (onUploadComplete) {
          onUploadComplete(result.data);
        }

        return true;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      // Update status to error
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'error' as const, 
          error: errorMessage 
        } : f)
      );

      return false;
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No files selected',
        description: 'Please select files to upload',
      });
      return;
    }

    setIsUploading(true);

    try {
      const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
      
      // Upload files sequentially to avoid overwhelming the server
      let successCount = 0;
      for (const uploadFile of pendingFiles) {
        const success = await uploadSingleFile(uploadFile);
        if (success) successCount++;
      }

      if (successCount > 0) {
        toast({
          title: 'Upload completed',
          description: `${successCount} file(s) uploaded successfully`,
        });

        // Clear form after successful upload
        setDescription('');
        setTags('');
        
        // Remove successful uploads after a delay
        setTimeout(() => {
          setUploadFiles(prev => prev.filter(f => f.status !== 'success'));
        }, 2000);
      }

      if (successCount < pendingFiles.length) {
        toast({
          variant: 'destructive',
          title: 'Some uploads failed',
          description: `${pendingFiles.length - successCount} file(s) failed to upload`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'An error occurred during upload',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearAll = () => {
    // Revoke object URLs to prevent memory leaks
    uploadFiles.forEach(uploadFile => {
      if (uploadFile.preview) {
        URL.revokeObjectURL(uploadFile.preview);
      }
    });
    setUploadFiles([]);
    setDescription('');
    setTags('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          Upload Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* File Selection Area */}
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files);
          }}
        >
          <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
            Drop files here or click to browse
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Support for images, documents, and other file types
          </p>
          <Button type="button" variant="outline" className="mx-auto">
            Select Files
          </Button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* File Metadata Form */}
        {uploadFiles.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the files..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 h-20"
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (Optional)</Label>
                <Input
                  id="tags"
                  placeholder="blueprint, final, revision (comma-separated)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* File List - Responsive Grid */}
        {uploadFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm sm:text-base">
                Selected Files ({uploadFiles.length})
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={isUploading}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {uploadFiles.map((uploadFile) => (
                <Card key={uploadFile.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {/* File Icon/Preview */}
                    <div className="flex-shrink-0">
                      {uploadFile.preview ? (
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                          <Image
                            src={uploadFile.preview}
                            alt={uploadFile.file.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                      ) : (
                        getFileIcon(uploadFile.file)
                      )}
                    </div>

                    {/* File Info - Responsive Layout */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" title={uploadFile.file.name}>
                            {uploadFile.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(uploadFile.file.size)}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Status Badge */}
                          <Badge 
                            variant={
                              uploadFile.status === 'success' ? 'default' :
                              uploadFile.status === 'error' ? 'destructive' :
                              uploadFile.status === 'uploading' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {uploadFile.status === 'pending' ? 'Ready' :
                             uploadFile.status === 'uploading' ? 'Uploading' :
                             uploadFile.status === 'success' ? 'Done' : 'Failed'}
                          </Badge>

                          {/* Remove Button */}
                          {uploadFile.status !== 'uploading' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => removeFile(uploadFile.id)}
                              title="Remove file"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="mt-2 h-2" />
                      )}

                      {/* Error Message */}
                      {uploadFile.status === 'error' && uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {uploadFiles.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleUpload}
              disabled={isUploading || uploadFiles.every(f => f.status !== 'pending')}
              className="flex-1 sm:flex-none min-h-[44px]"
            >
              {isUploading ? 'Uploading...' : `Upload ${uploadFiles.filter(f => f.status === 'pending').length} Files`}
            </Button>
            
            <div className="text-xs text-gray-500 flex items-center justify-center sm:justify-start">
              Maximum {maxFiles} files allowed
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}