'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AvalonShell } from '@/components/brand/AvalonShell';
import { RecaptchaV2 } from '@/components/RecaptchaV2';
import { MASTERY_LEVELS, ITEM_STYLES, getMedalFromPercentage, resolveScoringEventType, getDashboardMedalColor } from '@/lib/types';
import MusicUpload from '@/components/MusicUpload';
import VideoUpload from '@/components/VideoUpload';
import VideoLinkInput from '@/components/VideoLinkInput';

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
 eventType?: string;
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
 hasCertificate?: boolean;
 hasPerformance?: boolean;
 performanceId?: string | null;
 scoresPublished?: boolean;
 isArchived?: boolean;
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
 videoExternalUrl?: string;
}

export default function StudioDashboardPage() {
 const [studioSession, setStudioSession] = useState<StudioSession | null>(null);
 const [acceptedDancers, setAcceptedDancers] = useState<AcceptedDancer[]>([]);
 const [competitionEntries, setCompetitionEntries] = useState<CompetitionEntry[]>([]);
 const [musicEntries, setMusicEntries] = useState<MusicEntry[]>([]);
 const [videoEntries, setVideoEntries] = useState<MusicEntry[]>([]);
 const [scores, setScores] = useState<any[]>([]);
 const [certificates, setCertificates] = useState<any[]>([]);
 const [activeTab, setActiveTab] = useState<'dancers' | 'entries' | 'entry-history' | 'uploads' | 'scores' | 'certificates'>('dancers');
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState('');
 const [events, setEvents] = useState<Array<{id: string; name: string; isArchived?: boolean}>>([]);
 const [historyEntries, setHistoryEntries] = useState<CompetitionEntry[]>([]);
 const [selectedEventId, setSelectedEventId] = useState<string>('all');
 const [selectedHistoryEventId, setSelectedHistoryEventId] = useState<string>('all');
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
 
 // Results/Certificate view state
 const [showResultsModal, setShowResultsModal] = useState(false);
 const [selectedEntryForResults, setSelectedEntryForResults] = useState<CompetitionEntry | null>(null);
 const [entryResults, setEntryResults] = useState<any>(null);
 const [loadingResults, setLoadingResults] = useState(false);
 
 // Certificate view state
 const [certificatePreviewUrl, setCertificatePreviewUrl] = useState<string | null>(null);
 const [certificateData, setCertificateData] = useState<any>(null);
 
 // Dancer list view state
 const [selectedDancerForActions, setSelectedDancerForActions] = useState<AcceptedDancer | null>(null);
 const [dancerSearchQuery, setDancerSearchQuery] = useState('');
 
 // Music upload state
 const [uploadingMusicForEntry, setUploadingMusicForEntry] = useState<string | null>(null);
 const [uploadingVideoForEntry, setUploadingVideoForEntry] = useState<string | null>(null);
 
 // Pagination and filtering state
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(10);
 const [sortBy, setSortBy] = useState<'name' | 'age' | 'joinedAt' | 'eodsaId'>('name');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
 const [ageFilter, setAgeFilter] = useState<'all' | 'under18' | '18plus'>('all');
 const [recentFilter, setRecentFilter] = useState<boolean>(false);
 
 const router = useRouter();

 // Calculate age properly accounting for birthday
 const calculateAge = (dateOfBirth: string): number => {
 if (!dateOfBirth) return 0;
 const today = new Date();
 const birthDate = new Date(dateOfBirth);
 let age = today.getFullYear() - birthDate.getFullYear();
 const monthDiff = today.getMonth() - birthDate.getMonth();
 if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
 age--;
 }
 return age;
 };

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
 loadEvents();
 }, [router]);

 const loadEvents = async () => {
 try {
 const response = await fetch('/api/events?scope=all');
 if (response.ok) {
 const data = await response.json();
 if (data.success) {
 setEvents(data.events.map((e: any) => ({ id: e.id, name: e.name, isArchived: e.isArchived })));
 }
 }
 } catch (error) {
 console.error('Error loading events:', error);
 }
 };

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
 
 // Load accepted dancers, competition entries, music entries, video entries, scores, and certificates
 const [dancersResponse, entriesResponse, historyEntriesResponse, musicEntriesResponse, videoEntriesResponse, scoresResponse, certificatesResponse] = await Promise.all([
 fetch(`/api/studios/dancers-new?studioId=${studioId}`),
 fetch(`/api/studios/entries?studioId=${studioId}&scope=current`),
 fetch(`/api/studios/entries?studioId=${studioId}&scope=history`),
 fetch(`/api/studios/music-entries?studioId=${studioId}`),
 fetch(`/api/studios/video-entries?studioId=${studioId}`),
 fetch(`/api/studios/scores?studioId=${studioId}`),
 fetch(`/api/studios/certificates?studioId=${studioId}`)
 ]);

 const dancersData = await dancersResponse.json();
 const entriesData = await entriesResponse.json();
 const historyEntriesData = await historyEntriesResponse.json();
 const musicEntriesData = await musicEntriesResponse.json();
 const videoEntriesData = await videoEntriesResponse.json();
 const scoresData = await scoresResponse.json();

 if (dancersData.success) {
 setAcceptedDancers(dancersData.dancers);
 } else {
 setError(dancersData.error || 'Failed to load dancers');
 }

 if (entriesData.success) {
 const entries = entriesData.entries;
 setCompetitionEntries(entries);
 
 // Fetch certificate status for entries
 if (entries.length > 0) {
 try {
 const entryIds = entries.map((e: CompetitionEntry) => e.id).join(',');
 const certStatusResponse = await fetch(`/api/studios/entries/certificates?entryIds=${entryIds}`);
 if (certStatusResponse.ok) {
 const certStatuses = await certStatusResponse.json();
 // Map certificate statuses to entries
 const entriesWithCertStatus = entries.map((entry: CompetitionEntry) => {
 const certStatus = certStatuses.find((cs: any) => cs.entryId === entry.id);
 return {
 ...entry,
 hasCertificate: certStatus?.hasCertificate || false,
 hasPerformance: certStatus?.hasPerformance || false,
 performanceId: certStatus?.performanceId || null,
 scoresPublished: certStatus?.scoresPublished || false
 };
 });
 setCompetitionEntries(entriesWithCertStatus);
 }
 } catch (error) {
 console.error('Error fetching certificate status:', error);
 // Continue without certificate status
 }
 }
 } else {
 console.error('Failed to load entries:', entriesData.error);
 setCompetitionEntries([]);
 }

 if (historyEntriesData.success) {
 setHistoryEntries(historyEntriesData.entries || []);
 } else {
 setHistoryEntries([]);
 }

 if (musicEntriesData.success) {
 setMusicEntries(musicEntriesData.entries);
 } else {
 console.error('Failed to load music entries:', musicEntriesData.error);
 setMusicEntries([]);
 }

 if (videoEntriesData.success) {
 setVideoEntries(videoEntriesData.entries);
 } else {
 console.error('Failed to load video entries:', videoEntriesData.error);
 setVideoEntries([]);
 }

 if (scoresData.success) {
 setScores(scoresData.scores);
 } else {
 console.error('Failed to load scores:', scoresData.error);
 setScores([]);
 }

 if (certificatesResponse.ok) {
 const certificatesData = await certificatesResponse.json();
 setCertificates(Array.isArray(certificatesData) ? certificatesData : []);
 } else {
 console.error('Failed to load certificates');
 setCertificates([]);
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
 const age = calculateAge(registerDancerData.dateOfBirth);
 
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

 const handleViewCertificate = async (entry: CompetitionEntry) => {
 if (!entry.performanceId) {
 setError('Performance not found for this entry');
 return;
 }

 try {
 setError('');
 
 // Try to get certificate URL from database via API
 const certResponse = await fetch(`/api/certificates/${entry.performanceId}`);
 if (certResponse.ok) {
 const certData = await certResponse.json();
 if (certData.certificateUrl) {
 setCertificateData(certData);
 setCertificatePreviewUrl(certData.certificateUrl);
 return;
 }
 }

 // Check if certificate exists via dedicated check endpoint
 const certCheckResponse = await fetch(
 `/api/certificates/check?performanceId=${entry.performanceId}&entryId=${entry.id}`
 );
 if (certCheckResponse.ok) {
 const checkData = await certCheckResponse.json();
 if (checkData.exists && checkData.certificateUrl) {
 setCertificatePreviewUrl(checkData.certificateUrl);
 return;
 }
 }

 // Fallback: Try to generate certificate image on the fly
 try {
 const certImageResponse = await fetch(`/api/certificates/${entry.performanceId}/image`);
 if (certImageResponse.ok) {
 const blob = await certImageResponse.blob();
 const imageUrl = URL.createObjectURL(blob);
 setCertificatePreviewUrl(imageUrl);
 return;
 } else {
 const errorText = await certImageResponse.text();
 let errorData;
 try {
 errorData = JSON.parse(errorText);
 } catch {
 errorData = { error: errorText || 'Unknown error' };
 }
 console.error('Certificate generation failed:', errorData);
 throw new Error(errorData.error || errorData.details || 'Certificate generation failed');
 }
 } catch (genError) {
 console.error('Certificate image generation error:', genError);
 throw new Error('Certificate not available. Please ensure scores have been published for this performance.');
 }
 } catch (error) {
 console.error('Error loading certificate:', error);
 const errorMessage = error instanceof Error ? error.message : 'Unknown error';
 setError(`Certificate unavailable: ${errorMessage}. Please use the Certificates tab to view available certificates.`);
 }
 };

 const handleDownloadCertificate = (certificateUrl: string) => {
 window.open(certificateUrl, '_blank');
 };

 const handleViewResults = async (entry: CompetitionEntry) => {
 if (!entry.performanceId) {
 setError('Performance not found for this entry');
 return;
 }

 try {
 setLoadingResults(true);
 setSelectedEntryForResults(entry);
 
 // Fetch certificate data and scores
 const [certResponse, scoresResponse] = await Promise.all([
 fetch(`/api/certificates/${entry.performanceId}`),
 fetch(`/api/scores/performance/${entry.performanceId}`)
 ]);

 const certData = certResponse.ok ? await certResponse.json() : null;
 const scoresData = scoresResponse.ok ? await scoresResponse.json() : null;

 // Calculate average score from scores
 let averageScore = 0;
 let scores: any[] = [];
 
 if (scoresData?.success && scoresData?.scoringStatus?.scores) {
 scores = scoresData.scoringStatus.scores;
 // Get full score details from studio scores endpoint
 try {
 const fullScoresResponse = await fetch(`/api/studios/scores?studioId=${studioSession?.id}`);
 if (fullScoresResponse.ok) {
 const fullScoresData = await fullScoresResponse.json();
 if (fullScoresData.success) {
 // Filter scores for this performance
 const performanceScores = fullScoresData.scores.filter((s: any) => s.performanceId === entry.performanceId);
 scores = performanceScores;
 
 // Calculate average
 if (performanceScores.length > 0) {
 const total = performanceScores.reduce((sum: number, score: any) => {
 return sum + (score.technicalScore || 0) + (score.musicalScore || 0) + 
 (score.performanceScore || 0) + (score.stylingScore || 0) + 
 (score.overallImpressionScore || 0);
 }, 0);
 averageScore = total / performanceScores.length;
 }
 }
 }
 } catch (error) {
 console.error('Error fetching full scores:', error);
 // Fall back to basic scores
 if (scores.length > 0) {
 const total = scores.reduce((sum: number, score: any) => sum + (score.totalScore || 0), 0);
 averageScore = total / scores.length;
 }
 }
 }

 setEntryResults({
 certificate: certData,
 scores: scores,
 averageScore: averageScore,
 medallion: certData?.medallion || 'N/A'
 });
 
 setShowResultsModal(true);
 } catch (error) {
 console.error('Error loading results:', error);
 setError('Failed to load results');
 } finally {
 setLoadingResults(false);
 }
 };

 const handleSaveEntryEdit = async () => {
 if (!studioSession || !editingEntry) return;

 if (!editEntryData.itemStyle?.trim()) {
 setError('Item Style is required. Please select a style.');
 return;
 }

 if (!editEntryData.itemName?.trim() || !editEntryData.mastery?.trim()) {
 setError('Please fill in all required fields (Item Name, Mastery, and Style).');
 return;
 }

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
 setSuccessMessage(` Music uploaded successfully for "${entryName}"! The entry has been updated and is now ready for the live performance.`);
 
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

 // Handle video upload for studio entries
 const handleVideoUpload = async (entryId: string, fileData: { url: string; originalFilename: string }) => {
 if (!studioSession) return;

 try {
 setUploadingVideoForEntry(entryId);
 setError('');

 // Find the entry name for better feedback
 const entry = videoEntries.find(e => e.id === entryId);
 const entryName = entry?.itemName || 'entry';

 const response = await fetch('/api/studios/upload-video', {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 studioId: studioSession.id,
 entryId: entryId,
 videoFileUrl: fileData.url,
 videoFileName: fileData.originalFilename
 }),
 });

 const data = await response.json();

 if (data.success) {
 setSuccessMessage(` Video uploaded successfully for "${entryName}"! The entry has been updated and is now ready for the virtual performance.`);
 
 // Reload data to reflect changes (entry should disappear from video uploads tab)
 await loadData(studioSession.id);
 
 // Clear success message after 7 seconds (longer to read the full message)
 setTimeout(() => setSuccessMessage(''), 7000);
 } else {
 setError(data.error || 'Failed to upload video');
 }
 } catch (error) {
 console.error('Video upload error:', error);
 setError('Failed to upload video');
 } finally {
 setUploadingVideoForEntry(null);
 }
 };

 const handleVideoLinkSubmit = async (entryId: string, videoUrl: string, videoType: 'youtube' | 'vimeo' | 'other') => {
 if (!studioSession) return;

 try {
 setUploadingVideoForEntry(entryId);
 setError('');
 
 const entryName = videoEntries.find(e => e.id === entryId)?.itemName || 'this entry';
 
 const response = await fetch('/api/studios/upload-video-link', {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 studioId: studioSession.id,
 entryId: entryId,
 videoExternalUrl: videoUrl,
 videoExternalType: videoType
 }),
 });

 const data = await response.json();

 if (data.success) {
 setSuccessMessage(` Video link saved successfully for "${entryName}"!`);
 
 // Reload data to reflect changes
 await loadData(studioSession.id);
 
 setTimeout(() => setSuccessMessage(''), 5000);
 } else {
 setError(data.error || 'Failed to save video link');
 }
 } catch (error) {
 console.error('Video link submit error:', error);
 setError('Failed to save video link');
 } finally {
 setUploadingVideoForEntry(null);
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

 // Filter data by selected event
 const getFilteredEntries = () => {
 if (selectedEventId === 'all') return competitionEntries;
 return competitionEntries.filter(entry => entry.eventId === selectedEventId);
 };

 const getFilteredHistoryEntries = () => {
 if (selectedHistoryEventId === 'all') return historyEntries;
 return historyEntries.filter(entry => entry.eventId === selectedHistoryEventId);
 };

 const activeEventIds = new Set(events.filter(e => !e.isArchived).map(e => e.id));

 const getFilteredUploads = () => {
 // Uploads tab only shows active (non-archived) events
 const allUploads = [...musicEntries, ...videoEntries].filter(entry => activeEventIds.size === 0 || activeEventIds.has(entry.eventId)
 );
 if (selectedEventId === 'all') return allUploads;
 return allUploads.filter(entry => entry.eventId === selectedEventId);
 };

 const getFilteredMusicEntries = () => {
 const active = musicEntries.filter(entry => activeEventIds.size === 0 || activeEventIds.has(entry.eventId));
 if (selectedEventId === 'all') return active;
 return active.filter(entry => entry.eventId === selectedEventId);
 };

 const getFilteredVideoEntries = () => {
 const active = videoEntries.filter(entry => activeEventIds.size === 0 || activeEventIds.has(entry.eventId));
 if (selectedEventId === 'all') return active;
 return active.filter(entry => entry.eventId === selectedEventId);
 };

 const getFilteredScores = () => {
 if (selectedEventId === 'all') return scores;
 return scores.filter(score => score.eventId === selectedEventId);
 };

 const getFilteredCertificates = () => {
 if (selectedEventId === 'all') return certificates;
 return certificates.filter((cert: any) => cert.eventId === selectedEventId);
 };

 // Reset pagination when search/filters change
 useEffect(() => {
 resetPagination();
 }, [dancerSearchQuery, ageFilter, recentFilter, sortBy, sortOrder, selectedEventId]);

 const getFilteredAndSortedDancers = () => {
 let filtered = acceptedDancers;
 
 // Apply search filter
 if (dancerSearchQuery.trim()) {
 const query = dancerSearchQuery.toLowerCase();
 filtered = filtered.filter(dancer => dancer.name.toLowerCase().includes(query) ||
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
 filtered = filtered.filter(dancer => new Date(dancer.joinedAt) >= thirtyDaysAgo
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
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto mb-4"></div>
 <p className="text-[var(--muted-foreground)] text-sm tracking-wide">Loading studio dashboard...</p>
 </div>
 </div> );
 }

 if (!studioSession) {
 return null; // Will redirect to login
 }

 return (
 <AvalonShell
 title="Studio Dashboard" userName={studioSession.name}
 userMeta={studioSession.registrationNumber ? `Reg ${studioSession.registrationNumber}` : undefined}
 onLogout={handleLogout}
 navItems={[
 { id: 'home', label: 'Home', href: '/studio-dashboard', icon: 'home', active: true },
 { id: 'events', label: 'Events', href: `/event-dashboard?studioId=${studioSession.id}`, icon: 'events' },
 { id: 'profile', label: 'Profile', href: '/studio-dashboard', icon: 'profile' },
 ]}
 >
 <style jsx global>{`
 .pb-safe-bottom {
 padding-bottom: max(env(safe-area-inset-bottom, 24px), 24px);
 }
 
 @media screen and (max-width: 414px) and (min-height: 800px) {
 .pb-safe-bottom {
 padding-bottom: 140px;
 }
 }
 `}</style>  <div className="pb-safe-bottom space-y-6 overflow-x-hidden"> {/* Dashboard Header */}
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
 <div>
 <h1 className="font-display text-4xl sm:text-5xl chrome-text leading-none mb-2">Studio Dashboard</h1>
 <p className="text-sm text-[var(--muted-foreground)]"> {studioSession.email}
 {studioSession.registrationNumber ? ` · Reg: ${studioSession.registrationNumber}` : ''}
 </p>
 </div>
 <Link
 href={`/event-dashboard?studioId=${studioSession.id}`}
 className="btn-chrome self-start sm:self-auto" >
 <Plus className="w-4 h-4" /> Enter Event
 </Link>
 </div> {error && (
 <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-xl p-4">
 <p className="text-red-300">{error}</p>
 <button 
 onClick={() => setError('')}
 className="text-red-400 hover:text-red-300 text-sm mt-2" >
 Dismiss
 </button>
 </div> )}

 {successMessage && (
 <div className="mb-6 bg-green-900/20 border border-[rgba(192,192,192,0.22)] rounded-xl p-4">
 <p className="text-green-300">{successMessage}</p>
 <button 
 onClick={() => setSuccessMessage('')}
 className="text-[var(--chrome-mid)] hover:text-green-300 text-sm mt-2" >
 Dismiss
 </button>
 </div> )}

 {/* Studio Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
 <div className="glass-panel rounded-2xl p-6 border border-[rgba(192,192,192,0.22)]">
 <div className="flex items-center">
 <div className="w-12 h-12 bg-[rgba(192,192,192,0.15)] border border-[rgba(192,192,192,0.35)] rounded-lg flex items-center justify-center mr-4">
 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-white">Total Dancers</h3>
 <p className="text-3xl font-bold text-[var(--chrome-mid)]">{stats.totalDancers}</p>
 </div>
 </div>
 </div>  <div className="glass-panel rounded-2xl p-6 border border-[rgba(192,192,192,0.22)]">
 <div className="flex items-center">
 <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 <div>
 <h3 className="text-lg font-semibold text-white">Competition Entries</h3>
 <p className="text-3xl font-bold text-[var(--chrome-mid)]">{stats.totalEntries}</p>
 </div>
 </div>
 </div>  <div className="glass-panel rounded-2xl p-6 border border-[rgba(192,192,192,0.22)]">
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
 </div>  <div className="glass-panel rounded-2xl p-6 border border-[rgba(192,192,192,0.22)]">
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
 </div> {/* Tab Navigation */}
 <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
 <div className="flex min-w-max sm:min-w-0 sm:w-full gap-1 glass-panel rounded-lg p-1">
 <button
 onClick={() => setActiveTab('dancers')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'dancers'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 > My Dancers ({acceptedDancers.length})
 </button>
 <button
 onClick={() => setActiveTab('entries')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'entries'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 > Current Entries ({getFilteredEntries().length}{selectedEventId !== 'all' ? `/${competitionEntries.length}` : ''})
 </button>
 <button
 onClick={() => setActiveTab('entry-history')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'entry-history'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 > Entry History ({getFilteredHistoryEntries().length}{selectedHistoryEventId !== 'all' ? `/${historyEntries.length}` : ''})
 </button>
 <button
 onClick={() => setActiveTab('uploads')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'uploads'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 > 📁 Uploads ({getFilteredUploads().length}{selectedEventId !== 'all' ? `/${musicEntries.length + videoEntries.length}` : ''})
 </button>
 <button
 onClick={() => setActiveTab('scores')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'scores'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 >  Scores ({getFilteredScores().length}{selectedEventId !== 'all' ? `/${scores.length}` : ''})
 </button>
 <button
 onClick={() => setActiveTab('certificates')}
 className={`flex-shrink-0 sm:flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
 activeTab === 'certificates'
 ? 'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.35)]'
 : 'text-gray-300 hover:text-white hover:bg-gray-700'
 }`}
 >  Certificates ({getFilteredCertificates().length}{selectedEventId !== 'all' ? `/${certificates.length}` : ''})
 </button>
 </div>
 </div> {/* Dancers Tab */}
 {activeTab === 'dancers' && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex justify-between items-start mb-6">
 <div className="flex-1">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-xl font-bold text-white">My Dancers</h3>
 <p className="text-gray-400 text-sm"> Manage your studio dancers ({getPaginatedDancers().totalCount} found, {acceptedDancers.length} total)
 </p>
 </div>
 </div> {/* Enhanced Search and Filters */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4"> {/* Search Input */}
 <div className="lg:col-span-4">
 <div className="relative">
 <input
 type="text" value={dancerSearchQuery}
 onChange={(e) => setDancerSearchQuery(e.target.value)}
 placeholder="Search by name, Element of Dance ID, National ID, or email..." className="w-full px-4 py-2 pl-10 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" />
 <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 </div>
 </div> {/* Age Filter */}
 <div className="lg:col-span-2">
 <select
 value={ageFilter}
 onChange={(e) => setAgeFilter(e.target.value as 'all' | 'under18' | '18plus')}
 className="w-full px-3 py-2 border border-gray-600 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Ages</option>
 <option value="under18">Under 18</option>
 <option value="18plus">18+</option>
 </select>
 </div> {/* Recent Filter */}
 <div className="lg:col-span-2">
 <label className="flex items-center space-x-2 text-white">
 <input
 type="checkbox" checked={recentFilter}
 onChange={(e) => setRecentFilter(e.target.checked)}
 className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500" />
 <span className="text-sm">Recent (30d)</span>
 </label>
 </div> {/* Sort By */}
 <div className="lg:col-span-2">
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as 'name' | 'age' | 'joinedAt' | 'eodsaId')}
 className="w-full px-3 py-2 border border-gray-600 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="name">Sort by Name</option>
 <option value="age">Sort by Age</option>
 <option value="joinedAt">Sort by Join Date</option>
 <option value="eodsaId">Sort by EODSA ID</option>
 </select>
 </div> {/* Sort Order */}
 <div className="lg:col-span-2">
 <button
 onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
 className="w-full px-3 py-2 border border-gray-600 bg-black/40 rounded-lg text-white hover:bg-gray-600 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] flex items-center justify-center space-x-1" >
 <span className="text-sm">{sortOrder === 'asc' ? '↑' : '↓'}</span>
 <span className="text-sm">{sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
 </button>
 </div>
 </div> {/* Items Per Page */}
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <span className="text-sm text-gray-400">Show:</span>
 <select
 value={itemsPerPage}
 onChange={(e) => setItemsPerPage(Number(e.target.value))}
 className="px-2 py-1 border border-gray-600 bg-black/40 rounded text-white text-sm focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value={5}>5</option>
 <option value={10}>10</option>
 <option value={25}>25</option>
 <option value={50}>50</option>
 <option value={100}>100</option>
 </select>
 <span className="text-sm text-gray-400">per page</span>
 </div>  <div className="text-sm text-gray-400"> Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, getPaginatedDancers().totalCount)} of {getPaginatedDancers().totalCount}
 </div>
 </div>
 </div>
 </div> {/* Action Buttons */}
 <div className="flex flex-col sm:flex-row gap-2">
 <button
 onClick={() => setShowRegisterDancerModal(true)}
 className="btn-chrome" >
 <Plus className="w-4 h-4" />
 <span>Register New Dancer</span>
 </button>
 <button
 onClick={() => setShowAddDancerModal(true)}
 className="btn-outline-chrome" >
 <Plus className="w-4 h-4" />
 <span>Add by EODSA ID</span>
 </button>
 </div>
 </div> {acceptedDancers.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 </div>
 <p className="text-gray-400 mb-2">No dancers in your studio yet</p>
 <p className="text-gray-500 text-sm">Start by registering new dancers or adding existing ones by EODSA ID</p>
 </div> ) : getPaginatedDancers().totalCount === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 </div>
 <p className="text-gray-400 mb-2">No dancers match your search criteria</p>
 <p className="text-gray-500 text-sm">Try adjusting your search terms or filters</p>
 </div> ) : (
 /* Enhanced List View with Pagination */
 <>
 <div className="divide-y divide-gray-700"> {getPaginatedDancers().dancers.map((dancer) => (
 <div key={dancer.id} className="p-4 sm:p-6 hover:bg-gray-700/30 transition-colors">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center mb-3">
 <h4 className="text-lg font-semibold text-white mr-3">{dancer.name}</h4>
 <span className="px-3 py-1 bg-purple-900/30 text-[var(--chrome-light)] rounded-full text-sm font-medium"> Age {dancer.age}
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
 </div> {dancer.email && (
 <div>
 <span className="text-gray-400">Email:</span>
 <span className="text-white ml-2">{dancer.email}</span>
 </div> )}
 {dancer.phone && (
 <div>
 <span className="text-gray-400">Phone:</span>
 <span className="text-white ml-2">{dancer.phone}</span>
 </div> )}
 <div>
 <span className="text-gray-400">Date of Birth:</span>
 <span className="text-white ml-2">{new Date(dancer.dateOfBirth).toLocaleDateString()}</span>
 </div>
 </div>
 </div>
 <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full lg:w-auto lg:flex-shrink-0">
 <button
 onClick={() => handleEditDancer(dancer)}
 className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm" >
 Edit
 </button>
 <button
 onClick={() => handleDeleteDancer(dancer)}
 className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm" >
 Remove
 </button>
 <Link
 href={`/event-dashboard?eodsaId=${dancer.eodsaId}`}
 className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm text-center" >
 Enter Competitions
 </Link>
 </div>
 </div>
 </div> ))}
 </div> {/* Pagination Controls */}
 {getPaginatedDancers().totalPages > 1 && (
 <div className="p-6 border-t border-[rgba(192,192,192,0.15)] bg-gray-800/30">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <span className="text-sm text-gray-400"> Page {currentPage} of {getPaginatedDancers().totalPages}
 </span>
 </div>  <div className="flex items-center space-x-2">
 <button
 onClick={() => setCurrentPage(1)}
 disabled={currentPage === 1}
 className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm" >
 First
 </button>
 <button
 onClick={() => setCurrentPage(currentPage - 1)}
 disabled={currentPage === 1}
 className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm" >
 Previous
 </button> {/* Page Numbers */}
 <div className="flex items-center space-x-1"> {Array.from({ length: Math.min(5, getPaginatedDancers().totalPages) }, (_, i) => {
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
 > {pageNum}
 </button> );
 })}
 </div>  <button
 onClick={() => setCurrentPage(currentPage + 1)}
 disabled={currentPage === getPaginatedDancers().totalPages}
 className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm" >
 Next
 </button>
 <button
 onClick={() => setCurrentPage(getPaginatedDancers().totalPages)}
 disabled={currentPage === getPaginatedDancers().totalPages}
 className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm" >
 Last
 </button>
 </div>
 </div>
 </div> )}
 </> )}
 </div> )}

 {/* Current Entries Tab */}
 {activeTab === 'entries' && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-4 sm:p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col gap-4">
 <div>
 <h3 className="text-xl font-bold text-white">Current Events</h3>
 <p className="text-gray-400 text-sm mt-1">Active competition entries for your dancers</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Active Events</option> {events.filter(e => !e.isArchived).map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <Link
 href={`/event-dashboard?studioId=${studioSession?.id}`}
 className="w-full sm:w-auto sm:flex-shrink-0 btn-chrome" >
 <Plus className="w-4 h-4 flex-shrink-0" />
 <span>Add New Entry</span>
 </Link>
 </div>
 </div>
 </div> {getFilteredEntries().length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 </div>
 <p className="text-gray-400 mb-2"> {competitionEntries.length === 0 
 ? 'No competition entries yet' 
 : 'No entries found for selected event'}
 </p>
 <p className="text-gray-500 text-sm mb-6"> {competitionEntries.length === 0 
 ? 'Start entering your dancers into competitions to see entries here'
 : 'Change the event filter to see entries from other events.'}
 </p> {competitionEntries.length === 0 && (
 <Link
 href={`/event-dashboard?studioId=${studioSession?.id}`}
 className="inline-flex items-center justify-center btn-chrome" >
 <Plus className="w-4 h-4" />
 <span>Add New Entry</span>
 </Link> )}
 </div> ) : (
 <div className="divide-y divide-gray-700"> {getFilteredEntries().map((entry) => (
 entry.eventType === 'AUDITION_EVENT' ? (
 <div key={entry.id} className="p-4 sm:p-6">
 <h4 className="text-lg font-semibold text-white">{entry.eventName}</h4>
 <p className="mt-2 text-sm text-emerald-300">Entry Submitted</p>
 </div>
 ) : (
 <div key={entry.id} className="p-4 sm:p-6 hover:bg-gray-700/30 transition-colors">
 <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-3">
 <h4 className="text-lg font-semibold text-white">{entry.eventName}</h4>
 <span className={`px-3 py-1 rounded-full text-sm font-medium ${
 entry.approved 
 ? 'bg-green-900/30 text-green-300' 
 : 'bg-yellow-900/30 text-yellow-300'
 }`}> {entry.approved ? 'Approved' : 'Pending'}
 </span> {entry.itemNumber && (
 <span className="px-2 py-1 bg-purple-900/30 text-[var(--chrome-light)] rounded text-xs"> #{entry.itemNumber}
 </span> )}
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
 </div> {/* Duration hidden by request */}
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
 <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-auto lg:flex-shrink-0"> {/* View Results for Groups/Trios/Duos */}
 {(entry.performanceType === 'Duet' || entry.performanceType === 'Trio' || entry.performanceType === 'Group') && entry.hasPerformance && (
 <button
 onClick={() => handleViewResults(entry)}
 className="w-full sm:w-auto lg:w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center justify-center space-x-2" >
 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 <span>View Results</span>
 </button> )}
 <button
 onClick={() => handleEditEntry(entry)}
 className="w-full sm:w-auto lg:w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm" >
 Edit Entry
 </button>
 <div className="px-3 py-1 text-xs text-gray-400 italic bg-[rgba(17,17,17,0.72)] rounded-lg border border-[rgba(192,192,192,0.15)] text-center sm:text-left"> Only admins can remove entries
 </div>
 </div>
 </div>
 </div>
 ) ))}
 </div> )}
 </div> )}

 {/* Entry History Tab */}
 {activeTab === 'entry-history' && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-4 sm:p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col gap-4">
 <div>
 <h3 className="text-xl font-bold text-white">Entry History</h3>
 <p className="text-gray-400 text-sm mt-1">Past archived events — scores and certificates remain available</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full">
 <select
 value={selectedHistoryEventId}
 onChange={(e) => setSelectedHistoryEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Archived Events</option> {events.filter(e => e.isArchived).map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 </div>
 </div>
 </div> {getFilteredHistoryEntries().length === 0 ? (
 <div className="p-8 text-center text-gray-400">
 <p className="text-lg mb-2">No archived entries yet</p>
 <p className="text-sm">When an admin archives an event, those entries appear here.</p>
 </div> ) : (
 <div className="divide-y divide-gray-700"> {getFilteredHistoryEntries().map((entry) => (
 entry.eventType === 'AUDITION_EVENT' ? (
 <div key={entry.id} className="p-4 sm:p-6">
 <h4 className="text-lg font-semibold text-white">{entry.eventName}</h4>
 <p className="mt-2 text-sm text-emerald-300">Entry Submitted</p>
 </div>
 ) : (
 <div key={entry.id} className="p-4 sm:p-6">
 <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <h4 className="text-lg font-semibold text-white">{entry.eventName}</h4>
 <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-200">Archived</span> {entry.approved && (
 <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/50 text-green-300">Approved</span> )}
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
 <span className="text-gray-400">Event Date:</span>
 <span className="text-white ml-2">{entry.eventDate ? new Date(entry.eventDate).toLocaleDateString() : '—'}</span>
 </div>
 <div>
 <span className="text-gray-400">Fee:</span>
 <span className="text-white ml-2">R{entry.calculatedFee}</span>
 </div>
 <div>
 <span className="text-gray-400">Payment:</span>
 <span className="text-white ml-2">{entry.paymentStatus}</span>
 </div>
 </div>
 </div>
 <div className="text-xs text-gray-500 italic"> Read-only historical record
 </div>
 </div>
 </div>
 ) ))}
 </div> )}
 </div> )}

 {/* Uploads Tab (Music & Video Combined) */}
 {activeTab === 'uploads' && (
 <div className="space-y-6"> {/* Music Uploads Section */}
 {getFilteredMusicEntries().length > 0 && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)] bg-gradient-to-r from-blue-900/30 to-purple-900/30">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <span></span>
 <span>Music Uploads (Live Performances)</span></h3>
 <p className="text-gray-400 text-sm mt-1">Upload music files for live performance entries</p>
 </div>
 <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto lg:flex-shrink-0">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <span className="px-3 py-1 bg-blue-900/50 text-blue-200 rounded-full text-xs font-medium border border-blue-700/50 text-center"> {getFilteredMusicEntries().length} {getFilteredMusicEntries().length === 1 ? 'entry' : 'entries'} need music
 </span>
 </div>
 </div>
 </div>  <div className="divide-y divide-gray-700"> {getFilteredMusicEntries().map((entry) => (
 <div key={entry.id} className="p-4 sm:p-6 hover:bg-gray-700/30 transition-colors">
 <div className="flex flex-col gap-6">
 <div className="flex-1">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
 <h4 className="text-lg font-semibold text-white">{entry.itemName}</h4>
 <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${
 entry.isGroupEntry 
 ? 'bg-purple-900/30 text-[var(--chrome-light)]' 
 : 'bg-blue-900/30 text-blue-300'
 }`}> {entry.isGroupEntry ? ` ${entry.performanceType}` : '🕺 Solo'}
 </span>
 <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"> Live
 </span>
 </div>  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
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
 </div>
 </div>  <div className="w-full">
 <div className="bg-slate-800/60 rounded-xl p-4 border border-gray-600">
 <h5 className="text-white font-medium mb-4 flex items-center text-lg"> Upload Music File</h5>
 <MusicUpload
 onUploadSuccess={(fileData) => handleMusicUpload(entry.id, fileData)}
 onUploadError={(error) => setError(error)}
 disabled={uploadingMusicForEntry === entry.id}
 /> {uploadingMusicForEntry === entry.id && (
 <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
 <div className="flex items-center text-blue-400">
 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
 <span className="font-medium">Uploading music for "{entry.itemName}"...</span>
 </div>
 </div> )}
 </div>
 </div>
 </div>
 </div> ))}
 </div>
 </div> )}

 {/* Video Uploads/Links Section */}
 {getFilteredVideoEntries().length > 0 && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)] bg-gradient-to-r from-indigo-900/30 to-purple-900/30">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <span></span>
 <span>Video Links (Virtual Performances)</span></h3>
 <p className="text-gray-400 text-sm mt-1">Enter YouTube or Vimeo links for virtual performance entries</p>
 </div>
 <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto lg:flex-shrink-0">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <span className="px-3 py-1 bg-indigo-900/50 text-indigo-200 rounded-full text-xs font-medium border border-indigo-700/50 text-center"> {getFilteredVideoEntries().length} {getFilteredVideoEntries().length === 1 ? 'entry' : 'entries'} need video
 </span>
 </div>
 </div>
 </div>  <div className="divide-y divide-gray-700"> {getFilteredVideoEntries().map((entry) => (
 <div key={entry.id} className="p-4 sm:p-6 hover:bg-gray-700/30 transition-colors">
 <div className="flex flex-col gap-6">
 <div className="flex-1">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
 <h4 className="text-lg font-semibold text-white">{entry.itemName}</h4>
 <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${
 entry.isGroupEntry 
 ? 'bg-purple-900/30 text-[var(--chrome-light)]' 
 : 'bg-blue-900/30 text-blue-300'
 }`}> {entry.isGroupEntry ? ` ${entry.performanceType}` : '🕺 Solo'}
 </span>
 <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-[rgba(192,192,192,0.22)]"> Virtual
 </span>
 </div>  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
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
 </div>
 </div>  <div className="w-full">
 <div className="bg-slate-800/60 rounded-xl p-4 border border-gray-600">
 <h5 className="text-white font-medium mb-4 flex items-center text-lg"> Enter Video Link</h5>
 <VideoLinkInput
 entryId={entry.id}
 currentLink={entry.videoExternalUrl || ''}
 onLinkSubmit={handleVideoLinkSubmit}
 disabled={uploadingVideoForEntry === entry.id}
 /> {uploadingVideoForEntry === entry.id && (
 <div className="mt-4 p-4 bg-indigo-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <div className="flex items-center text-indigo-400">
 <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400 mr-3"></div>
 <span className="font-medium">Saving video link for "{entry.itemName}"...</span>
 </div>
 </div> )}
 </div>
 </div>
 </div>
 </div> ))}
 </div>
 </div> )}

 {getFilteredUploads().length === 0 && (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
 </svg>
 </div>
 <p className="text-gray-400 mb-2"> {musicEntries.length === 0 && videoEntries.length === 0
 ? 'All entries have files uploaded' 
 : 'No uploads required for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {musicEntries.length === 0 && videoEntries.length === 0
 ? 'Entries that need music or video files will appear here'
 : 'All entries for this event have files uploaded, or change the event filter to see other events.'}
 </p>
 </div> )}
 </div> )}

 {/* Certificates Tab */}
 {activeTab === 'certificates' && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white"> Certificates</h3>
 <p className="text-gray-400 text-sm mt-1">View and download certificates for your dancers</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 </div>
 </div>
 </div> {error && (
 <div className="p-4 bg-red-900/20 border-b border-red-700/30">
 <p className="text-red-400 text-sm">{error}</p>
 </div> )}

 {getFilteredCertificates().length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl">📜</span>
 </div>
 <p className="text-gray-400 mb-2"> {certificates.length === 0 
 ? 'No certificates yet' 
 : 'No certificates found for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {certificates.length === 0 
 ? 'Certificates will appear here once they\'ve been generated for your dancers\' performances.'
 : 'Change the event filter to see certificates from other events.'}
 </p>
 </div> ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"> {getFilteredCertificates().map((cert: any) => (
 <div key={cert.id} className="bg-gray-900/50 rounded-xl border border-[rgba(192,192,192,0.15)] overflow-hidden hover:border-[rgba(192,192,192,0.35)] transition-all">
 <div
 className="relative h-48 cursor-pointer" onClick={() => {
 if (cert.certificateUrl) {
 setCertificatePreviewUrl(cert.certificateUrl);
 }
 }}
 > {cert.certificateUrl ? (
 <>
 <img
 src={cert.certificateUrl}
 alt={`Certificate for ${cert.title}`}
 className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center">
 <span className="text-white text-4xl opacity-0 hover:opacity-100 transition-opacity"></span>
 </div>
 </> ) : (
 <div className="w-full h-full flex items-center justify-center bg-gray-800">
 <span className="text-gray-500">No preview available</span>
 </div> )}
 </div>
 <div className="p-4">
 <h4 className="font-semibold text-white mb-2">{cert.title || 'Certificate'}</h4>
 <div className="space-y-1 text-sm">
 <p className="text-gray-400">
 <span className="text-gray-500">Style:</span> {cert.style || 'N/A'}
 </p>
 <p className="text-gray-400">
 <span className="text-gray-500">Score:</span> {cert.percentage}%
 </p>
 <p className="text-gray-400">
 <span className="text-gray-500">Medal:</span> {cert.medallion || 'N/A'}
 </p> {cert.eventDate && (
 <p className="text-gray-400">
 <span className="text-gray-500">Date:</span> {cert.eventDate}
 </p> )}
 {cert.eventName && (
 <p className="text-gray-400">
 <span className="text-gray-500">Event:</span> {cert.eventName}
 </p> )}
 </div>
 <div className="mt-4 flex gap-2"> {cert.certificateUrl && (
 <>
 <button
 onClick={() => handleDownloadCertificate(cert.certificateUrl)}
 className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold" >
 📥 Download
 </button>
 <button
 onClick={() => setCertificatePreviewUrl(cert.certificateUrl)}
 className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm" >
 
 </button>
 </> )}
 </div>
 </div>
 </div> ))}
 </div> )}
 </div> )}

 {/* Scores Tab */}
 {activeTab === 'scores' && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white"> Studio Scores</h3>
 <p className="text-gray-400 text-sm mt-1">View all published scores for your dancers</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <button
 onClick={() => studioSession && loadData(studioSession.id)}
 className="w-full sm:w-auto sm:flex-shrink-0 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" >
 ↻ Refresh
 </button>
 </div>
 </div>
 </div> {getFilteredScores().length === 0 ? (
 <div className="p-12 text-center">
 <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-6">
 <span className="text-3xl"></span>
 </div>
 <h4 className="text-xl font-semibold text-white mb-2"> {scores.length === 0 
 ? 'No Scores Available Yet' 
 : 'No Scores Found for Selected Event'}</h4>
 <p className="text-gray-400 max-w-md mx-auto leading-relaxed"> {scores.length === 0 
 ? 'Scores will appear here once judges have scored your dancers\' performances and the scores have been published.'
 : 'Change the event filter to see scores from other events.'}
 </p>
 </div> ) : (
 <div className="p-6">
 <div className="space-y-6"> {(() => {
 // Group scores by performance
 const filteredScoresList = getFilteredScores();
 const groupedScores = filteredScoresList.reduce((acc: any, score: any) => {
 const perfId = score.performanceId;
 if (!acc[perfId]) {
 acc[perfId] = {
 performanceId: perfId,
 performanceTitle: score.performanceTitle,
 dancerName: score.dancerName,
 eodsaId: score.eodsaId,
 eventType: score.eventType,
 region: score.region,
 scores: []
 };
 }
 acc[perfId].scores.push(score);
 return acc;
 }, {});

 // Calculate average scores
 const calculateTotalScore = (score: any) => {
 return Number(score.technicalScore) + Number(score.musicalScore) +
 Number(score.performanceScore) + Number(score.stylingScore) +
 Number(score.overallImpressionScore);
 };

 return Object.values(groupedScores).map((group: any) => {
 // Calculate average score for this performance
 const totalScores = group.scores.map((s: any) => calculateTotalScore(s));
 const avgScore = totalScores.reduce((sum: number, score: number) => sum + score, 0) / totalScores.length;
 const roundedAvg = Math.round(avgScore * 100) / 100;
 const scoringEventType = resolveScoringEventType({ eventType: group.eventType, region: group.region });
 const medal = getMedalFromPercentage(roundedAvg, scoringEventType);
 const medalColor = getDashboardMedalColor(medal.label);

 return (
 <div key={group.performanceId} className="bg-black/40 rounded-xl p-6 border border-gray-600">
 <div className="mb-4 pb-3 border-b border-gray-600">
 <div className="flex justify-between items-start">
 <div>
 <h4 className="text-xl font-bold text-white">{group.performanceTitle}</h4>
 <p className="text-sm text-gray-400 mt-1"> Dancer: <span className="text-white">{group.dancerName}</span> ({group.eodsaId})
 </p>
 </div>
 <div className="text-right">
 <div className={`text-4xl font-bold ${medalColor}`}> {roundedAvg}<span className="text-xl text-gray-400">/100</span>
 </div>
 <div className={`text-sm font-semibold ${medalColor}`}> AVERAGE SCORE
 </div>
 <div className={`text-xs font-semibold ${medalColor} mt-1`}> {medal.label} Medal
 </div>
 <div className="text-xs text-gray-400 mt-1"> From {group.scores.length} {group.scores.length === 1 ? 'judge' : 'judges'}
 </div>
 </div>
 </div>
 </div>  <div className="space-y-3">
 <p className="text-sm text-gray-400 font-semibold mb-2">Individual Judge Scores:</p> {group.scores.map((score: any) => {
 const totalScore = calculateTotalScore(score);
 const judgeMedal = getMedalFromPercentage(totalScore, scoringEventType);
 const judgeMedalColor = getDashboardMedalColor(judgeMedal.label);
 return (
 <div
 key={score.id}
 className="bg-[rgba(17,17,17,0.72)] rounded-lg p-4 border border-gray-600" >
 <div className="flex justify-between items-start mb-3">
 <div className="flex-1">
 <p className="text-sm font-semibold text-white">Judge: {score.judgeName}</p>
 <p className="text-xs text-gray-500">{new Date(score.scoredAt).toLocaleDateString()}</p>
 </div>
 <div className="text-right">
 <div className={`text-2xl font-bold ${judgeMedalColor}`}> {totalScore}<span className="text-sm text-gray-400">/100</span>
 </div>
 </div>
 </div>  <div className="grid grid-cols-5 gap-2 mb-3">
 <div className="text-center">
 <div className="text-xs font-bold text-blue-400">{score.technicalScore}</div>
 <div className="text-[9px] text-gray-500">Technical</div>
 </div>
 <div className="text-center">
 <div className="text-xs font-bold text-[var(--chrome-mid)]">{score.musicalScore}</div>
 <div className="text-[9px] text-gray-500">Musical</div>
 </div>
 <div className="text-center">
 <div className="text-xs font-bold text-[var(--chrome-mid)]">{score.performanceScore}</div>
 <div className="text-[9px] text-gray-500">Performance</div>
 </div>
 <div className="text-center">
 <div className="text-xs font-bold text-orange-400">{score.stylingScore}</div>
 <div className="text-[9px] text-gray-500">Styling</div>
 </div>
 <div className="text-center">
 <div className="text-xs font-bold text-pink-400">{score.overallImpressionScore}</div>
 <div className="text-[9px] text-gray-500">Overall</div>
 </div>
 </div> {score.comments && (
 <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
 <p className="text-xs text-blue-300 italic">{score.comments}</p>
 </div> )}
 </div> );
 })}
 </div>
 </div> );
 });
 })()}
 </div>
 </div> )}
 </div> )}
 </div> {/* Add Dancer Modal */}
 {showAddDancerModal && (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
 <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
 <h3 className="text-xl font-bold text-white mb-4">Add Dancer by Element of Dance ID</h3>
 <p className="text-gray-300 mb-4">Enter the Element of Dance ID of a dancer to add them to your studio.</p> {/* Error Message Display */}
 {error && (
 <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
 <div className="flex items-center">
 <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-red-300 text-sm font-medium">{error}</p>
 </div>
 </div> )}
 
 <input
 type="text" value={addDancerEodsaId}
 onChange={(e) => setAddDancerEodsaId(e.target.value.toUpperCase())}
 placeholder="e.g., E123456" className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] mb-4" />  <div className="flex space-x-3">
 <button
 onClick={handleAddDancer}
 disabled={addingDancer || !addDancerEodsaId.trim()}
 className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" >
 {addingDancer ? 'Adding...' : 'Add Dancer'}
 </button>
 <button
 onClick={() => {
 setShowAddDancerModal(false);
 setAddDancerEodsaId('');
 setError('');
 }}
 className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}

 {/* Register Dancer Modal */}
 {showRegisterDancerModal && (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
 <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
 <h3 className="text-xl font-bold text-white mb-4">Register New Dancer</h3> {/* Error Message Display */}
 {error && (
 <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
 <div className="flex items-center">
 <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-red-300 text-sm font-medium">{error}</p>
 </div>
 </div> )}
 
 <div className="space-y-4">
 <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Full Name *</label>
 <input
 type="text" value={registerDancerData.name}
 onChange={(e) => handleNameChange(e.target.value, setRegisterDancerData, 'name')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Date of Birth *</label>
 <input
 type="date" value={registerDancerData.dateOfBirth}
 onChange={(e) => handleDateOfBirthChange(e.target.value, setRegisterDancerData)}
 min="1900-01-01" max={new Date().toISOString().split('T')[0]}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">National ID *</label>
 <input
 type="text" value={registerDancerData.nationalId}
 onChange={(e) => handleNationalIdChange(e.target.value, setRegisterDancerData)}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" placeholder="13 digit ID number" maxLength={13}
 inputMode="numeric" title="Please enter exactly 13 digits" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Province *</label>
 <select
 value={registerDancerData.province}
 onChange={(e) => setRegisterDancerData({...registerDancerData, province: e.target.value})}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
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
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Email {calculateAge(registerDancerData.dateOfBirth) >= 18 && '*'}</label>
 <input
 type="email" value={registerDancerData.email}
 onChange={(e) => handleEmailChange(e.target.value, setRegisterDancerData, 'email')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Phone {calculateAge(registerDancerData.dateOfBirth) >= 18 && '*'}</label>
 <input
 type="tel" value={registerDancerData.phone}
 onChange={(e) => handlePhoneChange(e.target.value, setRegisterDancerData, 'phone')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" placeholder="081 234 5678" maxLength={15}
 />
 </div> {registerDancerData.dateOfBirth && calculateAge(registerDancerData.dateOfBirth) < 18 && (
 <>
 <div className="border-t border-[rgba(192,192,192,0.15)] pt-4">
 <h4 className="text-lg font-semibold text-white mb-2">Guardian Information (Required for minors)</h4>
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Name *</label>
 <input
 type="text" value={registerDancerData.guardianName}
 onChange={(e) => handleNameChange(e.target.value, setRegisterDancerData, 'guardianName')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Email *</label>
 <input
 type="email" value={registerDancerData.guardianEmail}
 onChange={(e) => handleEmailChange(e.target.value, setRegisterDancerData, 'guardianEmail')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Guardian Phone *</label>
 <input
 type="tel" value={registerDancerData.guardianPhone}
 onChange={(e) => handlePhoneChange(e.target.value, setRegisterDancerData, 'guardianPhone')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" placeholder="081 234 5678" maxLength={15}
 required
 />
 </div>
 </> )}
 
 <div className="pt-4">
 <RecaptchaV2 onVerify={(token) => setRecaptchaToken(token)} />
 </div>
 </div>  <div className="flex space-x-3 mt-6">
 <button
 onClick={handleRegisterDancer}
 disabled={isRegisteringDancer}
 className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" >
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
 className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}

 {/* Edit Dancer Modal */}
 {showEditDancerModal && editingDancer && (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
 <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6">
 <h3 className="text-xl font-bold text-white mb-4">Edit Dancer Information</h3> {/* Error Message Display */}
 {error && (
 <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
 <div className="flex items-center">
 <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-red-300 text-sm font-medium">{error}</p>
 </div>
 </div> )}
 
 <div className="space-y-4">
 <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Full Name *</label>
 <input
 type="text" value={editDancerData.name}
 onChange={(e) => handleNameChange(e.target.value, setEditDancerData, 'name')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Date of Birth *</label>
 <input
 type="date" value={editDancerData.dateOfBirth}
 onChange={(e) => handleDateOfBirthChange(e.target.value, setEditDancerData)}
 min="1900-01-01" max={new Date().toISOString().split('T')[0]}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">National ID *</label>
 <input
 type="text" value={editDancerData.nationalId}
 onChange={(e) => handleNationalIdChange(e.target.value, setEditDancerData)}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" placeholder="13 digit ID number" maxLength={13}
 inputMode="numeric" title="Please enter exactly 13 digits" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Email</label>
 <input
 type="email" value={editDancerData.email || ''}
 onChange={(e) => handleEmailChange(e.target.value, setEditDancerData, 'email')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Phone</label>
 <input
 type="tel" value={editDancerData.phone || ''}
 onChange={(e) => handlePhoneChange(e.target.value, setEditDancerData, 'phone')}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" placeholder="081 234 5678" maxLength={15}
 />
 </div>
 </div>  <div className="flex space-x-3 mt-6">
 <button
 onClick={handleUpdateDancer}
 disabled={isEditingDancer}
 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" >
 {isEditingDancer ? 'Updating...' : 'Update Dancer'}
 </button>
 <button
 onClick={() => {
 setShowEditDancerModal(false);
 setEditingDancer(null);
 setError('');
 }}
 className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}

 {/* Edit Entry Modal */}
 {showEditEntryModal && editingEntry && (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
 <div className="bg-gray-800 rounded-xl max-w-2xl w-full p-6">
 <h3 className="text-xl font-bold text-white mb-4">Edit Competition Entry</h3> {/* Error Message Display */}
 {error && (
 <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
 <div className="flex items-center">
 <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-red-300 text-sm font-medium">{error}</p>
 </div>
 </div> )}
 
 <div className="space-y-4">
 <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Item Name *</label>
 <input
 type="text" value={editEntryData.itemName}
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
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Choreographer</label>
 <input
 type="text" value={editEntryData.choreographer}
 onChange={(e) => {
 const cleanValue = e.target.value.replace(/[^a-zA-Z\s\-\']/g, '');
 setEditEntryData({...editEntryData, choreographer: cleanValue});
 }}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]"
 />
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Mastery Level *</label>
 <select
 value={editEntryData.mastery}
 onChange={(e) => setEditEntryData({...editEntryData, mastery: e.target.value})}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 >
 <option value="">Select mastery level</option> {MASTERY_LEVELS.map(level => (
 <option key={level} value={level}>{level}</option> ))}
 </select>
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1">Item Style *</label>
 <select
 value={editEntryData.itemStyle}
 onChange={(e) => setEditEntryData({...editEntryData, itemStyle: e.target.value})}
 className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 >
 <option value="">Select item style</option> {ITEM_STYLES.map(style => (
 <option key={style} value={style}>{style}</option> ))}
 </select>
 </div>  <div>
 <label className="block text-gray-300 text-sm font-medium mb-1"> Estimated Duration (minutes) *
 <span className="text-xs text-gray-400 block mt-1">Minimum: 30 seconds (0.5 minutes)</span>
 </label>
 <input
 type="number" value={editEntryData.estimatedDuration}
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
 min="0.5" max="3.5" step="0.1" className="w-full px-4 py-2 border border-gray-600 bg-black/40 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" required
 title="Minimum 30 seconds (0.5 minutes), maximum 3.5 minutes" />
 </div>
 </div>  <div className="flex space-x-3 mt-6">
 <button
 onClick={handleSaveEntryEdit}
 disabled={isEditingEntry}
 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" >
 {isEditingEntry ? 'Updating...' : 'Update Entry'}
 </button>
 <button
 onClick={() => {
 setShowEditEntryModal(false);
 setEditingEntry(null);
 setError('');
 }}
 className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}

 {/* Certificate Preview Modal */}
 {certificatePreviewUrl && (
 <div
 className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={() => {
 setCertificatePreviewUrl(null);
 setCertificateData(null);
 }}
 >
 <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={() => {
 setCertificatePreviewUrl(null);
 setCertificateData(null);
 }}
 className="absolute -top-12 right-0 text-white text-xl hover:text-gray-300 bg-[rgba(17,17,17,0.72)] px-4 py-2 rounded-lg" >
 ✕ Close
 </button> {certificatePreviewUrl && (
 <>
 <img
 src={certificatePreviewUrl}
 alt="Certificate Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
 <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
 <button
 onClick={() => handleDownloadCertificate(certificatePreviewUrl)}
 className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center space-x-2" >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 <span>Download Certificate</span>
 </button>
 </div>
 </> )}
 </div>
 </div> )}

 {/* Results/Certificate Modal */}
 {showResultsModal && selectedEntryForResults && (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
 <div className="bg-gray-800 rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
 <div className="flex justify-between items-start mb-4">
 <h3 className="text-xl font-bold text-white"> Results & Certificate - {selectedEntryForResults?.itemName || 'Entry'}</h3>
 <button
 onClick={() => {
 setShowResultsModal(false);
 setSelectedEntryForResults(null);
 setEntryResults(null);
 }}
 className="text-gray-400 hover:text-white" >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div> {loadingResults ? (
 <div className="flex justify-center items-center py-12">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--chrome-mid)]"></div>
 </div> ) : entryResults ? (
 <div className="space-y-6"> {/* Scores Section */}
 {entryResults.scores && entryResults.scores.length > 0 && (
 <div className="bg-black/40 rounded-lg p-4">
 <h4 className="text-lg font-semibold text-white mb-4">Scores</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-[rgba(17,17,17,0.72)] rounded-lg p-4">
 <div className="text-sm text-gray-400 mb-1">Average Score</div>
 <div className="text-3xl font-bold text-[var(--chrome-mid)]"> {entryResults.averageScore.toFixed(1)}
 <span className="text-lg text-gray-400">/100</span>
 </div>
 </div>
 <div className="bg-[rgba(17,17,17,0.72)] rounded-lg p-4">
 <div className="text-sm text-gray-400 mb-1">Medallion</div>
 <div className="text-2xl font-bold text-yellow-400"> {entryResults.medallion}
 </div>
 </div>
 </div>
 <div className="mt-4 space-y-2">
 <div className="text-sm text-gray-400 font-medium">Individual Judge Scores:</div> {entryResults.scores.map((score: any, index: number) => {
 const totalScore = (score.technicalScore || 0) + (score.musicalScore || 0) + 
 (score.performanceScore || 0) + (score.stylingScore || 0) + 
 (score.overallImpressionScore || 0);
 return (
 <div key={index} className="bg-[rgba(17,17,17,0.72)] rounded p-3 text-sm">
 <div className="flex justify-between items-center mb-2">
 <span className="text-white font-medium"> {score.judgeName || `Judge ${index + 1}`}
 </span>
 <span className="text-[var(--chrome-mid)] font-bold">{totalScore}/100</span>
 </div>
 <div className="grid grid-cols-5 gap-2 text-xs">
 <div>
 <div className="text-gray-400">Technical</div>
 <div className="text-white">{score.technicalScore || 0}</div>
 </div>
 <div>
 <div className="text-gray-400">Musical</div>
 <div className="text-white">{score.musicalScore || 0}</div>
 </div>
 <div>
 <div className="text-gray-400">Performance</div>
 <div className="text-white">{score.performanceScore || 0}</div>
 </div>
 <div>
 <div className="text-gray-400">Styling</div>
 <div className="text-white">{score.stylingScore || 0}</div>
 </div>
 <div>
 <div className="text-gray-400">Overall</div>
 <div className="text-white">{score.overallImpressionScore || 0}</div>
 </div>
 </div>
 </div> );
 })}
 </div>
 </div> )}

 {/* Certificate Section */}
 {entryResults.certificate && (
 <div className="bg-black/40 rounded-lg p-4">
 <h4 className="text-lg font-semibold text-white mb-4">Certificate</h4> {entryResults.certificate.certificateUrl ? (
 <div className="space-y-4">
 <div className="flex justify-center">
 <img
 src={entryResults.certificate.certificateUrl}
 alt="Certificate" className="max-w-full h-auto rounded-lg border border-gray-600" />
 </div>
 <div className="flex justify-center gap-4">
 <a
 href={entryResults.certificate.certificateUrl}
 target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" >
 Download Certificate
 </a>
 </div>
 <div className="grid grid-cols-2 gap-4 text-sm">
 <div>
 <span className="text-gray-400">Percentage:</span>
 <span className="text-white ml-2">{entryResults.certificate.percentage}%</span>
 </div>
 <div>
 <span className="text-gray-400">Medallion:</span>
 <span className="text-white ml-2">{entryResults.certificate.medallion}</span>
 </div>
 <div>
 <span className="text-gray-400">Style:</span>
 <span className="text-white ml-2">{entryResults.certificate.style}</span>
 </div>
 <div>
 <span className="text-gray-400">Date:</span>
 <span className="text-white ml-2">{entryResults.certificate.date}</span>
 </div>
 </div>
 </div> ) : (
 <div className="text-center py-8 text-gray-400"> Certificate not yet generated
 </div> )}
 </div> )}

 {!entryResults.certificate && !entryResults.scores.length && (
 <div className="text-center py-8 text-gray-400"> No results or certificate available yet
 </div> )}
 </div> ) : (
 <div className="text-center py-8 text-gray-400"> No results available
 </div> )}
 </div>
 </div> )}
 </AvalonShell> );
} 