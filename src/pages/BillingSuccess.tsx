import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, CreditCard, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BillingSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationData, setVerificationData] = useState<{
    credits?: number;
    amount?: number;
    currency?: string;
  } | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the payment session
        const response = await fetch(`/api/stripe/session-status?session_id=${sessionId}`);
        const data = await response.json();

        if (data.success && data.data?.payment_status === 'paid') {
          const metadata = data.data.metadata || {};
          setVerificationData({
            credits: parseInt(metadata.credits || '0'),
            amount: data.data.amount_total / 100, // Convert from cents
            currency: data.data.currency?.toUpperCase() || 'EUR'
          });
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        toast({
          title: "Verification Error",
          description: "Could not verify payment status, but your credits should be added shortly.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
        // Automatically redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    };

    verifyPayment();
  }, [sessionId, toast]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
        <Card className="bg-[#2a2a2a] border-white/10 p-8 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Verifying Payment...</h2>
          <p className="text-gray-400">Please wait while we confirm your credit purchase.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-4">
      <Card className="bg-[#2a2a2a] border-white/10 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-gray-400 mb-2">
          Your credit purchase has been processed successfully.
        </p>
        <p className="text-blue-400 text-sm mb-6 animate-pulse">
          Redirecting to dashboard in 3 seconds...
        </p>

        {verificationData && (
          <div className="bg-[#1a1a1a] rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-400 mb-1">Credits Added</div>
            <div className="text-2xl font-bold text-green-400 mb-1">
              +{verificationData.credits?.toLocaleString()} credits
            </div>
            <div className="text-sm text-gray-400">
              {verificationData.amount} {verificationData.currency}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link to="/dashboard">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Home className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>

          <Link to="/billing">
            <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
              <CreditCard className="w-4 h-4 mr-2" />
              View Billing History
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-gray-500">
            Credits are usually added instantly, but may take up to a few minutes to appear in your account.
            If you don't see them after 10 minutes, please contact support.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default BillingSuccess;