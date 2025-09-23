const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runUTCMigration() {
  console.log('🚀 Running UTC expires_at normalization migration...');
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250923_normalize_expires_at_utc.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    console.log('🔧 This migration will normalize all expires_at columns to UTC format...');
    console.log('⚠️  Please run this migration manually in your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80) + '\n');
    
    console.log('✨ After running the migration, you can monitor token expiry status with:');
    console.log('   SELECT * FROM token_expiry_status;');
    console.log('');
    console.log('🔧 The migration includes:');
    console.log('   - Normalizes all existing expires_at data to UTC');
    console.log('   - Adds triggers to ensure future data is UTC');
    console.log('   - Creates monitoring view for token status');
    console.log('   - Adds performance indexes');
    
    return true;
    
  } catch (err) {
    console.error('❌ Error reading migration file:', err.message);
    return false;
  }
}

// Run the migration display
runUTCMigration().then((success) => {
  if (success) {
    console.log('📋 Migration ready to run - please copy the SQL above to your Supabase SQL Editor');
    process.exit(0);
  } else {
    console.log('❌ Failed to prepare migration');
    process.exit(1);
  }
});