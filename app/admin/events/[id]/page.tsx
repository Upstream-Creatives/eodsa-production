'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAlert } from '@/components/ui/custom-alert';
import { calculateEODSAFee } from '@/lib/types';

interface Event {
  id: string;
  name: string;
  description: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  eventDate: string;
  registrationDeadline: string;
  venue: string;
  status: string;
  maxParticipants?: number;
  entryFee: number;
}

interface EventEntry {
  id: string;
  eventId: string;
  contestantId: string;
  eodsaId: string;
  participantIds: string[];
  calculatedFee: number;
  paymentStatus: string;
  paymentMethod?: string;
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  itemNumber?: number;
  contestantName?: string;
  contestantEmail?: string;
  participantNames?: string[];
}

interface Performance {
  id: string;
  eventId: string;
  eventEntryId: string;
  contestantId: string;
  title: string;
  participantNames: string[];
  duration: number;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  scheduledTime?: string;
  status: string;
  contestantName?: string;
}

export default function EventParticipantsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingEntries, setApprovingEntries] = useState<Set<string>>(new Set());
  const [qualifyingEntries, setQualifyingEntries] = useState<Set<string>>(new Set());
  const [assigningItemNumbers, setAssigningItemNumbers] = useState<Set<string>>(new Set());
  const [editingItemNumber, setEditingItemNumber] = useState<string | null>(null);
  const [tempItemNumber, setTempItemNumber] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }
    
    const adminData = JSON.parse(session);
    if (!adminData.isAdmin) {
      router.push('/judge/dashboard');
      return;
    }
    
    if (eventId) {
      loadEventData();
    }
  }, [eventId, router]);

  const loadEventData = async () => {
    setIsLoading(true);
    try {
      // Load event details
      const eventResponse = await fetch(`/api/events/${eventId}`);
      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEvent(eventData.event);
      }

      // Load event entries
      const entriesResponse = await fetch(`/api/events/${eventId}/entries`);
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        setEntries(entriesData.entries || []);
      }

      // Load performances for this event
      const performancesResponse = await fetch(`/api/events/${eventId}/performances`);
      if (performancesResponse.ok) {
        const performancesData = await performancesResponse.json();
        setPerformances(performancesData.performances || []);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
      setError('Failed to load event data');
    } finally {
      setIsLoading(false);
    }
  };

  const approveEntry = async (entryId: string) => {
    // Prevent double-click by checking if already approving
    if (approvingEntries.has(entryId)) {
      return;
    }

    // Add to approving set to disable button
    setApprovingEntries(prev => new Set(prev).add(entryId));

    try {
      const response = await fetch(`/api/event-entries/${entryId}/approve`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        // After approval, create a performance from the entry
        await createPerformanceFromEntry(entryId);
        loadEventData(); // Reload data
      } else {
        const errorData = await response.json();
        showAlert(`Failed to approve entry: ${errorData.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error approving entry:', error);
      showAlert('Failed to approve entry. Please try again.', 'error');
    } finally {
      // Remove from approving set to re-enable button
      setApprovingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const createPerformanceFromEntry = async (entryId: string) => {
    try {
      const response = await fetch(`/api/event-entries/${entryId}/create-performance`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        console.error('Failed to create performance from entry');
      }
    } catch (error) {
      console.error('Error creating performance:', error);
    }
  };

  const toggleQualification = async (entryId: string, currentStatus: boolean) => {
    if (qualifyingEntries.has(entryId)) return;
    
    setQualifyingEntries(prev => new Set(prev).add(entryId));
    
    try {
      const response = await fetch(`/api/admin/entries/${entryId}/qualify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin', // Simple auth for demo
        },
        body: JSON.stringify({
          qualifiedForNationals: !currentStatus
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert(result.message, 'success');
        loadEventData(); // Reload data
      } else {
        const error = await response.json();
        showAlert(`Failed to update qualification: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error updating qualification:', error);
      showAlert('Failed to update qualification status', 'error');
    } finally {
      setQualifyingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const assignItemNumber = async (entryId: string, itemNumber: number) => {
    if (assigningItemNumbers.has(entryId)) return;
    
    setAssigningItemNumbers(prev => new Set(prev).add(entryId));
    
    try {
      const response = await fetch(`/api/admin/entries/${entryId}/assign-item-number`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin',
        },
        body: JSON.stringify({ itemNumber }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert(result.message, 'success');
        setEditingItemNumber(null);
        setTempItemNumber('');
        loadEventData(); // Reload data
      } else {
        const error = await response.json();
        showAlert(`Failed to assign item number: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error assigning item number:', error);
      showAlert('Failed to assign item number', 'error');
    } finally {
      setAssigningItemNumbers(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const handleItemNumberEdit = (entryId: string, currentNumber?: number) => {
    setEditingItemNumber(entryId);
    setTempItemNumber(currentNumber ? currentNumber.toString() : '');
  };

  const handleItemNumberSave = (entryId: string) => {
    const itemNumber = parseInt(tempItemNumber);
    if (isNaN(itemNumber) || itemNumber < 1) {
      showAlert('Please enter a valid item number (positive integer)', 'warning');
      return;
    }
    assignItemNumber(entryId, itemNumber);
  };

  const handleItemNumberCancel = () => {
    setEditingItemNumber(null);
    setTempItemNumber('');
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      paid: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200'
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      // Prepare data for export with enhanced fee breakdown
      const exportData = entries.map((entry) => {
        // Calculate fee breakdown for each entry
        const feeBreakdown = calculateEODSAFee(
          entry.mastery,
          event?.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group' || 'Solo',
          entry.participantIds?.length || 1,
          {
            soloCount: 1,
            includeRegistration: true
          }
        );

        return {
          'Item Number': entry.itemNumber || 'Not Assigned',
          'EODSA ID': entry.eodsaId,
          'Name': entry.contestantName,
          'Performance Type': event?.performanceType || '',
          'Mastery Level': entry.mastery,
          'Style': entry.itemStyle,
          'Age Category': event?.ageCategory || '',
          'Participants': entry.participantIds?.length || 1,
          'Registration Fee': `R${feeBreakdown.registrationFee.toFixed(2)}`,
          'Performance Fee': `R${feeBreakdown.performanceFee.toFixed(2)}`,
          'Fee Breakdown': feeBreakdown.breakdown,
          'Total Fee': `R${entry.calculatedFee.toFixed(2)}`,
          'Qualified for Nationals': entry.qualifiedForNationals ? 'Yes' : 'No',
          'Payment Status': entry.paymentStatus.toUpperCase(),
          'Entry Status': entry.approved ? 'APPROVED' : 'PENDING',
          'Choreographer': entry.choreographer,
          'Duration (minutes)': entry.estimatedDuration || 'N/A',
          'Submitted Date': new Date(entry.submittedAt).toLocaleDateString()
        };
      });

      // Convert to CSV format
      if (exportData.length === 0) {
        showAlert('No data to export', 'warning');
        return;
      }

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Handle values that might contain commas by wrapping in quotes
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${event?.name || 'Event'}_Participants_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      showAlert('Failed to export data. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            {/* Modern Spinner */}
            <div className="w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            </div>
            {/* Floating Dots */}
            <div className="absolute -top-6 -left-6 w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
            <div className="absolute -top-6 -right-6 w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <div className="absolute -bottom-6 -left-6 w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            <div className="absolute -bottom-6 -right-6 w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.6s'}}></div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Loading Event Details
            </h2>
            <p className="text-gray-600 font-medium animate-pulse">Preparing participant data...</p>
            
            {/* Progress Dots */}
            <div className="flex justify-center space-x-2 mt-6">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Enhanced Header */}
      <header className="bg-white/90 backdrop-blur-lg shadow-xl border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Event Participants
                </h1>
                <p className="text-gray-600 font-medium">{event?.name || 'Loading...'}</p>
              </div>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-xl hover:from-gray-600 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
            >
              <span>←</span>
              <span>Back to Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Details Card */}
        {event && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-indigo-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">🏆</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Event Details</h2>
              </div>
              {/* Excel Export Button */}
              <button
                onClick={exportToExcel}
                disabled={isExporting || entries.length === 0}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
              >
                <span>📊</span>
                <span>{isExporting ? 'Exporting...' : 'Download to Excel'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-700">Date</p>
                <p className="text-gray-700">{new Date(event.eventDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Venue</p>
                <p className="text-gray-700">{event.venue}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Entry Fee</p>
                <p className="text-gray-700">R{event.entryFee.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Participants</p>
                <p className="text-gray-700">{entries.length} entries</p>
              </div>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-indigo-100 mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Participants & Entries</h2>
              <div className="flex items-center space-x-3">
                <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                  {entries.length} entries
                </div>
                {entries.length > 0 && (
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                    {entries.filter(e => e.qualifiedForNationals).length} qualified
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table with Item Number column */}
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No entries yet</h3>
              <p className="text-sm">Participants will appear here once they register for this event.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item #</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contestant</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Performance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Submitted</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-indigo-50/50 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingItemNumber === entry.id ? (
                          <div className="flex flex-col space-y-1">
                            <input
                              type="number"
                              value={tempItemNumber}
                              onChange={(e) => setTempItemNumber(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleItemNumberSave(entry.id);
                                if (e.key === 'Escape') handleItemNumberCancel();
                              }}
                              className="w-20 px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Item #"
                              min="1"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleItemNumberSave(entry.id)}
                                disabled={assigningItemNumbers.has(entry.id)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {assigningItemNumbers.has(entry.id) ? '...' : '✓'}
                              </button>
                              <button
                                onClick={handleItemNumberCancel}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleItemNumberEdit(entry.id, entry.itemNumber)}
                            className="cursor-pointer hover:bg-gray-100 rounded p-1 transition-colors"
                          >
                            <div className="text-sm font-bold text-gray-900">
                              {entry.itemNumber || 'Click to assign'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Program Order
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{entry.contestantName || 'Loading...'}</div>
                          <div className="text-sm text-gray-700">{entry.eodsaId}</div>
                          <div className="text-xs text-gray-500 sm:hidden mt-1">
                            {entry.itemName} • {entry.mastery}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.itemName}</div>
                          <div className="text-sm text-gray-700">{entry.choreographer}</div>
                          <div className="text-xs text-gray-500">{entry.mastery} • {entry.itemStyle}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">R{entry.calculatedFee.toFixed(2)}</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(entry.paymentStatus)}`}>
                            {entry.paymentStatus.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 hidden md:table-cell">
                        {new Date(entry.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                            entry.approved ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          }`}>
                            {entry.approved ? 'APPROVED' : 'PENDING'}
                          </span>
                          {entry.qualifiedForNationals && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              QUALIFIED FOR NATIONALS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col space-y-2">
                          {!entry.approved && (
                            <button
                              onClick={() => approveEntry(entry.id)}
                              disabled={approvingEntries.has(entry.id)}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 font-medium"
                            >
                              {approvingEntries.has(entry.id) ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                          {entry.approved && (
                            <button
                              onClick={() => toggleQualification(entry.id, entry.qualifiedForNationals)}
                              disabled={qualifyingEntries.has(entry.id)}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                entry.qualifiedForNationals
                                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              } disabled:opacity-50`}
                            >
                              {qualifyingEntries.has(entry.id) 
                                ? 'Updating...' 
                                : entry.qualifiedForNationals 
                                  ? 'Qualified ✓' 
                                  : 'Qualify for Nationals'
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Performances Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-indigo-100 mt-8">
          <div className="px-6 py-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">🎭</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Performances</h2>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {performances.length} performances
              </div>
            </div>
          </div>

          {performances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🎭</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No performances yet</h3>
              <p className="text-sm">Performances are automatically created when entries are approved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Performance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Participants</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Choreographer</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {performances.map((performance) => (
                    <tr key={performance.id} className="hover:bg-green-50/50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{performance.title}</div>
                          <div className="text-sm text-gray-700">{performance.contestantName}</div>
                          <div className="text-xs text-gray-500">{performance.mastery} • {performance.itemStyle}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className="text-sm text-gray-700">
                          {performance.participantNames.join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{performance.duration} min</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 hidden md:table-cell">
                        {performance.choreographer}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                          performance.status === 'scheduled' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          performance.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          performance.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {performance.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 