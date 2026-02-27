// src/app/(dashboard)/manager/projects/[id]/milestones/page.tsx - MILESTONE MANAGEMENT
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  ArrowLeft,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Save,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Import our types
import type { ProjectMilestone } from '@/lib/types/milestone';

interface Project {
  _id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
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
}

interface MilestoneData {
  milestones: ProjectMilestone[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

// ✅ Proper typing for milestone status
type MilestoneStatus = 'pending' | 'in_progress' | 'completed';

export default function MilestoneManagementPage() {
  const params = useParams();
  const { data: session } = useSession();
  const { toast } = useToast();

  // State management
  const [project, setProject] = useState<Project | null>(null);
  const [milestoneData, setMilestoneData] = useState<MilestoneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('pending');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const projectId = params.id as string;

  // ✅ Memoized functions to fix useEffect dependency warnings
  const fetchProjectData = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      
      if (data.success) {
        setProject(data.data.project);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch project data",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: "Error",
        description: "Failed to fetch project data",
        variant: "destructive"
      });
    }
  }, [projectId, toast]);

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/milestones`);
      const data = await response.json();
      
      if (data.success) {
        setMilestoneData(data.data);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch milestones",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching milestones:', error);
      toast({
        title: "Error",
        description: "Failed to fetch milestones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  // ✅ Fixed useEffect with proper dependencies
  useEffect(() => {
    if (projectId && session?.user?.id) {
      fetchProjectData();
      fetchMilestones();
    }
  }, [projectId, session?.user?.id, fetchProjectData, fetchMilestones]);

  const handleUpdateMilestone = async () => {
    if (!editingMilestone) return;

    try {
      setUpdating(editingMilestone._id);
      
      const response = await fetch(`/api/milestones/${editingMilestone._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          notes: notes.trim() || undefined
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Milestone updated successfully",
        });
        
        // Refresh milestones
        await fetchMilestones();
        
        // Close dialog
        setShowUpdateDialog(false);
        setEditingMilestone(null);
        setNotes('');
        setStatus('pending');
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update milestone",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating milestone:', error);
      toast({
        title: "Error",
        description: "Failed to update milestone",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const openUpdateDialog = (milestone: ProjectMilestone) => {
    setEditingMilestone(milestone);
    setStatus(milestone.status);
    setNotes(milestone.notes || '');
    setShowUpdateDialog(true);
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPhaseDescription = (phase: string): string => {
    const descriptions: Record<string, string> = {
      construction: 'Complete all structural and foundational construction work',
      installation: 'Install all fixtures, utilities, and essential systems',
      styling: 'Complete interior design, styling, and final setup'
    };
    return descriptions[phase] || '';
  };

  const getPhaseOrder = (phase: string): number => {
    const order: Record<string, number> = {
      construction: 1,
      installation: 2,
      styling: 3
    };
    return order[phase] || 0;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // ✅ Properly typed value change handler
  const handleStatusChange = (value: string) => {
    setStatus(value as MilestoneStatus);
  };

  // Check permissions
  const canManageMilestones = session?.user?.role === 'super_admin' || 
    (session?.user?.role === 'project_manager' && project?.manager._id === session.user.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading milestones...</p>
        </div>
      </div>
    );
  }

  if (!project || !milestoneData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
          <p className="text-gray-600">The requested project could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/manager/projects/${projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Project Milestones
            </h1>
            <p className="text-gray-600 mt-1">{project.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(project.status)}>
            {project.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Milestone Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Overall Progress</span>
              <span className="text-2xl font-bold text-purple-600">
                {milestoneData.progress.completed}/{milestoneData.progress.total} completed
              </span>
            </div>
            
            <Progress 
              value={milestoneData.progress.percentage} 
              className="h-3"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border">
                <p className="text-2xl font-bold text-green-600">
                  {milestoneData.milestones.filter(m => m.status === 'completed').length}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <p className="text-2xl font-bold text-blue-600">
                  {milestoneData.milestones.filter(m => m.status === 'in_progress').length}
                </p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <p className="text-2xl font-bold text-yellow-600">
                  {milestoneData.milestones.filter(m => m.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones List */}
      <div className="space-y-4">
        {milestoneData.milestones
          .sort((a, b) => getPhaseOrder(a.phase) - getPhaseOrder(b.phase))
          .map((milestone, index) => (
            <Card key={milestone._id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Phase Number */}
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        milestone.status === 'completed' 
                          ? 'bg-green-500 text-white' 
                          : milestone.status === 'in_progress'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {milestone.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <span className="font-bold">{index + 1}</span>
                        )}
                      </div>
                    </div>

                    {/* Milestone Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {milestone.title}
                        </h3>
                        <Badge className={`${getStatusColor(milestone.status)} text-xs`}>
                          {milestone.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-3">
                        {getPhaseDescription(milestone.phase)}
                      </p>

                      {milestone.status === 'completed' && milestone.completedDate && (
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Completed: {formatDate(milestone.completedDate)}</span>
                          </div>
                          {milestone.completedBy && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>By: Project Manager</span>
                            </div>
                          )}
                        </div>
                      )}

                      {milestone.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Notes</span>
                          </div>
                          <p className="text-sm text-gray-600">{milestone.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManageMilestones && (
                    <div className="flex-shrink-0 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUpdateDialog(milestone)}
                        disabled={updating === milestone._id}
                      >
                        {updating === milestone._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        ) : (
                          <Edit className="h-4 w-4" />
                        )}
                        <span className="ml-2">Update</span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Update Milestone Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Milestone</DialogTitle>
            <DialogDescription>
              Update the status and add notes for this milestone.
            </DialogDescription>
          </DialogHeader>
          
          {editingMilestone && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  {editingMilestone.title}
                </h4>
                <p className="text-sm text-gray-600">
                  {getPhaseDescription(editingMilestone.phase)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this milestone..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUpdateDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateMilestone}
              disabled={updating !== null}
            >
              {updating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info */}
      {!canManageMilestones && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-1">Read-Only View</h4>
                <p className="text-sm text-yellow-700">
                  You have read-only access to these milestones. Only project managers and admins can update milestone status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}