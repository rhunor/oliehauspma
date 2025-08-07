// scripts/init-database.js
// Run with: npm run db:init

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Function to read .env.local file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.log('💡 Please create .env.local with your MongoDB connection details');
    process.exit(1);
  }

  const envFile = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return envVars;
}

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function initializeDatabase() {
  // Load environment variables
  const env = loadEnvFile();
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB || 'olivehaus_ppma';

  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local!');
    console.log('💡 Please add MONGODB_URI to your .env.local file');
    process.exit(1);
  }

  console.log('🚀 Starting database initialization...');
  console.log('📍 Connecting to:', uri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in log

  // Determine if this is Atlas or local MongoDB
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');
  
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 120000, // 2 minutes - much more generous
    socketTimeoutMS: 180000, // 3 minutes
    connectTimeoutMS: 120000, // 2 minutes
    maxIdleTimeMS: 60000, // 1 minute
    heartbeatFrequencyMS: 30000, // 30 seconds between heartbeats
    family: 4,
    ...(isAtlas ? {
      tls: true,
      retryWrites: true,
      w: 'majority',
      authSource: 'admin',
      maxConnecting: 2, // Limit concurrent connections
      directConnection: false // Let driver discover topology
    } : {
      tls: false,
      tlsInsecure: true,
    })
  });
  
  try {
    console.log('⏳ Attempting connection (this may take up to 2 minutes)...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');

    console.log('🔍 Verifying database access...');
    const db = client.db(dbName);
    
    // Test database connectivity with a simple ping
    await db.admin().ping();
    console.log('✅ Database ping successful');

    // Create indexes
    console.log('📋 Creating database indexes...');
    await createIndexes(db);
    console.log('✅ Indexes created successfully');

    // Seed initial data
    console.log('🌱 Seeding initial data...');
    await seedInitialData(db);
    console.log('✅ Initial data seeded successfully');

    console.log('🎉 Database initialization completed!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    if (error.code === 11000) {
      console.log('💡 Hint: Users might already exist. Try dropping the collection first.');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Hint: Make sure MongoDB is running.');
    }
    
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

async function createIndexes(db) {
  // Users collection indexes
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
    { key: { isActive: 1 } },
    { key: { createdAt: -1 } },
  ]);

  // Projects collection indexes
  await db.collection('projects').createIndexes([
    { key: { client: 1 } },
    { key: { manager: 1 } },
    { key: { status: 1 } },
    { key: { priority: 1 } },
    { key: { startDate: 1 } },
    { key: { endDate: 1 } },
    { key: { createdAt: -1 } },
    { key: { title: 'text', description: 'text' } },
  ]);

  // Tasks collection indexes
  await db.collection('tasks').createIndexes([
    { key: { projectId: 1 } },
    { key: { assignee: 1 } },
    { key: { status: 1 } },
    { key: { priority: 1 } },
    { key: { deadline: 1 } },
    { key: { createdAt: -1 } },
    { key: { projectId: 1, status: 1 } },
  ]);

  // Chat messages collection indexes
  await db.collection('chatmessages').createIndexes([
    { key: { projectId: 1 } },
    { key: { sender: 1 } },
    { key: { recipient: 1 } },
    { key: { createdAt: -1 } },
    { key: { projectId: 1, createdAt: -1 } },
  ]);

  // Notifications collection indexes
  await db.collection('notifications').createIndexes([
    { key: { recipient: 1 } },
    { key: { isRead: 1 } },
    { key: { type: 1 } },
    { key: { createdAt: -1 } },
    { key: { recipient: 1, isRead: 1 } },
  ]);

  // Project files collection indexes
  await db.collection('projectfiles').createIndexes([
    { key: { projectId: 1 } },
    { key: { uploadedBy: 1 } },
    { key: { category: 1 } },
    { key: { isPublic: 1 } },
    { key: { uploadedAt: -1 } },
  ]);

  console.log('✅ All indexes created');
}

