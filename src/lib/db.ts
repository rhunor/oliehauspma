import { MongoClient, Db, MongoClientOptions, Document, ClientSession } from 'mongodb';
import mongoose from 'mongoose';

let client: MongoClient | null = null;
let db: Db | null = null;

let isConnected = false;

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'olivehaus';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  try {
    if (client && db) {
      return { client, db };
    }

    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI!, options);
    await client.connect();
    
    db = client.db(MONGODB_DB);
    
    console.log('Connected to MongoDB successfully');
    return { client, db };
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function connectToMongoose(): Promise<typeof mongoose> {
  try {
    if (isConnected) {
      return mongoose;
    }

    console.log('Connecting to MongoDB via Mongoose...');
    
    const conn = await mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
    });

    isConnected = conn.connection.readyState === 1;
    
    console.log('Connected to MongoDB via Mongoose successfully');
    return mongoose;
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB via Mongoose:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('Disconnected from MongoDB');
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      console.log('Disconnected from Mongoose');
    }
  } catch (error: unknown) {
    console.error('Error disconnecting from database:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  if (!db) {
    const { db: database } = await connectToDatabase();
    return database;
  }
  return db;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = await getDatabase();
    await database.admin().ping();
    return true;
  } catch (error: unknown) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export async function createIndexes(): Promise<void> {
  try {
    const database = await getDatabase();

    await database.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { isActive: 1 } },
      { key: { createdAt: -1 } },
    ]);

    await database.collection('projects').createIndexes([
      { key: { client: 1 } },
      { key: { manager: 1 } },
      { key: { status: 1 } },
      { key: { priority: 1 } },
      { key: { startDate: 1 } },
      { key: { endDate: 1 } },
      { key: { createdAt: -1 } },
      { key: { title: 'text', description: 'text' } },
    ]);

    await database.collection('tasks').createIndexes([
      { key: { projectId: 1 } },
      { key: { assignee: 1 } },
      { key: { status: 1 } },
      { key: { priority: 1 } },
      { key: { deadline: 1 } },
      { key: { createdAt: -1 } },
      { key: { projectId: 1, status: 1 } },
    ]);

    await database.collection('chatmessages').createIndexes([
      { key: { projectId: 1 } },
      { key: { sender: 1 } },
      { key: { recipient: 1 } },
      { key: { createdAt: -1 } },
      { key: { projectId: 1, createdAt: -1 } },
    ]);

    await database.collection('notifications').createIndexes([
      { key: { recipient: 1 } },
      { key: { isRead: 1 } },
      { key: { type: 1 } },
      { key: { createdAt: -1 } },
      { key: { recipient: 1, isRead: 1 } },
    ]);

    await database.collection('projectfiles').createIndexes([
      { key: { projectId: 1 } },
      { key: { uploadedBy: 1 } },
      { key: { category: 1 } },
      { key: { isPublic: 1 } },
      { key: { uploadedAt: -1 } },
    ]);

    console.log('Database indexes created successfully');
  } catch (error: unknown) {
    console.error('Error creating database indexes:', error);
    throw error;
  }
}

export async function withTransaction<T>(
  callback: (session: ClientSession) => Promise<T>
): Promise<T> {
  const { client } = await connectToDatabase();
  const session = client.startSession();

  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error: unknown) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function aggregateCollection<T extends Document = Document>(
  collectionName: string,
  pipeline: Document[]
): Promise<T[]> {
  try {
    const database = await getDatabase();
    const collection = database.collection(collectionName);
    const result = await collection.aggregate<T>(pipeline).toArray();
    return result;
  } catch (error: unknown) {
    console.error(`Error aggregating collection ${collectionName}:`, error);
    throw error;
  }
}

import type { AnyBulkWriteOperation } from 'mongodb';

export async function bulkWrite(
  collectionName: string,
  operations: AnyBulkWriteOperation<Document>[]
): Promise<Document> {
  try {
    const database = await getDatabase();
    const collection = database.collection(collectionName);
    return await collection.bulkWrite(operations);
  } catch (error: unknown) {
    console.error(`Error performing bulk write on ${collectionName}:`, error);
    throw error;
  }
}

