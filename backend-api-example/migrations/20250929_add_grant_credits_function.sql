-- Create grant_credits function for updating user credits
CREATE OR REPLACE FUNCTION grant_credits(
    p_clerk_id TEXT,
    p_amount INTEGER,
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user ID from clerk_id
    SELECT id INTO v_user_id
    FROM users 
    WHERE clerk_id = p_clerk_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found for clerk_id: %', p_clerk_id;
    END IF;

    -- Update user credits
    UPDATE users 
    SET credits = credits + p_amount,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Record credit transaction
    INSERT INTO credit_transactions (
        user_id, 
        amount, 
        description, 
        transaction_type,
        reference_id
    ) VALUES (
        v_user_id,
        p_amount,
        COALESCE(p_description, 'Credit grant'),
        'grant',
        p_reference_id
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to grant credits: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create deduct_credits function for completeness
CREATE OR REPLACE FUNCTION deduct_credits(
    p_clerk_id TEXT,
    p_amount INTEGER,
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_current_credits INTEGER;
BEGIN
    -- Get user ID and current credits
    SELECT id, credits INTO v_user_id, v_current_credits
    FROM users 
    WHERE clerk_id = p_clerk_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found for clerk_id: %', p_clerk_id;
    END IF;

    -- Check if user has sufficient credits
    IF v_current_credits < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits: user has %, trying to deduct %', v_current_credits, p_amount;
    END IF;

    -- Update user credits
    UPDATE users 
    SET credits = credits - p_amount,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Record credit transaction
    INSERT INTO credit_transactions (
        user_id, 
        amount, 
        description, 
        transaction_type,
        reference_id
    ) VALUES (
        v_user_id,
        -p_amount,
        COALESCE(p_description, 'Credit deduction'),
        'deduction',
        p_reference_id
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to deduct credits: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for the functions
ALTER FUNCTION grant_credits(TEXT, INTEGER, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION deduct_credits(TEXT, INTEGER, TEXT, TEXT) SET search_path = public;