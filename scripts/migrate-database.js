// scripts/migrate-database.js - FIXED DOTENV PATH ISSUES
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting MongoDB Atlas Database Migration...');
console.log('=====================================');

// Debug paths
console.log('📍 Current working directory:', process.cwd());
console.log('📍 Script directory:', __dirname);

// Multiple strategies to find and load .env file (including .env.local)
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),                    // Standard .env file
  path.join(process.cwd(), '.env.local'),              // Next.js style .env.local
  path.join(process.cwd(), '.env.development'),        // Development environment
  path.join(__dirname, '..', '.env'),                 // One level up from scripts folder  
  path.join(__dirname, '..', '.env.local'),           // .env.local one level up
  path.join(__dirname, '.env'),                       // Same level as script
  path.join(__dirname, '.env.local'),                 // .env.local same level
  path.join(process.cwd(), 'scripts', '..', '.env'),  // Alternative path
  path.join(process.cwd(), 'scripts', '..', '.env.local'), // Alternative .env.local path
  '.env',                                              // Relative to current directory
  '.env.local'                                         // Relative .env.local
];

console.log('\n🔍 Searching for .env file in multiple locations:');
let envPath = null;
let envExists = false;

for (const testPath of possibleEnvPaths) {
  const fullPath = path.resolve(testPath);
  console.log(`   📁 Testing: ${fullPath}`);
  
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ Found .env file at: ${fullPath}`);
    envPath = fullPath;
    envExists = true;
    break;
  } else {
    console.log(`   ❌ Not found`);
  }
}

if (!envExists) {
  console.error('\n❌ ERROR: .env file not found in any expected location!');
  console.log('🔧 Please ensure .env file exists in your project root directory');
  console.log('📝 Expected locations:');
  possibleEnvPaths.forEach(p => console.log(`   - ${path.resolve(p)}`));
  process.exit(1);
}

// Load dotenv with explicit path and debug
console.log(`\n⚙️  Loading environment variables from: ${envPath}`);

try {
  const dotenvResult = require('dotenv').config({ 
    path: envPath,
    debug: true // This will show what dotenv is loading
  });
  
  if (dotenvResult.error) {
    throw dotenvResult.error;
  }
  
  console.log('✅ Dotenv loaded successfully');
  
  // Show what was parsed (without sensitive values)
  if (dotenvResult.parsed) {
    console.log('📋 Environment variables loaded:');
    Object.keys(dotenvResult.parsed).forEach(key => {
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
        console.log(`   ${key}: ***hidden***`);
      } else if (key.includes('MONGODB') || key.includes('DB')) {
        const value = dotenvResult.parsed[key];
        const sanitized = value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        console.log(`   ${key}: ${sanitized}`);
      } else {
        console.log(`   ${key}: ${dotenvResult.parsed[key]}`);
      }
    });
  }
  
} catch (error) {
  console.error('\n❌ ERROR loading .env file:');
  console.error('   ', error.message);
  process.exit(1);
}

// Check for various possible environment variable names AFTER loading
const possibleEnvVars = {
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_URL: process.env.MONGODB_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  MONGO_URI: process.env.MONGO_URI,
  DB_URI: process.env.DB_URI,
  ATLAS_URI: process.env.ATLAS_URI
};

console.log('\n🔍 Environment Variables Check (after loading):');
Object.entries(possibleEnvVars).forEach(([key, value]) => {
  if (value) {
    // Hide credentials in logs
    const sanitized = value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`✅ ${key}: Found (${sanitized})`);
  } else {
    console.log(`❌ ${key}: Not found`);
  }
});

// Get the MongoDB URI - prioritize MONGODB_URI
const MONGODB_URI = possibleEnvVars.MONGODB_URI || 
                   possibleEnvVars.MONGODB_URL || 
                   possibleEnvVars.DATABASE_URL || 
                   possibleEnvVars.MONGO_URI ||
                   possibleEnvVars.DB_URI ||
                   possibleEnvVars.ATLAS_URI;

if (!MONGODB_URI) {
  console.error('\n❌ ERROR: No MongoDB connection string found!');
  console.log('🔧 Please ensure your .env file contains one of:');
  console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.log('   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.log('   DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.log('\n📄 .env file contents preview:');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').slice(0, 10); // Show first 10 lines
    lines.forEach((line, index) => {
      if (line.trim() && !line.startsWith('#')) {
        const sanitized = line.replace(/=.*/, '=***hidden***');
        console.log(`   ${index + 1}: ${sanitized}`);
      }
    });
  } catch (err) {
    console.log('   Could not read .env file for preview');
  }
  process.exit(1);
}

// Validate Atlas connection string format
if (!MONGODB_URI.includes('mongodb+srv://') && !MONGODB_URI.includes('mongodb://')) {
  console.error('\n❌ ERROR: Invalid MongoDB connection string format!');
  console.log('🔧 Atlas connection string should start with:');
  console.log('   mongodb+srv:// (recommended for Atlas)');
  console.log('   or mongodb:// (for specific host connections)');
  process.exit(1);
}

// Validate connection string structure and show details
const uriParts = MONGODB_URI.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)/);
if (uriParts) {
  const [, username, password, cluster, dbAndOptions] = uriParts;
  console.log(`\n📡 Atlas Connection Details:`);
  console.log(`   👤 Username: ${username}`);
  console.log(`   🔐 Password: ${'*'.repeat(password.length)}`);
  console.log(`   🌐 Cluster: ${cluster}`);
  console.log(`   💾 Database: ${dbAndOptions.split('?')[0]}`);
}

// Show connection info (sanitized)
const sanitizedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
console.log(`   🔗 Full URI: ${sanitizedUri}`);

// Atlas-optimized connection function
async function connectToAtlas() {
  try {
    console.log('\n🔗 Establishing connection to MongoDB Atlas...');
    
    // MongoDB Atlas connection options - updated for newer Mongoose versions
    const connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 30000, // Match your setting: 30 seconds
      socketTimeoutMS: 60000, // Match your setting: 60 seconds  
      connectTimeoutMS: 30000, // Match your setting: 30 seconds
      maxIdleTimeMS: 270000, // Match your setting: 270 seconds (4.5 minutes)
      // ❌ REMOVED: bufferMaxEntries and bufferCommands (deprecated/not supported)
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true, // Enable retryable writes (Atlas default)
      w: 'majority' // Write concern (Atlas default)
    };

    await mongoose.connect(MONGODB_URI, connectionOptions);
    
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
    return mongoose.connection.db;
  } catch (error) {
    console.error('\n❌ Failed to connect to MongoDB Atlas:');
    console.error(`   Error: ${error.message}`);
    
    // Provide specific troubleshooting for Atlas
    console.log('\n🔧 Atlas Connection Troubleshooting:');
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('   • Check your internet connection');
      console.log('   • Verify the cluster hostname in your connection string');
    }
    
    if (error.message.includes('authentication failed')) {
      console.log('   • Verify your username and password');
      console.log('   • Check if the database user exists in Atlas');
      console.log('   • Ensure the password doesn\'t contain special characters');
    }
    
    if (error.message.includes('IP') || error.message.includes('not allowed')) {
      console.log('   • Add your IP address to Atlas IP Access List');
      console.log('   • Or add 0.0.0.0/0 for access from anywhere (less secure)');
    }
    
    if (error.message.includes('timeout')) {
      console.log('   • Check your firewall settings');
      console.log('   • Try connecting from a different network');
    }
    
    console.log('\n📚 Atlas Connection Guide:');
    console.log('   https://docs.mongodb.com/atlas/connect-to-cluster/');
    
    throw error;
  }
}

async function migrateProjectFiles() {
  console.log('\n🔄 Migrating Project Files...');
  
  try {
    const db = mongoose.connection.db;
    const projectsCollection = db.collection('projects');
    
    // Find projects with files that need migration
    const projectsWithFiles = await projectsCollection.find({
      'files.0': { $exists: true }
    }).toArray();
    
    console.log(`   📁 Found ${projectsWithFiles.length} projects with files`);
    
    let migratedCount = 0;
    
    for (const project of projectsWithFiles) {
      let hasChanges = false;
      
      if (project.files && Array.isArray(project.files)) {
        project.files = project.files.map(file => {
          // Fix missing uploadedAt
          if (!file.uploadedAt) {
            file.uploadedAt = file.createdAt || project.createdAt || new Date();
            hasChanges = true;
          }
          // Convert string dates to Date objects
          else if (typeof file.uploadedAt === 'string') {
            file.uploadedAt = new Date(file.uploadedAt);
            hasChanges = true;
          }
          
          // Ensure uploadedBy is ObjectId
          if (file.uploadedBy && typeof file.uploadedBy === 'string') {
            try {
              file.uploadedBy = new mongoose.Types.ObjectId(file.uploadedBy);
              hasChanges = true;
            } catch (error) {
              console.warn(`   ⚠️  Invalid ObjectId for uploadedBy: ${file.uploadedBy}`);
            }
          }
          
          return file;
        });
        
        if (hasChanges) {
          await projectsCollection.updateOne(
            { _id: project._id },
            { $set: { files: project.files } }
          );
          migratedCount++;
        }
      }
    }
    
    console.log(`   ✅ Migrated ${migratedCount} projects with file issues`);
  } catch (error) {
    console.error('   ❌ Error migrating project files:', error.message);
  }
}

async function migrateProjectMilestones() {
  console.log('\n🔄 Migrating Project Milestones...');
  
  try {
    const db = mongoose.connection.db;
    const projectsCollection = db.collection('projects');
    
    // Find projects with milestones that need migration
    const projectsWithMilestones = await projectsCollection.find({
      'milestones.0': { $exists: true }
    }).toArray();
    
    console.log(`   🎯 Found ${projectsWithMilestones.length} projects with milestones`);
    
    let migratedCount = 0;
    
    for (const project of projectsWithMilestones) {
      let hasChanges = false;
      
      if (project.milestones && Array.isArray(project.milestones)) {
        project.milestones = project.milestones.map(milestone => {
          // Convert string dates to Date objects
          if (milestone.dueDate && typeof milestone.dueDate === 'string') {
            milestone.dueDate = new Date(milestone.dueDate);
            hasChanges = true;
          }
          
          return milestone;
        });
        
        if (hasChanges) {
          await projectsCollection.updateOne(
            { _id: project._id },
            { $set: { milestones: project.milestones } }
          );
          migratedCount++;
        }
      }
    }
    
    console.log(`   ✅ Migrated ${migratedCount} projects with milestone issues`);
  } catch (error) {
    console.error('   ❌ Error migrating project milestones:', error.message);
  }
}

async function migrateProjectDates() {
  console.log('\n🔄 Migrating Project Dates...');
  
  try {
    const db = mongoose.connection.db;
    const projectsCollection = db.collection('projects');
    
    // Find projects with string dates
    const projectsWithStringDates = await projectsCollection.find({
      $or: [
        { startDate: { $type: 'string' } },
        { endDate: { $type: 'string' } }
      ]
    }).toArray();
    
    console.log(`   📅 Found ${projectsWithStringDates.length} projects with string dates`);
    
    for (const project of projectsWithStringDates) {
      const updates = {};
      
      if (project.startDate && typeof project.startDate === 'string') {
        updates.startDate = new Date(project.startDate);
      }
      
      if (project.endDate && typeof project.endDate === 'string') {
        updates.endDate = new Date(project.endDate);
      }
      
      if (Object.keys(updates).length > 0) {
        await projectsCollection.updateOne(
          { _id: project._id },
          { $set: updates }
        );
      }
    }
    
    console.log(`   ✅ Migrated ${projectsWithStringDates.length} projects with date issues`);
  } catch (error) {
    console.error('   ❌ Error migrating project dates:', error.message);
  }
}

async function migrateFileDocuments() {
  console.log('\n🔄 Migrating File Documents...');
  
  try {
    const db = mongoose.connection.db;
    const filesCollection = db.collection('files');
    
    // Find files with missing or invalid timestamps
    const filesNeedingMigration = await filesCollection.find({
      $or: [
        { createdAt: { $exists: false } },
        { updatedAt: { $exists: false } },
        { createdAt: { $type: 'string' } },
        { updatedAt: { $type: 'string' } }
      ]
    }).toArray();
    
    console.log(`   📄 Found ${filesNeedingMigration.length} files needing timestamp migration`);
    
    for (const file of filesNeedingMigration) {
      const updates = {};
      const now = new Date();
      
      if (!file.createdAt) {
        updates.createdAt = now;
      } else if (typeof file.createdAt === 'string') {
        updates.createdAt = new Date(file.createdAt);
      }
      
      if (!file.updatedAt) {
        updates.updatedAt = now;
      } else if (typeof file.updatedAt === 'string') {
        updates.updatedAt = new Date(file.updatedAt);
      }
      
      if (Object.keys(updates).length > 0) {
        await filesCollection.updateOne(
          { _id: file._id },
          { $set: updates }
        );
      }
    }
    
    console.log(`   ✅ Migrated ${filesNeedingMigration.length} file documents`);
  } catch (error) {
    console.error('   ❌ Error migrating file documents:', error.message);
  }
}

async function validateMigration() {
  console.log('\n🔍 Validating Migration Results...');
  
  try {
    const db = mongoose.connection.db;
    
    // Check for remaining issues
    const checks = await Promise.all([
      db.collection('projects').countDocuments({
        $or: [
          { 'files.uploadedAt': { $type: 'string' } },
          { 'milestones.dueDate': { $type: 'string' } },
          { startDate: { $type: 'string' } },
          { endDate: { $type: 'string' } }
        ]
      }),
      db.collection('projects').countDocuments({
        'files.uploadedAt': { $exists: false }
      }),
      db.collection('files').countDocuments({
        $or: [
          { createdAt: { $exists: false } },
          { updatedAt: { $exists: false } }
        ]
      })
    ]);
    
    const [projectsWithStringDates, filesWithoutUploadedAt, filesWithoutTimestamps] = checks;
    
    console.log('\n📊 Migration Validation Results:');
    console.log(`   📁 Projects with string dates: ${projectsWithStringDates}`);
    console.log(`   📄 Files without uploadedAt: ${filesWithoutUploadedAt}`);
    console.log(`   🕒 Files without timestamps: ${filesWithoutTimestamps}`);
    
    const totalIssues = projectsWithStringDates + filesWithoutUploadedAt + filesWithoutTimestamps;
    
    if (totalIssues === 0) {
      console.log('\n🎉 ✅ Migration validation PASSED! All data types are correct.');
    } else {
      console.log(`\n⚠️  ${totalIssues} issues remain. You may need to run migration again.`);
    }
    
    return totalIssues === 0;
    
  } catch (error) {
    console.error('   ❌ Error validating migration:', error.message);
    return false;
  }
}

async function runMigration() {
  try {
    // Connect to Atlas
    await connectToAtlas();
    
    console.log('\n🔧 Starting data migration process...');
    
    // Run all migrations
    await migrateProjectFiles();
    await migrateProjectMilestones(); 
    await migrateProjectDates();
    await migrateFileDocuments();
    
    // Validate results
    const success = await validateMigration();
    
    if (success) {
      console.log('\n🎉 🚀 DATABASE MIGRATION COMPLETED SUCCESSFULLY! 🚀');
      console.log('   Your MongoDB Atlas data has been updated and is ready to use.');
    } else {
      console.log('\n⚠️  Migration completed with some remaining issues.');
      console.log('   Consider running the migration again or checking data manually.');
    }
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:');
    console.error(`   ${error.message}`);
    
    console.log('\n🆘 Need Help?');
    console.log('   1. Check your .env file has the correct MONGODB_URI');
    console.log('   2. Verify your Atlas cluster is running');
    console.log('   3. Ensure your IP is whitelisted in Atlas');
    console.log('   4. Check Atlas connection guide: https://docs.mongodb.com/atlas/connect-to-cluster/');
    
    process.exit(1);
  } finally {
    // Always close the connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n📪 Atlas connection closed');
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Unhandled migration error:', error);
    process.exit(1);
  });
}

module.exports = {
  runMigration,
  migrateProjectFiles,
  migrateProjectMilestones,
  migrateProjectDates,
  migrateFileDocuments,
  validateMigration
};