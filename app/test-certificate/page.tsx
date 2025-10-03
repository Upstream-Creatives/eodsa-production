'use client';

import { useState } from 'react';

export default function TestCertificatePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: 'solisangelo882@gmail.com',
    dancerName: 'Angelo Solis',
    percentage: 92,
    style: 'Contemporary',
    title: 'Rising Phoenix'
  });

  const sendTestCertificate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/certificates/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send certificate');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 Test Certificate Generator
          </h1>
          <p className="text-gray-600 mb-6">
            Generate and send a test certificate to preview the email and certificate design.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="recipient@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dancer Name
              </label>
              <input
                type="text"
                value={formData.dancerName}
                onChange={(e) => setFormData({ ...formData, dancerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Percentage Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="85"
              />
              <p className="text-xs text-gray-500 mt-1">
                Gold: 85%+, Silver: 75%+, Bronze: 65%+
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dance Style
              </label>
              <input
                type="text"
                value={formData.style}
                onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Contemporary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Performance Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Rising Phoenix"
              />
            </div>
          </div>

          <button
            onClick={sendTestCertificate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-bold text-lg shadow-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '📧 Sending...' : '📧 Send Test Certificate'}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-bold">❌ Error</p>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
              <p className="font-bold mb-2">✅ Success!</p>
              <div className="text-sm space-y-1">
                <p><strong>Sent to:</strong> {result.data?.recipient}</p>
                <p><strong>Dancer:</strong> {result.data?.dancerName}</p>
                <p><strong>Score:</strong> {result.data?.percentage}%</p>
                <p><strong>Medal:</strong> {result.data?.medallion}</p>
                <p className="mt-2">
                  <a
                    href={result.data?.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    View Certificate Preview
                  </a>
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              📋 Quick Links
            </h2>
            <div className="space-y-2">
              <a
                href="/certificates/test"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-purple-600 hover:text-purple-800 underline"
              >
                → View Sample Certificate
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
