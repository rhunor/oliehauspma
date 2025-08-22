// src/components/reports/DailyReportUpload.tsx - COMPLETE IMPLEMENTATION
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  Upload, 
  Camera, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Plus,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface DailyActivity {
  id?: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  description?: string;
  startTime?: string;
  endTime?: string;
  contractor?: string;
  supervisor?: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress: number;
}

interface DailyReportData {
  projectId: string;
  date: string;
  activities: DailyActivity[];
  summary: {
    totalHours?: number;
    crewSize?: number;
    weatherConditions?: string;
    safetyIncidents?: number;
  };
  photos: File[];
  notes?: string;
}

interface DailyReportUploadProps {
  projectId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function DailyReportUpload({ 
  projectId, 
  onSuccess, 
  onCancel 
}: DailyReportUploadProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [reportData, setReportData] = useState<DailyReportData>({
    projectId: projectId || '',
    date: new Date().toISOString().split('T')[0],
    activities: [],
    summary: {
      crewSize: 0,
      totalHours: 0,
      weatherConditions: '',
      safetyIncidents: 0
    },
    photos: [],
    notes: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [projects, setProjects] = useState<Array<{ _id: string; title: string }>>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Load projects for project managers
  useEffect(() => {
    if (session?.user?.role === 'project_manager' && !projectId) {
      fetchProjects();
    }
  }, [session, projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?manager=true');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Handle file selection with validation
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name} is not an image file`);
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name} is too large (max 5MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      toast({
        variant: "destructive",
        title: "File validation errors",
        description: errors.join(', ')
      });
    }

    if (validFiles.length > 0) {
      // Add to existing files
      const newFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(newFiles);
      
      // Create preview URLs
      const newUrls = validFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
      
      // Update report data
      setReportData(prev => ({
        ...prev,
        photos: newFiles
      }));
    }

    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  }, [selectedFiles, toast]);

  // Remove file
  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    
    // Revoke URL to prevent memory leaks
    URL.revokeObjectURL(previewUrls[index]);
    
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    setReportData(prev => ({
      ...prev,
      photos: newFiles
    }));
  }, [selectedFiles, previewUrls]);

  // Add new activity
  const addActivity = () => {
    const newActivity: DailyActivity = {
      id: Date.now().toString(),
      title: '',
      status: 'pending',
      category: 'other',
      progress: 0
    };

    setReportData(prev => ({
      ...prev,
      activities: [...prev.activities, newActivity]
    }));
  };

  // Update activity
  const updateActivity = (index: number, field: keyof DailyActivity, value: string | number) => {
    setReportData(prev => ({
      ...prev,
      activities: prev.activities.map((activity, i) => 
        i === index ? { ...activity, [field]: value } : activity
      )
    }));
  };

  // Remove activity
  const removeActivity = (index: number) => {
    setReportData(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index)
    }));
  };

  // Submit report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportData.projectId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a project"
      });
      return;
    }

    if (reportData.activities.length === 0) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Please add at least one activity"
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('projectId', reportData.projectId);
      formData.append('date', reportData.date);
      formData.append('activities', JSON.stringify(reportData.activities));
      formData.append('summary', JSON.stringify(reportData.summary));
      formData.append('notes', reportData.notes || '');

      // Add photos
      reportData.photos.forEach((photo, index) => {
        formData.append(`photo_${index}`, photo);
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/daily-reports', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Daily report uploaded successfully"
        });
        
        // Reset form
        setReportData({
          projectId: projectId || '',
          date: new Date().toISOString().split('T')[0],
          activities: [],
          summary: {
            crewSize: 0,
            totalHours: 0,
            weatherConditions: '',
            safetyIncidents: 0
          },
          photos: [],
          notes: ''
        });
        setSelectedFiles([]);
        setPreviewUrls([]);
        
        onSuccess?.();
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to upload report'
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'delayed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Daily Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project and Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                {projectId ? (
                  <Input value={projectId} disabled />
                ) : (
                  <Select 
                    value={reportData.projectId} 
                    onValueChange={(value) => setReportData(prev => ({ ...prev, projectId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project._id} value={project._id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  type="date"
                  value={reportData.date}
                  onChange={(e) => setReportData(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Summary Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crewSize">Crew Size</Label>
                    <Input
                      type="number"
                      min="0"
                      value={reportData.summary.crewSize || ''}
                      onChange={(e) => setReportData(prev => ({
                        ...prev,
                        summary: { ...prev.summary, crewSize: parseInt(e.target.value) || 0 }
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalHours">Total Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={reportData.summary.totalHours || ''}
                      onChange={(e) => setReportData(prev => ({
                        ...prev,
                        summary: { ...prev.summary, totalHours: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weatherConditions">Weather</Label>
                    <Select
                      value={reportData.summary.weatherConditions || ''}
                      onValueChange={(value) => setReportData(prev => ({
                        ...prev,
                        summary: { ...prev.summary, weatherConditions: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select weather" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sunny">Sunny</SelectItem>
                        <SelectItem value="cloudy">Cloudy</SelectItem>
                        <SelectItem value="rainy">Rainy</SelectItem>
                        <SelectItem value="stormy">Stormy</SelectItem>
                        <SelectItem value="snowy">Snowy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="safetyIncidents">Safety Incidents</Label>
                    <Input
                      type="number"
                      min="0"
                      value={reportData.summary.safetyIncidents || ''}
                      onChange={(e) => setReportData(prev => ({
                        ...prev,
                        summary: { ...prev.summary, safetyIncidents: parseInt(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activities Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Activities</CardTitle>
                  <Button type="button" onClick={addActivity} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData.activities.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No activities added yet. Click &quot;Add Activity&quot; to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportData.activities.map((activity, index) => (
                      <div key={activity.id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(activity.status)}
                            <span className="font-medium text-sm">Activity {index + 1}</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeActivity(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Title *</Label>
                            <Input
                              value={activity.title}
                              onChange={(e) => updateActivity(index, 'title', e.target.value)}
                              placeholder="Activity title"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Status *</Label>
                            <Select
                              value={activity.status}
                              onValueChange={(value) => updateActivity(index, 'status', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="delayed">Delayed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select
                              value={activity.category}
                              onValueChange={(value) => updateActivity(index, 'category', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="structural">🏗️ Structural</SelectItem>
                                <SelectItem value="electrical">⚡ Electrical</SelectItem>
                                <SelectItem value="plumbing">🔧 Plumbing</SelectItem>
                                <SelectItem value="finishing">🎨 Finishing</SelectItem>
                                <SelectItem value="other">📋 Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Progress (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={activity.progress}
                              onChange={(e) => updateActivity(index, 'progress', parseInt(e.target.value) || 0)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Contractor</Label>
                            <Input
                              value={activity.contractor || ''}
                              onChange={(e) => updateActivity(index, 'contractor', e.target.value)}
                              placeholder="Contractor name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Supervisor</Label>
                            <Input
                              value={activity.supervisor || ''}
                              onChange={(e) => updateActivity(index, 'supervisor', e.target.value)}
                              placeholder="Supervisor name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input
                              type="time"
                              value={activity.startTime || ''}
                              onChange={(e) => updateActivity(index, 'startTime', e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input
                              type="time"
                              value={activity.endTime || ''}
                              onChange={(e) => updateActivity(index, 'endTime', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={activity.description || ''}
                            onChange={(e) => updateActivity(index, 'description', e.target.value)}
                            placeholder="Detailed description of the activity..."
                            rows={3}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Progress Photos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Upload Button */}
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photos
                    </Button>
                    <span className="text-sm text-gray-600">
                      Max 5MB per file, JPG/PNG only
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Photo Previews */}
                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <Image
                            src={url}
                            alt={`Preview ${index + 1}`}
                            width={200}
                            height={128}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                value={reportData.notes}
                onChange={(e) => setReportData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional comments or observations..."
                rows={3}
              />
            </div>

            {/* Upload Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading report...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Upload Report
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}