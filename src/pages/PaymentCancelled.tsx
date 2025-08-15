import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  XCircle, 
  ArrowLeft, 
  RefreshCw, 
  HelpCircle,
  CreditCard,
  MessageCircle
} from 'lucide-react';

export default function PaymentCancelled() {
  const navigate = useNavigate();

  const handleRetryPayment = () => {
    navigate('/pricing');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleContactSupport = () => {
    // In a real app, this would open a support chat or email
    window.open('mailto:support@softcodes.com?subject=Payment Issue', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center py-12">
      <div className="w-full max-w-2xl px-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Payment Cancelled
            </CardTitle>
            <p className="text-gray-300">
              Your payment was cancelled and no charges were made
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Information Alert */}
            <Alert className="border-yellow-500/30 bg-yellow-900/20">
              <HelpCircle className="w-4 h-4" />
              <AlertDescription className="text-yellow-300">
                Don't worry! Your payment was safely cancelled and no charges were processed. 
                You can try again at any time.
              </AlertDescription>
            </Alert>

            {/* What Happened */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What Happened?</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>The payment process was cancelled before completion</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>No charges were made to your payment method</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>Your account remains on the current plan</span>
                </li>
              </ul>
            </div>

            {/* Common Reasons */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Common Reasons for Cancellation</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• You clicked the back button or closed the payment window</li>
                <li>• You decided to review the plan details before purchasing</li>
                <li>• There was a temporary issue with your internet connection</li>
                <li>• You wanted to use a different payment method</li>
              </ul>
            </div>

            {/* Troubleshooting */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Having Payment Issues?
              </h3>
              <div className="space-y-3 text-gray-300 text-sm">
                <p>If you're experiencing payment difficulties, try these solutions:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Ensure your payment method has sufficient funds</li>
                  <li>• Check that your card details are entered correctly</li>
                  <li>• Try using a different payment method</li>
                  <li>• Disable any ad blockers or browser extensions</li>
                  <li>• Clear your browser cache and cookies</li>
                </ul>
              </div>
            </div>

            {/* Support Information */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Need Help?
              </h3>
              <p className="text-gray-300 mb-4">
                Our support team is here to help you with any payment or subscription questions.
              </p>
              <Button
                onClick={handleContactSupport}
                variant="outline"
                className="border-slate-600 text-gray-300 hover:bg-slate-600"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                onClick={handleRetryPayment}
                variant="outline"
                className="border-slate-600 text-gray-300 hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button
                onClick={handleGoBack}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>

            {/* Additional Help */}
            <div className="text-center pt-4 border-t border-slate-600">
              <p className="text-sm text-gray-400 mb-2">
                Still having trouble? We're here to help!
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
                <button
                  onClick={() => navigate('/pricing')}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  View All Plans
                </button>
                <span className="hidden sm:inline text-gray-500">•</span>
                <button
                  onClick={handleContactSupport}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Get Support
                </button>
                <span className="hidden sm:inline text-gray-500">•</span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}