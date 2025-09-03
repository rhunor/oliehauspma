// src/app/(dashboard)/client/daily-reports/page.tsx - ENHANCED WITH INCIDENT & RISK FEATURES
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Calendar,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  Shield,
  Plus,
  Clock,
  CheckCircle,
  TrendingUp,
  Filter,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Import our types
import type { IncidentReport } from '@/lib/types/incident';
import type { RiskRegisterItem } from '@/lib/types/risk';

// Enhanced interfaces
interface DailyReport {
  _id: string;
  projectId: string;
  projectTitle: string;
  date: string;
  activities: Activity[];
  summary: {
    totalActivities: number;
    completedActivities: number;
    weatherConditions: string;
    crewCount: number;
    equipmentUsed: string[];
    safetyIncidents: number;
    delays: string[];
    notes: string;
  };
  incidents: IncidentReport[];
  risks: RiskRegisterItem[];
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor?: string;
  startTime: string;
  endTime: string;
  status: 'completed' | 'in_progress' | 'delayed' | 'cancelled';
  progress: number;
  equipmentUsed: string[];
  crewSize: number;
  notes?: string;
  photos?: string[];
}

interface Project {
  _id: string;
  title: string;
  status: string;
  manager: {
    name: string;
    email: string;
  };
}

export default function EnhancedDailyReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // State management
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  // Fetch data
  useEffect(() => {
    if (session?.user?.id) {
      fetchReports();
      fetchProjects();
    }
  }, [session, selectedProject, dateFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('projectId', selectedProject);
      if (dateFilter !== 'all') params.append('dateFilter', dateFilter);
      
      const response = await fetch(`/api/daily-reports?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setReports(data.data.reports || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch reports",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to fetch daily reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Filter reports based on search
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchQuery === '' || 
      report.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.summary.notes.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Calculate statistics
  const stats = {
    totalReports: filteredReports.length,
    totalIncidents: filteredReports.reduce((sum, r) => sum + (r.incidents?.length || 0), 0),
    totalRisks: filteredReports.reduce((sum, r) => sum + (r.risks?.length || 0), 0),
    averageProgress: filteredReports.length > 0 
      ? Math.round(filteredReports.reduce((sum, r) => {
          const completed = r.summary.completedActivities;
          const total = r.summary.totalActivities;
          return sum + (total > 0 ? (completed / total) * 100 : 0);
        }, 0) / filteredReports.length)
      : 0
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      delayed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Daily Reports</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Progress updates, incidents, and risk assessments
          </p>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalReports}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Incidents Reported</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalIncidents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Risks</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalRisks}</p>
              </div>
              <Shield className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                <p className="text-3xl font-bold text-gray-900">{stats.averageProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button 
                onClick={() => {
                  setSelectedProject('all');
                  setDateFilter('all');
                  setSearchQuery('');
                }}
                variant="outline"
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="grid grid-cols-1 gap-6">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600 mb-4">
                {reports.length === 0 
                  ? "No daily reports have been submitted yet."
                  : "Try adjusting your filters to see more reports."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={report._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{report.projectTitle}</CardTitle>
                    <p className="text-sm text-gray-600">{formatDate(report.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {report.summary.completedActivities}/{report.summary.totalActivities} activities
                    </Badge>
                    {report.incidents && report.incidents.length > 0 && (
                      <Badge className="bg-red-100 text-red-800 text-xs">
                        {report.incidents.length} incident{report.incidents.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {report.risks && report.risks.length > 0 && (
                      <Badge className="bg-orange-100 text-orange-800 text-xs">
                        {report.risks.length} risk{report.risks.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Activities Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Daily Activities</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.activities.slice(0, 2).map((activity) => (
                      <div key={activity._id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                            {activity.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
                          Contractor: {activity.contractor}
                        </p>
                        <p className="text-xs text-gray-600">
                          Progress: {activity.progress}%
                        </p>
                      </div>
                    ))}
                  </div>
                  {report.activities.length > 2 && (
                    <p className="text-sm text-gray-500 mt-2">
                      +{report.activities.length - 2} more activities
                    </p>
                  )}
                </div>

                {/* Incidents Section */}
                {report.incidents && report.incidents.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Incident Reports
                    </h4>
                    <div className="space-y-2">
                      {report.incidents.slice(0, 2).map((incident) => (
                        <div key={incident._id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm text-red-900">{incident.title}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${getSeverityColor(incident.severity)}`}>
                                {incident.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {incident.category}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-red-700 mb-1">
                            {incident.description.length > 100 
                              ? incident.description.substring(0, 100) + '...' 
                              : incident.description}
                          </p>
                          <p className="text-xs text-red-600">
                            Status: {incident.status} • Reported by: {incident.reportedByName}
                          </p>
                        </div>
                      ))}
                      {report.incidents.length > 2 && (
                        <p className="text-sm text-red-600 mt-2">
                          +{report.incidents.length - 2} more incidents
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Risk Register Section */}
                {report.risks && report.risks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-600" />
                      Risk Register
                    </h4>
                    <div className="space-y-2">
                      {report.risks.slice(0, 2).map((risk) => (
                        <div key={risk._id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm text-orange-900">
                              {risk.riskCode}: {risk.riskDescription.length > 50 
                                ? risk.riskDescription.substring(0, 50) + '...' 
                                : risk.riskDescription}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge className="text-xs bg-orange-100 text-orange-800">
                                Score: {risk.riskScore}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {risk.category}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-orange-700 mb-1">
                            Probability: {risk.probability} • Impact: {risk.impact}
                          </p>
                          <p className="text-xs text-orange-600">
                            Status: {risk.status} • Owner: {risk.ownerName}
                          </p>
                        </div>
                      ))}
                      {report.risks.length > 2 && (
                        <p className="text-sm text-orange-600 mt-2">
                          +{report.risks.length - 2} more risks
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Weather</p>
                      <p className="font-medium">{report.summary.weatherConditions}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Crew Count</p>
                      <p className="font-medium">{report.summary.crewCount} workers</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Safety Incidents</p>
                      <p className="font-medium">{report.summary.safetyIncidents}</p>
                    </div>
                  </div>
                  {report.summary.notes && (
                    <div className="mt-3">
                      <p className="text-gray-600 text-sm">Notes</p>
                      <p className="text-sm">{report.summary.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Updated {formatDate(report.updatedAt)}</span>
                    <span>by {report.createdByName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Action Dialogs for Adding Incidents and Risks */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        {/* Add Incident Report Button */}
        <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-full h-12 w-12 bg-red-600 hover:bg-red-700 shadow-lg">
              <AlertTriangle className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Incident Report</DialogTitle>
              <DialogDescription>
                Report a safety or operational incident. For detailed reports, use the full incident form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Quick incident reporting will be available soon.
                </p>
                <div className="flex gap-2">
                  <Link href="/client/incidents/new">
                    <Button className="bg-red-600 hover:bg-red-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Full Incident Report
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowIncidentDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Risk Register Button */}
        <Dialog open={showRiskDialog} onOpenChange={setShowRiskDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-full h-12 w-12 bg-orange-600 hover:bg-orange-700 shadow-lg">
              <Shield className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Quick Risk Assessment</DialogTitle>
              <DialogDescription>
                Register a new project risk. For detailed assessments, use the full risk register form.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Quick risk registration will be available soon.
                </p>
                <div className="flex gap-2">
                  <Link href="/client/risks/new">
                    <Button className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Full Risk Assessment
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRiskDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Enhanced Daily Reports</h4>
              <p className="text-sm text-blue-700">
                Daily reports now include integrated incident reporting and risk register features. 
                Click the floating action buttons to quickly report incidents or register risks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}