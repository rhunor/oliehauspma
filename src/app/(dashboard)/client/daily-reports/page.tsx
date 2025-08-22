// src/app/(dashboard)/client/daily-reports/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  FileText, 
  Calendar, 
  Filter, 
  Download,
  Eye,
  ArrowLeft,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  User,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface DailyActivity {
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  description?: string;
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
  activities: DailyActivity[];
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'delayed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'structural': return '🏗️';
    case 'electrical': return '⚡';
    case 'plumbing': return '🔧';
    case 'finishing': return '🎨';
    default: return '📋';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
    case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'delayed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

export default function ClientDailyReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  // Get unique projects for filter
  const uniqueProjects = Array.from(new Set(reports.map(report => report.projectTitle)));

  useEffect(() => {
    fetchDailyReports();
  }, [page]);

  const fetchDailyReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (projectFilter !== 'all') {
        const project = reports.find(r => r.projectTitle === projectFilter);
        if (project) {
          params.append('projectId', project.projectId);
        }
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

      const response = await fetch(`/api/daily-reports?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setReports(data.data.reports || []);
        setTotalPages(data.data.pagination?.pages || 1);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load daily reports"
        });
      }
    } catch (error) {
      console.error('Error fetching daily reports:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while loading reports"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on search term
  const filteredReports = reports.filter(report => {
    const matchesSearch = report.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/client">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Daily Reports</h1>
            <p className="text-gray-600 mt-1">View daily progress reports from your project teams</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Project Filter */}
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {uniqueProjects.map(project => (
                  <SelectItem key={project} value={project}>
                    {project}
                  </SelectItem>
                ))}
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
          </div>

          {/* Apply Filters Button */}
          <div className="flex justify-end mt-4">
            <Button onClick={fetchDailyReports} variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Daily Reports ({filteredReports.length})</span>
            <Badge variant="outline">{filteredReports.length} of {reports.length} reports</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600">
                {reports.length === 0 
                  ? "No daily reports have been submitted yet."
                  : "Try adjusting your search or filter criteria."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReports.map((report) => (
                <div
                  key={report._id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  {/* Report Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {formatDate(report.date)}
                        </h3>
                        {report.approved ? (
                          <Badge className="bg-green-100 text-green-800">Approved</Badge>
                        ) : (
                          <Badge variant="outline">Pending Review</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {report.projectTitle}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {report.createdBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTime(report.createdAt)}
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedReport(report)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{report.summary.totalActivities}</p>
                      <p className="text-xs text-gray-600">Total Tasks</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-700">{report.summary.completed}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">{report.summary.inProgress}</p>
                      <p className="text-xs text-blue-600">In Progress</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-700">{report.summary.pending}</p>
                      <p className="text-xs text-yellow-600">Pending</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-700">{calculateCompletionPercentage(report.summary)}%</p>
                      <p className="text-xs text-purple-600">Complete</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {report.summary.crewSize && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Crew Size: {report.summary.crewSize}</span>
                      </div>
                    )}
                    
                    {report.summary.totalHours && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Hours Worked: {report.summary.totalHours}</span>
                      </div>
                    )}
                    
                    {report.summary.weatherConditions && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">🌤️</span>
                        <span className="text-gray-600">Weather: {report.summary.weatherConditions}</span>
                      </div>
                    )}
                  </div>

                  {/* Photos */}
                  {report.photos.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{report.photos.length} photos attached</span>
                      </div>
                    </div>
                  )}

                  {/* Notes Preview */}
                  {report.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 line-clamp-2">{report.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Daily Report - {formatDate(selectedReport.date)}
                  </h2>
                  <p className="text-gray-600">{selectedReport.projectTitle}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedReport(null)}
                >
                  Close
                </Button>
              </div>

              {/* Activities List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Activities ({selectedReport.activities.length})</h3>
                
                {selectedReport.activities.map((activity, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(activity.status)}
                        <h4 className="font-medium text-gray-900">{activity.title}</h4>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {activity.category && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                          <span className="text-sm text-gray-600 capitalize">{activity.category}</span>
                        </div>
                      )}
                    </div>
                    
                    {activity.description && (
                      <p className="text-gray-600 text-sm mb-3">{activity.description}</p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {activity.contractor && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Contractor: {activity.contractor}</span>
                        </div>
                      )}
                      
                      {activity.supervisor && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Supervisor: {activity.supervisor}</span>
                        </div>
                      )}
                      
                      {activity.progress !== undefined && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Progress: {activity.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {selectedReport.notes && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{selectedReport.notes}</p>
                  </div>
                </div>
              )}

              {/* Photos */}
              {selectedReport.photos.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Photos ({selectedReport.photos.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedReport.photos.map((photo, index) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                        <span className="text-xs text-gray-500 ml-2">Photo {index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}