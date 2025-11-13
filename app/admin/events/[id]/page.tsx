'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAlert } from '@/components/ui/custom-alert';
import { calculateEODSAFee } from '@/lib/types';
import { getSql } from '@/lib/database';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { calculateAgeOnDate, getAgeCategoryFromAge } from '@/lib/types';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
// Registration fee checking moved to API calls

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
  // Phase 2: Live/Virtual Entry Support
  entryType: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoFileUrl?: string;
  videoFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
  // Studio information
  studioName?: string;
  studioId?: string;
  studioEmail?: string;
  participantStudios?: string[];
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
  entryType?: 'live' | 'virtual';
  ageCategory?: string;
  eodsaId?: string;
  studioName?: string;
  studioId?: string;
  hasScores?: boolean; // Track if performance has been scored
}

function EventParticipantsPage() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [entries, setEntries] = useState<EventEntry[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [showDancersModal, setShowDancersModal] = useState(false);
  const [dancerModalEntry, setDancerModalEntry] = useState<EventEntry | null>(null);
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
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
  const [withdrawingPerformances, setWithdrawingPerformances] = useState<Set<string>>(new Set());
  const [selectedPerformanceScores, setSelectedPerformanceScores] = useState<any>(null);
  const [showScoresModal, setShowScoresModal] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'not_scored' | 'scored'>('all');
  const [performanceStats, setPerformanceStats] = useState({
    total: 0,
    live: 0,
    virtual: 0,
    judged: 0,
    notScored: 0
  });
  const performancesSectionRef = useRef<HTMLDivElement>(null);
  
  const scrollToPerformances = () => {
    performancesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EventEntry | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const { showAlert } = useAlert();
  // Entry Details modal state (for simplified UI)
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModal, setEntryModal] = useState<EventEntry | null>(null);
  const [entryModalTab, setEntryModalTab] = useState<'overview' | 'dancers' | 'payment'>('overview');

  // Determine performance type from participant count
  const getPerformanceType = (participantIds: string[]) => {
    const count = participantIds.length;
    if (count === 1) return 'Solo';
    if (count === 2) return 'Duet';
    if (count === 3) return 'Trio';
    if (count >= 4) return 'Group';
    return 'Unknown';
  };

  // Get performance type color - uses theme classes
  const getPerformanceTypeColor = (type: string) => {
    switch (type) {
      case 'Solo': return themeClasses.badgePurple;
      case 'Duet': return themeClasses.badgeBlue;
      case 'Trio': return themeClasses.badgeGreen;
      case 'Group': return themeClasses.badgeOrange;
      default: return themeClasses.badgeGray;
    }
  };

  // Payment status filter (all | paid | pending | unpaid)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'unpaid'>('all');

  // Filter entries by performance type, entry type, and payment status
  const filteredEntries = entries.filter(entry => {
    const performanceTypeMatch = performanceTypeFilter === 'all' || 
      getPerformanceType(entry.participantIds).toLowerCase() === performanceTypeFilter;
    const entryTypeMatch = entryTypeFilter === 'all' || 
      entry.entryType === entryTypeFilter;
    const paymentMatch = paymentFilter === 'all' ||
      (paymentFilter === 'paid' && entry.paymentStatus === 'paid') ||
      (paymentFilter === 'pending' && entry.paymentStatus === 'pending') ||
      (paymentFilter === 'unpaid' && (entry.paymentStatus === 'unpaid' || entry.paymentStatus === 'unpaid_invoice'));
    return performanceTypeMatch && entryTypeMatch && paymentMatch;
  });

  // Filter performances by scoring status
  const filteredPerformances = performances.filter(performance => {
    if (performanceFilter === 'all') return true;
    if (performanceFilter === 'not_scored') return !performance.hasScores && !performance.withdrawnFromJudging;
    if (performanceFilter === 'scored') return performance.hasScores;
    return true;
  });

  // Get performance type statistics
  const getPerformanceStats = () => {
    const stats = {
      solo: entries.filter(e => getPerformanceType(e.participantIds) === 'Solo').length,
      duet: entries.filter(e => getPerformanceType(e.participantIds) === 'Duet').length,
      trio: entries.filter(e => getPerformanceType(e.participantIds) === 'Trio').length,
      group: entries.filter(e => getPerformanceType(e.participantIds) === 'Group').length,
      live: entries.filter(e => e.entryType === 'live').length,
      virtual: entries.filter(e => e.entryType === 'virtual').length,
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
        const loadedPerformances = performancesData.performances || [];
        
        // Fetch scoring status for all performances and enrich with entry data
        const performancesWithScores = await Promise.all(
          loadedPerformances.map(async (perf: Performance) => {
            try {
              // Get entry data for eodsaId and studioName
              const entry = entries.find(e => e.id === perf.eventEntryId);
              
              const scoreResponse = await fetch(`/api/scores/performance/${perf.id}`);
              if (scoreResponse.ok) {
                const scoreData = await scoreResponse.json();
                return {
                  ...perf,
                  hasScores: scoreData.scoringStatus?.scoredJudges > 0,
                  eodsaId: entry?.eodsaId,
                  studioName: entry?.studioName,
                  studioId: entry?.studioId
                };
              }
              return { 
                ...perf, 
                hasScores: false,
                eodsaId: entry?.eodsaId,
                studioName: entry?.studioName,
                studioId: entry?.studioId
              };
            } catch (error) {
              console.error(`Error fetching scores for performance ${perf.id}:`, error);
              const entry = entries.find(e => e.id === perf.eventEntryId);
              return { 
                ...perf, 
                hasScores: false,
                eodsaId: entry?.eodsaId,
                studioName: entry?.studioName,
                studioId: entry?.studioId
              };
            }
          })
        );
        
        setPerformances(performancesWithScores);
        
        // Calculate statistics
        const stats = {
          total: performancesWithScores.length,
          live: performancesWithScores.filter((p: Performance) => (p.entryType || 'live') === 'live').length,
          virtual: performancesWithScores.filter((p: Performance) => p.entryType === 'virtual').length,
          judged: performancesWithScores.filter((p: Performance) => p.hasScores).length,
          notScored: performancesWithScores.filter((p: Performance) => !p.hasScores && !p.withdrawnFromJudging).length
        };
        setPerformanceStats(stats);
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
        
        // Close the entry modal if it's open
        setShowEntryModal(false);
        setEntryModal(null);
        
        // Show success message
        showAlert('Entry approved successfully!', 'success');
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
      pending: themeClasses.badgeYellow,
      paid: themeClasses.badgeGreen,
      failed: themeClasses.badgeRed,
      unpaid: themeClasses.badgeRed,
      unpaid_invoice: themeClasses.badgeRed,
      approved: themeClasses.badgeGreen,
      rejected: themeClasses.badgeRed
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
      const participantData = await Promise.all(entries.map(async (entry) => {
        // Try to calculate fee breakdown with smart registration checking
        let feeBreakdown;
        try {
          // Try smart calculation via API if we have participant IDs
          if (entry.participantIds && entry.participantIds.length > 0) {
            try {
              const response = await fetch('/api/eodsa-fees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  masteryLevel: entry.mastery,
                  performanceType: event?.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group' || 'Solo',
                  participantIds: entry.participantIds,
                  soloCount: 1,
                  includeRegistration: true
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                feeBreakdown = data.fees;
              } else {
                throw new Error('API call failed');
              }
            } catch (apiError) {
              console.error('API call failed, using basic calculation:', apiError);
              // Fallback to basic calculation
              feeBreakdown = calculateEODSAFee(
                entry.mastery,
                event?.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group' || 'Solo',
                entry.participantIds.length,
                {
                  soloCount: 1,
                  includeRegistration: true
                }
              );
            }
          } else {
            // Fallback to basic calculation
            feeBreakdown = calculateEODSAFee(
              entry.mastery,
              event?.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group' || 'Solo',
              entry.participantIds?.length || 1,
              {
                soloCount: 1,
                includeRegistration: true
              }
            );
          }
        } catch (error) {
          console.warn('Smart fee calculation failed, using basic calculation:', error);
          // Fallback to basic calculation
          feeBreakdown = calculateEODSAFee(
            entry.mastery,
            event?.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group' || 'Solo',
            entry.participantIds?.length || 1,
            {
              soloCount: 1,
              includeRegistration: true
            }
          );
        }

        // Get participant names if available
        const participantNames = entry.participantNames?.join(', ') || 'Unknown';
        
        // Calculate age category based on performance type
        const performanceType = getPerformanceType(entry.participantIds);
        
        // Calculate actual age category based on participants' ages.
        // Prefer server-supplied computedAgeCategory when available.
        let calculatedAgeCategory = (entry as any).computedAgeCategory || 'N/A';
        const needsClientCalc = !calculatedAgeCategory || ['n/a', 'all', 'all ages'].includes(String(calculatedAgeCategory).toLowerCase());
        if (needsClientCalc && entry.participantIds && entry.participantIds.length > 0) {
          try {
            // Get participant ages from the database
            const sqlClient = getSql();
            const participantAges = await Promise.all(
              entry.participantIds.map(async (participantId) => {
                try {
                  const dancerResult = await sqlClient`
                    SELECT date_of_birth FROM dancers 
                    WHERE id = ${participantId} OR eodsa_id = ${participantId}
                    LIMIT 1
                  ` as any[];
                  
                  if (dancerResult.length > 0 && dancerResult[0].date_of_birth) {
                    // Age should be calculated as of the event date for category grouping
                    const referenceDate = event?.eventDate ? new Date(event.eventDate) : new Date();
                    return calculateAgeOnDate(dancerResult[0].date_of_birth, referenceDate);
                  }
                  return null;
                } catch (error) {
                  console.warn(`Could not get age for participant ${participantId}:`, error);
                  return null;
                }
              })
            );
            
            // Filter out null values and calculate average age
            const validAges = participantAges.filter(age => age !== null) as number[];
            if (validAges.length > 0) {
              const averageAge = Math.round(validAges.reduce((sum, age) => sum + age, 0) / validAges.length);
              calculatedAgeCategory = getAgeCategoryFromAge(averageAge);
            }
          } catch (error) {
            console.warn('Error calculating age category for entry:', entry.id, error);
            calculatedAgeCategory = event?.ageCategory || 'N/A';
          }
        } else if (needsClientCalc) {
          calculatedAgeCategory = event?.ageCategory || 'N/A';
        }

        // Fallback to entry-provided ageCategory if calculation did not yield a bucket
        if (!calculatedAgeCategory || String(calculatedAgeCategory).toLowerCase() === 'n/a' || String(calculatedAgeCategory).toLowerCase() === 'all' || String(calculatedAgeCategory).toLowerCase() === 'all ages') {
          if ((entry as any).ageCategory && (entry as any).ageCategory !== 'All' && (entry as any).ageCategory !== 'All Ages') {
            calculatedAgeCategory = (entry as any).ageCategory;
          }
        }
        
        const entryTypeLabel = entry.entryType === 'virtual' ? 'VIRTUAL' : 'LIVE';
        return [
          entry.itemNumber || 'Not Assigned',
          entry.itemName || 'Untitled',
          entry.eodsaId,
          entry.contestantName || 'Unknown',
          performanceType,
          entryTypeLabel,
          entry.mastery,
          entry.itemStyle,
          calculatedAgeCategory,
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
      }));

      // Create headers for participant data
      const participantHeaders = [
        'Item Number',
        'Item Name',
        'EODSA ID',
        'Contestant Name',
        'Performance Type', 
        'Entry Type',
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
        { wch: 25 }, // Item Name
        { wch: 12 }, // EODSA ID
        { wch: 20 }, // Contestant Name
        { wch: 15 }, // Performance Type
        { wch: 12 }, // Entry Type
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
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        showAlert('Server returned invalid response. Please check the console.', 'error');
        setShowScoresModal(false);
        return;
      }
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSelectedPerformanceScores({
          performanceId,
          performanceTitle,
          ...data.scoringStatus
        });
      } else {
        // Handle error response
        const errorMessage = data.error || 'Failed to load performance scores';
        console.error('Error loading scores:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          data
        });
        
        if (response.status === 404) {
          showAlert('Performance not found or no scoring data available', 'warning');
        } else {
          showAlert(`Failed to load performance scores: ${errorMessage}`, 'error');
        }
        setShowScoresModal(false);
      }
    } catch (error) {
      console.error('Error loading scores:', error);
      if (error instanceof SyntaxError) {
        showAlert('Invalid response from server. Please check the console for details.', 'error');
      } else {
        showAlert('Network error loading performance scores. Please check the console for details.', 'error');
      }
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
    const themeClasses = getThemeClasses(theme);
    return (
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="relative mb-8">
            {/* Modern Spinner */}
            <div className="w-16 h-16 mx-auto">
              <div className={`absolute inset-0 rounded-full border-4 ${themeClasses.loadingSpinner}`}></div>
            </div>
            {/* Floating Dots */}
            <div className="absolute -top-6 -left-6 w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
            <div className="absolute -top-6 -right-6 w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <div className="absolute -bottom-6 -left-6 w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            <div className="absolute -bottom-6 -right-6 w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.6s'}}></div>
          </div>
          
          {/* Loading Text */}
          <div className="space-y-3">
            <h2 className={`text-2xl font-bold ${themeClasses.accentGradientText}`}>
              Loading Event Details
            </h2>
            <p className={`${themeClasses.loadingText} font-medium animate-pulse`}>Preparing participant data...</p>
            
            {/* Progress Dots */}
            <div className="flex justify-center space-x-2 mt-6">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
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
      <div className={`fixed inset-0 ${themeClasses.modalOverlay} flex items-center justify-center p-4 z-50`}>
        <div className={`${themeClasses.modalBg} ${themeClasses.cardRadius} shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${themeClasses.modalBorder}`}>
          <div className={`p-6 border-b ${themeClasses.modalBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center`}>
                  <span className="text-white text-lg">🎯</span>
                </div>
                <div>
                  <h2 className={`${themeClasses.heading3}`}>Performance Scores</h2>
                  <p className={`${themeClasses.textMuted} text-lg font-semibold mt-1`}>{selectedPerformanceScores?.performanceTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowScoresModal(false)}
                className={`${themeClasses.textMuted} hover:${themeClasses.textPrimary} p-2 rounded-lg hover:${themeClasses.tableHeader} transition-colors text-2xl`}
              >
                ×
              </button>
            </div>
          </div>
          
          <div className={themeClasses.cardPadding}>
            {loadingScores ? (
              <div className="text-center py-8">
                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'} mx-auto mb-4`}></div>
                <p className={themeClasses.loadingText}>Loading scores...</p>
              </div>
            ) : selectedPerformanceScores ? (
              <div className="space-y-6">
                {/* Scoring Overview */}
                <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-6`}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                    <div>
                      <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} mb-2`}>{selectedPerformanceScores.totalJudges || 0}</div>
                      <div className={`text-sm font-medium ${themeClasses.textSecondary}`}>Total Judges</div>
                    </div>
                    <div>
                      <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'} mb-2`}>{selectedPerformanceScores.scoredJudges || 0}</div>
                      <div className={`text-sm font-medium ${themeClasses.textSecondary}`}>Scored</div>
                    </div>
                    <div>
                      <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'} mb-2`}>{selectedPerformanceScores.pendingJudgeIds?.length || 0}</div>
                      <div className={`text-sm font-medium ${themeClasses.textSecondary}`}>Pending</div>
                    </div>
                    <div>
                      <div className={`text-3xl font-bold mb-2 ${selectedPerformanceScores.isFullyScored ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600')}`}>
                        {selectedPerformanceScores.isFullyScored ? '✓' : '✗'}
                      </div>
                      <div className={`text-sm font-medium ${themeClasses.textSecondary}`}>Complete</div>
                    </div>
                  </div>
                </div>

                {/* Individual Judge Scores - Combined scored and pending */}
                <div>
                  <h3 className={`${themeClasses.heading3} mb-4`}>Individual Judge Scores</h3>
                  <div className="overflow-x-auto">
                    <table className={`min-w-full ${themeClasses.tableBorder}`}>
                      <thead className={themeClasses.tableHeader}>
                        <tr>
                          <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Judge</th>
                          <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Total Score</th>
                          <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Submitted</th>
                        </tr>
                      </thead>
                      <tbody className={`${themeClasses.tableRow} ${themeClasses.tableBorder}`}>
                        {/* Scored Judges */}
                        {selectedPerformanceScores.scores && selectedPerformanceScores.scores.map((score: any) => (
                          <tr key={score.judgeId} className={themeClasses.tableRowHover}>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>{score.judgeName || 'Unknown Judge'}</div>
                              {score.judgeEmail && (
                                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>{score.judgeEmail}</div>
                              )}
                            </td>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>{score.totalScore.toFixed(1)}/100</div>
                            </td>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-sm ${themeClasses.textSecondary}`}>
                                {score.submittedAt 
                                  ? `${new Date(score.submittedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${new Date(score.submittedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                                  : 'N/A'
                                }
                              </div>
                            </td>
                          </tr>
                        ))}
                        
                        {/* Pending Judges */}
                        {selectedPerformanceScores.pendingJudges && selectedPerformanceScores.pendingJudges.map((pending: any) => (
                          <tr key={pending.judgeId} className={`${themeClasses.tableRowHover} opacity-75`}>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>{pending.judgeName || 'Unknown Judge'}</div>
                              {pending.judgeEmail && (
                                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>{pending.judgeEmail}</div>
                              )}
                            </td>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-sm font-medium ${themeClasses.textMuted} italic`}>Not yet scored</div>
                            </td>
                            <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                              <div className={`text-sm ${themeClasses.textMuted}`}>-</div>
                            </td>
                          </tr>
                        ))}
                        
                        {/* Show message if no judges at all */}
                        {(!selectedPerformanceScores.scores || selectedPerformanceScores.scores.length === 0) && 
                         (!selectedPerformanceScores.pendingJudges || selectedPerformanceScores.pendingJudges.length === 0) && (
                          <tr>
                            <td colSpan={3} className={`${themeClasses.tableCellPadding} text-center`}>
                              <div className={`${themeClasses.emptyStateText} text-4xl mb-4`}>📝</div>
                              <p className={themeClasses.emptyStateText}>No judges assigned or scores submitted yet</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-red-400 text-4xl mb-4">⚠️</div>
                <p className="text-gray-400">Failed to load scores</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}


    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Enhanced Header */}
      <header className={`${themeClasses.headerBg} backdrop-blur-lg shadow-xl border-b ${themeClasses.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-8">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-xl">👥</span>
              </div>
              <div>
                <h1 className={`text-3xl font-black ${themeClasses.accentGradientText}`}>
                  Event Participants
                </h1>
                <p className={`${themeClasses.textSecondary} font-medium`}>{event?.name || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              
              <Link
                href="/admin"
                className={`inline-flex items-center space-x-2 ${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`}
              >
                <span>←</span>
                <span>Back to Admin</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Details Card - Cleaned Up */}
        {event && (
          <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden border ${themeClasses.cardBorder} mb-8`}>
            <div className={`${themeClasses.sectionHeaderBg} px-6 py-5 border-b ${themeClasses.sectionHeaderBorder}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center shadow-lg`}>
                    <span className="text-white text-xl">🏆</span>
                  </div>
                  <div>
                    <h2 className={`${themeClasses.heading2} mb-1`}>{event.name}</h2>
                    <p className={`${themeClasses.body} ${themeClasses.textSecondary}`}>Event Information</p>
                  </div>
                </div>
                
                {/* Excel Export Button */}
                <button
                  onClick={exportToExcel}
                  disabled={isExporting || entries.length === 0}
                  className={`inline-flex items-center space-x-2 ${themeClasses.buttonBase} ${themeClasses.buttonSuccess} ${isExporting || entries.length === 0 ? themeClasses.buttonDisabled : ''}`}
                >
                  <span>📊</span>
                  <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
                </button>
              </div>
            </div>
            
            <div className={themeClasses.cardPadding}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 ${themeClasses.badgeBlue} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">📅</span>
                  </div>
                  <div>
                    <p className={`${themeClasses.label} mb-1`}>Event Date</p>
                    <p className={`text-base font-medium ${themeClasses.textPrimary}`}>
                      {new Date(event.eventDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 ${themeClasses.badgePurple} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">📍</span>
                  </div>
                  <div>
                    <p className={`${themeClasses.label} mb-1`}>Venue</p>
                    <p className={`text-base font-medium ${themeClasses.textPrimary}`}>{event.venue}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 ${themeClasses.badgeGreen} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">📝</span>
                  </div>
                  <div>
                    <p className={`${themeClasses.label} mb-1`}>Total Entries</p>
                    <p className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{entries.length}</p>
                    {entries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`${themeClasses.badgeBase} ${themeClasses.badgePurple}`}>
                          {getPerformanceStats().solo} Solo
                        </span>
                        <span className={`${themeClasses.badgeBase} ${themeClasses.badgeBlue}`}>
                          {getPerformanceStats().duet} Duet
                        </span>
                        {getPerformanceStats().trio > 0 && (
                          <span className={`${themeClasses.badgeBase} ${themeClasses.badgeGreen}`}>
                            {getPerformanceStats().trio} Trio
                          </span>
                        )}
                        {getPerformanceStats().group > 0 && (
                          <span className={`${themeClasses.badgeBase} ${themeClasses.badgeOrange}`}>
                            {getPerformanceStats().group} Group
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Summary Card */}
        {performances.length > 0 && (
          <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} border ${themeClasses.cardBorder} mb-8`}>
            <div className={`${themeClasses.sectionHeaderBg} px-6 py-5 border-b ${themeClasses.sectionHeaderBorder}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${themeClasses.iconContainerSecondary} ${themeClasses.cardRadius} flex items-center justify-center shadow-lg`}>
                    <span className="text-white text-xl">🎭</span>
                  </div>
                  <div>
                    <h2 className={`${themeClasses.heading2} mb-1`}>Performance Summary</h2>
                    <p className={`${themeClasses.body} ${themeClasses.textSecondary}`}>Scoring Overview & Statistics</p>
                  </div>
                </div>
                <button
                  onClick={scrollToPerformances}
                  className={`inline-flex items-center space-x-2 ${themeClasses.buttonBase} ${themeClasses.buttonSuccess}`}
                >
                  <span>View Performances</span>
                  <span>↓</span>
                </button>
              </div>
            </div>
            
            <div className={themeClasses.cardPadding}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-5 border ${themeClasses.metricCardBorder}`}>
                  <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} mb-2`}>{performanceStats.total}</div>
                  <div className={`text-sm font-medium ${themeClasses.textSecondary} mb-1`}>Total Performances</div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>
                    {performanceStats.live} Live • {performanceStats.virtual} Virtual
                  </div>
                </div>
                <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-5 border ${themeClasses.metricCardBorder}`}>
                  <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-600'} mb-2`}>{performanceStats.judged}</div>
                  <div className={`text-sm font-medium ${themeClasses.textSecondary} mb-1`}>Total Judged</div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>Items with scores</div>
                </div>
                <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-5 border ${themeClasses.metricCardBorder}`}>
                  <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'} mb-2`}>{performanceStats.notScored}</div>
                  <div className={`text-sm font-medium ${themeClasses.textSecondary} mb-1`}>Not Yet Scored</div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>Items missing scores</div>
                </div>
                <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-5 border ${themeClasses.metricCardBorder}`}>
                  <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} mb-2`}>
                    {performanceStats.total > 0 ? Math.round((performanceStats.judged / performanceStats.total) * 100) : 0}%
                  </div>
                  <div className={`text-sm font-medium ${themeClasses.textSecondary} mb-1`}>Completion Rate</div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>Scoring progress</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Participants List with Integrated Filters */}
        <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden border ${themeClasses.cardBorder} mb-8`}>
          <div className={`${themeClasses.sectionHeaderBg} px-6 py-4 border-b ${themeClasses.sectionHeaderBorder}`}>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={`${themeClasses.heading3}`}>
                  All Participants & Entries
                </h2>
                <div className="flex items-center space-x-3">
                  <div className={`${themeClasses.badgeBase} ${themeClasses.badgePurple}`}>
                    {filteredEntries.length} entries
                  </div>
                  {filteredEntries.length > 0 && (
                    <div className={`${themeClasses.badgeBase} ${themeClasses.badgeGreen}`}>
                      {filteredEntries.filter(e => e.qualifiedForNationals).length} qualified
                    </div>
                  )}
                </div>
              </div>
              
              {/* Integrated Filters */}
              {entries.length > 0 && (
                <div className={`flex flex-wrap items-center gap-3 pt-2 border-t ${themeClasses.cardBorder}`}>
                  <span className={`text-sm font-medium ${themeClasses.textSecondary}`}>Filters:</span>
                  
                  {/* Performance Type Filters */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPerformanceTypeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        performanceTypeFilter === 'all'
                          ? themeClasses.filterButtonActive
                          : themeClasses.filterButtonInactive
                      }`}
                    >
                      All ({entries.length})
                    </button>
                    {getPerformanceStats().solo > 0 && (
                      <button
                        onClick={() => setPerformanceTypeFilter('solo')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          performanceTypeFilter === 'solo'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-800/40' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        Solo ({getPerformanceStats().solo})
                      </button>
                    )}
                    {getPerformanceStats().duet > 0 && (
                      <button
                        onClick={() => setPerformanceTypeFilter('duet')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          performanceTypeFilter === 'duet'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/40' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        Duet ({getPerformanceStats().duet})
                      </button>
                    )}
                    {getPerformanceStats().trio > 0 && (
                      <button
                        onClick={() => setPerformanceTypeFilter('trio')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          performanceTypeFilter === 'trio'
                            ? 'bg-green-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-green-900/40 text-green-300 hover:bg-green-800/40' : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        Trio ({getPerformanceStats().trio})
                      </button>
                    )}
                    {getPerformanceStats().group > 0 && (
                      <button
                        onClick={() => setPerformanceTypeFilter('group')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          performanceTypeFilter === 'group'
                            ? 'bg-orange-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-orange-900/40 text-orange-300 hover:bg-orange-800/40' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        }`}
                      >
                        Group ({getPerformanceStats().group})
                      </button>
                    )}
                  </div>
                  
                  {/* Entry Type Filters */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEntryTypeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        entryTypeFilter === 'all'
                          ? themeClasses.filterButtonActive
                          : themeClasses.filterButtonInactive
                      }`}
                    >
                      All Types
                    </button>
                    {getPerformanceStats().live > 0 && (
                      <button
                        onClick={() => setEntryTypeFilter('live')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          entryTypeFilter === 'live'
                            ? 'bg-emerald-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/40' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        🎵 Live ({getPerformanceStats().live})
                      </button>
                    )}
                    {getPerformanceStats().virtual > 0 && (
                      <button
                        onClick={() => setEntryTypeFilter('virtual')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          entryTypeFilter === 'virtual'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : theme === 'dark' ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/40' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        📹 Virtual ({getPerformanceStats().virtual})
                      </button>
                    )}
                  </div>
                  
                  {/* Payment filter */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className={`text-xs font-medium ${themeClasses.textMuted}`}>Payment:</span>
                    <button
                      onClick={() => setPaymentFilter('all')}
                      className={`${themeClasses.badgeBase} border ${
                        paymentFilter === 'all'
                          ? theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-200 text-gray-900 border-gray-300'
                          : theme === 'dark' ? 'bg-gray-800/50 text-gray-300 border-gray-700 hover:bg-gray-700/50' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >All</button>
                    <button
                      onClick={() => setPaymentFilter('paid')}
                      className={`${themeClasses.badgeBase} border ${
                        paymentFilter === 'paid'
                          ? themeClasses.badgeGreen
                          : theme === 'dark' ? 'bg-gray-800/50 text-green-300 border-green-700/50 hover:bg-gray-700/50' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                      }`}
                    >Paid</button>
                    <button
                      onClick={() => setPaymentFilter('pending')}
                      className={`${themeClasses.badgeBase} border ${
                        paymentFilter === 'pending'
                          ? themeClasses.badgeYellow
                          : theme === 'dark' ? 'bg-gray-800/50 text-yellow-300 border-yellow-700/50 hover:bg-gray-700/50' : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                      }`}
                    >Pending</button>
                    <button
                      onClick={() => setPaymentFilter('unpaid')}
                      className={`${themeClasses.badgeBase} border ${
                        paymentFilter === 'unpaid'
                          ? themeClasses.badgeRed
                          : theme === 'dark' ? 'bg-gray-800/50 text-red-300 border-red-700/50 hover:bg-gray-700/50' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                      }`}
                    >Unpaid</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table with Item Number column */}
          {filteredEntries.length === 0 ? (
            <div className={`text-center py-12 ${themeClasses.emptyStateText}`}>
              <div className={`w-16 h-16 mx-auto mb-4 ${themeClasses.emptyStateBg} rounded-full flex items-center justify-center`}>
                <span className="text-2xl">📝</span>
              </div>
              <h3 className={`text-lg font-medium mb-2 ${themeClasses.textPrimary}`}>
                {performanceTypeFilter === 'all' && entryTypeFilter === 'all'
                  ? 'No entries yet' 
                  : `No ${performanceTypeFilter === 'all' ? '' : performanceTypeFilter + ' '}${entryTypeFilter === 'all' ? '' : entryTypeFilter + ' '}entries found`
                }
              </h3>
              <p className={themeClasses.body}>
                {performanceTypeFilter === 'all' && entryTypeFilter === 'all'
                  ? 'Participants will appear here once they register for this event.'
                  : 'Try adjusting your filters to see more entries.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`min-w-full ${themeClasses.tableBorder}`}>
                <thead className={themeClasses.tableHeader}>
                  <tr>
                    <th className={`px-3 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider w-24`}>Item #</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Performance</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Type</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Payment</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider hidden md:table-cell`}>Submitted</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Status</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`${themeClasses.tableRow} ${themeClasses.tableBorder}`}>
                  {filteredEntries.map((entry) => {
                    const performanceType = getPerformanceType(entry.participantIds);
                    return (
                    <tr key={entry.id} className={`${themeClasses.tableRow} ${themeClasses.tableRowHover} transition-colors duration-200`}>
                      <td className="px-3 py-4 whitespace-nowrap w-24">
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
                              className={`w-16 px-2 py-1 text-xs ${themeClasses.textPrimary} bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
                              placeholder="Item #"
                              min="1"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleItemNumberSave(entry.id)}
                                disabled={assigningItemNumbers.has(entry.id)}
                                className="px-2 py-1 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {assigningItemNumbers.has(entry.id) ? '...' : '✓'}
                              </button>
                              <button
                                onClick={handleItemNumberCancel}
                                className="px-2 py-1 text-[10px] bg-gray-500 text-white rounded hover:bg-gray-600"
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
                              <div className="space-y-0.5">
                                <div className="text-base font-bold text-indigo-600">
                                  #{entry.itemNumber}
                                </div>
                                <div className={`${themeClasses.textMuted} text-[10px]`}>
                                  Click to reassign
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-xs font-medium text-orange-600">
                                  Click to assign
                            </div>
                                <div className={`${themeClasses.textMuted} text-[10px]`}>
                              Program Order
                            </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      
                      {/* Performance column (now 2nd) */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className={`${themeClasses.textMuted} text-xs`}>
                            Studio: {entry.studioName || entry.contestantName || entry.eodsaId || 'N/A'}
                          </div>
                          <div className={`text-sm font-semibold ${themeClasses.textPrimary}`}>{entry.itemName}</div>
                          {entry.participantNames && entry.participantNames.length > 0 ? (
                            <div className={`${themeClasses.textSecondary} text-xs`}>
                              {entry.participantNames.join(', ')}
                            </div>
                          ) : (
                            <div className={`${themeClasses.textSecondary} text-xs`}>
                              {entry.participantIds.map((_, i) => `Participant ${i + 1}`).join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Type column (now 3rd) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${getPerformanceTypeColor(performanceType)}`}>
                            {performanceType.toUpperCase()}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className={`${themeClasses.badgeBase} border ${
                              entry.entryType === 'live' 
                                ? themeClasses.badgeGreen
                                : themeClasses.badgeBlue
                            }`}>
                              {entry.entryType === 'live' ? '🎵 LIVE' : '📹 VIRTUAL'}
                            </span>
                            <span className={`${themeClasses.textMuted} text-xs`}>
                              {entry.participantIds.length} participant{entry.participantIds.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      <td className={themeClasses.tableCellPadding}>
                        <div className="space-y-1">
                            <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>R{entry.calculatedFee.toFixed(2)}</div>
                            <span className={`${themeClasses.badgeBase} border ${getStatusBadge(entry.paymentStatus)}`}>
                              {entry.paymentStatus.toUpperCase()}
                            </span>
                        </div>
                      </td>
                      <td className={`${themeClasses.tableCellPadding} text-sm ${themeClasses.textSecondary} hidden md:table-cell`}>
                        {new Date(entry.submittedAt).toLocaleDateString()}
                      </td>
                      <td className={`${themeClasses.tableCellPadding} whitespace-nowrap`}>
                        <div className="flex flex-col space-y-1">
                          <span className={`${themeClasses.badgeBase} border ${
                            entry.approved ? themeClasses.badgeGreen : themeClasses.badgeYellow
                          }`}>
                            {entry.approved ? 'APPROVED' : 'PENDING'}
                          </span>
                          {entry.qualifiedForNationals && (
                            <span className={`${themeClasses.badgeBase} border ${themeClasses.badgePurple}`}>
                              QUALIFIED FOR NATIONALS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${themeClasses.tableCellPadding} whitespace-nowrap text-sm font-medium`}>
                            <button
                          onClick={() => { setEntryModal(entry); setEntryModalTab('overview'); setShowEntryModal(true); }}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${themeClasses.buttonPrimary}`}
                            >
                          View Details
                            </button>
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
        <div ref={performancesSectionRef} className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden border ${themeClasses.cardBorder} mt-8`}>
          <div className={`${themeClasses.sectionHeaderBg} px-6 py-4 border-b ${themeClasses.sectionHeaderBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${themeClasses.iconContainerSecondary} rounded-lg flex items-center justify-center`}>
                  <span className="text-white text-sm">🎭</span>
                </div>
                <h2 className={`${themeClasses.heading3}`}>Performances</h2>
              </div>
              <div className={`${themeClasses.badgeBase} ${themeClasses.badgeGreen}`}>
                {performances.length} performances
              </div>
            </div>
          </div>

          {performances.length === 0 ? (
            <div className={`text-center py-12 ${themeClasses.emptyStateText}`}>
              <div className={`w-16 h-16 mx-auto mb-4 ${themeClasses.emptyStateBg} rounded-full flex items-center justify-center`}>
                <span className="text-2xl">🎭</span>
              </div>
              <h3 className={`text-lg font-medium mb-2 ${themeClasses.textPrimary}`}>No performances yet</h3>
              <p className={themeClasses.body}>Performances are automatically created when entries are approved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Filter Buttons */}
              <div className={`${themeClasses.sectionHeaderBg} px-6 py-3 border-b ${themeClasses.sectionHeaderBorder} flex flex-wrap gap-2`}>
                <button
                  onClick={() => setPerformanceFilter('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    performanceFilter === 'all'
                      ? themeClasses.filterButtonActive
                      : themeClasses.filterButtonInactive
                  }`}
                >
                  All Performances
                </button>
                <button
                  onClick={() => setPerformanceFilter('not_scored')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    performanceFilter === 'not_scored'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : themeClasses.filterButtonInactive
                  }`}
                >
                  Items Not Scored ({performanceStats.notScored})
                </button>
                <button
                  onClick={() => setPerformanceFilter('scored')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    performanceFilter === 'scored'
                      ? 'bg-green-600 text-white shadow-lg'
                      : themeClasses.filterButtonInactive
                  }`}
                >
                  Items Scored ({performanceStats.judged})
                </button>
              </div>
              
              <table className={`min-w-full ${themeClasses.tableBorder}`}>
                <thead className={themeClasses.tableHeader}>
                  <tr>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Performance</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden sm:table-cell`}>Participants</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Age</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Status</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                    <th className={`${themeClasses.tableCellPadding} text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Scores</th>
                  </tr>
                </thead>
                <tbody className={`${themeClasses.tableRow} ${themeClasses.tableBorder}`}>
                  {filteredPerformances.map((performance) => {
                    const entry = entries.find(e => e.id === performance.eventEntryId);
                    return (
                    <tr key={performance.id} className={themeClasses.tableRowHover}>
                      <td className={themeClasses.tableCellPadding}>
                        <div>
                          <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{performance.title}</div>
                          <div className={`text-sm ${themeClasses.textSecondary}`}>
                            {performance.contestantName || 'Unknown'}
                            {performance.eodsaId && (
                              <span className={`text-xs ${themeClasses.textMuted} ml-2`}>({performance.eodsaId})</span>
                            )}
                          </div>
                          {performance.studioName && (
                            <div className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} mt-1`}>
                              {performance.studioId ? (
                                <Link 
                                  href={`/admin/studios/${performance.studioId}`}
                                  className="hover:underline"
                                >
                                  {performance.studioName}
                                </Link>
                              ) : (
                                performance.studioName
                              )}
                            </div>
                          )}
                          <div className={`text-xs ${themeClasses.textMuted} mt-1`}>{performance.mastery} • {performance.itemStyle}</div>
                        </div>
                      </td>
                      <td className={`${themeClasses.tableCellPadding} hidden sm:table-cell`}>
                        <div className={`text-sm ${themeClasses.textSecondary}`}>
                          {performance.participantNames.join(', ')}
                        </div>
                      </td>
                      <td className={themeClasses.tableCellPadding}>
                        <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>
                          {performance.ageCategory || 'N/A'}
                        </div>
                      </td>
                      <td className={themeClasses.tableCellPadding}>
                        <div className="flex flex-col space-y-1">
                          <span className={`${themeClasses.badgeBase} border ${
                            performance.withdrawnFromJudging 
                              ? themeClasses.badgeRed
                              : performance.status === 'scheduled' ? themeClasses.badgeBlue :
                                performance.status === 'in_progress' ? themeClasses.badgeYellow :
                                performance.status === 'completed' ? themeClasses.badgeGreen :
                                themeClasses.badgeGray
                          }`}>
                            {performance.withdrawnFromJudging 
                              ? 'WITHDRAWN' 
                              : performance.status.replace('_', ' ').toUpperCase()
                            }
                          </span>
                          {performance.withdrawnFromJudging && (
                            <span className={`text-xs ${themeClasses.textMuted}`}>
                              (Shows as unscored)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={themeClasses.tableCellPadding}>
                        <button
                          onClick={() => handleWithdrawPerformance(performance.id, performance.title)}
                          disabled={withdrawingPerformances.has(performance.id)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors border ${
                            performance.withdrawnFromJudging
                              ? themeClasses.badgeGreen
                              : themeClasses.badgeRed
                          } ${
                            withdrawingPerformances.has(performance.id)
                              ? themeClasses.buttonDisabled
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
                      <td className={themeClasses.tableCellPadding}>
                        <button
                          onClick={() => handleViewScores(performance.id, performance.title)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors border ${themeClasses.badgeBlue} hover:shadow-sm`}
                        >
                          View Scores
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Dancers Modal */}
    {showDancersModal && dancerModalEntry && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="p-5 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Dancers for {dancerModalEntry.itemName}</h3>
              <p className="text-sm text-gray-400">Studio/Contestant: {dancerModalEntry.contestantName || dancerModalEntry.studioName || dancerModalEntry.eodsaId}</p>
            </div>
            <button onClick={() => setShowDancersModal(false)} className="text-gray-400 hover:text-gray-400 p-2 rounded-lg hover:bg-gray-100 transition-colors">×</button>
          </div>
          <div className="p-5 space-y-3">
            {(dancerModalEntry.participantNames && dancerModalEntry.participantNames.length > 0
              ? dancerModalEntry.participantNames
              : (dancerModalEntry.participantIds || []).map((_, i) => `Participant ${i + 1}`)
            ).map((name, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="font-medium text-white">{name}</div>
                <div className="text-blue-700 text-xs bg-blue-50 px-2 py-1 rounded">
                  {dancerModalEntry.participantStudios?.[idx] || dancerModalEntry.studioName || 'Independent'}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200 text-right">
            <button onClick={() => setShowDancersModal(false)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Close</button>
          </div>
        </div>
      </div>
    )}

    {/* Payment Management Modal */}
    {showPaymentModal && selectedEntry && (
      <div className={`fixed inset-0 ${themeClasses.modalOverlay} flex items-center justify-center p-4 z-50`}>
        <div className={`${themeClasses.modalBg} ${themeClasses.cardRadius} shadow-2xl max-w-lg w-full border ${themeClasses.modalBorder}`}>
          {/* Header */}
          <div className={`p-6 border-b ${themeClasses.modalBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 ${themeClasses.iconContainerSecondary} ${themeClasses.cardRadius} flex items-center justify-center shadow-lg`}>
                  <span className="text-white text-xl">💳</span>
                </div>
                <div>
                  <h2 className={`${themeClasses.heading3}`}>Payment Management</h2>
                  <p className={`${themeClasses.textMuted} text-sm font-medium mt-0.5`}>{selectedEntry.itemName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className={`${themeClasses.textMuted} hover:${themeClasses.textPrimary} p-2 rounded-lg hover:${themeClasses.tableHeader} transition-colors`}
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>
          
          <div className={`${themeClasses.cardPadding} space-y-6`}>
            {/* Current Payment Status Card */}
            <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-5 border ${themeClasses.metricCardBorder}`}>
              <h3 className={`${themeClasses.heading3} mb-4`}>Current Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${themeClasses.textSecondary}`}>Entry Fee:</span>
                  <span className={`text-base font-bold ${themeClasses.textPrimary}`}>R{selectedEntry.calculatedFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${themeClasses.textSecondary}`}>Status:</span>
                  <span className={`${themeClasses.badgeBase} border ${getStatusBadge(selectedEntry.paymentStatus)}`}>
                    {selectedEntry.paymentStatus.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${themeClasses.textSecondary}`}>Outstanding:</span>
                  <span className={`text-base font-bold ${getOutstandingBalance(selectedEntry) > 0 ? (theme === 'dark' ? 'text-red-400' : 'text-red-600') : (theme === 'dark' ? 'text-green-400' : 'text-green-600')}`}>
                    R{getOutstandingBalance(selectedEntry).toFixed(2)}
                  </span>
                </div>
                {selectedEntry.paymentReference && (
                  <div className={`flex justify-between items-center pt-2 border-t ${themeClasses.cardBorder}`}>
                    <span className={`text-sm font-medium ${themeClasses.textSecondary}`}>Reference:</span>
                    <span className={`text-sm font-medium ${themeClasses.textPrimary} break-all text-right ml-4`}>
                      {selectedEntry.paymentReference}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-4">
              <div>
                <label className={`block ${themeClasses.label} mb-2`}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`w-full p-3 ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.cardRadius} ${themeClasses.inputFocus} ${themeClasses.textPrimary}`}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>

              <div>
                <label className={`block ${themeClasses.label} mb-2`}>Payment Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Transaction ID, Check number, etc."
                  className={`w-full p-3 ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.cardRadius} ${themeClasses.inputFocus} ${themeClasses.textPrimary} placeholder:${themeClasses.textMuted}`}
                />
                <p className={`text-xs ${themeClasses.textMuted} mt-2`}>
                  Enter payment reference when marking as paid
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => updatePaymentStatus('paid')}
                disabled={updatingPayment}
                className={`w-full ${themeClasses.buttonBase} ${themeClasses.buttonSuccess} ${updatingPayment ? themeClasses.buttonDisabled : ''}`}
              >
                {updatingPayment ? 'Updating...' : 'Mark as Paid'}
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => updatePaymentStatus('pending')}
                  disabled={updatingPayment}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${themeClasses.badgeYellow} hover:shadow-md ${updatingPayment ? themeClasses.buttonDisabled : ''}`}
                >
                  Mark Pending
                </button>
                
                <button
                  onClick={() => updatePaymentStatus('failed')}
                  disabled={updatingPayment}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ${themeClasses.badgeRed} hover:shadow-md ${updatingPayment ? themeClasses.buttonDisabled : ''}`}
                >
                  Mark Failed
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <div className={`pt-4 border-t ${themeClasses.modalBorder}`}>
              <button
                onClick={() => setShowPaymentModal(false)}
                className={`w-full px-4 py-2 ${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors font-medium`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Entry Details Modal - simplified view to reduce on-page clutter */}
    {showEntryModal && entryModal && (
      <div className={`fixed inset-0 ${themeClasses.modalOverlay} flex items-center justify-center p-4 z-50`}>
        <div className={`${themeClasses.modalBg} ${themeClasses.cardRadius} shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border ${themeClasses.modalBorder}`}>
          <div className={`p-6 border-b ${themeClasses.modalBorder} flex items-center justify-between`}>
            <div className="space-y-1">
              <h2 className={`${themeClasses.heading3}`}>Entry Details</h2>
              <p className={`${themeClasses.textMuted} text-sm`}>{entryModal.itemName}</p>
            </div>
            <button 
              onClick={() => setShowEntryModal(false)} 
              className={`${themeClasses.textMuted} hover:${themeClasses.textPrimary} p-2 rounded-lg hover:${themeClasses.tableHeader} transition-colors`}
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex gap-2">
              <button
                onClick={() => setEntryModalTab('overview')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  entryModalTab === 'overview'
                    ? `${themeClasses.filterButtonActive} shadow-lg`
                    : themeClasses.filterButtonInactive
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setEntryModalTab('dancers')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  entryModalTab === 'dancers'
                    ? `${themeClasses.filterButtonActive} shadow-lg`
                    : themeClasses.filterButtonInactive
                }`}
              >
                Dancers
              </button>
              <button
                onClick={() => setEntryModalTab('payment')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  entryModalTab === 'payment'
                    ? `${themeClasses.filterButtonActive} shadow-lg`
                    : themeClasses.filterButtonInactive
                }`}
              >
                Payment
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className={themeClasses.cardPadding}>
            {entryModalTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Item #</div>
                    <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>{entryModal.itemNumber ?? 'Not assigned'}</div>
                  </div>
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Type</div>
                    <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>{getPerformanceType(entryModal.participantIds)} • {entryModal.entryType.toUpperCase()}</div>
                  </div>
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Mastery / Style</div>
                    <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>{entryModal.mastery} • {entryModal.itemStyle}</div>
                  </div>
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Submitted</div>
                    <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>{new Date(entryModal.submittedAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!entryModal.approved && (
                    <button
                      onClick={() => approveEntry(entryModal.id)}
                      disabled={approvingEntries.has(entryModal.id)}
                      className={`${themeClasses.buttonBase} ${themeClasses.buttonSuccess} ${approvingEntries.has(entryModal.id) ? themeClasses.buttonDisabled : ''}`}
                    >
                      {approvingEntries.has(entryModal.id) ? 'Approving...' : 'Approve'}
                    </button>
                  )}
                  {entryModal.approved && (
                    <button
                      onClick={() => toggleQualification(entryModal.id, entryModal.qualifiedForNationals)}
                      disabled={qualifyingEntries.has(entryModal.id)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        entryModal.qualifiedForNationals
                          ? `${themeClasses.buttonBase} bg-purple-600 text-white hover:bg-purple-700`
                          : `${themeClasses.buttonSecondary}`
                      } ${qualifyingEntries.has(entryModal.id) ? themeClasses.buttonDisabled : ''}`}
                    >
                      {qualifyingEntries.has(entryModal.id) ? 'Updating...' : (entryModal.qualifiedForNationals ? 'Qualified ✓' : 'Qualify for Nationals')}
                    </button>
                  )}
                  <button
                    onClick={() => deleteEntry(entryModal.id, entryModal.itemName)}
                    disabled={deletingEntries.has(entryModal.id)}
                    className={`px-3 py-2 ${themeClasses.badgeRed} rounded-lg hover:shadow-sm transition-all ${deletingEntries.has(entryModal.id) ? themeClasses.buttonDisabled : ''}`}
                  >
                    {deletingEntries.has(entryModal.id) ? 'Deleting...' : 'Delete Entry'}
                  </button>
                </div>
              </div>
            )}

            {entryModalTab === 'dancers' && (
              <div className="space-y-3">
                {(entryModal.participantNames && entryModal.participantNames.length>0 ? entryModal.participantNames : (entryModal.participantIds||[]).map((_,i)=>`Participant ${i+1}`)).map((n, i) => (
                  <div key={i} className={`flex items-center justify-between text-sm ${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-3 border ${themeClasses.metricCardBorder}`}>
                    <div className={`font-medium ${themeClasses.textPrimary}`}>{n}</div>
                    <div className={`${themeClasses.badgeBase} ${themeClasses.badgeBlue}`}>
                      {entryModal.participantStudios?.[i] || entryModal.studioName || 'Independent'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {entryModalTab === 'payment' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Total Fee</div>
                    <div className={`text-lg font-bold ${themeClasses.textPrimary}`}>R{entryModal.calculatedFee.toFixed(2)}</div>
                  </div>
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Status</div>
                    <div className={`${themeClasses.badgeBase} border ${getStatusBadge(entryModal.paymentStatus)}`}>
                      {entryModal.paymentStatus.toUpperCase()}
                    </div>
                  </div>
                  <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} p-4 border ${themeClasses.metricCardBorder}`}>
                    <div className={`text-sm ${themeClasses.textMuted} mb-1`}>Outstanding</div>
                    <div className={`text-lg font-bold ${getOutstandingBalance(entryModal) > 0 ? (theme === 'dark' ? 'text-red-400' : 'text-red-600') : (theme === 'dark' ? 'text-green-400' : 'text-green-600')}`}>
                      R{getOutstandingBalance(entryModal).toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setShowEntryModal(false); handlePaymentUpdate(entryModal); }}
                  className={`${themeClasses.buttonBase} ${themeClasses.buttonPrimary}`}
                >
                  Manage Payment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Wrap the EventParticipantsPage with ThemeProvider
export default function EventParticipantsPageWrapper() {
  return (
    <ThemeProvider>
      <EventParticipantsPage />
    </ThemeProvider>
  );
} 