const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { exit } = require('process');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Get migration filename from command line arg
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node run-specific-migration.js <migration-file.sql>');
  process.exit(1);
}

const migrationFile = args[0];
const migrationPath = path.join(__dirname, 'migrations', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  try {
    console.log(`Running migration: ${migrationFile}`);
    const { error } = await supabase.sql(sql);
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

runMigration();