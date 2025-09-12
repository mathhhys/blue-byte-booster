import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyJWT } from '../utils/jwt';

// Credit conversion rate: $7 = 500 credits
const CREDITS_PER_DOLLAR = 500 / 7; // ≈71.428571

interface AddCreditsRequest {
  credits: number; // Number of credits to purchase
  amount: number; // Calculated dollar amount
}

// Helper function to convert dollars to credits
function dollarsToCredits(dollars: number): number {
  return Math.floor(dollars * CREDITS_PER_DOLLAR);
}

// Helper function to validate credits and amount
function validateCreditsRequest(credits: number, amount: number): { valid: boolean; error?: string } {
  if (!credits || isNaN(credits)) {
    return { valid: false, error: 'Credits is required and must be a number' };
  }
  
  if (!amount || isNaN(amount)) {
    return { valid: false, error: 'Amount is required and must be a number' };
  }
  
  if (credits < 71) {
    return { valid: false, error: 'Minimum purchase is 71 credits' };
  }
  
  if (credits > 71428) {
    return { valid: false, error: 'Maximum purchase is 71,428 credits' };
  }

  if (amount < 1) {
    return { valid: false, error: 'Minimum amount is $1.00' };
  }
  
  if (amount > 1000) {
    return { valid: false, error: 'Maximum amount is $1000.00' };
  }
  
  // Check if credits is a whole number
  if (credits % 1 !== 0) {
    return { valid: false, error: 'Credits must be a whole number' };
  }
  
  return { valid: true };
}

// Mock function to simulate adding credits to user account
async function addCreditsToUserAccount(clerkUserId: string, creditsToAdd: number): Promise<{
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Connect to your database
    // 2. Update the user's credit balance
    // 3. Create a credit transaction record
    // 4. Return the new balance and transaction ID
    
    // For development, we'll simulate this with a mock implementation
    console.log(`Mock: Adding ${creditsToAdd} credits to user ${clerkUserId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock current balance (in a real app, this would come from the database)
    const currentBalance = 15420; // This matches the dashboard display
    const newBalance = currentBalance + creditsToAdd;
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      newBalance,
      transactionId
    };
  } catch (error) {
    console.error('Error adding credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Mock function to create Stripe payment intent
async function createStripePaymentIntent(amount: number, clerkUserId: string): Promise<{
  success: boolean;
  clientSecret?: string;
  error?: string;
}> {
  try {
    // In production, this would create a real Stripe payment intent
    // For development, we'll simulate success
    console.log(`Mock: Creating Stripe payment intent for $${amount} for user ${clerkUserId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed'
    };
  }
}

// Extract user info from JWT token
async function getUserFromToken(authHeader: string): Promise<{ clerkUserId: string; error?: string }> {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { clerkUserId: '', error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyJWT(token);
    
    if (!payload || !payload.sub) {
      return { clerkUserId: '', error: 'Invalid token payload' };
    }

    return { clerkUserId: payload.sub };
  } catch (error) {
    return { clerkUserId: '', error: 'Token verification failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get user from authorization header (for frontend) or fallback to mock (for development)
    const authHeader = req.headers.authorization as string;
    let clerkUserId = '';
    
    if (authHeader) {
      const userResult = await getUserFromToken(authHeader);
      if (userResult.error) {
        return res.status(401).json({ success: false, error: userResult.error });
      }
      clerkUserId = userResult.clerkUserId;
    } else {
      // For development/testing, use mock user ID
      clerkUserId = 'mock_user_id_' + Date.now();
      console.log('No auth header provided, using mock user ID for development');
    }

    if (req.method === 'POST') {
      const { credits, amount }: AddCreditsRequest = req.body;

      // Validate credits and amount
      const validation = validateCreditsRequest(credits, amount);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      // Use the credits directly
      const creditsToAdd = credits;

      // In development mode, skip Stripe and directly add credits
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Skipping Stripe payment, directly adding credits');
        
        const result = await addCreditsToUserAccount(clerkUserId, creditsToAdd);
        
        if (!result.success) {
          return res.status(500).json({ success: false, error: result.error });
        }

        return res.status(200).json({
          success: true,
          newBalance: result.newBalance,
          creditsAdded: creditsToAdd,
          transactionId: result.transactionId,
          dollarsSpent: amount
        });
      }

      // Production flow: Create Stripe payment intent
      const paymentResult = await createStripePaymentIntent(amount, clerkUserId);
      
      if (!paymentResult.success) {
        return res.status(500).json({ success: false, error: paymentResult.error });
      }

      // For now, we'll simulate immediate success
      // In production, credits would be added after successful payment webhook
      const result = await addCreditsToUserAccount(clerkUserId, creditsToAdd);
      
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      return res.status(200).json({
        success: true,
        newBalance: result.newBalance,
        creditsAdded: creditsToAdd,
        transactionId: result.transactionId,
        clientSecret: paymentResult.clientSecret,
        dollarsSpent: amount
      });

    } else if (req.method === 'GET') {
      // GET endpoint to retrieve current credit balance
      // Mock current balance (in real app, fetch from database)
      const currentBalance = 15420;
      
      return res.status(200).json({
        success: true,
        balance: currentBalance
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in add credits API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}