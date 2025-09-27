import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerk_org_id, plan_type, billing_frequency, seats_total } = req.body;
  
  console.log('🔍 DEBUG: Create subscription endpoint - Received body:', req.body);
  console.log('🔍 DEBUG: clerk_org_id:', clerk_org_id);
  console.log('🔍 DEBUG: plan_type:', plan_type);
  console.log('🔍 DEBUG: billing_frequency:', billing_frequency);
  console.log('🔍 DEBUG: seats_total:', seats_total);

  if (!clerk_org_id) {
    console.log('❌ DEBUG: No organization ID found in request body');
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  if (!plan_type || !billing_frequency || !seats_total) {
    console.log('❌ DEBUG: Missing required subscription parameters');
    return res.status(400).json({ error: 'Missing required subscription parameters' });
  }
  
  console.log('✅ DEBUG: Creating subscription for organization ID:', clerk_org_id);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, clerk_org_id as string);
    console.log('🔍 API: Creating subscription for organization:', clerk_org_id, 'by user:', authResult.userId);

    // For now, return mock checkout URL since we don't have Stripe integration fully set up
    // TODO: Replace with actual Stripe checkout session creation
    const mockCheckoutUrl = `https://checkout.stripe.com/pay/mock-session-${Date.now()}`;
    
    console.log('✅ API: Mock checkout URL created:', mockCheckoutUrl);
    
    return res.status(200).json({
      success: true,
      checkout_url: mockCheckoutUrl,
      message: 'Subscription creation initiated (mock mode)'
    });
  } catch (error: any) {
    console.error('❌ API: Exception in create-subscription endpoint:', error);
    
    if (error.message === 'Missing or invalid Authorization header') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (error.message === 'User does not belong to this organization' || 
        error.message === 'User is not an organization admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}