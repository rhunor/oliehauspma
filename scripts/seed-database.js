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

async function seedDatabase() {
  // Load environment variables
  const env = loadEnvFile();
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB || 'olivehaus_ppma';

  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local!');
    console.log('💡 Please add MONGODB_URI to your .env.local file');
    process.exit(1);
  }

  console.log('🌱 Starting database seeding...');
  console.log('📍 Connecting to:', uri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in log

  // Determine if this is Atlas or local MongoDB
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('mongodb.net');
  
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000, // Increased timeout for Atlas
    socketTimeoutMS: 45000,
    family: 4,
    // Atlas-specific options
    ...(isAtlas ? {
      tls: true,
      retryWrites: true,
      w: 'majority'
    } : {
      // Local MongoDB options
      tls: false,
      tlsInsecure: true,
    })
  });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');

    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Check if users already exist
    const existingUsers = await usersCollection.countDocuments();
    if (existingUsers > 0) {
      console.log('⚠️  Users already exist in database. Skipping seed...');
      console.log(`📊 Current user count: ${existingUsers}`);
      
      // Show existing users
      const users = await usersCollection.find({}, { 
        projection: { password: 0 } 
      }).toArray();
      console.log('👥 Existing users:');
      users.forEach(user => {
        console.log(`   • ${user.name} (${user.email}) - ${user.role}`);
      });
      
      await client.close();
      return;
    }

    // Create demo users
    console.log('👤 Creating demo users...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);

    const demoUsers = [
      {
        email: 'admin@olivehaus.com',
        name: 'Super Administrator',
        password: hashedPassword,
        role: 'super_admin',
        phone: '+2348012345678',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'manager@olivehaus.com',
        name: 'Project Manager',
        password: hashedPassword,
        role: 'project_manager',
        phone: '+2348023456789',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'client@olivehaus.com',
        name: 'Demo Client',
        password: hashedPassword,
        role: 'client',
        phone: '+2348034567890',
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert demo users
    const result = await usersCollection.insertMany(demoUsers);
    console.log(`✅ Created ${result.insertedCount} demo users successfully!`);

    // Create indexes
    console.log('📊 Creating database indexes...');
    
    // Users collection indexes
    await usersCollection.createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { isActive: 1 } },
      { key: { createdAt: -1 } },
    ]);

    // Create other collections and indexes
    const collections = [
      'projects',
      'tasks', 
      'chatmessages',
      'notifications',
      'projectfiles'
    ];

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      
      switch (collectionName) {
        case 'projects':
          await collection.createIndexes([
            { key: { client: 1 } },
            { key: { manager: 1 } },
            { key: { status: 1 } },
            { key: { priority: 1 } },
            { key: { startDate: 1 } },
            { key: { endDate: 1 } },
            { key: { createdAt: -1 } },
            { key: { title: 'text', description: 'text' } },
          ]);
          break;
          
        case 'tasks':
          await collection.createIndexes([
            { key: { projectId: 1 } },
            { key: { assignee: 1 } },
            { key: { status: 1 } },
            { key: { priority: 1 } },
            { key: { deadline: 1 } },
            { key: { createdAt: -1 } },
            { key: { projectId: 1, status: 1 } },
          ]);
          break;
          
        case 'chatmessages':
          await collection.createIndexes([
            { key: { projectId: 1 } },
            { key: { sender: 1 } },
            { key: { recipient: 1 } },
            { key: { createdAt: -1 } },
            { key: { projectId: 1, createdAt: -1 } },
          ]);
          break;
          
        case 'notifications':
          await collection.createIndexes([
            { key: { recipient: 1 } },
            { key: { isRead: 1 } },
            { key: { type: 1 } },
            { key: { createdAt: -1 } },
            { key: { recipient: 1, isRead: 1 } },
          ]);
          break;
          
        case 'projectfiles':
          await collection.createIndexes([
            { key: { projectId: 1 } },
            { key: { uploadedBy: 1 } },
            { key: { category: 1 } },
            { key: { isPublic: 1 } },
            { key: { uploadedAt: -1 } },
          ]);
          break;
      }
      
      console.log(`   ✅ ${collectionName} indexes created`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('   Super Admin: admin@olivehaus.com / password123');
    console.log('   Project Manager: manager@olivehaus.com / password123');
    console.log('   Client: client@olivehaus.com / password123');
    console.log('\n🚀 You can now start the development server and log in!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    
    if (error.code === 11000) {
      console.log('💡 Hint: Users might already exist. Try dropping the collection first:');
      console.log('   In MongoDB shell: db.users.drop()');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Hint: Make sure MongoDB is running:');
      console.log('   macOS: brew services start mongodb-community');
      console.log('   Linux: sudo systemctl start mongod');
      console.log('   Docker: docker run -d --name mongodb -p 27017:27017 mongo:latest');
    }
  } finally {
    await client.close();
    console.log('🔐 Database connection closed');
  }
}

// Run the seeding
seedDatabase().catch(console.error);