import { UserProfile } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { setAuthPageMeta } from '@/utils/seo';

const Profile = () => {
  useEffect(() => {
    setAuthPageMeta('profile');
  }, []);
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
              <h1 className="text-xl font-semibold text-white">Profile Settings</h1>
            </div>
            <Link 
              to="/dashboard"
              className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
            <p className="text-gray-300">Manage your account settings and preferences</p>
          </div>
          
          <UserProfile 
            appearance={{
              baseTheme: dark,
              variables: {
                colorPrimary: '#3b82f6',
                colorBackground: 'rgba(15, 23, 42, 0.8)',
                colorInputBackground: 'rgba(30, 41, 59, 0.5)',
                colorInputText: '#ffffff',
                colorText: '#ffffff',
                colorTextSecondary: '#94a3b8',
                borderRadius: '0.5rem',
              },
              elements: {
                card: 'bg-slate-800/50 backdrop-blur-lg border border-white/10 shadow-2xl',
                navbar: 'bg-slate-800/30',
                navbarButton: 'text-gray-300 hover:text-white',
                navbarButtonActive: 'text-white bg-blue-600/20',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                headerTitle: 'text-white',
                headerSubtitle: 'text-gray-300',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Profile;