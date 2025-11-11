'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StudioProfileResponse {
  success: boolean;
  profile?: {
    studio: {
      id: string;
      name: string;
      email: string;
      contactPerson: string;
      phone: string;
      address: string;
      registrationNumber: string;
      approved: boolean;
      approvedBy: string | null;
      approvedAt: string | null;
      rejectionReason: string | null;
      createdAt: string;
    };
    dancers: Array<{
      id: string;
      eodsaId: string;
      name: string;
      age: number | null;
      dateOfBirth: string | null;
      masteryLevel: string | null;
      approved: boolean;
    }>;
    financial: {
      totalEntries: number;
      totalFeesInvoiced: number;
      totalPaid: number;
      totalOutstanding: number;
    };
    performance: {
      totalSolos: number;
      totalGroupEntries: number;
      averageScore: number;
      medalBreakdown: {
        gold: number;
        silver: number;
        bronze: number;
        other: number;
      };
    };
  };
  error?: string;
}

export default function AdminStudioProfilePage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const router = useRouter();
  // Use React's use() hook to handle Promise params in Next.js 15
  const resolvedParams = use(params);
  const studioId = resolvedParams.studioId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StudioProfileResponse['profile'] | null>(null);

  useEffect(() => {
    // Only run on client side and when studioId is available
    if (typeof window === 'undefined' || !studioId) return;

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        // Use absolute URL for client-side fetch
        const baseUrl = window.location.origin;
        const res = await fetch(`${baseUrl}/api/admin/studios/${encodeURIComponent(studioId)}/profile`, {
          cache: 'no-store',
        });

        // Check if response is ok and has content
        if (!res.ok) {
          const text = await res.text();
          let errorMessage = `Server error: ${res.status}`;
          try {
            const errorJson = JSON.parse(text);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }
          if (!cancelled) {
            setError(errorMessage);
            setLoading(false);
          }
          return;
        }

        // Get response text first to check if it's valid JSON
        const text = await res.text();
        if (!text || text.trim().length === 0) {
          if (!cancelled) {
            setError('Empty response from server');
            setLoading(false);
          }
          return;
        }

        let json: StudioProfileResponse;
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Response text:', text);
          if (!cancelled) {
            setError('Invalid response from server');
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          if (!json.success || !json.profile) {
            setError(json.error || 'Failed to load studio profile');
          } else {
            setData(json.profile);
          }
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Fetch error:', e);
        if (!cancelled) {
          setError(e?.message || 'Failed to load studio profile');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  if (loading || !studioId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading studio profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-400">{error || 'Studio profile could not be loaded.'}</p>
          <div className="mt-4">
            <button
              className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700"
              onClick={() => router.back()}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { studio, dancers, financial, performance } = data;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-200">
            ← Back to Admin
          </Link>
        </div>

        {/* Studio Overview Card */}
        <div className="rounded-2xl border border-gray-800 p-6 bg-gradient-to-br from-gray-900/70 to-gray-800/40">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">🏢 {studio.name}</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Registration Number</div>
                  <div className="text-white font-medium">{studio.registrationNumber}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Contact Person</div>
                  <div className="text-white font-medium">{studio.contactPerson}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Email</div>
                  <div className="text-white">{studio.email}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Phone</div>
                  <div className="text-white">{studio.phone || '—'}</div>
                </div>
                {studio.address && (
                  <div className="md:col-span-2">
                    <div className="text-gray-400 text-sm mb-1">Address</div>
                    <div className="text-white">{studio.address}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  studio.approved
                    ? 'bg-emerald-900/60 text-emerald-200'
                    : studio.rejectionReason
                    ? 'bg-red-900/60 text-red-200'
                    : 'bg-yellow-900/60 text-yellow-200'
                }`}
              >
                {studio.approved ? '✅ Approved' : studio.rejectionReason ? '❌ Rejected' : '⏳ Pending'}
              </div>
              {studio.approvedAt && (
                <div className="text-gray-400 text-xs mt-2">
                  Approved: {new Date(studio.approvedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Financial Metrics */}
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Entries</div>
            <div className="text-2xl font-bold text-white">{financial.totalEntries}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Fees Invoiced</div>
            <div className="text-2xl font-bold text-white">R{financial.totalFeesInvoiced.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Paid</div>
            <div className="text-2xl font-bold text-green-400">R{financial.totalPaid.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Outstanding</div>
            <div className="text-2xl font-bold text-yellow-400">R{financial.totalOutstanding.toLocaleString()}</div>
          </div>
        </div>

        {/* Performance Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Solos</div>
            <div className="text-2xl font-bold text-white">{performance.totalSolos}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Group Entries</div>
            <div className="text-2xl font-bold text-white">{performance.totalGroupEntries}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Average Score</div>
            <div className="text-2xl font-bold text-white">{performance.averageScore}%</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Medals</div>
            <div className="flex gap-2 mt-2">
              <span className="text-yellow-400">🥇 {performance.medalBreakdown.gold}</span>
              <span className="text-gray-300">🥈 {performance.medalBreakdown.silver}</span>
              <span className="text-amber-600">🥉 {performance.medalBreakdown.bronze}</span>
            </div>
          </div>
        </div>

        {/* Registered Dancers (Children) */}
        <div className="rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900/70 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Registered Dancers ({dancers.length})</h2>
            <div className="text-gray-400 text-sm">All children/dancers affiliated with this studio</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    EODSA ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Mastery Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dancers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-gray-400 text-sm">
                      No registered dancers found.
                    </td>
                  </tr>
                ) : (
                  dancers.map((dancer) => (
                    <tr key={dancer.id} className="hover:bg-gray-900/40">
                      <td className="px-6 py-3 text-sm text-gray-200 font-medium">{dancer.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-300 font-mono">{dancer.eodsaId}</td>
                      <td className="px-6 py-3 text-sm text-gray-300">{dancer.age ?? '—'}</td>
                      <td className="px-6 py-3 text-sm">
                        {dancer.masteryLevel ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            dancer.masteryLevel.toLowerCase().includes('water')
                              ? 'bg-blue-900/60 text-blue-200'
                              : dancer.masteryLevel.toLowerCase().includes('fire')
                              ? 'bg-orange-900/60 text-orange-200'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {dancer.masteryLevel}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <Link
                          href={`/admin/dancers/${dancer.eodsaId}`}
                          className="text-blue-400 hover:text-blue-300 underline text-xs"
                        >
                          View Profile →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


