'use client';

import { useState } from 'react';

interface ForgotPasswordLinkProps {
  userType: 'judge' | 'admin' | 'studio' | 'announcer' | 'registration' | 'media' | 'backstage';
}

export default function ForgotPasswordLink({ userType }: ForgotPasswordLinkProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    try {
      // Use different API endpoints based on user type
      const apiEndpoint = userType === 'studio' 
        ? '/api/auth/studio-forgot-password' 
        : '/api/auth/forgot-password';
      
      const requestBody = userType === 'studio' 
        ? { email } 
        : { email, userType };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setEmail('');
        // Close modal after 5 seconds
        setTimeout(() => {
          setShowModal(false);
          setMessage('');
        }, 5000);
      } else {
        setError(data.error || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setEmail('');
    setError('');
    setMessage('');
  };

  const getUserTypeDisplay = () => {
    switch (userType) {
      case 'studio': return 'Studio';
      case 'admin': return 'Admin';
      case 'judge': return 'Judge';
      default: return 'User';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="text-purple-400 hover:text-purple-300 text-sm transition-colors font-medium underline"
      >
        Forgot your password?
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md border border-gray-700/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {userType === 'studio' ? 'Recover Password' : 'Reset Password'}
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-gray-300 mb-4">
              {userType === 'studio' 
                ? "Enter your studio email address and we'll send you your password directly."
                : `Enter your ${getUserTypeDisplay().toLowerCase()} email address and we'll send you a link to reset your password.`
              }
            </p>

            {message ? (
              <div className="bg-green-900/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl mb-4">
                <div className="flex items-center space-x-2">
                  <span>✅</span>
                  <span className="text-sm">{message}</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-gray-200 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="reset-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-gray-400"
                    placeholder={`Enter your ${getUserTypeDisplay().toLowerCase()} email`}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <span>❌</span>
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="relative">
                          <div className="w-4 h-4 border-2 border-white/30 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-4 h-4 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
                        </div>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      userType === 'studio' ? 'Send Password' : 'Send Reset Link'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
} 