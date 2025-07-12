'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');
  const [userType, setUserType] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const typeParam = searchParams.get('type');
    
    if (!tokenParam || !typeParam) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }
    
    setToken(tokenParam);
    setUserType(typeParam);
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate password strength in real-time
    if (name === 'newPassword') {
      if (value.length < 8) {
        setError('Password must be at least 8 characters long');
      } else if (!/[A-Z]/.test(value)) {
        setError('Password must contain at least one uppercase letter');
      } else if (!/[a-z]/.test(value)) {
        setError('Password must contain at least one lowercase letter');
      } else if (!/[0-9]/.test(value)) {
        setError('Password must contain at least one number');
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      } else {
        setError('');
      }
    } else {
      // Clear error when user starts typing in other fields
      if (error) setError('');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(formData.newPassword)) {
      setError('Password must contain at least one uppercase letter');
      setIsLoading(false);
      return;
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(formData.newPassword)) {
      setError('Password must contain at least one lowercase letter');
      setIsLoading(false);
      return;
    }
    
    // Check for number
    if (!/[0-9]/.test(formData.newPassword)) {
      setError('Password must contain at least one number');
      setIsLoading(false);
      return;
    }
    
    // Check for special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword)) {
      setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: formData.newPassword
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Redirect to appropriate login page after 3 seconds
        setTimeout(() => {
          if (userType === 'studio') {
            router.push('/studio-login');
          } else if (userType === 'admin') {
            router.push('/portal/admin');
          } else {
            router.push('/portal/judge');
          }
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserTypeDisplay = () => {
    switch (userType) {
      case 'studio': return 'Studio';
      case 'admin': return 'Admin';
      case 'judge': return 'Judge';
      default: return 'User';
    }
  };

  if (!token || !userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl mb-6 shadow-xl">
              <span className="text-white text-3xl">⚠️</span>
            </div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent mb-2">
              Invalid Link
            </h1>
            <p className="text-gray-700 font-medium text-lg">Password reset link is invalid or expired</p>
          </div>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/30 p-8">
            <p className="text-gray-600 text-center mb-6">
              This password reset link is invalid or has expired. Please request a new password reset.
            </p>
            
            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
              >
                <span>🏠</span>
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-6 shadow-xl">
              <span className="text-white text-3xl">✅</span>
            </div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              Success!
            </h1>
            <p className="text-gray-700 font-medium text-lg">Your password has been reset</p>
          </div>
          
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/30 p-8">
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                Your password has been successfully reset. You will be redirected to the login page in a few seconds.
              </p>
              
              <div className="flex items-center justify-center space-x-3 mb-6">
                <div className="relative">
                  <div className="w-5 h-5 border-2 border-green-300 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-5 h-5 border-2 border-transparent border-t-green-600 rounded-full animate-spin"></div>
                </div>
                <span className="text-green-600 font-medium">Redirecting...</span>
              </div>
              
              <Link
                href={userType === 'studio' ? '/studio-login' : userType === 'admin' ? '/portal/admin' : '/portal/judge'}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
              >
                <span>🔐</span>
                <span>Login Now</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-xl">
            <span className="text-white text-3xl">🔐</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Reset Password
          </h1>
          <p className="text-gray-700 font-medium text-lg">{getUserTypeDisplay()} Account Recovery</p>
        </div>

        {/* Reset Form */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/30">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-8 py-6 border-b border-blue-100">
            <h2 className="text-2xl font-bold text-gray-900 text-center">Set New Password</h2>
            <p className="text-gray-700 text-center mt-1">Enter your new secure password</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-3">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-3">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium animate-slideIn">
                  <div className="flex items-center space-x-2">
                    <span>❌</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold text-lg"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="relative">
                      <div className="w-5 h-5 border-2 border-white/30 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-5 h-5 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
                    </div>
                    <span className="font-semibold">Resetting Password...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span>🔐</span>
                    <span>Reset Password</span>
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-700 text-sm font-medium">
            Remember your password?
          </p>
          <div className="flex items-center justify-center mt-4 space-x-4">
            <Link 
              href={userType === 'studio' ? '/studio-login' : userType === 'admin' ? '/portal/admin' : '/portal/judge'}
              className="text-blue-600 hover:text-blue-500 text-sm transition-colors font-medium"
            >
              ← Back to Login
            </Link>
            <span className="text-gray-300">|</span>
            <Link 
              href="/"
              className="text-blue-600 hover:text-blue-500 text-sm transition-colors font-medium"
            >
              Home
            </Link>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-xl">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-white/30 rounded-full"></div>
              <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-700">Loading...</h1>
          <p className="text-gray-500 mt-2">Preparing password reset</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
} 