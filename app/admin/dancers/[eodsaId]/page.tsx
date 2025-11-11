'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProfileResponse {
  success: boolean;
  profile?: {
    dancer: {
      id: string;
      eodsaId: string;
      name: string;
      age: number | null;
      ageCategory: string | null;
      dateOfBirth: string | null;
      approved: boolean | null;
      registrationFeeMasteryLevel: string | null;
    };
    studio: {
      id: string | null;
      name: string | null;
      registrationNumber: string | null;
    } | null;
    history: Array<{
      id: string;
      eventId: string;
      contestantId: string;
      eodsaId: string;
      itemName: string | null;
      performanceType: string | null;
      mastery: string | null;
      entryType: 'live' | 'virtual' | null;
      submittedAt: string | null;
      paymentStatus: string | null;
      paymentReference: string | null;
      itemNumber: number | null;
      virtualItemNumber: number | null;
      qualifiedForNationals: boolean | null;
      calculatedFee: number | null;
      event: {
        name: string | null;
        date: string | null;
        year: number | null;
        region: string | null;
      };
      performance: {
        id: string;
        title: string | null;
        scoresPublished: boolean;
      } | null;
      ranking: {
        rank: number | null;
        score: number | null;
        medal: string | null;
      } | null;
    }>;
  };
  error?: string;
}

