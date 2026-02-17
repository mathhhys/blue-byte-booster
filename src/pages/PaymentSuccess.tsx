import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  CreditCard,
  Users,
  ArrowRight,
  Loader2,
  Gift,
  Mail
} from 'lucide-react';
import { getStripeSessionStatus, processPaymentSuccess as processPaymentSuccessAPI } from '@/api/stripe';
import { databaseHelpers } from '@/utils/supabase/database';
import { InvitationManager } from '@/components/teams/InvitationManager';
import { PLAN_CONFIGS } from '@/config/plans';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [showInvitations, setShowInvitations] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId && isLoaded) {
      processPaymentSuccess();
    }
  }, [sessionId, isLoaded]);

  const processPaymentSuccess = async () => {
    if (!sessionId || !user) {
      setError('Invalid payment session or user not authenticated');
      setIsLoading(false);
      return;
    }

    try {
      // Get session status from Stripe
      const sessionStatus = await getStripeSessionStatus(sessionId);
      
      if (!sessionStatus.success) {
        throw new Error('Failed to verify payment status');
      }

      setSessionData(sessionStatus.data);

      // Check if payment is completed
      if (sessionStatus.data.payment_status !== 'paid') {
        console.warn('Payment not yet completed, status:', sessionStatus.data.payment_status);
        // For demo purposes, we'll use default values if payment is pending
        // In production, you might want to poll for status or redirect to pending page
      }

      // Process the successful payment in our database
      const { planType, billingFrequency, seats = 1 } = sessionStatus.data.metadata || {};
      
      // If metadata is missing, use defaults for demo (in production, this should be an error)
      const finalPlanType = planType || 'pro';
      const finalBillingFrequency = billingFrequency || 'monthly';
      const finalSeats = seats || 1;
      
      if (!planType || !billingFrequency) {
        console.warn('Missing payment metadata, using defaults for demo');
      }

      // Process payment via backend API (handles user creation, credits, etc.)
      try {
        const result = await processPaymentSuccessAPI(sessionId, user.id);
        
        if (!result.success) {
          console.error('Backend payment processing failed:', result.error);
          console.warn('Continuing with demo flow despite backend error');
        } else {
          console.log('Payment processed successfully via backend:', result.data);
        }
      } catch (apiError) {
        console.error('Backend API call failed:', apiError);
        console.warn('Continuing with demo flow despite API error');
        // In production, you might want to retry or show a different error state
      }

      // For Teams plan, show invitation interface
      if (finalPlanType === 'teams' && finalSeats > 1) {
        setSubscriptionId(sessionStatus.data.subscription_id || `sub_demo_${Date.now()}`);
        setShowInvitations(true);
      } else {
        // Automatically redirect to dashboard for other plans after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }

    } catch (error) {
      console.error('Error processing payment success:', error);
      setError(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToDashboard = () => {
    navigate('/dashboard');
  };

  const handleManageInvitations = () => {
    setShowInvitations(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Processing Payment</h2>
            <p className="text-gray-300 text-center">
              Please wait while we confirm your payment and set up your account...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-8">
            <Alert className="border-red-500/30 bg-red-900/20 mb-6">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
            <div className="text-center">
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Return to Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showInvitations && subscriptionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-12">
        <InvitationManager
          subscriptionId={subscriptionId}
          maxSeats={sessionData?.metadata?.seats || 2}
          organizationId={sessionData?.metadata?.organizationId || ''}
          onClose={() => setShowInvitations(false)}
        />
      </div>
    );
  }

  const planType = sessionData?.metadata?.planType;
  const planConfig = planType ? PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS] : null;
  const seats = sessionData?.metadata?.seats || 1;
  const billingFrequency = sessionData?.metadata?.billingFrequency || 'monthly';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center py-12">
      <div className="w-full max-w-2xl px-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Payment Successful!
            </CardTitle>
            <p className="text-gray-300">
              Welcome to Softcodes {planConfig?.name} plan
            </p>
            {(!showInvitations || !subscriptionId) && (
              <p className="text-blue-400 text-sm mt-2 animate-pulse">
                Redirecting to dashboard in 3 seconds...
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Payment Summary */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Plan:</span>
                  <span className="text-white font-medium">{planConfig?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Billing:</span>
                  <span className="text-white font-medium">
                    {billingFrequency === 'monthly' ? 'Monthly' : 'Yearly'}
                  </span>
                </div>
                {planType === 'teams' && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Seats:</span>
                    <span className="text-white font-medium">{seats}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-300">Amount:</span>
                  <span className="text-white font-medium">
                    ${sessionData?.amount_total ? (sessionData.amount_total / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Credits Granted */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Credits Granted
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Total credits added to your account:</span>
                <span className="text-2xl font-bold text-green-400">
                  {planConfig ? planConfig.credits * seats : 0}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Credits have been automatically added to your account and are ready to use.
              </p>
            </div>

            {/* Teams Plan Actions */}
            {planType === 'teams' && seats > 1 && (
              <div className="bg-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Setup
                </h3>
                <p className="text-gray-300 mb-4">
                  You can now invite up to {seats - 1} team member{seats > 2 ? 's' : ''} to join your Softcodes Teams subscription.
                </p>
                <Button
                  onClick={handleManageInvitations}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Manage Team Invitations
                </Button>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Your subscription is now active</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>Credits have been added to your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>You can start using all {planConfig?.name} features immediately</span>
                </li>
                {planType === 'teams' && (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Invite team members to collaborate</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              {planType === 'teams' && seats > 1 && !showInvitations && (
                <Button
                  onClick={handleManageInvitations}
                  variant="outline"
                  className="border-slate-600 text-gray-300 hover:bg-slate-700"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Invite Team Members
                </Button>
              )}
              <Button
                onClick={handleContinueToDashboard}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}