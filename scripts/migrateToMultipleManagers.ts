// FILE: scripts/migrateToMultipleManagers.ts
// Migration script to convert existing projects from single manager to multiple managers

import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface OldProjectDocument {
  _id: ObjectId;
  title: string;
  manager?: ObjectId;
  managers?: ObjectId[];
}

async function migrateProjects() {
  console.log('🚀 Starting migration: Single manager to multiple managers...');
  
  try {
    const { db } = await connectToDatabase();
    
    // Find all projects that have 'manager' field but no 'managers' array
    const projectsToMigrate = await db.collection<OldProjectDocument>('projects')
      .find({
        manager: { $exists: true },
        $or: [
          { managers: { $exists: false } },
          { managers: { $size: 0 } }
        ]
      })
      .toArray();

    console.log(`📊 Found ${projectsToMigrate.length} projects to migrate`);

    if (projectsToMigrate.length === 0) {
      console.log('✅ No projects need migration. All done!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const project of projectsToMigrate) {
      try {
        if (!project.manager) {
          console.log(`⚠️  Skipping project ${project.title} - no manager field`);
          continue;
        }

        // Update project: copy manager to managers array
        await db.collection('projects').updateOne(
          { _id: project._id },
          { 
            $set: { 
              managers: [project.manager],
              updatedAt: new Date()
            }
          }
        );

        successCount++;
        console.log(`✅ Migrated: ${project.title}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating project ${project.title}:`, error);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total projects processed: ${projectsToMigrate.length}`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('ℹ️  Note: The old "manager" field has been kept for backward compatibility.');
      console.log('   You can remove it manually if needed after verifying everything works.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateProjects()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateProjects };