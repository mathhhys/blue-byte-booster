const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runExtensionTokensMigration() {
  console.log('🚀 Running extension tokens migration...');
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250924_add_extension_tokens.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    console.log('🔧 Since we cannot execute raw SQL via client, showing migration to run manually...');
    
    console.log('\n📋 Please copy and paste the following SQL into your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80) + '\n');
    
    console.log('After running the migration in Supabase SQL Editor, press Ctrl+C and run the test again.');
    
    return false; // Always return false since we can't run it automatically
    
  } catch (err) {
    console.error('❌ Failed to read migration file:', err.message);
    return false;
  }
}

// Run the migration
runExtensionTokensMigration().then((success) => {
  if (success) {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Please run the migration manually in Supabase SQL Editor.');
    process.exit(1);
  }
});