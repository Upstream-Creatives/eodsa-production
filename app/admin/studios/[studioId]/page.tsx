'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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

function AdminStudioProfilePageContent({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
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
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'} mx-auto mb-4`}></div>
          <p className={themeClasses.loadingText}>Loading studio profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`min-h-screen ${themeClasses.mainBg} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className={`${themeClasses.heading2} mb-2`}>Error</h1>
          <p className={themeClasses.textMuted}>{error || 'Studio profile could not be loaded.'}</p>
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

  const { studio, dancers, financial, performance } = data;

  return (
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
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

        {/* Studio Overview Card */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} border ${themeClasses.cardBorder} ${themeClasses.cardPadding}`}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className={`${themeClasses.heading1} mb-2`}>🏢 {studio.name}</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div className={`${themeClasses.label} mb-1`}>Registration Number</div>
                  <div className={`${themeClasses.textPrimary} font-medium`}>{studio.registrationNumber}</div>
                </div>
                <div>
                  <div className={`${themeClasses.label} mb-1`}>Contact Person</div>
                  <div className={`${themeClasses.textPrimary} font-medium`}>{studio.contactPerson}</div>
                </div>
                <div>
                  <div className={`${themeClasses.label} mb-1`}>Email</div>
                  <div className={themeClasses.textPrimary}>{studio.email}</div>
                </div>
                <div>
                  <div className={`${themeClasses.label} mb-1`}>Phone</div>
                  <div className={themeClasses.textPrimary}>{studio.phone || '—'}</div>
                </div>
                {studio.address && (
                  <div className="md:col-span-2">
                    <div className={`${themeClasses.label} mb-1`}>Address</div>
                    <div className={themeClasses.textPrimary}>{studio.address}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`${themeClasses.badgeBase} border ${
                  studio.approved
                    ? themeClasses.badgeGreen
                    : studio.rejectionReason
                    ? themeClasses.badgeRed
                    : themeClasses.badgeYellow
                }`}
              >
                {studio.approved ? '✅ Approved' : studio.rejectionReason ? '❌ Rejected' : '⏳ Pending'}
              </div>
              {studio.approvedAt && (
                <div className={`${themeClasses.textMuted} text-xs mt-2`}>
                  Approved: {new Date(studio.approvedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Financial Metrics */}
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Entries</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{financial.totalEntries}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Fees Invoiced</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>R{financial.totalFeesInvoiced.toLocaleString()}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Paid</div>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>R{financial.totalPaid.toLocaleString()}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Outstanding</div>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>R{financial.totalOutstanding.toLocaleString()}</div>
          </div>
        </div>

        {/* Performance Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Total Solos</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{performance.totalSolos}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Group Entries</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{performance.totalGroupEntries}</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Average Score</div>
            <div className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{performance.averageScore}%</div>
          </div>
          <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
            <div className={`${themeClasses.textMuted} text-sm mb-1`}>Medals</div>
            <div className="flex gap-2 mt-2">
              <span className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}>🥇 {performance.medalBreakdown.gold}</span>
              <span className={themeClasses.textSecondary}>🥈 {performance.medalBreakdown.silver}</span>
              <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>🥉 {performance.medalBreakdown.bronze}</span>
            </div>
          </div>
        </div>

        {/* Registered Dancers (Children) */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden border ${themeClasses.cardBorder}`}>
          <div className={`${themeClasses.sectionHeaderBg} px-6 py-4 border-b ${themeClasses.sectionHeaderBorder}`}>
            <h2 className={`${themeClasses.heading3}`}>Registered Dancers ({dancers.length})</h2>
            <div className={`${themeClasses.textMuted} text-sm`}>All children/dancers affiliated with this studio</div>
          </div>

          <div className="overflow-x-auto">
            <table className={`min-w-full ${themeClasses.tableBorder}`}>
              <thead className={themeClasses.tableHeader}>
                <tr>
                  <th className={`${themeClasses.tableCellPadding} text-left text-xs font-semibold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                    Name
                  </th>
                  <th className={`${themeClasses.tableCellPadding} text-left text-xs font-semibold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                    EODSA ID
                  </th>
                  <th className={`${themeClasses.tableCellPadding} text-left text-xs font-semibold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                    Age
                  </th>
                  <th className={`${themeClasses.tableCellPadding} text-left text-xs font-semibold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                    Mastery Level
                  </th>
                  <th className={`${themeClasses.tableCellPadding} text-left text-xs font-semibold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`${themeClasses.tableRow} ${themeClasses.tableBorder}`}>
                {dancers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${themeClasses.tableCellPadding} text-center ${themeClasses.emptyStateText} text-sm`}>
                      No registered dancers found.
                    </td>
                  </tr>
                ) : (
                  dancers.map((dancer) => (
                    <tr key={dancer.id} className={themeClasses.tableRowHover}>
                      <td className={`${themeClasses.tableCellPadding} text-sm ${themeClasses.textPrimary} font-medium`}>{dancer.name}</td>
                      <td className={`${themeClasses.tableCellPadding} text-sm ${themeClasses.textSecondary} font-mono`}>{dancer.eodsaId}</td>
                      <td className={`${themeClasses.tableCellPadding} text-sm ${themeClasses.textSecondary}`}>{dancer.age ?? '—'}</td>
                      <td className={themeClasses.tableCellPadding}>
                        {dancer.masteryLevel ? (
                          <span className={`${themeClasses.badgeBase} ${
                            dancer.masteryLevel.toLowerCase().includes('water')
                              ? themeClasses.badgeBlue
                              : dancer.masteryLevel.toLowerCase().includes('fire')
                              ? themeClasses.badgeOrange
                              : themeClasses.badgeGray
                          }`}>
                            {dancer.masteryLevel}
                          </span>
                        ) : (
                          <span className={themeClasses.textMuted}>—</span>
                        )}
                      </td>
                      <td className={themeClasses.tableCellPadding}>
                        <Link
                          href={`/admin/dancers/${dancer.eodsaId}`}
                          className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline text-xs transition-colors`}
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

export default function AdminStudioProfilePage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  return (
    <ThemeProvider>
      <AdminStudioProfilePageContent params={params} />
    </ThemeProvider>
  );
}


