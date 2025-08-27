// src/app/(dashboard)/admin/projects/[id]/milestones/page.tsx - NEW MILESTONES PAGE
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Target,
  CheckCircle,
  Clock,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getProjectById } from '@/lib/projects';

interface MilestonesPageProps {
  params: Promise<{ id: string }>;
}

// Sample milestone data structure
interface Milestone {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue';
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: string;
  completedDate?: string;
  createdAt: string;
}

// Mock data for demonstration
const sampleMilestones: Milestone[] = [
  {
    _id: '1',
    title: 'Foundation Complete',
    description: 'Complete foundation work including excavation, concrete pouring, and curing',
    dueDate: '2025-09-15T00:00:00.000Z',
    status: 'completed',
    progress: 100,
    priority: 'high',
    dependencies: [],
    completedDate: '2025-09-10T00:00:00.000Z',
    createdAt: '2025-08-01T00:00:00.000Z'
  },
  {
    _id: '2',
    title: 'Framing Complete',
    description: 'Complete structural framing including walls, roof structure, and initial inspections',
    dueDate: '2025-10-30T00:00:00.000Z',
    status: 'in_progress',
    progress: 65,
    priority: 'high',
    dependencies: ['1'],
    createdAt: '2025-08-01T00:00:00.000Z'
  },
  {
    _id: '3',
    title: 'Electrical Rough-In',
    description: 'Install electrical wiring, outlets, and prepare for electrical inspection',
    dueDate: '2025-11-15T00:00:00.000Z',
    status: 'upcoming',
    progress: 0,
    priority: 'medium',
    dependencies: ['2'],
    createdAt: '2025-08-01T00:00:00.000Z'
  },
  {
    _id: '4',
    title: 'Plumbing Rough-In',
    description: 'Install plumbing systems, pipes, and prepare for plumbing inspection',
    dueDate: '2025-11-20T00:00:00.000Z',
    status: 'upcoming',
    progress: 0,
    priority: 'medium',
    dependencies: ['2'],
    createdAt: '2025-08-01T00:00:00.000Z'
  },
  {
    _id: '5',
    title: 'Final Walkthrough',
    description: 'Complete final inspection and client walkthrough before handover',
    dueDate: '2025-12-31T00:00:00.000Z',
    status: 'upcoming',
    progress: 0,
    priority: 'critical',
    dependencies: ['3', '4'],
    createdAt: '2025-08-01T00:00:00.000Z'
  }
];

export default async function ProjectMilestonesPage({ params }: MilestonesPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || (session.user.role !== 'super_admin' && session.user.role !== 'project_manager')) {
    return (
      <div className="flex items-center justify-center min-h-96 p-4">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm sm:text-base text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const resolvedParams = await params;
  const project = await getProjectById(resolvedParams.id, session.user.role, session.user.id);

  if (!project) {
    notFound();
  }

  // Helper functions
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upcoming': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress': return <Clock className="h-5 w-5 text-blue-500" />;
      case 'upcoming': return <Target className="h-5 w-5 text-gray-400" />;
      case 'overdue': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate project stats
  const stats = {
    total: sampleMilestones.length,
    completed: sampleMilestones.filter(m => m.status === 'completed').length,
    inProgress: sampleMilestones.filter(m => m.status === 'in_progress').length,
    upcoming: sampleMilestones.filter(m => m.status === 'upcoming').length,
    overdue: sampleMilestones.filter(m => m.status === 'overdue').length,
  };

  const overallProgress = Math.round(
    sampleMilestones.reduce((sum, milestone) => sum + milestone.progress, 0) / sampleMilestones.length
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link 
            href={`/${session.user.role === 'super_admin' ? 'admin' : 'manager'}/projects/${resolvedParams.id}`} 
            className="flex-shrink-0 mt-1"
          >
            <Button variant="outline" size="sm" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words">
              Project Milestones
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {project.title}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Milestone</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
            <p className="text-lg sm:text-2xl font-bold text-green-700">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Upcoming</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-700">{stats.upcoming}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Progress</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-700">{overallProgress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Overall Progress</h3>
            <span className="text-sm font-medium text-gray-600">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Milestones List */}
      <div className="space-y-4">
        {sampleMilestones.map((milestone) => (
          <Card key={milestone._id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(milestone.status)}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                        {milestone.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        {milestone.description}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                      <Badge className={`${getStatusColor(milestone.status)} text-xs`}>
                        {milestone.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={`${getPriorityColor(milestone.priority)} text-xs`}>
                        {milestone.priority}
                      </Badge>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs sm:text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{milestone.progress}%</span>
                    </div>
                    <Progress value={milestone.progress} className="h-2" />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <span className="text-gray-600">Due Date:</span>
                        <span className="ml-1 font-medium">{formatDate(milestone.dueDate)}</span>
                      </div>
                    </div>
                    
                    {milestone.completedDate && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div>
                          <span className="text-gray-600">Completed:</span>
                          <span className="ml-1 font-medium">{formatDate(milestone.completedDate)}</span>
                        </div>
                      </div>
                    )}
                    
                    {milestone.dependencies.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <span className="text-gray-600">Dependencies:</span>
                          <span className="ml-1 font-medium">{milestone.dependencies.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <Edit className="h-4 w-4 mr-1" />
                    <span className="text-xs">Edit</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="text-xs">Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State (if no milestones) */}
      {sampleMilestones.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Milestones Yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first milestone to start tracking project progress.
            </p>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add First Milestone
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}