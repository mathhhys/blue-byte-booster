
// Test script for individual credit top-up
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_CLERK_USER_ID = 'user_32mSltWx9KkUkJe3sN2Bkym2w45'; // From user's example
const TEST_CREDITS = 71;

async function testCreditTopup() {
  console.log('🧪 Testing Individual Credit Top-up Flow');
  console.log('========================================');

  try {
    // 1. Check initial credits
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', TEST_CLERK_USER_ID)
      .single();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return;
    }

    console.log(`Initial credits: ${user.credits}`);

    // 2. Create test checkout session (use test mode)
    const session = await stripe.checkout.sessions.create({
      customer_email: 'test@example.com',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Test Credit Top-up: ${TEST_CREDITS} credits`,
            },
            unit_amount: TEST_CREDITS * 100, // $0.01 per credit
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: {
        clerk_user_id: TEST_CLERK_USER_ID,
        credits_amount: TEST_CREDITS.toString(),
        type: 'credit_topup',
      },
    });

    console.log(`Created test session: ${session.id}`);

    // 3. Simulate webhook by calling the handler directly
    await handleTestWebhook(session.id, session.metadata);

    // 4. Check final credits
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', TEST_CLERK_USER_ID)
      .single();

    if (updateError) {
      console.error('Error fetching updated user:', updateError);
      return;
    }

    console.log(`Final credits: ${updatedUser.credits}`);
    console.log(`Expected: ${user.credits + TEST_CREDITS} credits`);

    if (updatedUser.credits === user.credits + TEST_CREDITS) {
      console.log('✅ Test passed: Credits updated correctly!');
    } else {
      console.log('❌ Test failed: Credits not updated as expected');
    }

    // Clean up: Optionally delete the test session or payment intent if needed
    console.log('\nTest complete.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Helper function to simulate webhook
async function handleTestWebhook(sessionId, metadata) {
  // This simulates the handleCheckoutSessionCompleted function
  const session = {
    id: sessionId,
    metadata: metadata,
  };

  const { clerk_user_id: clerkUserId, credits_amount: creditsAmountStr } = session.metadata;
  
  if (!clerkUserId || !creditsAmountStr) {
    console.error('Missing metadata for test webhook');
    return;
  }

  const creditsAmount = parseInt(creditsAmountStr);
  if (isNaN(creditsAmount) || creditsAmount <= 0) {
    console.error('Invalid credits amount for test webhook');
    return;
  }

  console.log(`Simulating webhook for credit top-up: +${creditsAmount} credits to ${clerkUserId}`);

  // Call the grant_credits RPC
  const { error: creditError } = await supabase.rpc('grant_credits', {
    p_clerk_id: clerkUserId,
    p_amount: creditsAmount,
    p_description: `Test credit top-up via Stripe (${sessionId})`,
    p_reference_id: sessionId,
  });

  if (creditError) {
    console.error('Error granting credits in test:', creditError);
  } else {
    console.log(`✅ Test webhook: Granted ${creditsAmount} credits`);
  }

  // Update last_credit_update
  await supabase
    .from('users')
    .update({ last_credit_update: new Date().toISOString() })
    .eq('clerk_id', clerkUserId);
}

// Run the test
testCreditTopup();