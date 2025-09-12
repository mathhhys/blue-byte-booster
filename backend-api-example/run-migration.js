const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('🚀 Running Clerk user synchronization migration...');
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250911_add_clerk_id_unique_and_avatar_url.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    console.log('🔧 Executing migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If rpc doesn't work, try direct SQL execution
      console.log('⚠️  RPC method failed, trying direct execution...');
      
      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.toLowerCase().includes('create table')) {
          console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        }
        
        const { error: execError } = await supabase
          .from('_temp_migration')
          .select('*')
          .limit(0); // This will fail but we can catch it
          
        // Since we can't execute raw SQL directly, we'll need to use the SQL editor
        console.log('❌ Cannot execute raw SQL via client. Please run the migration manually.');
        console.log('📋 Copy and paste the following SQL into your Supabase SQL Editor:');
        console.log('\n' + '='.repeat(60));
        console.log(migrationSQL);
        console.log('='.repeat(60) + '\n');
        return false;
      }
    } else {
      console.log('✅ Migration executed successfully!');
      return true;
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(60));
    
    const migrationPath = path.join(__dirname, 'migrations', '20250911_add_clerk_id_unique_and_avatar_url.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('='.repeat(60) + '\n');
    return false;
  }
}

// Run the migration
runMigration().then((success) => {
  if (success) {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Please run the migration manually and then re-run the tests.');
    process.exit(1);
  }
});