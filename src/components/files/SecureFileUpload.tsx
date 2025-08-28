// src/components/files/SecureFileUpload.tsx - FIXED: NO ANY TYPES, PROPER PROJECT SELECTION
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
// FIXED: Separate imports for types vs constants
import type { 
  FileData, 
  UploadFile, 
  UserProject, 
  FileUploadResponse, 
  SecureFileUploadProps
} from '@/types/files';
import { ACCEPTED_FILE_TYPES } from '@/constants/files';

export default function SecureFileUpload({ 
  userRole, 
  onUploadComplete, 
  maxFiles = 10, 
  acceptedTypes = ACCEPTED_FILE_TYPES,
  preSelectedProjectId 
}: SecureFileUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(preSelectedProjectId || '');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch user's uploadable projects
  const fetchUserProjects = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/files/projects');
      if (response.ok) {
        // FIXED: Proper typing for API response
        const data: { projects: UserProject[] } = await response.json();
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

  const handleFileSelect = useCallback((fileList: FileList): void => {
    const newFiles = Array.from(fileList).slice(0, maxFiles - files.length);
    
    // FIXED: Handle readonly array properly
    const acceptedTypesArray = Array.from(acceptedTypes);
    
    // Validate each file
    const validFiles = newFiles.filter((file: File): boolean => {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} exceeds 50MB limit`
        });
        return false;
      }
      
      if (!acceptedTypesArray.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: `${file.name} is not an allowed file type`
        });
        return false;
      }
      
      return true;
    });

    const newUploadFiles: UploadFile[] = validFiles.map((file: File): UploadFile => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newUploadFiles]);
  }, [files.length, maxFiles, acceptedTypes, toast]);

  const removeFile = useCallback((id: string): void => {
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
        // FIXED: Proper error response typing
        const errorData: { error?: string } = await response.json();
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

  const uploadAllFiles = async (): Promise<void> => {
    // CRITICAL VALIDATION: Must have project selected
    if (!selectedProjectId) {
      toast({
        variant: 'destructive',
        title: 'Project required',
        description: 'Please select a project before uploading files'
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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
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

  // FIXED: JSX namespace error - use React.JSX instead of JSX
  const getFileIcon = (mimeType: string): React.JSX.Element => {
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
      {/* CRITICAL: Project Selection - MUST SELECT PROJECT */}
      {!preSelectedProjectId && (
        <div className="space-y-2">
          <Label htmlFor="project">Select Project *</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a project to upload files to" />
            </SelectTrigger>
            <SelectContent>
              {userProjects.map((project: UserProject) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {userProjects.length === 0 && (
            <p className="text-sm text-red-500">
              No projects available for file upload. Please contact your administrator.
            </p>
          )}
          {!selectedProjectId && (
            <p className="text-sm text-orange-600">
              ⚠️ You must select a project before uploading files
            </p>
          )}
        </div>
      )}

      {/* Upload Area */}
      <Card className={`border-2 border-dashed transition-colors ${
        isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}>
        <CardContent
          className="p-8"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload files to your selected project
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop files here, or click to select files
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={Array.from(acceptedTypes).join(',')}
              onChange={handleInputChange}
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedProjectId}
              variant="outline"
            >
              Select Files
            </Button>
            
            <p className="text-xs text-gray-500 mt-2">
              Maximum {maxFiles} files, 50MB each
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Metadata */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the files you&apos;re uploading..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
            />
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <Label htmlFor="isPublic" className="text-sm">
                Make files public
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Selected Files ({files.length})</h4>
          <div className="space-y-3">
            {files.map((uploadFile) => (
              <div key={uploadFile.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0">
                  {uploadFile.preview ? (
                    <Image
                      src={uploadFile.preview}
                      alt={uploadFile.file.name}
                      width={48}
                      height={48}
                      className="rounded object-cover"
                    />
                  ) : (
                    getFileIcon(uploadFile.file.type)
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(uploadFile.file.size)}
                  </p>
                  
                  {uploadFile.status === 'uploading' && (
                    <Progress value={uploadFile.progress} className="mt-2" />
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1">
                      {uploadFile.error}
                    </p>
                  )}
                  
                  {uploadFile.status === 'success' && (
                    <p className="text-xs text-green-600 mt-1">
                      Upload complete
                    </p>
                  )}
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFile(uploadFile.id)}
                  disabled={uploadFile.status === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={loading}
            >
              Clear All
            </Button>
            <Button
              onClick={uploadAllFiles}
              disabled={loading || !selectedProjectId || files.length === 0}
            >
              {loading ? 'Uploading...' : `Upload ${files.length} File${files.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}