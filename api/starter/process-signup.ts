import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { clerkUserId, email, firstName, lastName } = await request.json();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Clerk User ID is required' }, { status: 400 });
    }

    console.log('=== STARTER PLAN PROCESS SIGNUP ===');
    console.log('Clerk User ID:', clerkUserId);
    console.log('Email:', email);

    // Import Supabase
    const { createClient } = require('@supabase/supabase-js');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if user already exists
    let user: any;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (existingUser) {
        // User already exists, just return success
        return NextResponse.json({
          success: true,
          message: 'User already exists',
          data: {
            planType: existingUser.plan_type,
            credits: existingUser.credits,
            isExisting: true
          }
        });
      }

      // Create new user with starter plan
      const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
        p_clerk_id: clerkUserId,
        p_email: email || 'unknown@example.com',
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_plan_type: 'starter'
      });

      if (createError) throw createError;

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
      console.error('Error handling user:', error);
      return NextResponse.json({ error: 'Failed to process user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Starter plan activated successfully',
      data: {
        planType: 'starter',
        credits: 25, // Always return 25 for starter plan
        isExisting: false
      }
    });

  } catch (error) {
    console.error('Error processing starter signup:', error);
    return NextResponse.json({ error: 'Failed to process starter signup' }, { status: 500 });
  }
}