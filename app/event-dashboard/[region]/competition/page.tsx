'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, MASTERY_LEVELS, ITEM_STYLES, Event } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';
import EventPricingPanel from '@/app/components/EventPricingPanel';
import { useToast } from '@/components/ui/simple-toast';
import MusicUpload from '@/components/MusicUpload';
import { calculateEventPricing, getFixedEntryPrice, getNetPerformanceLineParts, resolveEventRegistrationFee } from '@/lib/event-pricing';
// Registration fee checking moved to API calls
/** Solo counts per dancer already on file for this event (every-Nth-solo sequence). */
function buildExistingSoloCountsFromDb(dbEntries: any[]): Record<string, number> {
 const counts: Record<string, number> = {};
 for (const dbEntry of dbEntries) {
 if ((dbEntry.performanceType || '').toLowerCase() !== 'solo') continue;
 let ids: string[] = [];
 if (Array.isArray(dbEntry.participantIds)) ids = dbEntry.participantIds;
 else if (typeof dbEntry.participantIds === 'string') {
 try {
 ids = JSON.parse(dbEntry.participantIds);
 } catch {
 ids = dbEntry.participantIds ? [dbEntry.participantIds] : [];
 }
 }
 const key = ids[0] || dbEntry.eodsaId;
 if (!key) continue;
 counts[key] = (counts[key] || 0) + 1;
 }
 return counts;
}

/** IDs already linked to this event (prior entries) — used for cart registration display only. */
function buildAlreadyRegisteredParticipantSet(
 existingDbEntries: any[],
 availableDancers: { id?: string; eodsaId?: string }[]
): Set<string> {
 const registered = new Set<string>();
 const addKey = (key: string | undefined | null) => {
 if (key) registered.add(String(key));
 };

 for (const dbEntry of existingDbEntries) {
 let ids: string[] = [];
 if (Array.isArray(dbEntry.participantIds)) ids = dbEntry.participantIds;
 else if (typeof dbEntry.participantIds === 'string') {
 try {
 ids = JSON.parse(dbEntry.participantIds);
 } catch {
 ids = dbEntry.participantIds ? [dbEntry.participantIds] : [];
 }
 }
 for (const id of ids) {
 addKey(id);
 const dancer = availableDancers.find((d) => d.id === id || d.eodsaId === id);
 addKey(dancer?.id);
 addKey(dancer?.eodsaId);
 }
 addKey(dbEntry.eodsaId);
 }
 return registered;
}

function getRegistrationUiBreakdown(
 cartEntries: { participantIds?: string[] }[],
 alreadyRegistered: Set<string>,
 availableDancers: { id?: string; eodsaId?: string }[]
) {
 const cartIds = Array.from(new Set(cartEntries.flatMap((e) => e.participantIds || []).filter(Boolean)));
 let participantsNeedingReg = 0;
 let participantsAlreadyRegistered = 0;

 for (const pid of cartIds) {
 const dancer = availableDancers.find((d) => d.id === pid || d.eodsaId === pid);
 const keys = [pid, dancer?.id, dancer?.eodsaId].filter(Boolean) as string[];
 if (keys.some((k) => alreadyRegistered.has(k))) {
 participantsAlreadyRegistered++;
 } else {
 participantsNeedingReg++;
 }
 }

 return { participantsNeedingReg, participantsAlreadyRegistered, cartParticipantCount: cartIds.length };
}

