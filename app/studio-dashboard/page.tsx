'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecaptchaV2 } from '@/components/RecaptchaV2';
import { MASTERY_LEVELS, ITEM_STYLES } from '@/lib/types';
import MusicUpload from '@/components/MusicUpload';

// Studio session interface
interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

// Accepted dancer interface  
interface AcceptedDancer {
    id: string;
    eodsaId: string;
    name: string;
    age: number;
    dateOfBirth: string;
    nationalId: string;
    email?: string;
    phone?: string;
  joinedAt: string;
}

// Edit dancer interface
interface EditDancerData {
  name: string;
  dateOfBirth: string;
  nationalId: string;
  email?: string;
  phone?: string;
}

// Competition entry interface
interface CompetitionEntry {
  id: string;
  eventId: string;
  eventName: string;
  region: string;
  eventDate: string;
  venue: string;
  performanceType: string;
  contestantId: string;
  contestantName: string;
  contestantType: string;
  eodsaId: string;
  participantIds: string[];
  participantNames: string[];
  calculatedFee: number;
  paymentStatus: string;
  paymentMethod?: string;
  submittedAt: string;
  approved: boolean;
  itemNumber?: number;
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  createdAt: string;
  entryType?: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
}

// Music entry interface for studio music uploads
interface MusicEntry {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  venue: string;
  contestantId: string;
  contestantName: string;
  eodsaId: string;
  participantIds: string[];
  participantNames: string[];
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: number;
  entryType: 'live' | 'virtual';
  performanceType: string;
  isGroupEntry: boolean;
  submittedAt: string;
}