export async function cleanupExpiredData(): Promise<void> {
  try {
    const database = await getDatabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await database.collection('notifications').deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      isRead: true,
    });

    console.log('Expired data cleanup completed');
  } catch (error: unknown) {
    console.error('Error during data cleanup:', error);
    throw error;
  }
}

export async function getDatabaseStats(): Promise<Document> {
  try {
    const database = await getDatabase();
    const stats = await database.stats();
    
    const collections = await database.listCollections().toArray();
    const collectionStats = await Promise.all(
      collections.map(async (col) => {
        try {
          const collection = database.collection(col.name);
          const count = await collection.countDocuments();
          const indexInfo = await collection.indexes();
          
          return {
            name: col.name,
            count,
            indexes: indexInfo.length,
          };
        } catch (error: unknown) {
          console.warn(`Error getting stats for collection ${col.name}:`, error);
          return {
            name: col.name,
            count: 0,
            indexes: 0,
          };
        }
      })
    );

    return {
      database: {
        name: stats.db,
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
      },
      collections: collectionStats,
    };
  } catch (error: unknown) {
    console.error('Error getting database stats:', error);
    throw error;
  }
}

export async function createBackup(collectionName?: string): Promise<Document> {
  try {
    const database = await getDatabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (collectionName) {
      const collection = database.collection(collectionName);
      const data = await collection.find({}).toArray();
      return {
        collection: collectionName,
        timestamp,
        data,
        count: data.length,
      };
    } else {
      const collections = await database.listCollections().toArray();
      const backup = await Promise.all(
        collections.map(async (col) => {
          const data = await database.collection(col.name).find({}).toArray();
          return {
            collection: col.name,
            data,
            count: data.length,
          };
        })
      );

      return {
        timestamp,
        collections: backup,
        totalDocuments: backup.reduce((sum, col) => sum + col.count, 0),
      };
    }
  } catch (error: unknown) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

export async function textSearch<T extends Document = Document>(
  collectionName: string,
  searchTerm: string,
  options: {
    limit?: number;
    skip?: number;
    sort?: Record<string, unknown>;
    filter?: Record<string, unknown>;
  } = {}
): Promise<T[]> {
  try {
    const database = await getDatabase();
    const collection = database.collection(collectionName);
    
    const query = {
      $and: [
        { $text: { $search: searchTerm } },
        options.filter || {},
      ].filter(Boolean),
    };

    let cursor = collection.find<T>(query);

    if (options.sort) {
      cursor = cursor.sort(options.sort as Sort);
    } else {
      cursor = cursor.sort({ score: { $meta: 'textScore' } });
    }

    if (options.skip) {
      cursor = cursor.skip(options.skip);
    }

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    return await cursor.toArray() as T[];
  } catch (error: unknown) {
    console.error(`Error performing text search on ${collectionName}:`, error);
    throw error;
  }
}

import type { Sort } from 'mongodb';

export async function paginateCollection<T extends Document = Document>(
  collectionName: string,
  options: {
    page: number;
    limit: number;
    sort?: Sort;
    filter?: Record<string, unknown>;
    projection?: Document;
  }
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  try {
    const database = await getDatabase();
    const collection = database.collection(collectionName);
    
    const { page, limit, sort = { createdAt: -1 }, filter = {}, projection = {} } = options;
    const skip = (page - 1) * limit;

    const total = await collection.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    let cursor = collection.find<T>(filter, { projection });
    
    if (sort) {
      cursor = cursor.sort(sort as Sort);
    }

    const data = await cursor.skip(skip).limit(limit).toArray() as T[];

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: unknown) {
    console.error(`Error paginating collection ${collectionName}:`, error);
    throw error;
  }
}

if (typeof window === 'undefined') {
  process.on('SIGINT', async () => {
    await disconnectFromDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectFromDatabase();
    process.exit(0);
  });
}

const dbExports = {
  connectToDatabase,
  connectToMongoose,
  disconnectFromDatabase,
  getDatabase,
  checkDatabaseHealth,
  createIndexes,
  withTransaction,
  aggregateCollection,
  bulkWrite,
  cleanupExpiredData,
  getDatabaseStats,
  createBackup,
  textSearch,
  paginateCollection,
};

export default dbExports;