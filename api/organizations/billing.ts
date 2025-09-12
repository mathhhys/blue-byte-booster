import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { PLAN_CONFIGS } from '../../src/config/plans.js';
import {
  OrganizationBillingInfo,
  CreateOrganizationSubscriptionRequest,
  OrganizationBillingPortalRequest
} from '../../src/types/organization.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async (req: VercelRequest, res: VercelResponse) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orgId } = req.query;

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    // Verify user is a member of the organization and get their role
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    
    // Get organization memberships and find the current user
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100
    });
    
    const membership = memberships.data.find(m => m.publicUserData.userId === userId);
    if (!membership) {
      return res.status(403).json({ error: 'User is not a member of this organization' });
    }

    const isAdmin = membership.role === 'org:admin';

    switch (req.method) {
      case 'GET':
        return await handleGetOrganizationBilling(req, res, orgId, userId, isAdmin);
      case 'POST':
        return await handleCreateOrganizationSubscription(req, res, orgId, userId, isAdmin);
      case 'PUT':
        return await handleUpdateOrganizationSubscription(req, res, orgId, userId, isAdmin);
      default:
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Organization billing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleGetOrganizationBilling(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  try {
    // Get organization members
    const members = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100
    });

    // Mock billing info for now (in production, this would query your database)
    const mockBillingInfo: OrganizationBillingInfo = {
      subscription: {
        id: `sub_${orgId}`,
        clerk_org_id: orgId,
        stripe_customer_id: `cus_${orgId}`,
        stripe_subscription_id: `sub_stripe_${orgId}`,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 10,
        seats_used: members.data.length,
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
      },
      seats: members.data.map(member => ({
        id: `seat_${member.id}`,
        organization_subscription_id: `sub_${orgId}`,
        clerk_user_id: member.publicUserData.userId,
        clerk_org_id: orgId,
        user_email: member.publicUserData.emailAddress || '',
        user_name: `${member.publicUserData.firstName || ''} ${member.publicUserData.lastName || ''}`.trim(),
        assigned_at: member.createdAt,
        assigned_by: userId,
      })),
      isAdmin,
      canManageBilling: isAdmin,
      memberCount: members.data.length,
      seatUsage: {
        used: members.data.length,
        total: 10,
        available: 10 - members.data.length,
        percentUsed: Math.round((members.data.length / 10) * 100),
      },
    };

    res.status(200).json(mockBillingInfo);
  } catch (error) {
    console.error('Error getting organization billing:', error);
    res.status(500).json({ error: 'Failed to get organization billing information' });
  }
}

async function handleCreateOrganizationSubscription(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only organization admins can manage billing' });
  }

  try {
    const { plan_type, billing_frequency, seats_total }: CreateOrganizationSubscriptionRequest = req.body;

    if (plan_type !== 'teams') {
      return res.status(400).json({ error: 'Only teams plan is available for organizations' });
    }

    if (!['monthly', 'yearly'].includes(billing_frequency)) {
      return res.status(400).json({ error: 'Invalid billing frequency' });
    }

    if (seats_total < 1 || seats_total > 100) {
      return res.status(400).json({ error: 'Seats must be between 1 and 100' });
    }

    // Get organization details
    const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });

    // Create or get Stripe customer for organization
    const customer = await stripe.customers.create({
      email: org.createdBy, // You might want to use admin email
      metadata: {
        clerk_org_id: orgId,
        clerk_user_id: userId,
        organization_name: org.name,
      },
    });

    // Calculate price
    const planConfig = PLAN_CONFIGS[plan_type];
    const unitPrice = billing_frequency === 'monthly' ? planConfig.price.monthly : planConfig.price.yearly;

    // Create checkout session for organization subscription
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${planConfig.name} Plan`,
              description: `${seats_total} seats - ${billing_frequency} billing`,
            },
            unit_amount: unitPrice * 100, // Convert to cents
            recurring: {
              interval: billing_frequency === 'monthly' ? 'month' : 'year',
            },
          },
          quantity: seats_total,
        },
      ],
      metadata: {
        clerk_org_id: orgId,
        clerk_user_id: userId,
        plan_type,
        billing_frequency,
        seats_total: seats_total.toString(),
        subscription_type: 'organization',
      },
      success_url: `${process.env.FRONTEND_URL}/organizations?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/organizations?billing=cancelled`,
    });

    res.status(200).json({
      success: true,
      checkout_url: session.url,
    });
  } catch (error) {
    console.error('Error creating organization subscription:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create organization subscription' 
    });
  }
}

async function handleUpdateOrganizationSubscription(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only organization admins can manage billing' });
  }

  // Implementation for updating subscription (seats, plan changes)
  res.status(200).json({ success: true, message: 'Subscription update not implemented yet' });
}