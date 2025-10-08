const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Read the migration SQL from file
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'migrations', '20250924_add_extension_tokens.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  try {
    console.log('Running extension_tokens migration...');
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('execute_sql', {
      query: migrationSQL
    });

    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully');
    console.log('Extension tokens table and functions created');
    
    // Verify table creation
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'extension_tokens');

    if (tables && tables.length > 0) {
      console.log('✅ Verified: extension_tokens table exists');
    } else {
      console.error('❌ Verification failed: extension_tokens table not found');
      process.exit(1);
    }

  } catch (error) {
    console.error('Failed to run migration:', error);
    process.exit(1);
  }
}

runMigration();