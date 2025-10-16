-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (matches Clerk user data)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  plan_type TEXT DEFAULT 'pro' CHECK (plan_type IN ('pro', 'teams', 'enterprise')),
  credits INTEGER DEFAULT 0,
  subscription_anniversary_date TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('pro', 'teams', 'enterprise')),
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('monthly', 'yearly')),
  seats INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clerk_invitation_id TEXT,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('grant', 'usage', 'refund', 'bonus', 'trial_grant', 'conversion_bonus', 'monthly_reset')),
  description TEXT,
  reference_id TEXT, -- For linking to subscriptions, payments, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trial_start', 'trial_end', 'low_credits', 'upgrade', 'billing')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_subscription_id ON team_invitations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (clerk_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (clerk_id = auth.jwt() ->> 'sub');

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Team invitations policies
CREATE POLICY "Users can view team invitations they created" ON team_invitations
  FOR SELECT USING (inviter_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can view invitations sent to them" ON team_invitations
  FOR SELECT USING (email = auth.jwt() ->> 'email');

-- Credit transactions policies
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Functions for credit management
CREATE OR REPLACE FUNCTION grant_credits(
  p_clerk_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Credits granted',
  p_reference_id TEXT DEFAULT NULL,
  p_transaction_type TEXT DEFAULT 'grant'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from clerk_id
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_id;
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update user credits
  UPDATE users
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_user_id, p_amount, p_transaction_type, p_description, p_reference_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for monthly credit reset
CREATE OR REPLACE FUNCTION reset_monthly_credits(
  p_clerk_id TEXT,
  p_plan_credits INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from clerk_id
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_id;
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Reset credits to plan amount and update anniversary date
  UPDATE users
  SET credits = p_plan_credits,
      subscription_anniversary_date = NOW(),
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Record reset transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_user_id, p_plan_credits, 'monthly_reset', 'Monthly credit reset', NULL);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(
  p_clerk_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Credits used',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_current_credits INTEGER;
  v_new_credits INTEGER;
  v_email TEXT;
BEGIN
  -- Get user ID and current credits
  SELECT id, credits, email INTO v_user_id, v_current_credits, v_email
  FROM users WHERE clerk_id = p_clerk_id;
  
  IF v_user_id IS NULL OR v_current_credits < p_amount THEN
    RETURN FALSE;
  END IF;
  
  v_new_credits := v_current_credits - p_amount;
  
  -- Update user credits
  UPDATE users
  SET credits = v_new_credits,
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_user_id, -p_amount, 'usage', p_description, p_reference_id);
  
  -- Check for low credits and create notification
  IF v_new_credits < 50 THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_user_id, 'Low Credits Warning', format('You have only %s credits left. Add more or upgrade to Pro for monthly allotment.', v_new_credits), 'low_credits');
    
    -- Send email if email exists
    IF v_email IS NOT NULL THEN
      -- Note: Email sending would be handled by a trigger or external service
      -- For now, just log
      RAISE NOTICE 'Low credits email should be sent to %', v_email;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create or update user from Clerk data
CREATE OR REPLACE FUNCTION upsert_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'pro'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO users (clerk_id, email, first_name, last_name, avatar_url, plan_type)
  VALUES (p_clerk_id, p_email, p_first_name, p_last_name, p_avatar_url, p_plan_type)
  ON CONFLICT (clerk_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;