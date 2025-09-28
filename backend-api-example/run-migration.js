// Script to run the credit recharge migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running credit recharge migration...');
  
  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync('./migrations/20250928_add_credit_recharge_tracking.sql', 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.trim()}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // If exec_sql doesn't exist, try direct query (for development)
          console.log('exec_sql not available, trying direct query...');
          const { error: directError } = await supabase.query(statement);
          if (directError) {
            console.error('Error executing migration:', directError);
            return;
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('The last_credit_recharge_at columns have been added to both subscriptions and organization_subscriptions tables.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();