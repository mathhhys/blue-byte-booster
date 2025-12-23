-- Migration: Atomic Seat Management Functions
-- Purpose: Prevent race conditions when incrementing/decrementing seats_used

-- Function to increment seats_used safely
CREATE OR REPLACE FUNCTION increment_seats_used(p_subscription_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_subscriptions
  SET 
    seats_used = seats_used + 1,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement seats_used safely
CREATE OR REPLACE FUNCTION decrement_seats_used(p_subscription_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_subscriptions
  SET 
    seats_used = GREATEST(0, seats_used - 1),
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;