import { useUser, UserButton, useAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3, Settings, CreditCard, Activity, Copy, RefreshCw, Code } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';
import { setAuthPageMeta } from '@/utils/seo';

const Dashboard = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [extensionToken, setExtensionToken] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setAuthPageMeta('dashboard');
  }, []);

  const generateExtensionToken = async () => {
    setIsGenerating(true);
    try {
      const token = await getToken();
      if (token) {
        setExtensionToken(token);
      }
    } catch (error) {
      console.error('Failed to generate extension token:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (extensionToken) {
      try {
        await navigator.clipboard.writeText(extensionToken);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Failed to copy token:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <img
                  src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/64f13509d1c4365f30a60404_logo%20softcodes_-p-500.svg"
                  alt="Softcodes"
                  className="h-8 w-auto"
                />
              </Link>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            </div>
            <UserButton 
              appearance={{
                baseTheme: dark,
                elements: {
                  avatarBox: 'w-10 h-10',
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.firstName || 'Developer'}!
          </h2>
          <p className="text-gray-300">
            Here's your coding activity and account overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Requests</p>
                <p className="text-2xl font-bold text-white">1,234</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Credits Remaining</p>
                <p className="text-2xl font-bold text-white">8,766</p>
              </div>
              <CreditCard className="w-8 h-8 text-green-400" />
            </div>
          </Card>
          
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Current Plan</p>
                <p className="text-2xl font-bold text-white">Pro</p>
              </div>
              <Settings className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
          
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">This Month</p>
                <p className="text-2xl font-bold text-white">456</p>
              </div>
              <Activity className="w-8 h-8 text-orange-400" />
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link to="/profile">
                <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                  <Settings className="w-4 h-4 mr-2" />
                  Account Settings
                </Button>
              </Link>
              <Button variant="outline" className="w-full justify-start border-white/20 text-white hover:bg-white/10">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing & Usage
              </Button>
              <Button variant="outline" className="w-full justify-start border-white/20 text-white hover:bg-white/10">
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-gray-300">Code completion request</span>
                <span className="text-gray-400 text-sm">2 min ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-gray-300">Bug fix suggestion</span>
                <span className="text-gray-400 text-sm">15 min ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-gray-300">Code review</span>
                <span className="text-gray-400 text-sm">1 hour ago</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-300">Documentation generated</span>
                <span className="text-gray-400 text-sm">2 hours ago</span>
              </div>
            </div>
          </Card>
        </div>

        {/* VSCode Extension Integration */}
        <Card className="bg-slate-800/50 border-white/10 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-semibold text-white">VSCode Extension Integration</h3>
          </div>
          <p className="text-gray-300 mb-6">
            Generate an authentication token to connect your VSCode extension with your account.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={generateExtensionToken}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Code className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Generating...' : 'Generate Token'}
              </Button>
              
              {extensionToken && (
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copySuccess ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </div>
            
            {extensionToken && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Authentication Token:</label>
                <Input
                  value={extensionToken}
                  readOnly
                  className="bg-slate-700/50 border-white/10 text-white font-mono text-sm"
                  placeholder="Generate a token to see it here..."
                />
                <p className="text-xs text-gray-400">
                  Use this token in your VSCode extension settings to authenticate API requests.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Navigation Links */}
        <div className="mt-8 text-center">
          <Link 
            to="/" 
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;