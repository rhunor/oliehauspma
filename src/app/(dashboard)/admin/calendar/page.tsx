// src/app/(dashboard)/admin/calendar/page.tsx - NEW CALENDAR PAGE
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import CalendarClient from '@/components/calendar/CalendarClient';

// Define types for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  startDate: Date;
  endDate: Date;
  status: string;
  client?: ObjectId;
  manager?: ObjectId;
  milestones?: MilestoneDocument[];
}

interface TaskDocument {
  _id: ObjectId;
  projectId: ObjectId;
  title: string;
  assignee?: ObjectId;
  deadline: Date;
  status: string;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
}

interface MilestoneDocument {
  _id?: ObjectId;
  title: string;
  date: Date; // Make sure this matches what you're using in the transformation
  status: string;
  description?: string;
}

// Define aggregation result types
interface TaskWithJoins extends Omit<TaskDocument, 'projectId' | 'assignee'> {
  project: Pick<ProjectDocument, '_id' | 'title'>;
  assignee: Pick<UserDocument, '_id' | 'name'> | null;
  priority?: string; // Add this if tasks have priority
}



// Define the client-side interfaces that match what CalendarClient expects
interface CalendarProjectData {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface CalendarTaskData {
  _id: string;
  title: string;
  deadline: string;
  status: string;
  priority?: string;
  project?: {
    _id: string;
    title: string;
  };
  assignee?: {
    _id: string;
    name: string;
  };
}

interface CalendarMilestoneData {
  _id?: string;
  title?: string;
  name?: string;
  dueDate: string;
  projectTitle: string;
  projectId: string;
}

interface CalendarData {
  projects: CalendarProjectData[];
  tasks: CalendarTaskData[];
  milestones: CalendarMilestoneData[];
}

async function getCalendarData(userId: string, userRole: string): Promise<CalendarData> {
  const { db } = await connectToDatabase();

  // Get user's projects with proper typing
  const projectsQuery: Filter<ProjectDocument> = {};
  
  if (userRole === 'client') {
    projectsQuery.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectsQuery.manager = new ObjectId(userId);
  }

  const userProjects = await db.collection<ProjectDocument>('projects')
    .find(projectsQuery)
    .project({ _id: 1, title: 1, startDate: 1, endDate: 1, status: 1 })
    .toArray();

  const projectIds = userProjects.map(p => p._id);

  // Get tasks with deadlines
  const tasks = await db.collection<TaskDocument>('tasks')
    .aggregate<TaskWithJoins>([
      { 
        $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'projectData',
          pipeline: [{ $project: { title: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignee',
          foreignField: '_id',
          as: 'assigneeData',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$projectData', 0] },
          assignee: { $arrayElemAt: ['$assigneeData', 0] }
        }
      },
      { $unset: ['projectData', 'assigneeData'] }
    ])
    .toArray();

  // Get project milestones
  const projectsWithMilestones = await db.collection<ProjectDocument>('projects')
    .find({ 
      $and: [
        userRole === 'super_admin' ? {} : { _id: { $in: projectIds } },
        { 'milestones.0': { $exists: true } }
      ]
    })
    .toArray();

  // Convert and transform the milestone data to include proper dueDate
  const milestonesFlattened: CalendarMilestoneData[] = projectsWithMilestones.flatMap(project => 
    project.milestones?.map((milestone) => ({
      _id: milestone._id?.toString(),
      title: milestone.title,
      name: milestone.title, // Use title as name fallback
      dueDate: milestone.date.toISOString(), // Convert Date to string
      projectTitle: project.title,
      projectId: project._id.toString()
    })) || []
  );

  // Convert ObjectIds to strings and Dates to ISO strings for client consumption
  const clientProjects: CalendarProjectData[] = userProjects.map(project => ({
    _id: project._id.toString(),
    title: project.title,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    status: project.status
  }));

  const clientTasks: CalendarTaskData[] = tasks.map(task => ({
    _id: task._id.toString(),
    title: task.title,
    deadline: task.deadline.toISOString(),
    status: task.status,
    priority: task.priority,
    project: task.project ? {
      _id: task.project._id.toString(),
      title: task.project.title
    } : undefined,
    assignee: task.assignee ? {
      _id: task.assignee._id.toString(),
      name: task.assignee.name
    } : undefined
  }));

  return {
    projects: clientProjects,
    tasks: clientTasks,
    milestones: milestonesFlattened
  };
}

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const calendarData = await getCalendarData(session.user.id, session.user.role);

  return <CalendarClient {...calendarData} />;
}