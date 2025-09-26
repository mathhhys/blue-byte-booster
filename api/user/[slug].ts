import type { NextApiRequest, NextApiResponse } from 'next';
import { userOperations } from '../../src/utils/supabase/database.js';
import { databaseHelpers } from '../../src/utils/supabase/database.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug || '';

  if (slug === 'get' && method === 'GET') {
    // Logic from get.ts
    const { clerkId } = req.query;

    if (!clerkId) {
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    try {
      console.log('🔍 API: Getting user for Clerk ID:', clerkId);
      const { data, error } = await userOperations.getUserByClerkId(clerkId as string);

      if (error) {
        console.error('❌ API: Database error:', error);
        return res.status(500).json({ error: 'Database error', details: error });
      }

      console.log('✅ API: User found:', !!data);
      return res.status(200).json({ data, error: null });
    } catch (error) {
      console.error('❌ API: Exception:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (slug === 'initialize' && method === 'POST') {
    // Logic from initialize.ts
    const { clerkUser, planType = 'starter' } = req.body;

    if (!clerkUser || !clerkUser.id || !clerkUser.emailAddresses?.[0]?.emailAddress) {
      return res.status(400).json({ error: 'Valid Clerk user data is required' });
    }

    try {
      console.log('🔧 API: Initializing user for Clerk ID:', clerkUser.id);
      const { user, error } = await databaseHelpers.initializeUser(clerkUser, planType);

      if (error) {
        console.error('❌ API: Initialization error:', error);
        return res.status(500).json({ error: 'Initialization error', details: error });
      }

      console.log('✅ API: User initialized successfully');
      return res.status(200).json({ user, error: null });
    } catch (error) {
      console.error('❌ API: Exception during initialization:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}