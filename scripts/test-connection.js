// scripts/test-connection.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Function to read .env.local file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
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

async function testConnection() {
  const env = loadEnvFile();
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB || 'olivehaus_ppma';

  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local!');
    process.exit(1);
  }

  console.log('🔍 Testing MongoDB connection...');
  console.log('📍 Database:', dbName);
  console.log('📍 URI format check:', uri.startsWith('mongodb+srv://') ? '✅ Atlas URI' : '⚠️  Local URI');

  // Multiple timeout configurations to try
  const configs = [
    {
      name: 'Patient Config (Recommended)',
      options: {
        serverSelectionTimeoutMS: 180000, // 3 minutes
        connectTimeoutMS: 120000, // 2 minutes  
        socketTimeoutMS: 240000, // 4 minutes
        heartbeatFrequencyMS: 30000,
      }
    },
    {
      name: 'Very Patient Config',
      options: {
        serverSelectionTimeoutMS: 300000, // 5 minutes
        connectTimeoutMS: 180000, // 3 minutes
        socketTimeoutMS: 360000, // 6 minutes
        heartbeatFrequencyMS: 45000,
      }
    },
    {
      name: 'Standard Config',
      options: {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 60000,
      }
    }
  ];

  for (const config of configs) {
    console.log(`\n🔄 Trying ${config.name}...`);
    
    const client = new MongoClient(uri, {
      ...config.options,
      tls: true,
      retryWrites: true,
      w: 'majority',
      authSource: 'admin'
    });

    try {
      console.log('   ⏳ Connecting...');
      await client.connect();
      
      console.log('   ✅ Connected successfully!');
      
      // Test database access
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      console.log('   📋 Collections found:', collections.length);
      
      // Test a simple operation
      const testResult = await db.admin().ping();
      console.log('   🏓 Ping result:', testResult.ok ? '✅ OK' : '❌ Failed');
      
      await client.close();
      console.log('   🔐 Connection closed successfully');
      
      console.log('\n🎉 Connection test passed! You can proceed with database initialization.');
      return;
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      if (error.message.includes('authentication failed')) {
        console.log('   💡 Hint: Check your username/password in the connection string');
      } else if (error.message.includes('Server selection timed out')) {
        console.log('   💡 Hint: Check network access and IP whitelist in Atlas');
      } else if (error.message.includes('ENOTFOUND')) {
        console.log('   💡 Hint: Check your internet connection and DNS');
      }
      
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }
  
  console.log('\n❌ All connection attempts failed. Please check:');
  console.log('   1. MongoDB Atlas Network Access (IP Whitelist)');
  console.log('   2. Database User credentials');
  console.log('   3. Internet connection');
  console.log('   4. Connection string format');
}

testConnection().catch(console.error);