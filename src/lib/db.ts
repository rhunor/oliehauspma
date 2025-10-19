// src/lib/db.ts
import { MongoClient, Db, MongoClientOptions, Document, ClientSession, Sort } from 'mongodb';
import mongoose from 'mongoose';
import type { AnyBulkWriteOperation } from 'mongodb';

// Global connection caching for serverless
let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'olivehaus';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Optimized options for Next.js serverless environment
const options: MongoClientOptions = {
  // Connection Pool Settings - Optimized for serverless
  maxPoolSize: 5, // Reduced from 10 for serverless
  minPoolSize: 1, // Ensure at least 1 connection stays warm
  
  // Timeout Settings - Increased for Atlas reliability
  serverSelectionTimeoutMS: 30000, // Increased from 5000
  socketTimeoutMS: 60000, // Increased from 45000
  connectTimeoutMS: 30000, // Added explicit connect timeout
  
  // Serverless Optimizations
  maxIdleTimeMS: 270000, // 4.5 min - keep connections alive longer
  heartbeatFrequencyMS: 30000, // 30 sec heartbeat
  
  // Atlas Specific Settings
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  
  // Network Settings
  family: 4, // IPv4
  
  // Compression for better performance
  compressors: ['zlib'],
};

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  try {
    // Return existing connection if available and connected
    if (client && db) {
      try {
        // Test if connection is still alive with a quick ping
        await db.admin().ping();
        return { client, db };
      } catch {
        console.warn('⚠️ Existing connection is stale, creating new one');
        // Connection is stale, continue to create new one
      }
    }

    console.log('🔄 Connecting to MongoDB Atlas...');
    
    // Close any existing stale connections
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.warn('Warning: Error closing stale connection:', closeError);
      }
      client = null;
      db = null;
    }

    // Create new connection with retry logic
    client = new MongoClient(MONGODB_URI!, options);
    
    // Add connection event listeners for debugging
    client.on('serverHeartbeatStarted', () => console.log('🔄 MongoDB heartbeat started'));
    client.on('serverHeartbeatSucceeded', () => console.log('💓 MongoDB heartbeat succeeded'));
    client.on('serverHeartbeatFailed', (event) => console.log('💔 MongoDB heartbeat failed:', event.failure));
    client.on('connectionPoolCreated', () => console.log('🏊 MongoDB connection pool created'));
    client.on('connectionCreated', () => console.log('🔗 MongoDB connection created'));
    client.on('error', (connectionError) => console.error('❌ MongoDB client error:', connectionError));
    
    // Connect with timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
      )
    ]);
    
    db = client.db(MONGODB_DB);
    
    // Test connection
    await db.admin().ping();
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    return { client, db };
    
  } catch (error: unknown) {
    console.error('❌ Failed to connect to MongoDB Atlas:', error);
    
    // Clean up on failure
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.warn('Warning: Error closing failed connection:', closeError);
      }
      client = null;
      db = null;
    }
    
    throw error;
  }
}

// Mongoose connection with similar optimizations
export async function connectToMongoose(): Promise<typeof mongoose> {
  try {
    if (isConnected && mongoose.connection.readyState === 1) {
      return mongoose;
    }

    console.log('🔄 Connecting to MongoDB via Mongoose...');
    
    // Close existing connection if stale
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
    }

    const conn = await mongoose.connect(MONGODB_URI!, {
      dbName: MONGODB_DB, // Ensure Mongoose uses the same DB name as MongoClient
      // Mongoose-specific optimizations
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      maxIdleTimeMS: 270000,
      heartbeatFrequencyMS: 30000,
      
      // Atlas specific
      retryWrites: true,
      retryReads: true,
    });

    isConnected = conn.connection.readyState === 1;
    
    console.log('✅ Connected to MongoDB via Mongoose successfully', {
      dbName: conn.connection.name,
      host: conn.connection.host,
    });
    return mongoose;
    
  } catch (mongooseError: unknown) {
    console.error('❌ Failed to connect to MongoDB via Mongoose:', mongooseError);
    isConnected = false;
    throw mongooseError;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('🔌 Disconnected from MongoDB');
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      console.log('🔌 Disconnected from Mongoose');
    }
  } catch (disconnectError: unknown) {
    console.error('❌ Error disconnecting from database:', disconnectError);
    // Don't throw here, just log the error
  }
}

