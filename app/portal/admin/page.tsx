'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';

export default function AdminPortalPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.judge.isAdmin) {
          localStorage.setItem('adminSession', JSON.stringify(result.judge));
          router.push('/admin');
        } else if (result.success && !result.judge.isAdmin) {
          setError('Admin access required. Judges should use the Judge Portal.');
        } else {
          setError(result.error || 'Authentication failed');
        }
      } else {
        const error = await response.json();
        setError(error.error || 'Authentication failed');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 relative overflow-hidden">
      {/* Geometric Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-48 h-48 sm:w-64 sm:h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-1/4 left-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        </div>
      </div>

      {/* Circuit Pattern */}
      <div className="absolute inset-0 opacity-20 hidden sm:block">
        <svg className="w-full h-full" viewBox="0 0 1000 1000" fill="none">
          <defs>
            <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="2" fill="currentColor" className="text-emerald-400"/>
              <circle cx="25" cy="25" r="1" fill="currentColor" className="text-cyan-400"/>
              <circle cx="75" cy="75" r="1" fill="currentColor" className="text-teal-400"/>
              <line x1="50" y1="50" x2="25" y2="25" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
              <line x1="50" y1="50" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit)"/>
        </svg>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 pb-safe-bottom">
        {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
        <style jsx global>{`
          @supports(padding: max(0px)) {
            .pb-safe-bottom {
              padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
            }
          }
          
          /* Fallback for older browsers */
          @media screen and (max-width: 640px) {
            .pb-safe-bottom {
              padding-bottom: 120px;
            }
          }
          
          /* iPhone specific adjustments */
          @media screen and (max-width: 414px) and (min-height: 800px) {
            .pb-safe-bottom {
              padding-bottom: 140px;
            }
          }
        `}</style>
        <div className="max-w-md w-full">
          {/* Logo Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg sm:rounded-xl mb-4 sm:mb-6 shadow-2xl shadow-emerald-500/20 transform rotate-45">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Control</h1>
            <p className="text-emerald-300 text-sm sm:text-base px-4">System Administration Portal</p>
          </div>

          {/* Login Card */}
          <div className="relative bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-6 sm:p-8 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl sm:rounded-2xl"></div>
            
            {/* Security Badge */}
            <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs px-3 sm:px-4 py-1 rounded-full font-bold shadow-lg">
                RESTRICTED ACCESS
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="relative z-10 space-y-5 sm:space-y-6 mt-3 sm:mt-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-emerald-200 mb-2">
                  Administrator Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-3 border border-white/20 rounded-lg sm:rounded-xl bg-white/5 backdrop-blur-sm text-white placeholder-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 text-sm"
                    placeholder="admin@competition.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-emerald-200 mb-2">
                  Secure Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-3 border border-white/20 rounded-lg sm:rounded-xl bg-white/5 backdrop-blur-sm text-white placeholder-emerald-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 text-sm"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-200 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl backdrop-blur-sm flex items-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl hover:from-emerald-600 hover:to-cyan-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-lg hover:shadow-emerald-500/25 hover:scale-105 transform text-sm"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="relative">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-4 h-4 sm:w-5 sm:h-5 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
                    </div>
                    <span className="font-semibold">Authenticating...</span>
                  </div>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Authenticate & Enter
                  </span>
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-6 text-center">
              <ForgotPasswordLink userType="admin" />
            </div>


          </div>

          {/* Security Notice */}
          <div className="text-center mt-6 sm:mt-8">
            <div className="inline-flex items-center text-amber-400 text-sm mb-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Authorized Personnel Only
            </div>
            <p className="text-cyan-300/60 text-xs px-4">
              This system is monitored. Unauthorized access is prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 