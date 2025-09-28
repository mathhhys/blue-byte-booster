// Vercel serverless function for starter plan signup processing
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log('=== STARTER SIGNUP API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Parsing request body...');
    const { clerkUserId, email, firstName, lastName } = req.body;
    console.log('Request body:', req.body);

    if (!clerkUserId) {
      console.log('❌ Missing Clerk User ID');
      return res.status(400).json({ error: 'Clerk User ID is required' });
    }

    console.log('Step 2: Checking environment variables...');
    console.log('NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('Step 3: Initializing Supabase client...');
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');

    // Check if user already exists
    let user;
    try {
      console.log('Step 4: Checking if user exists...');
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (existingUser) {
        console.log('✅ User already exists');
        // User already exists, just return success
        return res.status(200).json({
          success: true,
          message: 'User already exists',
          data: {
            planType: existingUser.plan_type,
            credits: existingUser.credits,
            isExisting: true
          }
        });
      }

      console.log('Step 5: Creating new user...');
      // Create new user with starter plan
      const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
        p_clerk_id: clerkUserId,
        p_email: email || 'unknown@example.com',
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_plan_type: 'starter'
      });

      if (createError) throw createError;

      console.log('Step 6: Fetching created user...');
      // Fetch the created user to verify credits
      const { data: createdUser, error: fetchNewError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('id', newUserId)
        .single();

      if (fetchNewError) throw fetchNewError;
      user = createdUser;

      // Ensure user has exactly 25 credits (backup check in case upsert_user didn't set them correctly)
      if (user.credits !== 25) {
        console.log(`User ${clerkUserId} has ${user.credits} credits, adjusting to 25`);
        
        const creditAdjustment = 25 - user.credits;
        const { error: creditError } = await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: creditAdjustment,
          p_description: 'Starter plan credits adjustment',
          p_reference_id: null
        });

        if (creditError) {
          console.error('Error adjusting credits:', creditError);
          // Don't fail the request, just log the error
        } else {
          user.credits = 25;
        }
      }

    } catch (error) {
      console.error('❌ Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    console.log('✅ Starter plan signup completed successfully');
    return res.status(200).json({
      success: true,
      message: 'Starter plan activated successfully',
      data: {
        planType: 'starter',
        credits: 25, // Always return 25 for starter plan
        isExisting: false
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in process-signup:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process starter signup',
      details: error.message 
    });
  }
}