require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function addAvatarColumn() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🚀 Adding avatar_url column to users table...');
    
    // Execute the SQL to add the column
    const { data, error } = await supabase.rpc('add_avatar_column', {});
    
    if (error) {
      console.log('⚠️  RPC failed, trying direct SQL execution...');
      
      // Try using raw SQL (this might not work depending on permissions)
      const { data: sqlData, error: sqlError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
        
      if (sqlError) {
        console.error('❌ Cannot add column via client.');
        console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
        console.log('============================================================');
        console.log('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;');
        console.log('============================================================\n');
        process.exit(1);
      }
    } else {
      console.log('✅ Avatar column added successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
    console.log('============================================================');
    console.log('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;');
    console.log('============================================================\n');
  }
}

addAvatarColumn();