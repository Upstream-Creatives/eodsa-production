'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function TestCertificateContent() {
  const searchParams = useSearchParams();
  const eventIdFromUrl = searchParams.get('eventId') || '';
  
  const [formData, setFormData] = useState({
    dancerName: 'ANGELO SOLIS',
    percentage: 92,
    style: 'CONTEMPORARY',
    title: 'RISING PHOENIX',
    medallion: 'GOLD',
    date: '4 October 2025',
    email: 'solisangelo882@gmail.com',
    eventId: eventIdFromUrl // Optional: event ID for custom template
  });
  
  const [events, setEvents] = useState<Array<{id: string; name: string}>>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  
  // Fetch events on mount
  useEffect(() => {
    setLoadingEvents(true);
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.events) {
          setEvents(data.events);
        }
      })
      .catch(err => {
        console.error('Error fetching events:', err);
      })
      .finally(() => {
        setLoadingEvents(false);
      });
  }, []);
  
  // Update eventId if provided in URL
  useEffect(() => {
    if (eventIdFromUrl) {
      setFormData(prev => {
        if (prev.eventId !== eventIdFromUrl) {
          return { ...prev, eventId: eventIdFromUrl };
        }
        return prev;
      });
    }
  }, [eventIdFromUrl]);

  const [showCertificate, setShowCertificate] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreview = () => {
    setShowCertificate(true);
    setSendResult(null);
  };

  const handleSendEmail = async () => {
    setSending(true);
    setSendResult(null);

    try {
      const response = await fetch('/api/certificates/test/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setSendResult({
          success: true,
          message: `✅ Certificate sent successfully to ${formData.email}!`
        });
      } else {
        setSendResult({
          success: false,
          message: `❌ Failed to send: ${result.error}`
        });
      }
    } catch (error) {
      setSendResult({
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setSending(false);
    }
  };

  const buildImageUrl = () => {
    const params = new URLSearchParams({
      dancerName: formData.dancerName,
      percentage: formData.percentage.toString(),
      style: formData.style,
      title: formData.title,
      medallion: formData.medallion,
      date: formData.date
    });
    // Add eventId if provided
    if (formData.eventId) {
      params.append('eventId', formData.eventId);
    }
    return `/api/certificates/test/image?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🧪 Certificate Test Simulator</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Certificate Details</h2>

            <div className="space-y-4">
              {/* Dancer Name */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Dancer Name
                </label>
                <input
                  type="text"
                  value={formData.dancerName}
                  onChange={(e) => handleInputChange('dancerName', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="ANGELO SOLIS"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="dancer@example.com"
                />
              </div>

              {/* Percentage */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Percentage Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percentage}
                  onChange={(e) => handleInputChange('percentage', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Style */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Dance Style
                </label>
                <input
                  type="text"
                  value={formData.style}
                  onChange={(e) => handleInputChange('style', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="CONTEMPORARY"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Performance Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="RISING PHOENIX"
                />
              </div>

              {/* Medallion */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Medallion
                </label>
                <select
                  value={formData.medallion}
                  onChange={(e) => handleInputChange('medallion', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                  <option value="BRONZE">Bronze</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Date
                </label>
                <input
                  type="text"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="4 October 2025"
                />
              </div>

              {/* Event ID (for custom template) */}
              <div>
                <label className="block text-white text-sm font-bold mb-2">
                  Event ID (Optional - for custom template)
                </label>
                <div className="relative">
                  <select
                    value={formData.eventId}
                    onChange={(e) => handleInputChange('eventId', e.target.value)}
                    disabled={loadingEvents}
                    className={`w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                      loadingEvents ? 'opacity-50 cursor-wait' : ''
                    }`}
                  >
                    <option value="">
                      {loadingEvents ? 'Loading events...' : 'Use Default Template'}
                    </option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                  {loadingEvents && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {loadingEvents 
                    ? 'Loading events...' 
                    : 'Select an event to use its custom certificate template'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handlePreview}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                >
                  Preview Certificate
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>

              {/* Send Result */}
              {sendResult && (
                <div className={`p-4 rounded-lg ${sendResult.success ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'}`}>
                  {sendResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Certificate Preview</h2>

            {showCertificate ? (
              <div className="relative w-full" style={{ aspectRatio: '904/1280' }}>
                <img
                  src={buildImageUrl()}
                  alt="Certificate Preview"
                  className="w-full h-full object-contain"
                />
                <a
                  href={buildImageUrl()}
                  download="certificate.jpg"
                  className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-colors inline-block"
                >
                  Download
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-600 rounded-lg">
                <div className="text-center">
                  <p className="text-gray-400 text-lg mb-4">No preview yet</p>
                  <p className="text-gray-500 text-sm">Click "Preview Certificate" to see the result</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestCertificatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <TestCertificateContent />
    </Suspense>
  );
}
