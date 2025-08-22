// src/app/(dashboard)/manager/daily-reports/page.tsx - COMPLETE WITH ALL IMPORTS
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  FileText, 
  Plus, 
  Calendar, 
  Filter,
  ArrowLeft,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Camera,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DailyReportUpload from '@/components/reports/DailyReportUpload';

interface DailyReportActivity {
  _id?: string;
  title: string;
  description?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  startTime?: string;
  endTime?: string;
  contractor?: string;
  supervisor?: string;
  category?: 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'other';
  progress?: number;
}

interface DailyReport {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
  activities: DailyReportActivity[];
  summary: {
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
    totalActivities: number;
    totalHours?: number;
    crewSize?: number;
    weatherConditions?: string;
  };
  photos: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approved: boolean;
}

interface ManagerProject {
  _id: string;
  title: string;
  status: string;
  client: {
    name: string;
  };
}

const getStatusColor = (approved: boolean) => {
  return approved 
    ? 'bg-green-100 text-green-800' 
    : 'bg-yellow-100 text-yellow-800';
};

export default function ManagerDailyReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<ManagerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch manager's projects
      const projectsResponse = await fetch('/api/projects?manager=true');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.data.data || []);
      }

      // Fetch daily reports for manager's projects
      const reportsUrl = '/api/daily-reports?';
      const params = new URLSearchParams();
      
      if (selectedProject !== 'all') {
        params.append('projectId', selectedProject);
      }
      
      if (dateFilter !== 'all') {
        const today = new Date();
        let startDate = new Date();
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(today.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (dateFilter !== 'all') {
          params.append('startDate', startDate.toISOString());
        }
      }

      const reportsResponse = await fetch(`${reportsUrl}${params.toString()}`);
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        setReports(reportsData.data.reports || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reports data"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedProject, dateFilter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUploadSuccess = () => {
    setShowUploadForm(false);
    fetchData(); // Refresh the reports list
    toast({
      title: "Success",
      description: "Daily report uploaded successfully"
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateCompletionPercentage = (summary: DailyReport['summary']) => {
    if (summary.totalActivities === 0) return 0;
    return Math.round((summary.completed / summary.totalActivities) * 100);
  };

  const handleEditReport = (_reportId: string) => {
    // Navigate to edit page or show edit modal
    toast({
      title: "Edit Feature",
      description: "Edit functionality will be implemented here"
    });
  };

  const handleViewReport = (_reportId: string) => {
    // Navigate to detailed view or show modal
    toast({
      title: "View Feature", 
      description: "Detailed view will be implemented here"
    });
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/daily-reports/${reportId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Report deleted successfully"
        });
        fetchData(); // Refresh the list
      } else {
        throw new Error('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete report"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading daily reports...</p>
        </div>
      </div>
    );
  }

  if (showUploadForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowUploadForm(false)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Daily Report</h1>
            <p className="text-gray-600">Create a new daily progress report</p>
          </div>
        </div>

        <DailyReportUpload 
          onSuccess={handleUploadSuccess}
          onCancel={() => setShowUploadForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Daily Reports</h1>
          <p className="text-gray-600 mt-1">Manage daily progress reports for your projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUploadForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload New Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
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
            </div>

            {/* Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button onClick={fetchData} variant="outline" className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
              </div>
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {reports.filter(r => r.approved).length}
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {reports.filter(r => !r.approved).length}
                </p>
              </div>
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-purple-600">
                  {reports.length > 0 
                    ? Math.round(reports.reduce((sum, r) => sum + calculateCompletionPercentage(r.summary), 0) / reports.length)
                    : 0}%
                </p>
              </div>
              <AlertTriangle className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => setShowUploadForm(true)}
              className="h-20 flex flex-col items-center justify-center gap-2"
            >
              <Plus className="h-6 w-6" />
              <span>Upload New Report</span>
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setDateFilter('today')}
              className="h-20 flex flex-col items-center justify-center gap-2"
            >
              <Calendar className="h-6 w-6" />
              <span>Today&apos;s Reports</span>
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                // Export functionality
                toast({
                  title: "Export",
                  description: "Export functionality will be implemented"
                });
              }}
              className="h-20 flex flex-col items-center justify-center gap-2"
            >
              <FileText className="h-6 w-6" />
              <span>Export Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports ({reports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600 mb-4">
                {projects.length === 0 
                  ? "You don&apos;t have any assigned projects yet."
                  : "Start by uploading your first daily report."
                }
              </p>
              {projects.length > 0 && (
                <Button onClick={() => setShowUploadForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload First Report
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Report Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">
                          {formatDate(report.date)}
                        </h3>
                        <Badge className={getStatusColor(report.approved)}>
                          {report.approved ? 'Approved' : 'Pending Review'}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-1">{report.projectTitle}</p>
                      <p className="text-gray-500 text-xs">
                        Created {formatTime(report.createdAt)} by {report.createdBy}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewReport(report._id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditReport(report._id)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteReport(report._id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-lg font-bold text-gray-900">{report.summary.totalActivities}</p>
                      <p className="text-xs text-gray-600">Total</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <p className="text-lg font-bold text-green-700">{report.summary.completed}</p>
                      <p className="text-xs text-green-600">Done</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="text-lg font-bold text-blue-700">{report.summary.inProgress}</p>
                      <p className="text-xs text-blue-600">Active</p>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <p className="text-lg font-bold text-yellow-700">{report.summary.pending}</p>
                      <p className="text-xs text-yellow-600">Pending</p>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <p className="text-lg font-bold text-purple-700">{calculateCompletionPercentage(report.summary)}%</p>
                      <p className="text-xs text-purple-600">Complete</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-gray-600">
                    {report.summary.crewSize && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Crew: {report.summary.crewSize}
                      </span>
                    )}
                    {report.summary.totalHours && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Hours: {report.summary.totalHours}
                      </span>
                    )}
                    {report.summary.weatherConditions && (
                      <span>🌤️ {report.summary.weatherConditions}</span>
                    )}
                    {report.photos.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Camera className="h-4 w-4" />
                        {report.photos.length} photos
                      </span>
                    )}
                  </div>

                  {/* Notes Preview */}
                  {report.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                      <p className="text-gray-700 line-clamp-2">{report.notes}</p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Completion Progress</span>
                      <span className="font-medium">{calculateCompletionPercentage(report.summary)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${calculateCompletionPercentage(report.summary)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}