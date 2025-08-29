-- Enhanced credit consumption function with session tracking
CREATE OR REPLACE FUNCTION consume_credits_with_session(
    p_clerk_id TEXT,
    p_amount INTEGER,
    p_description TEXT,
    p_session_id UUID DEFAULT NULL,
    p_model_id TEXT DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_current_credits INTEGER;
    v_transaction_id UUID;
    v_result JSONB;
BEGIN
    -- Get user and current credits
    SELECT id, credits INTO v_user_id, v_current_credits
    FROM users WHERE clerk_id = p_clerk_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found',
            'error_code', 'USER_NOT_FOUND'
        );
    END IF;
    
    -- Check if user has sufficient credits
    IF v_current_credits < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient credits',
            'error_code', 'INSUFFICIENT_CREDITS',
            'current_credits', v_current_credits,
            'required_credits', p_amount
        );
    END IF;
    
    -- Start transaction
    BEGIN
        -- Deduct credits
        UPDATE users 
        SET credits = credits - p_amount,
            last_api_request_at = NOW(),
            total_api_requests = total_api_requests + 1
        WHERE id = v_user_id;
        
        -- Record transaction
        INSERT INTO credit_transactions (
            user_id, amount, description, transaction_type, 
            model_id, provider, tokens_used, session_id, metadata
        ) VALUES (
            v_user_id, -p_amount, p_description, 'usage',
            p_model_id, p_provider, p_tokens_used, p_session_id, p_metadata
        ) RETURNING id INTO v_transaction_id;
        
        -- Record model usage if applicable
        IF p_model_id IS NOT NULL THEN
            INSERT INTO model_usage (
                user_id, session_id, model_id, provider, 
                tokens_used, credits_consumed, request_metadata
            ) VALUES (
                v_user_id, p_session_id, p_model_id, p_provider,
                p_tokens_used, p_amount, p_metadata
            );
        END IF;
        
        -- Update session activity
        IF p_session_id IS NOT NULL THEN
            UPDATE vscode_sessions 
            SET last_activity_at = NOW()
            WHERE id = p_session_id AND user_id = v_user_id;
        END IF;
        
        -- Return success result
        v_result := jsonb_build_object(
            'success', true,
            'remaining_credits', v_current_credits - p_amount,
            'transaction', jsonb_build_object(
                'id', v_transaction_id,
                'amount', p_amount,
                'description', p_description,
                'timestamp', NOW()
            )
        );
        
        RETURN v_result;
        
    EXCEPTION WHEN OTHERS THEN
        -- Rollback and return error
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Transaction failed: ' || SQLERRM,
            'error_code', 'TRANSACTION_FAILED'
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_endpoint TEXT,
    p_max_requests INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 60
) RETURNS JSONB AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_rate_limit_override INTEGER;
BEGIN
    -- Get user's rate limit override if any
    SELECT api_rate_limit_override INTO v_rate_limit_override
    FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE u.id = p_user_id AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    -- Use override if available
    IF v_rate_limit_override IS NOT NULL THEN
        p_max_requests := v_rate_limit_override;
    END IF;
    
    -- Calculate window start
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Get current request count in window
    SELECT COALESCE(SUM(requests_count), 0) INTO v_current_count
    FROM api_rate_limits
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint 
      AND window_start >= v_window_start;
    
    -- Check if limit exceeded
    IF v_current_count >= p_max_requests THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_requests', p_max_requests,
            'reset_at', v_window_start + (p_window_minutes || ' minutes')::INTERVAL
        );
    END IF;
    
    -- Record request
    INSERT INTO api_rate_limits (user_id, endpoint, requests_count, window_start, window_end)
    VALUES (p_user_id, p_endpoint, 1, 
            date_trunc('minute', NOW()), 
            date_trunc('minute', NOW()) + (p_window_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (user_id, endpoint, window_start)
    DO UPDATE SET requests_count = api_rate_limits.requests_count + 1;
    
    RETURN jsonb_build_object(
        'allowed', true,
        'current_count', v_current_count + 1,
        'max_requests', p_max_requests,
        'remaining', p_max_requests - (v_current_count + 1)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Mark expired sessions as inactive
    UPDATE vscode_sessions 
    SET is_active = false
    WHERE is_active = true AND expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Delete sessions older than 30 days
    DELETE FROM vscode_sessions 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;