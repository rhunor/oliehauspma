// src/app/(dashboard)/admin/files/page.tsx - FIXED SERVER COMPONENT
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId, Filter } from 'mongodb';
import FilesClient from '@/components/files/FilesClient';

// Define types for MongoDB documents
interface ProjectDocument {
  _id: ObjectId;
  title: string;
  client?: ObjectId;
  manager?: ObjectId;
}

interface FileDocument {
  _id: ObjectId;
  projectId: ObjectId;
  uploadedBy: ObjectId;
  category: string;
  size: number;
  createdAt: Date;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  tags: string[];
  description: string;
  isPublic: boolean;
  downloadCount: number;
}

interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  password?: string; // Excluded in projection
}

// Define aggregation result types
interface FileWithJoins extends Omit<FileDocument, 'uploadedBy' | 'projectId'> {
  uploadedBy: Omit<UserDocument, 'password'>;
  project: Pick<ProjectDocument, '_id' | 'title'>;
}

interface FileStatsResult {
  _id: string;
  count: number;
  totalSize: number;
}

interface FileStats {
  total: number;
  totalSize: number;
  byCategory: Record<string, number>;
}

// Define client-side interfaces (what FilesClient expects)
interface ClientFileData {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'other';
  tags: string[];
  description: string;
  isPublic: boolean;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  project: {
    _id: string;
    title: string;
  };
  createdAt: string;
  downloadCount: number;
}

interface ClientUserProject {
  _id: string;
  title: string;
}

interface FilesData {
  files: ClientFileData[];
  stats: FileStats;
  userProjects: ClientUserProject[];
}

async function getFilesData(userId: string, userRole: string): Promise<FilesData> {
  const { db } = await connectToDatabase();

  // Build query based on user role with proper typing
  const projectsQuery: Filter<ProjectDocument> = {};
  
  if (userRole === 'client') {
    projectsQuery.client = new ObjectId(userId);
  } else if (userRole === 'project_manager') {
    projectsQuery.manager = new ObjectId(userId);
  }
  // super_admin can see all files

  // Get user's accessible projects
  const userProjects = await db.collection<ProjectDocument>('projects')
    .find(projectsQuery)
    .project({ _id: 1, title: 1 })
    .toArray();

  const projectIds = userProjects.map(p => p._id);

  // Get files with pagination
  const files = await db.collection<FileDocument>('files')
    .aggregate<FileWithJoins>([
      { 
        $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'uploadedBy',
          foreignField: '_id',
          as: 'uploaderData',
          pipeline: [{ $project: { password: 0 } }]
        }
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
        $addFields: {
          uploadedBy: { $arrayElemAt: ['$uploaderData', 0] },
          project: { $arrayElemAt: ['$projectData', 0] }
        }
      },
      { $unset: ['uploaderData', 'projectData'] },
      { $sort: { createdAt: -1 } },
      { $limit: 50 }
    ])
    .toArray();

  // Get file statistics
  const fileStats = await db.collection<FileDocument>('files').aggregate<FileStatsResult>([
    { 
      $match: userRole === 'super_admin' ? {} : { projectId: { $in: projectIds } }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]).toArray();

  const stats: FileStats = {
    total: fileStats.reduce((sum, stat) => sum + stat.count, 0),
    totalSize: fileStats.reduce((sum, stat) => sum + stat.totalSize, 0),
    byCategory: fileStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>)
  };

  // Convert MongoDB data to client-compatible format
  const clientFiles: ClientFileData[] = files.map(file => ({
    _id: file._id.toString(),
    filename: file.filename,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    url: file.url,
    category: file.category as 'image' | 'video' | 'audio' | 'document' | 'other',
    tags: file.tags || [],
    description: file.description || '',
    isPublic: file.isPublic || false,
    uploadedBy: {
      _id: file.uploadedBy._id.toString(),
      name: file.uploadedBy.name,
      email: file.uploadedBy.email
    },
    project: {
      _id: file.project._id.toString(),
      title: file.project.title
    },
    createdAt: file.createdAt.toISOString(),
    downloadCount: file.downloadCount || 0
  }));

  const clientUserProjects: ClientUserProject[] = userProjects.map(project => ({
    _id: project._id.toString(),
    title: project.title
  }));

  return {
    files: clientFiles,
    stats,
    userProjects: clientUserProjects
  };
}

export default async function FilesPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const { files, stats, userProjects } = await getFilesData(
    session.user.id, 
    session.user.role
  );

  return (
    <FilesClient 
      files={files}
      stats={stats}
      userProjects={userProjects}
      userRole={session.user.role}
    />
  );
}