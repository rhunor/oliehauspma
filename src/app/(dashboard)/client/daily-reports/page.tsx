// src/app/(dashboard)/client/daily-reports/page.tsx - FIXED: Fully Responsive Mobile-First
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
  MapPin,
  X
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
  const iconClass = "h-4 w-4 text-gray-400";
  switch (category) {
    case 'structural': return <MapPin className={iconClass} />;
    case 'electrical': return <AlertTriangle className={iconClass} />;
    case 'plumbing': return <Clock className={iconClass} />;
    case 'finishing': return <CheckCircle className={iconClass} />;
    default: return <FileText className={iconClass} />;
  }
};

export default function ClientDailyReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const reportsPerPage = 10;

  useEffect(() => {
    if (session?.user) {
      fetchReports();
    }
  }, [session, page, dateFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: reportsPerPage.toString(),
        client: 'true'
      });

      if (dateFilter && dateFilter !== 'all') {
        const today = new Date();
        let startDate: Date | null = null;
        
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
          default:
            startDate = null;
        }
        
        if (startDate) {
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
      <div className="min-h-screen p-4 sm:p-6">
        {/* FIXED: Mobile-first loading state */}
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center max-w-sm mx-auto">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-gray-600">Loading daily reports...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* FIXED: Mobile-first responsive container */}
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* FIXED: Responsive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/client">
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Daily Reports</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">View daily progress reports from your project teams</p>
            </div>
          </div>
        </div>

        {/* FIXED: Responsive Search and Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              Search &amp; Filter Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reports..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div className="w-full sm:w-48">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reports</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FIXED: Responsive Reports List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Project Reports ({filteredReports.length})</CardTitle>
              {filteredReports.length > 0 && (
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {filteredReports.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <div key={report._id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    {/* FIXED: Mobile-first report card layout */}
                    <div className="space-y-3 sm:space-y-4">
                      
                      {/* Header row - responsive layout */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                              {report.projectTitle}
                            </h3>
                            <Badge className={report.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {report.approved ? 'Approved' : 'Pending'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                              {formatDate(report.date)}
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 sm:h-4 sm:w-4" />
                              {report.createdBy}
                            </span>
                          </div>
                        </div>
                        
                        {/* Action button - responsive positioning */}
                        <div className="flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                            className="w-full sm:w-auto"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>

                      {/* FIXED: Responsive activity summary grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <p className="text-lg sm:text-2xl font-bold text-gray-700">{report.summary.totalActivities}</p>
                          <p className="text-xs text-gray-600">Total</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                          <p className="text-lg sm:text-2xl font-bold text-green-700">{report.summary.completed}</p>
                          <p className="text-xs text-green-600">Completed</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                          <p className="text-lg sm:text-2xl font-bold text-blue-700">{report.summary.inProgress}</p>
                          <p className="text-xs text-blue-600">In Progress</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
                          <p className="text-lg sm:text-2xl font-bold text-purple-700">{calculateCompletionPercentage(report.summary)}%</p>
                          <p className="text-xs text-purple-600">Complete</p>
                        </div>
                      </div>

                      {/* FIXED: Responsive additional info grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                        {report.summary.crewSize && (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            <span className="text-gray-600">Crew Size: {report.summary.crewSize}</span>
                          </div>
                        )}
                        
                        {report.summary.totalHours && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            <span className="text-gray-600">Hours Worked: {report.summary.totalHours}</span>
                          </div>
                        )}
                        
                        {report.photos.length > 0 && (
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            <span className="text-gray-600">{report.photos.length} Photos</span>
                          </div>
                        )}
                      </div>

                      {/* Notes preview */}
                      {report.notes && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs sm:text-sm text-gray-700 line-clamp-2">{report.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 sm:p-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Reports Found</h3>
                <p className="text-sm text-gray-600">
                  {searchTerm ? 'Try adjusting your search criteria.' : 'Daily reports will appear here once created.'}
                </p>
              </div>
            )}
          </CardContent>

          {/* FIXED: Responsive pagination */}
          {totalPages > 1 && (
            <div className="border-t px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                  Showing page {page} of {totalPages}
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="text-xs sm:text-sm"
                  >
                    Previous
                  </Button>
                  
                  {/* Page numbers - hide on small screens when many pages */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="w-8 h-8 p-0 text-xs"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="text-xs sm:text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* FIXED: Responsive Detailed Report Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 sm:p-6 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    Daily Report - {formatDate(selectedReport.date)}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 truncate">{selectedReport.projectTitle}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Close</span>
                </Button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Activities List */}
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">
                    Activities ({selectedReport.activities.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {selectedReport.activities.map((activity, index) => (
                      <div key={index} className="border rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base">{activity.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getCategoryIcon(activity.category)}
                            <Badge className={getStatusColor(activity.status)}>
                              {activity.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        
                        {activity.description && (
                          <p className="text-xs sm:text-sm text-gray-600 mb-2">{activity.description}</p>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-500">
                          {activity.contractor && (
                            <span>Contractor: {activity.contractor}</span>
                          )}
                          {activity.supervisor && (
                            <span>Supervisor: {activity.supervisor}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photos Section */}
                {selectedReport.photos.length > 0 && (
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">
                      Photos ({selectedReport.photos.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                      {selectedReport.photos.map((photo, index) => (
                        <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={photo}
                            alt={`Report photo ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(photo, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                {selectedReport.notes && (
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Additional Notes</h3>
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap">{selectedReport.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}