-- Add VS Code integration fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
    last_vscode_activity_at TIMESTAMP WITH TIME ZONE,
    vscode_extension_version TEXT,
    integration_preferences JSONB DEFAULT '{}',
    api_key_hash TEXT, -- For API key authentication
    api_key_created_at TIMESTAMP WITH TIME ZONE,
    total_api_requests INTEGER DEFAULT 0,
    last_api_request_at TIMESTAMP WITH TIME ZONE;

-- Add VS Code specific metadata to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS
    vscode_enabled BOOLEAN DEFAULT true,
    feature_flags JSONB DEFAULT '{}',
    api_rate_limit_override INTEGER, -- Custom rate limits for enterprise
    priority_support BOOLEAN DEFAULT false;

-- Enhance credit transactions for better tracking
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS
    transaction_type VARCHAR(50) DEFAULT 'usage',
    model_id TEXT,
    provider TEXT,
    tokens_used INTEGER,
    session_id UUID REFERENCES vscode_sessions(id) ON DELETE SET NULL,
    api_endpoint TEXT,
    metadata JSONB DEFAULT '{}';

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_users_last_vscode_activity ON users(last_vscode_activity_at) WHERE last_vscode_activity_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash) WHERE api_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_session ON credit_transactions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type_created ON credit_transactions(transaction_type, created_at DESC);