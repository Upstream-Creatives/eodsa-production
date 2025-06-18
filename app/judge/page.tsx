'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JudgeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect after 3 seconds
    const timer = setTimeout(() => {
      router.push('/portal/judge');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <span className="text-white text-2xl">⚖️</span>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">Judge Portal</h2>
        <p className="text-gray-300 mb-6">
          Redirecting you to the judge login portal...
        </p>
        
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-6"></div>
        
        <div className="space-y-3">
          <Link 
            href="/portal/judge"
            className="block w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 font-semibold"
          >
            Go to Judge Portal Now
          </Link>
          
          <Link 
            href="/"
            className="block w-full px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:border-gray-500 transition-all duration-300 font-semibold"
          >
            Back to Home
          </Link>
        </div>
        
        <div className="mt-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-blue-300 text-sm">
            💡 <strong>Tip:</strong> Bookmark <code>/portal/judge</code> for direct access to the judge login.
          </p>
        </div>
      </div>
    </div>
  );
} 