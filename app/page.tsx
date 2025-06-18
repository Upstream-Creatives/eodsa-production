'use client';

import Link from 'next/link';

export default function HomePage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Compact Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          {/* EODSA Logo Placeholder */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-2xl">
            <span className="text-white text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Element of Dance South Africa
          </h1>
          <p className="text-gray-300 text-lg">Competition Management Portal</p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
            <p className="text-gray-400">Choose your path to get started</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16 max-w-6xl mx-auto">
            {/* New User Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-indigo-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-indigo-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">👋</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">New User</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Register as a new dancer to participate in EODSA competitions.
              </p>
              <Link 
                href="/register"
                className="block w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
              >
                Start Registration
              </Link>
            </div>

            {/* Existing User Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-purple-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-purple-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">🎪</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Existing User</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Already have an EODSA ID? Enter it below to access the Event Dashboard.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter EODSA ID (e.g. E123456)"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  id="eodsa-id-input"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('eodsa-id-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      window.location.href = `/event-dashboard?eodsaId=${input.value.trim()}`;
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
                >
                  Enter Event Dashboard
                </button>
              </div>
            </div>

            {/* Studio Portal Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-green-500/30 p-6 text-center hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-green-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <span className="text-white text-2xl">🏢</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Studio Portal</h3>
              <p className="text-gray-300 mb-4 text-sm">
                Register your studio or access your studio dashboard to manage dancers.
              </p>
              <div className="space-y-2">
                <Link 
                  href="/studio-register"
                  className="block w-full px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
                >
                  Register Studio
                </Link>
                <Link 
                  href="/studio-login"
                  className="block w-full px-4 py-2 border-2 border-green-500 text-green-400 rounded-lg font-semibold hover:bg-green-500 hover:text-white transition-all duration-300 text-sm"
                >
                  Studio Login
                </Link>
              </div>
            </div>
          </div>

          {/* Additional Links */}
          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/portal/admin" className="text-blue-400 hover:text-blue-300 transition-colors">
                Admin Portal
              </Link>
              <span className="text-gray-600">•</span>
              <Link href="/portal/judge" className="text-green-400 hover:text-green-300 transition-colors">
                Judge Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
