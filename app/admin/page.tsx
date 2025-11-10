'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, PERFORMANCE_TYPES, AGE_CATEGORIES, EODSA_FEES } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { useAlert } from '@/components/ui/custom-alert';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface Event {
  id: string;
  name: string;
  description: string;
  region: string;
  ageCategory: string;
  performanceType: string;
  eventDate: string;
  eventEndDate?: string;
  registrationDeadline: string;
  venue: string;
  status: string;
  maxParticipants?: number;
  entryFee: number;
  createdBy: string;
  createdAt: string;
  // Fee configuration
  registrationFeePerDancer?: number;
  solo1Fee?: number;
  solo2Fee?: number;
  solo3Fee?: number;
  soloAdditionalFee?: number;
  duoTrioFeePerDancer?: number;
  groupFeePerDancer?: number;
  largeGroupFeePerDancer?: number;
  currency?: string;
}

interface Judge {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  specialization?: string[];
  createdAt: string;
}

interface JudgeAssignment {
  id: string;
  judgeId: string;
  eventId: string;
  judgeName: string;
  judgeEmail: string;
  eventName: string;
  eventDate?: string;
}

interface Dancer {
  id: string;
  eodsaId: string;
  name: string;
  age: number;
  dateOfBirth: string;
  nationalId: string;
  email?: string;
  phone?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  approvedByName?: string;
  createdAt: string;
  // Registration fee tracking
  registrationFeePaid?: boolean;
  registrationFeePaidAt?: string;
  registrationFeeMasteryLevel?: string;
  // Studio information
  studioName?: string;
  studioId?: string;
  studioEmail?: string;
}

interface Studio {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  allowedDashboards: string[];
  canViewAllEvents: boolean;
  allowedEventIds: string[];
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  createdBy?: string;
  lastLoginAt?: string;
  notes?: string;
}

interface StudioApplication {
  id: string;
  dancerId: string;
  studioId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  appliedAt: string;
  respondedAt?: string;
  respondedBy?: string;
  rejectionReason?: string;
  dancer: {
    eodsaId: string;
    name: string;
    age: number;
    approved: boolean;
  };
  studio: {
    name: string;
    registrationNumber: string;
  };
}

