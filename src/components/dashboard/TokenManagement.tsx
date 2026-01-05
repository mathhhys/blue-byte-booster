import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Monitor,
  Calendar,
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Token {
  id: string;
  name: string;
  device_name: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  refresh_count: number;
  days_until_expiry: number;
  status: 'active' | 'expiring_soon' | 'warning' | 'critical';
  can_refresh: boolean;
}

export function TokenManagement() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [tokenToRevoke, setTokenToRevoke] = useState<Token | null>(null);
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const loadTokens = async () => {
    try {
      const authToken = await getToken();
      const response = await fetch('/api/extension-token/list', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens || []);
      } else {
        throw new Error('Failed to load tokens');
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
      toast({
        title: 'Error loading tokens',
        description: 'Failed to load your tokens. Please refresh the page.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
    // Refresh token list every 30 seconds
    const interval = setInterval(loadTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  const generateToken = async () => {
    if (!newTokenName.trim()) {
      toast({
        title: 'Token name required',
        description: 'Please provide a name for this token (e.g., "Work Laptop", "Home PC")',
        variant: 'destructive'
      });
      return;
    }

    if (tokens.length >= 5) {
      toast({
        title: 'Token limit reached',
        description: 'You can have a maximum of 5 active tokens. Please revoke an existing token first.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    try {
      const authToken = await getToken();
      const response = await fetch('/api/extension-token/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceName: newTokenName,
          clerk_org_id: organization?.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.userMessage || data.message || 'Failed to generate token');
      }

      setGeneratedToken(data.access_token);
      setNewTokenName('');
      await loadTokens();

      toast({
        title: 'Token created',
        description: 'Your authentication token has been generated successfully. Copy it now - it won\'t be shown again.',
      });
    } catch (error: any) {
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshToken = async (tokenId: string) => {
    setIsRefreshing(tokenId);
    try {
      const authToken = await getToken();
      const response = await fetch('/api/extension-token/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokenId,
          clerk_org_id: organization?.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.userMessage || data.message || 'Failed to refresh token');
      }

      setGeneratedToken(data.access_token);
      await loadTokens();

      toast({
        title: 'Token refreshed',
        description: 'Your token has been refreshed successfully. Copy the new token and update your VSCode extension.'
      });
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(null);
    }
  };

  const revokeToken = async () => {
    if (!tokenToRevoke) return;

    try {
      const authToken = await getToken();
      const response = await fetch('/api/extension-token/revoke', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenId: tokenToRevoke.id })
      });

      if (response.ok) {
        await loadTokens();
        toast({
          title: 'Token revoked',
          description: `Token "${tokenToRevoke.device_name}" has been revoked successfully`
        });
      } else {
        throw new Error('Failed to revoke token');
      }
    } catch (error) {
      toast({
        title: 'Revocation failed',
        description: 'Failed to revoke token. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setTokenToRevoke(null);
    }
  };

  const copyToken = async () => {
    if (!generatedToken) return;
    
    try {
      await navigator.clipboard.writeText(generatedToken);
      toast({ 
        title: 'Copied!', 
        description: 'Token copied to clipboard' 
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy token to clipboard',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-orange-500 hover:bg-orange-600';
      case 'expiring_soon': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return 'bg-green-500 hover:bg-green-600';
    }
  };

  const getStatusText = (status: string, days: number) => {
    switch (status) {
      case 'critical': return `Expires in ${days} day${days !== 1 ? 's' : ''}!`;
      case 'warning': return `Expires in ${days} days`;
      case 'expiring_soon': return `Expires in ${days} days`;
      default: return `Active (${days} days left)`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-500/10 border-blue-500/20 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-white">About Extension Tokens</h4>
            <p className="text-xs text-white/70">
              These are long-lived tokens (valid for 4 months) used to authenticate your VSCode extension. 
              You can have up to 5 active tokens for different devices. Tokens can be refreshed within 30 days of expiration.
            </p>
          </div>
        </div>
      </Card>

      {/* Generate New Token */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Generate New Token
        </h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Token name (e.g., 'Work Laptop', 'Home PC')"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && generateToken()}
              className="bg-[#1a1a1a] border-white/10 text-white flex-1"
              disabled={isGenerating || tokens.length >= 5}
            />
            <Button
              onClick={generateToken}
              disabled={isGenerating || !newTokenName.trim() || tokens.length >= 5}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>

          {tokens.length >= 5 && (
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Maximum token limit reached. Revoke an existing token to create a new one.
            </div>
          )}

          {generatedToken && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-white">Token Generated Successfully</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToken}
                  className="text-white hover:bg-white/10"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="bg-[#1a1a1a] p-3 rounded border border-white/10">
                <code className="text-xs text-white/70 break-all font-mono block">
                  {generatedToken}
                </code>
              </div>
              <div className="flex items-start gap-2 text-xs text-orange-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Important:</strong> Store this token securely. It won't be shown again. 
                  Copy it now and add it to your VSCode extension settings.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGeneratedToken('')}
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                I've saved my token
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Active Tokens List */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
          <span>Active Tokens ({tokens.length}/5)</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadTokens}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </h3>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1a1a1a] border border-white/10 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-600 rounded w-1/3 mb-3"></div>
                <div className="h-3 bg-gray-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-12 h-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/50 mb-1">No active tokens</p>
            <p className="text-sm text-white/30">Generate a token above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="bg-[#1a1a1a] border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Monitor className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-white truncate">{token.device_name}</span>
                      <Badge className={`${getStatusColor(token.status)} text-white text-xs`}>
                        {getStatusText(token.status, token.days_until_expiry)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-xs text-white/60 ml-8">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Created: {new Date(token.created_at).toLocaleDateString()}
                      </div>
                      {token.last_used_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Last used: {new Date(token.last_used_at).toLocaleString()}
                        </div>
                      )}
                      {token.refresh_count > 0 && (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3 h-3" />
                          Refreshed {token.refresh_count} time{token.refresh_count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {token.can_refresh && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshToken(token.id)}
                        disabled={isRefreshing === token.id}
                        className="border-white/20 text-white hover:bg-white/10"
                        title="Refresh token (extends expiration by 4 months)"
                      >
                        {isRefreshing === token.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setTokenToRevoke(token)}
                      title="Revoke token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {token.status === 'critical' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                    <AlertCircle className="w-4 h-4" />
                    <span>This token expires very soon! Refresh it now or generate a new one.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!tokenToRevoke} onOpenChange={() => setTokenToRevoke(null)}>
        <AlertDialogContent className="bg-[#2a2a2a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Revoke Token</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you sure you want to revoke the token "{tokenToRevoke?.device_name}"? 
              This action cannot be undone. The VSCode extension using this token will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeToken}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revoke Token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}