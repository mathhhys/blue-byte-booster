// Token monitoring and logging utilities for production debugging
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unified time calculation functions
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

// Production monitoring logger
class TokenMonitor {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'production' || process.env.ENABLE_TOKEN_MONITORING === 'true';
  }

  log(level, message, data = {}) {
    if (!this.enabled && level !== 'error') return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      serverTime: {
        epoch: getCurrentEpochTime(),
        iso: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      ...data
    };

    console.log(`[TOKEN-MONITOR-${level.toUpperCase()}]`, JSON.stringify(logEntry, null, 2));
  }

  logTokenGeneration(tokenType, clerkUserId, exp, expiresAtISO) {
    const currentTime = getCurrentEpochTime();
    this.log('info', 'Token generated', {
      event: 'token_generation',
      tokenType,
      clerkUserId,
      generation: {
        currentEpoch: currentTime,
        tokenExpEpoch: exp,
        tokenExpiresAtISO: expiresAtISO,
        validitySeconds: exp - currentTime,
        validityMinutes: Math.floor((exp - currentTime) / 60)
      }
    });
  }

  logTokenValidation(tokenType, clerkUserId, exp, validationResult) {
    const currentTime = getCurrentEpochTime();
    this.log(validationResult.valid ? 'info' : 'warn', 'Token validation', {
      event: 'token_validation',
      tokenType,
      clerkUserId,
      validation: {
        currentEpoch: currentTime,
        tokenExpEpoch: exp,
        secondsUntilExpiry: exp - currentTime,
        result: validationResult.valid ? 'valid' : 'invalid',
        error: validationResult.error || null
      }
    });
  }

  logClockMismatch(expectedTime, actualTime, tolerance = 5) {
    const drift = Math.abs(expectedTime - actualTime);
    const level = drift > tolerance ? 'error' : 'warn';
    
    this.log(level, 'Clock drift detected', {
      event: 'clock_mismatch',
      drift: {
        expectedEpoch: expectedTime,
        actualEpoch: actualTime,
        driftSeconds: drift,
        toleranceSeconds: tolerance,
        severity: drift > tolerance ? 'critical' : 'warning'
      }
    });
  }

  logDatabaseExpiry(table, id, expiresAt, currentCheck) {
    const currentISO = new Date().toISOString();
    const isExpired = new Date(expiresAt) <= new Date(currentISO);
    
    this.log(isExpired ? 'warn' : 'info', 'Database expiry check', {
      event: 'database_expiry_check',
      table,
      recordId: id,
      expiry: {
        expiresAtISO: expiresAt,
        currentISO: currentISO,
        isExpired,
        checkReason: currentCheck
      }
    });
  }

  async logTokenMetrics() {
    if (!this.enabled) return;

    try {
      // Get token statistics from database
      const currentISO = new Date().toISOString();
      
      // Count active vs expired tokens by type
      const [oauthStats, refreshStats, sessionStats] = await Promise.all([
        supabase
          .from('oauth_codes')
          .select('expires_at')
          .gte('expires_at', currentISO),
        
        supabase
          .from('refresh_tokens')
          .select('expires_at')
          .is('revoked_at', null)
          .gte('expires_at', currentISO),
        
        supabase
          .from('vscode_sessions')
          .select('expires_at')
          .eq('is_active', true)
          .gte('expires_at', currentISO)
      ]);

      const [expiredOauth, expiredRefresh, expiredSessions] = await Promise.all([
        supabase
          .from('oauth_codes')
          .select('expires_at')
          .lt('expires_at', currentISO),
        
        supabase
          .from('refresh_tokens')
          .select('expires_at')
          .is('revoked_at', null)
          .lt('expires_at', currentISO),
        
        supabase
          .from('vscode_sessions')
          .select('expires_at')
          .eq('is_active', true)
          .lt('expires_at', currentISO)
      ]);

      this.log('info', 'Token metrics summary', {
        event: 'token_metrics',
        timestamp: currentISO,
        active_tokens: {
          oauth_codes: oauthStats.data?.length || 0,
          refresh_tokens: refreshStats.data?.length || 0,
          vscode_sessions: sessionStats.data?.length || 0
        },
        expired_tokens: {
          oauth_codes: expiredOauth.data?.length || 0,
          refresh_tokens: expiredRefresh.data?.length || 0,
          vscode_sessions: expiredSessions.data?.length || 0
        }
      });

    } catch (error) {
      this.log('error', 'Failed to collect token metrics', {
        event: 'token_metrics_error',
        error: error.message
      });
    }
  }

  logSystemHealth() {
    const currentTime = getCurrentEpochTime();
    const systemInfo = {
      event: 'system_health_check',
      timestamp: new Date().toISOString(),
      system: {
        nodeEnv: process.env.NODE_ENV,
        timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentEpoch: currentTime,
        currentISO: new Date().toISOString(),
        uptimeSeconds: process.uptime()
      },
      configuration: {
        jwtSecretConfigured: !!process.env.JWT_SECRET,
        supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        monitoringEnabled: this.enabled
      }
    };

    this.log('info', 'System health check', systemInfo);
  }

  async startPeriodicMonitoring(intervalMinutes = 15) {
    if (!this.enabled) {
      console.log('[TOKEN-MONITOR] Periodic monitoring disabled');
      return;
    }

    console.log(`[TOKEN-MONITOR] Starting periodic monitoring every ${intervalMinutes} minutes`);
    
    // Initial health check
    this.logSystemHealth();
    await this.logTokenMetrics();

    // Set up periodic monitoring
    setInterval(async () => {
      try {
        await this.logTokenMetrics();
      } catch (error) {
        this.log('error', 'Periodic monitoring error', {
          event: 'monitoring_error',
          error: error.message
        });
      }
    }, intervalMinutes * 60 * 1000);

    // Health check every hour
    setInterval(() => {
      this.logSystemHealth();
    }, 60 * 60 * 1000);
  }
}

// Create singleton instance
const tokenMonitor = new TokenMonitor();

module.exports = {
  tokenMonitor,
  TokenMonitor
};