const { currentUser } = require('@clerk/nextjs/server');
const { generateJWT, generateSessionId } = require('../../utils/jwt');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the current authenticated user from Clerk
    const user = await currentUser();
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Generate our custom long-lived JWT (4 months)
    const sessionId = generateSessionId();
    const accessToken = generateJWT(
      {
        clerk_id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        organization_id: null,
        plan_type: 'default'
      },
      sessionId
    );

    return res.status(200).json({
      access_token: accessToken,
      session_id: sessionId,
      expires_in: 120 * 24 * 60 * 60, // 4 months in seconds
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Token generation failed' });
  }
};