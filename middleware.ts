import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/organizations(.*)',
  '/billing(.*)',
  '/dashboard(.*)', // Add other org-related routes
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Export the handler function for testing
export const seatValidationHandler = async (auth: () => Promise<{ userId: string | null; orgId: string | null }>, req: NextRequest) => {
  // Standard Clerk auth
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  if (isProtectedRoute(req)) {
    if (!orgId) {
      return NextResponse.redirect(new URL('/organizations', req.url));
    }

    // Seat validation (adapt repo's license middleware)
    try {
      const { data: seat, error } = await supabase
        .from('organization_seats')
        .select('status, expires_at')
        .eq('clerk_org_id', orgId)
        .eq('clerk_user_id', userId)
        .single();

      if (error || !seat) {
        console.error('Seat validation error:', error);
        return NextResponse.json({ error: 'No active seat assigned' }, { status: 403 });
      }

      if (seat.status !== 'active') {
        return NextResponse.json({ error: 'Seat not active' }, { status: 403 });
      }

      if (seat.expires_at && new Date(seat.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Seat expired' }, { status: 403 });
      }

      // Check subscription overage for usage routes (optional, log for now)
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('overage')
        .eq('clerk_org_id', orgId)
        .eq('status', 'active')
        .single();

      if (sub?.overage) {
        // Allow but log for billing
        console.log(`Overage detected for org ${orgId}, user ${userId}`);
      }
    } catch (error) {
      console.error('Middleware seat check failed:', error);
      return NextResponse.json({ error: 'License validation failed' }, { status: 500 });
    }
  }

  return NextResponse.next();
};

export default clerkMiddleware(seatValidationHandler);

export const config = {
  matcher: [
    // Skip static files, Next.js internals, Clerk auth routes
    '/((?!static|.*\\..*|_next|sign-in|sign-up).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};