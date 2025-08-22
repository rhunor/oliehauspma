// src/app/(dashboard)/admin/daily-progress/page.tsx - COMPLETE VERSION
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Activity, 
  Calendar, 
  Filter, 
  Search,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Building,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DailyReportUpload from '@/components/reports/DailyReportUpload';

interface Project {
  _id: string;
  title: string;
  status: string;
  client: {
    _id: string;
    name: string;
    email: string;
  };
  manager: {
    _id: string;
    name: string;
    email: string;
  };
  progress: number;
  startDate: string;
  endDate: string;
  budget: number;
  createdAt: string;
}

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

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalReports: number;
  approvedReports: number;
  pendingReports: number;
  todaysReports: number;
  averageCompletion: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'planning': return 'bg-yellow-100 text-yellow-800';
    case 'on_hold': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getApprovalColor = (approved: boolean) => {
  return approved 
    ? 'bg-green-100 text-green-800' 
    : 'bg-yellow-100 text-yellow-800';
};

export default function AdminDailyProgressPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    totalReports: 0,
    approvedReports: 0,
    pendingReports: 0,
    todaysReports: 0,
    averageCompletion: 0
  });
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectForUpload, setSelectedProjectForUpload] = useState<string>('');

  const calculateStats = useCallback(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'in_progress').length;
      const totalReports = reports.length;
      const approvedReports = reports.filter(r => r.approved).length;
      const pendingReports = reports.filter(r => !r.approved).length;
      const todaysReports = reports.filter(r => r.date.startsWith(today)).length;
      
      const averageCompletion = reports.length > 0 
        ? Math.round(reports.reduce((sum, r) => {
            const completion = r.summary.totalActivities > 0 
              ? (r.summary.completed / r.summary.totalActivities) * 100 
              : 0;
            return sum + completion;
          }, 0) / reports.length)
        : 0;

      setStats({
        totalProjects,
        activeProjects,
        totalReports,
        approvedReports,
        pendingReports,
        todaysReports,
        averageCompletion
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [projects, reports]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects?limit=100');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
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

      params.append('limit', '50');

      const response = await fetch(`/api/daily-reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  }, [selectedProject, dateFilter]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProjects(),
        fetchReports()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dashboard data"
      });
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, fetchReports, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (projects.length > 0 && reports.length > 0) {
      calculateStats();
    }
  }, [projects, reports, calculateStats]);

  const handleApproveReport = async (reportId: string) => {
    try {
      const response = await fetch('/api/daily-reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          approved: true
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Report approved successfully"
        });
        fetchReports();
      } else {
        throw new Error('Failed to approve report');
      }
    } catch (error) {
      console.error('Error approving report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve report"
      });
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadForm(false);
    setSelectedProjectForUpload('');
    fetchReports();
    toast({
      title: "Success",
      description: "Daily report uploaded successfully"
    });
  };

  // Filter reports based on current filters
  const filteredReports = reports.filter(report => {
    const matchesSearch = report.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesApproval = approvalFilter === 'all' || 
                           (approvalFilter === 'approved' && report.approved) ||
                           (approvalFilter === 'pending' && !report.approved);

    return matchesSearch && matchesApproval;
  });

  // Filter projects based on current filters
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.manager.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading daily progress data...</p>
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
            onClick={() => {
              setShowUploadForm(false);
              setSelectedProjectForUpload('');
            }}
          >
            <Activity className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Daily Report</h1>
            <p className="text-gray-600">Create a new daily progress report</p>
          </div>
        </div>

        <DailyReportUpload 
          projectId={selectedProjectForUpload || undefined}
          onSuccess={handleUploadSuccess}
          onCancel={() => {
            setShowUploadForm(false);
            setSelectedProjectForUpload('');
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Daily Progress Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage daily reports across all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUploadForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Report
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
              </div>
              <Building className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeProjects}</p>
              </div>
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalReports}</p>
              </div>
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.approvedReports}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingReports}</p>
              </div>
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today&apos;s Reports</p>
                <p className="text-2xl font-bold text-orange-600">{stats.todaysReports}</p>
              </div>
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.averageCompletion}%</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search projects or reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Project Filter */}
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

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
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

            {/* Approval Filter */}
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Reports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reports</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={fetchReports} variant="outline" size="sm">
              Apply Filters
            </Button>
            <Button 
              onClick={() => {
                setSelectedProject('all');
                setStatusFilter('all');
                setDateFilter('all');
                setApprovalFilter('all');
                setSearchTerm('');
                fetchReports();
              }} 
              variant="ghost" 
              size="sm"
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Projects Overview ({filteredProjects.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  toast({
                    title: "Export",
                    description: "Project export functionality will be implemented"
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProjects.map((project) => (
                <div
                  key={project._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{project.title}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Client: {project.client.name}
                        </p>
                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Manager: {project.manager.name}
                        </p>
                        <p>Budget: {formatCurrency(project.budget)}</p>
                        <p>Progress: {project.progress}%</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedProjectForUpload(project._id);
                          setShowUploadForm(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Report
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Project Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Start:</span> {formatDate(project.startDate)}
                    </div>
                    <div>
                      <span className="font-medium">End:</span> {formatDate(project.endDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Daily Reports ({filteredReports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
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
                        <Badge className={getApprovalColor(report.approved)}>
                          {report.approved ? 'Approved' : 'Pending Review'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="font-medium">{report.projectTitle}</p>
                        <p>Created by: {report.createdBy}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!report.approved && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleApproveReport(report._id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
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
                      <p className="text-lg font-bold text-purple-700">
                        {report.summary.totalActivities > 0 
                          ? Math.round((report.summary.completed / report.summary.totalActivities) * 100)
                          : 0}%
                      </p>
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
                      <span>📷 {report.photos.length} photos</span>
                    )}
                  </div>

                  {/* Notes Preview */}
                  {report.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                      <p className="text-gray-700 line-clamp-2">{report.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}