function AdminDashboard() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const [events, setEvents] = useState<Event[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [studioApplications, setStudioApplications] = useState<StudioApplication[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'staff' | 'assignments' | 'dancers' | 'studios' | 'sound-tech' | 'music-tracking' | 'clients'>('events');
  const [isLoading, setIsLoading] = useState(true);
  const { success, error, warning, info } = useToast();
  const { showAlert, showConfirm, showPrompt } = useAlert();
  
  // Event creation state
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    region: 'Nationals',
    eventDate: '',
    eventEndDate: '',
    registrationDeadline: '',
    venue: '',
    entryFee: 0,
    registrationFeePerDancer: 0,
    solo1Fee: 0,
    solo2Fee: 0,
    solo3Fee: 0,
    soloAdditionalFee: 0,
    duoTrioFeePerDancer: 0,
    groupFeePerDancer: 0,
    largeGroupFeePerDancer: 0,
    currency: 'ZAR'
  });
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Client creation state
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    allowedDashboards: [] as string[],
    canViewAllEvents: false,
    allowedEventIds: [] as string[],
    notes: ''
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createEventMessage, setCreateEventMessage] = useState('');

  // Judge creation state
  const [newJudge, setNewJudge] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false
  });
  const [isCreatingJudge, setIsCreatingJudge] = useState(false);
  const [createJudgeMessage, setCreateJudgeMessage] = useState('');

  // Assignment state
  const [assignment, setAssignment] = useState({
    judgeId: '',
    eventId: ''
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [reassigningJudges, setReassigningJudges] = useState<Set<string>>(new Set());
  const [unassigningJudges, setUnassigningJudges] = useState<Set<string>>(new Set());

  // Database cleaning state
  const [isCleaningDatabase, setIsCleaningDatabase] = useState(false);
  const [cleanDatabaseMessage, setCleanDatabaseMessage] = useState('');


  // Email testing state
  const [emailTestResults, setEmailTestResults] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Music tracking state
  const [musicTrackingData, setMusicTrackingData] = useState<any[]>([]);
  const [loadingMusicTracking, setLoadingMusicTracking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState<'all' | 'live' | 'virtual'>('all');
  const [uploadStatusFilter, setUploadStatusFilter] = useState<'all' | 'uploaded' | 'missing' | 'no_video'>('all');
  const [activeBackendFilter, setActiveBackendFilter] = useState<'all' | 'live' | 'virtual'>('all');
  const [videoLinkDrafts, setVideoLinkDrafts] = useState<Record<string, string>>({});
  const [selectedMusicTrackingEventId, setSelectedMusicTrackingEventId] = useState<string>('all');

  // Dancer search and filter state
  const [dancerSearchTerm, setDancerSearchTerm] = useState('');
  const [dancerStatusFilter, setDancerStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Studio search and filter state
  const [studioSearchTerm, setStudioSearchTerm] = useState('');
  const [studioStatusFilter, setStudioStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Modal states
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showCreateJudgeModal, setShowCreateJudgeModal] = useState(false);
  const [showJudgePassword, setShowJudgePassword] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [selectedDancerFinances, setSelectedDancerFinances] = useState<any>(null);
  const [loadingFinances, setLoadingFinances] = useState(false);
  const [showAssignJudgeModal, setShowAssignJudgeModal] = useState(false);
  const [showEmailTestModal, setShowEmailTestModal] = useState(false);

  // Edit event state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventData, setEditEventData] = useState({
    name: '',
    description: '',
    region: 'Nationals',
    eventDate: '',
    eventEndDate: '',
    registrationDeadline: '',
    venue: '',
    status: 'upcoming',
    // Fee configuration fields - NO HARDCODED DEFAULTS
    registrationFeePerDancer: 0,
    solo1Fee: 0,
    solo2Fee: 0,
    solo3Fee: 0,
    soloAdditionalFee: 0,
    duoTrioFeePerDancer: 0,
    groupFeePerDancer: 0,
    largeGroupFeePerDancer: 0,
    currency: 'ZAR'
  });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [updateEventMessage, setUpdateEventMessage] = useState('');
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const router = useRouter();

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
    
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [eventsRes, judgesRes, assignmentsRes, dancersRes, studiosRes, applicationsRes, clientsRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/judges'),
        fetch('/api/judge-assignments/nationals-view'),
        fetch('/api/admin/dancers'),
        fetch('/api/admin/studios'),
        fetch('/api/admin/studio-applications'),
        fetch('/api/clients')
      ]);

      const eventsData = await eventsRes.json();
      const judgesData = await judgesRes.json();
      const assignmentsData = await assignmentsRes.json();
      const dancersData = await dancersRes.json();
      const studiosData = await studiosRes.json();
      const applicationsData = await applicationsRes.json();
      const clientsData = await clientsRes.json();

      if (eventsData.success) setEvents(eventsData.events);
      if (judgesData.success) setJudges(judgesData.judges);
      if (assignmentsData.success) setAssignments(assignmentsData.assignments);
      if (dancersData.success) setDancers(dancersData.dancers);
      if (studiosData.success) setStudios(studiosData.studios);
      if (applicationsData.success) setStudioApplications(applicationsData.applications);
      if (clientsData.success) setClients(clientsData.clients);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMusicTrackingData = async (filters?: { entryType?: 'live' | 'virtual'; eventId?: string }) => {
    setLoadingMusicTracking(true);
    try {
      // Update the active backend filter state
      const filterType = filters?.entryType || 'all';
      setActiveBackendFilter(filterType);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.entryType) {
        params.append('entryType', filters.entryType);
      }
      if (filters?.eventId) {
        params.append('eventId', filters.eventId);
      }
      
      const queryString = params.toString();
      const url = `/api/admin/music-tracking${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setMusicTrackingData(data.entries);
      } else {
        error('Failed to load music tracking data');
      }
    } catch (err) {
      console.error('Error fetching music tracking data:', err);
      error('Failed to load music tracking data');
    } finally {
      setLoadingMusicTracking(false);
    }
  };

  const bulkClearMusic = async () => {
    const targets = musicTrackingData.filter(e => e.entryType === 'live' && !e.videoExternalUrl && !e.musicFileUrl);
    if (targets.length === 0) {
      warning('No live entries without music in current filter');
      return;
    }
    if (!confirm(`Remove music from ${targets.length} entries? This allows contestants to re-upload.`)) return;

    try {
      const session = localStorage.getItem('adminSession');
      const adminId = session ? JSON.parse(session).id : undefined;
      if (!adminId) { error('Admin session required'); return; }

      let done = 0, failed = 0;
      for (const entry of targets) {
        try {
          await fetch(`/api/admin/entries/${entry.id}/remove-music`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId })
          });
          done++;
        } catch {
          failed++;
        }
      }
      info(`Cleared ${done} entries${failed ? `, ${failed} failed` : ''}`);
      await fetchMusicTrackingData({ entryType: activeBackendFilter === 'all' ? undefined : activeBackendFilter });
    } catch (e) {
      error('Bulk clear failed');
    }
  };

  const bulkClearVideos = async () => {
    const targets = musicTrackingData.filter(e => e.entryType === 'virtual' && e.videoExternalUrl);
    if (targets.length === 0) { warning('No virtual entries with links in current filter'); return; }
    if (!confirm(`Remove video links from ${targets.length} entries?`)) return;
    try {
      let done = 0, failed = 0;
      for (const entry of targets) {
        try {
          const res = await fetch(`/api/admin/entries/${entry.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoExternalUrl: '' })
          });
          if (res.ok) done++; else failed++;
        } catch { failed++; }
      }
      info(`Cleared ${done} video links${failed ? `, ${failed} failed` : ''}`);
      await fetchMusicTrackingData({ entryType: activeBackendFilter === 'all' ? undefined : activeBackendFilter });
    } catch { error('Bulk clear videos failed'); }
  };

  const exportProgramCsv = () => {
    const rows = [['Item #','Item Name','Contestant','Participants','Type','Style','Level','Event','Music','Video']];
    for (const e of musicTrackingData) {
      rows.push([
        e.itemNumber || '',
        e.itemName || '',
        e.contestantName || '',
        Array.isArray(e.participantNames) ? e.participantNames.join('; ') : '',
        e.entryType || '',
        e.itemStyle || '',
        e.mastery || '',
        e.eventName || '',
        e.musicFileUrl ? 'Yes' : 'No',
        e.videoExternalUrl ? 'Yes' : 'No'
      ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'program-order.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isCreatingEvent) {
      return;
    }

    setIsCreatingEvent(true);
    setCreateEventMessage('');

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setCreateEventMessage('Error: Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      // Create ONE unified event for all performance types
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newEvent,
          performanceType: 'All', // Set to 'All' to accommodate all performance types
          // Set defaults for simplified event creation
          ageCategory: 'All',
          entryFee: Number(newEvent.entryFee) || 0, // Use the entryFee from the form
          maxParticipants: null,
          createdBy: adminData.id,
          status: 'upcoming'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCreateEventMessage('🎉 Event created successfully! This event can accommodate all performance types (Solo, Duet, Trio, Group)');
        setNewEvent({
          name: '',
          description: '',
          region: 'Nationals',
          eventDate: '',
          eventEndDate: '',
          registrationDeadline: '',
          venue: '',
          entryFee: 0,
          registrationFeePerDancer: 0,
          solo1Fee: 0,
          solo2Fee: 0,
          solo3Fee: 0,
          soloAdditionalFee: 0,
          duoTrioFeePerDancer: 0,
          groupFeePerDancer: 0,
          largeGroupFeePerDancer: 0,
          currency: 'ZAR'
        });
        fetchData();
        setShowCreateEventModal(false);
        setTimeout(() => setCreateEventMessage(''), 5000);
      } else {
        setCreateEventMessage(`❌ Failed to create event. Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setCreateEventMessage('Error creating event. Please check your connection and try again.');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Helper function to format date for HTML input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    try {
      // Handle different date formats from database
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventData({
      name: event.name,
      description: event.description,
      region: event.region,
      eventDate: formatDateForInput(event.eventDate), // Format for HTML date input
      eventEndDate: formatDateForInput(event.eventEndDate), // Format for HTML date input
      registrationDeadline: formatDateForInput(event.registrationDeadline), // Format for HTML date input
      venue: event.venue,
      status: event.status,
      // Include fee configuration - NO DEFAULTS, show exactly what's in the database
      registrationFeePerDancer: event.registrationFeePerDancer !== undefined ? event.registrationFeePerDancer : 0,
      solo1Fee: event.solo1Fee !== undefined ? event.solo1Fee : 0,
      solo2Fee: event.solo2Fee !== undefined ? event.solo2Fee : 0,
      solo3Fee: event.solo3Fee !== undefined ? event.solo3Fee : 0,
      soloAdditionalFee: event.soloAdditionalFee !== undefined ? event.soloAdditionalFee : 0,
      duoTrioFeePerDancer: event.duoTrioFeePerDancer !== undefined ? event.duoTrioFeePerDancer : 0,
      groupFeePerDancer: event.groupFeePerDancer !== undefined ? event.groupFeePerDancer : 0,
      largeGroupFeePerDancer: event.largeGroupFeePerDancer !== undefined ? event.largeGroupFeePerDancer : 0,
      currency: event.currency || 'ZAR'
    });
    setUpdateEventMessage('');
    setShowEditEventModal(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingEvent || isUpdatingEvent) {
      return;
    }

    setIsUpdatingEvent(true);
    setUpdateEventMessage('');

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setUpdateEventMessage('Error: Session expired. Please log in again.');
        return;
      }

      const updatePayload = {
        ...editEventData,
        adminSession: session
      };
      
      console.log('📤 Sending event update:', updatePayload);

      const response = await fetch(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (data.success) {
        setUpdateEventMessage('✅ Event updated successfully!');
        fetchData();
        setTimeout(() => {
          setShowEditEventModal(false);
          setEditingEvent(null);
          setUpdateEventMessage('');
        }, 1500);
      } else {
        setUpdateEventMessage(`❌ Failed to update event. Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating event:', error);
      setUpdateEventMessage('Error updating event. Please check your connection and try again.');
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    showConfirm(
      `Are you sure you want to delete "${event.name}"? This action cannot be undone and will remove all associated entries, payments, and data.`,
      async () => {
        setIsDeletingEvent(true);

        try {
          const session = localStorage.getItem('adminSession');
          if (!session) {
            error('Session expired. Please log in again.');
            return;
          }

          const response = await fetch(`/api/events/${event.id}/delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              confirmed: true,
              adminSession: session
            }),
          });

          const data = await response.json();

          if (data.success) {
            success(`Event "${event.name}" deleted successfully`);
            fetchData();
          } else {
            if (data.details?.requiresConfirmation) {
              showConfirm(
                `"${event.name}" has ${data.details.entryCount} entries and ${data.details.paymentCount} payments. Are you absolutely sure you want to delete it?`,
                async () => {
                  const forceResponse = await fetch(`/api/events/${event.id}/delete`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                      confirmed: true, 
                      force: true,
                      adminSession: session
                    }),
                  });

                  const forceData = await forceResponse.json();
                  if (forceData.success) {
                    success(`Event "${event.name}" force deleted successfully`);
                    fetchData();
                  } else {
                    error(`Failed to delete event: ${forceData.error}`);
                  }
                }
              );
            } else {
              error(`Failed to delete event: ${data.error}`);
            }
          }
        } catch (deleteError) {
          console.error('Error deleting event:', deleteError);
          error('Error deleting event. Please check your connection and try again.');
        } finally {
          setIsDeletingEvent(false);
        }
      }
    );
  };

  const handleCreateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isCreatingJudge) {
      return;
    }

    // Validate password strength
    if (newJudge.password.length < 8) {
      setCreateJudgeMessage('Error: Password must be at least 8 characters long');
      return;
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(newJudge.password)) {
      setCreateJudgeMessage('Error: Password must contain at least one uppercase letter');
      return;
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(newJudge.password)) {
      setCreateJudgeMessage('Error: Password must contain at least one lowercase letter');
      return;
    }
    
    // Check for number
    if (!/[0-9]/.test(newJudge.password)) {
      setCreateJudgeMessage('Error: Password must contain at least one number');
      return;
    }
    
    // Check for special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newJudge.password)) {
      setCreateJudgeMessage('Error: Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      return;
    }

    setIsCreatingJudge(true);
    setCreateJudgeMessage('');

    try {
      const response = await fetch('/api/judges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newJudge),
      });

      const data = await response.json();

      if (data.success) {
        setCreateJudgeMessage('Judge created successfully!');
        setNewJudge({
          name: '',
          email: '',
          password: '',
          isAdmin: false
        });
        fetchData();
        setShowCreateJudgeModal(false);
        setTimeout(() => setCreateJudgeMessage(''), 5000);
      } else {
        setCreateJudgeMessage(`Error: ${data.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Error creating judge:', error);
      setCreateJudgeMessage('Error creating judge. Please check your connection and try again.');
    } finally {
      setIsCreatingJudge(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreatingClient) {
      return;
    }

    // Validate required fields
    if (!clientForm.name || !clientForm.email || !clientForm.password) {
      error('Name, email, and password are required');
      return;
    }

    // Validate password strength
    if (clientForm.password.length < 8) {
      error('Password must be at least 8 characters long');
      return;
    }

    setIsCreatingClient(true);

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...clientForm,
          createdBy: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        success('Client created successfully!');
        setClientForm({
          name: '',
          email: '',
          password: '',
          phone: '',
          allowedDashboards: [],
          canViewAllEvents: false,
          allowedEventIds: [],
          notes: ''
        });
        fetchData();
      } else {
        error(data.error || 'Failed to create client');
      }
    } catch (err) {
      console.error('Error creating client:', err);
      error('Network error. Please try again.');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isAssigning) {
      return;
    }

    setIsAssigning(true);
    setAssignmentMessage('');

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setAssignmentMessage('Error: Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      // Find the selected event by ID
      const selectedEvent = events.find(event => event.id === assignment.eventId);

      if (!selectedEvent) {
        setAssignmentMessage('Error: Selected event not found.');
        return;
      }

      // Assign judge to the unified event
      const response = await fetch('/api/judge-assignments/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          judgeId: assignment.judgeId,
          eventId: selectedEvent.id,
          assignedBy: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAssignmentMessage(`🎉 Judge assigned to "${selectedEvent.name}" successfully! This judge can now score all performance types within this event.`);
        setAssignment({
          judgeId: '',
          eventId: ''
        });
        fetchData();
        setShowAssignJudgeModal(false);
        setTimeout(() => setAssignmentMessage(''), 5000);
      } else {
        setAssignmentMessage(`❌ Failed to assign judge. Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error assigning judge:', error);
      setAssignmentMessage('Error assigning judge. Please check your connection and try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignJudge = async (assignment: JudgeAssignment) => {
    if (unassigningJudges.has(assignment.id)) return;
    
    showConfirm(
      `Are you sure you want to unassign ${assignment.judgeName} from "${assignment.eventName}"?`,
      async () => {
        setUnassigningJudges(prev => new Set(prev).add(assignment.id));
        
        try {
          const response = await fetch(`/api/judge-assignments/${assignment.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer admin',
            },
          });

          if (response.ok) {
            const result = await response.json();
            success(result.message);
            fetchData(); // Reload data
          } else {
            const errorData = await response.json();
            error(`Failed to unassign judge: ${errorData.error}`);
          }
        } catch (err) {
          console.error('Error unassigning judge:', err);
          error('Failed to unassign judge');
        } finally {
          setUnassigningJudges(prev => {
            const newSet = new Set(prev);
            newSet.delete(assignment.id);
            return newSet;
          });
        }
      }
    );
  };

  const handleCleanDatabase = async () => {
    // Prevent double submission
    if (isCleaningDatabase) {
      return;
    }

    // Confirm the action with custom modal
    showConfirm(
      '⚠️ WARNING: This will permanently delete ALL data except admin users!\n\n' +
      'This includes:\n' +
      '• All events\n' +
      '• All contestants and participants\n' +
      '• All registrations and performances\n' +
      '• All scores and rankings\n' +
      '• All judge assignments\n' +
      '• All non-admin judges\n\n' +
      'Are you absolutely sure you want to continue?',
      () => {
        // Confirmed - proceed with cleanup
        performCleanDatabase();
      }
    );
  };

  const performCleanDatabase = async () => {

    setIsCleaningDatabase(true);
    setCleanDatabaseMessage('');

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setCleanDatabaseMessage('Error: Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/clean-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCleanDatabaseMessage('✅ Database cleaned successfully! All data removed. New admin: mains@elementscentral.com');
        // Refresh the dashboard data
        fetchData();
        setTimeout(() => setCleanDatabaseMessage(''), 7000);
      } else {
        setCleanDatabaseMessage(`❌ Error: ${data.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Error cleaning database:', error);
      setCleanDatabaseMessage('❌ Error cleaning database. Please check your connection and try again.');
    } finally {
      setIsCleaningDatabase(false);
    }
  };


  const handleApproveDancer = async (dancerId: string) => {
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        showAlert('Session expired. Please log in again.', 'error');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/dancers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dancerId,
          action: 'approve',
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        showAlert('Dancer approved successfully! They can now apply to studios.', 'success');
        fetchData(); // Refresh the data
      } else {
        showAlert(`Error: ${data.error || 'Unknown error occurred'}`, 'error');
      }
    } catch (error) {
      console.error('Error approving dancer:', error);
      showAlert('Error approving dancer. Please check your connection and try again.', 'error');
    }
  };

  const handleRejectDancer = (dancerId: string) => {
    showPrompt(
      'Please provide a reason for rejection:',
      (rejectionReason) => {
        if (!rejectionReason || rejectionReason.trim() === '') {
          showAlert('Rejection reason is required.', 'warning');
          return;
        }
        performDancerRejection(dancerId, rejectionReason.trim());
      },
      undefined,
      'Enter rejection reason...'
    );
  };

  const performDancerRejection = async (dancerId: string, rejectionReason: string) => {

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        alert('Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/dancers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dancerId,
          action: 'reject',
          rejectionReason: rejectionReason,
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        showAlert('Dancer registration rejected.', 'success');
        fetchData(); // Refresh the data
      } else {
        showAlert(`Error: ${data.error || 'Unknown error occurred'}`, 'error');
      }
    } catch (error) {
      console.error('Error rejecting dancer:', error);
      showAlert('Error rejecting dancer. Please check your connection and try again.', 'error');
    }
  };

  const handleRegistrationFeeUpdate = async (dancerId: string, markAsPaid: boolean) => {
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        showAlert('Session expired. Please log in again.', 'error');
        return;
      }

      const adminData = JSON.parse(session);
      
      if (markAsPaid) {
        // Prompt for mastery level when marking as paid
        showPrompt(
          'Enter the mastery level for registration fee payment:',
          async (masteryLevel) => {
            if (!masteryLevel || masteryLevel.trim() === '') {
              showAlert('Mastery level is required when marking registration fee as paid.', 'warning');
              return;
            }
            
            try {
              const response = await fetch('/api/admin/dancers/registration-fee', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  dancerId,
                  action: 'mark_paid',
                  masteryLevel: masteryLevel.trim(),
                  adminId: adminData.id
                }),
              });

              const data = await response.json();

              if (data.success) {
                showAlert('Registration fee marked as paid successfully!', 'success');
                fetchData(); // Refresh the data
              } else {
                showAlert(`Error: ${data.error || 'Unknown error occurred'}`, 'error');
              }
            } catch (error) {
              console.error('Error updating registration fee:', error);
              showAlert('Error updating registration fee. Please check your connection and try again.', 'error');
            }
          },
          undefined,
          'e.g., Water, Fire, Earth, Air...'
        );
      } else {
        // Mark as unpaid (confirmation)
        showConfirm(
          'Are you sure you want to mark this registration fee as unpaid?',
          async () => {
            try {
              const response = await fetch('/api/admin/dancers/registration-fee', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  dancerId,
                  action: 'mark_unpaid',
                  adminId: adminData.id
                }),
              });

              const data = await response.json();

              if (data.success) {
                showAlert('Registration fee marked as unpaid.', 'success');
                fetchData(); // Refresh the data
              } else {
                showAlert(`Error: ${data.error || 'Unknown error occurred'}`, 'error');
              }
            } catch (error) {
              console.error('Error updating registration fee:', error);
              showAlert('Error updating registration fee. Please check your connection and try again.', 'error');
            }
          }
        );
      }
    } catch (error) {
      console.error('Error updating registration fee:', error);
      showAlert('Error updating registration fee. Please check your connection and try again.', 'error');
    }
  };

  const handleViewFinances = async (dancer: any) => {
    setSelectedDancerFinances(dancer);
    setShowFinancialModal(true);
    setLoadingFinances(true);
    
    try {
      // Fetch comprehensive financial data including group entries
      const response = await fetch(`/api/admin/dancers/${dancer.eodsaId}/finances`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDancerFinances({
          ...dancer,
          // New API structure
          financial: data.financial,
          entries: data.entries,
          // Legacy support for existing modal code
          eventEntries: data.entries.all || [],
          totalOutstanding: data.financial.totalOutstanding || 0,
          registrationFeeAmount: data.financial.registrationFeeAmount || 0
        });
      } else {
        // Fallback to basic info
        setSelectedDancerFinances({
          ...dancer,
          financial: {
            registrationFeeAmount: 0,
            registrationFeeOutstanding: 0,
            totalEntryOutstanding: 0,
            totalOutstanding: 0,
            totalPaid: 0
          },
          entries: {
            all: [],
            solo: [],
            group: [],
            totalEntries: 0,
            soloCount: 0,
            groupCount: 0
          },
          eventEntries: [],
          totalOutstanding: 0,
          registrationFeeAmount: 0
        });
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      // Fallback to basic info
      setSelectedDancerFinances({
        ...dancer,
        financial: {
          registrationFeeAmount: 0,
          registrationFeeOutstanding: 0,
          totalEntryOutstanding: 0,
          totalOutstanding: 0,
          totalPaid: 0
        },
        entries: {
          all: [],
          solo: [],
          group: [],
          totalEntries: 0,
          soloCount: 0,
          groupCount: 0
        },
        eventEntries: [],
        totalOutstanding: 0,
        registrationFeeAmount: 0
      });
    } finally {
      setLoadingFinances(false);
    }
  };

  const handleApproveStudio = async (studioId: string) => {
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again to continue.', 7000);
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/studios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId,
          action: 'approve',
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        success('Studio approved! They can now receive dancer applications.', 6000);
        fetchData(); // Refresh the data
      } else {
        error(data.error || 'An unknown error occurred while approving the studio.', 8000);
      }
    } catch (err) {
      console.error('Error approving studio:', err);
      error('Unable to approve studio. Please check your connection and try again.', 8000);
    }
  };

  const handleRejectStudio = (studioId: string) => {
    showPrompt(
      'Please provide a reason for rejection:',
      (rejectionReason) => {
        if (!rejectionReason || rejectionReason.trim() === '') {
          showAlert('Please provide a reason for rejecting this studio registration.', 'warning');
          return;
        }
        performStudioRejection(studioId, rejectionReason.trim());
      },
      undefined,
      'Enter rejection reason...'
    );
  };

  const performStudioRejection = async (studioId: string, rejectionReason: string) => {

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again to continue.', 7000);
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/studios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId,
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        success('Studio rejected and they have been notified.', 6000);
        fetchData(); // Refresh the data
      } else {
        error(data.error || 'An unknown error occurred while rejecting the studio.', 8000);
      }
    } catch (err) {
      console.error('Error rejecting studio:', err);
      error('Unable to reject studio. Please check your connection and try again.', 8000);
    }
  };

  const handleDeleteJudge = async (judgeId: string, judgeName: string) => {
    if (!confirm(`Are you sure you want to delete judge "${judgeName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setCreateJudgeMessage('Please log in again to continue');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch(`/api/judges/${judgeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminData.id}`
        }
      });

      if (response.ok) {
        setCreateJudgeMessage(`Judge "${judgeName}" deleted successfully`);
        fetchData();
        setTimeout(() => setCreateJudgeMessage(''), 5000);
      } else {
        const error = await response.json();
        setCreateJudgeMessage(`Error: ${error.error || 'Failed to delete judge'}`);
      }
    } catch (error) {
      console.error('Delete judge error:', error);
      setCreateJudgeMessage('Error: Failed to delete judge');
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    router.push('/portal/admin');
  };

  const clearMessages = () => {
    setCreateEventMessage('');
    setCreateJudgeMessage('');
    setAssignmentMessage('');
    setCleanDatabaseMessage('');
    setEmailTestResults('');
    setShowCreateEventModal(false);
    setShowCreateJudgeModal(false);
    setShowAssignJudgeModal(false);
    setShowEmailTestModal(false);
  };

  // Email testing functions
  const handleTestEmailConnection = async () => {
    setIsTestingEmail(true);
    setEmailTestResults('');
    
    try {
      const response = await fetch('/api/email/test');
      const data = await response.json();
      
      if (data.success) {
        setEmailTestResults('✅ SMTP Connection successful! Email system is working properly.');
      } else {
        setEmailTestResults(`❌ SMTP Connection failed: ${data.error}`);
      }
    } catch (error) {
      setEmailTestResults('❌ Failed to test email connection. Please check server logs.');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      setEmailTestResults('❌ Please enter an email address to test.');
      return;
    }

    setIsTestingEmail(true);
    setEmailTestResults('');
    
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          name: 'Test User'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEmailTestResults(`✅ Test email sent successfully to ${testEmail}! Check the inbox.`);
        setTestEmail('');
      } else {
        setEmailTestResults(`❌ Failed to send test email: ${data.error}`);
      }
    } catch (error) {
      setEmailTestResults('❌ Failed to send test email. Please check server logs.');
    } finally {
      setIsTestingEmail(false);
    }
  };



  useEffect(() => {
    clearMessages();
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
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
              Loading Avalon Admin Dashboard
            </h2>
            <p className={`${themeClasses.loadingText} font-medium animate-pulse`}>Preparing your dashboard...</p>
            
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
    <div className={`min-h-screen ${themeClasses.mainBg}`}>
      {/* Enhanced Header - Mobile Optimized */}
      <header className={`${themeClasses.headerBg} backdrop-blur-lg shadow-xl border-b ${themeClasses.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-8 gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg sm:text-xl font-bold">A</span>
            </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
                  Avalon Admin Dashboard
                </h1>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm lg:text-base font-medium`}>Competition Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className={`hidden md:flex items-center space-x-3 px-3 sm:px-4 py-2 ${themeClasses.systemOnlineBg} rounded-xl`}>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary}`}>System Online</span>
              </div>
              {/* Email testing disabled for Phase 1 */}
              {/* <button
                onClick={() => setShowEmailTestModal(true)}
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg sm:rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span className="text-sm sm:text-base">📧</span>
                <span className="font-medium">Email Test</span>
              </button> */}

              <button
                onClick={handleCleanDatabase}
                disabled={isCleaningDatabase}
                style={{ display: 'none' }}
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg sm:rounded-xl hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                {isCleaningDatabase ? (
                  <>
                    <div className="relative w-5 h-5">
                      <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
                    </div>
                    <span className="font-medium">Cleaning...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm sm:text-base">🗑️</span>
                    <span className="font-medium">Clean DB</span>
                  </>
                )}
              </button>
              <ThemeToggle />
              
              <Link 
                href="/admin/rankings"
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg sm:rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span className="text-sm sm:text-base">📊</span>
                <span className="font-medium">Rankings</span>
              </Link>

              <Link 
                href="/admin/scoring-approval"
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg sm:rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span className="text-sm sm:text-base">⚖️</span>
                <span className="font-medium">Score Approval</span>
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg sm:rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span className="text-sm sm:text-base">🚪</span>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Global Database Clean Message */}
        {cleanDatabaseMessage && (
          <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl font-medium animate-slideIn border-2 ${
            cleanDatabaseMessage.includes('Error') || cleanDatabaseMessage.includes('❌')
              ? 'bg-red-50 text-red-700 border-red-200' 
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <div className="flex items-center space-x-3">
              <span className="text-lg sm:text-xl">
                {cleanDatabaseMessage.includes('Error') || cleanDatabaseMessage.includes('❌') ? '⚠️' : '✅'}
              </span>
              <span className="text-sm sm:text-base font-semibold">{cleanDatabaseMessage}</span>
            </div>
          </div>
        )}

        {/* Enhanced Tab Navigation - Mobile Optimized */}
        <div className={`${themeClasses.navBg} backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-6 sm:mb-8 shadow-xl border ${themeClasses.navBorder}`}>
          <nav className="flex flex-col sm:flex-row gap-2">
            {[
              { id: 'events', label: 'Events', icon: '🏆', color: 'indigo' },
              { id: 'staff', label: 'Judges', icon: '👨‍⚖️', color: 'purple' },
              { id: 'assignments', label: 'Assignments', icon: '🔗', color: 'pink' },
              { id: 'dancers', label: 'Dancers', icon: '💃', color: 'rose' },
              { id: 'studios', label: 'Studios', icon: '🏢', color: 'orange' },
              { id: 'clients', label: 'Staff Accounts', icon: '👤', color: 'emerald' },
              { id: 'sound-tech', label: 'Sound Tech', icon: '🎵', color: 'violet' },
              { id: 'music-tracking', label: 'Music Upload Tracking', icon: '🎼', color: 'cyan' }
            ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base transform ${
                    activeTab === tab.id
                    ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color === 'indigo' ? 'blue' : tab.color === 'purple' ? 'pink' : 'rose'}-600 text-white shadow-lg scale-105`
                    : `${themeClasses.textSecondary} hover:bg-white/80 hover:shadow-md hover:scale-102`
                }`}
              >
                <span className="text-lg sm:text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                )}
                </button>
              ))}
            </nav>
        </div>

        {/* Events Tab - Enhanced */}
        {activeTab === 'events' && (
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            {/* Enhanced Events List - Mobile Optimized */}
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs sm:text-sm">🏆</span>
                  </div>
                    <h2 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary}`}>Events</h2>
                    <div className={`px-2 sm:px-3 py-1 ${theme === 'dark' ? 'bg-indigo-900/80 text-indigo-200' : 'bg-indigo-100 text-indigo-800'} rounded-full text-xs sm:text-sm font-medium`}>
                      {events.length} events
                  </div>
                  </div>
                  <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCreateEventModal(true)}
                    className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg sm:rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base font-medium"
                  >
                    <span>➕</span>
                    <span className="hidden sm:inline">Create Event</span>
                    <span className="sm:hidden">Create</span>
                  </button>
                  </div>
                </div>
              </div>

              {events.length === 0 ? (
                <div className={`text-center py-8 sm:py-12 ${themeClasses.textMuted}`}>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg sm:text-2xl">🏆</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-medium mb-2">No events yet</h3>
                  <p className="text-sm mb-4">Create your first event to get started!</p>
                  <button
                    onClick={() => setShowCreateEventModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                  >
                    <span>➕</span>
                    <span>Create First Event</span>
                  </button>
                  </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={themeClasses.tableHeader}>
                      <tr>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Event</th>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden sm:table-cell`}>Region</th>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden md:table-cell`}>Type</th>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Date</th>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Status</th>
                        <th className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                      {events.map((event) => (
                        <tr key={event.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div>
                              <div className={`text-xs sm:text-sm font-bold ${themeClasses.textPrimary} leading-tight`}>{event.name}</div>
                              <div className={`text-xs sm:text-sm ${themeClasses.textSecondary} font-medium mt-1`}>{event.venue}</div>
                                                            <div className={`text-xs ${themeClasses.textMuted} sm:hidden mt-1`}>
                                {event.region} • {event.performanceType === 'All' ? 'All Performance Types' : event.performanceType} • {event.ageCategory}
                              </div>
              </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium hidden sm:table-cell">{event.region}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                            <div className="space-y-1">
                              {event.performanceType === 'All' ? (
                                <span className="inline-flex px-2 sm:px-3 py-1 text-xs font-bold rounded-full border bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200">
                                  🎭 All Types
                                </span>
                              ) : (
                                <span className="inline-flex px-2 sm:px-3 py-1 text-xs font-bold rounded-full border bg-gradient-to-r from-green-50 to-teal-50 text-green-700 border-green-200">
                                  {event.performanceType === 'Solo' ? '🕺' : 
                                   event.performanceType === 'Duet' ? '👯' : 
                                   event.performanceType === 'Trio' ? '👨‍👩‍👧' : 
                                   event.performanceType === 'Group' ? '👥' : '🎭'} {event.performanceType}
                                </span>
                              )}
                             <div className={`text-xs sm:text-sm ${themeClasses.textSecondary}`}>{event.ageCategory}</div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium">
                            <div className="hidden sm:block">
                              {new Date(event.eventDate).toLocaleDateString()}
                            </div>
                            <div className="sm:hidden">
                              {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className={`inline-flex px-2 sm:px-3 py-1 text-xs font-bold rounded-full border ${
                              event.status === 'upcoming' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              event.status === 'registration_open' ? 'bg-green-50 text-green-700 border-green-200' :
                              event.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                               `bg-gray-50 ${themeClasses.textSecondary} border-gray-200`
                            }`}>
                              <span className="hidden sm:inline">{event.status.replace('_', ' ').toUpperCase()}</span>
                              <span className="sm:hidden">
                                {event.status === 'upcoming' ? 'UPCOMING' : 
                                 event.status === 'registration_open' ? 'OPEN' :
                                 event.status === 'in_progress' ? 'ACTIVE' : 'CLOSED'}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center space-x-2">
                               <Link
                                 href={`/admin/events/${event.id}`}
                                 className={`${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-700'} text-xs sm:text-sm font-medium`}
                               >
                                 <span className="hidden sm:inline">👥 View</span>
                                 <span className="sm:hidden">👥</span>
                               </Link>
                               <button
                                 onClick={() => handleEditEvent(event)}
                                 className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-700'} text-xs sm:text-sm font-medium transition-colors`}
                                 title="Edit Event"
                               >
                                 <span className="hidden sm:inline">✏️ Edit</span>
                                 <span className="sm:hidden">✏️</span>
                               </button>
                               <button
                                 onClick={() => handleDeleteEvent(event)}
                                 className={`${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'} text-xs sm:text-sm font-medium transition-colors`}
                                 title="Delete Event"
                               >
                                <span className="hidden sm:inline">🗑️ Delete</span>
                                <span className="sm:hidden">🗑️</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
              )}
                </div>
              </div>
        )}

        {/* Staff Tab - Enhanced */}
        {activeTab === 'staff' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Staff List */}
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-6 py-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">👥</span>
                  </div>
                    <h2 className={`text-xl font-bold ${themeClasses.textPrimary}`}>Staff Management</h2>
                    <div className={`px-3 py-1 ${theme === 'dark' ? 'bg-purple-900/80 text-purple-200' : 'bg-purple-100 text-purple-800'} rounded-full text-sm font-medium`}>
                      {judges.length} staff members
                  </div>
                </div>
                  <button
                    onClick={() => setShowCreateJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
                  >
                    <span>➕</span>
                    <span className="hidden sm:inline">Add Staff</span>
                    <span className="sm:hidden">Add</span>
                  </button>
              </div>
            </div>
              
              {judges.length === 0 ? (
                <div className="text-center py-12 ${themeClasses.textMuted}">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No staff members yet</h3>
                  <p className="text-sm mb-4">Add your first staff member to get started!</p>
                  <button
                    onClick={() => setShowCreateJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <span>➕</span>
                    <span>Add First Staff Member</span>
                  </button>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className={themeClasses.tableHeader}>
                      <tr>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Name</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden sm:table-cell`}>Email</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Role</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden md:table-cell`}>Created</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                    </tr>
                  </thead>
                    <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                      {judges.map((judge) => (
                        <tr key={judge.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                          <td className="px-6 py-4">
                            <div>
                              <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{judge.name}</div>
                              <div className={`text-sm ${themeClasses.textSecondary} font-medium sm:hidden`}>{judge.email}</div>
                          </div>
                        </td>
                          <td className={`px-6 py-4 text-sm font-medium ${themeClasses.textPrimary} hidden sm:table-cell`}>{judge.email}</td>
                          <td className="px-6 py-4">
                            {judge.isAdmin ? (
                              <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full border bg-gradient-to-r from-purple-500 to-pink-600 text-white border-purple-300">
                                👑 Admin
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  👨‍⚖️ Judge
                                </span>
                                {/* Additional role badges can be added here based on staff roles */}
                              </div>
                            )}
                        </td>
                          <td className={`px-6 py-4 text-sm font-medium ${themeClasses.textSecondary} hidden md:table-cell`}>
                            {new Date(judge.createdAt).toLocaleDateString()}
                        </td>
                          <td className="px-6 py-4">
                            <div className="flex space-x-2">
                              {!judge.isAdmin && (
                                <>
                                  <button
                                    onClick={() => {/* TODO: Implement edit roles functionality */}}
                                    className="inline-flex items-center px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
                                  >
                                    ⚙️ Roles
                                  </button>
                                  <button
                                    onClick={() => handleDeleteJudge(judge.id, judge.name)}
                                    className="inline-flex items-center px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
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
            </div>
          )}

        {/* Assignments Tab - Enhanced */}
        {activeTab === 'assignments' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Assignments List */}
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-6 py-4 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🔗</span>
                    </div>
                    <h2 className={`text-xl font-bold ${themeClasses.textPrimary}`}>Staff Assignments</h2>
                    <div className={`px-3 py-1 ${theme === 'dark' ? 'bg-pink-900/80 text-pink-200' : 'bg-pink-100 text-pink-800'} rounded-full text-sm font-medium`}>
                      {assignments.length} assignments
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAssignJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
                  >
                    <span>➕</span>
                    <span className="hidden sm:inline">Assign Judge</span>
                    <span className="sm:hidden">Assign</span>
                  </button>
                </div>
              </div>

              {assignments.length === 0 ? (
                <div className="text-center py-12 ${themeClasses.textMuted}">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
                  <p className="text-sm mb-4">Assign judges to events to get started!</p>
                  <button
                    onClick={() => setShowAssignJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
                  >
                    <span>➕</span>
                    <span>Create First Assignment</span>
                  </button>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className={themeClasses.tableHeader}>
                      <tr>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Judge</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Event</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider hidden sm:table-cell`}>Email</th>
                        <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                    </tr>
                  </thead>
                    <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                      {assignments.map((assignment) => (
                        <tr key={assignment.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                          <td className="px-6 py-4">
                            <div>
                              <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{assignment.judgeName}</div>
                              <div className={`text-sm ${themeClasses.textSecondary} font-medium sm:hidden`}>{assignment.judgeEmail}</div>
                            </div>
                        </td>
                          <td className="px-6 py-4 text-sm font-medium">
                            {assignment.eventName}
                            <div className={`text-xs ${themeClasses.textMuted} mt-1`}>{assignment.eventDate ? new Date(assignment.eventDate).toLocaleDateString() : 'No date'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium ${themeClasses.textSecondary} hidden sm:table-cell">{assignment.judgeEmail}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleUnassignJudge(assignment)}
                              disabled={unassigningJudges.has(assignment.id)}
                              className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium rounded-lg hover:from-red-600 hover:to-rose-700 transition-all duration-200 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Remove this judge from the event"
                            >
                              <span className="mr-1">{unassigningJudges.has(assignment.id) ? '⏳' : '🗑️'}</span>
                              <span className="hidden sm:inline">{unassigningJudges.has(assignment.id) ? 'Removing...' : 'Unassign'}</span>
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
          )}

        {/* Dancers Tab - Enhanced */}
        {activeTab === 'dancers' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Dancers List */}
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-6 py-4 bg-gradient-to-r from-rose-500/20 to-pink-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">💃</span>
                    </div>
                    <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Individual Dancer Registrations</h2>
                    <div className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-sm font-medium">
                      {dancers.filter(d => {
                        const matchesSearch = !dancerSearchTerm || 
                          d.name.toLowerCase().includes(dancerSearchTerm.toLowerCase()) ||
                          d.nationalId.includes(dancerSearchTerm) ||
                          d.eodsaId.toLowerCase().includes(dancerSearchTerm.toLowerCase()) ||
                          (d.email && d.email.toLowerCase().includes(dancerSearchTerm.toLowerCase()));
                        const matchesFilter = dancerStatusFilter === 'all' ||
                          (dancerStatusFilter === 'pending' && !d.approved && !d.rejectionReason) ||
                          (dancerStatusFilter === 'approved' && d.approved) ||
                          (dancerStatusFilter === 'rejected' && d.rejectionReason);
                        return matchesSearch && matchesFilter;
                      }).length} of {dancers.length} dancers
                    </div>
                  </div>
                  
                  {/* Search and Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search dancers..."
                        value={dancerSearchTerm}
                        onChange={(e) => setDancerSearchTerm(e.target.value)}
                        className={`w-full sm:w-64 px-4 py-2 pr-10 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm ${themeClasses.textPrimary} placeholder:${themeClasses.textMuted}`}
                      />
                       <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                         <span className={`${themeClasses.textMuted}`}>🔍</span>
                       </div>
                     </div>
                     
                     <select
                       value={dancerStatusFilter}
                      onChange={(e) => setDancerStatusFilter(e.target.value as any)}
                       className={`px-3 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm ${themeClasses.textPrimary}`}
                       style={{
                         backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                         color: theme === 'dark' ? '#f9fafb' : '#111827',
                         borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db'
                       }}
                    >
                      <option value="all" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>All Status</option>
                      <option value="pending" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>⏳ Pending</option>
                      <option value="approved" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>✅ Approved</option>
                      <option value="rejected" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>❌ Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {(() => {
                // Filter and sort dancers
                const filteredDancers = dancers
                  .filter(d => {
                    const matchesSearch = !dancerSearchTerm || 
                      d.name.toLowerCase().includes(dancerSearchTerm.toLowerCase()) ||
                      d.nationalId.includes(dancerSearchTerm) ||
                      d.eodsaId.toLowerCase().includes(dancerSearchTerm.toLowerCase()) ||
                      (d.email && d.email.toLowerCase().includes(dancerSearchTerm.toLowerCase()));
                    const matchesFilter = dancerStatusFilter === 'all' ||
                      (dancerStatusFilter === 'pending' && !d.approved && !d.rejectionReason) ||
                      (dancerStatusFilter === 'approved' && d.approved) ||
                      (dancerStatusFilter === 'rejected' && d.rejectionReason);
                    return matchesSearch && matchesFilter;
                  })
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort by newest first

                return filteredDancers.length === 0 ? (
                  <div className="text-center py-12 ${themeClasses.textMuted}">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">💃</span>
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      {dancers.length === 0 ? 'No dancer registrations yet' : 'No dancers match your filters'}
                    </h3>
                    <p className="text-sm mb-4">
                      {dancers.length === 0 
                        ? 'Individual dancers will appear here after they register'
                        : 'Try adjusting your search or filter criteria'
                      }
                    </p>
                    {dancers.length > 0 && (
                      <button
                        onClick={() => {
                          setDancerSearchTerm('');
                          setDancerStatusFilter('all');
                        }}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                      >
                        <span>🔄</span>
                        <span>Clear Filters</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className={themeClasses.tableHeader}>
                        <tr>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Name</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Age</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Mastery</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Contact</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Studio</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Guardian</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Status</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                        {filteredDancers.map((dancer) => (
                          <tr key={dancer.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                            <td className="px-6 py-4">
                              <div>
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>
                                  <a
                                    href={`/admin/dancers/${dancer.eodsaId}`}
                                    className={`${theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-900'} underline decoration-dotted underline-offset-2`}
                                  >
                                    {dancer.name}
                                  </a>
                                </div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>ID: {dancer.nationalId}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>EODSA: {dancer.eodsaId}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>Registered: {new Date(dancer.createdAt).toLocaleDateString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium">{dancer.age}</div>
                              <div className={`text-xs ${themeClasses.textMuted}`}>{dancer.dateOfBirth}</div>
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const mastery = (dancer as any).registrationFeeMasteryLevel;
                                if (!mastery) {
                                  return <span className="text-sm text-gray-400">—</span>;
                                }
                                const isWater = mastery.toLowerCase().includes('water');
                                const isFire = mastery.toLowerCase().includes('fire');
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isWater 
                                      ? theme === 'dark' ? 'bg-blue-900/80 text-blue-200' : 'bg-blue-100 text-blue-800'
                                      : isFire
                                      ? theme === 'dark' ? 'bg-orange-900/80 text-orange-200' : 'bg-orange-100 text-orange-800'
                                      : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {mastery}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium">{dancer.email || 'N/A'}</div>
                              <div className={`text-xs ${themeClasses.textMuted}`}>{dancer.phone || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4">
                              {dancer.studioName ? (
                                <div>
                                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>🏢 {dancer.studioName}</div>
                                  <div className={`text-xs ${themeClasses.textMuted}`}>{dancer.studioEmail}</div>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-blue-900/80 text-blue-200' : 'bg-blue-100 text-blue-800'} mt-1`}>
                                    Studio Dancer
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>🕺 Independent</div>
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-purple-900/80 text-purple-200' : 'bg-purple-100 text-purple-800'} mt-1`}>
                                    Individual
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {dancer.guardianName ? (
                                <div>
                                  <div className="text-sm font-medium">{dancer.guardianName}</div>
                                  <div className={`text-xs ${themeClasses.textMuted}`}>{dancer.guardianEmail}</div>
                                  <div className={`text-xs ${themeClasses.textMuted}`}>{dancer.guardianPhone}</div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">Adult</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {dancer.approved ? (
                                <div>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-green-900/80 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                    ✅ Approved
                                  </span>
                                  {dancer.approvedAt && (
                                    <div className={`text-xs ${themeClasses.textMuted} mt-1`}>
                                      {new Date(dancer.approvedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : dancer.rejectionReason ? (
                                <div>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-red-900/80 text-red-200' : 'bg-red-100 text-red-800'}`}>
                                    ❌ Rejected
                                  </span>
                                  <div className={`text-xs ${themeClasses.textMuted} mt-1`} title={dancer.rejectionReason}>
                                    {dancer.rejectionReason.length > 30 
                                      ? dancer.rejectionReason.substring(0, 30) + '...' 
                                      : dancer.rejectionReason}
                                  </div>
                                </div>
                              ) : (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-yellow-900/80 text-yellow-200' : 'bg-yellow-100 text-yellow-800'}`}>
                                  ⏳ Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                {!dancer.approved && !dancer.rejectionReason ? (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleApproveDancer(dancer.id)}
                                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                    >
                                      ✅ Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectDancer(dancer.id)}
                                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                    >
                                      <span className="text-white">✖️</span> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Registration Fee Quick Status */}
                                     <div className="text-xs">
                                       <span className={`font-medium ${themeClasses.textSecondary}`}>Reg Fee: </span>
                                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                         dancer.registrationFeePaid 
                                           ? theme === 'dark' ? 'bg-green-900/80 text-green-200 border border-green-700' : 'bg-green-100 text-green-800 border border-green-200'
                                           : theme === 'dark' ? 'bg-red-900/80 text-red-200 border border-red-700' : 'bg-red-100 text-red-800 border border-red-200'
                                       }`}>
                                        {dancer.registrationFeePaid ? '✅ Paid' : '❌ Not Paid'}
                                      </span>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex flex-col space-y-1">
                                       <button
                                         onClick={() => handleViewFinances(dancer)}
                                         className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${theme === 'dark' ? 'bg-blue-900/80 text-blue-200 hover:bg-blue-800 border-blue-700' : 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200'}`}
                                       >
                                        💰 View Finances
                                      </button>
                                      
                                      {dancer.approved && (
                                        <button
                                          onClick={() => handleRegistrationFeeUpdate(dancer.id, !dancer.registrationFeePaid)}
                                           className={`w-full px-3 py-1 text-xs font-medium rounded-lg transition-colors border ${
                                             dancer.registrationFeePaid
                                               ? theme === 'dark' ? 'bg-orange-900/80 text-orange-200 hover:bg-orange-800 border-orange-700' : 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200'
                                               : theme === 'dark' ? 'bg-green-900/80 text-green-200 hover:bg-green-800 border-green-700' : 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200'
                                           }`}
                                        >
                                          {dancer.registrationFeePaid ? 'Mark Reg Unpaid' : 'Mark Reg Paid'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Studios Tab - New */}
        {activeTab === 'studios' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Studios List */}
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-6 py-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏢</span>
                    </div>
                    <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Studio Registrations</h2>
                    <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                      {studios.filter(s => {
                        const matchesSearch = !studioSearchTerm || 
                          s.name.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                          s.email.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                          s.registrationNumber.toLowerCase().includes(studioSearchTerm.toLowerCase());
                        const matchesFilter = studioStatusFilter === 'all' ||
                          (studioStatusFilter === 'pending' && !s.approved && !s.rejectionReason) ||
                          (studioStatusFilter === 'approved' && s.approved) ||
                          (studioStatusFilter === 'rejected' && s.rejectionReason);
                        return matchesSearch && matchesFilter;
                      }).length} of {studios.length} studios
                    </div>
                  </div>
                  
                  {/* Search and Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search studios..."
                        value={studioSearchTerm}
                        onChange={(e) => setStudioSearchTerm(e.target.value)}
                        className={`w-full sm:w-64 px-4 py-2 pr-10 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${themeClasses.textPrimary} placeholder:${themeClasses.textMuted}`}
                      />
                       <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                         <span className={`${themeClasses.textMuted}`}>🔍</span>
                       </div>
                     </div>
                     
                     <select
                       value={studioStatusFilter}
                      onChange={(e) => setStudioStatusFilter(e.target.value as any)}
                       className={`px-3 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm ${themeClasses.textPrimary}`}
                       style={{
                         backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                         color: theme === 'dark' ? '#f9fafb' : '#111827',
                         borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db'
                       }}
                    >
                      <option value="all" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>All Status</option>
                      <option value="pending" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>⏳ Pending</option>
                      <option value="approved" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>✅ Approved</option>
                      <option value="rejected" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>❌ Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {(() => {
                // Filter and sort studios
                const filteredStudios = studios
                  .filter(s => {
                    const matchesSearch = !studioSearchTerm || 
                      s.name.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                      s.email.toLowerCase().includes(studioSearchTerm.toLowerCase()) ||
                      s.registrationNumber.toLowerCase().includes(studioSearchTerm.toLowerCase());
                    const matchesFilter = studioStatusFilter === 'all' ||
                      (studioStatusFilter === 'pending' && !s.approved && !s.rejectionReason) ||
                      (studioStatusFilter === 'approved' && s.approved) ||
                      (studioStatusFilter === 'rejected' && s.rejectionReason);
                    return matchesSearch && matchesFilter;
                  })
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort by newest first

                return filteredStudios.length === 0 ? (
                  <div className="text-center py-12 ${themeClasses.textMuted}">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🏢</span>
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      {studios.length === 0 ? 'No studio registrations yet' : 'No studios match your filters'}
                    </h3>
                    <p className="text-sm mb-4">
                      {studios.length === 0 
                        ? 'Dance studios will appear here after they register'
                        : 'Try adjusting your search or filter criteria'
                      }
                    </p>
                    {studios.length > 0 && (
                      <button
                        onClick={() => {
                          setStudioSearchTerm('');
                          setStudioStatusFilter('all');
                        }}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        <span>🔄</span>
                        <span>Clear Filters</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className={themeClasses.tableHeader}>
                        <tr>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Studio</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Contact</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Registration</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Status</th>
                          <th className={`px-6 py-4 text-left text-xs font-bold ${themeClasses.tableHeaderText} uppercase tracking-wider`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                        {filteredStudios.map((studio) => (
                          <tr key={studio.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                            <td className="px-6 py-4">
                              <div>
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{studio.name}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>Reg: {studio.registrationNumber}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>Registered: {new Date(studio.createdAt).toLocaleDateString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium">{studio.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium">{studio.registrationNumber}</div>
                              <div className={`text-xs ${themeClasses.textMuted}`}>{new Date(studio.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4">
                              {studio.approved ? (
                                <div>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-green-900/80 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                    ✅ Approved
                                  </span>
                                  {studio.approvedAt && (
                                    <div className={`text-xs ${themeClasses.textMuted} mt-1`}>
                                      {new Date(studio.approvedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : studio.rejectionReason ? (
                                <div>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-red-900/80 text-red-200' : 'bg-red-100 text-red-800'}`}>
                                    ❌ Rejected
                                  </span>
                                  <div className={`text-xs ${themeClasses.textMuted} mt-1`} title={studio.rejectionReason}>
                                    {studio.rejectionReason.length > 30 
                                      ? studio.rejectionReason.substring(0, 30) + '...' 
                                      : studio.rejectionReason}
                                  </div>
                                </div>
                              ) : (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-yellow-900/80 text-yellow-200' : 'bg-yellow-100 text-yellow-800'}`}>
                                  ⏳ Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {!studio.approved && !studio.rejectionReason ? (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleApproveStudio(studio.id)}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                  >
                                    ✅ Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectStudio(studio.id)}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                  >
                                    <span className="text-white">✖️</span> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className={`text-xs ${themeClasses.textMuted}`}>No actions</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}


        {/* Sound Tech Tab */}
        {activeTab === 'sound-tech' && (
          <div className="space-y-8 animate-fadeIn">
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-6 py-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🎵</span>
                    </div>
                    <h2 className={`text-xl font-bold ${themeClasses.textPrimary}`}>Sound Tech Dashboard</h2>
                  </div>
                  <button
                    onClick={() => window.open('/admin/sound-tech', '_blank')}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 font-medium"
                  >
                    Open Full Dashboard
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className={`${theme === 'dark' ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-700' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'} rounded-xl p-6 border`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-green-800' : 'bg-green-100'} rounded-lg flex items-center justify-center`}>
                        <span className="text-green-600 text-lg">🎵</span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${themeClasses.textSecondary}`}>Live Performances</p>
                        <p className={`text-2xl font-bold ${themeClasses.textPrimary}`}>Coming Soon</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${theme === 'dark' ? 'bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-blue-700' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'} rounded-xl p-6 border`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-blue-800' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
                        <span className="text-blue-600 text-lg">📹</span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${themeClasses.textSecondary}`}>Virtual Performances</p>
                        <p className={`text-2xl font-bold ${themeClasses.textPrimary}`}>Coming Soon</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${theme === 'dark' ? 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'} rounded-xl p-6 border`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-purple-800' : 'bg-purple-100'} rounded-lg flex items-center justify-center`}>
                        <span className="text-purple-600 text-lg">⬇️</span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${themeClasses.textSecondary}`}>Music Downloads</p>
                        <p className={`text-2xl font-bold ${themeClasses.textPrimary}`}>Available</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${theme === 'dark' ? 'bg-blue-900/40 border-blue-700' : 'bg-blue-50 border-blue-200'} rounded-xl p-6 border`}>
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'} mb-3 flex items-center`}>
                    <span className="mr-2">🎵</span>
                    Sound Tech Features
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Access all uploaded music files</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Play music with full controls</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Download individual or all music files</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Filter by event and performance type</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>View performance details and item numbers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-500">✅</span>
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Access virtual performance video links</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`mt-6 p-4 ${theme === 'dark' ? 'bg-blue-800/20 border-blue-600' : 'bg-white border-blue-300'} rounded-lg border`}>
                    <p className={`text-sm ${theme === 'dark' ? 'text-blue-200' : 'text-blue-700'}`}>
                      <strong>For Sound Techs:</strong> Use the full dashboard to access all music files, organize by performance order, 
                      and prepare audio for live events. Download all music files at once for offline preparation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Music Upload Tracking Tab */}
        {activeTab === 'music-tracking' && (
          <div className="space-y-8 animate-fadeIn">
            <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
              <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b ${themeClasses.cardBorder}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🎼</span>
                    </div>
                    <h2 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary}`}>Music Upload Tracking</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <select
                      value={selectedMusicTrackingEventId}
                      onChange={(e) => {
                        setSelectedMusicTrackingEventId(e.target.value);
                        const eventId = e.target.value === 'all' ? undefined : e.target.value;
                        const entryType = activeBackendFilter === 'all' ? undefined : activeBackendFilter;
                        fetchMusicTrackingData({ entryType, eventId });
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                        theme === 'dark' 
                          ? 'bg-gray-800 border-gray-600 text-gray-100' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500`}
                    >
                      <option value="all">All Events</option>
                      {events.map(event => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                      ))}
                    </select>
                    <div className={`flex rounded-lg border overflow-hidden ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                      <button
                        onClick={() => {
                          const eventId = selectedMusicTrackingEventId === 'all' ? undefined : selectedMusicTrackingEventId;
                          fetchMusicTrackingData({ eventId });
                        }}
                        disabled={loadingMusicTracking}
                        className={`px-3 sm:px-3 py-2.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors touch-manipulation ${activeBackendFilter === 'all' 
                          ? 'bg-blue-600 text-white' 
                          : theme === 'dark' ? 'bg-gray-800 text-gray-100 hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          const eventId = selectedMusicTrackingEventId === 'all' ? undefined : selectedMusicTrackingEventId;
                          fetchMusicTrackingData({ entryType: 'live', eventId });
                        }}
                        disabled={loadingMusicTracking}
                        className={`px-3 sm:px-3 py-2.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors touch-manipulation ${theme === 'dark' ? 'border-l border-gray-600' : 'border-l border-gray-300'} ${activeBackendFilter === 'live' 
                          ? 'bg-blue-600 text-white' 
                          : theme === 'dark' ? 'bg-gray-800 text-gray-100 hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <span className="hidden sm:inline">🎵 Live Only</span>
                        <span className="sm:hidden">🎵 Live</span>
                      </button>
                      <button
                        onClick={() => {
                          const eventId = selectedMusicTrackingEventId === 'all' ? undefined : selectedMusicTrackingEventId;
                          fetchMusicTrackingData({ entryType: 'virtual', eventId });
                        }}
                        disabled={loadingMusicTracking}
                        className={`px-3 sm:px-3 py-2.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors touch-manipulation ${theme === 'dark' ? 'border-l border-gray-600' : 'border-l border-gray-300'} ${activeBackendFilter === 'virtual' 
                          ? 'bg-blue-600 text-white' 
                          : theme === 'dark' ? 'bg-gray-800 text-gray-100 hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <span className="hidden sm:inline">🎥 Virtual Only</span>
                        <span className="sm:hidden">🎥 Virtual</span>
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const eventId = selectedMusicTrackingEventId === 'all' ? undefined : selectedMusicTrackingEventId;
                        const entryType = activeBackendFilter === 'all' ? undefined : activeBackendFilter;
                        fetchMusicTrackingData({ entryType, eventId });
                      }}
                      disabled={loadingMusicTracking}
                      className="px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:bg-gray-400 transition-all duration-200 font-medium text-sm"
                    >
                      <span className="hidden sm:inline">{loadingMusicTracking ? 'Loading...' : 'Refresh Data'}</span>
                      <span className="sm:hidden">{loadingMusicTracking ? 'Loading...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {loadingMusicTracking ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className={`${themeClasses.textMuted}`}>Loading music tracking data...</p>
                  </div>
                ) : musicTrackingData.length === 0 ? (
                  <div className={`text-center py-8 ${themeClasses.textMuted}`}>
                    <span className="text-4xl mb-4 block">📭</span>
                    <p className="text-lg">No entries found</p>
                    <p className="text-sm text-gray-400 mt-2">Click "Refresh Data" to load music upload tracking information</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                      <div className={`${theme === 'dark' ? 'bg-green-900/40 border-green-700' : 'bg-green-50 border-green-200'} rounded-lg p-3 sm:p-4 border`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl sm:text-2xl">✅</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-green-300' : 'text-green-600'} font-medium truncate`}>Music Uploaded</p>
                            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-green-200' : 'text-green-700'}`}>
                              {musicTrackingData.filter(entry => entry.musicFileUrl).length}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`${theme === 'dark' ? 'bg-red-900/40 border-red-700' : 'bg-red-50 border-red-200'} rounded-lg p-3 sm:p-4 border`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl sm:text-2xl">❌</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-red-300' : 'text-red-600'} font-medium truncate`}>Missing Music</p>
                            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-red-200' : 'text-red-700'}`}>
                              {musicTrackingData.filter(entry => !entry.musicFileUrl && entry.entryType === 'live').length}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`${theme === 'dark' ? 'bg-blue-900/40 border-blue-700' : 'bg-blue-50 border-blue-200'} rounded-lg p-3 sm:p-4 border`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl sm:text-2xl">🎥</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'} font-medium truncate`}>Virtual Entries</p>
                            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-blue-200' : 'text-blue-700'}`}>
                              {musicTrackingData.filter(entry => entry.entryType === 'virtual').length}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`${theme === 'dark' ? 'bg-orange-900/40 border-orange-700' : 'bg-orange-50 border-orange-200'} rounded-lg p-3 sm:p-4 border`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-xl sm:text-2xl">📹</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-orange-300' : 'text-orange-600'} font-medium truncate`}>Missing Videos</p>
                            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-orange-200' : 'text-orange-700'}`}>
                              {musicTrackingData.filter(entry => !entry.videoExternalUrl && entry.entryType === 'virtual').length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Search and Filter Controls */}
                    <div className="mb-6 space-y-3 sm:space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                        {/* Search input */}
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Search by item name, contestant, or studio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:${themeClasses.textMuted}`}
                          />
                        </div>
                        
                        {/* Filter row for mobile */}
                        <div className="flex gap-2 sm:gap-4 sm:flex-row">
                          {/* Entry Type Filter */}
                          <select
                            value={entryTypeFilter}
                            onChange={(e) => setEntryTypeFilter(e.target.value as 'all' | 'live' | 'virtual')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-cyan-500`}
                            style={{
                              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                              color: theme === 'dark' ? '#f9fafb' : '#111827',
                              borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db'
                            }}
                          >
                            <option value="all" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>All Types</option>
                            <option value="live" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>🎵 Live Only</option>
                            <option value="virtual" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>🎥 Virtual Only</option>
                          </select>
                          
                          {/* Upload Status Filter */}
                          <select
                            value={uploadStatusFilter}
                            onChange={(e) => setUploadStatusFilter(e.target.value as 'all' | 'uploaded' | 'missing' | 'no_video')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-cyan-500`}
                            style={{
                              backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                              color: theme === 'dark' ? '#f9fafb' : '#111827',
                              borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db'
                            }}
                          >
                            <option value="all" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>All Status</option>
                            <option value="uploaded" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>✅ Uploaded</option>
                            <option value="missing" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>❌ Missing</option>
                            <option value="no_video" style={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#f9fafb' : '#111827' }}>🎥 No Video Link</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Entries Table */}
                    <div className={`overflow-x-auto -mx-4 sm:mx-0 scrollbar-thin ${theme === 'dark' ? 'scrollbar-thumb-gray-600 scrollbar-track-gray-800' : 'scrollbar-thumb-gray-300 scrollbar-track-gray-100'}`}>
                      <div className="inline-block min-w-full align-middle">
                        <div className={`overflow-hidden shadow-sm ring-1 sm:rounded-lg ${theme === 'dark' ? 'ring-gray-600 ring-opacity-50' : 'ring-black ring-opacity-5'}`}>
                          <div className="px-4 py-2 flex justify-end gap-2">
                            <button
                              onClick={bulkClearMusic}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700"
                              title="Clear music for all currently filtered live entries needing uploads"
                            >
                              Clear Music (Filtered)
                            </button>
                            <button
                              onClick={bulkClearVideos}
                              className="ml-2 px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-semibold hover:bg-purple-700"
                              title="Clear video links for all currently filtered virtual entries"
                            >
                              Clear Videos (Filtered)
                            </button>
                            <button
                              onClick={exportProgramCsv}
                              className="ml-2 px-3 py-1.5 bg-gray-800 text-white rounded-md text-xs font-semibold hover:bg-black"
                              title="Export current program view to CSV"
                            >
                              Export Program CSV
                            </button>
                            <select
                              onChange={(e) => {
                                const val = e.target.value; (async () => { try { await (async () => {
                                  const eventId = val; if (!eventId) return;
                                  if (!confirm('Archive media for this event? This clears music and video links.')) return;
                                  try {
                                    const session = localStorage.getItem('adminSession');
                                    const adminId = session ? JSON.parse(session).id : undefined;
                                    // Clear music
                                    const musicTargets = musicTrackingData.filter(e => e.eventId === eventId && e.entryType === 'live' && e.musicFileUrl);
                                    for (const entry of musicTargets) {
                                      await fetch(`/api/admin/entries/${entry.id}/remove-music`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId }) });
                                    }
                                    // Clear videos
                                    const videoTargets = musicTrackingData.filter(e => e.eventId === eventId && e.entryType === 'virtual' && e.videoExternalUrl);
                                    for (const entry of videoTargets) {
                                      await fetch(`/api/admin/entries/${entry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoExternalUrl: '' }) });
                                    }
                                    success('Event media archived');
                                    await fetchMusicTrackingData({ eventId });
                                  } catch { error('Archiving failed'); }
                                })(); } catch {} })();
                              }}
                              className="ml-2 px-2 py-1.5 border rounded-md text-xs"
                              defaultValue=""
                              title="Archive clears music and videos for selected event"
                            >
                              <option value="" disabled>Archive Event Media…</option>
                              {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.name}</option>
                              ))}
                            </select>
                          </div>
                          {/* Mobile swipe indicator */}
                          <div className={`sm:hidden px-4 py-2 text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <p className={`text-xs ${themeClasses.textMuted}`}>← Swipe to see more columns →</p>
                          </div>
                          <table className={`min-w-full divide-y ${themeClasses.tableBorder}`}>
                        <thead className={`${themeClasses.tableHeader}`}>
                          <tr>
                            <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              Entry Details
                            </th>
                            <th className={`hidden sm:table-cell px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              Contestant
                            </th>
                            <th className={`hidden lg:table-cell px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              Event
                            </th>
                            <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              Type
                            </th>
                            <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              <span className="hidden sm:inline">Music Status</span>
                              <span className="sm:hidden">Music</span>
                            </th>
                            <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              <span className="hidden sm:inline">Video Status</span>
                              <span className="sm:hidden">Video</span>
                            </th>
                            <th className={`px-3 sm:px-6 py-3 text-left text-xs font-medium ${themeClasses.tableHeaderText} uppercase tracking-wider`}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`${themeClasses.tableRow} divide-y ${themeClasses.tableBorder}`}>
                          {musicTrackingData.filter((entry) => {
                            // Search term filter
                            const searchMatch = !searchTerm || 
                              entry.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              entry.contestantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              entry.studioName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              entry.eodsaId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              entry.choreographer?.toLowerCase().includes(searchTerm.toLowerCase());
                            
                            // Entry type filter
                            const typeMatch = entryTypeFilter === 'all' || entry.entryType === entryTypeFilter;
                            
                            // Upload status filter
                            let statusMatch = true;
                            if (uploadStatusFilter === 'uploaded') {
                              statusMatch = (entry.entryType === 'live' && entry.musicFileUrl) || 
                                           (entry.entryType === 'virtual' && entry.videoExternalUrl);
                            } else if (uploadStatusFilter === 'missing') {
                              statusMatch = entry.entryType === 'live' && !entry.musicFileUrl;
                            } else if (uploadStatusFilter === 'no_video') {
                              statusMatch = entry.entryType === 'virtual' && !entry.videoExternalUrl;
                            }
                            
                            return searchMatch && typeMatch && statusMatch;
                          }).map((entry) => (
                            <tr key={entry.id} className={`${themeClasses.tableRowHover} transition-colors duration-200`}>
                              <td className="px-3 sm:px-6 py-3 sm:py-4">
                                <div className="space-y-1">
                                  <div className={`text-sm font-medium ${themeClasses.textPrimary} truncate`}>{entry.itemName}</div>
                                  <div className={`text-xs sm:text-sm ${themeClasses.textMuted}`}>Item #{entry.itemNumber || 'Not assigned'}</div>
                                  <div className={`text-xs sm:text-sm ${themeClasses.textMuted}`}>{entry.mastery} • {entry.itemStyle}</div>
                                  {/* Mobile-only content */}
                                  <div className="sm:hidden space-y-1">
                                    <div className={`text-xs font-medium ${themeClasses.textPrimary}`}>{entry.contestantName || 'Unknown'}</div>
                                    <div className={`text-xs ${themeClasses.textMuted}`}>{entry.eodsaId}</div>
                                    <div className={`text-xs ${themeClasses.textMuted}`}>{entry.studioName || 'Independent'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>{entry.contestantName || 'Unknown'}</div>
                                  <div className={`text-sm ${themeClasses.textMuted}`}>{entry.eodsaId}</div>
                                  <div className={`text-sm ${themeClasses.textMuted}`}>{entry.studioName || 'Independent'}</div>
                                </div>
                              </td>
                              <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>{entry.eventName}</div>
                                  <div className={`text-sm ${themeClasses.textMuted}`}>{entry.eventDate ? new Date(entry.eventDate).toLocaleDateString() : 'TBD'}</div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${
                                  entry.entryType === 'live' 
                                    ? theme === 'dark' ? 'bg-blue-900/80 text-blue-200' : 'bg-blue-100 text-blue-800'
                                    : theme === 'dark' ? 'bg-purple-900/80 text-purple-200' : 'bg-purple-100 text-purple-800'
                                }`}>
                                  <span className="hidden sm:inline">{entry.entryType === 'live' ? '🎵 Live' : '🎥 Virtual'}</span>
                                  <span className="sm:hidden">{entry.entryType === 'live' ? '🎵' : '🎥'}</span>
                                </span>
                              </td>
                              <td className="px-2 sm:px-6 py-3 sm:py-4">
                                {entry.entryType === 'live' ? (
                                  entry.musicFileUrl ? (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                      <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-green-900/80 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                        <span className="hidden sm:inline">✅ Uploaded</span>
                                        <span className="sm:hidden">✅</span>
                                      </span>
                                      <span className={`text-xs ${themeClasses.textMuted} truncate max-w-[60px] sm:max-w-[100px] mt-1 sm:mt-0`}>{entry.musicFileName}</span>
                                    </div>
                                  ) : (
                                    <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-red-900/80 text-red-200' : 'bg-red-100 text-red-800'}`}>
                                      <span className="hidden sm:inline">❌ Missing</span>
                                      <span className="sm:hidden">❌</span>
                                    </span>
                                  )
                                ) : (
                                  <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                    <span className="hidden sm:inline">N/A</span>
                                    <span className="sm:hidden">-</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-2 sm:px-6 py-3 sm:py-4">
                                {entry.entryType === 'virtual' ? (
                                  <div className="space-y-1">
                                    {entry.videoExternalUrl ? (
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                        <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-green-900/80 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                          <span className="hidden sm:inline">✅ Video Link</span>
                                          <span className="sm:hidden">✅</span>
                                        </span>
                                        <span className={`text-xs ${themeClasses.textMuted} truncate max-w-[80px] mt-1 sm:mt-0`}>{entry.videoExternalType?.toUpperCase() || 'LINK'}</span>
                                      </div>
                                    ) : (
                                      <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-red-900/80 text-red-200' : 'bg-red-100 text-red-800'}`}>
                                        <span className="hidden sm:inline">❌ No Video Link</span>
                                        <span className="sm:hidden">❌</span>
                                      </span>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="url"
                                        placeholder={entry.videoExternalUrl ? 'Replace link…' : 'Paste YouTube/Vimeo link…'}
                                        value={videoLinkDrafts[entry.id] ?? ''}
                                        onChange={(e) => setVideoLinkDrafts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                        className={`w-40 sm:w-56 px-2 py-1 text-xs rounded border ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary}`}
                                      />
                                      <button
                                        onClick={async () => {
                                          const url = (videoLinkDrafts[entry.id] || '').trim();
                                          if (!url) { error('Enter a video link first'); return; }
                                          try {
                                            const res = await fetch(`/api/admin/entries/${entry.id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ videoExternalUrl: url })
                                            });
                                            const data = await res.json();
                                            if (res.ok && data.success) {
                                              success('Video link saved');
                                              setVideoLinkDrafts(prev => ({ ...prev, [entry.id]: '' }));
                                              try {
                                                const { socketClient } = await import('@/lib/socket-client');
                                                socketClient.emit('entry:video_updated' as any, {
                                                  eventId: entry.eventId,
                                                  entryId: entry.id,
                                                  videoExternalUrl: url,
                                                  timestamp: new Date().toISOString()
                                                } as any);
                                              } catch {}
                                              await fetchMusicTrackingData({ entryType: activeBackendFilter === 'all' ? undefined : activeBackendFilter });
                                            } else {
                                              error(data?.error || 'Failed to save video link');
                                            }
                                          } catch (e) {
                                            error('Network error saving link');
                                          }
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700"
                                      >Save</button>
                                      {entry.videoExternalUrl && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const res = await fetch(`/api/admin/entries/${entry.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ videoExternalUrl: '' })
                                              });
                                              const data = await res.json();
                                              if (res.ok && data.success) {
                                                success('Video link removed');
                                                try {
                                                  const { socketClient } = await import('@/lib/socket-client');
                                                  socketClient.emit('entry:video_updated' as any, {
                                                    eventId: entry.eventId,
                                                    entryId: entry.id,
                                                    videoExternalUrl: '',
                                                    timestamp: new Date().toISOString()
                                                  } as any);
                                                } catch {}
                                                await fetchMusicTrackingData({ entryType: activeBackendFilter === 'all' ? undefined : activeBackendFilter });
                                              } else {
                                                error(data?.error || 'Failed to remove video link');
                                              }
                                            } catch (e) {
                                              error('Network error removing link');
                                            }
                                          }}
                                          className={`px-2 py-1 text-xs rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                                        >Clear</button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-semibold rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                    <span className="hidden sm:inline">N/A (Live)</span>
                                    <span className="sm:hidden">-</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-2 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium">
                                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                   {entry.musicFileUrl && (
                                     <a
                                       href={entry.musicFileUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className={`${theme === 'dark' ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-900'} transition-colors py-1 touch-manipulation`}
                                     >
                                      <span className="hidden sm:inline">🎧 Play</span>
                                      <span className="sm:hidden">🎧</span>
                                    </a>
                                  )}
                                  {entry.videoExternalUrl && (
                                     <a
                                       href={entry.videoExternalUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className={`${theme === 'dark' ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-900'} transition-colors py-1 touch-manipulation`}
                                     >
                                       <span className="hidden sm:inline">🎥 Watch</span>
                                       <span className="sm:hidden">🎥</span>
                                     </a>
                                   )}
                                   <button
                                     onClick={() => window.open(`/admin/events/${entry.eventId}`, '_blank')}
                                     className={`${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-900'} transition-colors text-left py-1 touch-manipulation`}
                                   >
                                    <span className="hidden sm:inline">📋 View Entry</span>
                                    <span className="sm:hidden">📋</span>
                                  </button>
                                  {/* Bulk action seed: individual clear button available above. A dedicated Bulk Clear panel can iterate IDs from current filter. */}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal Components */}
      {/* Create Event Modal */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">🎭</span>
                  </div>
                  <h2 className={`text-xl font-bold ${themeClasses.textPrimary}`}>Create New Event</h2>
                </div>
                <button
                  onClick={() => setShowCreateEventModal(false)}
                  className={`${themeClasses.textMuted} hover:${themeClasses.textSecondary} p-2 rounded-lg hover:bg-gray-100/50 transition-colors`}
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateEvent} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Event Name</label>
                    <input
                      type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                    required
                    placeholder="e.g., EODSA Nationals Championships 2024"
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Venue</label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                    required
                    placeholder="e.g., Johannesburg Civic Theatre"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                    rows={3}
                    required
                    placeholder="Describe the event..."
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Legacy Entry Fee (Not Used)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={0}
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed text-base font-medium"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ This field is deprecated. Use the Fee Configuration section below.</p>
                </div>

                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Competition</label>
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 ${themeClasses.textPrimary} font-medium text-base">
                    EODSA Nationals
                  </div>
                </div>



                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Event Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>End Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.eventEndDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventEndDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Registration Deadline</label>
                  <input
                    type="datetime-local"
                    value={newEvent.registrationDeadline}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, registrationDeadline: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>



                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Performance Types</label>
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 ${themeClasses.textPrimary} font-medium text-base">
                    🎭 Creates All Performance Types (Solo, Duet, Trio, Group)
                  </div>
                  <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
                    💡 This will automatically create separate events for Solo, Duet, Trio, and Group performances.
                  </p>
                </div>
              </div>

              {/* Fee Configuration Section */}
              <div className="mt-8 p-6 border-2 border-indigo-200 rounded-xl bg-indigo-50/50">
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  💰 Fee Configuration
                </h3>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                    <select
                      value={newEvent.currency}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                    >
                      <option value="ZAR">ZAR (R)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Fee (per dancer)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.registrationFeePerDancer}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, registrationFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">1 Solo Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.solo1Fee}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, solo1Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">2 Solos Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.solo2Fee}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, solo2Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="750"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">3 Solos Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.solo3Fee}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, solo3Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="1050"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Each Additional Solo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.soloAdditionalFee}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, soloAdditionalFee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duo/Trio (per dancer)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.duoTrioFeePerDancer}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, duoTrioFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="280"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Small Group (per dancer, 4-9)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.groupFeePerDancer}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, groupFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="220"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Large Group (per dancer, 10+)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newEvent.largeGroupFeePerDancer}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, largeGroupFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium"
                      placeholder="190"
                    />
                  </div>
                </div>
              </div>

              {createEventMessage && (
                <div className={`mt-6 p-4 rounded-xl font-medium animate-slideIn ${
                  createEventMessage.includes('Error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>{createEventMessage.includes('Error') ? '❌' : '✅'}</span>
                    <span>{createEventMessage}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className={`px-6 py-3 border border-gray-300 ${themeClasses.textSecondary} rounded-xl hover:bg-gray-50 transition-colors font-medium`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="inline-flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {isCreatingEvent ? (
                    <>
                      <div className="relative w-5 h-5">
                        <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
                      </div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Create Event</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditEventModal && editingEvent && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">✏️</span>
                  </div>
                  <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Edit Event</h2>
                </div>
                <button
                  onClick={() => {
                    setShowEditEventModal(false);
                    setEditingEvent(null);
                    setUpdateEventMessage('');
                  }}
                  className={`${themeClasses.textMuted} hover:${themeClasses.textSecondary} p-2 rounded-lg hover:bg-gray-100/50 transition-colors`}
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleUpdateEvent} className="p-6">
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">📝 Update Event Details:</h3>
                <p className="text-sm text-blue-700">Modify the event information below. This will update the event for all judges and participants.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Event Name *</label>
                  <input
                    type="text"
                    value={editEventData.name}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Region *</label>
                  <select
                    value={editEventData.region}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    required
                  >
                    <option value="Nationals">Nationals</option>
                    <option value="Gauteng">Gauteng</option>
                    <option value="Free State">Free State</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                  </select>
                </div>

                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Event Date *</label>
                  <input
                    type="date"
                    value={editEventData.eventDate}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, eventDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Event End Date</label>
                  <input
                    type="date"
                    value={editEventData.eventEndDate}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, eventEndDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                  />
                </div>

                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Registration Deadline *</label>
                  <input
                    type="date"
                    value={editEventData.registrationDeadline}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, registrationDeadline: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div>
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Status</label>
                  <select
                    value={editEventData.status}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="registration_open">Registration Open</option>
                    <option value="registration_closed">Registration Closed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Venue *</label>
                  <input
                    type="text"
                    value={editEventData.venue}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                   <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-2`}>Description</label>
                  <textarea
                    value={editEventData.description}
                    onChange={(e) => setEditEventData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base font-medium"
                    placeholder="Event description (optional)"
                  />
                </div>
              </div>

              {/* Fee Configuration Section */}
              <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center space-x-2">
                  💰 Fee Configuration
                </h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                    <select
                      value={editEventData.currency}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="ZAR">ZAR (R)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Fee (per dancer)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.registrationFeePerDancer}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, registrationFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">1 Solo Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.solo1Fee}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, solo1Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">2 Solos Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.solo2Fee}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, solo2Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">3 Solos Package</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.solo3Fee}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, solo3Fee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Each Additional Solo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.soloAdditionalFee}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, soloAdditionalFee: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duo/Trio (per dancer)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.duoTrioFeePerDancer}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, duoTrioFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Small Group (per dancer, 4-9)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.groupFeePerDancer}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, groupFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Large Group (per dancer, 10+)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editEventData.largeGroupFeePerDancer}
                      onChange={(e) => setEditEventData(prev => ({ ...prev, largeGroupFeePerDancer: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {updateEventMessage && (
                <div className={`mt-6 p-4 rounded-xl font-medium animate-slideIn ${
                  updateEventMessage.includes('Error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>{updateEventMessage.includes('Error') ? '❌' : '✅'}</span>
                    <span>{updateEventMessage}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEventModal(false);
                    setEditingEvent(null);
                    setUpdateEventMessage('');
                  }}
                  className={`px-6 py-3 border border-gray-300 ${themeClasses.textSecondary} rounded-xl hover:bg-gray-50 transition-colors font-medium`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEvent}
                  className="inline-flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {isUpdatingEvent ? (
                    <>
                      <div className="relative w-5 h-5">
                        <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
                        <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                      </div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Update Event</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Judge Modal */}
      {showCreateJudgeModal && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">👨‍⚖️</span>
                  </div>
                  <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Create New Judge</h2>
                </div>
                <button
                  onClick={() => setShowCreateJudgeModal(false)}
                  className={`${themeClasses.textMuted} hover:${themeClasses.textSecondary} p-2 rounded-lg hover:bg-gray-100/50 transition-colors`}
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateJudge} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Judge Name</label>
                  <input
                    type="text"
                      value={newJudge.name}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                        setNewJudge(prev => ({ ...prev, name: cleanValue }));
                      }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                      required
                    placeholder="Full Name"
                    />
                  </div>
                  
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Email</label>
                    <input
                      type="email"
                      value={newJudge.email}
                      onChange={(e) => setNewJudge(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                      required
                    placeholder="judge@email.com"
                    />
                  </div>
                  
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Password</label>
                  <div className="relative">
                    <input
                      type={showJudgePassword ? 'text' : 'password'}
                      value={newJudge.password}
                      onChange={(e) => setNewJudge(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium placeholder-gray-400"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowJudgePassword(v => !v)}
                      className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      aria-label="Toggle password visibility"
                    >
                      {showJudgePassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                  
                <div className="lg:col-span-1 flex items-center justify-center lg:justify-start">
                  <div className="flex items-center">
                      <input
                        type="checkbox"
                      id="isAdmin"
                        checked={newJudge.isAdmin}
                        onChange={(e) => setNewJudge(prev => ({ ...prev, isAdmin: e.target.checked }))}
                      className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                    <label htmlFor="isAdmin" className="ml-3 block text-sm font-medium">
                          Admin privileges
                        </label>
                      </div>
                    </div>
                  </div>
                  
              {createJudgeMessage && (
                <div className={`mt-6 p-4 rounded-xl font-medium animate-slideIn ${
                  createJudgeMessage.includes('Error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>{createJudgeMessage.includes('Error') ? '❌' : '✅'}</span>
                    <span>{createJudgeMessage}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateJudgeModal(false)}
                  className={`px-6 py-3 border border-gray-300 ${themeClasses.textSecondary} rounded-xl hover:bg-gray-50 transition-colors font-medium`}
                >
                  Cancel
                </button>
                    <button
                      type="submit"
                      disabled={isCreatingJudge}
                  className="inline-flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {isCreatingJudge ? (
                    <>
                      <div className="relative w-5 h-5">
                        <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
            </div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Create Judge</span>
                    </>
                  )}
                    </button>
                  </div>
                </form>
          </div>
                  </div>
                )}

      {/* Assign Judge Modal */}
      {showAssignJudgeModal && (
        <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-black/70' : 'bg-black/30'} backdrop-blur-sm flex items-center justify-center p-4 z-50`}>
          <div className={`${themeClasses.modalBg} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${themeClasses.modalBorder}`}>
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">🔗</span>
                  </div>
                  <h2 className={`text-xl font-bold ${themeClasses.textPrimary}`}>Assign Judge to Event</h2>
                </div>
                <button
                  onClick={() => setShowAssignJudgeModal(false)}
                  className={`${themeClasses.textMuted} p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10 hover:text-gray-200' : 'hover:bg-gray-100/50 hover:text-gray-700'} transition-colors`}
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              </div>

            <form onSubmit={handleAssignJudge} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Select Judge</label>
                  <select
                    value={assignment.judgeId}
                    onChange={(e) => setAssignment(prev => ({ ...prev, judgeId: e.target.value }))}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-base font-medium ${theme === 'dark' ? 'bg-gray-800/90 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    required
                  >
                    <option value="">Choose a judge</option>
                    {judges.filter(judge => !judge.isAdmin).map(judge => (
                      <option key={judge.id} value={judge.id}>{judge.name} ({judge.email})</option>
                    ))}
                  </select>
                </div>
                
                <div className="lg:col-span-1">
                  <label className={`block text-sm font-semibold ${themeClasses.textSecondary} mb-3`}>Select Event</label>
                  <select
                    value={assignment.eventId}
                    onChange={(e) => setAssignment(prev => ({ ...prev, eventId: e.target.value }))}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-base font-medium ${theme === 'dark' ? 'bg-gray-800/90 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                    required
                  >
                    <option value="">Choose an event</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} {event.performanceType === 'All' ? '(All Performance Types)' : `(${event.performanceType})`}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
                    💡 Unified events support all performance types (Solo, Duet, Trio, Group) within the same event.
                  </p>
                </div>
              </div>

              {assignmentMessage && (
                <div className={`mt-6 p-4 rounded-xl font-medium animate-slideIn ${
                  assignmentMessage.includes('Error') 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>{assignmentMessage.includes('Error') ? '❌' : '✅'}</span>
                    <span>{assignmentMessage}</span>
                </div>
              </div>
          )}

              <div className={`flex justify-end space-x-4 mt-8 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setShowAssignJudgeModal(false)}
                  className={`px-6 py-3 border ${theme === 'dark' ? 'border-gray-600 hover:bg-white/10' : 'border-gray-300 hover:bg-gray-50'} ${themeClasses.textSecondary} rounded-xl transition-colors font-medium`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="inline-flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {isAssigning ? (
                    <>
                      <div className="relative w-5 h-5">
                        <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
            </div>
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Assign to All Types</span>
                    </>
                  )}
                </button>
        </div>
            </form>
      </div>
        </div>
      )}


      {/* Email Test Modal - Disabled for Phase 1 */}
      {false && showEmailTestModal && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">📧</span>
                  </div>
                  <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Email Test</h2>
                  </div>
                <button
                  onClick={() => setShowEmailTestModal(false)}
                  className={`${themeClasses.textMuted} hover:${themeClasses.textSecondary} p-2 rounded-lg hover:bg-gray-100/50 transition-colors`}
                >
                  <span className="text-2xl">×</span>
                </button>
                  </div>
                  </div>
            
            <form onSubmit={handleTestEmailConnection} className="p-6">
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                <h3 className="text-sm font-semibold text-indigo-800 mb-2">💡 Test Email Connection:</h3>
                <p className="text-sm text-indigo-700">Enter your email address to test the SMTP connection.</p>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">🔍 Test Results:</h3>
                <p className="text-sm text-gray-700">{emailTestResults}</p>
                  </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEmailTestModal(false)}
                  className={`px-6 py-3 border border-gray-300 ${themeClasses.textSecondary} rounded-xl hover:bg-gray-50 transition-colors font-medium`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTestingEmail}
                  className="inline-flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold"
                >
                  {isTestingEmail ? (
                    <>
                      <div className="relative w-5 h-5">
                        <div className="absolute inset-0 border-2 border-white/30 rounded-full"></div>
              </div>
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
        
        .hover\\:scale-105:hover {
          transform: scale(1.05);
        }
      `}</style>

      {/* Financial Management Modal */}
      {showFinancialModal && selectedDancerFinances && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">💰</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold ${themeClasses.textPrimary}">Financial Overview</h2>
                    <p className="${themeClasses.textSecondary}">{selectedDancerFinances.name} - {selectedDancerFinances.eodsaId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFinancialModal(false)}
                  className="text-gray-400 hover:${themeClasses.textSecondary} p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {loadingFinances ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <p className="${themeClasses.textSecondary}">Loading financial information...</p>
                </div>
              ) : (
                <>
                  {/* Registration Fee Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                      <span className="mr-2">📝</span>
                      Registration Fee
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Status:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedDancerFinances.registrationFeePaid
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {selectedDancerFinances.registrationFeePaid ? '✅ Paid' : '❌ Not Paid'}
                        </span>
                      </div>
                      
                      {selectedDancerFinances.registrationFeePaid && selectedDancerFinances.registrationFeePaidAt && (
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${themeClasses.textSecondary}`}>Paid Date:</span>
                          <span className="text-sm ${themeClasses.textPrimary}">
                            {new Date(selectedDancerFinances.registrationFeePaidAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      {selectedDancerFinances.registrationFeeMasteryLevel && (
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${themeClasses.textSecondary}`}>Mastery Level:</span>
                          <span className="text-sm ${themeClasses.textPrimary}">
                            {selectedDancerFinances.registrationFeeMasteryLevel}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Registration Fee Amount:</span>
                        <span className={`text-sm font-bold ${
                          selectedDancerFinances.registrationFeePaid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {selectedDancerFinances.registrationFeePaid ? 'R0.00' : `R${EODSA_FEES.REGISTRATION.Nationals.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Balance Overview */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                      <span className="mr-2">💰</span>
                      Financial Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider">Total Paid</div>
                        <div className="text-lg font-bold text-green-600">
                          R{selectedDancerFinances.financial?.totalPaid?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider">Outstanding</div>
                        <div className="text-lg font-bold text-red-600">
                          R{selectedDancerFinances.financial?.totalOutstanding?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Solo Entries Section */}
                  {selectedDancerFinances.entries?.soloCount > 0 && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                        <span className="mr-2">🕺</span>
                        Solo Entries ({selectedDancerFinances.entries.soloCount})
                      </h3>
                      <div className="space-y-3">
                        {selectedDancerFinances.entries.solo.map((entry: any, index: number) => (
                          <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{entry.itemName}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>{entry.eventName}</div>
                                <div className="text-xs text-purple-600 font-medium mt-1">Solo Performance</div>
                              </div>
                              <div className="text-right ml-4">
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>R{entry.calculatedFee?.toFixed(2) || '0.00'}</div>
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  entry.paymentStatus === 'paid' 
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {entry.paymentStatus?.toUpperCase() || 'PENDING'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group Entries Section */}
                  {selectedDancerFinances.entries?.groupCount > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                        <span className="mr-2">👥</span>
                        Group Entries ({selectedDancerFinances.entries.groupCount})
                      </h3>
                      <div className="space-y-4">
                        {selectedDancerFinances.entries.group.map((entry: any, index: number) => (
                          <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>{entry.itemName}</div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>{entry.eventName}</div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                    entry.participationRole === 'duet' ? 'bg-blue-100 text-blue-800' :
                                    entry.participationRole === 'trio' ? 'bg-green-100 text-green-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>
                                    {entry.participationRole.toUpperCase()}
                                  </span>
                                  {entry.isMainContestant && (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                      MAIN CONTESTANT
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-xs ${themeClasses.textMuted} mb-1">
                                  {entry.isMainContestant ? 'Full Fee' : 'Your Share'}
                                </div>
                                <div className={`text-sm font-bold ${themeClasses.textPrimary}`}>
                                  R{entry.dancerShare?.toFixed(2) || '0.00'}
                                </div>
                                {!entry.isMainContestant && (
                                  <div className="text-xs text-gray-400">
                                    of R{entry.calculatedFee?.toFixed(2) || '0.00'}
                                  </div>
                                )}
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${
                                  entry.paymentStatus === 'paid' 
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {entry.paymentStatus?.toUpperCase() || 'PENDING'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Group Members List */}
                            <div className="border-t border-gray-100 pt-3">
                              <div className="text-xs font-medium ${themeClasses.textSecondary} mb-2">Group Members:</div>
                              <div className="flex flex-wrap gap-1">
                                {entry.participantNames?.map((name: string, nameIndex: number) => (
                                  <span key={nameIndex} className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                    name === selectedDancerFinances.name 
                                      ? 'bg-blue-100 text-blue-800 font-medium border border-blue-200' 
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {name === selectedDancerFinances.name ? `${name} (You)` : name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Entries State */}
                  {(!selectedDancerFinances.entries?.totalEntries || selectedDancerFinances.entries.totalEntries === 0) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-center py-6">
                        <div className="text-gray-400 text-4xl mb-3">🎭</div>
                        <h3 className="text-lg font-medium mb-2">No Event Entries</h3>
                        <p className="${themeClasses.textSecondary} text-sm">This dancer hasn't registered for any competitions yet.</p>
                      </div>
                    </div>
                  )}

                  {/* Detailed Outstanding Breakdown */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Outstanding Balance Breakdown
                    </h3>
                    <div className="space-y-3">
                      {/* Registration Fee */}
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${themeClasses.textSecondary}`}>Registration Fee:</span>
                        <span className="text-sm font-medium text-red-600">
                          R{selectedDancerFinances.financial?.registrationFeeOutstanding?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      
                      {/* Entry Fees Breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${themeClasses.textSecondary}`}>Solo Entries Outstanding:</span>
                          <span className="text-sm font-medium text-red-600">
                            R{(selectedDancerFinances.entries?.solo?.filter((e: any) => e.paymentStatus !== 'paid')
                              .reduce((sum: number, entry: any) => sum + (entry.calculatedFee || 0), 0) || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm ${themeClasses.textSecondary}`}>Group Entries Outstanding:</span>
                          <span className="text-sm font-medium text-red-600">
                            R{(selectedDancerFinances.entries?.group?.filter((e: any) => e.paymentStatus !== 'paid')
                              .reduce((sum: number, entry: any) => sum + (entry.dancerShare || 0), 0) || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Total */}
                      <div className="flex justify-between items-center pt-3 border-t border-red-200">
                        <span className="text-base font-bold ${themeClasses.textPrimary}">TOTAL OUTSTANDING:</span>
                        <span className="text-xl font-bold text-red-600">
                          R{selectedDancerFinances.financial?.totalOutstanding?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      
                      {/* Payment Progress */}
                      {selectedDancerFinances.entries?.totalEntries > 0 && (
                        <div className="pt-3 border-t border-red-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium ${themeClasses.textSecondary}">Payment Progress:</span>
                            <span className={`text-xs ${themeClasses.textMuted}`}>
                              {selectedDancerFinances.entries.all?.filter((e: any) => e.paymentStatus === 'paid').length || 0} of {selectedDancerFinances.entries.totalEntries} entries paid
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                              style={{
                                width: `${selectedDancerFinances.entries.totalEntries > 0 
                                  ? ((selectedDancerFinances.entries.all?.filter((e: any) => e.paymentStatus === 'paid').length || 0) / selectedDancerFinances.entries.totalEntries) * 100 
                                  : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold ${themeClasses.textPrimary} mb-3 flex items-center">
                      <span className="mr-2">⚡</span>
                      Quick Actions
                    </h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setShowFinancialModal(false);
                          handleRegistrationFeeUpdate(selectedDancerFinances.id, !selectedDancerFinances.registrationFeePaid);
                        }}
                        className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          selectedDancerFinances.registrationFeePaid
                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                        }`}
                      >
                        {selectedDancerFinances.registrationFeePaid ? 'Mark Registration Fee Unpaid' : 'Mark Registration Fee Paid'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-6 sm:space-y-8 animate-fadeIn">
          {/* Staff Creation Form */}
          <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
            <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-b ${themeClasses.cardBorder}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">👤</span>
                  </div>
                  <div>
                    <h2 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary}`}>Create Staff Account</h2>
                    <p className={`text-xs ${themeClasses.textMuted}`}>Add a new staff member with dashboard access</p>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                    Staff Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-2.5 border rounded-lg ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors`}
                    placeholder="Enter staff member name"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={clientForm.email}
                    onChange={(e) => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-2.5 border rounded-lg ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors`}
                    placeholder="staff@email.com"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={clientForm.password}
                    onChange={(e) => setClientForm(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-4 py-2.5 border rounded-lg ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors`}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full px-4 py-2.5 border rounded-lg ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors`}
                    placeholder="+27 12 345 6789"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-3`}>
                  Allowed Dashboards
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'announcer-dashboard', name: 'Announcer', icon: '📢' },
                    { id: 'backstage-dashboard', name: 'Backstage', icon: '🎭' },
                    { id: 'media-dashboard', name: 'Media', icon: '📸' },
                    { id: 'registration-dashboard', name: 'Registration', icon: '📝' },
                    { id: 'event-dashboard', name: 'Event Viewing', icon: '🏆' },
                    { id: 'judge-dashboard', name: 'Judge', icon: '⚖️' }
                  ].map((dashboard) => (
                    <label 
                      key={dashboard.id} 
                      className={`flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        clientForm.allowedDashboards.includes(dashboard.id)
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={clientForm.allowedDashboards.includes(dashboard.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setClientForm(prev => ({
                              ...prev,
                              allowedDashboards: [...prev.allowedDashboards, dashboard.id]
                            }));
                          } else {
                            setClientForm(prev => ({
                              ...prev,
                              allowedDashboards: prev.allowedDashboards.filter(d => d !== dashboard.id)
                            }));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-lg">{dashboard.icon}</span>
                      <span className={`text-sm font-medium ${themeClasses.textPrimary}`}>{dashboard.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`p-4 rounded-lg border-2 ${themeClasses.cardBorder} ${themeClasses.cardBg}`}>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientForm.canViewAllEvents}
                    onChange={(e) => setClientForm(prev => ({ ...prev, canViewAllEvents: e.target.checked }))}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className={`text-sm font-semibold ${themeClasses.textPrimary} block`}>Can view all events</span>
                    <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
                      If unchecked, staff will only see events they are specifically assigned to
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                  Notes
                </label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className={`w-full px-4 py-2.5 border rounded-lg ${themeClasses.cardBorder} ${themeClasses.cardBg} ${themeClasses.textPrimary} focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none`}
                  placeholder="Internal notes about this staff member..."
                />
              </div>

              <div className="flex justify-end pt-4 border-t ${themeClasses.cardBorder}">
                <button
                  type="submit"
                  disabled={isCreatingClient}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isCreatingClient ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2">
                      <span>✓</span>
                      <span>Create Staff Account</span>
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Staff List */}
          <div className={`${themeClasses.cardBg} backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl overflow-hidden border ${themeClasses.cardBorder}`}>
            <div className={`px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-b ${themeClasses.cardBorder}`}>
              <h2 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary}`}>Staff Accounts</h2>
              <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
                Manage staff accounts and their dashboard access permissions
              </p>
            </div>

            <div className="p-6">
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👤</span>
                  </div>
                  <h3 className={`text-lg font-semibold ${themeClasses.textPrimary} mb-2`}>No Staff Yet</h3>
                  <p className={`${themeClasses.textMuted}`}>
                    Create your first staff account to get started
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className={`border-b ${themeClasses.cardBorder}`}>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Staff Member
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Phone
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Dashboards
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Status
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Last Login
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${themeClasses.cardBorder}`}>
                      {clients.map((client) => (
                        <tr key={client.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className={`text-sm font-medium ${themeClasses.textPrimary}`}>
                                {client.name}
                              </div>
                              <div className={`text-sm ${themeClasses.textMuted}`}>
                                {client.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${themeClasses.textPrimary}`}>
                              {client.phone || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {client.allowedDashboards && client.allowedDashboards.length > 0 ? (
                                client.allowedDashboards.map((dashboard) => (
                                  <span
                                    key={dashboard}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                                  >
                                    {dashboard.replace('-dashboard', '')}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">No access</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                client.isActive && client.isApproved
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {client.isActive && client.isApproved ? 'Active' : 'Inactive'}
                              </span>
                              {client.canViewAllEvents && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  All Events
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {client.lastLoginAt 
                              ? new Date(client.lastLoginAt).toLocaleDateString()
                              : 'Never'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={async () => {
                                  const newStatus = !client.isActive;
                                  try {
                                    const response = await fetch('/api/clients', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        id: client.id,
                                        name: client.name,
                                        email: client.email,
                                        phone: client.phone,
                                        allowedDashboards: client.allowedDashboards,
                                        canViewAllEvents: client.canViewAllEvents,
                                        allowedEventIds: client.allowedEventIds,
                                        isActive: newStatus,
                                        isApproved: newStatus ? true : client.isApproved, // Auto-approve when activating
                                        notes: client.notes,
                                        updatedBy: JSON.parse(localStorage.getItem('adminSession') || '{}').id
                                      })
                                    });
                                    const data = await response.json();
                                    if (data.success) {
                                      success(`Staff ${newStatus ? 'activated' : 'deactivated'}`);
                                      fetchData();
                                    } else {
                                      error(data.error || 'Failed to update staff');
                                    }
                                  } catch (err) {
                                    error('Network error');
                                  }
                                }}
                                className={`px-3 py-1 text-xs rounded ${
                                  client.isActive && client.isApproved
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                {client.isActive && client.isApproved ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  showConfirm(
                                    'Are you sure you want to delete this staff member? This action cannot be undone.',
                                    async () => {
                                      try {
                                        const response = await fetch(`/api/clients?id=${client.id}`, {
                                          method: 'DELETE'
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                          success('Staff deleted successfully');
                                          fetchData();
                                        } else {
                                          error(data.error || 'Failed to delete staff');
                                        }
                                      } catch (err) {
                                        error('Network error');
                                      }
                                    }
                                  );
                                }}
                                className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with ThemeProvider
export default function AdminDashboardPage() {
  return (
    <ThemeProvider>
      <AdminDashboard />
    </ThemeProvider>
  );
} 