import { organizationSeatOperations } from '../../src/utils/supabase/database.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for cron secret to prevent unauthorized access
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_JOB_SECRET;

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error('❌ Unauthorized access attempt to revoke-expired-seats');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔍 Starting expired seat revocation process...');
    
    const { data, error } = await organizationSeatOperations.revokeExpiredSeats();
    
    if (error) {
      console.error('❌ Error revoking expired seats:', error);
      return res.status(500).json({
        error: 'Failed to revoke expired seats',
        details: error
      });
    }

    console.log('✅ Expired seat revocation completed:', {
      seats_revoked: data?.seats_revoked || 0,
      seats_updated: data?.seats_updated || 0
    });

    return res.status(200).json({
      success: true,
      data: {
        seats_revoked: data?.seats_revoked || 0,
        seats_updated: data?.seats_updated || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ Exception in expired seat revocation:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}