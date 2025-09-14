import { userOperations } from '../../src/utils/supabase/database.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerkId } = req.query;

  if (!clerkId) {
    return res.status(400).json({ error: 'Clerk ID is required' });
  }

  try {
    console.log('🔍 API: Getting user for Clerk ID:', clerkId);
    const { data, error } = await userOperations.getUserByClerkId(clerkId);

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
}