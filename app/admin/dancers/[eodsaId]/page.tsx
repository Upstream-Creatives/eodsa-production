'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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

function AdminDancerProfilePageContent({
  params,
}: {
  params: Promise<{ eodsaId: string }>;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  // Use React's use() hook to handle Promise params in Next.js 15
  const resolvedParams = use(params);
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
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'} mx-auto mb-4`}></div>
          <p className={themeClasses.loadingText}>Loading dancer profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen ${themeClasses.mainBg} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className={`${themeClasses.heading2} mb-2`}>Error</h1>
          <p className={themeClasses.textMuted}>{error || 'Dancer profile could not be loaded.'}</p>
          <div className="mt-4">
            <button
              className={`${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`}
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
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link 
            href="/admin" 
            className={`text-sm ${themeClasses.textMuted} transition-colors ${
              theme === 'dark' ? 'hover:text-white' : 'hover:text-gray-900'
            }`}
          >
            ← Back to Admin
          </Link>
          <ThemeToggle />
        </div>

        {/* Header Card - Clean Profile Overview */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} border ${themeClasses.cardBorder} p-8`}>
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className={`${themeClasses.heading1} mb-2`}>{dancer.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={themeClasses.textMuted}>EODSA ID:</span>
                  <span className={`font-mono ${themeClasses.textSecondary}`}>{dancer.eodsaId}</span>
                </div>
                {dancer.age !== null && (
                  <div className="flex items-center gap-2">
                    <span className={themeClasses.textMuted}>Age:</span>
                    <span className={`${themeClasses.textSecondary} font-medium`}>{dancer.age}</span>
                  </div>
                )}
                {dancer.ageCategory && (
                  <div className="flex items-center gap-2">
                    <span className={themeClasses.textMuted}>Age Group:</span>
                    <span className={`${themeClasses.badgeBase} ${themeClasses.badgeBlue}`}>
                      {dancer.ageCategory}
                    </span>
                  </div>
                )}
                {dancer.registrationFeeMasteryLevel && (
                  <div className="flex items-center gap-2">
                    <span className={themeClasses.textMuted}>Mastery Level:</span>
                    <span className={`${themeClasses.badgeBase} ${
                      dancer.registrationFeeMasteryLevel.toLowerCase().includes('water')
                        ? themeClasses.badgeBlue
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('fire')
                        ? themeClasses.badgeOrange
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('earth')
                        ? themeClasses.badgeGreen
                        : dancer.registrationFeeMasteryLevel.toLowerCase().includes('air')
                        ? themeClasses.badgePurple
                        : themeClasses.badgeGray
                    }`}>
                      {dancer.registrationFeeMasteryLevel}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`${themeClasses.badgeBase} border ${
                  dancer.approved ? themeClasses.badgeGreen : themeClasses.badgeYellow
                }`}
              >
                {dancer.approved ? '✓ Approved' : '⏳ Pending'}
              </div>
            </div>
          </div>
          
          {/* Studio/Parent Information */}
          {studio && (studio.name || studio.registrationNumber) ? (
            <div className={`mt-4 pt-4 border-t ${themeClasses.cardBorder}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`${themeClasses.label} mb-1`}>Studio (Parent)</div>
                  <div className={`${themeClasses.textPrimary} font-medium`}>{studio.name || '—'}</div>
                  {studio.registrationNumber && (
                    <div className={`${themeClasses.textMuted} text-xs mt-1`}>Reg. #{studio.registrationNumber}</div>
                  )}
                </div>
                {studio.id && (
                  <Link
                    href={`/admin/studios/${studio.id}`}
                    className={`inline-flex items-center px-3 py-1.5 ${themeClasses.buttonBase} ${themeClasses.buttonPrimary} text-xs`}
                  >
                    View Studio →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className={`mt-4 pt-4 border-t ${themeClasses.cardBorder}`}>
              <div className={`${themeClasses.label} mb-1`}>Studio (Parent)</div>
              <div className={`${themeClasses.textMuted} text-sm`}>Independent Dancer (Not affiliated with any studio)</div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {history.filter(h => h.ranking && h.ranking.score !== null).length > 0 && (
          <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} border ${themeClasses.cardBorder} p-6`}>
            <h2 className={`${themeClasses.heading3} mb-4`}>Competition Results Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Performances Scored</div>
                <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
                  {history.filter(h => h.ranking && h.ranking.score !== null).length}
                </div>
              </div>
              <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                <div className={`${themeClasses.textMuted} text-sm mb-1`}>Average Score</div>
                <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
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
              <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                <div className={`${themeClasses.textMuted} text-sm mb-1`}>Best Medal</div>
                <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
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
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Entries</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{history.length}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Live Entries</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
              {history.filter(h => h.entryType === 'live').length}
            </div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Virtual Entries</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
              {history.filter(h => h.entryType === 'virtual').length}
            </div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Fees</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
              R{history.reduce((sum, h) => sum + (h.calculatedFee || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Event History - Clean List View */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden border ${themeClasses.cardBorder}`}>
          <div className={`${themeClasses.sectionHeaderBg} px-6 py-4 border-b ${themeClasses.sectionHeaderBorder}`}>
            <h2 className={`${themeClasses.heading3}`}>Competition History</h2>
            <div className={`${themeClasses.textMuted} text-sm`}>All events this dancer has entered</div>
          </div>

          <div className={themeClasses.tableBorder}>
            {history.length === 0 ? (
              <div className={`px-6 py-12 text-center ${themeClasses.emptyStateText} text-sm`}>
                No competition entries found.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className={`px-6 py-4 ${themeClasses.tableRowHover} transition-colors`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-base font-semibold ${themeClasses.textPrimary}`}>{h.itemName || 'Untitled Performance'}</h3>
                        {h.ranking && h.ranking.medal && (
                          <span className={`${themeClasses.badgeBase} ${
                            h.ranking.medal === 'Elite' ? themeClasses.badgeYellow :
                            h.ranking.medal === 'Opus' ? themeClasses.badgePurple :
                            h.ranking.medal === 'Legend' ? themeClasses.badgeBlue :
                            h.ranking.medal === 'Gold' ? (theme === 'dark' ? 'bg-amber-900/60 text-amber-200 border-amber-700/50' : 'bg-amber-100 text-amber-800 border-amber-300') :
                            h.ranking.medal === 'Silver+' ? themeClasses.badgeGray :
                            h.ranking.medal === 'Silver' ? themeClasses.badgeGray :
                            themeClasses.badgeOrange
                          }`}>
                            {h.ranking.medal === 'Elite' ? '🏆' : h.ranking.medal === 'Opus' ? '🎖️' : h.ranking.medal === 'Legend' ? '🏅' : h.ranking.medal === 'Gold' ? '🥇' : h.ranking.medal === 'Silver+' ? '🥈+' : h.ranking.medal === 'Silver' ? '🥈' : '🥉'} {h.ranking.medal}
                          </span>
                        )}
                      </div>
                      <div className={`flex flex-wrap items-center gap-4 text-sm ${themeClasses.textMuted} mb-2`}>
                        <div className="flex items-center gap-1">
                          <span className={`font-medium ${themeClasses.textSecondary}`}>{h.event.name || '—'}</span>
                          {h.event.year && (
                            <span className={themeClasses.textMuted}>({h.event.year})</span>
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
                        <span className={`${themeClasses.badgeBase} ${
                          h.entryType === 'live' 
                            ? themeClasses.badgeGreen
                            : h.entryType === 'virtual'
                            ? themeClasses.badgePurple
                            : themeClasses.badgeGray
                        }`}>
                          {h.entryType === 'live' ? '🎭 Live' : h.entryType === 'virtual' ? '📹 Virtual' : '—'}
                        </span>
                        {h.performanceType && (
                          <span className={themeClasses.textMuted}>{h.performanceType}</span>
                        )}
                        {h.mastery && (
                          <span className={themeClasses.textMuted}>• {h.mastery}</span>
                        )}
                        {h.paymentStatus && (
                          <span className={`${themeClasses.badgeBase} ${
                            h.paymentStatus === 'paid'
                              ? themeClasses.badgeGreen
                              : h.paymentStatus === 'pending'
                              ? themeClasses.badgeYellow
                              : themeClasses.badgeGray
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
                            <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>#{h.ranking.rank}</div>
                          )}
                          <div className={`text-sm ${themeClasses.textSecondary}`}>{h.ranking.score.toFixed(1)}%</div>
                        </div>
                      ) : h.performance && h.performance.scoresPublished ? (
                        <div className={`text-xs ${themeClasses.textMuted}`}>Scores Published</div>
                      ) : (
                        <div className={`text-xs ${themeClasses.textMuted}`}>No Results</div>
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

export default function AdminDancerProfilePage({
  params,
}: {
  params: Promise<{ eodsaId: string }>;
}) {
  return (
    <ThemeProvider>
      <AdminDancerProfilePageContent params={params} />
    </ThemeProvider>
  );
}


