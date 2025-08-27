'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

interface PaymentDetails {
  payment_id: string;
  entry_id: string;
  event_id: string;
  event_name: string;
  entry_title: string;
  amount: number;
  status: string;
  created_at: string;
}

function PaymentCancelledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState(0);

  // Get payment ID from URL parameters
  const paymentId = searchParams.get('payment_id') || searchParams.get('m_payment_id');

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetails(paymentId);
    } else {
      setIsLoading(false);
    }
  }, [paymentId]);

  const fetchPaymentDetails = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/status?payment_id=${paymentId}`);
      const data = await response.json();

      if (data.success) {
        setPaymentDetails(data.payment);
      }
    } catch (err) {
      console.error('Payment details fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!paymentDetails) return;

    setRetryAttempts(prev => prev + 1);
    
    // Redirect to payment initiation with the same entry
    const paymentUrl = `/api/payments/initiate?entryId=${paymentDetails.entry_id}&eventId=${paymentDetails.event_id}`;
    window.location.href = paymentUrl;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">Loading Payment Status...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-orange-600 text-4xl">⚠️</span>
          </div>

          {/* Main Message */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your payment was cancelled or could not be processed. Your competition entry is still pending payment.
          </p>

          {/* Payment Details */}
          {paymentDetails && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-800 mb-4">Entry Details</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Entry:</span>
                  <span className="font-medium">{paymentDetails.entry_title}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Event:</span>
                  <span className="font-medium">{paymentDetails.event_name}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Due:</span>
                  <span className="font-medium text-orange-600">R{paymentDetails.amount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                    Payment Required
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-800 mb-2">📋 Important Information</h4>
            <ul className="text-sm text-yellow-700 text-left space-y-1">
              <li>• Your entry has been saved but is not yet confirmed</li>
              <li>• Payment must be completed to participate in the competition</li>
              <li>• You can retry payment at any time before the deadline</li>
              <li>• Your entry slot is reserved for 24 hours</li>
            </ul>
          </div>

          {/* Common Reasons */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-semibold text-blue-800 mb-2">🔍 Common Reasons for Payment Issues</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Insufficient funds in account</li>
              <li>• Internet connection interrupted</li>
              <li>• Payment method declined by bank</li>
              <li>• Browser session timed out</li>
              <li>• User cancelled payment manually</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Retry Payment - Primary Action */}
            {paymentDetails && (
              <button
                onClick={handleRetryPayment}
                disabled={retryAttempts >= 3}
                className={`block w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  retryAttempts >= 3
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {retryAttempts >= 3 ? 'Max Retries Reached' : '💳 Retry Payment'}
              </button>
            )}

            {/* Secondary Actions */}
            <div className="flex space-x-3">
              <Link 
                href="/admin"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm text-center transition-colors"
              >
                Dashboard
              </Link>
              
              <Link 
                href="/dancer-dashboard"
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm text-center transition-colors"
              >
                My Entries
              </Link>
            </div>

            {/* Alternative Payment Methods */}
            <div className="border-t pt-4 mt-6">
              <h5 className="font-semibold text-gray-700 mb-3">💡 Alternative Payment Options</h5>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  Having trouble with online payment? Contact us for alternative payment methods:
                </p>
                <div className="bg-gray-100 rounded p-3 text-left">
                  <p><strong>Email:</strong> payments@avaloncompetition.com</p>
                  <p><strong>Phone:</strong> +27 12 345 6789</p>
                  <p><strong>WhatsApp:</strong> +27 82 123 4567</p>
                </div>
              </div>
            </div>
          </div>

          {/* Support Link */}
          <p className="text-xs text-gray-500 mt-6">
            Need help? <Link href="/contact" className="text-blue-600 hover:underline">Contact Support</Link> | 
            <Link href="/payment-help" className="text-blue-600 hover:underline ml-2">Payment Help</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">Loading payment details...</h2>
          </div>
        </div>
      </div>
    }>
      <PaymentCancelledContent />
    </Suspense>
  );
}
