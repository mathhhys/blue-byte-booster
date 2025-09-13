import { databaseHelpers } from '../../src/utils/supabase/database';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}