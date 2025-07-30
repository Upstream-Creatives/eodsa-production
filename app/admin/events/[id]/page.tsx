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
  paymentReference?: string;
  paymentDate?: string;
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
  withdrawnFromJudging?: boolean;
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
  const [deletingEntries, setDeletingEntries] = useState<Set<string>>(new Set());
  const [performanceTypeFilter, setPerformanceTypeFilter] = useState<string>('all');
  const [withdrawingPerformances, setWithdrawingPerformances] = useState<Set<string>>(new Set());
  const [selectedPerformanceScores, setSelectedPerformanceScores] = useState<any>(null);
  const [showScoresModal, setShowScoresModal] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EventEntry | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const { showAlert } = useAlert();

  // Determine performance type from participant count
  const getPerformanceType = (participantIds: string[]) => {
    const count = participantIds.length;
    if (count === 1) return 'Solo';
    if (count === 2) return 'Duet';
    if (count === 3) return 'Trio';
    if (count >= 4) return 'Group';
    return 'Unknown';
  };

  // Get performance type color
  const getPerformanceTypeColor = (type: string) => {
    switch (type) {
      case 'Solo': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Duet': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Trio': return 'bg-green-100 text-green-800 border-green-200';
      case 'Group': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filter entries by performance type
  const filteredEntries = performanceTypeFilter === 'all' 
    ? entries 
    : entries.filter(entry => getPerformanceType(entry.participantIds).toLowerCase() === performanceTypeFilter);

  // Get performance type statistics
  const getPerformanceStats = () => {
    const stats = {
      solo: entries.filter(e => getPerformanceType(e.participantIds) === 'Solo').length,
      duet: entries.filter(e => getPerformanceType(e.participantIds) === 'Duet').length,
      trio: entries.filter(e => getPerformanceType(e.participantIds) === 'Trio').length,
      group: entries.filter(e => getPerformanceType(e.participantIds) === 'Group').length,
    };
    return stats;
  };

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
        
        // Update local state instead of reloading
        setEntries(prev => prev.map(entry => 
          entry.id === entryId ? { ...entry, approved: true } : entry
        ));
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
      
      if (response.ok) {
        const result = await response.json();
        if (result.performance) {
          // Add the new performance to local state
          setPerformances(prev => [...prev, result.performance]);
        }
      } else {
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
        
        // Update local state instead of reloading
        setEntries(prev => prev.map(entry => 
          entry.id === entryId ? { ...entry, qualifiedForNationals: !currentStatus } : entry
        ));
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
        
        // Clear editing state first
        setEditingItemNumber(null);
        setTempItemNumber('');
        
        // Update both entries and performances state immediately
        setEntries(prev => prev.map(entry => 
          entry.id === entryId ? { ...entry, itemNumber: itemNumber } : entry
        ));
        
        // Also update performances state if there's a matching performance
        setPerformances(prev => prev.map(performance => 
          performance.eventEntryId === entryId ? { ...performance, itemNumber: itemNumber } : performance
        ));
        
        showAlert(result.message, 'success');
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

  const deleteEntry = async (entryId: string, itemName: string) => {
    if (deletingEntries.has(entryId)) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the entry "${itemName}"?\n\nThis will remove the entry and all associated performance data. This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setDeletingEntries(prev => new Set(prev).add(entryId));
    
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        showAlert('Session expired. Please log in again.', 'error');
        return;
      }
      
      const adminData = JSON.parse(session);
      
      const response = await fetch(`/api/admin/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: adminData.id
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        showAlert(result.message, 'success');
        
        // Remove entry from local state instead of reloading
        setEntries(prev => prev.filter(entry => entry.id !== entryId));
      } else {
        const error = await response.json();
        showAlert(`Failed to delete entry: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      showAlert('Failed to delete entry. Please try again.', 'error');
    } finally {
      setDeletingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
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
      // Import XLSX library
      const XLSX = await import('xlsx');
      
      if (entries.length === 0) {
        showAlert('No data to export', 'warning');
        return;
      }

      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare event information section
      const eventInfo = [
        ['EVENT DETAILS', '', '', '', '', '', '', '', '', '', ''],
        ['Event Name:', event?.name || '', '', '', '', '', '', '', '', '', ''],
        ['Event Date:', new Date(event?.eventDate || '').toLocaleDateString(), '', '', '', '', '', '', '', '', ''],
        ['Venue:', event?.venue || '', '', '', '', '', '', '', '', '', ''],
        ['Region:', event?.region || '', '', '', '', '', '', '', '', '', ''],
        ['Performance Type:', event?.performanceType || '', '', '', '', '', '', '', '', '', ''],
        ['Age Category:', event?.ageCategory || '', '', '', '', '', '', '', '', '', ''],
        ['Total Entries:', entries.length.toString(), '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', ''], // Empty row for separation
        ['PARTICIPANT ENTRIES', '', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', ''], // Empty row for separation
      ];

      // Prepare participant data with enhanced information
      const participantData = entries.map((entry) => {
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

        // Get participant names if available
        const participantNames = entry.participantNames?.join(', ') || 'Unknown';
        
        // Calculate age category based on performance type
        const performanceType = getPerformanceType(entry.participantIds);
        
        return [
          entry.itemNumber || 'Not Assigned',
          entry.eodsaId,
          entry.contestantName || 'Unknown',
          performanceType,
          entry.mastery,
          entry.itemStyle,
          event?.ageCategory || 'N/A',
          entry.participantIds?.length || 1,
          participantNames,
          entry.choreographer,
          entry.estimatedDuration || 'N/A',
          `R${feeBreakdown.registrationFee.toFixed(2)}`,
          `R${feeBreakdown.performanceFee.toFixed(2)}`,
          `R${entry.calculatedFee.toFixed(2)}`,
          entry.qualifiedForNationals ? 'Yes' : 'No',
          entry.paymentStatus.toUpperCase(),
          entry.approved ? 'APPROVED' : 'PENDING',
          new Date(entry.submittedAt).toLocaleDateString(),
          new Date(entry.submittedAt).toLocaleTimeString()
        ];
      });

      // Create headers for participant data
      const participantHeaders = [
        'Item Number',
        'EODSA ID',
        'Contestant Name',
        'Performance Type', 
        'Mastery Level',
        'Style',
        'Age Category',
        'No. of Participants',
        'Participant Names',
        'Choreographer',
        'Duration (min)',
        'Registration Fee',
        'Performance Fee',
        'Total Fee',
        'Qualified for Nationals',
        'Payment Status',
        'Entry Status',
        'Submitted Date',
        'Submitted Time'
      ];

      // Combine all data
      const fullData = [
        ...eventInfo,
        participantHeaders,
        ...participantData
      ];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(fullData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Item Number
        { wch: 12 }, // EODSA ID
        { wch: 20 }, // Contestant Name
        { wch: 15 }, // Performance Type
        { wch: 12 }, // Mastery Level
        { wch: 15 }, // Style
        { wch: 12 }, // Age Category
        { wch: 8 },  // No. of Participants
        { wch: 30 }, // Participant Names
        { wch: 20 }, // Choreographer
        { wch: 12 }, // Duration
        { wch: 15 }, // Registration Fee
        { wch: 15 }, // Performance Fee
        { wch: 12 }, // Total Fee
        { wch: 12 }, // Qualified for Nationals
        { wch: 12 }, // Payment Status
        { wch: 12 }, // Entry Status
        { wch: 12 }, // Submitted Date
        { wch: 12 }  // Submitted Time
      ];
      ws['!cols'] = colWidths;

      // Apply styles and borders
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      
      // Style the event info section (first 12 rows)
      for (let R = 0; R < 12; R++) {
        for (let C = 0; C <= 10; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          
          // Event details header styling
          if (R === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '4F46E5' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thick', color: { rgb: '000000' } },
                bottom: { style: 'thick', color: { rgb: '000000' } },
                left: { style: 'thick', color: { rgb: '000000' } },
                right: { style: 'thick', color: { rgb: '000000' } }
              }
            };
          }
          // Event info styling
          else if (R >= 1 && R <= 8) {
            ws[cellAddress].s = {
              font: { bold: C === 0, sz: 12 },
              fill: { fgColor: { rgb: C === 0 ? 'E0E7FF' : 'F8FAFC' } },
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
              }
            };
          }
          // Participant entries header styling
          else if (R === 10) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '059669' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thick', color: { rgb: '000000' } },
                bottom: { style: 'thick', color: { rgb: '000000' } },
                left: { style: 'thick', color: { rgb: '000000' } },
                right: { style: 'thick', color: { rgb: '000000' } }
              }
            };
          }
        }
      }

      // Style the participant data headers (row 12)
      for (let C = 0; C < participantHeaders.length; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 12, c: C });
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '7C3AED' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
      }

      // Style the participant data rows (starting from row 13)
      for (let R = 13; R <= range.e.r; R++) {
        for (let C = 0; C < participantHeaders.length; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[cellAddress]) {
            ws[cellAddress].s = {
              font: { sz: 10 },
              fill: { fgColor: { rgb: (R - 13) % 2 === 0 ? 'F8FAFC' : 'FFFFFF' } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: {
                top: { style: 'hair', color: { rgb: '000000' } },
                bottom: { style: 'hair', color: { rgb: '000000' } },
                left: { style: 'hair', color: { rgb: '000000' } },
                right: { style: 'hair', color: { rgb: '000000' } }
              }
            };
          }
        }
      }

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Event Participants');

      // Generate Excel file and download
      const fileName = `${event?.name || 'Event'}_Participants_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showAlert('Excel file downloaded successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showAlert('Failed to export data. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Withdrawal management functions
  const handleWithdrawPerformance = async (performanceId: string, title: string) => {
    if (withdrawingPerformances.has(performanceId)) return;
    
    const performance = performances.find(p => p.id === performanceId);
    const isWithdrawn = performance?.withdrawnFromJudging;
    
    const action = isWithdrawn ? 'restore' : 'withdraw';
    const actionText = isWithdrawn ? 'restore to judging' : 'withdraw from judging';
    
    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} "${title}"?\n\n${
        isWithdrawn 
          ? 'This will make the performance visible to judges again.'
          : 'This will hide the performance from judges and show it as unscored in admin view.'
      }`
    );
    
    if (!confirmed) return;
    
    setWithdrawingPerformances(prev => new Set(prev).add(performanceId));
    
    try {
      const response = await fetch(`/api/admin/performances/${performanceId}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        // Update local state optimistically
        setPerformances(prev => prev.map(p => 
          p.id === performanceId 
            ? { ...p, withdrawnFromJudging: action === 'withdraw' }
            : p
        ));
        
        showAlert(
          `Performance ${action === 'withdraw' ? 'withdrawn from' : 'restored to'} judging successfully!`, 
          'success'
        );
      } else {
        const error = await response.json();
        showAlert(`Failed to ${actionText}: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      showAlert(`Failed to ${actionText}`, 'error');
    } finally {
      setWithdrawingPerformances(prev => {
        const newSet = new Set(prev);
        newSet.delete(performanceId);
        return newSet;
      });
    }
  };

  // Score management functions
  const handleViewScores = async (performanceId: string, performanceTitle: string) => {
    setLoadingScores(true);
    setShowScoresModal(true);
    
    try {
      // Get scoring status for this performance
      const response = await fetch(`/api/scores/performance/${performanceId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPerformanceScores({
          performanceId,
          performanceTitle,
          ...data.scoringStatus
        });
      } else {
        showAlert('Failed to load performance scores', 'error');
        setShowScoresModal(false);
      }
    } catch (error) {
      console.error('Error loading scores:', error);
      showAlert('Failed to load performance scores', 'error');
      setShowScoresModal(false);
    } finally {
      setLoadingScores(false);
    }
  };

  const handleEditScore = async (performanceId: string, judgeId: string, judgeName: string) => {
    // This could open a score editing modal - for now just show a placeholder
    showAlert(`Score editing for ${judgeName} - Feature coming soon!`, 'info');
  };

  const handleDeleteScore = async (performanceId: string, judgeId: string, judgeName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${judgeName}'s score for this performance?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/scores/${performanceId}/${judgeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminReason: 'Score deleted by admin'
        }),
      });

      if (response.ok) {
        showAlert(`${judgeName}'s score deleted successfully`, 'success');
        // Refresh the scores view
        handleViewScores(performanceId, selectedPerformanceScores?.performanceTitle || '');
      } else {
        const error = await response.json();
        showAlert(`Failed to delete score: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting score:', error);
      showAlert('Failed to delete score', 'error');
    }
  };

  // Payment management functions
  const handlePaymentUpdate = (entry: EventEntry) => {
    setSelectedEntry(entry);
    setPaymentReference(entry.paymentReference || '');
    setPaymentMethod(entry.paymentMethod || 'bank_transfer');
    setShowPaymentModal(true);
  };

  const updatePaymentStatus = async (status: 'paid' | 'pending' | 'failed') => {
    if (!selectedEntry) return;
    
    setUpdatingPayment(true);
    
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        showAlert('Session expired. Please log in again.', 'error');
        return;
      }
      
      const adminData = JSON.parse(session);
      
      const response = await fetch(`/api/admin/entries/${selectedEntry.id}/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentStatus: status,
          paymentReference: status === 'paid' ? paymentReference : undefined,
          paymentMethod: status === 'paid' ? paymentMethod : undefined,
          adminId: adminData.id
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state
        setEntries(prev => prev.map(entry => 
          entry.id === selectedEntry.id 
            ? { 
                ...entry, 
                paymentStatus: status,
                paymentReference: status === 'paid' ? paymentReference : undefined,
                paymentMethod: status === 'paid' ? paymentMethod : undefined,
                paymentDate: status === 'paid' ? new Date().toISOString() : undefined
              }
            : entry
        ));
        
        showAlert(result.message, 'success');
        setShowPaymentModal(false);
        
        // Reset form
        setPaymentReference('');
        setPaymentMethod('bank_transfer');
        setSelectedEntry(null);
      } else {
        const error = await response.json();
        showAlert(`Failed to update payment: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      showAlert('Failed to update payment status', 'error');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const getOutstandingBalance = (entry: EventEntry) => {
    return entry.paymentStatus === 'paid' ? 0 : entry.calculatedFee;
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
    <>
      {/* Main Component Content would go here */}
      
      {/* Scores Management Modal */}
      {showScoresModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">🎯</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Performance Scores</h2>
                  <p className="text-gray-600">{selectedPerformanceScores?.performanceTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoresModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loadingScores ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading scores...</p>
              </div>
            ) : selectedPerformanceScores ? (
              <div className="space-y-6">
                {/* Scoring Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{selectedPerformanceScores.totalJudges}</div>
                      <div className="text-sm text-gray-600">Total Judges</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{selectedPerformanceScores.scoredJudges}</div>
                      <div className="text-sm text-gray-600">Scored</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{selectedPerformanceScores.pendingJudgeIds?.length || 0}</div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${selectedPerformanceScores.isFullyScored ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPerformanceScores.isFullyScored ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">Complete</div>
                    </div>
                  </div>
                </div>

                {/* Individual Scores */}
                {selectedPerformanceScores.scores && selectedPerformanceScores.scores.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Judge Scores</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judge</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedPerformanceScores.scores.map((score: any) => (
                            <tr key={score.judgeId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{score.judgeName}</div>
                                <div className="text-sm text-gray-500">ID: {score.judgeId}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-lg font-bold text-gray-900">{score.totalScore.toFixed(1)}/100</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{((score.totalScore / 100) * 100).toFixed(1)}%</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {new Date(score.submittedAt).toLocaleDateString()} {new Date(score.submittedAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditScore(selectedPerformanceScores.performanceId, score.judgeId, score.judgeName)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteScore(selectedPerformanceScores.performanceId, score.judgeId, score.judgeName)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">📝</div>
                    <p className="text-gray-600">No scores submitted yet</p>
                  </div>
                )}

                {/* Pending Judges */}
                {selectedPerformanceScores.pendingJudgeIds && selectedPerformanceScores.pendingJudgeIds.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Judges</h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm mb-2">The following judges have not submitted scores yet:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPerformanceScores.pendingJudgeIds.map((judgeId: string) => (
                          <span key={judgeId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Judge ID: {judgeId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-red-400 text-4xl mb-4">⚠️</div>
                <p className="text-gray-600">Failed to load scores</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}


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
                <p className="font-semibold text-gray-700">Entries</p>
                <p className="text-gray-700">{entries.length} total</p>
                {entries.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {getPerformanceStats().solo > 0 && `${getPerformanceStats().solo} Solo`}
                    {getPerformanceStats().duet > 0 && (getPerformanceStats().solo > 0 ? `, ${getPerformanceStats().duet} Duet` : `${getPerformanceStats().duet} Duet`)}
                    {getPerformanceStats().trio > 0 && (getPerformanceStats().solo > 0 || getPerformanceStats().duet > 0 ? `, ${getPerformanceStats().trio} Trio` : `${getPerformanceStats().trio} Trio`)}
                    {getPerformanceStats().group > 0 && (getPerformanceStats().solo > 0 || getPerformanceStats().duet > 0 || getPerformanceStats().trio > 0 ? `, ${getPerformanceStats().group} Group` : `${getPerformanceStats().group} Group`)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Performance Type Filter Tabs */}
        {entries.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-indigo-100 mb-6">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Performance Type</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPerformanceTypeFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    performanceTypeFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Entries ({entries.length})
                </button>
                {getPerformanceStats().solo > 0 && (
                  <button
                    onClick={() => setPerformanceTypeFilter('solo')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      performanceTypeFilter === 'solo'
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    Solo ({getPerformanceStats().solo})
                  </button>
                )}
                {getPerformanceStats().duet > 0 && (
                  <button
                    onClick={() => setPerformanceTypeFilter('duet')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      performanceTypeFilter === 'duet'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Duet ({getPerformanceStats().duet})
                  </button>
                )}
                {getPerformanceStats().trio > 0 && (
                  <button
                    onClick={() => setPerformanceTypeFilter('trio')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      performanceTypeFilter === 'trio'
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    Trio ({getPerformanceStats().trio})
                  </button>
                )}
                {getPerformanceStats().group > 0 && (
                  <button
                    onClick={() => setPerformanceTypeFilter('group')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      performanceTypeFilter === 'group'
                        ? 'bg-orange-600 text-white shadow-lg'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    Group ({getPerformanceStats().group})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-indigo-100 mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {performanceTypeFilter === 'all' 
                  ? 'All Participants & Entries' 
                  : `${performanceTypeFilter.charAt(0).toUpperCase() + performanceTypeFilter.slice(1)} Entries`
                }
              </h2>
              <div className="flex items-center space-x-3">
                <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                  {filteredEntries.length} entries
                </div>
                {filteredEntries.length > 0 && (
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                    {filteredEntries.filter(e => e.qualifiedForNationals).length} qualified
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table with Item Number column */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium mb-2">
                {performanceTypeFilter === 'all' 
                  ? 'No entries yet' 
                  : `No ${performanceTypeFilter} entries`
                }
              </h3>
              <p className="text-sm">
                {performanceTypeFilter === 'all'
                  ? 'Participants will appear here once they register for this event.'
                  : `No ${performanceTypeFilter} entries found. Try selecting "All Entries" to see other performance types.`
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item #</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Performance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Submitted</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {filteredEntries.map((entry) => {
                    const performanceType = getPerformanceType(entry.participantIds);
                    return (
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
                            {entry.itemNumber ? (
                              // When item number is assigned
                              <div className="space-y-1">
                                <div className="text-lg font-bold text-indigo-600">
                                  #{entry.itemNumber}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Click to reassign
                                </div>
                              </div>
                            ) : (
                              // When no item number is assigned
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-orange-600">
                                  Click to assign
                            </div>
                            <div className="text-xs text-gray-500">
                              Program Order
                            </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${getPerformanceTypeColor(performanceType)}`}>
                          {performanceType.toUpperCase()}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {entry.participantIds.length} participant{entry.participantIds.length !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{entry.itemName || 'Loading...'}</div>
                          <div className="text-sm text-gray-700">{entry.contestantName} • {entry.eodsaId}</div>
                          {/* Show all participant names for trio/group entries */}
                          {performanceType !== 'Solo' && entry.participantNames && entry.participantNames.length > 1 && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">Participants:</span>
                              <div className="text-gray-500">
                                {entry.participantNames.join(', ')}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-gray-500 sm:hidden mt-1">
                            {entry.mastery} • {entry.choreographer}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.itemName}</div>
                          <div className="text-sm text-gray-700">{entry.choreographer}</div>
                          <div className="text-xs text-gray-500">{entry.mastery} • {entry.itemStyle}</div>
                          {/* Show all participant names for multi-person entries */}
                          {performanceType !== 'Solo' && entry.participantNames && entry.participantNames.length > 0 && (
                            <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                              <span className="font-medium text-gray-700">Dancers:</span>
                              <div className="text-gray-600 mt-1">
                                {entry.participantNames.map((name, index) => (
                                  <div key={index} className="flex items-center space-x-1">
                                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                    <span>{name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex flex-col">
                            <div className="text-sm font-bold text-gray-900">R{entry.calculatedFee.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">Total Fee</div>
                          </div>
                          
                          <div className="flex flex-col">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(entry.paymentStatus)}`}>
                              {entry.paymentStatus.toUpperCase()}
                            </span>
                            {entry.paymentStatus === 'paid' && entry.paymentReference && (
                              <div className="text-xs text-gray-500 mt-1">
                                Ref: {entry.paymentReference}
                              </div>
                            )}
                            {entry.paymentStatus === 'paid' && entry.paymentDate && (
                              <div className="text-xs text-gray-500">
                                Paid: {new Date(entry.paymentDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {getOutstandingBalance(entry) > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <div className="text-xs font-medium text-red-800">Outstanding</div>
                              <div className="text-sm font-bold text-red-900">R{getOutstandingBalance(entry).toFixed(2)}</div>
                            </div>
                          )}

                          <button
                            onClick={() => handlePaymentUpdate(entry)}
                            className="w-full px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 transition-colors"
                          >
                            Manage Payment
                          </button>
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
                          <button
                            onClick={() => deleteEntry(entry.id, entry.itemName)}
                            disabled={deletingEntries.has(entry.id)}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 font-medium"
                          >
                            {deletingEntries.has(entry.id) ? 'Deleting...' : '🗑️ Delete Entry'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Scores</th>
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
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                            performance.withdrawnFromJudging 
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : performance.status === 'scheduled' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                performance.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                performance.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                                'bg-gray-100 text-gray-800 border-gray-200'
                          }`}>
                            {performance.withdrawnFromJudging 
                              ? 'WITHDRAWN' 
                              : performance.status.replace('_', ' ').toUpperCase()
                            }
                          </span>
                          {performance.withdrawnFromJudging && (
                            <span className="text-xs text-gray-500">
                              (Shows as unscored)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleWithdrawPerformance(performance.id, performance.title)}
                          disabled={withdrawingPerformances.has(performance.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            performance.withdrawnFromJudging
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-200'
                          } ${
                            withdrawingPerformances.has(performance.id)
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:shadow-sm'
                          }`}
                        >
                          {withdrawingPerformances.has(performance.id)
                            ? 'Processing...'
                            : performance.withdrawnFromJudging
                              ? 'Restore'
                              : 'Withdraw'
                          }
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewScores(performance.id, performance.title)}
                          className="px-3 py-1 text-xs font-medium rounded-lg transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 hover:shadow-sm"
                        >
                          View Scores
                        </button>
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

    {/* Scores Management Modal */}
    {showScoresModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">🎯</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Performance Scores</h2>
                  <p className="text-gray-600">{selectedPerformanceScores?.performanceTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoresModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loadingScores ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading scores...</p>
              </div>
            ) : selectedPerformanceScores ? (
              <div className="space-y-6">
                {/* Scoring Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{selectedPerformanceScores.totalJudges}</div>
                      <div className="text-sm text-gray-600">Total Judges</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{selectedPerformanceScores.scoredJudges}</div>
                      <div className="text-sm text-gray-600">Scored</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{selectedPerformanceScores.pendingJudgeIds?.length || 0}</div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${selectedPerformanceScores.isFullyScored ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPerformanceScores.isFullyScored ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">Complete</div>
                    </div>
                  </div>
                </div>

                {/* Individual Scores */}
                {selectedPerformanceScores.scores && selectedPerformanceScores.scores.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Judge Scores</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judge</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedPerformanceScores.scores.map((score: any) => (
                            <tr key={score.judgeId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{score.judgeName}</div>
                                <div className="text-sm text-gray-500">ID: {score.judgeId}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-lg font-bold text-gray-900">{score.totalScore.toFixed(1)}/100</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{((score.totalScore / 100) * 100).toFixed(1)}%</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">
                                  {new Date(score.submittedAt).toLocaleDateString()} {new Date(score.submittedAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditScore(selectedPerformanceScores.performanceId, score.judgeId, score.judgeName)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteScore(selectedPerformanceScores.performanceId, score.judgeId, score.judgeName)}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">📝</div>
                    <p className="text-gray-600">No scores submitted yet</p>
                  </div>
                )}

                {/* Pending Judges */}
                {selectedPerformanceScores.pendingJudgeIds && selectedPerformanceScores.pendingJudgeIds.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Judges</h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm mb-2">The following judges have not submitted scores yet:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPerformanceScores.pendingJudgeIds.map((judgeId: string) => (
                          <span key={judgeId} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Judge ID: {judgeId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-red-400 text-4xl mb-4">⚠️</div>
                <p className="text-gray-600">Failed to load scores</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Payment Management Modal */}
    {showPaymentModal && selectedEntry && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg">💳</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Payment Management</h2>
                  <p className="text-gray-600 text-sm">{selectedEntry.itemName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Current Payment Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Entry Fee:</span>
                  <span className="text-sm font-medium text-gray-900">R{selectedEntry.calculatedFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedEntry.paymentStatus)}`}>
                    {selectedEntry.paymentStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Outstanding:</span>
                  <span className={`text-sm font-bold ${getOutstandingBalance(selectedEntry) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    R{getOutstandingBalance(selectedEntry).toFixed(2)}
                  </span>
                </div>
                {selectedEntry.paymentReference && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Reference:</span>
                    <span className="text-sm text-gray-900">{selectedEntry.paymentReference}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction ID, Check number, etc."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Enter payment reference when marking as paid</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => updatePaymentStatus('paid')}
                disabled={updatingPayment}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
              >
                {updatingPayment ? 'Updating...' : 'Mark as Paid'}
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => updatePaymentStatus('pending')}
                  disabled={updatingPayment}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Mark Pending
                </button>
                
                <button
                  onClick={() => updatePaymentStatus('failed')}
                  disabled={updatingPayment}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Mark Failed
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
} 