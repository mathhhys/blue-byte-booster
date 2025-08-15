require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSchema() {
  try {
    const client = await pool.connect();
    console.log('🔧 Setting up database schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'src', 'utils', 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await client.query(schema);
    
    console.log('✅ Database schema setup completed successfully');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('📋 Created tables:', tablesResult.rows.map(r => r.table_name));
    
    // Verify functions were created
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_type = 'FUNCTION'
      AND routine_name IN ('grant_credits', 'deduct_credits', 'upsert_user')
      ORDER BY routine_name;
    `);
    
    console.log('⚙️  Created functions:', functionsResult.rows.map(r => r.routine_name));
    
    client.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Schema setup failed:', err.message);
    process.exit(1);
  }
}

setupSchema();