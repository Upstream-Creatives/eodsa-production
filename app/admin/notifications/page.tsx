'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/simple-toast';

type RecipientGroup =
  | 'dancers'
  | 'studios'
  | 'staff'
  | 'event_participants'
  | 'dancers_and_studios';

interface EventOption {
  id: string;
  name: string;
  region?: string;
}

interface AnnouncementResult {
  email: string;
  success: boolean;
  error?: string;
}

function AdminNotificationsPageContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const { success, error, info } = useToast();

  const [user, setUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [recipientGroup, setRecipientGroup] = useState<RecipientGroup>('dancers');
  const [province, setProvince] = useState<string>('all');
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p>Dear EODSA community,</p><p></p>');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [lastResults, setLastResults] = useState<AnnouncementResult[] | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);

  // Provinces (used for filtering for dancers / studios / participants)
  const PROVINCES = [
    { id: 'all', name: 'All provinces' },
    { id: 'Gauteng', name: 'Gauteng' },
    { id: 'Free State', name: 'Free State' },
    { id: 'Mpumalanga', name: 'Mpumalanga' },
    { id: 'Western Cape', name: 'Western Cape' },
    { id: 'Eastern Cape', name: 'Eastern Cape' },
    { id: 'KwaZulu-Natal', name: 'KwaZulu-Natal' },
    { id: 'Limpopo', name: 'Limpopo' },
    { id: 'North West', name: 'North West' },
    { id: 'Northern Cape', name: 'Northern Cape' }
  ];

  // Admin auth check
  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }

    try {
      const userData = JSON.parse(session);
      setUser(userData);
      if (!userData.isAdmin) {
        router.push('/portal/admin');
        return;
      }
    } catch {
      router.push('/portal/admin');
      return;
    } finally {
      setIsLoadingUser(false);
    }
  }, [router]);

  // Load events for the event participants selector
  useEffect(() => {
    const loadEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const res = await fetch('/api/events');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && Array.isArray(data.events)) {
          const mapped: EventOption[] = data.events.map((e: any) => ({
            id: e.id,
            name: e.name,
            region: e.region
          }));
          setEvents(mapped);
        }
      } catch (err) {
        console.error('Failed to load events for notifications:', err);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  // Keep editor in sync when bodyHtml changes (e.g. on initial load / reset)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [bodyHtml]);

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    setBodyHtml(editorRef.current.innerHTML);
  };

  const handlePreview = () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      info('Please enter both a subject and a body before previewing.');
      return;
    }
    setIsPreviewing(true);
  };

  const handleSend = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      error('Subject and body are required.');
      return;
    }

    if (!user?.id) {
      error('Admin session not found. Please log in again.');
      router.push('/portal/admin');
      return;
    }

    const payload = {
      recipientGroup,
      province: province === 'all' ? null : province,
      eventId: recipientGroup === 'event_participants' ? selectedEventId || null : null,
      subject,
      bodyHtml,
      sentBy: user.id
    };

    setIsSending(true);
    try {
      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send announcement');
      }

      setLastResults(Array.isArray(data.results) ? data.results : null);

      success(
        data.message ||
          `Announcement sent to ${data.successCount || 0}/${data.totalRecipients || 0} recipients`
      );
    } catch (err) {
      console.error('Failed to send announcement:', err);
      error(
        err instanceof Error
          ? err.message
          : 'Failed to send announcement. Please check the logs for details.'
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mx-auto" />
          <p className="text-slate-300 text-sm">Loading admin notifications...</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  const showEventSelector = recipientGroup === 'event_participants';

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen ${isLight ? 'bg-slate-50' : themeClasses.pageBackground}`}>
      <header
        className={`border-b backdrop-blur sticky top-0 z-20 ${
          isLight ? 'bg-white/90 border-slate-200' : 'bg-slate-950/80 border-slate-800/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${themeClasses.textPrimary}`}>
              Admin Notifications
            </h1>
            <p className={`text-xs sm:text-sm ${themeClasses.textMuted} mt-1`}>
              Send announcement emails to dancers, studios, staff, or event participants.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700/70 text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              ← Back to Dashboard
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Recipients & filters */}
        <section
          className={`${themeClasses.cardBackground} rounded-2xl shadow-lg border ${
            isLight ? 'border-slate-200' : 'border-slate-800/70'
          } p-4 sm:p-6 space-y-5`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className={`text-lg font-semibold ${themeClasses.textPrimary}`}>
                Recipients
              </h2>
              <p className={`text-xs sm:text-sm ${themeClasses.textMuted}`}>
                Choose who should receive this announcement.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Groups
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientGroup('dancers')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all ${
                    recipientGroup === 'dancers'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-sm'
                      : 'border-slate-300/80 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  All dancers
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientGroup('studios')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all ${
                    recipientGroup === 'studios'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-sm'
                      : 'border-slate-300/80 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  All studios
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientGroup('dancers_and_studios')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all ${
                    recipientGroup === 'dancers_and_studios'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-sm'
                      : 'border-slate-300/80 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Dancers & studios
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientGroup('staff')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all ${
                    recipientGroup === 'staff'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-sm'
                      : 'border-slate-300/80 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  All staff (admins & portals)
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientGroup('event_participants')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition-all ${
                    recipientGroup === 'event_participants'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200 shadow-sm'
                      : 'border-slate-300/80 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  Event participants
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Province filter
              </label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
              >
                {PROVINCES.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className={`text-[11px] ${themeClasses.textMuted}`}>
                Province filter applies to dancers, studios, and event participants. It is ignored for
                staff announcements.
              </p>
            </div>
          </div>

          {showEventSelector && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Event
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  disabled={isLoadingEvents}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-wait dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                >
                  <option value="">Select an event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                      {event.region ? ` – ${event.region}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className={`text-[11px] ${themeClasses.textMuted}`}>
                Only participants (dancers and studios) linked to the selected event will receive this
                announcement.
              </p>
              {isLoadingEvents && (
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="inline-flex h-3 w-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <span>Loading events from the database...</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Subject and body */}
        <section
          className={`${themeClasses.cardBackground} rounded-2xl shadow-lg border ${
            isLight ? 'border-slate-200' : 'border-slate-800/70'
          } p-4 sm:p-6 space-y-5`}
        >
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="E.g. Important update about EODSA Nationals"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Email body
              </label>
              <span className="text-[11px] text-slate-400">
                Simple rich text – paragraphs, bold, italics and links.
              </span>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-950/60">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Editor</span>
                  <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
                    Use Enter for new paragraphs. You can paste formatted content from most editors.
                  </span>
                </div>
              </div>
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="min-h-[180px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-900 bg-white focus:outline-none prose prose-sm dark:text-slate-100 dark:bg-transparent dark:prose-invert"
                suppressContentEditableWarning
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 mr-1" />
              Emails will be sent from{' '}
              <span className="font-semibold text-slate-800 ml-1 dark:text-slate-200">
                no_reply@elementscentral.com
              </span>{' '}
              with support at{' '}
              <span className="font-semibold text-slate-800 ml-1 dark:text-slate-200">
                Mains@elementscentral.com
              </span>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/70 text-xs sm:text-sm text-slate-100 hover:bg-slate-800/80 transition-colors"
              >
                <span>Preview email</span>
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-xs sm:text-sm font-semibold text-white shadow-md hover:from-indigo-600 hover:to-violet-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </section>

        {/* Preview */}
        {isPreviewing && (
          <section
            className={`${themeClasses.cardBackground} rounded-2xl shadow-lg border ${
              isLight ? 'border-slate-200' : 'border-slate-800/70'
            } p-4 sm:p-6 space-y-4`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-sm sm:text-base font-semibold ${themeClasses.textPrimary}`}>
                  Preview
                </h2>
                <p className={`text-[11px] sm:text-xs ${themeClasses.textMuted}`}>
                  This is how the announcement will roughly look in the recipient&apos;s inbox.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewing(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Close preview
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    From:
                  </span>{' '}
                  <span className="text-slate-900 dark:text-slate-100">
                    no_reply@elementscentral.com
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Subject:
                  </span>{' '}
                  <span className="text-slate-900 dark:text-slate-100">
                    {subject || '(no subject)'}
                  </span>
                </div>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-900 leading-relaxed prose prose-sm max-w-none dark:border-slate-800 dark:text-slate-100 dark:prose-invert">
                {/* eslint-disable-next-line react/no-danger */}
                <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              </div>
            </div>
          </section>
        )}

        {/* Audit of last send */}
        {lastResults && lastResults.length > 0 && (
          <section
            className={`${themeClasses.cardBackground} rounded-2xl shadow-lg border ${
              isLight ? 'border-slate-200' : 'border-slate-800/70'
            } p-4 sm:p-6 space-y-4`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-sm sm:text-base font-semibold ${themeClasses.textPrimary}`}>
                  Last announcement summary
                </h2>
                <p className={`text-[11px] sm:text-xs ${themeClasses.textMuted}`}>
                  See which email addresses were included and whether they were sent successfully.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className={isLight ? 'bg-slate-50' : 'bg-slate-900'}>
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lastResults.map(row => (
                    <tr
                      key={row.email}
                      className={row.success ? 'bg-emerald-50/40 dark:bg-slate-900/40' : 'bg-rose-50/40 dark:bg-slate-900/60'}
                    >
                      <td className="px-3 py-2 align-top text-slate-800 dark:text-slate-100 break-all">
                        {row.email}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.success ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-medium dark:bg-emerald-900/40 dark:text-emerald-300">
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[11px] font-medium dark:bg-rose-900/40 dark:text-rose-300">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600 dark:text-slate-300">
                        {row.success ? 'Delivered via SMTP.' : row.error || 'Unknown error.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <ThemeProvider>
      <AdminNotificationsPageContent />
    </ThemeProvider>
  );
}