export default function StudioDashboardPage() {
  const [studioSession, setStudioSession] = useState<StudioSession | null>(null);
  const [acceptedDancers, setAcceptedDancers] = useState<AcceptedDancer[]>([]);
  const [competitionEntries, setCompetitionEntries] = useState<CompetitionEntry[]>([]);
  const [musicEntries, setMusicEntries] = useState<MusicEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dancers' | 'entries' | 'music'>('dancers');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddDancerModal, setShowAddDancerModal] = useState(false);
  const [addDancerEodsaId, setAddDancerEodsaId] = useState('');
  const [addingDancer, setAddingDancer] = useState(false);
  
  // Register new dancer state
  const [showRegisterDancerModal, setShowRegisterDancerModal] = useState(false);
  const [registerDancerData, setRegisterDancerData] = useState({
    name: '',
    dateOfBirth: '',
    nationalId: '',
    province: '',
    email: '',
    phone: '',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: ''
  });
  const [isRegisteringDancer, setIsRegisteringDancer] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const [dateValidationTimeout, setDateValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Edit dancer state
  const [showEditDancerModal, setShowEditDancerModal] = useState(false);
  const [editingDancer, setEditingDancer] = useState<AcceptedDancer | null>(null);
  const [editDancerData, setEditDancerData] = useState<EditDancerData>({
    name: '',
    dateOfBirth: '',
    nationalId: '',
    email: '',
    phone: ''
  });
  const [isEditingDancer, setIsEditingDancer] = useState(false);
  
  // Edit entry state
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CompetitionEntry | null>(null);
  const [editEntryData, setEditEntryData] = useState({
    itemName: '',
    choreographer: '',
    mastery: '',
    itemStyle: '',
    estimatedDuration: 1 // Default to 1 minute minimum
  });
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  
  // Dancer list view state
  const [selectedDancerForActions, setSelectedDancerForActions] = useState<AcceptedDancer | null>(null);
  const [dancerSearchQuery, setDancerSearchQuery] = useState('');
  
  // Music upload state
  const [uploadingMusicForEntry, setUploadingMusicForEntry] = useState<string | null>(null);
  
  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'joinedAt' | 'eodsaId'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [ageFilter, setAgeFilter] = useState<'all' | 'under18' | '18plus'>('all');
  const [recentFilter, setRecentFilter] = useState<boolean>(false);
  
  const router = useRouter();

  useEffect(() => {
    // Check for studio session
    const session = localStorage.getItem('studioSession');
    if (!session) {
      router.push('/studio-login');
      return;
    }

    const parsedSession = JSON.parse(session);
    setStudioSession(parsedSession);
    loadData(parsedSession.id);
  }, [router]);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (dateValidationTimeout) {
        clearTimeout(dateValidationTimeout);
      }
    };
  }, [dateValidationTimeout]);

  const loadData = async (studioId: string) => {
    try {
      setIsLoading(true);
      
      // Load accepted dancers, competition entries, and music entries
      const [dancersResponse, entriesResponse, musicEntriesResponse] = await Promise.all([
        fetch(`/api/studios/dancers-new?studioId=${studioId}`),
        fetch(`/api/studios/entries?studioId=${studioId}`),
        fetch(`/api/studios/music-entries?studioId=${studioId}`)
      ]);

      const dancersData = await dancersResponse.json();
      const entriesData = await entriesResponse.json();
      const musicEntriesData = await musicEntriesResponse.json();

      if (dancersData.success) {
        setAcceptedDancers(dancersData.dancers);
      } else {
        setError(dancersData.error || 'Failed to load dancers');
      }

      if (entriesData.success) {
        setCompetitionEntries(entriesData.entries);
      } else {
        console.error('Failed to load entries:', entriesData.error);
        setCompetitionEntries([]);
      }

      if (musicEntriesData.success) {
        setMusicEntries(musicEntriesData.entries);
      } else {
        console.error('Failed to load music entries:', musicEntriesData.error);
        setMusicEntries([]);
      }
    } catch (error) {
      console.error('Load data error:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDancer = async () => {
    if (!studioSession || !addDancerEodsaId.trim()) return;

    try {
      setAddingDancer(true);
      setError('');

      const response = await fetch('/api/studios/add-dancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId: studioSession.id,
          eodsaId: addDancerEodsaId.trim().toUpperCase(),
          addedBy: studioSession.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowAddDancerModal(false);
        setAddDancerEodsaId('');
        setSuccessMessage(`Dancer ${addDancerEodsaId.trim().toUpperCase()} has been successfully added to your studio!`);
        // Reload data to reflect changes
        loadData(studioSession.id);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Failed to add dancer');
      }
    } catch (error) {
      console.error('Add dancer error:', error);
      setError('Failed to add dancer');
    } finally {
      setAddingDancer(false);
    }
  };

  const handleRegisterDancer = async () => {
    if (!studioSession) return;

    // Validate required fields
    if (!registerDancerData.name || !registerDancerData.dateOfBirth || !registerDancerData.nationalId || !registerDancerData.province) {
      setError('Name, date of birth, national ID, and province are required');
      return;
    }

    // Validate reCAPTCHA
    if (!recaptchaToken) {
      setError('Please complete the security verification (reCAPTCHA)');
      return;
    }

    // Calculate age to check requirements
    const age = new Date().getFullYear() - new Date(registerDancerData.dateOfBirth).getFullYear();
    
    // Check email and phone requirements for adults
    if (age >= 18) {
      if (!registerDancerData.email || !registerDancerData.phone) {
        setError('Email and phone number are required for dancers 18 years and older');
        return;
      }
    }
    
    // Check guardian info for minors
    if (age < 18) {
      if (!registerDancerData.guardianName || !registerDancerData.guardianEmail || !registerDancerData.guardianPhone) {
        setError('Guardian information is required for dancers under 18');
        return;
      }
    }

    try {
      setIsRegisteringDancer(true);
      setError('');

      // Register the dancer and automatically assign to studio
      const registerResponse = await fetch('/api/dancers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerDancerData.name,
          dateOfBirth: registerDancerData.dateOfBirth,
          nationalId: registerDancerData.nationalId,
          province: registerDancerData.province,
          email: registerDancerData.email || null,
          phone: registerDancerData.phone || null,
          guardianName: registerDancerData.guardianName || null,
          guardianEmail: registerDancerData.guardianEmail || null,
          guardianPhone: registerDancerData.guardianPhone || null,
          studioId: studioSession.id, // This will trigger automatic studio assignment
          recaptchaToken: recaptchaToken
        }),
      });

      let registerData;
      try {
        registerData = await registerResponse.json();
      } catch (parseError) {
        console.error('Error parsing registration response:', parseError);
        setError('Server error - unable to process request. Please try again.');
        return;
      }
      
      console.log('Studio registration response:', registerData); // Debug log

      if (registerData.success) {
        setShowRegisterDancerModal(false);
        setRegisterDancerData({
          name: '',
          dateOfBirth: '',
          nationalId: '',
          province: '',
          email: '',
          phone: '',
          guardianName: '',
          guardianEmail: '',
          guardianPhone: ''
        });
        setRecaptchaToken('');
        
        // Check if there was a studio assignment error
        if (registerData.studioAssignmentError) {
          setSuccessMessage(`Dancer ${registerDancerData.name} has been registered with EODSA ID ${registerData.eodsaId}, but there was an issue adding them to your studio. Please add them manually using their EODSA ID.`);
        } else {
          setSuccessMessage(`Dancer ${registerDancerData.name} has been successfully registered with EODSA ID ${registerData.eodsaId} and added to your studio!`);
        }
        
        // Reload data to reflect changes
        loadData(studioSession.id);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        // Display the specific error message from the server
        setError(registerData.error || 'Failed to register dancer');
        
        // Handle reCAPTCHA specific errors
        if (registerData.recaptchaFailed) {
          setRecaptchaToken(''); // Reset reCAPTCHA on failure
        }
        
        // If it's a duplicate National ID error, suggest checking account
        if (registerData.error && registerData.error.includes('National ID is already registered')) {
          setError('Please double check your national ID or maybe this dancer already has an account.');
        }
      }
    } catch (error) {
      console.error('Register dancer error:', error);
      setError('Failed to register dancer');
    } finally {
      setIsRegisteringDancer(false);
    }
  };

  const handleEditDancer = (dancer: AcceptedDancer) => {
    setEditingDancer(dancer);
    setEditDancerData({
      name: dancer.name,
      dateOfBirth: dancer.dateOfBirth,
      nationalId: dancer.nationalId,
      email: dancer.email || '',
      phone: dancer.phone || ''
    });
    setShowEditDancerModal(true);
  };

  const handleUpdateDancer = async () => {
    if (!studioSession || !editingDancer) return;

    try {
      setIsEditingDancer(true);
      setError('');

      const response = await fetch('/api/studios/edit-dancer', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId: studioSession.id,
          dancerId: editingDancer.id,
          ...editDancerData
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowEditDancerModal(false);
        setEditingDancer(null);
        setSuccessMessage(`Dancer ${editDancerData.name} has been successfully updated!`);
        // Reload data to reflect changes
        loadData(studioSession.id);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Failed to update dancer');
      }
    } catch (error) {
      console.error('Update dancer error:', error);
      setError('Failed to update dancer');
    } finally {
      setIsEditingDancer(false);
    }
  };

  const handleDeleteDancer = async (dancer: AcceptedDancer) => {
    if (!studioSession) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${dancer.name} (${dancer.eodsaId}) from your studio? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError('');

      const response = await fetch('/api/studios/remove-dancer', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId: studioSession.id,
          dancerId: dancer.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Dancer ${dancer.name} has been removed from your studio.`);
        // Reload data to reflect changes
        loadData(studioSession.id);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Failed to remove dancer');
      }
    } catch (error) {
      console.error('Remove dancer error:', error);
      setError('Failed to remove dancer');
    }
  };

  // Entry management functions
  const handleEditEntry = (entry: CompetitionEntry) => {
    setEditingEntry(entry);
    setEditEntryData({
      itemName: entry.itemName,
      choreographer: entry.choreographer,
      mastery: entry.mastery,
      itemStyle: entry.itemStyle,
      estimatedDuration: entry.estimatedDuration
    });
    setShowEditEntryModal(true);
  };

  const handleSaveEntryEdit = async () => {
    if (!studioSession || !editingEntry) return;

    try {
      setError('');

      const response = await fetch(`/api/studios/entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId: studioSession.id,
          ...editEntryData
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Entry "${editEntryData.itemName}" updated successfully.`);
        setShowEditEntryModal(false);
        setEditingEntry(null);
        setEditEntryData({
          itemName: '',
          choreographer: '',
          mastery: '',
          itemStyle: '',
          estimatedDuration: 1 // Default to 1 minute minimum
        });
        // Reload data to reflect changes
        loadData(studioSession.id);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Failed to update entry');
      }
    } catch (error) {
      console.error('Update entry error:', error);
      setError('Failed to update entry');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studioSession');
    router.push('/studio-login');
  };

  // Handle music upload for studio entries
  const handleMusicUpload = async (entryId: string, fileData: { url: string; originalFilename: string }) => {
    if (!studioSession) return;

    try {
      setUploadingMusicForEntry(entryId);
      setError('');

      // Find the entry name for better feedback
      const entry = musicEntries.find(e => e.id === entryId);
      const entryName = entry?.itemName || 'entry';

      const response = await fetch('/api/studios/upload-music', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studioId: studioSession.id,
          entryId: entryId,
          musicFileUrl: fileData.url,
          musicFileName: fileData.originalFilename
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`🎵 Music uploaded successfully for "${entryName}"! The entry has been updated and is now ready for the live performance.`);
        
        // Reload data to reflect changes (entry should disappear from music uploads tab)
        await loadData(studioSession.id);
        
        // Clear success message after 7 seconds (longer to read the full message)
        setTimeout(() => setSuccessMessage(''), 7000);
      } else {
        setError(data.error || 'Failed to upload music');
      }
    } catch (error) {
      console.error('Music upload error:', error);
      setError('Failed to upload music');
    } finally {
      setUploadingMusicForEntry(null);
    }
  };

  // National ID validation handler
  const handleNationalIdChange = (value: string, setData: (prev: any) => void) => {
    // Remove any non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    // Limit to 13 digits (South African ID length)
    const limitedValue = numericValue.slice(0, 13);
    
    setData((prev: any) => ({ ...prev, nationalId: limitedValue }));
  };

  // Phone number validation handler
  const handlePhoneChange = (value: string, setData: (prev: any) => void, field: string) => {
    // Allow only digits, spaces, hyphens, parentheses, and plus sign
    const cleanValue = value.replace(/[^0-9\s\-\(\)\+]/g, '');
    // Limit to 15 characters total (international format)
    const limitedValue = cleanValue.slice(0, 15);
    
    // Auto-format: XXX XXX XXXX (for 10-digit numbers)
    const numbersOnly = limitedValue.replace(/\D/g, '');
    let formattedValue = limitedValue;
    
    if (numbersOnly.length <= 10 && !limitedValue.includes('+')) {
      if (numbersOnly.length >= 3) {
        formattedValue = numbersOnly.slice(0, 3);
        if (numbersOnly.length >= 6) {
          formattedValue += ' ' + numbersOnly.slice(3, 6);
          if (numbersOnly.length > 6) {
            formattedValue += ' ' + numbersOnly.slice(6, 10);
          }
        } else if (numbersOnly.length > 3) {
          formattedValue += ' ' + numbersOnly.slice(3);
        }
      } else {
        formattedValue = numbersOnly;
      }
    }
    
    setData((prev: any) => ({ ...prev, [field]: formattedValue }));
  };

  // Name validation handler
  const handleNameChange = (value: string, setData: (prev: any) => void, field: string) => {
    // Allow only letters, spaces, hyphens, and apostrophes
    // Don't trim here to preserve spaces during typing
    const cleanValue = value.replace(/[^a-zA-Z\s\-\']/g, '');
    
    setData((prev: any) => ({ ...prev, [field]: cleanValue }));
  };

  // Email validation handler
  const handleEmailChange = (value: string, setData: (prev: any) => void, field: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setError('Please enter a valid email address');
    } else {
      setError('');
    }
    setData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Date of birth validation handler with debounced validation (wait 2 seconds after user stops typing)
  const handleDateOfBirthChange = (value: string, setData: (prev: any) => void) => {
    // Clear any existing timeout
    if (dateValidationTimeout) {
      clearTimeout(dateValidationTimeout);
    }
    
    // Set a new timeout to validate after 2 seconds
    const newTimeout = setTimeout(() => {
      // Only validate if the date is reasonably complete (has at least YYYY-MM-DD format)
      if (value.length >= 10 && value.includes('-')) {
        const today = new Date();
        const selectedDate = new Date(value);
        const minDate = new Date('1900-01-01');
        
        // Only validate if the date is valid (not Invalid Date)
        if (!isNaN(selectedDate.getTime())) {
          // Prevent future dates
          if (selectedDate > today) {
            setError('Date of birth cannot be in the future.');
            return;
          }
          
          // Prevent dates before 1900
          if (selectedDate < minDate) {
            setError('Please enter a valid date of birth after 1900');
            return;
          }
        }
      }
    }, 2000);
    
    setDateValidationTimeout(newTimeout);
    
    // Clear error immediately when typing starts
    setError('');
    setData((prev: any) => ({ ...prev, dateOfBirth: value }));
  };

  // Calculate studio metrics
  const getStudioStats = () => {
    return {
      totalDancers: acceptedDancers.length,
      totalEntries: competitionEntries.length,
      avgAge: acceptedDancers.length > 0 
        ? Math.round(acceptedDancers.reduce((sum, dancer) => sum + dancer.age, 0) / acceptedDancers.length)
        : 0,
      recentJoins: acceptedDancers.filter(dancer => {
        const joinDate = new Date(dancer.joinedAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joinDate >= thirtyDaysAgo;
      }).length
    };
  };

  const getUniqueEventsCount = () => {
    const uniqueEvents = new Set(competitionEntries.map(entry => entry.eventId));
    return uniqueEvents.size;
  };

  // Reset pagination when search/filters change
  useEffect(() => {
    resetPagination();
  }, [dancerSearchQuery, ageFilter, recentFilter, sortBy, sortOrder]);

  const getFilteredAndSortedDancers = () => {
    let filtered = acceptedDancers;
    
    // Apply search filter
    if (dancerSearchQuery.trim()) {
      const query = dancerSearchQuery.toLowerCase();
      filtered = filtered.filter(dancer => 
        dancer.name.toLowerCase().includes(query) ||
        dancer.eodsaId.toLowerCase().includes(query) ||
        dancer.nationalId.toLowerCase().includes(query) ||
        dancer.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply age filter
    if (ageFilter !== 'all') {
      filtered = filtered.filter(dancer => {
        if (ageFilter === 'under18') return dancer.age < 18;
        if (ageFilter === '18plus') return dancer.age >= 18;
        return true;
      });
    }
    
    // Apply recent filter (joined in last 30 days)
    if (recentFilter) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(dancer => 
        new Date(dancer.joinedAt) >= thirtyDaysAgo
      );
    }
    
    // Sort the results
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'age':
          aVal = a.age;
          bVal = b.age;
          break;
        case 'joinedAt':
          aVal = new Date(a.joinedAt);
          bVal = new Date(b.joinedAt);
          break;
        case 'eodsaId':
          aVal = a.eodsaId;
          bVal = b.eodsaId;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  };

  const getPaginatedDancers = () => {
    const filtered = getFilteredAndSortedDancers();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      dancers: filtered.slice(startIndex, endIndex),
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  };

  // Reset pagination when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  const stats = getStudioStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading studio dashboard...</p>
        </div>
      </div>
    );
  }

  if (!studioSession) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 pb-safe-bottom">
      <style jsx global>{`
        .pb-safe-bottom {
          padding-bottom: max(env(safe-area-inset-bottom, 24px), 24px);
        }
        
        @media screen and (max-width: 414px) and (min-height: 800px) {
          .pb-safe-bottom {
            padding-bottom: 140px;
          }
        }
      `}</style>
      
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {studioSession.name}
              </h1>
              <p className="text-gray-300 text-xs sm:text-sm break-all">
                Registration: {studioSession.registrationNumber} | Email: {studioSession.email}
              </p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/"
                className="px-4 py-2 border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Home
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Studio Dashboard</h2>
                      <p className="text-gray-200">Manage your dancers and competition entries</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-300">{error}</p>
            <button 
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-900/20 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-300">{successMessage}</p>
            <button 
              onClick={() => setSuccessMessage('')}
              className="text-green-400 hover:text-green-300 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Studio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Total Dancers</h3>
                <p className="text-3xl font-bold text-purple-400">{stats.totalDancers}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Competition Entries</h3>
                <p className="text-3xl font-bold text-green-400">{stats.totalEntries}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Average Age</h3>
                <p className="text-3xl font-bold text-blue-400">{stats.avgAge || '-'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/20">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Recent Joins</h3>
                <p className="text-3xl font-bold text-orange-400">{stats.recentJoins}</p>
                <p className="text-xs text-gray-400">Last 30 days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-800/80 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('dancers')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'dancers'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              My Dancers ({acceptedDancers.length})
            </button>
            <button
              onClick={() => setActiveTab('entries')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'entries'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              My Entries ({stats.totalEntries})
            </button>
            <button
              onClick={() => setActiveTab('music')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'music'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              🎵 Music Uploads ({musicEntries.length})
            </button>
          </div>
        </div>

        {/* Dancers Tab */}
        {activeTab === 'dancers' && (
          <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">My Dancers</h3>
                      <p className="text-gray-400 text-sm">
                        Manage your studio dancers ({getPaginatedDancers().totalCount} found, {acceptedDancers.length} total)
                      </p>
                    </div>
                  </div>
                  
                  {/* Enhanced Search and Filters */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                    {/* Search Input */}
                    <div className="lg:col-span-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={dancerSearchQuery}
                          onChange={(e) => setDancerSearchQuery(e.target.value)}
                          placeholder="Search by name, EODSA ID, National ID, or email..."
                          className="w-full px-4 py-2 pl-10 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Age Filter */}
                    <div className="lg:col-span-2">
                      <select
                        value={ageFilter}
                        onChange={(e) => setAgeFilter(e.target.value as 'all' | 'under18' | '18plus')}
                        className="w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="all">All Ages</option>
                        <option value="under18">Under 18</option>
                        <option value="18plus">18+</option>
                      </select>
                    </div>
                    
                    {/* Recent Filter */}
                    <div className="lg:col-span-2">
                      <label className="flex items-center space-x-2 text-white">
                        <input
                          type="checkbox"
                          checked={recentFilter}
                          onChange={(e) => setRecentFilter(e.target.checked)}
                          className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm">Recent (30d)</span>
                      </label>
                    </div>
                    
                    {/* Sort By */}
                    <div className="lg:col-span-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'name' | 'age' | 'joinedAt' | 'eodsaId')}
                        className="w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="name">Sort by Name</option>
                        <option value="age">Sort by Age</option>
                        <option value="joinedAt">Sort by Join Date</option>
                        <option value="eodsaId">Sort by EODSA ID</option>
                      </select>
                    </div>
                    
                    {/* Sort Order */}
                    <div className="lg:col-span-2">
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="w-full px-3 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white hover:bg-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 flex items-center justify-center space-x-1"
                      >
                        <span className="text-sm">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        <span className="text-sm">{sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Items Per Page */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">Show:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-2 py-1 border border-gray-600 bg-gray-700 rounded text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-400">per page</span>
                    </div>
                    
                    <div className="text-sm text-gray-400">
                      Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, getPaginatedDancers().totalCount)} of {getPaginatedDancers().totalCount}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowRegisterDancerModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>Register New Dancer</span>
                </button>
                <button
                  onClick={() => setShowAddDancerModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add by EODSA ID</span>
                </button>
              </div>
            </div>

            {acceptedDancers.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">No dancers in your studio yet</p>
                <p className="text-gray-500 text-sm">Start by registering new dancers or adding existing ones by EODSA ID</p>
              </div>
            ) : getPaginatedDancers().totalCount === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">No dancers match your search criteria</p>
                <p className="text-gray-500 text-sm">Try adjusting your search terms or filters</p>
              </div>
            ) : (
              /* Enhanced List View with Pagination */
              <>
                <div className="divide-y divide-gray-700">
                  {getPaginatedDancers().dancers.map((dancer) => (
                    <div key={dancer.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-3">
                            <h4 className="text-lg font-semibold text-white mr-3">{dancer.name}</h4>
                            <span className="px-3 py-1 bg-purple-900/30 text-purple-300 rounded-full text-sm font-medium">
                              Age {dancer.age}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">EODSA ID:</span>
                              <span className="text-white ml-2 font-mono">{dancer.eodsaId}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">National ID:</span>
                              <span className="text-white ml-2 font-mono">{dancer.nationalId}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Joined:</span>
                              <span className="text-white ml-2">{new Date(dancer.joinedAt).toLocaleDateString()}</span>
                            </div>
                            {dancer.email && (
                              <div>
                                <span className="text-gray-400">Email:</span>
                                <span className="text-white ml-2">{dancer.email}</span>
                              </div>
                            )}
                            {dancer.phone && (
                              <div>
                                <span className="text-gray-400">Phone:</span>
                                <span className="text-white ml-2">{dancer.phone}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-400">Date of Birth:</span>
                              <span className="text-white ml-2">{new Date(dancer.dateOfBirth).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEditDancer(dancer)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDancer(dancer)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Remove
                          </button>
                          <Link
                            href={`/event-dashboard?eodsaId=${dancer.eodsaId}`}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            Enter Competitions
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {getPaginatedDancers().totalPages > 1 && (
                  <div className="p-6 border-t border-gray-700 bg-gray-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">
                          Page {currentPage} of {getPaginatedDancers().totalPages}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Previous
                        </button>
                        
                        {/* Page Numbers */}
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: Math.min(5, getPaginatedDancers().totalPages) }, (_, i) => {
                            let pageNum;
                            if (getPaginatedDancers().totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= getPaginatedDancers().totalPages - 2) {
                              pageNum = getPaginatedDancers().totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === getPaginatedDancers().totalPages}
                          className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCurrentPage(getPaginatedDancers().totalPages)}
                          disabled={currentPage === getPaginatedDancers().totalPages}
                          className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* My Entries Tab */}
        {activeTab === 'entries' && (
          <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">Competition Entries</h3>
                  <p className="text-gray-400 text-sm mt-1">View and manage competition entries for your dancers</p>
                </div>
                <Link
                  href={`/event-dashboard?studioId=${studioSession?.id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add New Entry</span>
                </Link>
              </div>
            </div>

            {competitionEntries.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">No competition entries yet</p>
                <p className="text-gray-500 text-sm">Start entering your dancers into competitions to see entries here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {competitionEntries.map((entry) => (
                  <div key={entry.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <h4 className="text-lg font-semibold text-white mr-3">{entry.eventName}</h4>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            entry.approved 
                              ? 'bg-green-900/30 text-green-300' 
                              : 'bg-yellow-900/30 text-yellow-300'
                          }`}>
                            {entry.approved ? 'Approved' : 'Pending'}
                          </span>
                          {entry.itemNumber && (
                            <span className="ml-2 px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs">
                              #{entry.itemNumber}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Contestant:</span>
                            <span className="text-white ml-2">{entry.contestantName}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Item:</span>
                            <span className="text-white ml-2">{entry.itemName}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Style:</span>
                            <span className="text-white ml-2">{entry.itemStyle}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Choreographer:</span>
                            <span className="text-white ml-2">{entry.choreographer}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Mastery:</span>
                            <span className="text-white ml-2">{entry.mastery}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Duration:</span>
                            <span className="text-white ml-2">{entry.estimatedDuration} min</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Fee:</span>
                            <span className="text-white ml-2">R{entry.calculatedFee}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Status:</span>
                            <span className="text-white ml-2">{entry.paymentStatus}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Submitted:</span>
                            <span className="text-white ml-2">{new Date(entry.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2 ml-4">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Edit Entry
                        </button>
                        <div className="px-3 py-1 text-xs text-gray-400 italic bg-gray-800/50 rounded-lg border border-gray-700">
                          💡 Only admins can remove entries
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Music Uploads Tab */}
        {activeTab === 'music' && (
          <div className="bg-gray-800/80 rounded-2xl border border-gray-700/20 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">🎵 Music Uploads</h3>
                  <p className="text-gray-400 text-sm mt-1">Upload music files for your dancers' live performance entries</p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span className="inline-flex items-center px-2 py-1 bg-blue-900/30 text-blue-300 rounded-full text-xs">
                    💡 Studio managers can upload music on behalf of dancers
                  </span>
                </div>
              </div>
            </div>

            {musicEntries.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-2">All entries have music uploaded</p>
                <p className="text-gray-500 text-sm">Live performance entries that need music files will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {musicEntries.map((entry) => (
                  <div key={entry.id} className="p-4 sm:p-6 hover:bg-gray-700/30 transition-colors">
                    <div className="flex flex-col gap-6">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                          <h4 className="text-lg font-semibold text-white">{entry.itemName}</h4>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${
                            entry.isGroupEntry 
                              ? 'bg-purple-900/30 text-purple-300' 
                              : 'bg-blue-900/30 text-blue-300'
                          }`}>
                            {entry.isGroupEntry ? `👥 ${entry.performanceType}` : '🕺 Solo'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Event:</span>
                            <span className="text-white font-medium">{entry.eventName}</span>
                          </div>
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Contestant:</span>
                            <span className="text-white">{entry.contestantName}</span>
                          </div>
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Style:</span>
                            <span className="text-white">{entry.itemStyle}</span>
                          </div>
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Choreographer:</span>
                            <span className="text-white">{entry.choreographer}</span>
                          </div>
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Mastery:</span>
                            <span className="text-white">{entry.mastery}</span>
                          </div>
                          <div className="bg-gray-800/40 p-3 rounded-lg">
                            <span className="text-gray-400 block">Duration:</span>
                            <span className="text-white">{entry.estimatedDuration} min</span>
                          </div>
                        </div>

                        {/* Group Information */}
                        {entry.isGroupEntry && (
                          <div className="mb-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                            <p className="text-purple-300 text-sm font-medium mb-2">
                              🎭 Group Performance ({entry.participantIds.length} dancers)
                            </p>
                            <p className="text-purple-200 text-xs">
                              As the studio manager, you can upload music for this group entry on behalf of all participants.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="w-full">
                        <div className="bg-slate-800/60 rounded-xl p-4 border border-gray-600">
                          <h5 className="text-white font-medium mb-4 flex items-center text-lg">
                            🎵 Upload Music File
                          </h5>
                          <MusicUpload
                            onUploadSuccess={(fileData) => handleMusicUpload(entry.id, fileData)}
                            onUploadError={(error) => setError(error)}
                            disabled={uploadingMusicForEntry === entry.id}
                          />
                          {uploadingMusicForEntry === entry.id && (
                            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                              <div className="flex items-center text-blue-400">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
                                <span className="font-medium">Uploading music for "{entry.itemName}"...</span>
                              </div>
                              <p className="text-blue-300 text-sm mt-2">
                                📱 Please wait while we save the music file to this entry. The page will refresh automatically when complete.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Dancer Modal */}
      {showAddDancerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Add Dancer by EODSA ID</h3>
            <p className="text-gray-300 mb-4">Enter the EODSA ID of a dancer to add them to your studio.</p>
            
            {/* Error Message Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <input
              type="text"
              value={addDancerEodsaId}
              onChange={(e) => setAddDancerEodsaId(e.target.value.toUpperCase())}
              placeholder="e.g., EODSA00123"
              className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleAddDancer}
                disabled={addingDancer || !addDancerEodsaId.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingDancer ? 'Adding...' : 'Add Dancer'}
              </button>
              <button
                onClick={() => {
                  setShowAddDancerModal(false);
                  setAddDancerEodsaId('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Dancer Modal */}
      {showRegisterDancerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Register New Dancer</h3>
            
            {/* Error Message Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={registerDancerData.name}
                  onChange={(e) => handleNameChange(e.target.value, setRegisterDancerData, 'name')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={registerDancerData.dateOfBirth}
                  onChange={(e) => handleDateOfBirthChange(e.target.value, setRegisterDancerData)}
                  min="1900-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">National ID *</label>
                <input
                  type="text"
                  value={registerDancerData.nationalId}
                  onChange={(e) => handleNationalIdChange(e.target.value, setRegisterDancerData)}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="13 digit ID number"
                  maxLength={13}
                  inputMode="numeric"
                  title="Please enter exactly 13 digits"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Province *</label>
                <select
                  value={registerDancerData.province}
                  onChange={(e) => setRegisterDancerData({...registerDancerData, province: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select province</option>
                  <option value="Western Cape">Western Cape</option>
                  <option value="Eastern Cape">Eastern Cape</option>
                  <option value="Northern Cape">Northern Cape</option>
                  <option value="Free State">Free State</option>
                  <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                  <option value="North West">North West</option>
                  <option value="Gauteng">Gauteng</option>
                  <option value="Mpumalanga">Mpumalanga</option>
                  <option value="Limpopo">Limpopo</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Email {new Date().getFullYear() - new Date(registerDancerData.dateOfBirth).getFullYear() >= 18 && '*'}</label>
                <input
                  type="email"
                  value={registerDancerData.email}
                  onChange={(e) => handleEmailChange(e.target.value, setRegisterDancerData, 'email')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Phone {new Date().getFullYear() - new Date(registerDancerData.dateOfBirth).getFullYear() >= 18 && '*'}</label>
                <input
                  type="tel"
                  value={registerDancerData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value, setRegisterDancerData, 'phone')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="081 234 5678"
                  maxLength={15}
                />
              </div>
              
              {registerDancerData.dateOfBirth && new Date().getFullYear() - new Date(registerDancerData.dateOfBirth).getFullYear() < 18 && (
                <>
                  <div className="border-t border-gray-700 pt-4">
                    <h4 className="text-lg font-semibold text-white mb-2">Guardian Information (Required for minors)</h4>
                  </div>
                  
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Name *</label>
                    <input
                      type="text"
                      value={registerDancerData.guardianName}
                      onChange={(e) => handleNameChange(e.target.value, setRegisterDancerData, 'guardianName')}
                      className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Email *</label>
                    <input
                      type="email"
                      value={registerDancerData.guardianEmail}
                      onChange={(e) => handleEmailChange(e.target.value, setRegisterDancerData, 'guardianEmail')}
                      className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Phone *</label>
                    <input
                      type="tel"
                      value={registerDancerData.guardianPhone}
                      onChange={(e) => handlePhoneChange(e.target.value, setRegisterDancerData, 'guardianPhone')}
                      className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="081 234 5678"
                      maxLength={15}
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="pt-4">
                <RecaptchaV2 onVerify={(token) => setRecaptchaToken(token)} />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleRegisterDancer}
                disabled={isRegisteringDancer}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRegisteringDancer ? 'Registering...' : 'Register Dancer'}
              </button>
              <button
                onClick={() => {
                  setShowRegisterDancerModal(false);
                        setRegisterDancerData({
        name: '',
        dateOfBirth: '',
        nationalId: '',
        province: '',
        email: '',
        phone: '',
        guardianName: '',
        guardianEmail: '',
        guardianPhone: ''
      });
                  setError('');
                  setRecaptchaToken('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dancer Modal */}
      {showEditDancerModal && editingDancer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Edit Dancer Information</h3>
            
            {/* Error Message Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editDancerData.name}
                  onChange={(e) => handleNameChange(e.target.value, setEditDancerData, 'name')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={editDancerData.dateOfBirth}
                  onChange={(e) => handleDateOfBirthChange(e.target.value, setEditDancerData)}
                  min="1900-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">National ID *</label>
                <input
                  type="text"
                  value={editDancerData.nationalId}
                  onChange={(e) => handleNationalIdChange(e.target.value, setEditDancerData)}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="13 digit ID number"
                  maxLength={13}
                  inputMode="numeric"
                  title="Please enter exactly 13 digits"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editDancerData.email || ''}
                  onChange={(e) => handleEmailChange(e.target.value, setEditDancerData, 'email')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={editDancerData.phone || ''}
                  onChange={(e) => handlePhoneChange(e.target.value, setEditDancerData, 'phone')}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="081 234 5678"
                  maxLength={15}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleUpdateDancer}
                disabled={isEditingDancer}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isEditingDancer ? 'Updating...' : 'Update Dancer'}
              </button>
              <button
                onClick={() => {
                  setShowEditDancerModal(false);
                  setEditingDancer(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditEntryModal && editingEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Edit Competition Entry</h3>
            
            {/* Error Message Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Item Name *</label>
                <input
                  type="text"
                  value={editEntryData.itemName}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Prevent empty strings with just spaces and enforce minimum length
                    if (value && value.trim().length > 0 && value.trim().length < 3) {
                      setError('Item name must be at least 3 characters long');
                    } else if (value && value.trim().length === 0) {
                      setError('Item name cannot be empty or contain only spaces');
                    } else {
                      setError('');
                    }
                    setEditEntryData({...editEntryData, itemName: value});
                  }}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Choreographer *</label>
                <input
                  type="text"
                  value={editEntryData.choreographer}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                    setEditEntryData({...editEntryData, choreographer: cleanValue});
                  }}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Mastery Level *</label>
                <select
                  value={editEntryData.mastery}
                  onChange={(e) => setEditEntryData({...editEntryData, mastery: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select mastery level</option>
                  {MASTERY_LEVELS.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">Item Style *</label>
                <select
                  value={editEntryData.itemStyle}
                  onChange={(e) => setEditEntryData({...editEntryData, itemStyle: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select item style</option>
                  {ITEM_STYLES.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1">
                  Estimated Duration (minutes) *
                  <span className="text-xs text-gray-400 block mt-1">Minimum: 30 seconds (0.5 minutes)</span>
                </label>
                <input
                  type="number"
                  value={editEntryData.estimatedDuration}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    // Prevent negative numbers and enforce realistic ranges
                                         if (isNaN(value) || value < 0) {
                       setError('Duration must be a positive number');
                       return;
                     }
                     if (value < 0.5) {
                       setError('Duration must be at least 30 seconds (0.5 minutes)');
                       return;
                     }
                     if (value > 3.5) {
                       setError('Duration cannot exceed 3.5 minutes (maximum for any performance type)');
                       return;
                     }
                    setError('');
                    setEditEntryData({...editEntryData, estimatedDuration: value});
                  }}
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-600 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                  title="Minimum 30 seconds (0.5 minutes), maximum 3.5 minutes"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                                        onClick={handleSaveEntryEdit}
                disabled={isEditingEntry}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isEditingEntry ? 'Updating...' : 'Update Entry'}
              </button>
              <button
                onClick={() => {
                  setShowEditEntryModal(false);
                  setEditingEntry(null);
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 