export async function getDatabase(): Promise<Db> {
  if (!db || !client) {
    const { db: database } = await connectToDatabase();
    return database;
  }
  
  try {
    // Test if connection is still alive
    await db.admin().ping();
    return db;
  } catch {
    console.warn('⚠️ Database connection is stale, reconnecting...');
    const { db: database } = await connectToDatabase();
    return database;
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const database = await getDatabase();
    await Promise.race([
      database.admin().ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 10000)
      )
    ]);
    return true;
  } catch (healthError: unknown) {
    console.error('❌ Database health check failed:', healthError);
    return false;
  }
}

// Connection retry helper for critical operations
export async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (retryError: unknown) {
      lastError = retryError;
      console.warn(`❌ Operation failed (attempt ${attempt}/${maxRetries}):`, retryError);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
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

    console.log('✅ Database indexes created successfully');
  } catch (indexError: unknown) {
    console.error('❌ Error creating database indexes:', indexError);
    throw indexError;
  }
}

export async function withTransaction<T>(
  callback: (session: ClientSession) => Promise<T>
): Promise<T> {
  const { client } = await connectToDatabase();
  const session = client.startSession();

  try {
    session.startTransaction();
    const transactionResult = await callback(session);
    await session.commitTransaction();
    return transactionResult;
  } catch (transactionError: unknown) {
    await session.abortTransaction();
    throw transactionError;
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
    const aggregationResult = await collection.aggregate<T>(pipeline).toArray();
    return aggregationResult;
  } catch (aggregateError: unknown) {
    console.error(`❌ Error aggregating collection ${collectionName}:`, aggregateError);
    throw aggregateError;
  }
}

export async function bulkWrite(
  collectionName: string,
  operations: AnyBulkWriteOperation<Document>[]
): Promise<Document> {
  try {
    const database = await getDatabase();
    const collection = database.collection(collectionName);
    return await collection.bulkWrite(operations);
  } catch (bulkError: unknown) {
    console.error(`❌ Error performing bulk write on ${collectionName}:`, bulkError);
    throw bulkError;
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

    console.log('✅ Expired data cleanup completed');
  } catch (cleanupError: unknown) {
    console.error('❌ Error during data cleanup:', cleanupError);
    throw cleanupError;
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
        } catch (collectionError: unknown) {
          console.warn(`⚠️ Error getting stats for collection ${col.name}:`, collectionError);
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
  } catch (statsError: unknown) {
    console.error('❌ Error getting database stats:', statsError);
    throw statsError;
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
  } catch (backupError: unknown) {
    console.error('❌ Error creating backup:', backupError);
    throw backupError;
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
      cursor = cursor.sort({ score: { $meta: 'textScore' } } as Sort);
    }

    if (options.skip) {
      cursor = cursor.skip(options.skip);
    }

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    return await cursor.toArray() as T[];
  } catch (searchError: unknown) {
    console.error(`❌ Error performing text search on ${collectionName}:`, searchError);
    throw searchError;
  }
}

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
  } catch (paginateError: unknown) {
    console.error(`❌ Error paginating collection ${collectionName}:`, paginateError);
    throw paginateError;
  }
}

// Graceful shutdown handling
if (typeof window === 'undefined') {
  process.on('SIGINT', async () => {
    console.log('🔄 Gracefully shutting down database connections...');
    await disconnectFromDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🔄 Gracefully shutting down database connections...');
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
  withRetry,
  aggregateCollection,
  bulkWrite,
  cleanupExpiredData,
  getDatabaseStats,
  createBackup,
  textSearch,
  paginateCollection,
};

export default dbExports;