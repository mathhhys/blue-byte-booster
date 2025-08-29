-- VS Code session tracking
CREATE TABLE vscode_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    extension_version TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    is_active BOOLEAN DEFAULT true,
    user_agent TEXT,
    ip_address INET
);

-- Model usage tracking
CREATE TABLE model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES vscode_sessions(id) ON DELETE SET NULL,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    tokens_used INTEGER,
    credits_consumed INTEGER,
    request_metadata JSONB DEFAULT '{}',
    response_metadata JSONB DEFAULT '{}',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature usage analytics
CREATE TABLE feature_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES vscode_sessions(id) ON DELETE SET NULL,
    feature_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API rate limiting
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint, window_start)
);

-- Indexes for performance
CREATE INDEX idx_vscode_sessions_user_active ON vscode_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_vscode_sessions_token ON vscode_sessions(session_token) WHERE is_active = true;
CREATE INDEX idx_vscode_sessions_expires ON vscode_sessions(expires_at) WHERE is_active = true;
CREATE INDEX idx_model_usage_user_created ON model_usage(user_id, created_at DESC);
CREATE INDEX idx_model_usage_session ON model_usage(session_id, created_at DESC);
CREATE INDEX idx_feature_usage_user_feature ON feature_usage(user_id, feature_name);
CREATE INDEX idx_api_rate_limits_user_endpoint ON api_rate_limits(user_id, endpoint, window_start);