'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, PERFORMANCE_TYPES, AGE_CATEGORIES, EODSA_FEES } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { useAlert } from '@/components/ui/custom-alert';

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

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [dancers, setDancers] = useState<Dancer[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [studioApplications, setStudioApplications] = useState<StudioApplication[]>([]);
  const [verificationDancers, setVerificationDancers] = useState<Dancer[]>([]);
  const [verificationStudios, setVerificationStudios] = useState<Studio[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'judges' | 'assignments' | 'dancers' | 'studios' | 'verification'>('events');
  const [isLoading, setIsLoading] = useState(true);
  const { success, error, warning, info } = useToast();
  const { showAlert, showConfirm, showPrompt } = useAlert();
  
  // Event creation state - simplified to remove age category and entry fee
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    region: 'Nationals',
    eventDate: '',
    eventEndDate: '',
    registrationDeadline: '',
    venue: ''
  });
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
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

  // Verification processing state
  const [isProcessingVerification, setIsProcessingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  // Email testing state
  const [emailTestResults, setEmailTestResults] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Dancer search and filter state
  const [dancerSearchTerm, setDancerSearchTerm] = useState('');
  const [dancerStatusFilter, setDancerStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Studio search and filter state
  const [studioSearchTerm, setStudioSearchTerm] = useState('');
  const [studioStatusFilter, setStudioStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Modal states
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateJudgeModal, setShowCreateJudgeModal] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [selectedDancerFinances, setSelectedDancerFinances] = useState<any>(null);
  const [loadingFinances, setLoadingFinances] = useState(false);
  const [showAssignJudgeModal, setShowAssignJudgeModal] = useState(false);
  const [showEmailTestModal, setShowEmailTestModal] = useState(false);

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
      const [eventsRes, judgesRes, assignmentsRes, dancersRes, studiosRes, applicationsRes, verificationRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/judges'),
        fetch('/api/judge-assignments/nationals-view'),
        fetch('/api/admin/dancers'),
        fetch('/api/admin/studios'),
        fetch('/api/admin/studio-applications'),
        fetch('/api/admin/pending-verification')
      ]);

      const eventsData = await eventsRes.json();
      const judgesData = await judgesRes.json();
      const assignmentsData = await assignmentsRes.json();
      const dancersData = await dancersRes.json();
      const studiosData = await studiosRes.json();
      const applicationsData = await applicationsRes.json();
      const verificationData = await verificationRes.json();

      if (eventsData.success) setEvents(eventsData.events);
      if (judgesData.success) setJudges(judgesData.judges);
      if (assignmentsData.success) setAssignments(assignmentsData.assignments);
      if (dancersData.success) setDancers(dancersData.dancers);
      if (studiosData.success) setStudios(studiosData.studios);
      if (applicationsData.success) setStudioApplications(applicationsData.applications);
      if (verificationData.success) {
        setVerificationDancers(verificationData.data.dancers);
        setVerificationStudios(verificationData.data.studios);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
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
          entryFee: 0,
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
          venue: ''
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

  const handleProcessVerification = async () => {
    if (isProcessingVerification) {
      return;
    }

    showConfirm(
      '🔍 Process 48-Hour Verification Window\n\n' +
      'This will automatically approve all accounts that have passed the 48-hour verification period without being flagged as spam.\n\n' +
      'Accounts older than 48 hours that are still pending will be approved and moved to the "All" section.\n\n' +
      'Continue?',
      () => {
        performVerificationProcessing();
      }
    );
  };

  const performVerificationProcessing = async () => {
    setIsProcessingVerification(true);
    setVerificationMessage('');

    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        setVerificationMessage('Error: Session expired. Please log in again.');
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/process-verification', {
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
        setVerificationMessage(`✅ ${data.message}`);
        // Refresh the dashboard data
        fetchData();
        setTimeout(() => setVerificationMessage(''), 7000);
      } else {
        setVerificationMessage(`❌ Error: ${data.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Error processing verification:', error);
      setVerificationMessage('❌ Error processing verification. Please check your connection and try again.');
    } finally {
      setIsProcessingVerification(false);
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
      // Fetch event entries for this dancer to calculate outstanding balances
      const response = await fetch(`/api/admin/dancers/${dancer.eodsaId}/finances`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDancerFinances({
          ...dancer,
          eventEntries: data.eventEntries || [],
          totalOutstanding: data.totalOutstanding || 0,
          registrationFeeAmount: data.registrationFeeAmount || 0
        });
      } else {
        // If API doesn't exist yet, just show basic info
        setSelectedDancerFinances({
          ...dancer,
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

  const handleRejectAccount = async (accountId: string, accountType: 'dancer' | 'studio', accountName: string) => {
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again.', 7000);
        return;
      }

      const adminData = JSON.parse(session);

      const response = await fetch('/api/admin/reject-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          accountType,
          reason: 'Flagged as potential spam account during 48-hour verification period',
          adminId: adminData.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        success(`${accountType === 'dancer' ? 'Dancer' : 'Studio'} "${accountName}" has been rejected and disabled.`, 6000);
        fetchData(); // Refresh the data
      } else {
        error(data.error || 'An unknown error occurred while rejecting the account.', 8000);
      }
    } catch (err) {
      console.error('Error rejecting account:', err);
      error('Unable to reject account. Please check your connection and try again.', 8000);
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
    setVerificationMessage('');
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
              Loading Avalon Admin Dashboard
            </h2>
            <p className="text-gray-700 font-medium animate-pulse">Preparing your dashboard...</p>
            
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
      {/* Enhanced Header - Mobile Optimized */}
      <header className="bg-white/90 backdrop-blur-lg shadow-xl border-b border-indigo-100">
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
                <p className="text-gray-700 text-xs sm:text-sm lg:text-base font-medium">Competition Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden md:flex items-center space-x-3 px-3 sm:px-4 py-2 bg-indigo-50 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm font-medium text-gray-700">System Online</span>
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
              <Link 
                href="/admin/rankings"
                className="inline-flex items-center space-x-1 sm:space-x-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg sm:rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span className="text-sm sm:text-base">📊</span>
                <span className="font-medium">Rankings</span>
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
        <div className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-6 sm:mb-8 shadow-xl border border-white/50">
          <nav className="flex flex-col sm:flex-row gap-2">
            {[
              { id: 'events', label: 'Events', icon: '🏆', color: 'indigo' },
              { id: 'judges', label: 'Judges', icon: '👨‍⚖️', color: 'purple' },
              { id: 'assignments', label: 'Assignments', icon: '🔗', color: 'pink' },
              { id: 'dancers', label: 'Dancers', icon: '💃', color: 'rose' },
              { id: 'studios', label: 'Studios', icon: '🏢', color: 'orange' },
              { id: 'verification', label: 'Pending Verification', icon: '🔍', color: 'emerald' }
            ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base transform ${
                    activeTab === tab.id
                    ? `bg-gradient-to-r from-${tab.color}-500 to-${tab.color === 'indigo' ? 'blue' : tab.color === 'purple' ? 'pink' : 'rose'}-600 text-white shadow-lg scale-105`
                    : 'text-gray-600 hover:bg-white/80 hover:shadow-md hover:scale-102'
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
            <div className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs sm:text-sm">🏆</span>
                  </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Events</h2>
                    <div className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm font-medium">
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
                <div className="text-center py-8 sm:py-12 text-gray-500">
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
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Event</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Region</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Type</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/50 divide-y divide-gray-200">
                      {events.map((event) => (
                        <tr key={event.id} className="hover:bg-indigo-50/50 transition-colors duration-200">
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div>
                              <div className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">{event.name}</div>
                              <div className="text-xs sm:text-sm text-gray-700 font-medium mt-1">{event.venue}</div>
                                                            <div className="text-xs text-gray-500 sm:hidden mt-1">
                                {event.region} • {event.performanceType === 'All' ? 'All Performance Types' : event.performanceType} • {event.ageCategory}
                              </div>
              </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 hidden sm:table-cell">{event.region}</td>
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
                            <div className="text-xs sm:text-sm text-gray-700">{event.ageCategory}</div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
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
                              'bg-gray-50 text-gray-700 border-gray-200'
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
                <div className="flex items-center">
                              <Link
                                href={`/admin/events/${event.id}`}
                                className="text-indigo-500 hover:text-indigo-700 text-xs sm:text-sm font-medium"
                              >
                                <span className="hidden sm:inline">View Participants</span>
                                <span className="sm:hidden">View</span>
                              </Link>
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

        {/* Judges Tab - Enhanced */}
        {activeTab === 'judges' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Enhanced Judges List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-purple-100">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">👨‍⚖️</span>
                  </div>
                    <h2 className="text-xl font-bold text-gray-900">Judges</h2>
                    <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                      {judges.filter(j => !j.isAdmin).length} judges
                  </div>
                </div>
                  <button
                    onClick={() => setShowCreateJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
                  >
                    <span>➕</span>
                    <span className="hidden sm:inline">Create Judge</span>
                    <span className="sm:hidden">Create</span>
                  </button>
              </div>
            </div>
              
              {judges.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👨‍⚖️</span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No judges yet</h3>
                  <p className="text-sm mb-4">Create your first judge to get started!</p>
                  <button
                    onClick={() => setShowCreateJudgeModal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <span>➕</span>
                    <span>Create First Judge</span>
                  </button>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden md:table-cell">Created</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                    <tbody className="bg-white/50 divide-y divide-gray-200">
                      {judges.map((judge) => (
                        <tr key={judge.id} className="hover:bg-purple-50/50 transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-bold text-gray-900">{judge.name}</div>
                              <div className="text-sm text-gray-700 font-medium sm:hidden">{judge.email}</div>
                          </div>
                        </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 hidden sm:table-cell">{judge.email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                              judge.isAdmin ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-purple-300' : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {judge.isAdmin ? '👑 Admin' : '👨‍⚖️ Judge'}
                          </span>
                        </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600 hidden md:table-cell">
                            {new Date(judge.createdAt).toLocaleDateString()}
                        </td>
                          <td className="px-6 py-4">
                            {!judge.isAdmin && (
                              <button
                                onClick={() => handleDeleteJudge(judge.id, judge.name)}
                                className="inline-flex items-center px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                              >
                                🗑️ Delete
                              </button>
                            )}
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-pink-100">
              <div className="px-6 py-4 bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-b border-pink-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🔗</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Judge Assignments</h2>
                    <div className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
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
                <div className="text-center py-12 text-gray-500">
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
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Judge</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Event</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider hidden sm:table-cell">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                    <tbody className="bg-white/50 divide-y divide-gray-200">
                      {assignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-pink-50/50 transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-bold text-gray-900">{assignment.judgeName}</div>
                              <div className="text-sm text-gray-700 font-medium sm:hidden">{assignment.judgeEmail}</div>
                            </div>
                        </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {assignment.eventName}
                            <div className="text-xs text-gray-500 mt-1">{assignment.eventDate ? new Date(assignment.eventDate).toLocaleDateString() : 'No date'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600 hidden sm:table-cell">{assignment.judgeEmail}</td>
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-rose-100">
              <div className="px-6 py-4 bg-gradient-to-r from-rose-500/10 to-pink-500/10 border-b border-rose-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">💃</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Individual Dancer Registrations</h2>
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
                        className="w-full sm:w-64 px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm text-gray-900 placeholder-gray-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">🔍</span>
                      </div>
                    </div>
                    
                    <select
                      value={dancerStatusFilter}
                      onChange={(e) => setDancerStatusFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm text-gray-900"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="approved">✅ Approved</option>
                      <option value="rejected">❌ Rejected</option>
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
                  <div className="text-center py-12 text-gray-500">
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
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Age</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contact</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guardian</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/50 divide-y divide-gray-200">
                        {filteredDancers.map((dancer) => (
                          <tr key={dancer.id} className="hover:bg-rose-50/50 transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-bold text-gray-900">{dancer.name}</div>
                                <div className="text-xs text-gray-500">ID: {dancer.nationalId}</div>
                                <div className="text-xs text-gray-500">EODSA: {dancer.eodsaId}</div>
                                <div className="text-xs text-gray-500">Registered: {new Date(dancer.createdAt).toLocaleDateString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{dancer.age}</div>
                              <div className="text-xs text-gray-500">{dancer.dateOfBirth}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{dancer.email || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{dancer.phone || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4">
                              {dancer.guardianName ? (
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{dancer.guardianName}</div>
                                  <div className="text-xs text-gray-500">{dancer.guardianEmail}</div>
                                  <div className="text-xs text-gray-500">{dancer.guardianPhone}</div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">Adult</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {dancer.approved ? (
                                <div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✅ Approved
                                  </span>
                                  {dancer.approvedAt && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {new Date(dancer.approvedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : dancer.rejectionReason ? (
                                <div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ❌ Rejected
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1" title={dancer.rejectionReason}>
                                    {dancer.rejectionReason.length > 30 
                                      ? dancer.rejectionReason.substring(0, 30) + '...' 
                                      : dancer.rejectionReason}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
                                      <span className="font-medium text-gray-700">Reg Fee: </span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        dancer.registrationFeePaid 
                                          ? 'bg-green-100 text-green-800 border border-green-200' 
                                          : 'bg-red-100 text-red-800 border border-red-200'
                                      }`}>
                                        {dancer.registrationFeePaid ? '✅ Paid' : '❌ Not Paid'}
                                      </span>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex flex-col space-y-1">
                                      <button
                                        onClick={() => handleViewFinances(dancer)}
                                        className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 transition-colors"
                                      >
                                        💰 View Finances
                                      </button>
                                      
                                      {dancer.approved && (
                                        <button
                                          onClick={() => handleRegistrationFeeUpdate(dancer.id, !dancer.registrationFeePaid)}
                                          className={`w-full px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                            dancer.registrationFeePaid
                                              ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200'
                                              : 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-orange-100">
              <div className="px-6 py-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🏢</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Studio Registrations</h2>
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
                        className="w-full sm:w-64 px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-gray-900 placeholder-gray-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">🔍</span>
                      </div>
                    </div>
                    
                    <select
                      value={studioStatusFilter}
                      onChange={(e) => setStudioStatusFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-gray-900"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="approved">✅ Approved</option>
                      <option value="rejected">❌ Rejected</option>
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
                  <div className="text-center py-12 text-gray-500">
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
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Studio</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contact</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Registration</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/50 divide-y divide-gray-200">
                        {filteredStudios.map((studio) => (
                          <tr key={studio.id} className="hover:bg-orange-50/50 transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-bold text-gray-900">{studio.name}</div>
                                <div className="text-xs text-gray-500">Reg: {studio.registrationNumber}</div>
                                <div className="text-xs text-gray-500">Registered: {new Date(studio.createdAt).toLocaleDateString()}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{studio.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{studio.registrationNumber}</div>
                              <div className="text-xs text-gray-500">{new Date(studio.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4">
                              {studio.approved ? (
                                <div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✅ Approved
                                  </span>
                                  {studio.approvedAt && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {new Date(studio.approvedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : studio.rejectionReason ? (
                                <div>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ❌ Rejected
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1" title={studio.rejectionReason}>
                                    {studio.rejectionReason.length > 30 
                                      ? studio.rejectionReason.substring(0, 30) + '...' 
                                      : studio.rejectionReason}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
                                <span className="text-xs text-gray-400">No actions</span>
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

        {/* Pending Verification Tab */}
        {activeTab === 'verification' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Verification Overview */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-emerald-100">
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">🔍</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">48-Hour Verification Window</h2>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                      {verificationDancers.length + verificationStudios.length} accounts pending
                    </div>
                    <button
                      onClick={handleProcessVerification}
                      disabled={isProcessingVerification}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                    >
                      {isProcessingVerification ? 'Processing...' : 'Process Expired'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Verification Processing Message */}
              {verificationMessage && (
                <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-blue-800 text-sm font-medium">{verificationMessage}</p>
                </div>
              )}

              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <span className="text-blue-500 text-lg">ℹ️</span>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">Anti-Spam Protection</h3>
                      <p className="text-blue-800 text-sm leading-relaxed">
                        New accounts are automatically activated but monitored for 48 hours. Use the "Reject" button to disable spam accounts. 
                        Accounts automatically clear from this list after 48 hours and remain active indefinitely.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Dancers */}
                {verificationDancers.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">💃</span>
                      Recent Dancer Registrations ({verificationDancers.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dancer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EODSA ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {verificationDancers.map((dancer) => (
                            <tr key={dancer.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{dancer.name}</div>
                                <div className="text-sm text-gray-500">ID: {dancer.nationalId}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                {dancer.eodsaId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {dancer.age}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {dancer.email || 'Not provided'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(dancer.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleRejectAccount(dancer.id, 'dancer', dancer.name)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                >
                                  🚫 Reject
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Studios */}
                {verificationStudios.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="mr-2">🏢</span>
                      Recent Studio Registrations ({verificationStudios.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Studio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration #</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {verificationStudios.map((studio) => (
                            <tr key={studio.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{studio.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                {studio.registrationNumber}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {studio.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(studio.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={() => handleRejectAccount(studio.id, 'studio', studio.name)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                >
                                  🚫 Reject
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* No pending accounts */}
                {verificationDancers.length === 0 && verificationStudios.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-green-600 text-2xl">✅</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h3>
                    <p className="text-gray-500">No accounts pending verification in the last 48 hours.</p>
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
                  <h2 className="text-xl font-bold text-gray-900">Create New Event</h2>
                </div>
                <button
                  onClick={() => setShowCreateEventModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateEvent} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Event Name</label>
                    <input
                      type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                    required
                    placeholder="e.g., EODSA Nationals Championships 2024"
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Venue</label>
                  <input
                    type="text"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                    required
                    placeholder="e.g., Johannesburg Civic Theatre"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                    rows={3}
                    required
                    placeholder="Describe the event..."
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Competition</label>
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 font-medium text-base">
                    EODSA Nationals
                  </div>
                </div>



                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Event Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.eventDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900"
                    required
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">End Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.eventEndDate}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, eventEndDate: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900"
                    required
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Registration Deadline</label>
                  <input
                    type="datetime-local"
                    value={newEvent.registrationDeadline}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, registrationDeadline: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base font-medium text-gray-900"
                    required
                  />
                </div>



                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Performance Types</label>
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 font-medium text-base">
                    🎭 Creates All Performance Types (Solo, Duet, Trio, Group)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 This will automatically create separate events for Solo, Duet, Trio, and Group performances.
                  </p>
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
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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
                  <h2 className="text-xl font-bold text-gray-900">Create New Judge</h2>
                </div>
                <button
                  onClick={() => setShowCreateJudgeModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <form onSubmit={handleCreateJudge} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Judge Name</label>
                  <input
                    type="text"
                      value={newJudge.name}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                        setNewJudge(prev => ({ ...prev, name: cleanValue }));
                      }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                      required
                    placeholder="Full Name"
                    />
                  </div>
                  
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Email</label>
                    <input
                      type="email"
                      value={newJudge.email}
                      onChange={(e) => setNewJudge(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                      required
                    placeholder="judge@email.com"
                    />
                  </div>
                  
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Password</label>
                    <input
                      type="password"
                      value={newJudge.password}
                      onChange={(e) => setNewJudge(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base font-medium text-gray-900 placeholder-gray-400"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
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
                    <label htmlFor="isAdmin" className="ml-3 block text-sm font-medium text-gray-900">
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
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
            <div className="p-6 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg">🔗</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Assign Judge to Event</h2>
                </div>
                <button
                  onClick={() => setShowAssignJudgeModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              </div>

            <form onSubmit={handleAssignJudge} className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Select Judge</label>
                  <select
                    value={assignment.judgeId}
                    onChange={(e) => setAssignment(prev => ({ ...prev, judgeId: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-base font-medium text-gray-900"
                    required
                  >
                    <option value="">Choose a judge</option>
                    {judges.filter(judge => !judge.isAdmin).map(judge => (
                      <option key={judge.id} value={judge.id}>{judge.name} ({judge.email})</option>
                    ))}
                  </select>
                </div>
                
                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Select Event</label>
                  <select
                    value={assignment.eventId}
                    onChange={(e) => setAssignment(prev => ({ ...prev, eventId: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all duration-200 text-base font-medium text-gray-900"
                    required
                  >
                    <option value="">Choose an event</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name} {event.performanceType === 'All' ? '(All Performance Types)' : `(${event.performanceType})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
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

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAssignJudgeModal(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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
                  <h2 className="text-xl font-bold text-gray-900">Email Test</h2>
                  </div>
                <button
                  onClick={() => setShowEmailTestModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100/50 transition-colors"
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
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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
                    <h2 className="text-xl font-bold text-gray-900">Financial Overview</h2>
                    <p className="text-gray-600">{selectedDancerFinances.name} - {selectedDancerFinances.eodsaId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFinancialModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {loadingFinances ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading financial information...</p>
                </div>
              ) : (
                <>
                  {/* Registration Fee Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">📝</span>
                      Registration Fee
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status:</span>
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
                          <span className="text-sm text-gray-600">Paid Date:</span>
                          <span className="text-sm text-gray-900">
                            {new Date(selectedDancerFinances.registrationFeePaidAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      {selectedDancerFinances.registrationFeeMasteryLevel && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Mastery Level:</span>
                          <span className="text-sm text-gray-900">
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

                  {/* Event Entries Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">🎭</span>
                      Event Entries
                    </h3>
                    
                    {selectedDancerFinances.eventEntries && selectedDancerFinances.eventEntries.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDancerFinances.eventEntries.map((entry: any, index: number) => (
                          <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{entry.itemName}</div>
                                <div className="text-xs text-gray-500">{entry.eventName}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-gray-900">R{entry.calculatedFee?.toFixed(2) || '0.00'}</div>
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
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-gray-400 text-3xl mb-2">🎭</div>
                        <p className="text-gray-600 text-sm">No event entries found</p>
                      </div>
                    )}
                  </div>

                  {/* Total Outstanding Section */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Total Outstanding Balance
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Registration Fee:</span>
                        <span className="text-sm font-medium text-red-600">
                          {selectedDancerFinances.registrationFeePaid ? 'R0.00' : `R${EODSA_FEES.REGISTRATION.Nationals.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Event Entries Outstanding:</span>
                        <span className="text-sm font-medium text-red-600">
                          R{selectedDancerFinances.totalOutstanding?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-red-200">
                        <span className="text-base font-semibold text-gray-900">TOTAL OUTSTANDING:</span>
                        <span className="text-lg font-bold text-red-600">
                          R{(
                            (selectedDancerFinances.registrationFeePaid ? 0 : EODSA_FEES.REGISTRATION.Nationals) + 
                            (selectedDancerFinances.totalOutstanding || 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
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
    </div>
  );
} 