async function seedInitialData(db) {
  // Check if data already exists
  const existingUsers = await db.collection('users').countDocuments();
  if (existingUsers > 0) {
    console.log('🔍 Data already exists, skipping user creation...');
    console.log(`📊 Current user count: ${existingUsers}`);
    
    // Show existing users
    const users = await db.collection('users').find({}, { 
      projection: { password: 0 } 
    }).toArray();
    console.log('👥 Existing users:');
    users.forEach(user => {
      console.log(`   • ${user.name} (${user.email}) - ${user.role}`);
    });
  } else {
    console.log('👤 Creating initial users...');
    
    const hashedPassword = await hashPassword('password123');

    const users = [
      {
        email: 'admin@olivehaus.com',
        name: 'Super Administrator',
        password: hashedPassword,
        role: 'super_admin',
        phone: '+234-801-234-5678',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'manager@olivehaus.com',
        name: 'John Doe',
        password: hashedPassword,
        role: 'project_manager',
        phone: '+234-802-345-6789',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'jane.smith@olivehaus.com',
        name: 'Jane Smith',
        password: hashedPassword,
        role: 'project_manager',
        phone: '+234-803-456-7890',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'client@olivehaus.com',
        name: 'Mrs. Adebayo',
        password: hashedPassword,
        role: 'client',
        phone: '+234-804-567-8901',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'techcorp@olivehaus.com',
        name: 'TechCorp Ltd',
        password: hashedPassword,
        role: 'client',
        phone: '+234-805-678-9012',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'sarah.wilson@gmail.com',
        name: 'Sarah Wilson',
        password: hashedPassword,
        role: 'client',
        phone: '+234-806-789-0123',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    const result = await db.collection('users').insertMany(users);
    console.log(`✅ Created ${result.insertedCount} users successfully`);
  }

  // Get user IDs for creating projects and tasks
  const users = await db.collection('users').find({}).toArray();
  console.log(`📋 Found ${users.length} users in database`);
  
  const adminUser = users.find(u => u.role === 'super_admin');
  let managerUser = users.find(u => u.email === 'manager@olivehaus.com');
  let manager2User = users.find(u => u.email === 'jane.smith@olivehaus.com');
  let clientUser = users.find(u => u.email === 'client@olivehaus.com');
  let client2User = users.find(u => u.email === 'techcorp@olivehaus.com');
  let client3User = users.find(u => u.email === 'sarah.wilson@gmail.com');

  // Create missing users if they don't exist
  if (!managerUser) {
    console.log('👤 Creating missing manager: jane.smith@olivehaus.com');
    const hashedPassword = await hashPassword('password123');
    const result = await db.collection('users').insertOne({
      email: 'jane.smith@olivehaus.com',
      name: 'Jane Smith',
      password: hashedPassword,
      role: 'project_manager',
      phone: '+234-803-456-7890',
      avatar: null,
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    manager2User = await db.collection('users').findOne({ _id: result.insertedId });
  }

  if (!client2User) {
    console.log('👤 Creating missing client: techcorp@olivehaus.com');
    const hashedPassword = await hashPassword('password123');
    const result = await db.collection('users').insertOne({
      email: 'techcorp@olivehaus.com',
      name: 'TechCorp Ltd',
      password: hashedPassword,
      role: 'client',
      phone: '+234-805-678-9012',
      avatar: null,
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    client2User = await db.collection('users').findOne({ _id: result.insertedId });
  }

  if (!client3User) {
    console.log('👤 Creating missing client: sarah.wilson@gmail.com');
    const hashedPassword = await hashPassword('password123');
    const result = await db.collection('users').insertOne({
      email: 'sarah.wilson@gmail.com',
      name: 'Sarah Wilson',
      password: hashedPassword,
      role: 'client',
      phone: '+234-806-789-0123',
      avatar: null,
      isActive: true,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    client3User = await db.collection('users').findOne({ _id: result.insertedId });
  }

  // Use existing manager if manager2User doesn't exist
  if (!manager2User) {
    manager2User = managerUser;
    console.log('📝 Using existing manager for manager2 role');
  }

  // Verify all required users exist
  if (!adminUser || !managerUser || !clientUser) {
    console.error('❌ Missing required users. Please check your seed data.');
    console.log('Required users:');
    console.log(`   Admin: ${adminUser ? '✅' : '❌'} (super_admin role)`);
    console.log(`   Manager: ${managerUser ? '✅' : '❌'} (manager@olivehaus.com)`);
    console.log(`   Client: ${clientUser ? '✅' : '❌'} (client@olivehaus.com)`);
    throw new Error('Missing required users for project creation');
  }

  console.log('✅ All required users verified');

  // Check if projects already exist
  const existingProjects = await db.collection('projects').countDocuments();
  if (existingProjects > 0) {
    console.log('🔍 Projects already exist, skipping project creation...');
    console.log(`📊 Current project count: ${existingProjects}`);
  } else {
    console.log('📂 Creating initial projects...');

    const projects = [
      {
        title: 'Luxury Apartment Renovation',
        description: 'Complete interior renovation of a 3-bedroom luxury apartment in Lekki Phase 1',
        client: clientUser._id,
        manager: managerUser._id,
        status: 'in_progress',
        priority: 'high',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-15'),
        budget: 2500000,
        progress: 75,
        tasks: [],
        files: [],
        milestones: [],
        tags: ['residential', 'luxury', 'renovation'],
        notes: 'High-end finishes required. Client prefers modern minimalist style.',
        createdAt: new Date('2024-10-01'),
        updatedAt: new Date(),
      },
      {
        title: 'Office Space Design',
        description: 'Modern office interior design for a tech startup in Victoria Island',
        client: client2User._id,
        manager: managerUser._id,
        status: 'planning',
        priority: 'medium',
        startDate: new Date('2024-11-15'),
        endDate: new Date('2025-01-20'),
        budget: 1800000,
        progress: 25,
        tasks: [],
        files: [],
        milestones: [],
        tags: ['commercial', 'modern', 'tech'],
        notes: 'Open floor plan with collaborative spaces. Tech-friendly infrastructure.',
        createdAt: new Date('2024-11-15'),
        updatedAt: new Date(),
      },
      {
        title: 'Restaurant Interior',
        description: 'Complete restaurant interior design and decoration in Ikeja',
        client: client3User._id,
        manager: manager2User._id,
        status: 'completed',
        priority: 'urgent',
        startDate: new Date('2024-09-20'),
        endDate: new Date('2024-11-30'),
        budget: 3200000,
        progress: 100,
        tasks: [],
        files: [],
        milestones: [],
        tags: ['commercial', 'restaurant', 'hospitality'],
        notes: 'Warm ambiance with Nigerian cultural elements. Completed ahead of schedule.',
        createdAt: new Date('2024-09-20'),
        updatedAt: new Date('2024-11-28'),
      },
      {
        title: 'Villa Renovation',
        description: 'Luxury villa complete renovation in Banana Island',
        client: clientUser._id,
        manager: manager2User._id,
        status: 'planning',
        priority: 'high',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2025-06-15'),
        budget: 5000000,
        progress: 5,
        tasks: [],
        files: [],
        milestones: [],
        tags: ['residential', 'luxury', 'villa'],
        notes: 'Extensive renovation with pool area and landscaping.',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    const projectResults = await db.collection('projects').insertMany(projects);
    console.log(`✅ Created ${projectResults.insertedCount} projects successfully`);

    // Get inserted project IDs
    const insertedProjects = await db.collection('projects').find({}).toArray();
    const project1 = insertedProjects.find(p => p.title === 'Luxury Apartment Renovation');
    const project2 = insertedProjects.find(p => p.title === 'Office Space Design');
    const project3 = insertedProjects.find(p => p.title === 'Restaurant Interior');
    const project4 = insertedProjects.find(p => p.title === 'Villa Renovation');

    console.log('✅ Creating tasks...');

    const tasks = [
      {
        title: 'Complete Living Room Design',
        description: 'Finalize furniture selection and color scheme for the main living area',
        projectId: project1._id,
        assignee: managerUser._id,
        status: 'in_progress',
        priority: 'high',
        deadline: new Date('2024-12-10'),
        estimatedHours: 20,
        actualHours: 15,
        dependencies: [],
        attachments: [],
        comments: [],
        createdBy: adminUser._id,
        createdAt: new Date('2024-10-05'),
        updatedAt: new Date(),
      },
      {
        title: 'Kitchen Cabinet Installation',
        description: 'Coordinate with contractors for custom kitchen cabinet installation',
        projectId: project1._id,
        assignee: managerUser._id,
        status: 'completed',
        priority: 'medium',
        deadline: new Date('2024-12-01'),
        estimatedHours: 15,
        actualHours: 18,
        dependencies: [],
        attachments: [],
        comments: [],
        createdBy: adminUser._id,
        createdAt: new Date('2024-10-10'),
        updatedAt: new Date('2024-12-01'),
        completedAt: new Date('2024-12-01'),
      },
      {
        title: 'Client Presentation Prep',
        description: 'Prepare presentation materials for client review meeting',
        projectId: project2._id,
        assignee: managerUser._id,
        status: 'pending',
        priority: 'urgent',
        deadline: new Date('2024-12-08'),
        estimatedHours: 8,
        actualHours: 0,
        dependencies: [],
        attachments: [],
        comments: [],
        createdBy: adminUser._id,
        createdAt: new Date('2024-11-20'),
        updatedAt: new Date(),
      },
      {
        title: 'Lighting Design Approval',
        description: 'Get client approval on proposed lighting scheme',
        projectId: project4._id,
        assignee: manager2User._id,
        status: 'pending',
        priority: 'medium',
        deadline: new Date('2025-01-15'),
        estimatedHours: 12,
        actualHours: 0,
        dependencies: [],
        attachments: [],
        comments: [],
        createdBy: adminUser._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    const taskResults = await db.collection('tasks').insertMany(tasks);
    console.log(`✅ Created ${taskResults.insertedCount} tasks successfully`);

    // Update projects with task references
    const insertedTasks = await db.collection('tasks').find({}).toArray();
    const task1 = insertedTasks.find(t => t.title === 'Complete Living Room Design');
    const task2 = insertedTasks.find(t => t.title === 'Kitchen Cabinet Installation');
    const task3 = insertedTasks.find(t => t.title === 'Client Presentation Prep');
    const task4 = insertedTasks.find(t => t.title === 'Lighting Design Approval');

    await db.collection('projects').updateOne(
      { _id: project1._id },
      { $push: { tasks: { $each: [task1._id, task2._id] } } }
    );

    await db.collection('projects').updateOne(
      { _id: project2._id },
      { $push: { tasks: task3._id } }
    );

    await db.collection('projects').updateOne(
      { _id: project4._id },
      { $push: { tasks: task4._id } }
    );

    console.log('🔔 Creating sample notifications...');

    await db.collection('notifications').insertMany([
      {
        recipient: clientUser._id,
        sender: managerUser._id,
        type: 'project_updated',
        title: 'Project Progress Update',
        message: 'Your luxury apartment renovation is now 75% complete',
        data: {
          projectId: project1._id,
        },
        isRead: false,
        createdAt: new Date(),
      },
      {
        recipient: managerUser._id,
        sender: adminUser._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: 'You have been assigned: Complete Living Room Design',
        data: {
          taskId: task1._id,
          projectId: project1._id,
        },
        isRead: true,
        createdAt: new Date('2024-10-05'),
      },
      {
        recipient: client2User._id,
        sender: managerUser._id,
        type: 'milestone_reached',
        title: 'Planning Phase Complete',
        message: 'The planning phase for your office design project is complete',
        data: {
          projectId: project2._id,
        },
        isRead: false,
        createdAt: new Date(),
      },
    ]);

    console.log('✅ Notifications created successfully');
  }

  console.log('\n📋 Demo Login Credentials:');
  console.log('   Super Admin: admin@olivehaus.com / password123');
  console.log('   Project Manager: manager@olivehaus.com / password123');
  console.log('   Project Manager 2: jane.smith@olivehaus.com / password123');
  console.log('   Client 1: client@olivehaus.com / password123');
  console.log('   Client 2: techcorp@olivehaus.com / password123');
  console.log('   Client 3: sarah.wilson@gmail.com / password123');
}

// Run the initialization
initializeDatabase().catch(console.error);