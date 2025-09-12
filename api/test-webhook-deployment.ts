import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🧪 Test webhook deployment endpoint called')
  console.log('🧪 URL:', req.url)
  console.log('🧪 Method:', req.method)
  console.log('🧪 Headers:', JSON.stringify(req.headers, null, 2))
  
  return res.status(200).json({
    success: true,
    message: 'Test webhook deployment endpoint is working',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  })
}