function formatOrdinal(n: number): string {
 const v = n % 100;
 if (v >= 11 && v <= 13) return `${n}th`;
 const suffix = ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
 return `${n}${suffix}`;
}

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
 className="absolute rounded-xl ring-4 ring-blue-400/70 shadow-2xl" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
 />
 <div
 className="absolute max-w-xs w-[300px] p-4 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 pointer-events-auto" style={{ top: cardPos.top, left: cardPos.left }}
 >
 <div className="text-sm font-semibold mb-2 text-slate-800"> {step === 1 && 'Step 1: Choose a performance type'}
 {step === 2 && 'Step 2: Fill up the performance details'}
 {step === 3 && 'Step 3: Choose Live or Virtual'}
 {step === 4 && 'Step 4: Add Entry'}
 {step === 5 && 'Step 5: Proceed to payment'}
 </div>
 <div className="text-sm text-slate-700 mb-3"> {step === 1 && 'Pick Solo, Duet, Trio or Group to start.'}
 {step === 2 && 'Complete the fields above. Music is optional for Live; video URL is optional for Virtual.'}
 {step === 3 && 'Pick Live (music) or Virtual (video).'}
 {step === 4 && 'Click Add Entry. To add another, go back to Step 1 and repeat.'}
 {step === 5 && 'If you are done with entries, continue to payment here.'}
 </div>
 <div className="flex justify-between items-center">
 <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-sm">Skip</button>
 <div className="space-x-2"> {step > 1 && (
 <button onClick={onBack} className="px-3 py-1 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Back</button> )}
 <button
 onClick={() => {
 if (step < 5) {
 onNext();
 } else {
 onClose();
 }
 }}
 className="px-3 py-1 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-500" >
 {step < 5 ? 'Next' : 'Done'}
 </button>
 </div>
 </div>
 </div>
 </div> );
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
 suitabilityStatement?: string;
 // Fee validation properties (added during validation)
 entryFee?: number;
 registrationFee?: number;
 validatedFee?: number;
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
 const [event, setEvent] = useState<any>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [entries, setEntries] = useState<PerformanceEntry[]>([]);
 const [existingDbEntries, setExistingDbEntries] = useState<any[]>([]);
 const [showAddForm, setShowAddForm] = useState<string | null>(null);
 const [registrationUi, setRegistrationUi] = useState({
 participantsNeedingReg: 0,
 participantsAlreadyRegistered: 0,
 cartParticipantCount: 0,
 });
 const [totalFeeCalculation, setTotalFeeCalculation] = useState<{
 subtotal: number;
 discount: number;
 performanceFee: number;
 registrationFee: number;
 total: number;
 }>({ subtotal: 0, discount: 0, performanceFee: 0, registrationFee: 0, total: 0 });
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
 videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other',
 suitabilityStatement: ''
 });
 const [savedForms, setSavedForms] = useState<Record<string, typeof currentForm>>({});
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [showSuccessModal, setShowSuccessModal] = useState(false);
 const [submissionResult, setSubmissionResult] = useState<{entries: number, totalFee: number} | null>(null);
 const [videoUrlError, setVideoUrlError] = useState<string>('');
 const [isValidatingVideoUrl, setIsValidatingVideoUrl] = useState(false);
 const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
 const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'payfast' | 'eft' | null>(null);
 const [showEftModal, setShowEftModal] = useState(false);
 const [eftInvoiceNumber, setEftInvoiceNumber] = useState('');
 const [showHelp, setShowHelp] = useState(true);
 const [qualificationBlocked, setQualificationBlocked] = useState(false);
 const [qualificationError, setQualificationError] = useState<string | null>(null);
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
 loadStudioEventEntries(studioId, eventId);
 }
 loadEvent(eventId);
 }
 }, [region, eodsaId, studioId, eventId]);

 // Check qualification when contestant loads and event is already loaded
 useEffect(() => {
 if (contestant && contestant.dancers && contestant.dancers.length > 0 && event && eventId) {
 checkQualificationForEvent(eventId, event);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [contestant, event, eventId]);

 // Auto-select current dancer when opening Solo form for independent dancers
 useEffect(() => {
 if (showAddForm === 'Solo' && !isStudioMode && contestant && contestant.type === 'private') {
 if (contestant.dancers.length > 0 && currentForm.participantIds.length === 0) {
 console.log(` Auto-selecting dancer for Solo form: ${contestant.dancers[0].name}`);
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
 console.log(` Loading contestant for competition entry: ${id}`);
 
 // Try unified system first (new dancers)
 console.log(` Fetching: /api/dancers/by-eodsa-id/${id}`);
 const unifiedResponse = await fetch(`/api/dancers/by-eodsa-id/${id}`);
 console.log(`📡 Unified response status: ${unifiedResponse.status}`);
 
 if (unifiedResponse.ok) {
 const unifiedData = await unifiedResponse.json();
 console.log(` Unified response data:`, unifiedData);
 
 if (unifiedData.success && unifiedData.dancer) {
 const dancer = unifiedData.dancer;
 const isStudioLinked = dancer.studioAssociation !== null;
 
 console.log(` Loaded dancer: ${dancer.name}, Studio linked: ${isStudioLinked}`);
 
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
 
 console.log(` Setting available dancers:`, [availableDancerData]);
 setAvailableDancers([availableDancerData]);
 
 // Auto-select the dancer as participant for independent dancers
 if (!isStudioLinked) {
 console.log(` Auto-selecting independent dancer: ${dancer.name}`);
 setCurrentForm(prev => ({
 ...prev,
 participantIds: [dancer.id]
 }));
 }
 setIsLoading(false);
 return;
 } else {
 console.log(` Unified API returned but no dancer found: ${JSON.stringify(unifiedData)}`);
 }
 } else {
 console.log(` Unified API failed with status ${unifiedResponse.status}`);
 const errorText = await unifiedResponse.text();
 console.log(` Unified API error response:`, errorText);
 }
 
 // Fallback to legacy system (contestants)
 console.log(`🔄 Trying legacy system for: ${id}`);
 console.log(` Fetching: /api/contestants/by-eodsa-id/${id}`);
 const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
 console.log(`📡 Legacy response status: ${legacyResponse.status}`);
 
 if (legacyResponse.ok) {
 const legacyData = await legacyResponse.json();
 console.log(` Loaded legacy contestant:`, legacyData);
 
 // For independent dancers, if no dancers exist, create dancer from contestant data
 if (legacyData.type === 'private' && (!legacyData.dancers || legacyData.dancers.length === 0)) {
 console.log(` Creating dancer entry for independent contestant: ${legacyData.name}`);
 
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
 console.log(` Created dancer entry:`, dancerEntry);
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
 console.log(` Setting legacy available dancers:`, mappedDancers);
 setAvailableDancers(mappedDancers);
 
 // Auto-select for private contestants
 if (legacyData.type === 'private' && legacyData.dancers.length > 0) {
 console.log(` Auto-selecting legacy private dancer: ${legacyData.dancers[0].name}`);
 setCurrentForm(prev => ({
 ...prev,
 participantIds: [legacyData.dancers[0].id]
 }));
 }
 } else {
 console.log(` Legacy contestant has no dancers: ${JSON.stringify(legacyData)}`);
 }
 } else {
 console.log(` Legacy API failed with status ${legacyResponse.status}`);
 const errorText = await legacyResponse.text();
 console.log(` Legacy API error response:`, errorText);
 }
 
 console.log(` No dancer found in either system for EODSA ID: ${id}`);
 
 } catch (error) {
 console.error(' Failed to load contestant:', error);
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

 const response = await fetch(`/api/studios/dancers-new?studioId=${id}&ageMode=competition`);
 const data = await response.json();
 
 if (data.success) {
 setStudioInfo(parsedSession);
 setAvailableDancers(data.dancers);
 }
 } catch (error) {
 console.error('Failed to load studio data:', error);
 }
 };

 const loadStudioEventEntries = async (studioId: string, eventId: string) => {
 if (!studioId || !eventId) return;

 try {
 const response = await fetch(`/api/studios/entries?studioId=${studioId}`);
 if (response.ok) {
 const data = await response.json();
 if (data.success && Array.isArray(data.entries)) {
 const eventEntries = data.entries.filter((entry: any) => entry.eventId === eventId);
 setExistingDbEntries(eventEntries);
 console.log(` Studio: ${eventEntries.length} existing entries for this event`);
 }
 }
 } catch (error) {
 console.error('Error loading studio event entries:', error);
 setExistingDbEntries([]);
 }
 };

 const loadExistingEntries = async (eodsaId: string, eventId: string) => {
 if (!eodsaId || !eventId) return;
 
 try {
 console.log(` Loading existing entries for dancer ${eodsaId} in event ${eventId}`);
 const response = await fetch(`/api/contestants/entries?eodsaId=${eodsaId}&debug=true`);
 if (response.ok) {
 const data = await response.json();
 if (data.success) {
 // Filter entries for this specific event
 const eventEntries = data.entries.filter((entry: any) => entry.eventId === eventId);
 setExistingDbEntries(eventEntries);
 console.log(` Found ${eventEntries.length} existing entries for this event`);
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
 
 // Check qualification if contestant is loaded
 if (selectedEvent && contestant && contestant.dancers && contestant.dancers.length > 0) {
 await checkQualificationForEvent(id, selectedEvent);
 }
 }
 }
 } catch (error) {
 console.error('Failed to load event:', error);
 } finally {
 setIsLoading(false);
 }
 };

 // Check qualification for an event
 const checkQualificationForEvent = async (eventId: string, eventData: Event) => {
 if (!contestant || !contestant.dancers || contestant.dancers.length === 0) {
 return;
 }

 const primaryDancerId = contestant.dancers[0].id;

 try {
 const response = await fetch(`/api/events/${eventId}/check-qualification?dancerId=${primaryDancerId}`);
 const data = await response.json();

 if (data.success) {
 if (!data.qualified) {
 setQualificationBlocked(true);
 setQualificationError(data.reason || 'You are not qualified to enter this event.');
 error(data.reason || 'You are not qualified to enter this event.');
 } else {
 setQualificationBlocked(false);
 setQualificationError(null);
 }
 }
 } catch (error) {
 console.error('Error checking qualification:', error);
 // On error, allow entry (server-side validation will catch it)
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
 const limits = getParticipantLimits(performanceType);
 return getFixedEntryPrice(
 performanceType,
 {
 soloPrice: event.soloPrice,
 duetPrice: event.duetPrice,
 groupPrice: event.groupPrice,
 },
 limits.min
 );
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
 const regFee = resolveEventRegistrationFee(event as any);
 const base = getStartingFee(performanceType);
 if (performanceType === 'Duet' || performanceType === 'Trio') {
 return `${symbol}${base} per entry. Registration ${symbol}${regFee} per dancer (once per event).`;
 }
 return `${symbol}${base} per entry. Registration ${symbol}${regFee} per dancer (once per event).`;
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

 const selectedParticipants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id)
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
 if ((event as any)?.eventType === 'AUDITION_EVENT') {
 return (event as any).auditionPaymentType === 'paid' ? Number((event as any).auditionFlatFee) || 0 : 0;
 }
 if (event) {
 const cfg = {
 soloPrice: (event as any).soloPrice,
 duetPrice: (event as any).duetPrice,
 groupPrice: (event as any).groupPrice,
 discountEnabled: (event as any).discountEnabled,
 discountMinEntries: (event as any).discountMinEntries,
 discountAmount: (event as any).discountAmount,
 registrationFee: resolveEventRegistrationFee(event as any)
 };
 if ((performanceType || '').toLowerCase() === 'solo' && participantIds.length >= 1) {
 const pid = participantIds[0];
 const dbSolos = existingDbEntries.filter((entry) => {
 if ((entry.performanceType || '').toLowerCase() !== 'solo') return false;
 let entryParticipants: string[] = [];
 if (Array.isArray(entry.participantIds)) entryParticipants = entry.participantIds;
 else if (typeof entry.participantIds === 'string') {
 try {
 entryParticipants = JSON.parse(entry.participantIds);
 } catch {
 entryParticipants = entry.participantIds ? [entry.participantIds] : [];
 }
 }
 return entryParticipants.includes(pid);
 }).length;
 const sessionSolos = entries.filter(
 (e) => e.performanceType === 'Solo' &&
 e.participantIds?.length === 1 &&
 e.participantIds[0] === pid
 ).length;
 const soloOrdinal = dbSolos + sessionSolos + 1;
 const parts = getNetPerformanceLineParts(
 { performanceType: 'Solo', participantIds, eodsaId: pid },
 cfg,
 soloOrdinal
 );
 return parts.net;
 }
 return getFixedEntryPrice(performanceType, cfg, participantIds.length);
 }
 try {
 if (!currentForm.mastery) {
 console.warn('No mastery level selected, using default performance fee calculation');
 return calculateFallbackEntryFee(performanceType, participantIds.length);
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

 const sessionSoloCount = entries.filter(entry => entry.performanceType === 'Solo' && 
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

 // For solo entries, use API to get cumulative package pricing with deduction
 if (capitalizedPerformanceType === 'Solo' && eventId && participantIds.length === 1) {
 try {
 const response = await fetch('/api/eodsa-fees', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 masteryLevel: currentForm.mastery || 'Water (Competitive)',
 performanceType: 'Solo',
 participantIds: participantIds,
 soloCount: soloCount,
 includeRegistration: false, // Only get performance fee, not registration
 eventId: eventId
 })
 });
 
 if (response.ok) {
 const data = await response.json();
 const fee = data.fees.performanceFee || 0;
 console.log('SOLO_DEBUG: calculateEntryFee:apiResult', { fee, soloCount, type: capitalizedPerformanceType });
 return fee;
 }
 } catch (error) {
 console.error('Error fetching cumulative solo fee from API:', error);
 }
 }
 
 // Fallback: Compute performance-only fee locally using event configuration
 let fee = 0;
 if (capitalizedPerformanceType === 'Solo') {
 // For solo entries, use cumulative package pricing
 // solo1Fee, solo2Fee, solo3Fee are CUMULATIVE package totals
 const solo1Package = event?.solo1Fee || 550; // 1 Solo Package total
 const solo2Package = event?.solo2Fee || 942; // 2 Solos Package total
 const solo3Package = event?.solo3Fee || 1256; // 3 Solos Package total
 const additionalSoloFee = event?.soloAdditionalFee || 349;
 
 // Count existing paid solos for this dancer
 const existingPaidSolos = existingDbEntries.filter(entry => {
 if (entry.performanceType !== 'Solo' || entry.paymentStatus !== 'paid') return false;
 if (entry.participantIds && entry.participantIds.length === 1) {
 return entry.participantIds[0] === participantIds[0];
 }
 return false;
 }).length;
 
 // Count session solos (entries being added in this session but not yet saved)
 const sessionSoloCount = entries.filter(entry => entry.performanceType === 'Solo' && 
 entry.participantIds.length === 1 && 
 entry.participantIds[0] === participantIds[0]
 ).length;
 
 const totalSoloCount = existingPaidSolos + sessionSoloCount + 1;
 
 // Calculate what package total they should have paid for existing paid solos
 let packageTotalForPaidSolos = 0;
 if (existingPaidSolos === 0) {
 packageTotalForPaidSolos = 0;
 } else if (existingPaidSolos === 1) {
 packageTotalForPaidSolos = solo1Package;
 } else if (existingPaidSolos === 2) {
 packageTotalForPaidSolos = solo2Package;
 } else if (existingPaidSolos === 3) {
 packageTotalForPaidSolos = solo3Package;
 } else {
 packageTotalForPaidSolos = solo3Package + ((existingPaidSolos - 3) * additionalSoloFee);
 }
 
 // Calculate what package total they should pay for the new total
 let packageTotalForNewCount = 0;
 if (totalSoloCount === 1) {
 packageTotalForNewCount = solo1Package;
 } else if (totalSoloCount === 2) {
 packageTotalForNewCount = solo2Package;
 } else if (totalSoloCount === 3) {
 packageTotalForNewCount = solo3Package;
 } else {
 packageTotalForNewCount = solo3Package + ((totalSoloCount - 3) * additionalSoloFee);
 }
 
 // Charge the difference (new package total - what they should have already paid)
 fee = Math.max(0, packageTotalForNewCount - packageTotalForPaidSolos);
 
 console.log('SOLO_DEBUG: calculateEntryFee:cumulative', { 
 existingPaidSolos, 
 sessionSoloCount, 
 totalSoloCount,
 packageTotalForPaidSolos,
 packageTotalForNewCount,
 fee 
 });
 } else if (capitalizedPerformanceType === 'Duet' || capitalizedPerformanceType === 'Trio') {
 fee = (event?.duoTrioFeePerDancer || 280) * participantIds.length;
 } else if (capitalizedPerformanceType === 'Group') {
 const perPerson = participantIds.length <= 9 
 ? (event?.groupFeePerDancer || 220)
 : (event?.largeGroupFeePerDancer || 190);
 fee = perPerson * participantIds.length;
 }
 console.log('SOLO_DEBUG: calculateEntryFee:feeResult', { fee, soloCount, type: capitalizedPerformanceType });
 return fee;
 } catch (error) {
 console.error('Error in smart fee calculation, falling back to basic calculation:', error);
 return calculateFallbackEntryFee(performanceType, participantIds.length);
 }
 };

 // Fallback fee calculation for when smart calculation fails
 const calculateFallbackEntryFee = (performanceType: string, participantCount: number) => {
 return getFixedEntryPrice(
 performanceType,
 {
 soloPrice: event?.soloPrice,
 duetPrice: event?.duetPrice,
 groupPrice: event?.groupPrice,
 },
 participantCount
 );
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
 videoExternalType: 'youtube' as 'youtube' | 'vimeo' | 'other',
 suitabilityStatement: ''
 });
 }
 };

 // Convert Google Drive URL from /view to /preview format
 const convertGoogleDriveUrl = (url: string): string => {
 if (!url || !url.includes('drive.google.com')) return url;
 
 // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
 // Pattern 2: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 const fileIdPattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
 const match = url.match(fileIdPattern);
 
 if (match && match[1]) {
 const fileId = match[1];
 return `https://drive.google.com/file/d/${fileId}/preview`;
 }
 
 // Pattern 3: https://drive.google.com/open?id=FILE_ID
 const openPattern = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
 const openMatch = url.match(openPattern);
 
 if (openMatch && openMatch[1]) {
 const fileId = openMatch[1];
 return `https://drive.google.com/file/d/${fileId}/preview`;
 }
 
 // Already in preview format or unrecognized format
 return url;
 };

 // Validate Google Drive URL is publicly accessible
 const validateGoogleDriveUrl = async (url: string): Promise<{ isValid: boolean; error?: string; previewUrl?: string }> => {
 if (!url || !url.includes('drive.google.com')) {
 return { isValid: true }; // Not a Google Drive URL, skip validation
 }

 try {
 const previewUrl = convertGoogleDriveUrl(url);
 
 // Use API endpoint to validate server-side (more reliable)
 const response = await fetch('/api/validate/google-drive-url', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ url }),
 });

 const data = await response.json();

 if (data.success) {
 if (data.isValid) {
 return { isValid: true, previewUrl: data.previewUrl };
 } else {
 return { 
 isValid: false, 
 error: data.error || 'This Drive link is private. Please set it to "Anyone with the link" before saving.',
 previewUrl: data.previewUrl
 };
 }
 } else {
 // API error - allow but show warning
 return { 
 isValid: true, 
 previewUrl,
 error: data.message || 'Could not verify access. Please ensure the file is shared with "Anyone with the link".'
 };
 }
 } catch (error) {
 console.error('Error validating Google Drive URL:', error);
 return { 
 isValid: true, 
 previewUrl: convertGoogleDriveUrl(url),
 error: 'Could not verify access. Please ensure the file is shared with "Anyone with the link".'
 };
 }
 };

 const handleVideoUrlChange = async (url: string) => {
 setVideoUrlError('');
 
 // Auto-convert Google Drive URLs immediately
 let processedUrl = url;
 if (url.includes('drive.google.com')) {
 processedUrl = convertGoogleDriveUrl(url);
 // Always update with converted URL (even if same, ensures it's in preview format)
 setCurrentForm({ ...currentForm, videoExternalUrl: processedUrl });
 
 // Show conversion message if URL was changed
 if (processedUrl !== url && url.includes('/view')) {
 // URL was converted - validation will happen on blur
 }
 } else {
 setCurrentForm({ ...currentForm, videoExternalUrl: url });
 }
 
 // Don't validate on every keystroke - only validate on blur or when saving
 // Validation happens on blur and before save
 };

 const handleSaveEntry = async () => {
 if (!showAddForm || currentForm.participantIds.length === 0 || !currentForm.itemName) {
 return;
 }

 if (!currentForm.itemStyle?.trim()) {
 alert('Please select an Item Style before adding this entry.');
 return;
 }

 if (!currentForm.mastery?.trim()) {
 alert('Please select a Mastery Level before adding this entry.');
 return;
 }

 if ((event as any)?.eventType === 'AUDITION_EVENT') {
 if (!currentForm.suitabilityStatement?.trim()) {
 alert('Please explain why you would be suitable for this opportunity.');
 return;
 }
 if (!currentForm.videoExternalUrl?.trim()) {
 alert('A video link is required for this audition.');
 return;
 }
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

 // Validate Google Drive URL if present
 if (currentForm.videoExternalUrl && currentForm.videoExternalUrl.includes('drive.google.com')) {
 setIsValidatingVideoUrl(true);
 const validation = await validateGoogleDriveUrl(currentForm.videoExternalUrl);
 setIsValidatingVideoUrl(false);
 
 if (!validation.isValid && validation.error) {
 setVideoUrlError(validation.error);
 return; // Don't save if validation fails
 }
 }

 // Note: Media uploads are optional during initial entry creation
 // Users can upload music (live) or video (virtual) later through their dashboard

 const participants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id)
 );

 const fee = await calculateEntryFee(showAddForm, currentForm.participantIds);

 const newEntry: PerformanceEntry = {
 id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
 performanceType: showAddForm as 'Solo' | 'Duet' | 'Trio' | 'Group',
 ...currentForm,
 entryType: (event as any)?.eventType === 'AUDITION_EVENT' ? 'virtual' : currentForm.entryType,
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
 setVideoUrlError(''); // Clear error when entry is saved
 };

 const handleRemoveEntry = (entryId: string) => {
 setEntries(prev => {
 const newEntries = prev.filter(entry => entry.id !== entryId);
 
 // If we're removing a solo entry, recalculate solo fees for remaining entries
 const removedEntry = prev.find(entry => entry.id === entryId);
 if (removedEntry && removedEntry.performanceType === 'Solo') {
 const soloEntries = newEntries.filter(entry => entry.performanceType === 'Solo');
 
 // Recalculate solo fees based on new positioning using event configuration
 // Solo pricing: solo1Fee, solo2Fee, solo3Fee are INDIVIDUAL fees, NOT cumulative
 soloEntries.forEach((entry, index) => {
 const soloNumber = index + 1;
 const solo1Fee = event?.solo1Fee || 400;
 const solo2Fee = event?.solo2Fee || 200;
 const solo3Fee = event?.solo3Fee || 100;
 const soloAdditionalFee = event?.soloAdditionalFee || 100;
 
 if (soloNumber === 1) {
 entry.fee = solo1Fee;
 } else if (soloNumber === 2) {
 entry.fee = solo2Fee;
 } else if (soloNumber === 3) {
 entry.fee = solo3Fee;
 } else {
 // 4th+ solos: additional fee
 entry.fee = soloAdditionalFee;
 }
 });
 }
 
 return newEntries;
 });
 };

 const calculateTotalFee = async () => {
 setIsCalculatingFee(true);
 if ((event as any)?.eventType === 'AUDITION_EVENT') {
 const flat = (event as any).auditionPaymentType === 'paid' ? Number((event as any).auditionFlatFee) || 0 : 0;
 const total = flat * entries.length;
 const pricingResult = { subtotal: total, discount: 0, performanceFee: total, registrationFee: 0, total };
 setRegistrationUi({ participantsNeedingReg: 0, participantsAlreadyRegistered: 0, cartParticipantCount: 0 });
 setTotalFeeCalculation(pricingResult);
 setIsCalculatingFee(false);
 return pricingResult;
 }
 const existingParticipantIds = buildAlreadyRegisteredParticipantSet(
 existingDbEntries,
 availableDancers
 );

 const existingSoloCountByDancer = buildExistingSoloCountsFromDb(existingDbEntries);

 const pricing = calculateEventPricing(entries.map((entry) => ({
 performanceType: entry.performanceType,
 participantIds: entry.participantIds,
 eodsaId: entry.participantIds?.[0]
 })), {
 soloPrice: (event as any)?.soloPrice,
 duetPrice: (event as any)?.duetPrice,
 groupPrice: (event as any)?.groupPrice,
 discountEnabled: (event as any)?.discountEnabled,
 discountMinEntries: (event as any)?.discountMinEntries,
 discountAmount: (event as any)?.discountAmount,
 registrationFee: resolveEventRegistrationFee(event as any)
 }, Array.from(existingParticipantIds), existingSoloCountByDancer);

 const regUi = getRegistrationUiBreakdown(entries, existingParticipantIds, availableDancers);

 const pricingResult = {
 subtotal: pricing.subtotal,
 discount: pricing.discount,
 performanceFee: pricing.subtotal - pricing.discount,
 registrationFee: pricing.registrationTotal,
 total: pricing.total
 };
 setRegistrationUi(regUi);
 setTotalFeeCalculation(pricingResult);
 setIsCalculatingFee(false);
 return pricingResult;
 
 };

 // Recalculate fees whenever entries change
 useEffect(() => {
 if (entries.length > 0) {
 calculateTotalFee();
 } else {
 setTotalFeeCalculation({ subtotal: 0, discount: 0, performanceFee: 0, registrationFee: 0, total: 0 });
 setRegistrationUi({ participantsNeedingReg: 0, participantsAlreadyRegistered: 0, cartParticipantCount: 0 });
 setIsCalculatingFee(false);
 }
 }, [entries, existingDbEntries, availableDancers]);

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
 calculateFallbackEntryFee(showAddForm || 'Solo', currentForm.participantIds.length)
 );
 }
 };
 run();
 // Include entries to account for session solo count
 }, [showAddForm, currentForm.participantIds, currentForm.mastery, studioInfo, eventId, entries]);

 const submitFreeAudition = async () => {
 setIsSubmitting(true);
 try {
 const dancerId = isStudioMode ? studioInfo?.id : contestant?.id;
 const payerEodsaId = isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId;
 for (const entry of entries) {
 const entryEodsaId = entry.performanceType === 'Solo' && entry.participantIds.length === 1
 ? entry.participantIds[0]
 : payerEodsaId;
 const response = await fetch('/api/event-entries', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 eventId,
 contestantId: dancerId,
 eodsaId: entryEodsaId,
 participantIds: entry.participantIds,
 calculatedFee: 0,
 paymentStatus: 'paid',
 itemName: entry.itemName,
 choreographer: entry.choreographer,
 mastery: entry.mastery,
 itemStyle: entry.itemStyle,
 estimatedDuration: parseFloat(entry.estimatedDuration.replace(':', '.')) || 2,
 entryType: 'virtual',
 videoExternalUrl: entry.videoExternalUrl || null,
 videoExternalType: entry.videoExternalType || 'other',
 performanceType: entry.performanceType,
 suitabilityStatement: entry.suitabilityStatement
 })
 });
 if (!response.ok) {
 const errorData = await response.json().catch(() => ({}));
 throw new Error(errorData.error || 'Failed to submit audition entry');
 }
 }
 setEntries([]);
 setSubmissionResult({ entries: entries.length, totalFee: 0 });
 setShowSuccessModal(true);
 success('Audition entry submitted');
 } catch (submitError: any) {
 error(submitError.message || 'Failed to submit audition entry');
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleProceedToPayment = async () => {
 if (entries.length === 0 || isSubmitting) return;
 if ((event as any)?.eventType === 'AUDITION_EVENT' && (event as any).auditionPaymentType !== 'paid') {
 await submitFreeAudition();
 return;
 }
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
 // For PayFast batch payments, we send entries as-is and let backend batch validation handle fee computation
 // The backend's validateBatchEntryFees tracks solo counts cumulatively within the batch,
 // which individual validation cannot do accurately
 const dancerId = isStudioMode ? studioInfo?.id : contestant?.id;
 const eodsaId = isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId;
 
 // Prepare batch entry data with correct EODSA IDs
 // For solo entries, use the participant's EODSA ID; for group entries, use contestant's EODSA ID
 const batchEntryData = entries.map(entry => {
 const entryEodsaId = entry.performanceType === 'Solo' && entry.participantIds.length === 1
 ? entry.participantIds[0] // Solo: use participant's EODSA ID
 : eodsaId; // Group: use contestant's EODSA ID
 
 return {
 eventId: eventId,
 contestantId: dancerId,
 eodsaId: entryEodsaId,
 participantIds: entry.participantIds,
 calculatedFee: entry.fee, // Send client-calculated fee; backend will validate and use computed fee
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
 performanceType: entry.performanceType,
 suitabilityStatement: entry.suitabilityStatement || null,
 clientLineId: entry.id
 };
 });

 // Store entry data in session storage for after payment
 sessionStorage.setItem('pendingEntries', JSON.stringify(batchEntryData));
 sessionStorage.setItem('paymentAmount', totalFeeCalculation.total.toString());
 sessionStorage.setItem('paymentEventId', eventId);
 sessionStorage.setItem('paymentEventName', event?.name || 'Competition Entry');
 sessionStorage.setItem('paymentPayerType', isStudioMode ? 'studio' : 'dancer');

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
 userId: dancerId,
 userFirstName: firstName,
 userLastName: lastName,
 userEmail: userEmail,
 amount: totalFeeCalculation.total, // Send client-calculated total; backend will validate and use computed total if different
 itemName: `${entries.length} Competition Entries`,
 itemDescription: entries.map(e => `${e.performanceType}: ${e.itemName}`).join(', '),
 isBatchPayment: true, // Flag to indicate this is for batch entries
 pendingEntries: batchEntryData // Include entry data for webhook auto-creation
 };

 console.log('🔄 Redirecting to payment for batch entries:', {
 entriesCount: entries.length,
 clientCalculatedTotal: totalFeeCalculation.total,
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
 // Validate fees server-side before submission
 // This ensures fees match database truth (existing entries count)
 const dancerId = isStudioMode ? studioInfo?.id : contestant?.id;
 const eodsaId = isStudioMode ? studioInfo?.registrationNumber : contestant?.eodsaId;
 
 // Validate each entry's fee server-side
 const validatedEntries = await Promise.all(
 entries.map(async (entry) => {
 try {
 // For solo entries, use the participant's EODSA ID; for group entries, use contestant's EODSA ID
 const entryEodsaId = entry.performanceType === 'Solo' && entry.participantIds.length === 1
 ? entry.participantIds[0] // Solo: use participant's EODSA ID
 : eodsaId; // Group: use contestant's EODSA ID
 
 const validationResponse = await fetch('/api/payments/validate-fee', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 eventId: eventId,
 dancerId: dancerId,
 eodsaId: entryEodsaId, // Use correct EODSA ID based on entry type
 performanceType: entry.performanceType,
 participantIds: entry.participantIds,
 masteryLevel: entry.mastery,
 clientSentTotal: entry.fee
 })
 });

 if (!validationResponse.ok) {
 const errorData = await validationResponse.json();
 throw new Error(errorData.error || 'Fee validation failed');
 }

 const validation = await validationResponse.json();
 
 if (!validation.isValid) {
 console.warn(`Fee mismatch for entry "${entry.itemName}":`, {
 clientSent: entry.fee,
 computed: validation.computedFee,
 reason: validation.mismatchReason
 });
 }

 // Use server-computed fee instead of client-calculated fee
 return {
 ...entry,
 fee: validation.computedFee, // Use server-computed total fee (includes registration)
 registrationFee: validation.registrationFee,
 entryFee: validation.entryFee,
 validatedFee: validation.computedFee // Store validated fee for later use
 };
 } catch (validationError: any) {
 console.error(`Error validating fee for entry "${entry.itemName}":`, validationError);
 // Continue with original fee if validation fails (backend will catch it)
 return entry;
 }
 })
 );

 // Recalculate total with validated fees
 const validatedTotalFee = validatedEntries.reduce((total, entry) => {
 // For each entry, we need to sum registration + entry fee
 // But registration is only charged once per dancer, so we need to be careful
 // Let's use the entry fee and add registration separately
 return total + (entry.entryFee || entry.fee);
 }, 0);

 // Calculate registration fee separately (only for dancers who need it)
 // The backend will handle this correctly, but we need to send accurate entry fees
 // For solo entries, use the participant's EODSA ID; for group entries, use contestant's EODSA ID
 const batchEntryData = validatedEntries.map(entry => {
 // For solo entries, the eodsaId should be the participant's EODSA ID
 // For group entries, use the contestant's EODSA ID
 const entryEodsaId = entry.performanceType === 'Solo' && entry.participantIds.length === 1
 ? entry.participantIds[0] // Solo: use participant's EODSA ID
 : eodsaId; // Group: use contestant's EODSA ID
 
 return {
 eventId: eventId,
 contestantId: dancerId,
 eodsaId: entryEodsaId,
 participantIds: entry.participantIds,
      calculatedFee: entry.entryFee ?? entry.fee, // Performance fee only; backend adds registration once per new dancer
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
 performanceType: entry.performanceType,
 suitabilityStatement: entry.suitabilityStatement || null,
 clientLineId: entry.id
 };
 });

 const userName = isStudioMode ? 
 (studioInfo?.name || 'Studio Manager') : 
 (contestant?.name || 'Contestant');
 
 const userEmail = isStudioMode ? 
 (studioInfo?.email || 'studio@example.com') : 
 (contestant?.email || 'contestant@example.com');

 // Calculate total fee by validating all entries together
 // The backend will compute the correct total including registration fees
 const eftPaymentData = {
 eventId: eventId,
 userId: dancerId,
 userEmail: userEmail,
 userName: userName,
 eodsaId: eodsaId,
 amount: totalFeeCalculation.total, // Send client-calculated total, backend will validate
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
 setSubmissionResult({ entries: entries.length, totalFee: result.computedTotal || totalFeeCalculation.total });
 setShowSuccessModal(true);
 setEntries([]); // Clear entries after successful submission
 
 // Note: User will email chenique@elementscentral.com manually after payment
 
 success('EFT payment submitted successfully! Your entries are pending payment verification.');
 } else {
 throw new Error(result.error || 'Failed to submit EFT payment');
 }
 } else {
 const errorData = await response.json();
 // Show detailed error if available
 if (errorData.details) {
 console.error('Payment validation error details:', errorData.details);
 const errorMsg = errorData.details.mismatchReason 
 ? `${errorData.error}: ${errorData.details.mismatchReason}. Expected: ${errorData.details.computedTotal || 'N/A'}, Sent: ${errorData.details.clientSentTotal || 'N/A'}`
 : `${errorData.error}: Please refresh and try again`;
 throw new Error(errorMsg);
 }
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
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="max-w-md w-full glass-panel backdrop-blur-xl rounded-3xl shadow-2xl border border-[rgba(192,192,192,0.22)] p-8 text-center">
 <div className="text-6xl mb-6"></div>
 <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
 <p className="text-gray-300 mb-6">Authentication or event information not provided.</p>
 <Link 
 href="/" className="block w-full px-6 py-3 btn-chrome !rounded-full text-white rounded-xl transition-all duration-300 font-semibold" >
 Back to Home
 </Link>
 </div>
 </div> );
 }

 if (isLoading || !event) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="text-center">
 <div className="relative w-20 h-20 mx-auto mb-8">
 <div className="absolute inset-0 rounded-full border-4 border-[rgba(192,192,192,0.2)]"></div>
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[var(--chrome-mid)] animate-spin"></div>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-2xl"></span>
 </div>
 </div>
 <div className="space-y-2">
 <h3 className="text-xl font-bold text-white">Loading Competition</h3>
 <p className="text-slate-400 text-sm">Preparing performance options...</p>
 </div>
 </div>
 </div> );
}

 const isAudition = event?.eventType === 'AUDITION_EVENT';
 const auditionIsFree = isAudition && event?.auditionPaymentType !== 'paid';

 // Helper function to get currency symbol from event
 const getCurrencySymbol = () => {
 const currency = event?.currency || 'ZAR';
 switch (currency) {
 case 'USD': return '$';
 case 'EUR': return '€';
 case 'GBP': return '£';
 case 'ZAR':
 default: return 'R';
 }
 };

 // Calculate fees in real-time
 const feeCalculation = totalFeeCalculation;

 return (
 <div className="min-h-screen avalon-mesh pb-safe-bottom"> {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
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
 `}</style> {/* Header */}
 <div className="sticky top-0 z-10 bg-[rgba(5,5,5,0.92)] backdrop-blur-lg border-b border-[rgba(192,192,192,0.12)]">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"> {/* Back Navigation */}
 <div className="mb-4">
 <Link 
 href={isStudioMode ? `/event-dashboard/${region}?studioId=${studioId}` : `/`}
 className="inline-flex items-center space-x-2 px-3 py-2 btn-outline-chrome !rounded-lg !px-3 !py-2 text-slate-300 group text-sm" >
 <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
 </svg>
 <span>{isStudioMode ? 'Back to Events' : 'Back to Main Portal'}</span>
 </Link>
 </div> {/* Event Header */}
 <div className="text-center">
 <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display chrome-text mb-2"> {event.name}</h1>
 <p className="text-slate-400 text-sm sm:text-base mb-4">Build your competition entry</p> {/* User Info */}
 {(contestant || studioInfo) && (
 <div className="glass-panel rounded-xl p-3 sm:p-4 inline-block max-w-full"> {isStudioMode ? (
 <div className="text-center sm:text-left">
 <p className="text-slate-300 text-sm sm:text-base">
 <span className="text-[var(--chrome-mid)] font-semibold">{studioInfo?.name}</span>
 </p>
 <p className="text-xs sm:text-sm text-slate-400"> Reg: {studioInfo?.registrationNumber} • {availableDancers.length} dancers
 </p>
 </div> ) : (
 <div className="text-center sm:text-left">
 <p className="text-slate-300 text-sm sm:text-base"> Welcome, <span className="text-[var(--chrome-mid)] font-semibold">{contestant?.name}</span>
 </p>
 <p className="text-xs sm:text-sm text-slate-400"> ID: {contestant?.eodsaId}
 </p>
 </div> )}
 </div> )}
 </div>
 </div>
 </div> {/* Qualification Blocked Message */}
 {qualificationBlocked && qualificationError && (
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
 <div className="bg-gradient-to-r from-red-900/40 to-orange-900/40 border-2 border-red-500/50 rounded-xl p-6">
 <div className="flex items-start space-x-4">
 <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
 <span className="text-white text-2xl">🚫</span>
 </div>
 <div className="flex-1">
 <h3 className="text-xl font-bold text-red-300 mb-2">Entry Not Allowed</h3>
 <p className="text-red-200 mb-4">{qualificationError}</p>
 <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
 <p className="text-red-200 text-sm font-semibold mb-2">What you need to do:</p>
 <ul className="text-red-200/90 text-sm space-y-1 list-disc list-inside">
 <li>Participate in a Regional Event first</li>
 <li>Achieve a minimum score of 75% in your performance</li>
 <li>Wait for scores to be published</li>
 <li>Then you'll be able to enter National Events</li>
 </ul>
 </div>
 <Link
 href={isStudioMode ? `/event-dashboard/${region}?studioId=${studioId}` : `/`}
 className="mt-4 inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors" >
 Back to Events
 </Link>
 </div>
 </div>
 </div>
 </div> )}

 {/* Main Content */}
 {!qualificationBlocked && (
 <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
 {!isAudition && <EventPricingPanel event={event} className="mb-6 lg:hidden" compact />}
 {isAudition && (
 <p className="mb-6 text-sm text-slate-300 lg:hidden">{auditionIsFree ? 'This audition is free.' : `Flat entry fee: R${Number(event.auditionFlatFee || 0).toFixed(2)}`}</p>
 )}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Left Column - Performance Type Selection and Forms */}
 <div className="lg:col-span-2"> {/* Performance Type Selection */}
 <div ref={typeSelectionRef} className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6 mb-8">
 <h3 className="text-xl font-bold text-white mb-4">Add Performance Types</h3> {showHelp ? (
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
 className="text-blue-300 hover:text-white px-2" aria-label="Close help" >
 ✕
 </button>
 </div>
 </div> ) : (
 <button
 onClick={() => setShowHelp(true)}
 className="mb-3 inline-flex items-center text-xs text-blue-300 hover:text-white" aria-label="Show how it works" >
 <span className="mr-1">❓</span> How it works
 </button> )}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"> {['Solo', 'Duet', 'Trio', 'Group'].map((type) => {
 const isActive = showAddForm === type;
 const existingSolos = existingDbEntries.filter(e => e.participantIds && e.participantIds.length === 1).length;
 const sessionSolos = entries.filter(e => e.performanceType === 'Solo').length;
 const totalSoloCount = existingSolos + sessionSolos;
 const nextSoloFee = getStartingFee(type);
 
 // Get currency symbol from event
 const currency = event?.currency || 'ZAR';
 const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
 
 
 // For independent dancers (non-studio mode), only allow Solo
 const isDisabled = !isStudioMode && type !== 'Solo';
 
 return (
 <button
 key={type}
 onClick={() => !isDisabled && handleAddPerformanceType(type)}
 disabled={isDisabled}
 aria-pressed={isActive}
 className={`avalon-option relative p-4 sm:p-5 text-white rounded-xl transition-all duration-300 transform min-h-[120px] sm:min-h-[140px] border ${
 isDisabled 
 ? 'bg-gray-700/40 border-gray-600 cursor-not-allowed opacity-50' 
 : isActive 
 ? 'avalon-option-selected hover:scale-[1.02]' 
 : 'bg-[rgba(17,17,17,0.72)] border-[rgba(192,192,192,0.22)] hover:border-[rgba(0,230,255,0.35)] hover:bg-[rgba(0,230,255,0.05)] hover:scale-[1.02]'
 }`}
 >
 <div className="text-center">
 {isActive && !isDisabled && (
 <div className="mb-2 flex justify-center">
 <span className="avalon-option-selected-badge">Selected</span>
 </div>
 )}
 <h4 className={`text-lg font-semibold mb-2 ${isActive && !isDisabled ? 'brand-duo-text' : ''}`}> Add {type}
 {isDisabled && <span className="block text-xs mt-1 opacity-75 text-white">Requires studio membership</span>}</h4> {/* Flat pricing */}
 {type === 'Solo' && (
 <div className="text-sm mb-2">
 <div className={`font-semibold ${isActive ? 'text-[var(--electric-cyan)]' : 'text-emerald-200'}`}> Next: {currencySymbol}{nextSoloFee}
 </div>
 <div className="text-xs opacity-75">Fixed per solo entry</div>
 </div> )}
 
 {/* Dynamic pricing for others */}
 {type !== 'Solo' && (
 <div className="text-sm mb-2">
 <div className={`font-semibold ${isActive ? 'text-[var(--electric-cyan)]' : 'text-emerald-200'}`}> From {currencySymbol}{getStartingFee(type)}
 </div>
 </div> )}
 
 <p className="text-xs opacity-90"> {getFeeExplanation(type)}
 </p>
 </div>
 </button> );
 })}
 </div> {/* Information for independent dancers */}
 {!isStudioMode && (
 <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
 <div className="flex items-center">
 <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-blue-300 font-medium">Independent Dancer Information</span>
 </div>
 <p className="text-blue-200 text-sm mt-1"> As an independent dancer, you can only register for <strong>Solo</strong> performances. 
 Duet, Trio, and Group performances require studio membership with multiple dancers.
 </p>
 </div> )}
 </div> {/* Entry Form */}
 {showAddForm && (
 <div ref={entryFormRef} className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6 mb-8">
 <div className="flex justify-between items-center mb-4">
 <div>
 <h3 className="text-xl font-semibold text-white">Add {showAddForm} Entry</h3> {savedForms[showAddForm] && (
 <p className="text-xs text-[var(--chrome-mid)] mt-1"> Form data restored</p> )}
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
 className="text-slate-400 hover:text-white" >
 ✕
 </button>
 </div>  <div className="grid grid-cols-1 gap-4 sm:gap-6">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> Item Name * 
 <span className="text-xs text-slate-400 ml-2 font-normal">(Max 26 characters for certificate display)</span>
 </label>
 <input
 type="text" value={currentForm.itemName}
 maxLength={26}
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
 className={`w-full p-4 border-2 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] transition-all duration-200 text-base ${
 currentForm.itemName.length > 22 
 ? 'bg-yellow-900/20 border-yellow-500' 
 : 'bg-slate-700/50 border-slate-600'
 }`}
 placeholder="Enter your performance title" />
 <div className={`mt-1 text-xs flex justify-between ${
 currentForm.itemName.length > 22 
 ? 'text-yellow-400' 
 : currentForm.itemName.length > 20 
 ? 'text-yellow-300' 
 : 'text-slate-400'
 }`}>
 <span> {currentForm.itemName.length >= 26 
 ? ' Maximum length reached' 
 : currentForm.itemName.length > 22 
 ? ' Approaching limit' 
 : 'Max 26 characters'}
 </span>
 <span>{currentForm.itemName.length}/26</span>
 </div>
 </div>  <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3">Choreographer</label>
 <input
 type="text" value={currentForm.choreographer}
 onChange={(e) => {
 const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
 setCurrentForm({...currentForm, choreographer: cleanValue});
 }}
 className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] transition-all duration-200 text-base" placeholder="Who choreographed this piece?" />
 </div>
 </div>  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3">Mastery Level</label>
 <select
 value={currentForm.mastery}
 onChange={(e) => setCurrentForm({...currentForm, mastery: e.target.value})}
 className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] transition-all duration-200 text-base" >
 <option value="">Select mastery level</option> {MASTERY_LEVELS.map((level) => (
 <option key={level} value={level}>{level}</option> ))}
 </select>
 </div>  <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3">Item Style *</label>
 <select
 value={currentForm.itemStyle}
 onChange={(e) => setCurrentForm({...currentForm, itemStyle: e.target.value})}
 className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] transition-all duration-200 text-base" required
 >
 <option value="">Select item style</option> {ITEM_STYLES.map((style) => (
 <option key={style} value={style}>{style}</option> ))}
 </select>
 </div>
 </div>  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3">  Duration Limit: {getMaxDurationDisplay(showAddForm || '')}
 <span className="text-xs text-slate-400 block mt-1 font-normal">Maximum time allowed for {showAddForm} performances</span>
 </label>
 <div className="relative">
 <input
 type="text" value={getMaxDurationDisplay(showAddForm || '')}
 readOnly
 className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base" title="Maximum duration automatically set based on performance type" />
 <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
 <span className="text-slate-400"></span>
 </div>
 </div>
 </div>  <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> Age Category
 <span className="text-xs text-slate-400 block mt-1 font-normal">Calculated from participant ages</span>
 </label>
 <div className="relative">
 <input
 type="text" value={getCalculatedAgeCategory()}
 readOnly
 className="w-full p-4 bg-slate-600/30 border-2 border-slate-500/50 rounded-xl text-slate-300 cursor-not-allowed text-base" title="Age category automatically determined by average age of participants" />
 <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
 <span className="text-slate-400"></span>
 </div>
 </div> {currentForm.participantIds.length > 0 && availableDancers.length > 0 && (
 <div className="mt-3 p-3 bg-purple-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <div className="text-[var(--chrome-light)] text-sm">
 <strong> Selected Participants:</strong> {
 availableDancers
 .filter(dancer => currentForm.participantIds.includes(dancer.id))
 .map(dancer => `${dancer.name} (${dancer.age}y)`)
 .join(', ')
 }
 </div>
 <div className="text-purple-200 text-xs mt-2"> Average Age: {(() => {
 const selectedParticipants = availableDancers.filter(dancer => currentForm.participantIds.includes(dancer.id));
 const totalAge = selectedParticipants.reduce((sum, dancer) => sum + dancer.age, 0);
 return Math.round(totalAge / selectedParticipants.length);
 })()} years  Category: <strong>{getCalculatedAgeCategory()}</strong>
 </div>
 </div> )}
 </div>
 </div> {!isAudition && ( /* PHASE 2: Live vs Virtual Entry Toggle */
 <div ref={entryTypeRef}>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> Entry Type *</label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
 <button
 type="button" onClick={() => setCurrentForm({...currentForm, entryType: 'live', videoExternalUrl: '', musicFileUrl: currentForm.entryType === 'virtual' ? '' : currentForm.musicFileUrl})}
 disabled={event?.participationMode === 'virtual'}
 aria-pressed={currentForm.entryType === 'live'}
 className={`avalon-option p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
 currentForm.entryType === 'live'
 ? 'avalon-option-selected'
 : event?.participationMode === 'virtual'
 ? 'border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed opacity-50'
 : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-[rgba(0,230,255,0.35)] hover:bg-[rgba(0,230,255,0.05)]'
 }`}
 >
 <div className="flex flex-col items-center justify-center space-y-2 h-full">
 {currentForm.entryType === 'live' && event?.participationMode !== 'virtual' && (
 <span className="avalon-option-selected-badge">Selected</span>
 )}
 <span className={`font-semibold text-base ${currentForm.entryType === 'live' ? 'brand-duo-text' : ''}`}>Live Performance</span>
 <span className="text-xs text-center opacity-90 leading-relaxed"> {event?.participationMode === 'virtual' ? 'Not available for this event' : 'Upload music file for in-person performance'}
 </span>
 </div>
 </button>  <button
 type="button" onClick={() => setCurrentForm({...currentForm, entryType: 'virtual', musicFileUrl: '', musicFileName: ''})}
 disabled={event?.participationMode === 'live'}
 aria-pressed={currentForm.entryType === 'virtual'}
 className={`avalon-option p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] min-h-[100px] sm:min-h-[120px] ${
 currentForm.entryType === 'virtual'
 ? 'avalon-option-selected'
 : event?.participationMode === 'live'
 ? 'border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed opacity-50'
 : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-[rgba(255,45,161,0.35)] hover:bg-[rgba(255,45,161,0.05)]'
 }`}
 >
 <div className="flex flex-col items-center justify-center space-y-2 h-full">
 {currentForm.entryType === 'virtual' && event?.participationMode !== 'live' && (
 <span className="avalon-option-selected-badge">Selected</span>
 )}
 <span className={`font-semibold text-base ${currentForm.entryType === 'virtual' ? 'brand-duo-text' : ''}`}>Virtual Performance</span>
 <span className="text-xs text-center opacity-90 leading-relaxed"> {event?.participationMode === 'live' ? 'Not available for this event' : 'Submit video URL (YouTube/Vimeo)'}
 </span>
 </div>
 </button>
 </div> {event?.participationMode === 'virtual' && (
 <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
 <p className="text-sm text-blue-300">  <strong>Virtual Event:</strong> This event only accepts video submissions. Live performances are not available.
 </p>
 </div> )}
 {event?.participationMode === 'live' && (
 <div className="mt-3 p-3 bg-purple-500/10 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-sm text-[var(--chrome-light)]">  <strong>Live Event:</strong> This event only accepts live in-person performances. Virtual submissions are not available.
 </p>
 </div> )}
 </div> )}
 {isAudition && (
 <div className="space-y-3">
 <p className="text-sm text-slate-300">This audition is virtual. Add your video link and tell us why you are suitable.</p>
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-2">Why do you think you would be suitable for this opportunity? *</label>
 <textarea
 required
 rows={5}
 value={currentForm.suitabilityStatement}
 onChange={(e) => setCurrentForm({ ...currentForm, suitabilityStatement: e.target.value, entryType: 'virtual' })}
 className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)]"
 placeholder="Write your response here"
 />
 </div>
 </div>
 )}
 {/* Conditional Fields Based on Entry Type */}
 {currentForm.entryType === 'live' && (
 <div ref={musicSectionRef}>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> Music File Upload (Optional)
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
 </div> )}

 {(isAudition || currentForm.entryType === 'virtual') && (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> Video Platform
 </label>
 <select
 value={currentForm.videoExternalType}
 onChange={(e) => setCurrentForm({...currentForm, videoExternalType: e.target.value as 'youtube' | 'vimeo' | 'other'})}
 className="w-full p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] transition-all duration-200 text-base" >
 <option value="youtube">📺 YouTube</option>
 <option value="vimeo"> Vimeo</option>
 <option value="other"> Other Platform</option>
 </select>
 </div>  <div>
 <label className="block text-sm font-semibold text-slate-300 mb-3"> 🔗 Video URL {isAudition ? '*' : '(Optional)'}
 <span className="text-xs text-slate-400 block mt-1 font-normal"> {isAudition ? 'YouTube, Vimeo, or Google Drive link' : 'You can upload your video later through your dashboard'}
 </span> {(currentForm.videoExternalUrl.includes('drive.google.com') || currentForm.videoExternalType === 'other') && (
 <div className="mt-2 flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
 <span className="text-xs text-blue-400 mt-0.5"></span>
 <div className="flex-1">
 <p className="text-xs text-blue-400 mb-1">
 <strong>Google Drive Tip:</strong> Make sure your file is shared with "Anyone with the link" permission.
 </p>
 <details className="text-xs text-blue-300">
 <summary className="cursor-pointer hover:text-blue-200 font-medium">How to change permissions</summary>
 <div className="mt-2 pl-4 space-y-1 text-blue-400">
 <p>1. Open your file in Google Drive</p>
 <p>2. Click "Share" button (top right)</p>
 <p>3. Click "Change" next to "Restricted"</p>
 <p>4. Select "Anyone with the link"</p>
 <p>5. Set permission to "Viewer"</p>
 <p>6. Click "Done" and copy the link</p>
 </div>
 </details>
 </div>
 </div> )}
 </label>
 <input
 type="url" value={currentForm.videoExternalUrl}
 onChange={(e) => handleVideoUrlChange(e.target.value)}
 onBlur={async () => {
 if (currentForm.videoExternalUrl && currentForm.videoExternalUrl.includes('drive.google.com')) {
 setIsValidatingVideoUrl(true);
 const validation = await validateGoogleDriveUrl(currentForm.videoExternalUrl);
 setIsValidatingVideoUrl(false);
 if (!validation.isValid && validation.error) {
 setVideoUrlError(validation.error);
 }
 }
 }}
 placeholder={
 currentForm.videoExternalType === 'youtube' 
 ? 'https://www.youtube.com/watch?v=...' 
 : currentForm.videoExternalType === 'vimeo'
 ? 'https://vimeo.com/...'
 : 'https://drive.google.com/file/d/... or https://...'
 }
 className={`w-full p-4 bg-slate-700/50 border-2 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 text-base ${
 videoUrlError 
 ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
 : 'border-slate-600 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]'
 }`}
 /> {isValidatingVideoUrl && (
 <div className="mt-2 text-sm text-blue-400 flex items-center space-x-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
 <span>Checking Google Drive access...</span>
 </div> )}
 {videoUrlError && (
 <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
 <div className="text-red-300 text-sm flex items-start space-x-2">
 <span className="text-lg"></span>
 <div className="flex-1">
 <p className="font-medium mb-1">{videoUrlError}</p>
 <p className="text-xs text-red-400"> Please update the sharing settings in Google Drive and try again.
 </p>
 </div>
 </div>
 </div> )}
 {currentForm.videoExternalUrl && !videoUrlError && !isValidatingVideoUrl && (
 <div className="mt-3 p-3 bg-green-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <div className="text-green-300 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
 <div className="flex items-center space-x-2">
 <span></span>
 <span className="font-medium"> {currentForm.videoExternalUrl.includes('drive.google.com') 
 ? 'Google Drive URL converted to preview format' 
 : 'Video URL provided'}
 </span>
 </div>
 <a 
 href={currentForm.videoExternalUrl.includes('drive.google.com') 
 ? convertGoogleDriveUrl(currentForm.videoExternalUrl)
 : currentForm.videoExternalUrl} 
 target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1 bg-green-500/20 text-[var(--chrome-mid)] hover:text-green-300 hover:bg-green-500/30 rounded-lg transition-all duration-200 text-sm font-medium border border-[rgba(192,192,192,0.22)]" >
 <span className="mr-1">🔗</span> Preview Video
 </a>
 </div>
 </div> )}
 </div>
 </div> )}
 </div>  <div ref={participantsSectionRef} className="mt-4">
 <label className="block text-sm font-medium text-slate-300 mb-2"> Select Participants * ({getParticipantLimits(showAddForm).min} - {getParticipantLimits(showAddForm).max} required)
 {currentForm.participantIds.length > 0 && (
 <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 ? 'bg-red-500/20 text-red-400'
 : 'bg-emerald-500/20 text-[var(--chrome-mid)]'
 }`}> {currentForm.participantIds.length} selected
 </span> )}
 </label> {/* Validation Messages */}
 {currentForm.participantIds.length > 0 && (
 <div className="mb-3"> {currentForm.participantIds.length < getParticipantLimits(showAddForm).min && (
 <div className="text-amber-400 text-sm flex items-center space-x-1 animate-pulse">
 <span></span>
 <span>Need {getParticipantLimits(showAddForm).min - currentForm.participantIds.length} more participant(s)</span>
 </div> )}
 {currentForm.participantIds.length > getParticipantLimits(showAddForm).max && (
 <div className="text-red-400 text-sm flex items-center space-x-1 animate-bounce">
 <span></span>
 <span>Too many participants! Remove {currentForm.participantIds.length - getParticipantLimits(showAddForm).max} participant(s)</span>
 </div> )}
 {currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
 currentForm.participantIds.length <= getParticipantLimits(showAddForm).max && (
 <div className="text-[var(--chrome-mid)] text-sm flex items-center space-x-1">
 <span></span>
 <span>Perfect! {currentForm.participantIds.length} participant(s) selected</span>
 </div> )}
 </div> )}
 
 <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-4 rounded-lg transition-all duration-300 ${
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max 
 ? 'bg-red-900/20 border-2 border-red-500/50' 
 : currentForm.participantIds.length >= getParticipantLimits(showAddForm).min && 
 currentForm.participantIds.length <= getParticipantLimits(showAddForm).max
 ? 'bg-emerald-900/20 border-2 border-emerald-500/50'
 : 'bg-slate-700/30 border border-slate-600/50'
 }`}> {isLoading && (
 <div className="text-slate-400 text-sm flex items-center space-x-2">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--chrome-mid)]"></div>
 <span>Loading your dancer information...</span>
 </div> )}
 {!isLoading && availableDancers.length === 0 && (
 <div className="text-slate-400 text-sm">
 <p>No dancers available for EODSA ID: {eodsaId}</p>
 <p className="text-xs mt-1">Check console for debug info</p>
 </div> )}
 {availableDancers.map(dancer => {
 const isSelected = currentForm.participantIds.includes(dancer.id);
 const isOverLimit = currentForm.participantIds.length >= getParticipantLimits(showAddForm).max;
 
 return (
 <label 
 key={dancer.id} 
 className={`flex items-center space-x-2 p-2 rounded transition-all duration-200 border ${
 isSelected 
 ? currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 ? 'bg-red-500/20 text-red-300 border-red-500/40' 
 : 'avalon-option-selected text-white'
 : isOverLimit && !isSelected
 ? 'text-slate-500 opacity-50 cursor-not-allowed border-transparent'
 : 'text-slate-300 hover:bg-[rgba(0,230,255,0.06)] hover:border-[rgba(0,230,255,0.25)] cursor-pointer border-transparent'
 }`}
 >
 <input
 type="checkbox" checked={isSelected}
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
 </label> );
 })}
 </div>
 </div> {/* Fee Preview */}
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
 : 'text-[var(--chrome-mid)]'
 }`}> {(currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max)
 ? 'Invalid'
 : (previewFee === 0 ? 'FREE' : `${getCurrencySymbol()}${previewFee}`)}
 </span>
 </div> {showAddForm === 'Solo' && !(
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 ) && (
 <div className="text-xs text-slate-400 mt-1"> Fixed solo price: {getCurrencySymbol()}{(event as any)?.soloPrice || 0}
 </div> )}
 {(currentForm.participantIds.length > 0 && (
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 )) && (
 <div className="text-xs text-red-400 mt-1"> Fix participant selection to see fee
 </div> )}
 </div> )}
 
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
 className="w-full sm:w-auto px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-500 transition-all duration-300 font-medium text-base min-h-[48px] sm:min-h-auto order-2 sm:order-1" >
 Cancel
 </button>
 <button
 ref={addEntryButtonRef}
 onClick={handleSaveEntry}
 disabled={
 !currentForm.itemName ||
 !currentForm.itemStyle ||
 !currentForm.mastery ||
 (isAudition && !currentForm.suitabilityStatement?.trim()) ||
 (isAudition && !currentForm.videoExternalUrl?.trim()) ||
 currentForm.participantIds.length === 0 ||
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 }
 className={`w-full sm:w-auto px-6 py-3 text-white rounded-xl transition-all duration-300 font-semibold text-base min-h-[48px] sm:min-h-auto order-1 sm:order-2 ${
 !currentForm.itemName ||
 !currentForm.itemStyle ||
 !currentForm.mastery ||
 currentForm.participantIds.length === 0 ||
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ||
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max
 ? 'bg-slate-500 cursor-not-allowed'
 : 'btn-chrome hover:scale-105'
 }`}
 > {!currentForm.itemName ? ' Enter Item Name' :
 !currentForm.itemStyle ? ' Select Item Style' :
 !currentForm.mastery ? ' Select Mastery Level' :
 currentForm.participantIds.length === 0 ? ' Select Participants' :
 currentForm.participantIds.length < getParticipantLimits(showAddForm).min ? 
 ` Need ${getParticipantLimits(showAddForm).min - currentForm.participantIds.length} More` :
 currentForm.participantIds.length > getParticipantLimits(showAddForm).max ? 
 ` Remove ${currentForm.participantIds.length - getParticipantLimits(showAddForm).max}` :
 ` Add Entry ${previewFee > 0 ? `(R${previewFee})` : ''}`}
 </button>
 </div>
 </div> )}

 {/* Added Entries List */}
 {entries.length > 0 && (
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6">
 <h3 className="text-xl font-semibold text-white mb-4">Added Entries ({entries.length})</h3>
 <div className="space-y-4"> {entries.map((entry) => (
 <div key={entry.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
 <div className="flex justify-between items-start">
 <div>
 <h4 className="font-semibold text-lg text-white">{entry.itemName}</h4>
 <p className="text-slate-300">{entry.performanceType} • {entry.choreographer}</p>
 <p className="text-sm text-slate-400"> {entry.participants.map(p => p.fullName || p.name).join(', ')}
 </p>
 <p className="text-sm text-slate-400"> {entry.mastery} • {entry.itemStyle} • {entry.estimatedDuration}
 </p>
 </div>
 <div className="text-right">
 <p className="font-semibold text-lg text-[var(--chrome-mid)]">{getCurrencySymbol()}{entry.fee}</p>
 <button
 onClick={() => handleRemoveEntry(entry.id)}
 className="text-red-400 hover:text-red-300 text-sm" >
 Remove
 </button>
 </div>
 </div>
 </div> ))}
 </div>
 </div> )}
 </div> {/* Right Column - Summary and Payment */}
 <div className="lg:col-span-1">
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6 sticky top-8">
 <h3 className="text-xl font-semibold text-white mb-4">Registration Summary</h3>  <div className="space-y-2 mb-4 text-slate-300">
 <div className="flex justify-between">
 <span>Entries:</span>
 <span>{entries.length}{showAddForm && previewFee > 0 && <span className="text-slate-400"> (+1)</span>}</span>
 </div> {event?.discountEnabled && (event?.discountMinEntries || 0) > 0 && (
 <div className="text-xs text-slate-400"> Every {formatOrdinal(event?.discountMinEntries || 0)} solo per dancer gets {getCurrencySymbol()}
 {Number(event?.discountAmount || 0).toFixed(2)} off that line (e.g. 3rd, 6th, 9th when N is 3).
 </div> )}
 
 {/* Pending entry preview */}
 {showAddForm && previewFee > 0 && (
 <div className="text-xs text-slate-400 bg-slate-700/20 p-2 rounded border border-slate-600/30">
 <div className="flex justify-between">
 <span>+ Adding {showAddForm}:</span>
 <span className="text-[var(--chrome-mid)]">{getCurrencySymbol()}{previewFee}</span>
 </div>
 </div> )}
 
 {event?.discountEnabled && (
 <div className="text-xs text-slate-400 bg-slate-700/30 p-2 rounded"> Solo discount repeats: same dancer, every Nth solo in this event (counts existing items + this cart).
 </div> )}
 
 {isCalculatingFee ? (
 <div className="flex items-center justify-center py-4">
 <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mr-3"></div>
 <span className="text-[var(--chrome-mid)]">Calculating fees...</span>
 </div> ) : (
 <>
 <div className="flex justify-between">
 <span>Subtotal:</span>
 <span>{getCurrencySymbol()}{feeCalculation.subtotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>Discount:</span>
 <span>-{getCurrencySymbol()}{feeCalculation.discount.toFixed(2)}</span>
 </div> {feeCalculation.registrationFee > 0 ? (
 <>
 <div className="flex justify-between">
 <span>Registration:</span>
 <span>{getCurrencySymbol()}{feeCalculation.registrationFee.toFixed(2)}</span>
 </div>
 <div className="text-xs text-slate-400"> ({registrationUi.participantsNeedingReg} new dancer
 {registrationUi.participantsNeedingReg !== 1 ? 's' : ''} × {getCurrencySymbol()}
 {resolveEventRegistrationFee(event || {})} — once per event)
 </div> {registrationUi.participantsAlreadyRegistered > 0 && (
 <div className="text-xs text-[var(--chrome-mid)]/80"> {registrationUi.participantsAlreadyRegistered} dancer
 {registrationUi.participantsAlreadyRegistered !== 1 ? 's' : ''} already registered for this event — no repeat fee
 </div> )}
 </> ) : registrationUi.cartParticipantCount > 0 && (event?.registrationFee || 0) > 0 ? (
 <div className="flex justify-between text-sm">
 <span>Registration:</span>
 <span className="text-[var(--chrome-mid)]/90 text-right max-w-[60%]"> Already paid for this event
 {registrationUi.participantsAlreadyRegistered > 0 && (
 <span className="block text-xs text-slate-400 font-normal mt-0.5"> ({registrationUi.participantsAlreadyRegistered} dancer
 {registrationUi.participantsAlreadyRegistered !== 1 ? 's' : ''} in your cart)
 </span> )}
 </span>
 </div> ) : null}
 </> )}
 
 {/* Preview total with pending entry */}
 {showAddForm && previewFee > 0 && (
 <div className="border-t border-slate-600/50 pt-2">
 <div className="flex justify-between text-sm text-slate-400">
 <span>Preview Total:</span>
 <span>{getCurrencySymbol()}{feeCalculation.total + previewFee}</span>
 </div>
 </div> )}
 
 <div className="border-t border-slate-600 pt-2">
 <div className="flex justify-between font-semibold text-lg text-[var(--chrome-mid)]">
 <span>Total:</span>
 <span className="transition-all duration-300 transform hover:scale-110"> {getCurrencySymbol()}{feeCalculation.total}
 </span>
 </div>
 </div>
 </div>  <button
 ref={proceedToPaymentRef}
 onClick={handleProceedToPayment}
 disabled={entries.length === 0 || isSubmitting || isCalculatingFee}
 className={`w-full py-4 sm:py-3 text-white rounded-lg font-semibold transition-all duration-300 text-lg sm:text-base min-h-[56px] sm:min-h-auto ${
 isSubmitting || entries.length === 0 || isCalculatingFee
 ? 'bg-slate-500 cursor-not-allowed'
 : 'btn-chrome'
 }`}
 > {isSubmitting ? (
 <div className="flex items-center justify-center space-x-2">
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 <span>Submitting Entries...</span>
 </div> ) : isCalculatingFee ? (
 <div className="flex items-center justify-center space-x-2">
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 <span>Calculating Fee...</span>
 </div> ) : (
 auditionIsFree ? 'Submit Entry' : 'Proceed to Payment'
 )}
 </button>
 </div> {/* Event Details & Pricing */}
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6 mt-6 space-y-5">
 <div>
 <h3 className="text-xl font-semibold text-white mb-4">Event Details</h3>
 <div className="space-y-2 text-sm text-slate-300">
 <p><strong>Date:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'TBD'}</p>
 <p><strong>Time:</strong> {event?.eventDate ? new Date(event.eventDate).toLocaleTimeString() : 'TBD'}</p>
 {!isAudition && <p><strong>Venue:</strong> {event?.venue || 'TBD'}</p>}
 <p><strong>Registration Deadline:</strong> {event?.registrationDeadline ? new Date(event.registrationDeadline).toLocaleDateString() : 'TBD'}</p>
 </div>
 </div> {event && !isAudition && <EventPricingPanel event={event} compact className="hidden lg:block" />}
 {isAudition && (
 <p className="text-sm text-slate-300">{auditionIsFree ? 'This audition is free. Your entry is confirmed when you submit.' : `Entry fee: R${Number(event?.auditionFlatFee || 0).toFixed(2)} per entry.`}</p>
 )}
 </div>
 </div>
 </div> {/* Guided Tour Overlay */}
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
 /> )}
 </div> )}

 {/* Success Modal */}
 {showSuccessModal && submissionResult && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 max-w-lg w-full"> {/* Success Icon */}
 <div className="text-center mb-6">
 <div className="w-16 h-16 btn-chrome !rounded-full rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-[#050505]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <h2 className="text-2xl font-bold text-white mb-2"> Entries Submitted Successfully!</h2>
 <p className="text-slate-300">Your competition entries have been registered for {event?.name}</p> {/* Avalon Blessing */}
 <div className="mt-4 p-3 bg-gradient-to-r from-[rgba(0,230,255,0.06)] to-[rgba(255,45,161,0.06)] border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-[var(--chrome-light)] text-sm italic font-medium"> "May the Mists of Avalon bring luck upon you"  </p>
 </div>
 </div> {/* Entry Summary */}
 <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <span className="text-slate-300">Entries Submitted:</span>
 <span className="text-white font-semibold">{submissionResult?.entries}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-slate-300">Total Fee:</span>
 <span className="text-[var(--chrome-mid)] font-semibold text-lg">{getCurrencySymbol()}{submissionResult?.totalFee}</span>
 </div>
 <div className="pt-2 border-t border-slate-600">
 <p className="text-sm text-slate-300"> All entries qualified for nationals
 </p>
 <p className="text-sm text-slate-300"> ⏳ Payment status: Pending
 </p>
 </div>
 </div>
 </div> {/* Next Steps */}
 <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
 <h4 className="text-blue-400 font-semibold mb-2">Next Steps:</h4> {selectedPaymentMethod === 'eft' ? (
 <ul className="text-sm text-slate-300 space-y-2">
 <li>•  Your entries are now submitted as "pending payment verification"</li>
 <li>• 🏦 Make your EFT payment to Elements of Dance (FNB: 63122779094)</li>
 <li>•  <strong className="text-[var(--chrome-mid)]">After making payment, email chenique@elementscentral.com with your payment reference for entry approval</strong></li>
 <li>•  Check your dashboard for updates</li>
 </ul> ) : (
 <ul className="text-sm text-slate-300 space-y-1">
 <li>• Payment will be processed automatically</li>
 <li>• Confirmation email will be sent to you</li>
 <li>• Check your dashboard for updates</li>
 </ul> )}
 </div> {/* Action Buttons */}
 <div className="flex space-x-3"> {isStudioMode && studioId ? (
 <>
 <button
 onClick={() => {
 setShowSuccessModal(false);
 // Clear entries and reset form
 setEntries([]);
 setSubmissionResult(null);
 }}
 className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors" >
 Enter More Events
 </button>
 <button
 onClick={() => router.push('/studio-dashboard')}
 className="flex-1 px-4 py-2 btn-chrome !rounded-full text-white rounded-lg transition-all duration-300 font-semibold" >
 Studio Dashboard
 </button>
 </> ) : (
 <div className="flex flex-col space-y-3">
 <button
 onClick={() => {
 setShowSuccessModal(false);
 // Clear entries and reset form
 setEntries([]);
 setSubmissionResult(null);
 }}
 className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors" >
 Enter More Events
 </button>
 <div className="flex space-x-3">
 <Link
 href="/studio-login" className="flex-1 px-4 py-2 btn-chrome !rounded-full text-white rounded-lg transition-all duration-300 font-semibold text-center" >
 Studio Login
 </Link>
 <button
 onClick={() => router.push(`/`)}
 className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 font-semibold" >
 Main Portal
 </button>
 </div>
 </div> )}
 </div>
 </div>
 </div> )}

 {/* Payment Method Selection Modal */}
 {showPaymentMethodModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8 max-w-lg w-full">
 <div className="text-center mb-6">
 <h2 className="text-2xl font-bold text-white mb-2"> Select Payment Method</h2>
 <p className="text-slate-300">Choose how you'd like to pay for your competition entries</p>  <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
 <div className="text-slate-300 text-sm space-y-2">
 <div className="flex justify-between">
 <span>Total Amount:</span>
 <span className="text-[var(--chrome-mid)] font-semibold text-lg">{getCurrencySymbol()}{totalFeeCalculation.total}</span>
 </div>
 <div className="flex justify-between">
 <span>Entries:</span>
 <span>{entries.length} performance{entries.length > 1 ? 's' : ''}</span>
 </div>
 </div>
 </div>
 </div>  <div className="space-y-4"> {/* PayFast Option */}
 <button
 onClick={() => handlePaymentMethodSelection('payfast')}
 className="w-full p-6 btn-chrome !rounded-xl text-left transition-all duration-300 transform hover:scale-[1.02]" >
 <div className="flex items-center space-x-4">
 <div className="text-3xl"></div>
 <div className="text-left">
 <h3 className="text-lg font-semibold">PayFast - Instant Payment</h3>
 <p className="text-sm opacity-90">Pay instantly with credit card or bank transfer</p>
 <p className="text-xs opacity-75 mt-1"> Instant approval •  Secure payment gateway</p>
 </div>
 </div>
 </button> {/* EFT Option */}
 <button
 onClick={() => handlePaymentMethodSelection('eft')}
 className="w-full p-6 btn-outline-chrome !rounded-xl text-left transition-all duration-300 transform hover:scale-[1.02]" >
 <div className="flex items-center space-x-4">
 <div className="text-3xl">🏦</div>
 <div className="text-left">
 <h3 className="text-lg font-semibold">EFT - Bank Transfer</h3>
 <p className="text-sm opacity-90">Pay via EFT using the banking details provided.</p>
 <p className="text-xs opacity-75 mt-1">⏳ Entries pending verification •  You email chenique after payment</p>
 </div>
 </div>
 </button>
 </div>  <div className="mt-6 text-center">
 <button
 onClick={() => setShowPaymentMethodModal(false)}
 className="px-6 py-2 text-slate-400 hover:text-white transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}

 {/* EFT Payment Modal - Mobile & PC Optimized */}
 {showEftModal && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-y-auto"> {/* Mobile: Full height, PC: Centered with max height and scrolling */}
 <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:w-full relative sm:my-4">
 <div className="bg-slate-800/98 backdrop-blur-xl shadow-2xl border-t sm:border border-slate-700/50 w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl overflow-y-auto scrollbar-hide flex flex-col"> {/* Fixed Header */}
 <div className="sticky top-0 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 p-4 sm:p-6 z-10">
 <div className="text-center">
 <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">🏦 EFT Payment Details</h2>
 <p className="text-slate-300 text-sm sm:text-base">Make your payment using the banking details below</p>
 </div>
 </div> {/* Scrollable Content */}
 <div className="flex-1 p-4 sm:p-6 pb-6 space-y-6 min-h-0"> {/* Banking Details - Mobile Optimized */}
 <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-[rgba(192,192,192,0.22)] rounded-xl p-4 sm:p-6">
 <h3 className="text-green-300 font-semibold mb-4 flex items-center text-lg">
 <span className="text-2xl mr-2">🏦</span> Banking Details</h3>  <div className="space-y-4">
 <div className="bg-slate-800/40 rounded-lg p-3">
 <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Account Name</div>
 <div className="text-white font-semibold text-base">Elements of Dance</div>
 </div>  <div className="bg-slate-800/40 rounded-lg p-3">
 <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Bank</div>
 <div className="text-white font-semibold text-base">FNB</div>
 </div>  <div className="bg-slate-800/40 rounded-lg p-3">
 <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Account Number</div>
 <div className="text-white font-mono font-bold text-lg bg-slate-700/60 px-3 py-2 rounded-lg border border-slate-600/50"> 63122779094
 </div>
 </div> {/* Reference removed from EFT modal */}
 
 <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-lg p-3">
 <div className="text-[var(--chrome-mid)] text-xs uppercase tracking-wide mb-1">Amount</div>
 <div className="text-emerald-200 font-bold text-xl">{getCurrencySymbol()}{totalFeeCalculation.total}</div>
 </div>
 </div>
 </div> {/* Payment Reference Input */}
 <div className="space-y-2">
 <label className="block text-sm font-semibold text-slate-300"> Payment Reference (optional)
 </label>
 <div className="flex gap-2">
 <input
 type="text" value={eftInvoiceNumber}
 onChange={(e) => setEftInvoiceNumber(e.target.value)}
 placeholder="Reference or leave blank" className="flex-1 p-3 sm:p-4 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-sm sm:text-base" />
 <button
 onClick={() => setEftInvoiceNumber('')}
 className="px-3 sm:px-4 py-2 sm:py-3 bg-slate-700/70 hover:bg-slate-600 text-slate-200 rounded-xl text-sm" >
 Clear
 </button>
 </div>
 <p className="text-xs text-slate-400 leading-relaxed"> This is optional and helps us match your EFT.
 </p>
 </div> {/* Payment Process Notice - Improved Design */}
 <div className="bg-gradient-to-r from-blue-900/20 to-emerald-900/20 border border-blue-500/30 rounded-xl p-5">
 <div className="space-y-4">
 <div className="flex items-center space-x-3">
 <span className="text-blue-400 text-2xl"></span>
 <h4 className="text-blue-300 font-bold text-lg">Next Steps</h4>
 </div>  <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-xl p-4">
 <div className="flex items-start space-x-3">
 <span className="text-[var(--chrome-mid)] text-xl mt-0.5"></span>
 <div>
 <h5 className="text-[var(--chrome-mid)] font-semibold mb-2">After Payment</h5>
 <p className="text-emerald-200 text-sm leading-relaxed"> Email your <span className="font-semibold">proof of payment + reference</span> to:
 </p>
 <div className="mt-2 p-3 bg-emerald-800/40 rounded-lg">
 <a 
 href="mailto:chenique@elementscentral.com" className="text-emerald-100 font-semibold hover:text-white transition-colors" >
 chenique@elementscentral.com
 </a>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div> {/* Sticky Footer with Buttons */}
 <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 p-4 sm:p-6">
 <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
 <button
 onClick={() => {
 setShowEftModal(false);
 setEftInvoiceNumber('');
 }}
 className="w-full sm:flex-1 px-4 py-4 bg-slate-600 text-white rounded-xl hover:bg-slate-500 transition-colors font-medium" >
 Cancel
 </button>
 <button
 onClick={handleEftPayment}
 disabled={isSubmitting}
 className={`w-full sm:flex-1 px-4 py-4 rounded-xl font-semibold transition-all duration-300 ${
 isSubmitting
 ? 'bg-slate-500 cursor-not-allowed text-slate-300'
 : 'btn-chrome transform hover:scale-[1.02]'
 }`}
 > {isSubmitting ? (
 <div className="flex items-center justify-center space-x-2">
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 <span>Submitting...</span>
 </div> ) : (
 'Submit Entry & Payment Info'
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div> )}
 </div> );
} 