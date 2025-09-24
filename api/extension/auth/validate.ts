import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT } from '../../../src/utils/jwt.ts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }

    res.status(200).json({ valid: true, userId: decoded.sub });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
}