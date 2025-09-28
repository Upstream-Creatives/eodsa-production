'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';

export default function JudgeLogin() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store session data
        localStorage.setItem('judgeSession', JSON.stringify({
          id: data.judge.id,
          name: data.judge.name,
          email: data.judge.email,
          isAdmin: data.judge.isAdmin
        }));

        // Redirect based on role
        if (data.judge.isAdmin) {
          // Redirect admin users to the admin portal instead
          setError('Admin users should use the Admin Portal. Redirecting...');
          setTimeout(() => {
            router.push('/portal/admin');
          }, 2000);
          return;
        } else {
        router.push('/judge/dashboard');
        }
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-xl">
            <span className="text-white text-3xl font-bold">E</span>
      </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            EODSA Portal
          </h1>
          <p className="text-gray-700 font-medium text-lg">Competition Management System</p>
      </div>

        {/* Enhanced Login Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/30">
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-8 py-6 border-b border-indigo-100">
            <h2 className="text-2xl font-bold text-gray-900 text-center">Sign In</h2>
            <p className="text-gray-700 text-center mt-1">Access your judging dashboard</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-3">
                  Email Address
                </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                    placeholder="judge@competition.com"
                    required
                  />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3">
                  Password
                </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-4 py-4 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
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
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold text-lg"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="relative">
                      <div className="w-5 h-5 border-2 border-white/30 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-5 h-5 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
                    </div>
                    <span className="font-semibold">Signing you in...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span>🔐</span>
                    <span>Sign In</span>
                  </div>
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-6 text-center">
              <ForgotPasswordLink userType="judge" />
            </div>
            </div>
          </div>

        {/* Enhanced Footer */}
          <div className="text-center mt-8">
          <p className="text-gray-700 text-sm font-medium">
            Secure competition management for EODSA
            </p>
          <div className="flex items-center justify-center mt-4 space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-700">System Online</span>
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