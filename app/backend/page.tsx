'use client';

import Link from 'next/link';

export default function BackendDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          {/* EODSA Logo Placeholder */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-2xl">
            <span className="text-white text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Backend Dashboard
          </h1>
          <p className="text-gray-300 text-lg">Staff & Official Management Portal</p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          {/* Staff Portals */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-gray-500/30 p-6 mb-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Staff & Official Portals</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Link href="/portal/admin" className="flex flex-col items-center p-3 bg-blue-600/20 rounded-lg hover:bg-blue-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">👑</span>
                <span className="text-xs text-blue-400 font-medium">Admin Portal</span>
              </Link>
              <Link href="/portal/judge" className="flex flex-col items-center p-3 bg-green-600/20 rounded-lg hover:bg-green-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚖️</span>
                <span className="text-xs text-green-400 font-medium">Judge Portal</span>
              </Link>
              <Link href="/portal/backstage" className="flex flex-col items-center p-3 bg-purple-600/20 rounded-lg hover:bg-purple-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🎭</span>
                <span className="text-xs text-purple-400 font-medium">Backstage Manager</span>
              </Link>
              <Link href="/portal/announcer" className="flex flex-col items-center p-3 bg-orange-600/20 rounded-lg hover:bg-orange-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📢</span>
                <span className="text-xs text-orange-400 font-medium">Announcer Portal</span>
              </Link>
              <Link href="/portal/registration" className="flex flex-col items-center p-3 bg-teal-600/20 rounded-lg hover:bg-teal-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">✅</span>
                <span className="text-xs text-teal-400 font-medium">Registration Desk</span>
              </Link>
              <Link href="/portal/media" className="flex flex-col items-center p-3 bg-pink-600/20 rounded-lg hover:bg-pink-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📸</span>
                <span className="text-xs text-pink-400 font-medium">Media Portal</span>
              </Link>
              <Link href="/admin/sound-tech" className="flex flex-col items-center p-3 bg-indigo-600/20 rounded-lg hover:bg-indigo-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🎵</span>
                <span className="text-xs text-indigo-400 font-medium">Sound Tech</span>
              </Link>
              <Link href="/admin/notifications" className="flex flex-col items-center p-3 bg-emerald-600/20 rounded-lg hover:bg-emerald-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📧</span>
                <span className="text-xs text-emerald-400 font-medium text-center">Admin Notifications</span>
              </Link>
              <a
                href="https://www.avalondance.co.za/event-type-manager"
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center p-3 bg-yellow-500/20 rounded-lg hover:bg-yellow-500/30 transition-colors group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🗂️</span>
                <span className="text-xs text-yellow-300 font-medium text-center">Event Type Manager</span>
              </a>
            </div>
          </div>

          {/* Additional Admin Links */}
          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/admin/scoring-approval" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Score Approval System
              </Link>
            </div>
          </div>

          {/* Back to Main */}
          <div className="text-center mt-8">
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
            >
              ← Back to Main Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
