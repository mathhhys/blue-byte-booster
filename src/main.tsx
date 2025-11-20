import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'
import { AuthErrorBoundary } from './components/auth/AuthErrorBoundary'
import { Analytics } from '@vercel/analytics/react'
import Hotjar from '@hotjar/browser';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

const siteId = 6581430;
const hotjarVersion = 6;

Hotjar.init(siteId, hotjarVersion);
createRoot(document.getElementById("root")!).render(
  <AuthErrorBoundary>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
      <Analytics />
    </ClerkProvider>
  </AuthErrorBoundary>
);