export default function AdminDancerProfilePage({
  params,
}: {
  params: Promise<{ eodsaId: string }> | { eodsaId: string };
}) {
  const router = useRouter();
  // Use React's use() hook to handle Promise params in Next.js 15
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const eodsaId = resolvedParams.eodsaId;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileResponse['profile'] | null>(null);

  useEffect(() => {
    // Only run on client side and when eodsaId is available
    if (typeof window === 'undefined' || !eodsaId) return;
    
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        // Use absolute URL for client-side fetch
        const baseUrl = window.location.origin;
        const res = await fetch(`${baseUrl}/api/admin/dancers/${encodeURIComponent(eodsaId)}/profile`, {
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
        
        let json: ProfileResponse;
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
            setError(json.error || 'Failed to load dancer profile');
          } else {
            setData(json.profile);
          }
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Fetch error:', e);
        if (!cancelled) {
          setError(e?.message || 'Failed to load dancer profile');
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eodsaId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dancer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-400">{error || 'Dancer profile could not be loaded.'}</p>
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

  const { dancer, studio, history } = data;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-200">
            ← Back to Admin
          </Link>
        </div>

        {/* Header Card - Clean Profile Overview */}
        <div className="rounded-2xl border border-gray-800 p-8 bg-gradient-to-br from-gray-900/70 to-gray-800/40">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{dancer.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">EODSA ID:</span>
                  <span className="font-mono text-gray-200">{dancer.eodsaId}</span>
                </div>
                {dancer.age !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Age:</span>
                    <span className="text-gray-200 font-medium">{dancer.age}</span>
                  </div>
                )}
                {dancer.ageCategory && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Age Group:</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/60 text-blue-200">
                      {dancer.ageCategory}
                    </span>
                  </div>
                )}
                {dancer.registrationFeeMasteryLevel && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Mastery Level:</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      dancer.registrationFeeMasteryLevel.toLowerCase().includes('water')
                        ? 'bg-blue-900/60 text-blue-200'
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('fire')
                        ? 'bg-orange-900/60 text-orange-200'
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('earth')
                        ? 'bg-green-900/60 text-green-200'
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('air')
                        ? 'bg-purple-900/60 text-purple-200'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {dancer.registrationFeeMasteryLevel}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                  dancer.approved ? 'bg-emerald-900/60 text-emerald-200' : 'bg-yellow-900/60 text-yellow-200'
                }`}
              >
                {dancer.approved ? '✓ Approved' : '⏳ Pending'}
              </div>
            </div>
          </div>
          
          {/* Studio/Parent Information */}
          {studio && (studio.name || studio.registrationNumber) ? (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Studio (Parent)</div>
                  <div className="text-gray-200 font-medium">{studio.name || '—'}</div>
                  {studio.registrationNumber && (
                    <div className="text-xs text-gray-400 mt-1">Reg. #{studio.registrationNumber}</div>
                  )}
                </div>
                {studio.id && (
                  <Link
                    href={`/admin/studios/${studio.id}`}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    View Studio →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Studio (Parent)</div>
              <div className="text-gray-400 text-sm">Independent Dancer (Not affiliated with any studio)</div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {history.filter(h => h.ranking && h.ranking.score !== null).length > 0 && (
          <div className="rounded-2xl border border-gray-800 p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
            <h2 className="text-lg font-semibold text-white mb-4">Competition Results Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-sm mb-1">Total Performances Scored</div>
                <div className="text-2xl font-bold text-white">
                  {history.filter(h => h.ranking && h.ranking.score !== null).length}
                </div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-sm mb-1">Average Score</div>
                <div className="text-2xl font-bold text-white">
                  {(() => {
                    const scores = history
                      .filter(h => h.ranking && h.ranking.score !== null)
                      .map(h => h.ranking!.score!)
                      .filter(s => s !== null);
                    if (scores.length === 0) return '—';
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    return avg.toFixed(1);
                  })()}
                </div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-sm mb-1">Best Medal</div>
                <div className="text-2xl font-bold text-white">
                  {(() => {
                    const medals = history
                      .filter(h => h.ranking && h.ranking.medal)
                      .map(h => h.ranking!.medal!);
                    if (medals.length === 0) return '—';
                    // Medal hierarchy (best to worst)
                    const medalHierarchy = ['Elite', 'Opus', 'Legend', 'Gold', 'Silver+', 'Silver', 'Bronze'];
                    const bestMedal = medals.reduce((best, current) => {
                      const bestIdx = medalHierarchy.indexOf(best);
                      const currentIdx = medalHierarchy.indexOf(current);
                      return currentIdx < bestIdx ? current : best;
                    });
                    return bestMedal;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Competition Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Entries</div>
            <div className="text-2xl font-bold text-white">{history.length}</div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Live Entries</div>
            <div className="text-2xl font-bold text-white">
              {history.filter(h => h.entryType === 'live').length}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Virtual Entries</div>
            <div className="text-2xl font-bold text-white">
              {history.filter(h => h.entryType === 'virtual').length}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/60">
            <div className="text-gray-400 text-sm mb-1">Total Fees</div>
            <div className="text-2xl font-bold text-white">
              R{history.reduce((sum, h) => sum + (h.calculatedFee || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Event History - Clean List View */}
        <div className="rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900/70 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Competition History</h2>
            <div className="text-gray-400 text-sm">All events this dancer has entered</div>
          </div>

          <div className="divide-y divide-gray-800">
            {history.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                No competition entries found.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="px-6 py-4 hover:bg-gray-900/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-white">{h.itemName || 'Untitled Performance'}</h3>
                        {h.ranking && h.ranking.medal && (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            h.ranking.medal === 'Elite' ? 'bg-yellow-900/60 text-yellow-200' :
                            h.ranking.medal === 'Opus' ? 'bg-purple-900/60 text-purple-200' :
                            h.ranking.medal === 'Legend' ? 'bg-blue-900/60 text-blue-200' :
                            h.ranking.medal === 'Gold' ? 'bg-amber-900/60 text-amber-200' :
                            h.ranking.medal === 'Silver+' ? 'bg-gray-700 text-gray-200' :
                            h.ranking.medal === 'Silver' ? 'bg-gray-600 text-gray-200' :
                            'bg-orange-900/60 text-orange-200'
                          }`}>
                            {h.ranking.medal === 'Elite' ? '🏆' : h.ranking.medal === 'Opus' ? '🎖️' : h.ranking.medal === 'Legend' ? '🏅' : h.ranking.medal === 'Gold' ? '🥇' : h.ranking.medal === 'Silver+' ? '🥈+' : h.ranking.medal === 'Silver' ? '🥈' : '🥉'} {h.ranking.medal}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-300">{h.event.name || '—'}</span>
                          {h.event.year && (
                            <span className="text-gray-500">({h.event.year})</span>
                          )}
                        </div>
                        {h.event.date && (
                          <div className="flex items-center gap-1">
                            <span>📅</span>
                            <span>{new Date(h.event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        )}
                        {h.event.region && (
                          <div className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{h.event.region}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          h.entryType === 'live' 
                            ? 'bg-green-900/60 text-green-200' 
                            : h.entryType === 'virtual'
                            ? 'bg-purple-900/60 text-purple-200'
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {h.entryType === 'live' ? '🎭 Live' : h.entryType === 'virtual' ? '📹 Virtual' : '—'}
                        </span>
                        {h.performanceType && (
                          <span className="text-gray-400">{h.performanceType}</span>
                        )}
                        {h.mastery && (
                          <span className="text-gray-400">• {h.mastery}</span>
                        )}
                        {h.paymentStatus && (
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            h.paymentStatus === 'paid'
                              ? 'bg-green-900/60 text-green-200'
                              : h.paymentStatus === 'pending'
                              ? 'bg-yellow-900/60 text-yellow-200'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {h.paymentStatus === 'paid' ? '✅ Paid' : h.paymentStatus === 'pending' ? '⏳ Pending' : h.paymentStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {h.ranking && h.ranking.score !== null ? (
                        <div className="space-y-1">
                          {h.ranking.rank !== null && (
                            <div className="text-lg font-bold text-white">#{h.ranking.rank}</div>
                          )}
                          <div className="text-sm text-gray-300">{h.ranking.score.toFixed(1)}%</div>
                        </div>
                      ) : h.performance && h.performance.scoresPublished ? (
                        <div className="text-xs text-gray-400">Scores Published</div>
                      ) : (
                        <div className="text-xs text-gray-500">No Results</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


