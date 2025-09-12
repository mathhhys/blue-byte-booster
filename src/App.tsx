import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import Teams from "./pages/Teams";
import Updates from "./pages/Updates";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import PostSignup from "./pages/PostSignup";
import Dashboard from "./pages/Dashboard";
import Organizations from "./pages/Organizations";
import Profile from "./pages/Profile";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import { VscodeInitiateAuth } from "./pages/VscodeInitiateAuth";
import { VscodeAuthCallback } from "./pages/VscodeAuthCallback";
import ExtensionSignIn from "./pages/ExtensionSignIn";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/sign-up/*" element={<SignUp />} />
          <Route path="/sign-in/*" element={<SignIn />} />
          <Route path="/auth/post-signup" element={<PostSignup />} />
          <Route path="/auth/vscode-initiate" element={<VscodeInitiateAuth />} />
          <Route path="/auth/vscode-callback" element={<VscodeAuthCallback />} />
          <Route path="/extension-signin" element={<ExtensionSignIn />} />
          
          {/* Payment Routes */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancelled" element={<PaymentCancelled />} />
          
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <>
                <SignedIn>
                  <Dashboard />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/organizations"
            element={
              <>
                <SignedIn>
                  <Organizations />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/profile"
            element={
              <>
                <SignedIn>
                  <Profile />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
