import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '../../../../src/utils/jwt.js';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyJWT(token);
    
    if (!decoded || !decoded.sub) {
      return NextResponse.json({ valid: false, error: 'Invalid token' }, { status: 401 });
    }

    return NextResponse.json({ valid: true, userId: decoded.sub });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' }, { status: 500 });
  }
}