'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DancerLoginPage() {
  const [formData, setFormData] = useState({
    eodsaId: '',
    nationalId: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate National ID to only accept numbers
    if (name === 'nationalId') {
      // Remove any non-numeric characters
      const numericValue = value.replace(/\D/g, '');
      // Limit to 13 digits (South African ID length)
      const limitedValue = numericValue.slice(0, 13);
      
      setFormData(prev => ({
        ...prev,
        [name]: limitedValue
      }));
      if (error) setError('');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/dancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store session data
        localStorage.setItem('dancerSession', JSON.stringify({
          id: data.dancer.id,
          name: data.dancer.name,
          eodsaId: data.dancer.eodsaId,
          approved: data.dancer.approved,
          email: data.dancer.email
        }));

        router.push('/dancer-dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mb-6 shadow-xl">
            <span className="text-white text-3xl">💃</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Dancer Portal
          </h1>
                          <p className="text-gray-300 font-medium text-lg">Avalon</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-700/30">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-8 py-6 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white text-center">Welcome Back</h2>
            <p className="text-gray-300 text-center mt-1">Access your dancer dashboard</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="eodsaId" className="block text-sm font-semibold text-gray-300 mb-3">
                  EODSA ID
                </label>
                <input
                  type="text"
                  id="eodsaId"
                  name="eodsaId"
                  value={formData.eodsaId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-4 border-2 border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium text-white placeholder-gray-400"
                  placeholder="E123456"
                  required
                />
              </div>

              <div>
                <label htmlFor="nationalId" className="block text-sm font-semibold text-gray-300 mb-3">
                  National ID Number
                </label>
                <input
                  type="text"
                  id="nationalId"
                  name="nationalId"
                  value={formData.nationalId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-4 border-2 border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium text-white placeholder-gray-400"
                  placeholder="13 digit ID number"
                  maxLength={13}
                  inputMode="numeric"
                  title="Please enter exactly 13 digits"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/30 text-red-200 px-4 py-3 rounded-xl font-medium animate-slideIn">
                  <div className="flex items-center space-x-2">
                    <span>❌</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold text-lg"
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
                    <span>💃</span>
                    <span>Access Dashboard</span>
                  </div>
                )}
              </button>
            </form>

            {/* Registration Link */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm mb-4">
                Don't have an account yet?
              </p>
              <Link
                href="/register"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
              >
                <span>➕</span>
                <span>Register as Dancer</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm font-medium">
            Secure dancer portal for EODSA
          </p>
          <div className="flex items-center justify-center mt-4 space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400">System Online</span>
          </div>
          
          <div className="mt-4">
            <Link 
              href="/"
              className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              ← Back to Home
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