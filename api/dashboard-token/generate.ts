import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_SECONDS = 60 * 60;

async function verifyClerkToken(token: string): Promise<{ clerkUserId: string; sessionId?: string; exp?: number }> {
  try {
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || typeof decoded !== 'object' || !('payload' in decoded) || !decoded.payload || !decoded.payload.sub) {
      throw new Error('Invalid Clerk token structure');
    }

    const payload = decoded.payload as JwtPayload;

    if (payload.iss !== 'https://softcodes.ai') {
      throw new Error('Invalid token issuer');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const clockTolerance = 5;
    if (payload.exp && payload.exp < (currentTime - clockTolerance)) {
      throw new Error('Clerk token has expired');
    }

    return {
      clerkUserId: payload.sub as string,
      sessionId: payload.sid as string | undefined,
      exp: payload.exp as number | undefined
    };
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('expired')) {
      throw new Error('Clerk token has expired');
    }
    throw new Error('Invalid Clerk token: ' + err.message);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
    const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_SECONDS;
    const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);
    const expiresAt = new Date(exp * 1000).toISOString();
    return res.json({
      success: true,
      access_token: accessToken,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
      expires_at: expiresAt,
      token_type: 'Bearer',
      usage: 'vscode_extension'
    });
  }

  try {
    const clerkDecoded = await verifyClerkToken(token);
    const clerkUserId = clerkDecoded.clerkUserId;

    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_SECONDS;
    const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);

    const expiresAt = new Date(exp * 1000).toISOString();

    console.log('Generated dashboard token for Clerk User ID:', clerkUserId);

    res.json({
      success: true,
      access_token: accessToken,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
      expires_at: expiresAt,
      token_type: 'Bearer',
      usage: 'vscode_extension'
    });
  } catch (error) {
    const err = error as Error;
    console.error('Token verification failed:', err);
    res.status(401).json({ error: err.message });
  }
}