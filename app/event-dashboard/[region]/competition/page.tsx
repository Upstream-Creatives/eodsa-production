'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, MASTERY_LEVELS, ITEM_STYLES } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';
import { useToast } from '@/components/ui/simple-toast';

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

interface PerformanceEntry {
  id: string;
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group';
  itemName: string;
  choreographer: string;
  mastery: string;
  itemStyle: string;
  estimatedDuration: string;
  participantIds: string[];
  participants: any[];
  ageCategory: string;
  fee: number;
}

export default function CompetitionEntryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { success, error } = useToast();
  const region = decodeURIComponent(params?.region as string || '');
  const eodsaId = searchParams?.get('eodsaId') || '';
  const studioId = searchParams?.get('studioId') || '';
  const eventId = searchParams?.get('eventId') || '';
  
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
  const [availableDancers, setAvailableDancers] = useState<any[]>([]);
  const [isStudioMode, setIsStudioMode] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [currentForm, setCurrentForm] = useState({
    itemName: '',
    choreographer: '',
    mastery: 'Water (Competitive)',
    itemStyle: '',
    estimatedDuration: '',
    participantIds: [] as string[],
    ageCategory: 'All'
  });
  const [savedForms, setSavedForms] = useState<Record<string, typeof currentForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{entries: number, totalFee: number} | null>(null);

  useEffect(() => {
    if (region && eventId) {
      if (eodsaId) {
        setIsStudioMode(false);
        loadContestant(eodsaId);
      } else if (studioId) {
        setIsStudioMode(true);
        loadStudioData(studioId);
      }
      loadEvent(eventId);
    }
  }, [region, eodsaId, studioId, eventId]);

  const loadContestant = async (id: string) => {
    try {
      // Try unified system first (new dancers)
      const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        if (unifiedData.success && unifiedData.dancer) {
          const dancer = unifiedData.dancer;
          const isStudioLinked = dancer.studioAssociation !== null;
          setContestant({
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
          });
          // For solo dancers, add them to availableDancers so they can select themselves
          setAvailableDancers([{
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.eodsaId,
            age: dancer.age,
            nationalId: dancer.nationalId
          }]);
          
          // Auto-select the dancer as participant for independent dancers
          setCurrentForm(prev => ({
            ...prev,
            participantIds: [dancer.id]
          }));
          return;
        }
      }
      
      // Fallback to legacy system (contestants)
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        setContestant(legacyData);
        // For legacy contestants, also add them to availableDancers
        if (legacyData.dancers && legacyData.dancers.length > 0) {
          setAvailableDancers(legacyData.dancers.map((dancer: any) => ({
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.nationalId,
            age: dancer.age
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load contestant:', error);
    }
  };

  const loadStudioData = async (id: string) => {
    try {
      const studioSession = localStorage.getItem('studioSession');
      if (!studioSession) {
        router.push('/studio-login');
        return;
      }

      const parsedSession = JSON.parse(studioSession);
      if (parsedSession.id !== id) {
        router.push('/studio-login');
        return;
      }

      const response = await fetch(`/api/studios/dancers-new?studioId=${id}`);
      const data = await response.json();
      
      if (data.success) {
        setStudioInfo(parsedSession);
        setAvailableDancers(data.dancers);
      }
    } catch (error) {
      console.error('Failed to load studio data:', error);
    }
  };

  const loadEvent = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const selectedEvent = data.events.find((e: Event) => e.id === id);
          setEvent(selectedEvent || null);
        }
      }
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getParticipantRequirements = (performanceType: string) => {
    const typeInfo = PERFORMANCE_TYPES[performanceType as keyof typeof PERFORMANCE_TYPES];
    if (typeInfo) {
      return { description: typeInfo.description };
    }
    switch (performanceType) {
      case 'Solo': return { description: 'Individual performance' };
      case 'Duet': return { description: 'Two dancers together' };
      case 'Trio': return { description: 'Three dancers together' };
      case 'Group': return { description: '4+ dancers together' };
      default: return { description: 'Performance' };
    }
  };

  const getStartingFee = (performanceType: string) => {
    if (performanceType === 'Solo') {
      return 400; // R400 for 1 solo (plus R300 registration)
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 280; // R280 per person (plus R300 registration each)
    } else if (performanceType === 'Group') {
      return 220; // R220 per person for small groups (plus R300 registration each)
    }
    return 0;
  };

  const getFeeExplanation = (performanceType: string) => {
    if (performanceType === 'Solo') {
      return 'Solo packages: 1 solo R400, 2 solos R750, 3 solos R1000, 4 solos R1200, 5th FREE. Plus R300 registration.';
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 'R280 per person + R300 registration each';
    } else if (performanceType === 'Group') {
      return 'Small groups (4-9): R220pp, Large groups (10+): R190pp. Plus R300 registration each.';
    }
    return 'Per person + R300 registration each';
  };

  // NEW: Helper function to get maximum duration display for performance type
  const getMaxDurationDisplay = (performanceType: string) => {
    const TIME_LIMITS = {
      'Solo': 2,
      'Duet': 3,
      'Trio': 3,
      'Group': 3.5
    };
    const maxTime = TIME_LIMITS[performanceType as keyof typeof TIME_LIMITS] || 0;
    return maxTime === 3.5 ? '3:30' : `${maxTime}:00`;
  };

  // NEW: Helper function to determine age category based on average age
  const getCalculatedAgeCategory = () => {
    if (!currentForm.participantIds.length || !availableDancers.length) {
      return 'All Ages';
    }

    const selectedParticipants = availableDancers.filter(dancer => 
      currentForm.participantIds.includes(dancer.id)
    );

    if (selectedParticipants.length === 0) {
      return 'All Ages';
    }

    // Calculate average age of all participants
    const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
    const averageAge = Math.round(totalAge / selectedParticipants.length);
    
    // Determine age category based on average age
    if (averageAge <= 4) return '4 & Under';
    if (averageAge <= 6) return '6 & Under';
    if (averageAge <= 9) return '7-9';
    if (averageAge <= 12) return '10-12';
    if (averageAge <= 14) return '13-14';
    if (averageAge <= 17) return '15-17';
    if (averageAge <= 24) return '18-24';
    if (averageAge <= 39) return '25-39';
    if (averageAge < 60) return '40+';
    return '60+';
  };

  const getParticipantLimits = (performanceType: string) => {
    switch (performanceType) {
      case 'Solo': return { min: 1, max: 1 };
      case 'Duet': return { min: 2, max: 2 };
      case 'Trio': return { min: 3, max: 3 };
      case 'Group': return { min: 4, max: 10 };
      default: return { min: 1, max: 10 };
    }
  };

  const calculateEntryFee = (performanceType: string, participantCount: number) => {
    if (performanceType === 'Solo') {
      // Solo packages: 1 solo R400, 2 solos R750, 3 solos R1000, 4 solos R1200, 5th FREE
      const soloCount = entries.filter(entry => entry.performanceType === 'Solo').length + 1; // +1 for current entry
      if (soloCount === 1) return 400;
      if (soloCount === 2) return 750 - 400; // R350 for 2nd solo (total R750)
      if (soloCount === 3) return 1000 - 750; // R250 for 3rd solo (total R1000)
      if (soloCount === 4) return 1200 - 1000; // R200 for 4th solo (total R1200)
      if (soloCount >= 5) return 0; // 5th solo is FREE
      return 400;
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return 280 * participantCount;
    } else if (performanceType === 'Group') {
      return participantCount <= 9 ? 220 * participantCount : 190 * participantCount;
    }
    return 0;
  };

  const handleAddPerformanceType = (performanceType: string) => {
    // Save current form state if switching from another form
    if (showAddForm && showAddForm !== performanceType) {
      setSavedForms(prev => ({
        ...prev,
        [showAddForm]: currentForm
      }));
    }
    
    setShowAddForm(performanceType);
    
    // Restore saved form state or use default
    const savedForm = savedForms[performanceType];
    if (savedForm) {
      setCurrentForm(savedForm);
    } else {
      setCurrentForm({
        itemName: '',
        choreographer: '',
        mastery: 'Water (Competitive)',
        itemStyle: '',
        estimatedDuration: '',
        participantIds: [],
        ageCategory: 'All'
      });
    }
  };

  const handleSaveEntry = () => {
    if (!showAddForm || currentForm.participantIds.length === 0 || !currentForm.itemName) {
      return;
    }

    const limits = getParticipantLimits(showAddForm);
    if (currentForm.participantIds.length < limits.min || currentForm.participantIds.length > limits.max) {
      // Add some visual feedback that the form is invalid
      console.warn('Invalid participant selection:', {
        selected: currentForm.participantIds.length,
        required: `${limits.min}-${limits.max}`,
        performanceType: showAddForm
      });
      return;
    }

    const participants = availableDancers.filter(dancer => 
      currentForm.participantIds.includes(dancer.id)
    );

    const fee = calculateEntryFee(showAddForm, currentForm.participantIds.length);

    const newEntry: PerformanceEntry = {
      id: `entry-${Date.now()}`,
      performanceType: showAddForm as 'Solo' | 'Duet' | 'Trio' | 'Group',
      ...currentForm,
      participants,
      fee
    };

    setEntries(prev => [...prev, newEntry]);
    
    // Clear saved form state for this performance type
    setSavedForms(prev => {
      const newSavedForms = { ...prev };
      delete newSavedForms[showAddForm];
      return newSavedForms;
    });
    
    setShowAddForm(null);
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries(prev => {
      const newEntries = prev.filter(entry => entry.id !== entryId);
      
      // If we're removing a solo entry, recalculate solo fees for remaining entries
      const removedEntry = prev.find(entry => entry.id === entryId);
      if (removedEntry && removedEntry.performanceType === 'Solo') {
        const soloEntries = newEntries.filter(entry => entry.performanceType === 'Solo');
        
        // Recalculate solo fees based on new positioning
        soloEntries.forEach((entry, index) => {
          const soloCount = index + 1;
          if (soloCount === 1) entry.fee = 400;
          else if (soloCount === 2) entry.fee = 750 - 400; // R350 for 2nd solo
          else if (soloCount === 3) entry.fee = 1000 - 750; // R250 for 3rd solo
          else if (soloCount === 4) entry.fee = 1200 - 1000; // R200 for 4th solo
          else if (soloCount >= 5) entry.fee = 0; // 5th+ solo is FREE
        });
      }
      
      return newEntries;
    });
  };

  const calculateTotalFee = () => {
    const performanceFee = entries.reduce((total, entry) => total + entry.fee, 0);
    const uniqueParticipants = new Set();
    entries.forEach(entry => {
      entry.participantIds.forEach(id => uniqueParticipants.add(id));
    });
    const registrationFee = uniqueParticipants.size * 300;
    return { performanceFee, registrationFee, total: performanceFee + registrationFee };
  };

  const getPreviewFee = () => {
    if (!showAddForm || currentForm.participantIds.length === 0) return 0;
    
    // Only show fee if validation passes
    const limits = getParticipantLimits(showAddForm);
    if (currentForm.participantIds.length < limits.min || currentForm.participantIds.length > limits.max) {
      return 0;
    }
    
    return calculateEntryFee(showAddForm, currentForm.participantIds.length);
  };

  const handleProceedToPayment = async () => {
    if (entries.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Submit all entries to backend using regular event entries API
      for (const entry of entries) {
        const eventEntryData = {
          eventId: eventId, // Use regular event ID
          contestantId: isStudioMode ? studioInfo?.id : contestant?.id,
          eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
          participantIds: entry.participantIds,
          calculatedFee: entry.fee,
          paymentStatus: 'pending',
          paymentMethod: 'invoice',
          approved: false,
          qualifiedForNationals: true, // Mark as qualified for nationals
          itemName: entry.itemName,
          choreographer: entry.choreographer,
          mastery: entry.mastery,
          itemStyle: entry.itemStyle,
          estimatedDuration: parseFloat(entry.estimatedDuration.replace(':', '.')) || 2
        };

        try {
          const response = await fetch('/api/event-entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventEntryData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to submit ${entry.performanceType} entry: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          console.error(`Error submitting ${entry.performanceType} entry:`, error);
          error(`Error submitting ${entry.performanceType} entry: ${error.message || 'Unknown error'}`);
          return;
        }
      }

      // Show success message
      const totalFee = calculateTotalFee().total;
      setSubmissionResult({ entries: entries.length, totalFee });
      setShowSuccessModal(true);
      
      // Navigation is now handled by the modal buttons
    } catch (error: any) {
      console.error('Error during submission:', error);
      error(`Error during submission: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!region || (!eodsaId && !studioId) || !eventId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
          <p className="text-gray-300 mb-6">Authentication or event information not provided.</p>
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

  if (isLoading || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Loading Competition</h3>
            <p className="text-slate-400 text-sm">Preparing performance options...</p>
                  </div>
      </div>

    </div>
  );
}

  // Calculate fees in real-time
  const feeCalculation = calculateTotalFee();
  const previewFee = getPreviewFee();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Back Navigation */}
          <div className="mb-4">
            <Link 
              href={isStudioMode ? `/event-dashboard/${region}?studioId=${studioId}` : `/`}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-800/80 text-slate-300 rounded-lg hover:bg-slate-700 transition-all duration-300 group text-sm"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>{isStudioMode ? 'Back to Events' : 'Back to Main Portal'}</span>
            </Link>
          </div>

          {/* Event Header */}
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              {event.name}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-4">Build your competition entry</p>
            
            {/* User Info */}
            {(contestant || studioInfo) && (
              <div className="bg-slate-800/60 backdrop-blur rounded-xl p-3 sm:p-4 inline-block max-w-full">
                {isStudioMode ? (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      <span className="text-emerald-400 font-semibold">{studioInfo?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Reg: {studioInfo?.registrationNumber} • {availableDancers.length} dancers
                    </p>
                  </div>
                ) : (
                  <div className="text-center sm:text-left">
                    <p className="text-slate-300 text-sm sm:text-base">
                      Welcome, <span className="text-purple-400 font-semibold">{contestant?.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      ID: {contestant?.eodsaId}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Performance Type Selection and Forms */}
          <div className="lg:col-span-2">
            {/* Performance Type Selection */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
              <h3 className="text-xl font-bold text-white mb-4">Add Performance Types</h3>
                                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Solo', 'Duet', 'Trio', 'Group'].map((type) => {
                  const isActive = showAddForm === type;
                  const soloCount = entries.filter(e => e.performanceType === 'Solo').length;
                  const nextSoloFee = type === 'Solo' ? calculateEntryFee('Solo', 1) : 0;
                  
                  // For independent dancers (non-studio mode), only allow Solo
                  const isDisabled = !isStudioMode && type !== 'Solo';
                  
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && handleAddPerformanceType(type)}
                      disabled={isDisabled}
                      className={`p-4 bg-gradient-to-r text-white rounded-lg transition-all duration-300 transform ${
                        isDisabled 
                          ? 'from-gray-500 to-gray-600 cursor-not-allowed opacity-50' 
                          : isActive 
                            ? 'from-emerald-600 to-blue-600 ring-2 ring-emerald-400 animate-pulse hover:scale-[1.02]' 
                            : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-[1.02]'
                      }`}
                    >
                       <div className="text-center">
                         <h4 className="text-lg font-semibold mb-2">
                           Add {type}
                           {isDisabled && <span className="block text-xs mt-1 opacity-75">Requires studio membership</span>}
                         </h4>
                         
                         {/* Dynamic pricing for Solo */}
                         {type === 'Solo' && (
                           <div className="text-sm mb-2">
                             <div className="font-semibold text-emerald-200">
                               Next: R{nextSoloFee}
                             </div>
                             {soloCount === 0 && <div className="text-xs opacity-75">1st Solo</div>}
                             {soloCount === 1 && <div className="text-xs opacity-75">2nd Solo (Package deal)</div>}
                             {soloCount === 2 && <div className="text-xs opacity-75">3rd Solo (Package deal)</div>}
                             {soloCount === 3 && <div className="text-xs opacity-75">4th Solo (Package deal)</div>}
                             {soloCount >= 4 && <div className="text-xs opacity-75">FREE!</div>}
                           </div>
                         )}
                         
                         {/* Static pricing for others */}
                         {type !== 'Solo' && (
                           <div className="text-sm mb-2">
                             <div className="font-semibold text-emerald-200">
                               From R{getStartingFee(type)}
                             </div>
                           </div>
                         )}
                         
                         <p className="text-xs opacity-90">
                           {getFeeExplanation(type)}
                         </p>
                       </div>
                     </button>
                   );
                 })}
               </div>
               
               {/* Information for independent dancers */}
               {!isStudioMode && (
                 <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                   <div className="flex items-center">
                     <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <span className="text-blue-300 font-medium">Independent Dancer Information</span>
                   </div>
                   <p className="text-blue-200 text-sm mt-1">
                     As an independent dancer, you can only register for <strong>Solo</strong> performances. 
                     Duet, Trio, and Group performances require studio membership with multiple dancers.
                   </p>
                 </div>
               )}
            </div>

                         {/* Entry Form */}
             {showAddForm && (
               <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
                 <div className="flex justify-between items-center mb-4">
                   <div>
                     <h3 className="text-xl font-semibold text-white">Add {showAddForm} Entry</h3>
                     {savedForms[showAddForm] && (
                       <p className="text-xs text-emerald-400 mt-1">✓ Form data restored</p>
                     )}
                   </div>
                  <button
                    onClick={() => {
                      // Save current form state before closing
                      setSavedForms(prev => ({
                        ...prev,
                        [showAddForm]: currentForm
                      }));
                      setShowAddForm(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Item Name *</label>
                    <input
                      type="text"
                      value={currentForm.itemName}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Prevent empty strings with just spaces and enforce minimum length
                        if (value && value.trim().length > 0 && value.trim().length < 3) {
                          error('Item name must be at least 3 characters long.');
                        } else if (value && value.trim().length === 0) {
                          error('Item name cannot be empty or contain only spaces.');
                        }
                        setCurrentForm({...currentForm, itemName: value});
                      }}
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Choreographer *</label>
                    <input
                      type="text"
                      value={currentForm.choreographer}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                        setCurrentForm({...currentForm, choreographer: cleanValue});
                      }}
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Mastery Level</label>
                    <select
                      value={currentForm.mastery}
                      onChange={(e) => setCurrentForm({...currentForm, mastery: e.target.value})}
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select mastery level</option>
                      {MASTERY_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Item Style *</label>
                    <select
                      value={currentForm.itemStyle}
                      onChange={(e) => setCurrentForm({...currentForm, itemStyle: e.target.value})}
                      className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="">Select item style</option>
                      {ITEM_STYLES.map((style) => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Estimated Duration - Maximum: {getMaxDurationDisplay(showAddForm || '')}
                      <span className="text-xs text-slate-400 block mt-1">Read-only: Shows maximum time limit for {showAddForm}</span>
                    </label>
                    <input
                      type="text"
                      value={getMaxDurationDisplay(showAddForm || '')}
                      readOnly
                      className="w-full p-3 bg-slate-600/50 border border-slate-500 rounded-lg text-slate-300 cursor-not-allowed"
                      title="Maximum duration automatically set based on performance type"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Age Category
                      <span className="text-xs text-slate-400 block mt-1">Read-only: Based on average age of participants</span>
                    </label>
                    <input
                      type="text"
                      value={getCalculatedAgeCategory()}
                      readOnly
                      className="w-full p-3 bg-slate-600/50 border border-slate-500 rounded-lg text-slate-300 cursor-not-allowed"
                      title="Age category automatically determined by average age of participants"
                    />
                    {currentForm.participantIds.length > 0 && availableDancers.length > 0 && (
                      <div className="mt-2 p-2 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                        <div className="text-purple-300 text-sm">
                          <strong>Participants:</strong> {
                            availableDancers
                              .filter(dancer => currentForm.participantIds.includes(dancer.id))
                              .map(dancer => `${dancer.name} (${dancer.age}y)`)
                              .join(', ')
                          }
                        </div>
                        <div className="text-purple-200 text-xs mt-1">
                          Average Age: {(() => {
                            const selectedParticipants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id));
                            const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
                            return Math.round(totalAge / selectedParticipants.length);
                          })()} years → Category: {getCalculatedAgeCategory()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                                 <div className="mt-4">
                   <label className="block text-sm font-medium text-slate-300 mb-2">
                     Select Participants * ({getParticipantLimits(showAddForm).min} - {getParticipantLimits(showAddForm).max} required)
                     {currentForm.participantIds.length > 0 && (
                       <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                         currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                         currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                           ? 'bg-red-500/20 text-red-400'
                           : 'bg-emerald-500/20 text-emerald-400'
                       }`}>
                         {currentForm.participantIds.length} selected
                       </span>
                     )}
                   </label>
                   
                   {/* Validation Messages */}
                   {currentForm.participantIds.length > 0 && (
                     <div className="mb-3">
                       {currentForm.participantIds.length < getParticipantLimits(showAddForm).min && (
                         <div className="text-amber-400 text-sm flex items-center space-x-1 animate-pulse">
                           <span>⚠️</span>
                           <span>Need {getParticipantLimits(showAddForm).min - currentForm.participantIds.length} more participant(s)</span>
                         </div>
                       )}
                       {currentForm.participantIds.length > getParticipantLimits(showAddForm).max && (
                         <div className="text-red-400 text-sm flex items-center space-x-1 animate-bounce">
                           <span>❌</span>
                           <span>Too many participants! Remove {currentForm.participantIds.length - getParticipantLimits(showAddForm).max} participant(s)</span>
                         </div>
                       )}
                       {currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
                        currentForm.participantIds.length <= getParticipantLimits(showAddForm).max && (
                         <div className="text-emerald-400 text-sm flex items-center space-x-1">
                           <span>✅</span>
                           <span>Perfect! {currentForm.participantIds.length} participant(s) selected</span>
                         </div>
                       )}
                     </div>
                   )}
                   
                   <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-4 rounded-lg transition-all duration-300 ${
                     currentForm.participantIds.length > getParticipantLimits(showAddForm).max 
                       ? 'bg-red-900/20 border-2 border-red-500/50' 
                       : currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
                         currentForm.participantIds.length <= getParticipantLimits(showAddForm).max
                         ? 'bg-emerald-900/20 border-2 border-emerald-500/50'
                         : 'bg-slate-700/30 border border-slate-600/50'
                   }`}>
                     {availableDancers.length === 0 && (
                       <p className="text-slate-400 text-sm">No dancers available</p>
                     )}
                     {availableDancers.map(dancer => {
                       const isSelected = currentForm.participantIds.includes(dancer.id);
                       const isOverLimit = currentForm.participantIds.length >= getParticipantLimits(showAddForm).max;
                       
                       return (
                         <label 
                           key={dancer.id} 
                           className={`flex items-center space-x-2 p-2 rounded transition-all duration-200 ${
                             isSelected 
                               ? currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                                 ? 'bg-red-500/20 text-red-300' 
                                 : 'bg-emerald-500/20 text-emerald-300'
                               : isOverLimit && !isSelected
                                 ? 'text-slate-500 opacity-50 cursor-not-allowed'
                                 : 'text-slate-300 hover:bg-slate-600/30 cursor-pointer'
                           }`}
                         >
                           <input
                             type="checkbox"
                             checked={isSelected}
                             onChange={(e) => {
                               if (!isSelected && isOverLimit) {
                                 return; // Don't allow selection if over limit
                               }
                               
                               const newIds = e.target.checked
                                 ? [...currentForm.participantIds, dancer.id]
                                 : currentForm.participantIds.filter(id => id !== dancer.id);
                               setCurrentForm({...currentForm, participantIds: newIds});
                             }}
                             disabled={!isSelected && isOverLimit}
                             className={`rounded ${
                               isSelected && currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                                 ? 'accent-red-500' 
                                 : 'accent-emerald-500'
                             }`}
                           />
                           <span className="text-sm">{dancer.fullName || dancer.name}</span>
                         </label>
                       );
                     })}
                   </div>
                 </div>
                
                                 {/* Fee Preview */}
                 {currentForm.participantIds.length > 0 && (
                   <div className={`mt-4 p-3 rounded-lg border transition-all duration-300 ${
                     currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                     currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                       ? 'bg-red-900/20 border-red-500/50'
                       : 'bg-slate-700/30 border-slate-600/50'
                   }`}>
                     <div className="flex justify-between items-center">
                       <span className="text-sm text-slate-300">Entry Fee Preview:</span>
                       <span className={`text-lg font-semibold ${
                         previewFee > 0 ? 'text-emerald-400' : 'text-red-400'
                       }`}>
                         {previewFee > 0 ? `R${previewFee}` : 'Invalid'}
                       </span>
                     </div>
                     {showAddForm === 'Solo' && previewFee > 0 && (
                       <div className="text-xs text-slate-400 mt-1">
                         {entries.filter(e => e.performanceType === 'Solo').length === 0 && '1st Solo: R400'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 1 && '2nd Solo: R350 (Package: R750 total)'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 2 && '3rd Solo: R250 (Package: R1000 total)'}
                         {entries.filter(e => e.performanceType === 'Solo').length === 3 && '4th Solo: R200 (Package: R1200 total)'}
                         {entries.filter(e => e.performanceType === 'Solo').length >= 4 && '5th+ Solo: FREE!'}
                       </div>
                     )}
                     {previewFee === 0 && currentForm.participantIds.length > 0 && (
                       <div className="text-xs text-red-400 mt-1">
                         Fix participant selection to see fee
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="mt-6 flex justify-end space-x-4">
                   <button
                     onClick={() => {
                       // Save current form state before closing
                       setSavedForms(prev => ({
                         ...prev,
                         [showAddForm]: currentForm
                       }));
                       setShowAddForm(null);
                     }}
                     className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                   >
                     Cancel
                   </button>
                   <button
                     onClick={handleSaveEntry}
                     disabled={
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                     }
                     className={`px-6 py-2 text-white rounded-lg transition-all duration-300 ${
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                         ? 'bg-slate-500 cursor-not-allowed'
                         : 'bg-purple-600 hover:bg-purple-500 hover:scale-105'
                     }`}
                   >
                     {!currentForm.itemName ? 'Enter Item Name' :
                      currentForm.participantIds.length === 0 ? 'Select Participants' :
                      currentForm.participantIds.length < getParticipantLimits(showAddForm).min ? 
                        `Need ${getParticipantLimits(showAddForm).min - currentForm.participantIds.length} More` :
                      currentForm.participantIds.length > getParticipantLimits(showAddForm).max ? 
                        `Remove ${currentForm.participantIds.length - getParticipantLimits(showAddForm).max}` :
                      `Add Entry ${previewFee > 0 ? `(R${previewFee})` : ''}`}
                   </button>
                 </div>
              </div>
            )}

            {/* Added Entries List */}
            {entries.length > 0 && (
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Added Entries ({entries.length})</h3>
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg text-white">{entry.itemName}</h4>
                          <p className="text-slate-300">{entry.performanceType} • {entry.choreographer}</p>
                                                     <p className="text-sm text-slate-400">
                             {entry.participants.map(p => p.fullName || p.name).join(', ')}
                           </p>
                          <p className="text-sm text-slate-400">
                            {entry.mastery} • {entry.itemStyle} • {entry.estimatedDuration}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg text-emerald-400">R{entry.fee}</p>
                          <button
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary and Payment */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 sticky top-8">
              <h3 className="text-xl font-semibold text-white mb-4">Registration Summary</h3>
              
                             <div className="space-y-2 mb-4 text-slate-300">
                 <div className="flex justify-between">
                   <span>Entries:</span>
                   <span>{entries.length}{showAddForm && previewFee > 0 && <span className="text-slate-400"> (+1)</span>}</span>
                 </div>
                 
                 {/* Pending entry preview */}
                 {showAddForm && previewFee > 0 && (
                   <div className="text-xs text-slate-400 bg-slate-700/20 p-2 rounded border border-slate-600/30">
                     <div className="flex justify-between">
                       <span>+ Adding {showAddForm}:</span>
                       <span className="text-emerald-400">R{previewFee}</span>
                     </div>
                   </div>
                 )}
                 
                 {/* Solo package info */}
                 {entries.filter(e => e.performanceType === 'Solo').length > 0 && (
                   <div className="text-xs text-slate-400 bg-slate-700/30 p-2 rounded">
                     <div className="flex justify-between">
                       <span>Solo entries:</span>
                       <span>{entries.filter(e => e.performanceType === 'Solo').length}</span>
                     </div>
                     {entries.filter(e => e.performanceType === 'Solo').length >= 2 && (
                       <div className="text-emerald-400 mt-1">
                         ✓ Solo package pricing applied
                       </div>
                     )}
                     {entries.filter(e => e.performanceType === 'Solo').length >= 5 && (
                       <div className="text-emerald-400">
                         ✓ 5th+ solo entries are FREE!
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="flex justify-between">
                   <span>Performance Fees:</span>
                   <span>R{feeCalculation.performanceFee}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Registration Fees:</span>
                   <span>R{feeCalculation.registrationFee}</span>
                 </div>
                 <div className="text-xs text-slate-400">
                   ({new Set(entries.flatMap(e => e.participantIds)).size} unique participants × R300)
                 </div>
                 
                 {/* Preview total with pending entry */}
                 {showAddForm && previewFee > 0 && (
                   <div className="border-t border-slate-600/50 pt-2">
                     <div className="flex justify-between text-sm text-slate-400">
                       <span>Preview Total:</span>
                       <span>R{feeCalculation.total + previewFee}</span>
                     </div>
                   </div>
                 )}
                 
                 <div className="border-t border-slate-600 pt-2">
                   <div className="flex justify-between font-semibold text-lg text-emerald-400">
                     <span>Total:</span>
                     <span className="transition-all duration-300 transform hover:scale-110">
                       R{feeCalculation.total}
                     </span>
                   </div>
                 </div>
               </div>

              <button
                onClick={handleProceedToPayment}
                disabled={entries.length === 0 || isSubmitting}
                className={`w-full py-3 text-white rounded-lg font-semibold transition-all duration-300 ${
                  isSubmitting 
                    ? 'bg-slate-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:bg-slate-500 disabled:cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting Entries...</span>
                  </div>
                ) : (
                  'Proceed to Payment'
                )}
              </button>
            </div>

            {/* Event Details */}
            <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mt-6">
              <h3 className="text-xl font-semibold text-white mb-4">Event Details</h3>
                             <div className="space-y-2 text-sm text-slate-300">
                 <p><strong>Date:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'TBD'}</p>
                 <p><strong>Time:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleTimeString() : 'TBD'}</p>
                 <p><strong>Venue:</strong> {event?.venue || 'TBD'}</p>
                 <p><strong>Registration Deadline:</strong> {event?.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString() : 'TBD'}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && submissionResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 max-w-lg w-full">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">🎉 Entries Submitted Successfully!</h2>
              <p className="text-slate-300">Your competition entries have been registered for {event?.name}</p>
            </div>

            {/* Entry Summary */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Entries Submitted:</span>
                                  <span className="text-white font-semibold">{submissionResult?.entries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Fee:</span>
                <span className="text-emerald-400 font-semibold text-lg">R{submissionResult?.totalFee}</span>
                </div>
                <div className="pt-2 border-t border-slate-600">
                  <p className="text-sm text-slate-300">
                    ✅ All entries qualified for nationals
                  </p>
                  <p className="text-sm text-slate-300">
                    ⏳ Payment status: Pending
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <h4 className="text-blue-400 font-semibold mb-2">Next Steps:</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Payment invoice will be sent to your email</li>
                <li>• Complete payment to confirm your entries</li>
                <li>• Check your dashboard for updates</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {isStudioMode ? (
                <>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Clear entries and reset form
                      setEntries([]);
                      setSubmissionResult(null);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Enter More Events
                  </button>
                  <button
                    onClick={() => router.push(`/studio-dashboard?studioId=${studioId}`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                  >
                    Studio Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Clear entries and reset form
                      setEntries([]);
                      setSubmissionResult(null);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Enter More Events
                  </button>
                  <button
                    onClick={() => router.push(`/`)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                  >
                    Main Portal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 