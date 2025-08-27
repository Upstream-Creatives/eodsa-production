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
  paid_at: string;
}

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entriesProcessed, setEntriesProcessed] = useState(false);
  const [processingEntries, setProcessingEntries] = useState(false);
  const [createdEntries, setCreatedEntries] = useState<any[]>([]);

  // Get payment ID from URL parameters or session storage
  const paymentId = searchParams.get('payment_id') || searchParams.get('m_payment_id');

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetails(paymentId);
    } else {
      // Check for payment data in session storage (stored during payment initiation)
      const sessionPaymentAmount = sessionStorage.getItem('paymentAmount');
      const sessionEventId = sessionStorage.getItem('paymentEventId');
      const sessionEventName = sessionStorage.getItem('paymentEventName');
      
      if (sessionPaymentAmount && sessionEventId) {
        // Show success message based on session data
        setPaymentDetails({
          payment_id: 'pending_verification',
          entry_id: '',
          event_id: sessionEventId,
          event_name: sessionEventName || 'Competition Entry',
          entry_title: 'Competition Entries',
          amount: parseFloat(sessionPaymentAmount),
          status: 'pending_verification',
          paid_at: new Date().toISOString()
        });
        setIsLoading(false);
        
        // Clear session data
        sessionStorage.removeItem('paymentAmount');
        sessionStorage.removeItem('paymentEventId');
        sessionStorage.removeItem('paymentEventName');
        sessionStorage.removeItem('pendingEntries');
      } else {
        setError('Payment verification in progress. Please check your dashboard for payment status.');
        setIsLoading(false);
      }
    }
  }, [paymentId]);

  const fetchPaymentDetails = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/status?payment_id=${paymentId}`);
      const data = await response.json();

      if (data.success) {
        setPaymentDetails(data.payment);
        
        // If payment is completed, check and process entries
        if (data.payment.status === 'completed' || data.payment.payment_status === 'COMPLETE') {
          await processEntriesAfterPayment(paymentId);
        }
      } else {
        setError(data.error || 'Failed to fetch payment details');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Payment details fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const processEntriesAfterPayment = async (paymentId: string) => {
    try {
      // First, check if entries were already processed
      const checkResponse = await fetch(`/api/payments/process-entries?payment_id=${paymentId}`);
      const checkData = await checkResponse.json();

      if (checkData.success && checkData.entries.length > 0) {
        // Entries already processed
        setCreatedEntries(checkData.entries);
        setEntriesProcessed(true);
        console.log('✅ Entries already processed:', checkData.entries);
        return;
      }

      // Get pending entries from session storage
      const pendingEntriesData = sessionStorage.getItem('pendingEntries');
      if (!pendingEntriesData) {
        console.log('ℹ️ No pending entries found in session storage');
        return;
      }

      const pendingEntries = JSON.parse(pendingEntriesData);
      if (!Array.isArray(pendingEntries) || pendingEntries.length === 0) {
        console.log('ℹ️ No valid pending entries to process');
        return;
      }

      setProcessingEntries(true);
      console.log('🔄 Processing entries after payment:', pendingEntries);

      // Process the entries
      const processResponse = await fetch('/api/payments/process-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          entries: pendingEntries
        }),
      });

      const processData = await processResponse.json();

      if (processData.success) {
        setCreatedEntries(processData.entries);
        setEntriesProcessed(true);
        
        // Clear session storage
        sessionStorage.removeItem('pendingEntries');
        sessionStorage.removeItem('paymentAmount');
        sessionStorage.removeItem('paymentEventId');
        sessionStorage.removeItem('paymentEventName');
        
        console.log('✅ Entries processed successfully:', processData.entries);
      } else {
        console.error('❌ Failed to process entries:', processData.error);
        setError(`Failed to create competition entries: ${processData.error}`);
      }

    } catch (err) {
      console.error('💥 Entry processing error:', err);
      setError('Failed to process competition entries after payment');
    } finally {
      setProcessingEntries(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">Verifying Payment...</h2>
            <p className="text-gray-600 mt-2">Please wait while we confirm your payment with PayFast.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-orange-600 text-2xl">⏳</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Payment Processing</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500 mb-6">Your payment may still be processing. The webhook notification will update your entry status automatically.</p>
            <div className="space-y-3">
              <Link 
                href="/admin"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Return to Dashboard
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="block w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Retry Verification
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-green-600 text-4xl">✅</span>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your competition entry payment has been processed successfully.
          </p>

          {/* Payment Details */}
          {paymentDetails && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-800 mb-4">Payment Details</h3>
              
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
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-green-600">R{paymentDetails.amount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID:</span>
                  <span className="font-mono text-xs">{paymentDetails.payment_id}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">
                    {new Date(paymentDetails.paid_at).toLocaleDateString('en-ZA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Entry Processing Status */}
          {processingEntries && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-500 border-t-transparent"></div>
                <div>
                  <h4 className="font-semibold text-yellow-800">🔄 Creating Your Entries</h4>
                  <p className="text-sm text-yellow-700">Processing your competition entries...</p>
                </div>
              </div>
            </div>
          )}

          {/* Created Entries Display */}
          {entriesProcessed && createdEntries.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-green-800 mb-3">🏆 Competition Entries Created</h4>
              <div className="space-y-2">
                {createdEntries.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
                    <div>
                      <span className="font-medium text-gray-800">{entry.itemName}</span>
                      <span className="text-gray-600 ml-2">({entry.performanceType})</span>
                    </div>
                    <span className="text-green-600 font-medium">✅ Created</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-green-700 mt-2">
                Entry IDs: {createdEntries.map(e => e.entryId).join(', ')}
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-800 mb-2">✨ What's Next?</h4>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              {entriesProcessed ? (
                <>
                  <li>• Your {createdEntries.length} competition {createdEntries.length === 1 ? 'entry is' : 'entries are'} now confirmed and active</li>
                  <li>• You'll receive a confirmation email shortly</li>
                  <li>• Check your dashboard for entry status updates</li>
                  <li>• Prepare for your competition performance!</li>
                </>
              ) : (
                <>
                  <li>• Your payment has been processed successfully</li>
                  <li>• Your competition entries are being created</li>
                  <li>• You'll receive confirmation once entries are ready</li>
                  <li>• Check your dashboard for status updates</li>
                </>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link 
              href="/admin"
              className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
            >
              🏆 Go to Dashboard
            </Link>
            
            <div className="flex space-x-3">
              <Link 
                href="/dancer-dashboard"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
              >
                My Entries
              </Link>
              
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
              >
                Print Receipt
              </button>
            </div>
          </div>

          {/* Support Link */}
          <p className="text-xs text-gray-500 mt-6">
            Need help? <Link href="/contact" className="text-blue-600 hover:underline">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800">Loading payment details...</h2>
          </div>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
