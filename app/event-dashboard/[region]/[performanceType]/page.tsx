'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AGE_CATEGORIES, MASTERY_LEVELS, ITEM_STYLES, TIME_LIMITS, calculateEODSAFee } from '@/lib/types';
import { useAlert } from '@/components/ui/custom-alert';
import { MultiSelectDancers } from '@/components/ui/multi-select-dancers';

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

interface Contestant {
  id: string;
  eodsaId: string;
  name: string;
  email: string;
  phone: string;
  type: 'studio' | 'private';
  studioName?: string;
  dancers: {
    id: string;
    name: string;
    age: number;
    style: string;
    nationalId: string;
  }[];
}

interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
}

interface EventEntryForm {
  eventId: string;
  participantIds: string[];
  ageCategory: string;
  paymentMethod: 'credit_card' | 'bank_transfer';
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: string;
}

export default function PerformanceTypeEntryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  
  const region = params?.region as string;
  const performanceType = params?.performanceType as string;
  const eodsaId = searchParams?.get('eodsaId') || '';
  const studioId = searchParams?.get('studioId') || '';
  const autoAssigned = searchParams?.get('autoAssigned') === 'true';
  const preSelectedEventId = searchParams?.get('eventId') || '';
  
  // Check if this performance type allows empty participant start
  const allowEmptyStart = ['duet', 'trio', 'group'].includes(performanceType?.toLowerCase());
  
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
  const [availableDancers, setAvailableDancers] = useState<any[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showParticipantSearch, setShowParticipantSearch] = useState(false);
  const [selectedDancersForMultiSelect, setSelectedDancersForMultiSelect] = useState<any[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventEntryForm>({
    eventId: '',
    participantIds: [],
    ageCategory: '',
    paymentMethod: 'credit_card',
    itemName: '',
    choreographer: '',
    mastery: '',
    itemStyle: '',
    estimatedDuration: ''
  });
  const [calculatedFee, setCalculatedFee] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1); // 1: Event Selection, 2: Details, 3: Payment, 4: Review
  const { showAlert } = useAlert();

  useEffect(() => {
    if (eodsaId) {
      setIsStudioMode(false);
      loadContestant(eodsaId);
    } else if (studioId) {
      setIsStudioMode(true);
      loadStudioData(studioId);
    } else if (allowEmptyStart) {
      // For group/duet/trio entries, we can start without an EODSA ID
      setContestant({
        id: 'temp-group-entry',
        eodsaId: '',
        name: 'Group Entry',
        email: '',
        phone: '',
        type: 'private',
        dancers: [] // Start with empty participants
      });
      setShowParticipantSearch(true);
    }
    loadMatchingEvents();
  }, [region, performanceType, eodsaId, studioId, allowEmptyStart]);

  useEffect(() => {
    if (formData.eventId) {
      const selectedEvent = events.find(e => e.id === formData.eventId);
      if (selectedEvent) {
        setSelectedEvent(selectedEvent);
        setCalculatedFee(selectedEvent.entryFee);
        setFormData(prev => ({
          ...prev,
          ageCategory: selectedEvent.ageCategory
        }));
      }
    }
  }, [formData.eventId, events]);

  // Handle pre-selected event from regional page
  useEffect(() => {
    if (preSelectedEventId && events.length > 0 && !formData.eventId) {
      const preSelected = events.find(e => e.id === preSelectedEventId);
      if (preSelected) {
        setFormData(prev => ({
          ...prev,
          eventId: preSelectedEventId
        }));
        setStep(2); // Skip event selection step
      }
    }
  }, [preSelectedEventId, events, formData.eventId]);

  useEffect(() => {
    if (formData.eventId && formData.mastery && formData.participantIds.length > 0) {
      // Use EODSA fee calculation with proper options
      const feeBreakdown = calculateEODSAFee(
        formData.mastery,
        getCapitalizedPerformanceType(performanceType),
        formData.participantIds.length,
        {
          soloCount: 1, // Default to 1 solo per entry (can be enhanced later for multiple solos)
          includeRegistration: true
        }
      );
      setCalculatedFee(feeBreakdown.totalFee);
    }
  }, [formData.eventId, formData.mastery, formData.participantIds.length, performanceType]);

  // Sync multi-select state with form data
  useEffect(() => {
    if (contestant && formData.participantIds.length > 0) {
      const selectedDancers = formData.participantIds.map(id => {
        const dancer = contestant.dancers.find(d => d.id === id);
        if (dancer) {
          return {
            id: dancer.id,
            name: dancer.name,
            age: dancer.age,
            eodsaId: contestant.eodsaId || '',
            studioName: dancer.style || (isStudioMode ? studioInfo?.name : 'Private'),
            nationalId: dancer.nationalId
          };
        }
        return null;
      }).filter(Boolean);
      
      setSelectedDancersForMultiSelect(selectedDancers);
    }
  }, [contestant, formData.participantIds, isStudioMode, studioInfo]);

  const loadContestant = async (id: string) => {
    try {
      // Try unified system first (new dancers)
      const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        if (unifiedData.success && unifiedData.dancer) {
          const dancer = unifiedData.dancer;
          // Transform single dancer to contestant format
          // Correctly label based on studio association
          const isStudioLinked = dancer.studioAssociation !== null;
          const transformedContestant = {
            id: dancer.id,
            eodsaId: dancer.eodsaId,
            name: dancer.name,
            email: dancer.email || '',
            phone: dancer.phone || '',
            type: isStudioLinked ? ('studio' as const) : ('private' as const),
            studioName: dancer.studioAssociation?.studioName,
            dancers: [{
              id: dancer.id,
              name: dancer.name,
              age: dancer.age,
              style: '',
              nationalId: dancer.nationalId
            }]
          };
          setContestant(transformedContestant);
          
          // Auto-select participants for private users
          if (transformedContestant.type === 'private' && transformedContestant.dancers.length > 0) {
            const performanceTypeLower = performanceType?.toLowerCase();
            if (performanceTypeLower === 'solo') {
              setFormData(prev => ({
                ...prev,
                participantIds: [transformedContestant.dancers[0].id]
              }));
            }
          }
          return;
        }
      }
      
      // Fallback to legacy system (contestants)
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        setContestant(legacyData);
        
        // Auto-select participants for private users
        if (legacyData.type === 'private' && legacyData.dancers.length > 0) {
          const performanceTypeLower = performanceType?.toLowerCase();
          if (performanceTypeLower === 'solo') {
            setFormData(prev => ({
              ...prev,
              participantIds: [legacyData.dancers[0].id]
            }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load contestant data:', error);
    }
  };

  const loadStudioData = async (id: string) => {
    try {
      // Verify studio session
      const studioSession = localStorage.getItem('studioSession');
      if (!studioSession) {
        router.push('/studio-login');
        return;
      }

      const parsedSession = JSON.parse(studioSession);
      
      // Verify the studio ID matches the session
      if (parsedSession.id !== id) {
        router.push('/studio-login');
        return;
      }

      // Load studio's dancers
      const response = await fetch(`/api/studios/dancers-new?studioId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setStudioInfo(parsedSession);
        setAvailableDancers(data.dancers);
        
        // Create a pseudo-contestant for studios to enable form functionality
        setContestant({
          id: `studio-${id}`,
          eodsaId: '',
          name: parsedSession.name,
          email: parsedSession.email,
          phone: '',
          type: 'studio',
          studioName: parsedSession.name,
          dancers: data.dancers.map((dancer: any) => ({
            id: dancer.id,
            name: dancer.name,
            age: dancer.age,
            style: 'Studio Dancer',
            nationalId: dancer.nationalId
          }))
        });

        // Enable participant search for studios (they can select from their dancers)
        setShowParticipantSearch(true);
      }
    } catch (error) {
      console.error('Failed to load studio data:', error);
    }
  };

  const loadMatchingEvents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const matchingEvents = data.events.filter((event: Event) => 
            event.region.toLowerCase() === region?.toLowerCase() &&
            event.performanceType.toLowerCase() === performanceType?.toLowerCase() &&
            (event.status === 'registration_open' || event.status === 'upcoming')
          );
          setEvents(matchingEvents);
          
          // Auto-select if only one event (enhanced logic) - but only if no event was pre-selected
          if (matchingEvents.length === 1 && !preSelectedEventId) {
            setFormData(prev => ({
              ...prev,
              eventId: matchingEvents[0].id
            }));
            
            // Skip Step 1 entirely when there's only one event - go directly to Step 2
            setStep(2);
          } else if (matchingEvents.length === 0) {
            // No events available
            showAlert(
              `No ${performanceType} events are currently available in ${region}. Please check other regions or performance types.`,
              'warning'
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleParticipantToggle = (dancerId: string) => {
    setFormData(prev => {
      const isSelected = prev.participantIds.includes(dancerId);
      let newParticipantIds;
      
      const limits = getParticipantLimits();
      
      if (isSelected) {
        newParticipantIds = prev.participantIds.filter(id => id !== dancerId);
      } else {
        if (prev.participantIds.length < limits.max) {
          newParticipantIds = [...prev.participantIds, dancerId];
        } else {
          showAlert(`Maximum ${limits.max} participants allowed for ${performanceType}`, 'warning');
          return prev;
        }
      }
      
      return {
        ...prev,
        participantIds: newParticipantIds
      };
    });
  };

  // Search for participants
  const searchParticipants = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/dancers/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.dancers);
      } else {
        setSearchResults([]);
        showAlert('Search failed. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      showAlert('Search failed. Please try again.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Search function for multi-select component
  const searchDancersForMultiSelect = async (query: string): Promise<any[]> => {
    if (!query || query.length < 2) {
      return [];
    }
    
    try {
      // For studio mode, search only within the studio's dancers
      if (isStudioMode && availableDancers.length > 0) {
        const filtered = availableDancers.filter(dancer => 
          dancer.name.toLowerCase().includes(query.toLowerCase()) ||
          dancer.nationalId?.toLowerCase().includes(query.toLowerCase())
        );
        
        return filtered.map((dancer: any) => ({
          id: dancer.id,
          name: dancer.name,
          age: dancer.age,
          eodsaId: dancer.eodsaId || '',
          studioName: studioInfo?.name || 'Studio Dancer',
          nationalId: dancer.nationalId
        }));
      }
      
      // For individual mode, search all dancers
      const response = await fetch(`/api/dancers/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.success) {
        return data.dancers.map((dancer: any) => ({
          id: dancer.id,
          name: dancer.name,
          age: dancer.age,
          eodsaId: dancer.eodsaId,
          studioName: dancer.studioName || 'Private',
          nationalId: dancer.nationalId
        }));
      }
      return [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  };

  // Add participant from search results
  const addParticipantFromSearch = (dancer: any) => {
    // Add the dancer to the contestant's dancers list if not already there
    setContestant(prev => {
      if (!prev) return prev;
      
      const existingDancer = prev.dancers.find(d => d.id === dancer.id);
      if (existingDancer) {
        showAlert('This dancer is already in the participant list', 'warning');
        return prev;
      }
      
      return {
        ...prev,
        dancers: [...prev.dancers, {
          id: dancer.id,
          name: dancer.name,
          age: dancer.age,
          style: dancer.studioName || 'Private',
          nationalId: dancer.nationalId
        }]
      };
    });

    // Auto-select the dancer
    handleParticipantToggle(dancer.id);
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    
    showAlert(`Added ${dancer.name} to participants`, 'success');
  };

  // Handle dancer selection change from multi-select component
  const handleDancerSelectionChange = (dancers: any[]) => {
    console.log('🎭 Dancer selection changed:', dancers);
    setSelectedDancersForMultiSelect(dancers);
    
    // Update form participant IDs
    setFormData(prev => ({
      ...prev,
      participantIds: dancers.map(d => d.id)
    }));

    // Update contestant dancers list - replace, don't merge
    setContestant(prev => {
      if (!prev) return prev;
      
      // Keep existing dancers not in selection, plus add selected dancers
      const selectedIds = dancers.map(d => d.id);
      const keepExisting = prev.dancers.filter(d => !selectedIds.includes(d.id));
      
      const newDancers = dancers.map(newDancer => ({
        id: newDancer.id,
        name: newDancer.name,
        age: newDancer.age,
        style: newDancer.studioName || 'Private',
        nationalId: newDancer.nationalId
      }));
      
      return {
        ...prev,
        dancers: [...keepExisting, ...newDancers]
      };
    });
  };

  const getParticipantLimits = () => {
    const performanceTypeLower = performanceType?.toLowerCase();
    switch (performanceTypeLower) {
      case 'solo': return { min: 1, max: 1 };
      case 'duet': return { min: 2, max: 2 };
      case 'trio': return { min: 3, max: 3 };
      case 'group': return { min: 4, max: 30 };
      default: return { min: 1, max: 1 };
    }
  };

  // Helper function to convert MM:SS to decimal minutes
  const convertDurationToMinutes = (duration: string): number => {
    if (!duration) return 0;
    
    // Handle MM:SS format
    if (duration.includes(':')) {
      const [minutes, seconds] = duration.split(':');
      const min = parseInt(minutes) || 0;
      const sec = parseInt(seconds) || 0;
      return min + (sec / 60);
    }
    
    // Handle decimal minutes (for backward compatibility)
    return parseFloat(duration) || 0;
  };

  // Helper function to capitalize performance type for fee calculation
  const getCapitalizedPerformanceType = (performanceType: string): 'Solo' | 'Duet' | 'Trio' | 'Group' => {
    const capitalized = performanceType.charAt(0).toUpperCase() + performanceType.slice(1).toLowerCase();
    return capitalized as 'Solo' | 'Duet' | 'Trio' | 'Group';
  };

  // Helper function to convert decimal minutes to MM:SS format
  const convertMinutesToDuration = (minutes: number): string => {
    const min = Math.floor(minutes);
    const sec = Math.round((minutes - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper function to get time limit for current performance type
  const getTimeLimit = () => {
    const capitalizedType = performanceType?.charAt(0).toUpperCase() + performanceType?.slice(1).toLowerCase();
    return TIME_LIMITS[capitalizedType as keyof typeof TIME_LIMITS] || 0;
  };

  const validateDuration = (duration: string): boolean => {
    if (!duration) return true; // Optional field
    const durationMinutes = convertDurationToMinutes(duration);
    const maxDuration = getTimeLimit();
    return maxDuration > 0 ? durationMinutes <= maxDuration : true;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const limits = getParticipantLimits();
      
      if (formData.participantIds.length < limits.min) {
        showAlert(`${performanceType} requires at least ${limits.min} participant(s)`, 'warning');
        setIsSubmitting(false);
        return;
      }

      if (!validateDuration(formData.estimatedDuration)) {
        const maxTime = getTimeLimit();
        const maxTimeDisplay = maxTime === 3.5 ? '3:30' : `${maxTime}:00`;
        showAlert(`${performanceType} performances must be ${maxTimeDisplay} minutes or less`, 'warning');
        setIsSubmitting(false);
        return;
      }

      // Calculate EODSA fee correctly
      const feeBreakdown = calculateEODSAFee(
        formData.mastery,
        getCapitalizedPerformanceType(performanceType),
        formData.participantIds.length,
        {
          soloCount: 1,
          includeRegistration: true
        }
      );

      // For group entries without initial EODSA ID, use the first participant's EODSA ID
      let finalEodsaId = eodsaId;
      let finalContestantId = contestant!.id;
      
      if (!finalEodsaId && formData.participantIds.length > 0 && contestant?.dancers && contestant.dancers.length > 0) {
        // Use the first participant's information
        const firstParticipant = contestant.dancers.find(d => d.id === formData.participantIds[0]);
        if (firstParticipant) {
          // Try to get EODSA ID from the dancer data
          try {
            const response = await fetch(`/api/dancers/by-eodsa-id/${firstParticipant.id}`);
            if (response.ok) {
              const dancerData = await response.json();
              if (dancerData.success && dancerData.dancer) {
                finalEodsaId = dancerData.dancer.eodsaId;
                finalContestantId = dancerData.dancer.id;
              }
            }
          } catch (error) {
            console.warn('Could not fetch dancer EODSA ID:', error);
          }
          
          // Fallback: generate a temporary EODSA ID based on first participant
          if (!finalEodsaId) {
            finalEodsaId = `GROUP-${Date.now()}`;
          }
        }
      }

      const eventEntryData = {
        eventId: formData.eventId,
        contestantId: finalContestantId,
        eodsaId: finalEodsaId,
        participantIds: formData.participantIds,
        calculatedFee: feeBreakdown.totalFee,
        paymentStatus: 'pending',
        paymentMethod: 'invoice', // Phase 1: Invoice-based payment
        approved: false,
        itemName: formData.itemName,
        choreographer: formData.choreographer,
        mastery: formData.mastery,
        itemStyle: formData.itemStyle,
        estimatedDuration: convertDurationToMinutes(formData.estimatedDuration)
      };

      const response = await fetch('/api/event-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventEntryData),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const error = await response.json();
        showAlert(`Entry failed: ${error.error}`, 'error');
      }
    } catch (error) {
      console.error('Entry error:', error);
      showAlert('Entry failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !formData.eventId) {
      showAlert('Please select an event first', 'warning');
      return;
    }
    
    // NEW: Check if selected event is still accepting registrations
    if (step === 1 && formData.eventId) {
      const selectedEvent = events.find(e => e.id === formData.eventId);
      if (selectedEvent) {
        const now = new Date();
        const registrationDeadline = new Date(selectedEvent.registrationDeadline);
        const eventDate = new Date(selectedEvent.eventDate);
        
        if (now > eventDate) {
          showAlert('❌ This event has already completed. Please select a different event.', 'error');
          return;
        }
        
        if (now > registrationDeadline) {
          showAlert('❌ Registration deadline has passed for this event. Please select a different event.', 'error');
          return;
        }
      }
    }
    
    if (step === 2 && formData.participantIds.length === 0) {
      showAlert('Please select participants', 'warning');
      return;
    }
    if (step === 2 && formData.participantIds.length < getParticipantLimits().min) {
      const limits = getParticipantLimits();
      showAlert(`${performanceType} requires at least ${limits.min} participant(s)`, 'warning');
      return;
    }
    if (step === 2 && !formData.itemName) {
      showAlert('Please fill in all performance details', 'warning');
      return;
    }
    if (step === 2 && formData.estimatedDuration && !validateDuration(formData.estimatedDuration)) {
      const maxTime = getTimeLimit();
      const maxTimeDisplay = maxTime === 3.5 ? '3:30' : `${maxTime}:00`;
      showAlert(`⏰ Duration too long! ${performanceType} performances must be ${maxTimeDisplay} or less. Current: ${formData.estimatedDuration}.`, 'warning');
      return;
    }
    setStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    // If we're at step 2 and there's only one event (meaning we skipped step 1), 
    // go back to the region selection page
    if (step === 2 && events.length === 1) {
      router.push(`/event-dashboard/${region}?eodsaId=${eodsaId}`);
      return;
    }
    setStep(prev => Math.max(prev - 1, 1));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-4">Entry Submitted!</h2>
          <p className="text-gray-300 mb-6">
            Your {performanceType} entry for {region} has been submitted successfully.
          </p>
          
          {/* Fee Summary in Success */}
          {formData.mastery && formData.participantIds.length > 0 && (() => {
            const feeBreakdown = calculateEODSAFee(
              formData.mastery,
              getCapitalizedPerformanceType(performanceType),
              formData.participantIds.length,
              {
                soloCount: 1,
                includeRegistration: true
              }
            );
            
            console.log('💰 Success Page Fee Result:', feeBreakdown);
            
            return (
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500/40 rounded-2xl p-6 mb-6">
                <p className="text-lg font-bold text-green-300 mb-4">📧 Expect an Email Invoice for:</p>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-green-200">
                    <span>Registration Fee ({formData.participantIds.length} dancer{formData.participantIds.length > 1 ? 's' : ''})</span>
                    <span>R{feeBreakdown.registrationFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-200">
                    <span>Performance Fee ({feeBreakdown.breakdown})</span>
                    <span>R{feeBreakdown.performanceFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-green-400/30 pt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-green-100">Total Amount:</span>
                      <span className="text-2xl font-bold text-green-100">R{feeBreakdown.totalFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-green-400">Gabriel's team will send payment instructions via email</p>
              </div>
            );
          })()}
          
          <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-blue-300 mb-2">Payment Instructions</p>
            <p className="text-blue-200 text-sm">Check your email for Yoco card payment link or EFT details</p>
          </div>
          <div className="space-y-3">
            <Link 
              href={`/event-dashboard?eodsaId=${eodsaId}`}
              className="block w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
            >
              Enter Another Event
            </Link>
            <Link 
              href="/"
              className="block w-full px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:border-gray-500 transition-all duration-300 font-semibold"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!region || !performanceType || (!eodsaId && !allowEmptyStart)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Required parameters not provided.</p>
          <Link 
            href="/"
            className="block w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link 
            href={`/event-dashboard/${region}?eodsaId=${eodsaId}`} 
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {region} Events
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            {performanceType?.charAt(0).toUpperCase() + performanceType?.slice(1)} Entry
          </h1>
          <p className="text-xl text-gray-300">{region} Region - Step {step} of 4</p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-700/20 p-6">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    stepNum <= step 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white' 
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {stepNum}
                  </div>
                  {stepNum < 4 && (
                    <div className={`w-16 h-1 mx-2 ${
                      stepNum < step ? 'bg-gradient-to-r from-purple-500 to-pink-600' : 'bg-gray-600'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-300">
              <span>Event</span>
              <span>Details</span>
              <span>Fees</span>
              <span>Submit</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8">
            
            {/* Step 1: Event Selection */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Select Event</h2>
                
                {/* Auto-Assignment Notification */}
                {autoAssigned && events.length === 1 && formData.eventId && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500/40 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg">🎯</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-300">Smart Selection Applied!</h3>
                        <p className="text-green-200 text-sm">
                          We automatically selected this event since it's the only {performanceType} event in {region}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading events...</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">😔</div>
                    <h3 className="text-xl font-bold text-white mb-2">No Events Available</h3>
                    <p className="text-gray-300">No {performanceType} events are currently available in {region}.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setFormData(prev => ({ ...prev, eventId: event.id }))}
                        className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 relative ${
                          formData.eventId === event.id
                            ? 'border-purple-400 bg-purple-900/30'
                            : 'border-gray-600 hover:border-purple-400 bg-gray-700/50'
                        }`}
                      >
                        {/* Registration Status Indicator */}
                        {(() => {
                          const now = new Date();
                          const registrationDeadline = new Date(event.registrationDeadline);
                          const eventDate = new Date(event.eventDate);
                          let statusInfo = { text: '', color: '', icon: '' };
                          
                          if (now > eventDate) {
                            statusInfo = { text: 'Event Completed', color: 'bg-gray-500', icon: '✅' };
                          } else if (now > registrationDeadline) {
                            statusInfo = { text: 'Registration Closed', color: 'bg-red-500', icon: '🚫' };
                          } else if (event.status === 'registration_open') {
                            statusInfo = { text: 'Registration Open', color: 'bg-green-500', icon: '🟢' };
                          } else {
                            statusInfo = { text: 'Upcoming', color: 'bg-blue-500', icon: '⏰' };
                          }
                          
                          return (
                            <div className="absolute top-4 right-4">
                              <div className={`${statusInfo.color} text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1`}>
                                <span>{statusInfo.icon}</span>
                                <span>{statusInfo.text}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Auto-selected indicator */}
                        {autoAssigned && formData.eventId === event.id && events.length === 1 && (
                          <div className="absolute top-14 right-4">
                            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                              <span>🚀</span>
                              <span>Auto-Selected</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-4">
                            <h3 className="text-lg font-bold text-white mb-2">{event.name}</h3>
                            <p className="text-gray-300 mb-2">{event.description}</p>
                            <div className="text-sm text-gray-400 space-y-1">
                              <p>📅 {new Date(event.eventDate).toLocaleDateString()}</p>
                              <p>📍 {event.venue}</p>
                              <p>🎯 Age Category: {event.ageCategory}</p>
                              <p>⏰ Registration Deadline: {new Date(event.registrationDeadline).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-purple-400">R{event.entryFee.toFixed(2)}</p>
                            <p className="text-sm text-gray-400">Entry Fee</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Performance Details */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Performance Details</h2>
                

                
                {/* Participant Selection - Enhanced Multi-Select */}
                {contestant && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Select Participants</h3>
                    
                    <MultiSelectDancers
                      selectedDancers={selectedDancersForMultiSelect}
                      onSelectionChange={handleDancerSelectionChange}
                      onSearch={searchDancersForMultiSelect}
                      placeholder={`Search and select dancers for your ${performanceType.toLowerCase()}...`}
                      maxSelections={getParticipantLimits().max}
                      minSelections={getParticipantLimits().min}
                      className="mb-4"
                    />
                  </div>
                )}

                {/* Performance Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Item Name *</label>
                    <input
                      type="text"
                      name="itemName"
                      value={formData.itemName}
                      onChange={handleInputChange}
                      placeholder="Name of your performance piece"
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Choreographer *</label>
                    <input
                      type="text"
                      name="choreographer"
                      value={formData.choreographer}
                      onChange={handleInputChange}
                      placeholder="Name of the choreographer"
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder-gray-400"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Mastery Level *</label>
                      <select
                        name="mastery"
                        value={formData.mastery}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                        required
                      >
                        <option value="">Select mastery level</option>
                        {MASTERY_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Item Style *</label>
                      <select
                        name="itemStyle"
                        value={formData.itemStyle}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                        required
                      >
                        <option value="">Select item style</option>
                        {ITEM_STYLES.map((style) => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Estimated Duration (Optional) - MM:SS format
                    </label>
                    
                    {/* Time Limit Information */}
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-yellow-300 font-semibold">EODSA Max Time Limits</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-yellow-900/30 p-2 rounded">
                          <div className="text-yellow-200 font-medium">Solos</div>
                          <div className="text-yellow-100 text-lg">2:00 mins</div>
                        </div>
                        <div className="bg-yellow-900/30 p-2 rounded">
                          <div className="text-yellow-200 font-medium">Duos/Trios</div>
                          <div className="text-yellow-100 text-lg">3:00 mins</div>
                        </div>
                        <div className="bg-yellow-900/30 p-2 rounded">
                          <div className="text-yellow-200 font-medium">Groups</div>
                          <div className="text-yellow-100 text-lg">3:30 mins</div>
                        </div>
                      </div>
                                             <div className="mt-3 p-2 bg-yellow-900/40 rounded text-center">
                         <span className="text-yellow-100 font-bold">
                           Your {performanceType} limit: {getTimeLimit() === 3.5 ? '3:30' : `${getTimeLimit()}:00`} minutes
                         </span>
                       </div>
                    </div>

                    <input
                      type="text"
                      name="estimatedDuration"
                      value={formData.estimatedDuration}
                      onChange={handleInputChange}
                      placeholder={`e.g., 2:30 (Max: ${getTimeLimit() === 3.5 ? '3:30' : `${getTimeLimit()}:00`})`}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 text-white placeholder-gray-400 transition-all ${
                        validateDuration(formData.estimatedDuration) 
                          ? 'border-gray-600 bg-gray-700 focus:ring-purple-500 focus:border-purple-500' 
                          : 'border-red-500 bg-red-900/30 focus:ring-red-500 focus:border-red-500'
                      }`}
                      pattern="[0-9]{1,2}:[0-5][0-9]"
                      title="Enter duration in MM:SS format (e.g., 2:30)"
                    />
                    
                    {/* Validation Messages */}
                    {!validateDuration(formData.estimatedDuration) && convertDurationToMinutes(formData.estimatedDuration) > 0 && (
                      <div className="mt-3 p-3 bg-red-900/30 border border-red-500/40 rounded-lg">
                        <p className="text-red-300 text-sm font-medium flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Duration too long!
                        </p>
                                                 <p className="text-red-200 text-sm mt-1">
                           <strong>{performanceType} performances</strong> cannot exceed <strong>{getTimeLimit() === 3.5 ? '3:30' : `${getTimeLimit()}:00`} minutes</strong>.
                           <br />Your current duration: <strong>{formData.estimatedDuration}</strong>
                         </p>
                      </div>
                    )}
                    
                    {validateDuration(formData.estimatedDuration) && convertDurationToMinutes(formData.estimatedDuration) > 0 && (
                      <p className="text-green-400 text-sm mt-2 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                                                 Perfect! Duration is within the {getTimeLimit() === 3.5 ? '3:30' : `${getTimeLimit()}:00`} minute limit
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Fee Preview */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Fee Preview</h2>
                
                <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-2 border-purple-500/30 rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-purple-300 mb-4">💰 EODSA Fee Breakdown</h3>
                  {formData.mastery && formData.participantIds.length > 0 ? (() => {
                    console.log('💰 Fee Calculation Debug:', {
                      mastery: formData.mastery,
                      performanceType,
                      performanceTypeCapitalized: getCapitalizedPerformanceType(performanceType),
                      participantCount: formData.participantIds.length,
                      options: { soloCount: 1, includeRegistration: true }
                    });
                    
                    const feeBreakdown = calculateEODSAFee(
                      formData.mastery,
                      getCapitalizedPerformanceType(performanceType),
                      formData.participantIds.length,
                      {
                        soloCount: 1,
                        includeRegistration: true
                      }
                    );
                    
                    console.log('💰 Fee Result:', feeBreakdown);
                    
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-purple-200 text-lg">
                          <span>Registration Fee ({formData.participantIds.length} participant{formData.participantIds.length > 1 ? 's' : ''})</span>
                          <span className="font-semibold">R{feeBreakdown.registrationFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-purple-200 text-lg">
                          <span>Performance Fee ({feeBreakdown.breakdown})</span>
                          <span className="font-semibold">R{feeBreakdown.performanceFee.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-purple-400/30 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-2xl font-bold text-purple-100">Total Amount Due:</span>
                            <span className="text-3xl font-bold text-green-300">R{feeBreakdown.totalFee.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="bg-purple-900/30 rounded-lg p-3 mt-4">
                          <div className="text-sm text-purple-300">
                            <p><strong>Mastery Level:</strong> {formData.mastery}</p>
                            <p><strong>Performance Type:</strong> {performanceType}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                      <div className="flex items-center text-yellow-300">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Fee calculation requires:</span>
                      </div>
                      <ul className="mt-2 ml-7 text-yellow-200 text-sm space-y-1">
                        {!formData.mastery && <li>• Select a Mastery Level</li>}
                        {formData.participantIds.length === 0 && <li>• Select at least one participant</li>}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Payment Information
                  </h3>
                  <div className="text-blue-200 space-y-2">
                    <p>Once your entry is submitted, you'll receive an invoice by email with:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>A secure Yoco link for card payments</li>
                      <li>Bank details for EFT (electronic funds transfer)</li>
                    </ul>
                    <p className="text-sm text-blue-300 mt-3 bg-blue-900/30 p-3 rounded-lg">
                      No payment is required at submission. Please complete your payment once you receive the invoice.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Submit */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Review & Submit</h2>
                
                <div className="space-y-6">
                  {/* Event Summary */}
                  <div className="bg-gray-700/50 rounded-xl p-6">
                    <h3 className="font-semibold text-white mb-3">Event Details</h3>
                    {(() => {
                      const selectedEvent = events.find(e => e.id === formData.eventId);
                      return selectedEvent ? (
                        <div className="text-sm text-gray-300 space-y-1">
                          <p><strong>Event:</strong> {selectedEvent.name}</p>
                          <p><strong>Region:</strong> {selectedEvent.region}</p>
                          <p><strong>Performance Type:</strong> {selectedEvent.performanceType}</p>
                          <p><strong>Date:</strong> {new Date(selectedEvent.eventDate).toLocaleDateString()}</p>
                          <p><strong>Venue:</strong> {selectedEvent.venue}</p>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Performance Summary */}
                  <div className="bg-gray-700/50 rounded-xl p-6">
                    <h3 className="font-semibold text-white mb-3">Performance Details</h3>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p><strong>Item Name:</strong> {formData.itemName}</p>
                      <p><strong>Choreographer:</strong> {formData.choreographer}</p>
                      <p><strong>Mastery Level:</strong> {formData.mastery}</p>
                      <p><strong>Item Style:</strong> {formData.itemStyle}</p>
                      <p><strong>Duration:</strong> {formData.estimatedDuration} minutes</p>
                      <p><strong>Participants:</strong> {formData.participantIds.length}</p>
                    </div>
                  </div>

                  {/* Fee Summary */}
                  <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-2 border-purple-500/30 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-purple-300 mb-4">💰 Fee Summary</h3>
                    {formData.mastery && formData.participantIds.length > 0 ? (() => {
                      console.log('💰 Fee Calculation Debug:', {
                        mastery: formData.mastery,
                        performanceType,
                        performanceTypeCapitalized: getCapitalizedPerformanceType(performanceType),
                        participantCount: formData.participantIds.length,
                        options: { soloCount: 1, includeRegistration: true }
                      });
                      
                      const feeBreakdown = calculateEODSAFee(
                        formData.mastery,
                        getCapitalizedPerformanceType(performanceType),
                        formData.participantIds.length,
                        {
                          soloCount: 1,
                          includeRegistration: true
                        }
                      );
                      
                      console.log('💰 Final Fee Result:', feeBreakdown);
                      
                      return (
                        <div className="space-y-3">
                          <div className="flex justify-between text-purple-200 text-lg">
                            <span>Registration Fee ({formData.participantIds.length} participant{formData.participantIds.length > 1 ? 's' : ''})</span>
                            <span className="font-semibold">R{feeBreakdown.registrationFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-purple-200 text-lg">
                            <span>Performance Fee ({feeBreakdown.breakdown})</span>
                            <span className="font-semibold">R{feeBreakdown.performanceFee.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-purple-400/30 pt-3 mt-4">
                            <div className="flex justify-between items-center">
                              <span className="text-2xl font-bold text-purple-100">Total Amount Due:</span>
                              <span className="text-3xl font-bold text-green-300">R{feeBreakdown.totalFee.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center text-red-300">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Cannot calculate fee - missing data:</span>
                        </div>
                        <ul className="mt-2 ml-7 text-red-200 text-sm space-y-1">
                          {!formData.mastery && <li>• Mastery Level not selected</li>}
                          {formData.participantIds.length === 0 && <li>• No participants selected</li>}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Payment Information (Phase 1) */}
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 003 3z" />
                      </svg>
                      How to Pay
                    </h3>
                    <div className="text-blue-200 space-y-3">
                      <p>Once your entry is submitted, you'll receive an invoice by email with:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>A secure Yoco link for card payments</li>
                        <li>Bank details for EFT (electronic funds transfer)</li>
                      </ul>
                      <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-3 mt-4">
                        <p className="text-sm text-blue-300">
                          No payment is required at submission. Please complete your payment once you receive the invoice.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={step === 1 && events.length > 1} // Only disable if we're at step 1 with multiple events
                className="px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-xl hover:bg-gray-700 hover:border-gray-500 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 2 && events.length === 1 ? 'Back to Region' : 'Previous'}
              </button>
              
              {step < 4 ? (
                <button
                  onClick={nextStep}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      Submitting Entries...
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit Entries
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 