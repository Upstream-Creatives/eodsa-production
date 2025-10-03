'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CertificateData {
  dancerName: string;
  percentage: number;
  style: string;
  title: string;
  medallion: string;
  date: string;
}

export default function CertificatePage() {
  const params = useParams();
  const performanceId = params?.performanceId as string;
  const [certificateData, setCertificateData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCertificateData = async () => {
      try {
        const response = await fetch(`/api/certificates/${performanceId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load certificate');
        }

        setCertificateData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load certificate');
      } finally {
        setLoading(false);
      }
    };

    if (performanceId) {
      fetchCertificateData();
    }
  }, [performanceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading certificate...</div>
      </div>
    );
  }

  if (error || !certificateData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p>{error || 'Certificate not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="relative w-full h-full max-w-[90vw] max-h-[90vh]" style={{ aspectRatio: '904/1280' }}>
        {/* Background Image */}
        <img
          src="/Template.jpg"
          alt="Certificate Template"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Text Overlays */}
        <div className="absolute inset-0">
          {/* Dancer Name - Center */}
          <div
            className="absolute text-white font-bold text-center uppercase tracking-wider"
            style={{
              top: '30.5%',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 'clamp(32px, 5.5vw, 70px)',
              letterSpacing: '0.08em',
              width: '85%'
            }}
          >
            {certificateData.dancerName}
          </div>

          {/* Percentage - Left Side */}
          <div
            className="absolute text-white font-bold"
            style={{
              top: '61.5%',
              left: '14%',
              fontSize: 'clamp(50px, 8vw, 120px)',
            }}
          >
            {certificateData.percentage}%
          </div>

          {/* Style - Right Side Top */}
          <div
            className="absolute text-white font-bold uppercase"
            style={{
              top: '64%',
              left: '50%',
              fontSize: 'clamp(20px, 3.2vw, 48px)',
            }}
          >
            STYLE: {certificateData.style}
          </div>

          {/* Title - Right Side Middle */}
          <div
            className="absolute text-white font-bold uppercase"
            style={{
              top: '70%',
              left: '50%',
              fontSize: 'clamp(20px, 3.2vw, 48px)',
            }}
          >
            TITLE: {certificateData.title}
          </div>

          {/* Medallion - Right Side Bottom */}
          <div
            className="absolute text-white font-bold uppercase"
            style={{
              top: '82%',
              left: '50%',
              fontSize: 'clamp(20px, 3.2vw, 48px)',
            }}
          >
            MEDALLION: {certificateData.medallion}
          </div>

          {/* Date - Bottom Right */}
          <div
            className="absolute text-white"
            style={{
              bottom: '11.5%',
              right: '18%',
              fontSize: 'clamp(16px, 2.2vw, 32px)',
            }}
          >
            {certificateData.date}
          </div>
        </div>

        {/* Download Button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-colors"
          >
            Download / Print
          </button>
        </div>
      </div>
    </div>
  );
}
