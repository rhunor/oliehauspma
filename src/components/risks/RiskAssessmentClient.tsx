// src/components/risks/RiskAssessmentClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  Shield, 
  Plus,
  Search,
  Filter,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  MessageSquare
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

interface Risk {
  _id: string;
  projectId: string;
  projectTitle: string;
  riskCode: string;
  riskDescription: string;
  category: string;
  probability: string;
  impact: string;
  riskScore: number;
  triggers: string[];
  mitigationStrategy: string;
  contingencyPlan: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  status: string;
  reviewDate?: string;
  lastReviewDate?: string;
  residualProbability?: string;
  residualImpact?: string;
  residualScore?: number;
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

interface RiskAssessmentClientProps {
  risks: Risk[];
  userRole: string;
  canEdit: boolean;
}

export default function RiskAssessmentClient({ 
  risks: initialRisks, 
  userRole,
  canEdit 
}: RiskAssessmentClientProps) {
  const { toast } = useToast();
  const [risks, setRisks] = useState<Risk[]>(initialRisks);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Filter risks
  const filteredRisks = useMemo(() => {
    return risks.filter(risk => {
      const matchesSearch = 
        risk.riskDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        risk.riskCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        risk.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || risk.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || risk.category === categoryFilter;
      
      let matchesSeverity = true;
      if (severityFilter !== 'all') {
        if (severityFilter === 'critical' && risk.riskScore >= 20) matchesSeverity = true;
        else if (severityFilter === 'high' && risk.riskScore >= 12 && risk.riskScore < 20) matchesSeverity = true;
        else if (severityFilter === 'medium' && risk.riskScore >= 6 && risk.riskScore < 12) matchesSeverity = true;
        else if (severityFilter === 'low' && risk.riskScore < 6) matchesSeverity = true;
        else matchesSeverity = false;
      }

      return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
    });
  }, [risks, searchQuery, statusFilter, categoryFilter, severityFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = risks.length;
    const critical = risks.filter(r => r.riskScore >= 20).length;
    const high = risks.filter(r => r.riskScore >= 12 && r.riskScore < 20).length;
    const medium = risks.filter(r => r.riskScore >= 6 && r.riskScore < 12).length;
    const low = risks.filter(r => r.riskScore < 6).length;
    const open = risks.filter(r => ['identified', 'assessed'].includes(r.status)).length;
    const mitigated = risks.filter(r => r.status === 'mitigated').length;
    const closed = risks.filter(r => r.status === 'closed').length;

    return { total, critical, high, medium, low, open, mitigated, closed };
  }, [risks]);

  // Get risk severity level
  const getRiskSeverity = (score: number): string => {
    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  };

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

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'identified':
        return <AlertTriangle className="h-4 w-4" />;
      case 'assessed':
        return <Clock className="h-4 w-4" />;
      case 'mitigated':
        return <Shield className="h-4 w-4" />;
      case 'transferred':
        return <TrendingUp className="h-4 w-4" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />;
      case 'closed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'identified': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assessed': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'mitigated': return 'bg-green-100 text-green-800 border-green-200';
      case 'transferred': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'accepted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get category color
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'safety': return 'bg-red-50 text-red-700 border-red-200';
      case 'financial': return 'bg-green-50 text-green-700 border-green-200';
      case 'schedule': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'technical': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'quality': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'environmental': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'legal': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'operational': return 'bg-pink-50 text-pink-700 border-pink-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Handle add comment
  const handleAddComment = async () => {
    if (!selectedRisk || !commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedRisk.projectId}/risks/${selectedRisk._id}/comments`,
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
      setRisks(risks.map(r => 
        r._id === selectedRisk._id 
          ? { ...r, comments: [...r.comments, data.data] }
          : r
      ));

      setSelectedRisk({
        ...selectedRisk,
        comments: [...selectedRisk.comments, data.data]
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

  // View risk details
  const viewRiskDetails = (risk: Risk) => {
    setSelectedRisk(risk);
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
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Total Risks</p>
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
              <p className="text-2xl sm:text-3xl font-bold text-orange-700">{stats.high}</p>
              <p className="text-xs sm:text-sm text-orange-600 mt-1">High</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-green-700">{stats.mitigated}</p>
              <p className="text-xs sm:text-sm text-green-600 mt-1">Mitigated</p>
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
                placeholder="Search risks..."
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
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="assessed">Assessed</SelectItem>
                  <SelectItem value="mitigated">Mitigated</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
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
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical (20-25)</SelectItem>
                  <SelectItem value="high">High (12-19)</SelectItem>
                  <SelectItem value="medium">Medium (6-11)</SelectItem>
                  <SelectItem value="low">Low (1-5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Risks List */}
      {filteredRisks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Risks Found</h3>
            <p className="text-gray-600">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No risks have been identified for your projects yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRisks.map((risk) => {
            const severity = getRiskSeverity(risk.riskScore);
            
            return (
              <Card 
                key={risk._id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => viewRiskDetails(risk)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {risk.riskCode}
                            </Badge>
                            <Badge className={getCategoryColor(risk.category)}>
                              {risk.category.replace('_', ' ')}
                            </Badge>
                            <Badge className={getStatusColor(risk.status)}>
                              {getStatusIcon(risk.status)}
                              <span className="ml-1">{risk.status.replace('_', ' ')}</span>
                            </Badge>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mt-2">
                            {risk.riskDescription}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Project: {risk.projectTitle}
                          </p>
                        </div>

                        {/* Risk Score Badge */}
                        <div className={`px-3 py-2 rounded-lg border-2 ${getSeverityColor(severity)} flex-shrink-0`}>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{risk.riskScore}</p>
                            <p className="text-xs font-medium uppercase">{severity}</p>
                          </div>
                        </div>
                      </div>

                      {/* Mitigation Strategy Preview */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Mitigation Strategy:
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {risk.mitigationStrategy}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-4">
                          <span>Owner: {risk.owner.name}</span>
                          {risk.comments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {risk.comments.length} {risk.comments.length === 1 ? 'comment' : 'comments'}
                            </span>
                          )}
                        </div>
                        <span>
                          Updated {formatDistanceToNow(new Date(risk.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Risk Details Dialog - Will continue in next part */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedRisk && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedRisk.riskCode}
                  </Badge>
                  <span>{selectedRisk.riskDescription}</span>
                </DialogTitle>
                <DialogDescription>
                  Project: {selectedRisk.projectTitle}
                </DialogDescription>
              </DialogHeader>

              {/* Risk details content will continue... */}
              <div className="space-y-6 mt-4">
                {/* Risk Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <Badge className={getCategoryColor(selectedRisk.category)}>
                        {selectedRisk.category.replace('_', ' ')}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <Badge className={getStatusColor(selectedRisk.status)}>
                        {getStatusIcon(selectedRisk.status)}
                        <span className="ml-1">{selectedRisk.status.replace('_', ' ')}</span>
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className={getSeverityColor(getRiskSeverity(selectedRisk.riskScore))}>
                    <CardContent className="pt-6">
                      <p className="text-sm mb-1">Risk Score</p>
                      <p className="text-3xl font-bold">{selectedRisk.riskScore}</p>
                      <p className="text-xs font-medium uppercase mt-1">
                        {getRiskSeverity(selectedRisk.riskScore)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Risk Assessment Matrix */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Probability</p>
                        <Badge variant="outline" className="text-sm">
                          {selectedRisk.probability.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Impact</p>
                        <Badge variant="outline" className="text-sm">
                          {selectedRisk.impact.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {selectedRisk.residualProbability && selectedRisk.residualImpact && (
                      <>
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">Residual Risk (After Mitigation)</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Residual Probability</p>
                              <Badge variant="outline" className="text-sm bg-green-50">
                                {selectedRisk.residualProbability.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Residual Impact</p>
                              <Badge variant="outline" className="text-sm bg-green-50">
                                {selectedRisk.residualImpact.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          {selectedRisk.residualScore && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600 mb-1">Residual Score</p>
                              <p className="text-2xl font-bold text-green-700">{selectedRisk.residualScore}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Triggers */}
                {selectedRisk.triggers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Risk Triggers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedRisk.triggers.map((trigger, index) => (
                          <li key={index} className="text-sm text-gray-700">{trigger}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Mitigation Strategy */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mitigation Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedRisk.mitigationStrategy}
                    </p>
                  </CardContent>
                </Card>

                {/* Contingency Plan */}
                {selectedRisk.contingencyPlan && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Contingency Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedRisk.contingencyPlan}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Owner and Dates */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Risk Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Risk Owner</p>
                      <p className="text-sm text-gray-600">{selectedRisk.owner.name}</p>
                      <p className="text-xs text-gray-500">{selectedRisk.owner.email}</p>
                    </div>
                    {selectedRisk.reviewDate && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Next Review Date</p>
                        <p className="text-sm text-gray-600">
                          {new Date(selectedRisk.reviewDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                    {selectedRisk.lastReviewDate && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Last Review Date</p>
                        <p className="text-sm text-gray-600">
                          {new Date(selectedRisk.lastReviewDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Comments Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Comments ({selectedRisk.comments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Existing Comments */}
                    {selectedRisk.comments.length > 0 && (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {selectedRisk.comments.map((comment) => (
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

                    {/* Add Comment */}
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