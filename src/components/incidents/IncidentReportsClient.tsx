// src/components/incidents/IncidentReportsClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  AlertCircle,
  Search,
  Filter,
  FileText,
  MessageSquare,
  Calendar,
  User,
  MapPin,
  Clock,
  Shield,
  CheckCircle,
  XCircle

} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Incident {
  _id: string;
  projectId: string;
  projectTitle: string;
  incidentCode: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  dateOccurred: string;
  timeOccurred: string;
  reportedBy: {
    _id: string;
    name: string;
    email: string;
  };
  witnessNames: string[];
  injuryDetails?: {
    injuryType: string;
    bodyPart?: string;
    treatmentRequired?: boolean;
    medicalAttention?: boolean;
  };
  equipmentInvolved: string[];
  weatherConditions?: string;
  immediateActions: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  status: string;
  priority: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  photos: string[];
  documents: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  comments: Array<{
    _id: string;
    userId: string;
    userName: string;
    userRole: string;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface IncidentReportsClientProps {
  incidents: Incident[];
  userRole: string;
  canEdit: boolean;
}

export default function IncidentReportsClient({ 
  incidents: initialIncidents, 
  userRole,
  canEdit 
}: IncidentReportsClientProps) {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const matchesSearch = 
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.incidentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || incident.category === categoryFilter;
      const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
    });
  }, [incidents, searchQuery, statusFilter, categoryFilter, severityFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter(i => i.severity === 'critical').length;
    const high = incidents.filter(i => i.severity === 'high').length;
    const withInjury = incidents.filter(i => 
      i.injuryDetails && i.injuryDetails.injuryType !== 'none'
    ).length;
    const open = incidents.filter(i => ['open', 'investigating'].includes(i.status)).length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    const closed = incidents.filter(i => i.status === 'closed').length;

    return { total, critical, high, withInjury, open, resolved, closed };
  }, [incidents]);

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'investigating': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get category color
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'safety': return 'bg-red-50 text-red-700 border-red-200';
      case 'equipment': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'environmental': return 'bg-green-50 text-green-700 border-green-200';
      case 'security': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'quality': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'other': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Handle add comment
  const handleAddComment = async () => {
    if (!selectedIncident || !commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedIncident.projectId}/incidents/${selectedIncident._id}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: commentText.trim() })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add comment');
      }

      const data = await response.json();

      // Update local state
      setIncidents(incidents.map(i => 
        i._id === selectedIncident._id 
          ? { ...i, comments: [...i.comments, data.data] }
          : i
      ));

      setSelectedIncident({
        ...selectedIncident,
        comments: [...selectedIncident.comments, data.data]
      });

      setCommentText('');
      toast({
        title: 'Success',
        description: 'Comment added successfully'
      });

    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add comment'
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // View incident details
  const viewIncidentDetails = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Total Incidents</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-red-700">{stats.critical}</p>
              <p className="text-xs sm:text-sm text-red-600 mt-1">Critical</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-orange-700">{stats.withInjury}</p>
              <p className="text-xs sm:text-sm text-orange-600 mt-1">With Injury</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-blue-700">{stats.open}</p>
              <p className="text-xs sm:text-sm text-blue-600 mt-1">Open</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400 sm:hidden" />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Incidents Found</h3>
            <p className="text-gray-600">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No incidents have been reported for your projects yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredIncidents.map((incident) => (
            <Card 
              key={incident._id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => viewIncidentDetails(incident)}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {incident.incidentCode}
                        </Badge>
                        <Badge className={getCategoryColor(incident.category)}>
                          {incident.category}
                        </Badge>
                        <Badge className={getStatusColor(incident.status)}>
                          {incident.status}
                        </Badge>
                        {incident.injuryDetails && incident.injuryDetails.injuryType !== 'none' && (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Injury
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                        {incident.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Project: {incident.projectTitle}
                      </p>
                    </div>

                    {/* Severity Badge */}
                    <Badge className={`${getSeverityColor(incident.severity)} px-3 py-1 text-sm font-semibold`}>
                      {incident.severity.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Key Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(incident.dateOccurred).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {incident.timeOccurred && ` at ${incident.timeOccurred}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{incident.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="h-4 w-4" />
                      <span>Reported by {incident.reportedBy.name}</span>
                    </div>
                  </div>

                  {/* Description Preview */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {incident.description}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
                    <div className="flex items-center gap-4">
                      {incident.comments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {incident.comments.length}
                        </span>
                      )}
                      {incident.followUpRequired && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="h-4 w-4" />
                          Follow-up required
                        </span>
                      )}
                    </div>
                    <span>
                      Updated {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Incident Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedIncident.incidentCode}
                  </Badge>
                  <span>{selectedIncident.title}</span>
                </DialogTitle>
                <DialogDescription>
                  Project: {selectedIncident.projectTitle}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Incident Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <Badge className={getCategoryColor(selectedIncident.category)}>
                        {selectedIncident.category}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <Badge className={getStatusColor(selectedIncident.status)}>
                        {selectedIncident.status}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className={getSeverityColor(selectedIncident.severity)}>
                    <CardContent className="pt-6">
                      <p className="text-sm mb-1">Severity</p>
                      <p className="text-2xl font-bold uppercase">{selectedIncident.severity}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Incident Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Incident Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Description</p>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                        {selectedIncident.description}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Date Occurred</p>
                        <p className="text-sm text-gray-600">
                          {new Date(selectedIncident.dateOccurred).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Time</p>
                        <p className="text-sm text-gray-600">
                          {selectedIncident.timeOccurred || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Location</p>
                        <p className="text-sm text-gray-600">{selectedIncident.location}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reported By</p>
                        <p className="text-sm text-gray-600">{selectedIncident.reportedBy.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Injury Details */}
                {selectedIncident.injuryDetails && selectedIncident.injuryDetails.injuryType !== 'none' && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 text-red-800">
                        <AlertTriangle className="h-5 w-5" />
                        Injury Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-red-900">Injury Type</p>
                        <Badge className="bg-red-200 text-red-900 mt-1">
                          {selectedIncident.injuryDetails.injuryType.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      {selectedIncident.injuryDetails.bodyPart && (
                        <div>
                          <p className="text-sm font-medium text-red-900">Body Part Affected</p>
                          <p className="text-sm text-red-800">{selectedIncident.injuryDetails.bodyPart}</p>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          {selectedIncident.injuryDetails.treatmentRequired ? (
                            <CheckCircle className="h-4 w-4 text-red-700" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm text-red-800">Treatment Required</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedIncident.injuryDetails.medicalAttention ? (
                            <CheckCircle className="h-4 w-4 text-red-700" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm text-red-800">Medical Attention</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Actions Taken */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Immediate Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedIncident.immediateActions}
                    </p>
                  </CardContent>
                </Card>

                {/* Root Cause & Corrective Actions */}
                {(selectedIncident.rootCause || selectedIncident.correctiveActions || selectedIncident.preventiveActions) && (
                  <div className="grid grid-cols-1 gap-4">
                    {selectedIncident.rootCause && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Root Cause Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {selectedIncident.rootCause}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {selectedIncident.correctiveActions && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Corrective Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {selectedIncident.correctiveActions}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {selectedIncident.preventiveActions && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Preventive Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {selectedIncident.preventiveActions}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Additional Information */}
                {(selectedIncident.witnessNames.length > 0 || selectedIncident.equipmentInvolved.length > 0 || selectedIncident.weatherConditions) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedIncident.witnessNames.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Witnesses</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedIncident.witnessNames.map((witness, index) => (
                              <Badge key={index} variant="outline">{witness}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedIncident.equipmentInvolved.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Equipment Involved</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedIncident.equipmentInvolved.map((equipment, index) => (
                              <Badge key={index} variant="outline">{equipment}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedIncident.weatherConditions && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Weather Conditions</p>
                          <p className="text-sm text-gray-600">{selectedIncident.weatherConditions}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Comments Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Comments ({selectedIncident.comments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedIncident.comments.length > 0 && (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {selectedIncident.comments.map((comment) => (
                          <div key={comment._id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">
                                  {comment.userName}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {comment.userRole.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <Textarea
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={3}
                        className="mb-3"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || isSubmittingComment}
                        className="w-full sm:w-auto"
                      >
                        {isSubmittingComment ? 'Adding...' : 'Add Comment'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}