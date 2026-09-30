'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERFORMANCE_TYPES, EODSA_FEES, Event } from '@/lib/types';
import CountdownTimer from '@/app/components/CountdownTimer';
import EventPricingPanel from '@/app/components/EventPricingPanel';

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

export default function NationalsEventsPage() {
 const searchParams = useSearchParams();
 const params = useParams();
 const router = useRouter();
 const region = decodeURIComponent(params?.region as string || '');
 const eodsaId = searchParams?.get('eodsaId') || '';
 const studioId = searchParams?.get('studioId') || '';
 
 const [contestant, setContestant] = useState<Contestant | null>(null);
 const [studioInfo, setStudioInfo] = useState<StudioSession | null>(null);
 const [availableDancers, setAvailableDancers] = useState<any[]>([]);
 const [isStudioMode, setIsStudioMode] = useState(false);
 const [events, setEvents] = useState<Event[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [groupedEvents, setGroupedEvents] = useState<{[key: string]: Event[]}>({});

 useEffect(() => {
 if (region && eodsaId) {
 setIsStudioMode(false);
 loadContestant(eodsaId);
 loadNationalsEvents();
 } else if (region && studioId) {
 setIsStudioMode(true);
 loadStudioData(studioId);
 loadNationalsEvents();
 }
 }, [region, eodsaId, studioId]);

 // No longer need to group events by performance type since we have unified events
 useEffect(() => {
 if (events.length > 0) {
 // For unified events, we don't need to group by performance type
 setGroupedEvents({}); // Clear grouped events since we'll show unified events directly
 }
 }, [events]);

 // Helper to label event tier clearly (Nationals / Regional / Qualifier)
 const getEventTier = (event: Event & { eventType?: string }) => {
 const tier = (event as any).eventType as string | undefined;

 if (tier === 'REGIONAL_EVENT') {
 return {
 label: `${event.region} Regional`,
 classes: 'bg-blue-500/20 text-blue-200 border border-blue-400/40',
 };
 }
 if (tier === 'AUDITION_EVENT') {
 return {
 label: 'Audition',
 classes: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
 };
 }
 if (tier === 'QUALIFIER_EVENT') {
 return {
 label: `${event.region} Qualifier`,
 classes: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
 };
 }
 if (event.region === 'Nationals') {
 return {
 label: 'Nationals',
 classes: 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40',
 };
 }

 return {
 label: event.region || 'Competition',
 classes: 'bg-slate-500/20 text-slate-200 border border-slate-400/40',
 };
 };

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
 return;
 }
 }
 
 // Fallback to legacy system (contestants)
 const legacyResponse = await fetch(`/api/contestants/by-eodsa-id/${id}`);
 if (legacyResponse.ok) {
 const legacyData = await legacyResponse.json();
 setContestant(legacyData);
 }
 } catch (error) {
 console.error('Failed to load contestant:', error);
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

 const loadNationalsEvents = async () => {
 setIsLoading(true);
 try {
 const response = await fetch('/api/events');
 if (response.ok) {
 const data = await response.json();
 if (data.success) {
 // Show ALL event types: Nationals, Regionals, Qualifiers (unified events only)
 // Include: Nationals (region='Nationals'), Regionals (eventType='REGIONAL_EVENT'), Qualifiers (eventType='QUALIFIER_EVENT')
 const allOpenEvents = data.events.filter((event: Event & { eventType?: string }) => event.performanceType === 'All' &&
 (event.status === 'registration_open' || event.status === 'upcoming')
 );
 setEvents(allOpenEvents);
 }
 }
 } catch (error) {
 console.error('Failed to load events:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const getEventsByPerformanceType = (performanceType: string) => {
 return events.filter(event => event.performanceType === performanceType);
 };

 const getParticipantRequirements = (performanceType: string) => {
 const typeInfo = PERFORMANCE_TYPES[performanceType as keyof typeof PERFORMANCE_TYPES];
 if (typeInfo) {
 return { description: typeInfo.description };
 }
 // Fallback for safety, though should not be reached with valid data
 switch (performanceType) {
 case 'Solo': return { description: 'Individual performance' };
 case 'Duet': return { description: 'Two dancers together' };
 case 'Trio': return { description: 'Three dancers together' };
 case 'Group': return { description: '4+ dancers together' };
 default: return { description: 'Performance' };
 }
 };

 const getStartingFee = (performanceType: string, event?: Event) => {
 // Use event-specific fee structure if available, otherwise use defaults
 const currency = event?.currency || 'ZAR';
 const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
 
 if (performanceType === 'Solo') {
 return event?.solo1Fee || 400; // First solo fee
 } else if (performanceType === 'Duet' || performanceType === 'Trio') {
 return event?.duoTrioFeePerDancer || 280; // Per person
 } else if (performanceType === 'Group') {
 return event?.groupFeePerDancer || 220; // Per person for small groups
 }
 return 0; // Default case
 };

 const getFeeExplanation = (performanceType: string, event?: Event) => {
 const currency = event?.currency || 'ZAR';
 const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'R';
 const regFee = event?.registrationFeePerDancer || 300;
 
 if (performanceType === 'Solo') {
 const solo1 = event?.solo1Fee || 400;
 const solo2 = event?.solo2Fee || 750;
 const solo3 = event?.solo3Fee || 1050;
 const additional = event?.soloAdditionalFee || 100;
 return `Solo packages: 1st solo ${symbol}${solo1}, 2 solos ${symbol}${solo2}, 3 solos ${symbol}${solo3}, additional solos ${symbol}${additional} each. Plus ${symbol}${regFee} registration.`;
 } else if (performanceType === 'Duet' || performanceType === 'Trio') {
 const duoTrioFee = event?.duoTrioFeePerDancer || 280;
 return `${symbol}${duoTrioFee} per person + ${symbol}${regFee} registration each`;
 } else if (performanceType === 'Group') {
 const smallGroupFee = event?.groupFeePerDancer || 220;
 const largeGroupFee = event?.largeGroupFeePerDancer || 190;
 return `Small groups (4-9): ${symbol}${smallGroupFee}pp, Large groups (10+): ${symbol}${largeGroupFee}pp. Plus ${symbol}${regFee} registration each.`;
 }
 return `Per person + ${symbol}${regFee} registration each`;
 };

 if (!region || (!eodsaId && !studioId)) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="max-w-md w-full glass-panel backdrop-blur-xl rounded-3xl shadow-2xl border border-[rgba(192,192,192,0.22)] p-8 text-center">
 <div className="text-6xl mb-6"></div>
 <h2 className="text-2xl font-bold text-white mb-4">Missing Information</h2>
 <p className="text-gray-300 mb-6">Authentication not provided for Nationals dashboard.</p>
 <Link 
 href="/" className="block w-full px-6 py-3 btn-chrome !rounded-full text-white rounded-xl transition-all duration-300 font-semibold" >
 Back to Home
 </Link>
 </div>
 </div> );
 }

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="text-center"> {/* Modern Loading Animation */}
 <div className="relative w-20 h-20 mx-auto mb-8">
 <div className="absolute inset-0 rounded-full border-4 border-[rgba(192,192,192,0.2)]"></div>
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[var(--chrome-mid)] animate-spin"></div>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-2xl"></span>
 </div>
 </div> {/* Loading Text */}
 <div className="space-y-2">
 <h3 className="text-xl font-bold text-white">Loading Nationals Events</h3>
 <p className="text-slate-400 text-sm">Preparing your competition dashboard...</p>
 </div> {/* Loading Steps Animation */}
 <div className="mt-6 flex justify-center space-x-2"> {[1, 2, 3].map((i) => (
 <div
 key={i}
 className="w-2 h-2 bg-[var(--chrome-mid)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}
 ></div> ))}
 </div>
 </div>
 </div> );
 }

 return (
 <div className="min-h-screen avalon-mesh"> {/* Mobile-optimized header with better spacing */}
 <div className="sticky top-0 z-10 bg-[rgba(5,5,5,0.92)] backdrop-blur-lg border-b border-[rgba(192,192,192,0.12)]">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"> {/* Back Navigation */}
 <div className="mb-4">
 <Link 
 href={isStudioMode ? `/studio-dashboard?studioId=${studioId}` : `/`}
 className="inline-flex items-center space-x-2 px-3 py-2 btn-outline-chrome !rounded-lg !px-3 !py-2 text-slate-300 group text-sm" >
 <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
 </svg>
 <span className="hidden sm:inline">{isStudioMode ? 'Back to Studio Dashboard' : 'Back to Main Portal'}</span>
 <span className="sm:hidden">Back</span>
 </Link>
 </div> {/* Header */}
 <div className="text-center">
 <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
 <span className="chrome-text"> EODSA Competitions
 </span></h1>
 <p className="text-slate-400 text-sm sm:text-base mb-2"> Select your competition (Nationals, Regionals or Qualifiers) and then enter your performances.
 </p> {events.length > 0 && (
 <p className="text-xs sm:text-sm text-slate-300 mb-4">
 <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/40 text-[11px] sm:text-xs font-medium"> 🔓 {events.length} competition{events.length === 1 ? '' : 's'} currently open for entry
 </span>
 </p> )}
 
 {/* User Info Card - Mobile Optimized */}
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
 {contestant?.type === 'studio' && contestant.studioName && 
 ` • ${contestant.studioName}`
 }
 {contestant?.type === 'private' && ' • Independent'}
 </p>
 </div> )}
 </div> )}
 </div>
 </div>
 </div> {/* Main Content */}
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"> {events.length > 0 ? (
 <div className="space-y-8 sm:space-y-12"> {events.map((event) => {
 const tier = getEventTier(event as any);
 return (
 <div key={event.id} className="group"> {/* Event Header */}
 <div className="relative mb-6 sm:mb-8">
 <div className="relative glass-panel rounded-2xl p-4 sm:p-6 border border-[rgba(192,192,192,0.22)] hover:border-[rgba(192,192,192,0.35)] transition-all duration-500">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div className="flex items-center space-x-3 sm:space-x-4">
 <div className="relative">
 <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[rgba(192,192,192,0.12)] border border-[rgba(192,192,192,0.35)] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
 <div className="text-2xl sm:text-3xl"></div>
 </div>
 </div>  <div>
 <div className="flex flex-wrap items-center gap-2 mb-1">
 <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] sm:text-xs font-semibold ${tier.classes}`}> {tier.label}
 </span>
 </div>
 <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white"> {event.name}</h2>
 <p className="text-slate-400 text-sm sm:text-base">{event.description}</p>
 <div className="flex flex-wrap gap-2 mt-2">
 <span className="inline-flex items-center px-2 py-1 bg-emerald-500/20 text-[var(--chrome-mid)] rounded-lg text-xs font-medium">
 <div className="w-2 h-2 bg-emerald-400 rounded-full mr-1 animate-pulse"></div> Open for Registration
 </span>
 <span className="inline-flex items-center px-2 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded-lg text-xs font-medium"> All Performance Types
 </span>
 </div>
 </div>
 </div>  <div className="hidden sm:flex items-center space-x-6">
 <div className="text-center">
 <p className="text-xl lg:text-2xl font-bold text-[var(--chrome-mid)]">{new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
 <p className="text-xs lg:text-sm text-slate-400 uppercase tracking-wide">Event Date</p>
 </div>
 {(event as any).eventType !== 'AUDITION_EVENT' && (
 <div className="text-center">
 <p className="text-xl lg:text-2xl font-bold text-[var(--chrome-mid)]">{event.venue}</p>
 <p className="text-xs lg:text-sm text-slate-400 uppercase tracking-wide">Venue</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div> {/* Event Details Card */}
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-6 sm:p-8"> {/* Event Details Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
 <div className="space-y-4">
 <div>
 <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Event Date</p>
 <p className="text-slate-200 text-lg font-medium"> {new Date(event.eventDate).toLocaleDateString('en-US', {
 weekday: 'long',
 month: 'long',
 day: 'numeric',
 year: 'numeric'
 })}
 </p>
 </div>
 <div>
 <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Age Categories</p>
 <p className="text-slate-200 text-lg font-medium">{event.ageCategory}</p>
 </div>
 </div>  <div className="space-y-4">
 {(event as any).eventType !== 'AUDITION_EVENT' && (
 <div>
 <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Venue</p>
 <p className="text-slate-200 text-lg font-medium">{event.venue}</p>
 </div>
 )}
 <div>
 <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold mb-2">Performance Types</p>
 <div className="flex flex-wrap gap-2">
 <span className="inline-flex items-center px-3 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded-lg text-sm font-medium"> Solo</span>
 <span className="inline-flex items-center px-3 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded-lg text-sm font-medium">👯 Duet</span>
 <span className="inline-flex items-center px-3 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded-lg text-sm font-medium"> Trio</span>
 <span className="inline-flex items-center px-3 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded-lg text-sm font-medium"> Group</span>
 </div>
 </div>
 </div>
 </div> {/* Pricing */}
 {(event as any).eventType === 'AUDITION_EVENT' ? (
 <p className="mb-6 text-slate-200">{(event as any).auditionPaymentType === 'paid' ? `Entry fee: R${Number((event as any).auditionFlatFee || 0).toFixed(2)} per entry` : 'Free audition'}</p>
 ) : (
 <EventPricingPanel event={event} className="mb-6" />
 )} {/* Registration Deadline */}
 <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
 <div className="flex items-center space-x-2 mb-2">
 <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
 </svg>
 <span className="text-amber-300 font-medium">Registration Deadline</span>
 </div>
 <p className="text-amber-200 mb-2"> {new Date(event.registrationDeadline).toLocaleDateString('en-US', {
 weekday: 'long',
 month: 'long',
 day: 'numeric',
 year: 'numeric'
 })}
 </p>
 <CountdownTimer deadline={event.registrationDeadline} />
 </div> {/* Enter Competition Button */}
 <button
 onClick={() => router.push(`/event-dashboard/${region}/competition?${isStudioMode ? `studioId=${studioId}` : `eodsaId=${eodsaId}`}&eventId=${event.id}`)}
 className="w-full group/btn relative overflow-hidden px-6 py-4 btn-chrome !rounded-full text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl hover:shadow-[0_0_24px_rgba(192,192,192,0.18)]" >
 <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
 <div className="relative flex items-center justify-center space-x-2">
 <span className="text-lg">Enter Competition</span>
 <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
 </svg>
 </div>
 </button>
 </div>
 </div> );
 })}
 </div> ) : (
 <div className="text-center py-16 sm:py-24">
 <div className="relative">
 <div className="relative glass-panel rounded-3xl p-8 sm:p-12 border border-[rgba(192,192,192,0.22)]">
 <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 bg-[rgba(192,192,192,0.12)] border border-[rgba(192,192,192,0.35)] rounded-2xl flex items-center justify-center">
 <span className="text-3xl sm:text-4xl"></span>
 </div>
 <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">No Events Available</h3>
 <p className="text-slate-400 max-w-md mx-auto leading-relaxed"> There are currently no open events (Nationals, Regionals or Qualifiers). Check back soon or contact support for more information.
 </p>
 </div>
 </div>
 </div> )}
 </div>
 </div> );
}
