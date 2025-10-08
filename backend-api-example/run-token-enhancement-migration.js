#!/usr/bin/env node

/**
 * Run the token system enhancement migration
 * This creates the token_audit_logs and token_rate_limits tables
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('\n🔧 Token System Enhancement Migration\n');
console.log('━'.repeat(60));

// Check environment variables
if (!process.env.SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL environment variable is not set');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`📍 Supabase URL: ${process.env.SUPABASE_URL}`);

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  try {
    console.log('\n📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migrations', '20251008_enhance_token_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('✅ Migration file loaded');
    console.log(`📄 File size: ${sql.length} characters`);
    
    console.log('\n🚀 Executing migration...\n');
    console.log('━'.repeat(60));
    console.log('⚠️  IMPORTANT: Copy the SQL below and run it in Supabase SQL Editor');
    console.log('━'.repeat(60));
    console.log('\n' + sql + '\n');
    console.log('━'.repeat(60));
    
    console.log('\n📋 Steps to complete migration:');
    console.log('1. Go to: https://supabase.com/dashboard/project/<your-project>/sql');
    console.log('2. Copy the SQL output above');
    console.log('3. Paste into SQL Editor');
    console.log('4. Click "Run"');
    console.log('5. Verify success message');
    
    console.log('\n✅ Migration script completed');
    console.log('\nAfter running the SQL, your token system will have:');
    console.log('  • token_audit_logs table - Complete audit trail');
    console.log('  • token_rate_limits table - Rate limiting');
    console.log('  • Enhanced extension_tokens - More metadata fields');
    console.log('  • Helper functions - Warnings, cleanup, etc.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();