'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, MASTERY_LEVELS, ITEM_STYLES, Event } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';
import { useToast } from '@/components/ui/simple-toast';
import MusicUpload from '@/components/MusicUpload';
// Registration fee checking moved to API calls
import React from 'react';

function TourOverlay({
  step,
  getTargetRect,
  onNext,
  onBack,
  onClose
}: {
  step: 1 | 2 | 3 | 4 | 5;
  getTargetRect: () => { top: number; left: number; width: number; height: number } | null;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const update = () => {
      const targetRect = getTargetRect();
      setRect(targetRect);
      if (targetRect) {
        // Place card below the highlight, aligned left
        const margin = 12;
        const viewportWidth = window.innerWidth;
        const cardWidth = 300;
        let left = targetRect.left;
        if (left + cardWidth + 16 > viewportWidth) {
          left = Math.max(16, viewportWidth - cardWidth - 16);
        }
        let top = targetRect.top + targetRect.height + margin;
        // If near bottom, place above
        if (top + 160 > window.innerHeight) {
          top = Math.max(16, targetRect.top - 160 - margin);
        }
        setCardPos({ top, left });
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [step, getTargetRect]);

  if (!rect) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="absolute rounded-xl ring-4 ring-blue-400/70 shadow-2xl"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      <div
        className="absolute max-w-xs w-[300px] p-4 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 pointer-events-auto"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div className="text-sm font-semibold mb-2 text-slate-800">
          {step === 1 && 'Step 1: Choose a performance type'}
          {step === 2 && 'Step 2: Fill up the performance details'}
          {step === 3 && 'Step 3: Choose Live or Virtual'}
          {step === 4 && 'Step 4: Add Entry'}
          {step === 5 && 'Step 5: Proceed to payment'}
        </div>
        <div className="text-sm text-slate-700 mb-3">
          {step === 1 && 'Pick Solo, Duet, Trio or Group to start.'}
          {step === 2 && 'Complete the fields above. Music is optional for Live; video URL is optional for Virtual.'}
          {step === 3 && 'Pick Live (music) or Virtual (video).'}
          {step === 4 && 'Click Add Entry. To add another, go back to Step 1 and repeat.'}
          {step === 5 && 'If you are done with entries, continue to payment here.'}
        </div>
        <div className="flex justify-between items-center">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-sm">Skip</button>
          <div className="space-x-2">
            {step > 1 && (
              <button onClick={onBack} className="px-3 py-1 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Back</button>
            )}
            <button
              onClick={() => {
                if (step < 5) {
                  onNext();
                } else {
                  onClose();
                }
              }}
              className="px-3 py-1 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-500"
            >
              {step < 5 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  // PHASE 2: Live vs Virtual Entry Support
  entryType: 'live' | 'virtual';
  musicFileUrl?: string;
  musicFileName?: string;
  videoFileUrl?: string;
  videoFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
}

export default function CompetitionEntryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { success, error, validationError } = useToast();
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
  const [existingDbEntries, setExistingDbEntries] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [registrationFeeCache, setRegistrationFeeCache] = useState<{[key: string]: number}>({});
  const [totalFeeCalculation, setTotalFeeCalculation] = useState<{performanceFee: number, registrationFee: number, total: number}>({performanceFee: 0, registrationFee: 0, total: 0});
  const [previewFee, setPreviewFee] = useState<number>(0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [currentForm, setCurrentForm] = useState({
    itemName: '',
    choreographer: '',
    mastery: 'Water (Competitive)',
    itemStyle: '',
    estimatedDuration: '',
    participantIds: [] as string[],
    ageCategory: 'All',
    // PHASE 2: Live vs Virtual Entry Support
    entryType: 'live' as 'live' | 'virtual',
    // For Live entries - music file
    musicFileUrl: '',
    musicFileName: '',
    // For Virtual entries - video file or URL
    videoExternalUrl: '',
    videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other'
  });
  const [savedForms, setSavedForms] = useState<Record<string, typeof currentForm>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{entries: number, totalFee: number} | null>(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'payfast' | 'eft' | null>(null);
  const [showEftModal, setShowEftModal] = useState(false);
  const [eftInvoiceNumber, setEftInvoiceNumber] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  // Coachmark tour state
  const [isTourActive, setIsTourActive] = useState(true);
  const [tourStep, setTourStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [coachmarkPos, setCoachmarkPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const typeSelectionRef = useRef<HTMLDivElement | null>(null);
  const entryFormRef = useRef<HTMLDivElement | null>(null);
  const addEntryButtonRef = useRef<HTMLButtonElement | null>(null);
  const musicSectionRef = useRef<HTMLDivElement | null>(null);
  const participantsSectionRef = useRef<HTMLDivElement | null>(null);
  const proceedToPaymentRef = useRef<HTMLButtonElement | null>(null);
  const entryTypeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (region && eventId) {
      if (eodsaId) {
        setIsStudioMode(false);
        loadContestant(eodsaId);
        loadExistingEntries(eodsaId, eventId);
      } else if (studioId) {
        setIsStudioMode(true);
        loadStudioData(studioId);
      }
      loadEvent(eventId);
    }
  }, [region, eodsaId, studioId, eventId]);

  // Auto-select current dancer when opening Solo form for independent dancers
  useEffect(() => {
    if (showAddForm === 'Solo' && !isStudioMode && contestant && contestant.type === 'private') {
      if (contestant.dancers.length > 0 && currentForm.participantIds.length === 0) {
        console.log(`🎭 Auto-selecting dancer for Solo form: ${contestant.dancers[0].name}`);
        setCurrentForm(prev => ({
          ...prev,
          participantIds: [contestant.dancers[0].id]
        }));
      }
    }
  }, [showAddForm, isStudioMode, contestant, currentForm.participantIds]);

  const loadContestant = async (id: string) => {
    setIsLoading(true);
    try {
      console.log(`🎭 Loading contestant for competition entry: ${id}`);
      
      // Try unified system first (new dancers)
      console.log(`🔍 Fetching: /api/dancers/by-eodsa-id/${id}`);
      const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
      console.log(`📡 Unified response status: ${unifiedResponse.status}`);
      
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        console.log(`📦 Unified response data:`, unifiedData);
        
        if (unifiedData.success && unifiedData.dancer) {
          const dancer = unifiedData.dancer;
          const isStudioLinked = dancer.studioAssociation !== null;
          
          console.log(`✅ Loaded dancer: ${dancer.name}, Studio linked: ${isStudioLinked}`);
          
          const contestantData = {
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
          
          setContestant(contestantData);
          
          // For solo dancers, add them to availableDancers so they can select themselves
          const availableDancerData = {
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.eodsaId,
            age: dancer.age,
            nationalId: dancer.nationalId
          };
          
          console.log(`🎭 Setting available dancers:`, [availableDancerData]);
          setAvailableDancers([availableDancerData]);
          
          // Auto-select the dancer as participant for independent dancers
          if (!isStudioLinked) {
            console.log(`🎭 Auto-selecting independent dancer: ${dancer.name}`);
            setCurrentForm(prev => ({
              ...prev,
              participantIds: [dancer.id]
            }));
          }
          setIsLoading(false);
          return;
        } else {
          console.log(`⚠️ Unified API returned but no dancer found: ${JSON.stringify(unifiedData)}`);
        }
      } else {
        console.log(`❌ Unified API failed with status ${unifiedResponse.status}`);
        const errorText = await unifiedResponse.text();
        console.log(`❌ Unified API error response:`, errorText);
      }
      
      // Fallback to legacy system (contestants)
      console.log(`🔄 Trying legacy system for: ${id}`);
      console.log(`🔍 Fetching: /api/contestants/by-eodsa-id/${id}`);
      const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
      console.log(`📡 Legacy response status: ${legacyResponse.status}`);
      
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        console.log(`✅ Loaded legacy contestant:`, legacyData);
        
        // For independent dancers, if no dancers exist, create dancer from contestant data
        if (legacyData.type === 'private' && (!legacyData.dancers || legacyData.dancers.length === 0)) {
          console.log(`🎭 Creating dancer entry for independent contestant: ${legacyData.name}`);
          
          // Calculate age from date of birth
          let age = 18; // Default age
          if (legacyData.dateOfBirth) {
            const birthDate = new Date(legacyData.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          }
          
          // Create dancer entry from contestant data
          const dancerEntry = {
            id: legacyData.id, // Use contestant ID as dancer ID
            name: legacyData.name,
            age: age,
            style: '',
            nationalId: legacyData.eodsaId
          };
          
          // Add dancer to contestant data
          legacyData.dancers = [dancerEntry];
          console.log(`✅ Created dancer entry:`, dancerEntry);
        }
        
        setContestant(legacyData);
        
        // For legacy contestants, also add them to availableDancers
        if (legacyData.dancers && legacyData.dancers.length > 0) {
          const mappedDancers = legacyData.dancers.map((dancer: any) => ({
            id: dancer.id,
            name: dancer.name,
            fullName: dancer.name,
            eodsaId: dancer.nationalId || legacyData.eodsaId,
            age: dancer.age
          }));
          console.log(`🎭 Setting legacy available dancers:`, mappedDancers);
          setAvailableDancers(mappedDancers);
          
          // Auto-select for private contestants
          if (legacyData.type === 'private' && legacyData.dancers.length > 0) {
            console.log(`🎭 Auto-selecting legacy private dancer: ${legacyData.dancers[0].name}`);
            setCurrentForm(prev => ({
              ...prev,
              participantIds: [legacyData.dancers[0].id]
            }));
          }
        } else {
          console.log(`⚠️ Legacy contestant has no dancers: ${JSON.stringify(legacyData)}`);
        }
      } else {
        console.log(`❌ Legacy API failed with status ${legacyResponse.status}`);
        const errorText = await legacyResponse.text();
        console.log(`❌ Legacy API error response:`, errorText);
      }
      
      console.log(`❌ No dancer found in either system for EODSA ID: ${id}`);
      
    } catch (error) {
      console.error('❌ Failed to load contestant:', error);
    } finally {
      setIsLoading(false);
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

  const loadExistingEntries = async (eodsaId: string, eventId: string) => {
    if (!eodsaId || !eventId) return;
    
    try {
      console.log(`🔍 Loading existing entries for dancer ${eodsaId} in event ${eventId}`);
      const response = await fetch(`/api/contestants/entries?eodsaId=${eodsaId}&debug=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Filter entries for this specific event
          const eventEntries = data.entries.filter((entry: any) => entry.eventId === eventId);
          setExistingDbEntries(eventEntries);
          console.log(`📊 Found ${eventEntries.length} existing entries for this event`);
          if (data.debug) {
            console.log('Debug info:', data.debug);
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing entries:', error);
      setExistingDbEntries([]);
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
    if (!event) return 0;
    
    if (performanceType === 'Solo') {
      return event.solo1Fee || 400; // First solo fee
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      return event.duoTrioFeePerDancer || 280; // Per person
    } else if (performanceType === 'Group') {
      return event.groupFeePerDancer || 220; // Per person for small groups
    }
    return 0;
  };

  // Resolve a dancer's EODSA ID from an internal participant ID (studio mode)
  const resolveEodsaIdFromParticipantId = async (participantId: string): Promise<string | null> => {
    try {
      // First try from already-loaded studio dancers to avoid API calls
      const local = availableDancers.find((d: any) => d.id === participantId);
      if (local?.eodsaId) {
        console.log('SOLO_DEBUG: resolveEodsaIdFromParticipantId:local', { participantId, eodsaId: local.eodsaId });
        return local.eodsaId as string;
      }
      console.log('SOLO_DEBUG: resolveEodsaIdFromParticipantId:start', { participantId });
      const resp = await fetch(`/api/dancers/${participantId}`);
      console.log('SOLO_DEBUG: resolveEodsaIdFromParticipantId:resp', { status: resp.status });
      if (resp.ok) {
        const data = await resp.json();
        const eodsaId = data?.dancer?.eodsaId;
        console.log('SOLO_DEBUG: resolveEodsaIdFromParticipantId:data', { hasSuccess: data?.success, eodsaId });
        if (data.success && eodsaId) {
          return eodsaId as string;
        }
      }
    } catch (error) {
      console.warn('SOLO_DEBUG: resolveEodsaIdFromParticipantId:error', error);
    }
    return null;
  };

  // Get existing solo count for a specific dancer (by participant/internal ID) in the current event
  const getExistingSoloCountForDancer = async (participantId: string): Promise<number> => {
    try {
      const dancerEodsaId = await resolveEodsaIdFromParticipantId(participantId);
      console.log('SOLO_DEBUG: existingSoloCount:resolved', { participantId, dancerEodsaId, eventId });
      if (!dancerEodsaId || !eventId) return 0;

      const url = `/api/contestants/entries?eodsaId=${encodeURIComponent(dancerEodsaId)}&debug=false`;
      console.log('SOLO_DEBUG: existingSoloCount:fetch', { url });
      const response = await fetch(url);
      console.log('SOLO_DEBUG: existingSoloCount:resp', { status: response.status });
      if (!response.ok) return 0;
      const data = await response.json();
      console.log('SOLO_DEBUG: existingSoloCount:data', { success: data?.success, total: data?.entries?.length });
      if (!data.success || !Array.isArray(data.entries)) return 0;

      const dancerEventEntries = data.entries.filter((entry: any) => entry.eventId === eventId || entry.event_id === eventId);
      console.log('SOLO_DEBUG: existingSoloCount:eventEntries', { count: dancerEventEntries.length });

      let count = 0;
      for (const entry of dancerEventEntries) {
        if (!entry.participantIds) continue;
        let entryParticipants: string[] = [];
        if (Array.isArray(entry.participantIds)) {
          entryParticipants = entry.participantIds;
        } else if (typeof entry.participantIds === 'string') {
          try {
            entryParticipants = JSON.parse(entry.participantIds);
          } catch {
            entryParticipants = [entry.participantIds];
          }
        }
        const isSoloForDancer = (
          entryParticipants.length === 1 &&
          (entryParticipants.includes(dancerEodsaId) || entryParticipants.includes(participantId))
        );
        console.log('SOLO_DEBUG: existingSoloCount:entryCheck', { entryId: entry.id, entryParticipants, isSoloForDancer });
        if (isSoloForDancer) count++;
      }

      console.log('SOLO_DEBUG: existingSoloCount:final', { count });
      return count;
    } catch (error) {
      console.warn('SOLO_DEBUG: existingSoloCount:error', error);
      return 0;
    }
  };

  const getFeeExplanation = (performanceType: string) => {
    if (!event) return '';
    
    const currency = event.currency || 'ZAR';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
    const regFee = event.registrationFeePerDancer || 300;
    
    if (performanceType === 'Solo') {
      const solo1 = event.solo1Fee || 400;
      const solo2 = event.solo2Fee || 750;
      const solo3 = event.solo3Fee || 1050;
      const additional = event.soloAdditionalFee || 100;
      return `Solo packages: 1st solo ${symbol}${solo1}, 2 solos ${symbol}${solo2}, 3 solos ${symbol}${solo3}, additional solos ${symbol}${additional} each. Plus ${symbol}${regFee} registration.`;
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      const duoTrioFee = event.duoTrioFeePerDancer || 280;
      return `${symbol}${duoTrioFee} per person + ${symbol}${regFee} registration each`;
    } else if (performanceType === 'Group') {
      const smallGroupFee = event.groupFeePerDancer || 220;
      const largeGroupFee = event.largeGroupFeePerDancer || 190;
      return `Small groups (4-9): ${symbol}${smallGroupFee}pp, Large groups (10+): ${symbol}${largeGroupFee}pp. Plus ${symbol}${regFee} registration each.`;
    }
    return `Per person + ${symbol}${regFee} registration each`;
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
      case 'Group': return { min: 4, max: 30 };
      default: return { min: 1, max: 30 };
    }
  };

  const calculateEntryFee = async (performanceType: string, participantIds: string[]) => {
    try {
      if (!currentForm.mastery) {
        console.warn('No mastery level selected, using default performance fee calculation');
        return calculateFallbackEntryFee(performanceType, participantIds.length, participantIds);
      }

      // Use smart fee calculation that accounts for registration fees
      const capitalizedPerformanceType = performanceType.charAt(0).toUpperCase() + performanceType.slice(1).toLowerCase() as 'Solo' | 'Duet' | 'Trio' | 'Group';
      
      let soloCount = 1;
      if (performanceType === 'Solo') {
        // Count existing solo entries from database + current session entries for the selected dancer
        let existingSoloCount = 0;
        if (participantIds.length === 1) {
          const internalId = participantIds[0];
          // Prefer direct lookup for studio dancers
          if (studioInfo) {
            console.log('SOLO_DEBUG: calculateEntryFee:studioSolo:start', { internalId, eventId });
            existingSoloCount = await getExistingSoloCountForDancer(internalId);
            console.log('SOLO_DEBUG: calculateEntryFee:studioSolo:existing', { existingSoloCount });
          } else {
            // Fallback to previously loaded entries (independent/private flow)
            existingSoloCount = existingDbEntries.filter(entry => {
              if (!entry.participantIds || entry.participantIds.length !== 1) return false;
              let entryParticipants: string[] = [];
              if (Array.isArray(entry.participantIds)) {
                entryParticipants = entry.participantIds;
              } else if (typeof entry.participantIds === 'string') {
                try {
                  entryParticipants = JSON.parse(entry.participantIds);
                } catch {
                  entryParticipants = [entry.participantIds];
                }
              }
              return entryParticipants.includes(internalId);
            }).length;
          }
        } else {
          existingSoloCount = existingDbEntries.filter(entry => entry.participantIds && entry.participantIds.length === 1).length;
        }

        const sessionSoloCount = entries.filter(entry => 
          entry.performanceType === 'Solo' && 
          entry.participantIds.length === 1 && 
          entry.participantIds[0] === participantIds[0]
        ).length;
        soloCount = existingSoloCount + sessionSoloCount + 1;

        console.log('SOLO_DEBUG: calculateEntryFee:counts', {
          internalId: participantIds[0] || 'unknown',
          existingSoloCount,
          sessionSoloCount,
          soloCount,
        });
      }

      // Compute performance-only fee locally to avoid DB dependency
      let fee = 0;
      if (capitalizedPerformanceType === 'Solo') {
        if (soloCount === 1) fee = 400;
        else if (soloCount === 2) fee = 350;
        else if (soloCount === 3) fee = 300;
        else if (soloCount === 4) fee = 250;
        else if (soloCount === 5) fee = 0;
        else fee = 100;
      } else if (capitalizedPerformanceType === 'Duet' || capitalizedPerformanceType === 'Trio') {
        fee = 280 * participantIds.length;
      } else if (capitalizedPerformanceType === 'Group') {
        fee = participantIds.length <= 9 ? 220 * participantIds.length : 190 * participantIds.length;
      }
      console.log('SOLO_DEBUG: calculateEntryFee:feeResult', { fee, soloCount, type: capitalizedPerformanceType });
      return fee;
    } catch (error) {
      console.error('Error in smart fee calculation, falling back to basic calculation:', error);
      return calculateFallbackEntryFee(performanceType, participantIds.length, participantIds);
    }
  };

  // Fallback fee calculation for when smart calculation fails
  const calculateFallbackEntryFee = (performanceType: string, participantCount: number, specificParticipantIds?: string[]) => {
    if (performanceType === 'Solo') {
      let existingSoloCount = 0;
      let sessionSoloCount = 0;
      
      // If we have specific participant info, count per dancer
      if (specificParticipantIds && specificParticipantIds.length === 1) {
        const dancerEodsaId = specificParticipantIds[0];
        
        // Count existing solos for this specific dancer
        existingSoloCount = existingDbEntries.filter(entry => {
          if (!entry.participantIds || entry.participantIds.length !== 1) return false;
          
          let entryParticipants = [];
          if (Array.isArray(entry.participantIds)) {
            entryParticipants = entry.participantIds;
          } else if (typeof entry.participantIds === 'string') {
            try {
              entryParticipants = JSON.parse(entry.participantIds);
            } catch (e) {
              entryParticipants = [entry.participantIds];
            }
          }
          
          return entryParticipants.includes(dancerEodsaId);
        }).length;
        
        // Count session solos for this specific dancer
        sessionSoloCount = entries.filter(entry => 
          entry.performanceType === 'Solo' && 
          entry.participantIds.length === 1 && 
          entry.participantIds[0] === dancerEodsaId
        ).length;
      } else {
        // Fallback to old logic if no specific participant info
        existingSoloCount = existingDbEntries.filter(entry => 
          entry.participantIds && entry.participantIds.length === 1
        ).length;
        sessionSoloCount = entries.filter(entry => entry.performanceType === 'Solo').length;
      }
      
      const totalSoloCount = existingSoloCount + sessionSoloCount + 1; // +1 for current entry
      
      // Use event-specific solo pricing
      let performanceFee = 0;
      
      if (totalSoloCount === 1) {
        performanceFee = event?.solo1Fee || 400;
      } else if (totalSoloCount === 2) {
        // Calculate cumulative, then subtract previous
        const total2 = event?.solo2Fee || 750;
        const total1 = event?.solo1Fee || 400;
        performanceFee = total2 - total1;
      } else if (totalSoloCount === 3) {
        // Calculate cumulative, then subtract previous
        const total3 = event?.solo3Fee || 1050;
        const total2 = event?.solo2Fee || 750;
        performanceFee = total3 - total2;
      } else {
        // More than 3: additional fee
        performanceFee = event?.soloAdditionalFee || 100;
      }
      // Performance-only
      return performanceFee;
    } else if (performanceType === 'Duet' || performanceType === 'Trio') {
      // Performance-only per person
      return (event?.duoTrioFeePerDancer || 280) * participantCount;
    } else if (performanceType === 'Group') {
      // Performance-only per person
      const perPerson = participantCount <= 9 
        ? (event?.groupFeePerDancer || 220)
        : (event?.largeGroupFeePerDancer || 190);
      return perPerson * participantCount;
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
        ageCategory: 'All',
        entryType: 'live' as 'live' | 'virtual',
        musicFileUrl: '',
        musicFileName: '',
        videoExternalUrl: '',
        videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other'
      });
    }
  };

  const handleSaveEntry = async () => {
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

    // Note: Media uploads are optional during initial entry creation
    // Users can upload music (live) or video (virtual) later through their dashboard

    const participants = availableDancers.filter(dancer => 
      currentForm.participantIds.includes(dancer.id)
    );

    const fee = await calculateEntryFee(showAddForm, currentForm.participantIds);

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
          else if (soloCount === 5) entry.fee = 0; // 5th solo is FREE
          else if (soloCount > 5) entry.fee = 100; // Additional solos R100 each
        });
      }
      
      return newEntries;
    });
  };

  const calculateTotalFee = async () => {
    setIsCalculatingFee(true);
    const performanceFee = entries.reduce((total, entry) => total + entry.fee, 0);
    const uniqueParticipants = new Set<string>();
    entries.forEach(entry => {
      entry.participantIds.forEach(id => uniqueParticipants.add(id));
    });
    
    // Check registration status for unique participants
    const participantIds = Array.from(uniqueParticipants);
    const cacheKey = participantIds.sort().join(',');
    
    let registrationFee = 0;
    if (participantIds.length > 0) {
      // Check if we have cached the result
      if (registrationFeeCache[cacheKey] !== undefined) {
        registrationFee = registrationFeeCache[cacheKey];
      } else {
        try {
          // Use the first entry's mastery level (they should all be the same for Nationals)
          const masteryLevel = entries.length > 0 ? entries[0].mastery : 'Fire (Advanced)';
          
          // Call API to get smart fee calculation with registration checking
          // Use 'Solo' as performance type since we're only calculating registration fees
          const response = await fetch('/api/eodsa-fees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              masteryLevel,
              performanceType: 'Solo', // Use Solo to trigger registration fee logic
              participantIds: Array.from(participantIds),
              includeRegistration: true
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            registrationFee = data.fees.registrationFee;
          } else {
            throw new Error('API call failed');
          }
          
          // Cache the result
          setRegistrationFeeCache(prev => ({
            ...prev,
            [cacheKey]: registrationFee
          }));
        } catch (error) {
          console.error('Error checking registration status:', error);
          // Fallback to charging all participants (old behavior)
          registrationFee = uniqueParticipants.size * 300;
        }
      }
    }
    
    const result = { performanceFee, registrationFee, total: performanceFee + registrationFee };
    setTotalFeeCalculation(result);
    setIsCalculatingFee(false);
    return result;
  };

  // Recalculate fees whenever entries change
  useEffect(() => {
    if (entries.length > 0) {
      calculateTotalFee();
    } else {
      setTotalFeeCalculation({performanceFee: 0, registrationFee: 0, total: 0});
      setIsCalculatingFee(false);
    }
  }, [entries, registrationFeeCache]);

  // Compute async preview fee whenever selection changes
  useEffect(() => {
    const run = async () => {
      try {
        if (!showAddForm || currentForm.participantIds.length === 0) {
          setPreviewFee(0);
          return;
        }
        const limits = getParticipantLimits(showAddForm);
        if (currentForm.participantIds.length < limits.min || currentForm.participantIds.length > limits.max) {
          setPreviewFee(0);
          return;
        }
        console.log('SOLO_DEBUG: preview:start', {
          showAddForm,
          participantIds: currentForm.participantIds,
          mastery: currentForm.mastery,
          studioMode: !!studioInfo,
          eventId
        });
        const fee = await calculateEntryFee(showAddForm, currentForm.participantIds);
        console.log('SOLO_DEBUG: preview:fee', { fee });
        setPreviewFee(fee || 0);
      } catch (err) {
        console.warn('SOLO_DEBUG: preview:error, using fallback', err);
        setPreviewFee(
          calculateFallbackEntryFee(showAddForm || 'Solo', currentForm.participantIds.length, currentForm.participantIds)
        );
      }
    };
    run();
    // Include entries to account for session solo count
  }, [showAddForm, currentForm.participantIds, currentForm.mastery, studioInfo, eventId, entries]);

  const handleProceedToPayment = async () => {
    if (entries.length === 0 || isSubmitting) return;
    setShowPaymentMethodModal(true);
  };

  const handlePaymentMethodSelection = async (method: 'payfast' | 'eft') => {
    setSelectedPaymentMethod(method);
    setShowPaymentMethodModal(false);

    if (method === 'eft') {
      setShowEftModal(true);
      return;
    }

    // Handle PayFast payment (existing logic)
    await processPayFastPayment();
  };

  const processPayFastPayment = async () => {
    setIsSubmitting(true);

    try {
      const totalFee = totalFeeCalculation.total;
      
      // For multiple entries, we'll create a batch payment
      // First, store entry data temporarily and get payment URL
      const batchEntryData = entries.map(entry => ({
        eventId: eventId,
        contestantId: isStudioMode ? studioInfo?.id : contestant?.id,
        eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
        participantIds: entry.participantIds,
        calculatedFee: entry.fee,
        itemName: entry.itemName,
        choreographer: entry.choreographer,
        mastery: entry.mastery,
        itemStyle: entry.itemStyle,
        estimatedDuration: parseFloat(entry.estimatedDuration.replace(':', '.')) || 2,
        entryType: entry.entryType,
        musicFileUrl: entry.musicFileUrl || null,
        musicFileName: entry.musicFileName || null,
        videoFileUrl: entry.videoFileUrl || null,
        videoFileName: entry.videoFileName || null,
        videoExternalUrl: entry.videoExternalUrl || null,
        videoExternalType: entry.videoExternalType || null,
        performanceType: entry.performanceType
      }));

      // Store entry data in session storage for after payment
      sessionStorage.setItem('pendingEntries', JSON.stringify(batchEntryData));
      sessionStorage.setItem('paymentAmount', totalFee.toString());
      sessionStorage.setItem('paymentEventId', eventId);
      sessionStorage.setItem('paymentEventName', event?.name || 'Competition Entry');

      // Create payment request
      const firstEntry = entries[0];
      const userName = isStudioMode ? 
        (studioInfo?.name || 'Studio Manager') : 
        (contestant?.name || 'Contestant');
      
      const [firstName, ...lastNameParts] = userName.split(' ');
      const lastName = lastNameParts.join(' ') || 'User';
      
      const userEmail = isStudioMode ? 
        (studioInfo?.email || 'studio@example.com') : 
        (contestant?.email || 'contestant@example.com');

      const paymentData = {
        entryId: 'BATCH_' + Date.now(), // Temporary batch ID
        eventId: eventId,
        userId: isStudioMode ? studioInfo?.id : contestant?.id,
        userFirstName: firstName,
        userLastName: lastName,
        userEmail: userEmail,
        amount: totalFee,
        itemName: `${entries.length} Competition Entries`,
        itemDescription: entries.map(e => `${e.performanceType}: ${e.itemName}`).join(', '),
        isBatchPayment: true, // Flag to indicate this is for batch entries
        pendingEntries: batchEntryData // Include entry data for webhook auto-creation
      };

      console.log('🔄 Redirecting to payment for batch entries:', {
        entriesCount: entries.length,
        totalAmount: totalFee,
        paymentData
      });

      // Redirect to payment processing
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (response.ok) {
        // Response should be HTML for PayFast redirect
        const paymentHtml = await response.text();
        
        // Create a new window/tab with the payment form
        const paymentWindow = window.open('', '_self');
        if (paymentWindow) {
          paymentWindow.document.write(paymentHtml);
          paymentWindow.document.close();
        } else {
          // Fallback: try to redirect in current window
          document.open();
          document.write(paymentHtml);
          document.close();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate payment');
      }
    } catch (paymentError: any) {
      console.error('Payment error:', paymentError);
      error(`Failed to initiate payment: ${paymentError.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEftPayment = async () => {
    setIsSubmitting(true);

    try {
      const totalFee = totalFeeCalculation.total;
      
      // Create entry data for EFT payment - submit entries immediately as pending
      const batchEntryData = entries.map(entry => ({
        eventId: eventId,
        contestantId: isStudioMode ? studioInfo?.id : contestant?.id,
        eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
        participantIds: entry.participantIds,
        calculatedFee: entry.fee,
        itemName: entry.itemName,
        choreographer: entry.choreographer,
        mastery: entry.mastery,
        itemStyle: entry.itemStyle,
        estimatedDuration: parseFloat(entry.estimatedDuration.replace(':', '.')) || 2,
        entryType: entry.entryType,
        musicFileUrl: entry.musicFileUrl || null,
        musicFileName: entry.musicFileName || null,
        videoFileUrl: entry.videoFileUrl || null,
        videoFileName: entry.videoFileName || null,
        videoExternalUrl: entry.videoExternalUrl || null,
        videoExternalType: entry.videoExternalType || null,
        performanceType: entry.performanceType
      }));

      const userName = isStudioMode ? 
        (studioInfo?.name || 'Studio Manager') : 
        (contestant?.name || 'Contestant');
      
      const userEmail = isStudioMode ? 
        (studioInfo?.email || 'studio@example.com') : 
        (contestant?.email || 'contestant@example.com');

      const eftPaymentData = {
        eventId: eventId,
        userId: isStudioMode ? studioInfo?.id : contestant?.id,
        userEmail: userEmail,
        userName: userName,
        eodsaId: isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId,
        amount: totalFee,
        invoiceNumber: eftInvoiceNumber.trim() || undefined,
        itemDescription: entries.map(e => `${e.performanceType}: ${e.itemName}`).join(', '),
        entries: batchEntryData,
        // NEW: Immediately submit entries as pending
        submitImmediately: true
      };

      // Submit EFT payment and entries directly
      const response = await fetch('/api/payments/eft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eftPaymentData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Close EFT modal and show success
          setShowEftModal(false);
          setEftInvoiceNumber('');
          setSubmissionResult({ entries: entries.length, totalFee });
          setShowSuccessModal(true);
          setEntries([]); // Clear entries after successful submission
          
          // Note: User will email chenique@elementscentral.com manually after payment
          
          success('EFT payment submitted successfully! Your entries are pending payment verification.');
        } else {
          throw new Error(result.error || 'Failed to submit EFT payment');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit EFT payment');
      }
    } catch (eftError: any) {
      console.error('EFT payment error:', eftError);
      error(`Failed to submit EFT payment: ${eftError.message}`);
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
  const feeCalculation = totalFeeCalculation;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 pb-safe-bottom">
      {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
      <style jsx global>{`
        @supports(padding: max(0px)) {
          .pb-safe-bottom {
            padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
          }
        }
        
        /* Fallback for older browsers */
        @media screen and (max-width: 640px) {
          .pb-safe-bottom {
            padding-bottom: 120px;
          }
        }
        
        /* iPhone specific adjustments */
        @media screen and (max-width: 414px) and (min-height: 800px) {
          .pb-safe-bottom {
            padding-bottom: 140px;
          }
        }
      `}</style>
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
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Performance Type Selection and Forms */}
          <div className="lg:col-span-2">
            {/* Performance Type Selection */}
            <div ref={typeSelectionRef} className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
              <h3 className="text-xl font-bold text-white mb-4">Add Performance Types</h3>

              {showHelp ? (
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-blue-200 text-sm">
                      <p className="font-semibold mb-2">Getting started</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Choose a performance type (Solo, Duet, Trio, Group)</li>
                        <li>Fill in the performance details and select participants</li>
                        <li>Click "Add Entry" to add it to your list</li>
                      </ol>
                      <p className="text-xs mt-2 opacity-80">Add as many entries as you want, then proceed to payment on the right.</p>
                    </div>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="text-blue-300 hover:text-white px-2"
                      aria-label="Close help"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowHelp(true)}
                  className="mb-3 inline-flex items-center text-xs text-blue-300 hover:text-white"
                  aria-label="Show how it works"
                >
                  <span className="mr-1">❓</span> How it works
                </button>
              )}
                                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {['Solo', 'Duet', 'Trio', 'Group'].map((type) => {
                  const isActive = showAddForm === type;
                  const existingSolos = existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length;
                  const sessionSolos = entries.filter(e => e.performanceType === 'Solo').length;
                  const totalSoloCount = existingSolos + sessionSolos;
                  const nextSoloFee = type === 'Solo' ? calculateFallbackEntryFee('Solo', 1) : 0;
                  
                  // Get currency symbol from event
                  const currency = event?.currency || 'ZAR';
                  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
                  const additionalFee = event?.soloAdditionalFee || 100;
                  
                  // For independent dancers (non-studio mode), only allow Solo
                  const isDisabled = !isStudioMode && type !== 'Solo';
                  
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && handleAddPerformanceType(type)}
                      disabled={isDisabled}
                      className={`p-4 sm:p-5 bg-gradient-to-r text-white rounded-xl transition-all duration-300 transform min-h-[120px] sm:min-h-[140px] ${
                        isDisabled 
                          ? 'from-gray-500 to-gray-600 cursor-not-allowed opacity-50' 
                          : isActive 
                            ? 'from-emerald-600 to-blue-600 ring-2 ring-emerald-400 animate-pulse hover:scale-[1.02] shadow-lg shadow-emerald-500/25' 
                            : 'from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-[1.02] shadow-lg hover:shadow-purple-500/25'
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
                               Next: {currencySymbol}{nextSoloFee}
                             </div>
                             {totalSoloCount === 0 && <div className="text-xs opacity-75">1st Solo</div>}
                             {totalSoloCount === 1 && <div className="text-xs opacity-75">2nd Solo (Package deal)</div>}
                             {totalSoloCount === 2 && <div className="text-xs opacity-75">3rd Solo (Package deal)</div>}
                             {totalSoloCount === 3 && <div className="text-xs opacity-75">4th Solo (Package deal)</div>}
                             {totalSoloCount === 4 && <div className="text-xs opacity-75">FREE!</div>}
                             {totalSoloCount > 4 && <div className="text-xs opacity-75">+{currencySymbol}{additionalFee}</div>}
                           </div>
                         )}
                         
                         {/* Dynamic pricing for others */}
                         {type !== 'Solo' && (
                           <div className="text-sm mb-2">
                             <div className="font-semibold text-emerald-200">
                               From {currencySymbol}{getStartingFee(type)}
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
               <div ref={entryFormRef} className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-8">
                 <div className="flex justify-between items-center mb-4">
                   <div>
                     <h3 className="text-xl font-semibold text-white">Add {showAddForm} Entry</h3>
                     {savedForms[showAddForm] && (
                       <p className="text-xs text-emerald-400 mt-1">✓ Form data restored</p>
                     )}
                   </div>
                  <button
                    ref={addEntryButtonRef}
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
                
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Item Name *</label>
                      <input
                        type="text"
                        value={currentForm.itemName}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Prevent empty strings with just spaces and enforce minimum length
                          if (value && value.trim().length > 0 && value.trim().length < 3) {
                            validationError('Item name must be at least 3 characters long.');
                          } else if (value && value.trim().length === 0) {
                            validationError('Item name cannot be empty or contain only spaces.');
                          }
                          setCurrentForm({...currentForm, itemName: value});
                        }}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        placeholder="Enter your performance title"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Choreographer *</label>
                      <input
                        type="text"
                        value={currentForm.choreographer}
                        onChange={(e) => {
                          const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
                          setCurrentForm({...currentForm, choreographer: cleanValue});
                        }}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        placeholder="Who choreographed this piece?"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Mastery Level</label>
                      <select
                        value={currentForm.mastery}
                        onChange={(e) => setCurrentForm({...currentForm, mastery: e.target.value})}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                      >
                        <option value="">Select mastery level</option>
                        {MASTERY_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">Item Style *</label>
                      <select
                        value={currentForm.itemStyle}
                        onChange={(e) => setCurrentForm({...currentForm, itemStyle: e.target.value})}
                        className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        required
                      >
                        <option value="">Select item style</option>
                        {ITEM_STYLES.map((style) => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        ⏱️ Duration Limit: {getMaxDurationDisplay(showAddForm || '')}
                        <span className="text-xs text-slate-400 block mt-1 font-normal">Maximum time allowed for {showAddForm} performances</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={getMaxDurationDisplay(showAddForm || '')}
                          readOnly
                          className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base"
                          title="Maximum duration automatically set based on performance type"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-slate-400">🔒</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        👥 Age Category
                        <span className="text-xs text-slate-400 block mt-1 font-normal">Calculated from participant ages</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={getCalculatedAgeCategory()}
                          readOnly
                          className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base"
                          title="Age category automatically determined by average age of participants"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="text-slate-400">🔒</span>
                        </div>
                      </div>
                      {currentForm.participantIds.length > 0 && availableDancers.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                          <div className="text-purple-300 text-sm">
                            <strong>🎭 Selected Participants:</strong> {
                              availableDancers
                                .filter(dancer => currentForm.participantIds.includes(dancer.id))
                                .map(dancer => `${dancer.name} (${dancer.age}y)`)
                                .join(', ')
                            }
                          </div>
                          <div className="text-purple-200 text-xs mt-2">
                            📊 Average Age: {(() => {
                              const selectedParticipants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id));
                              const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
                              return Math.round(totalAge / selectedParticipants.length);
                            })()} years → Category: <strong>{getCalculatedAgeCategory()}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PHASE 2: Live vs Virtual Entry Toggle */}
                  <div ref={entryTypeRef}>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">🎯 Entry Type *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setCurrentForm({...currentForm, entryType: 'live', videoExternalUrl: '', musicFileUrl: currentForm.entryType === 'virtual' ? '' : currentForm.musicFileUrl})}
                        className={`p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
                          currentForm.entryType === 'live'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/25'
                            : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-purple-400 hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-2 h-full">
                          <span className="text-3xl">🎵</span>
                          <span className="font-semibold text-base">Live Performance</span>
                          <span className="text-xs text-center opacity-90 leading-relaxed">
                            Upload music file for in-person performance
                          </span>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCurrentForm({...currentForm, entryType: 'virtual', musicFileUrl: '', musicFileName: ''})}
                        className={`p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
                          currentForm.entryType === 'virtual'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/25'
                            : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-purple-400 hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-2 h-full">
                          <span className="text-3xl">📹</span>
                          <span className="font-semibold text-base">Virtual Performance</span>
                          <span className="text-xs text-center opacity-90 leading-relaxed">
                            Submit video URL (YouTube/Vimeo)
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Conditional Fields Based on Entry Type */}
                  {currentForm.entryType === 'live' && (
                    <div ref={musicSectionRef}>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        🎵 Music File Upload (Optional)
                        <span className="text-xs text-slate-400 block mt-1 font-normal">You can upload now or later from your dashboard</span>
                      </label>
                      <MusicUpload
                        onUploadSuccess={(fileData) => {
                          setCurrentForm({
                            ...currentForm,
                            musicFileUrl: fileData.url,
                            musicFileName: fileData.originalFilename
                          });
                        }}
                        onUploadError={(error) => {
                          console.error('Music upload error:', error);
                          // You can add toast notification here if needed
                        }}
                        currentFile={currentForm.musicFileUrl ? {
                          url: currentForm.musicFileUrl,
                          filename: currentForm.musicFileName
                        } : null}
                      />
                    </div>
                  )}

                  {currentForm.entryType === 'virtual' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                          📱 Video Platform
                        </label>
                        <select
                          value={currentForm.videoExternalType}
                          onChange={(e) => setCurrentForm({...currentForm, videoExternalType: e.target.value as 'youtube' | 'vimeo' | 'other'})}
                          className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        >
                          <option value="youtube">📺 YouTube</option>
                          <option value="vimeo">🎬 Vimeo</option>
                          <option value="other">🌐 Other Platform</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                          🔗 Video URL (Optional)
                          <span className="text-xs text-slate-400 block mt-1 font-normal">
                            You can upload your video later through your dashboard
                          </span>
                        </label>
                        <input
                          type="url"
                          value={currentForm.videoExternalUrl}
                          onChange={(e) => setCurrentForm({...currentForm, videoExternalUrl: e.target.value})}
                          placeholder={
                            currentForm.videoExternalType === 'youtube' 
                              ? 'https://www.youtube.com/watch?v=...' 
                              : currentForm.videoExternalType === 'vimeo'
                              ? 'https://vimeo.com/...'
                              : 'https://...'
                          }
                          className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-base"
                        />
                        {currentForm.videoExternalUrl && (
                          <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                            <div className="text-green-300 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                              <div className="flex items-center space-x-2">
                                <span>✅</span>
                                <span className="font-medium">Video URL provided</span>
                              </div>
                              <a 
                                href={currentForm.videoExternalUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 bg-green-500/20 text-green-400 hover:text-green-300 hover:bg-green-500/30 rounded-lg transition-all duration-200 text-sm font-medium border border-green-500/30"
                              >
                                <span className="mr-1">🔗</span>
                                Preview Video
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                                 <div ref={participantsSectionRef} className="mt-4">
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
                     {isLoading && (
                       <div className="text-slate-400 text-sm flex items-center space-x-2">
                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                         <span>Loading your dancer information...</span>
                       </div>
                     )}
                     {!isLoading && availableDancers.length === 0 && (
                       <div className="text-slate-400 text-sm">
                         <p>No dancers available for EODSA ID: {eodsaId}</p>
                         <p className="text-xs mt-1">Check console for debug info</p>
                       </div>
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
                         (currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                          currentForm.participantIds.length > getParticipantLimits(showAddForm).max)
                           ? 'text-red-400'
                           : 'text-emerald-400'
                       }`}>
                         {(currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                           currentForm.participantIds.length > getParticipantLimits(showAddForm).max)
                           ? 'Invalid'
                           : (previewFee === 0 ? 'FREE' : `R${previewFee}`)}
                       </span>
                     </div>
                     {showAddForm === 'Solo' && !(
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                     ) && (
                       <div className="text-xs text-slate-400 mt-1">
                         {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) === 0 && '1st Solo: R400'}
                         {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) === 1 && '2nd Solo: R350 (Package: R750 total)'}
                         {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) === 2 && '3rd Solo: R250 (Package: R1000 total)'}
                         {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) === 3 && '4th Solo: R200 (Package: R1200 total)'}
                         {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) >= 4 && '5th Solo: FREE! (Additional: R100 each)'}
                       </div>
                     )}
                     {(currentForm.participantIds.length > 0 && (
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                     )) && (
                       <div className="text-xs text-red-400 mt-1">
                         Fix participant selection to see fee
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
                   <button
                     onClick={() => {
                       // Save current form state before closing
                       setSavedForms(prev => ({
                         ...prev,
                         [showAddForm]: currentForm
                       }));
                       setShowAddForm(null);
                     }}
                     className="w-full sm:w-auto px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-500 transition-all duration-300 font-medium text-base min-h-[48px] sm:min-h-auto order-2 sm:order-1"
                   >
                     Cancel
                   </button>
                   <button
                     ref={addEntryButtonRef}
                     onClick={handleSaveEntry}
                     disabled={
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                     }
                     className={`w-full sm:w-auto px-6 py-3 text-white rounded-xl transition-all duration-300 font-semibold text-base min-h-[48px] sm:min-h-auto order-1 sm:order-2 ${
                       !currentForm.itemName || 
                       currentForm.participantIds.length === 0 ||
                       currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
                       currentForm.participantIds.length > getParticipantLimits(showAddForm).max
                         ? 'bg-slate-500 cursor-not-allowed'
                         : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-105 shadow-lg hover:shadow-purple-500/25'
                     }`}
                   >
                     {!currentForm.itemName ? '📝 Enter Item Name' :
                      currentForm.participantIds.length === 0 ? '👥 Select Participants' :
                      currentForm.participantIds.length < getParticipantLimits(showAddForm).min ? 
                        `➕ Need ${getParticipantLimits(showAddForm).min - currentForm.participantIds.length} More` :
                      currentForm.participantIds.length > getParticipantLimits(showAddForm).max ? 
                        `➖ Remove ${currentForm.participantIds.length - getParticipantLimits(showAddForm).max}` :
                      `✅ Add Entry ${previewFee > 0 ? `(R${previewFee})` : ''}`}
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
                 {(existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length) > 0 && (
                   <div className="text-xs text-slate-400 bg-slate-700/30 p-2 rounded">
                     <div className="flex justify-between">
                       <span>Solo entries:</span>
                       <span>{existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length + entries.filter(e => e.performanceType === 'Solo').length}</span>
                     </div>
                     {entries.filter(e => e.performanceType === 'Solo').length >= 2 && (
                       <div className="text-emerald-400 mt-1">
                         ✓ Solo package pricing applied
                       </div>
                     )}
                     {entries.filter(e => e.performanceType === 'Solo').length >= 5 && (
                       <div className="text-emerald-400">
                         ✓ 5th solo entry is FREE! (Additional solos R100 each)
                       </div>
                     )}
                   </div>
                 )}
                 
                 {isCalculatingFee ? (
                   <div className="flex items-center justify-center py-4">
                     <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mr-3"></div>
                     <span className="text-emerald-300">Calculating fees...</span>
                   </div>
                 ) : (
                   <>
                     <div className="flex justify-between">
                       <span>Performance Fees:</span>
                       <span>R{feeCalculation.performanceFee}</span>
                     </div>
                     <div className="flex justify-between">
                       <span>Registration Fees:</span>
                       <span>R{feeCalculation.registrationFee}</span>
                     </div>
                   </>
                 )}
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
                ref={proceedToPaymentRef}
                onClick={handleProceedToPayment}
                disabled={entries.length === 0 || isSubmitting || isCalculatingFee}
                className={`w-full py-4 sm:py-3 text-white rounded-lg font-semibold transition-all duration-300 text-lg sm:text-base min-h-[56px] sm:min-h-auto ${
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
                ) : isCalculatingFee ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Calculating Fee...</span>
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
        {/* Guided Tour Overlay */}
        {isTourActive && (
          <TourOverlay
            step={tourStep}
            getTargetRect={() => {
              let target: HTMLElement | null = null;
              if (tourStep === 1) target = typeSelectionRef.current; // Choose type
              else if (tourStep === 2) target = entryFormRef.current; // Fill details
              else if (tourStep === 3) target = entryTypeRef.current; // Live/Virtual section
              else if (tourStep === 4) target = addEntryButtonRef.current; // Add Entry
              else if (tourStep === 5) target = proceedToPaymentRef.current; // Payment
              if (!target) return null;
              const rect = target.getBoundingClientRect();
              return {
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              };
            }}
            onNext={() => setTourStep((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : prev === 3 ? 4 : prev === 4 ? 5 : 5))}
            onBack={() => setTourStep((prev) => (prev === 5 ? 4 : prev === 4 ? 3 : prev === 3 ? 2 : 1))}
            onClose={() => setIsTourActive(false)}
          />
        )}
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
              
              {/* Avalon Blessing */}
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-lg">
                <p className="text-purple-300 text-sm italic font-medium">
                  ✨ "May the Mists of Avalon bring luck upon you" ✨
                </p>
              </div>
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
              {selectedPaymentMethod === 'eft' ? (
                <ul className="text-sm text-slate-300 space-y-2">
                  <li>• ✅ Your entries are now submitted as "pending payment verification"</li>
                  <li>• 🏦 Make your EFT payment to Elements of Dance (FNB: 63122779094)</li>
                  <li>• 📧 <strong className="text-emerald-300">After making payment, email chenique@elementscentral.com with your payment reference for entry approval</strong></li>
                  <li>• 📊 Check your dashboard for updates</li>
                </ul>
              ) : (
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Payment will be processed automatically</li>
                  <li>• Confirmation email will be sent to you</li>
                  <li>• Check your dashboard for updates</li>
                </ul>
              )}
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
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      // Clear entries and reset form
                      setEntries([]);
                      setSubmissionResult(null);
                    }}
                    className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                  >
                    Enter More Events
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => router.push('/studio-portal')}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 font-semibold"
                    >
                      Studio Portal
                    </button>
                    <button
                      onClick={() => router.push(`/`)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 font-semibold"
                    >
                      Main Portal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Selection Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">💳 Select Payment Method</h2>
              <p className="text-slate-300">Choose how you'd like to pay for your competition entries</p>
              
              <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="text-slate-300 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Total Amount:</span>
                    <span className="text-emerald-400 font-semibold text-lg">R{totalFeeCalculation.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entries:</span>
                    <span>{entries.length} performance{entries.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* PayFast Option */}
              <button
                onClick={() => handlePaymentMethodSelection('payfast')}
                className="w-full p-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-blue-500/25"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-3xl">💳</div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">PayFast - Instant Payment</h3>
                    <p className="text-sm opacity-90">Pay instantly with credit card or bank transfer</p>
                    <p className="text-xs opacity-75 mt-1">✓ Instant approval • ✓ Secure payment gateway</p>
                  </div>
                </div>
              </button>

              {/* EFT Option */}
              <button
                onClick={() => handlePaymentMethodSelection('eft')}
                className="w-full p-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-green-500/25"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-3xl">🏦</div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">EFT - Bank Transfer</h3>
                    <p className="text-sm opacity-90">Pay via EFT using the banking details provided.</p>
                    <p className="text-xs opacity-75 mt-1">⏳ Entries pending verification • 📧 You email chenique after payment</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EFT Payment Modal - Mobile & PC Optimized */}
      {showEftModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-y-auto">
          {/* Mobile: Full height, PC: Centered with max height and scrolling */}
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:w-full relative sm:my-4">
            <div className="bg-slate-800/98 backdrop-blur-xl shadow-2xl border-t sm:border border-slate-700/50 w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl overflow-y-auto scrollbar-hide flex flex-col">
              
              {/* Fixed Header */}
              <div className="sticky top-0 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 p-4 sm:p-6 z-10">
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">🏦 EFT Payment Details</h2>
                  <p className="text-slate-300 text-sm sm:text-base">Make your payment using the banking details below</p>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 p-4 sm:p-6 pb-6 space-y-6 min-h-0">
                
                {/* Banking Details - Mobile Optimized */}
                <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 rounded-xl p-4 sm:p-6">
                  <h3 className="text-green-300 font-semibold mb-4 flex items-center text-lg">
                    <span className="text-2xl mr-2">🏦</span>
                    Banking Details
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-800/40 rounded-lg p-3">
                      <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Account Name</div>
                      <div className="text-white font-semibold text-base">Elements of Dance</div>
                    </div>
                    
                    <div className="bg-slate-800/40 rounded-lg p-3">
                      <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Bank</div>
                      <div className="text-white font-semibold text-base">FNB</div>
                    </div>
                    
                    <div className="bg-slate-800/40 rounded-lg p-3">
                      <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Account Number</div>
                      <div className="text-white font-mono font-bold text-lg bg-slate-700/60 px-3 py-2 rounded-lg border border-slate-600/50">
                        63122779094
                      </div>
                    </div>
                    
                    {/* Reference removed from EFT modal */}
                    
                    <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-lg p-3">
                      <div className="text-emerald-300 text-xs uppercase tracking-wide mb-1">Amount</div>
                      <div className="text-emerald-200 font-bold text-xl">R{totalFeeCalculation.total}</div>
                    </div>
                  </div>
                </div>

                {/* Payment Reference Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-300">
                    📋 Payment Reference (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={eftInvoiceNumber}
                      onChange={(e) => setEftInvoiceNumber(e.target.value)}
                      placeholder="Reference or leave blank"
                      className="flex-1 p-3 sm:p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base"
                    />
                    <button
                      onClick={() => setEftInvoiceNumber('')}
                      className="px-3 sm:px-4 py-2 sm:py-3 bg-slate-700/70 hover:bg-slate-600 text-slate-200 rounded-xl text-sm"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This is optional and helps us match your EFT.
                  </p>
                </div>

                {/* Payment Process Notice - Improved Design */}
                <div className="bg-gradient-to-r from-blue-900/20 to-emerald-900/20 border border-blue-500/30 rounded-xl p-5">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-blue-400 text-2xl">📋</span>
                      <h4 className="text-blue-300 font-bold text-lg">Next Steps</h4>
                    </div>
                    
                    <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <span className="text-emerald-400 text-xl mt-0.5">📧</span>
                        <div>
                          <h5 className="text-emerald-300 font-semibold mb-2">After Payment</h5>
                          <p className="text-emerald-200 text-sm leading-relaxed">
                            Email your <span className="font-semibold">proof of payment + reference</span> to:
                          </p>
                          <div className="mt-2 p-3 bg-emerald-800/40 rounded-lg">
                            <a 
                              href="mailto:chenique@elementscentral.com" 
                              className="text-emerald-100 font-semibold hover:text-white transition-colors"
                            >
                              chenique@elementscentral.com
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer with Buttons */}
              <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => {
                      setShowEftModal(false);
                      setEftInvoiceNumber('');
                    }}
                    className="w-full sm:flex-1 px-4 py-4 bg-slate-600 text-white rounded-xl hover:bg-slate-500 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEftPayment}
                    disabled={isSubmitting}
                    className={`w-full sm:flex-1 px-4 py-4 rounded-xl font-semibold transition-all duration-300 ${
                      isSubmitting
                        ? 'bg-slate-500 cursor-not-allowed text-slate-300'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white transform hover:scale-[1.02] shadow-lg hover:shadow-green-500/25'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      'Submit Entry & Payment Info'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 