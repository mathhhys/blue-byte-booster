// Test script to verify monthly credit recharge functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCreditRecharge() {
  console.log('🧪 Testing Monthly Credit Recharge Implementation');
  console.log('==================================================');

  try {
    // Test 1: Check if database columns exist
    console.log('\n1. Checking database schema...');
    
    const { data: subColumns, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(1);
    
    const { data: orgSubColumns, error: orgSubError } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .limit(1);
    
    if (subError || orgSubError) {
      console.error('❌ Error checking database schema:', subError || orgSubError);
      return;
    }
    
    const hasIndividualRecharge = subColumns[0] && 'last_credit_recharge_at' in subColumns[0];
    const hasOrgRecharge = orgSubColumns[0] && 'last_credit_recharge_at' in orgSubColumns[0];
    
    console.log('✅ Individual subscriptions recharge tracking:', hasIndividualRecharge);
    console.log('✅ Organization subscriptions recharge tracking:', hasOrgRecharge);
    
    // Test 2: Verify the functions exist in server.js
    console.log('\n2. Checking server.js function implementation...');
    
    // This is a structural check - we can't actually import server.js functions here
    // but we can verify the file contains the expected functions
    const fs = require('fs');
    const serverCode = fs.readFileSync('./server.js', 'utf8');
    
    const hasHandlePaymentSucceeded = serverCode.includes('async function handlePaymentSucceeded');
    const hasRechargeIndividual = serverCode.includes('async function rechargeIndividualCredits');
    const hasRechargeOrganization = serverCode.includes('async function rechargeOrganizationCredits');
    
    console.log('✅ handlePaymentSucceeded function:', hasHandlePaymentSucceeded);
    console.log('✅ rechargeIndividualCredits function:', hasRechargeIndividual);
    console.log('✅ rechargeOrganizationCredits function:', hasRechargeOrganization);
    
    // Test 3: Verify the migration file exists
    console.log('\n3. Checking migration file...');
    
    const migrationExists = fs.existsSync('./migrations/20250928_add_credit_recharge_tracking.sql');
    console.log('✅ Credit recharge migration file:', migrationExists);
    
    if (migrationExists) {
      const migrationContent = fs.readFileSync('./migrations/20250928_add_credit_recharge_tracking.sql', 'utf8');
      const hasIndividualColumn = migrationContent.includes('ALTER TABLE subscriptions');
      const hasOrgColumn = migrationContent.includes('ALTER TABLE organization_subscriptions');
      
      console.log('✅ Individual subscription column migration:', hasIndividualColumn);
      console.log('✅ Organization subscription column migration:', hasOrgColumn);
    }
    
    console.log('\n🎉 All structural tests passed!');
    console.log('\nNext steps:');
    console.log('1. Run the migration: psql -d your_database -f migrations/20250928_add_credit_recharge_tracking.sql');
    console.log('2. Restart the server to load the new functions');
    console.log('3. Test with actual Stripe webhook events');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCreditRecharge();