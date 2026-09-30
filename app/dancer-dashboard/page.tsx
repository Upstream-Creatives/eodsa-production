'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MusicUpload from '@/components/MusicUpload';
import VirtualVideoUploadForm from '@/components/VirtualVideoUploadForm';
import { AvalonShell } from '@/components/brand/AvalonShell';
import { Plus } from 'lucide-react';
import { getMedalFromPercentage, resolveScoringEventType, getDashboardMedalColor } from '@/lib/types';

interface DancerSession {
 id: string;
 name: string;
 eodsaId: string;
 approved: boolean;
 email?: string;
}

interface StudioApplication {
 id: string;
 studioName: string;
 contactPerson: string;
 status: 'pending' | 'accepted' | 'rejected';
 appliedAt: string;
 respondedAt?: string;
 rejectionReason?: string;
}

interface Certificate {
 id: string;
 dancerName: string;
 percentage: number;
 style: string;
 title: string;
 medallion: string;
 eventDate: string;
 certificateUrl: string;
 sentAt?: string;
 downloaded: boolean;
 createdAt: string;
 eventId?: string;
 eventName?: string;
}

// Music Upload Section Component
function MusicUploadSection({ dancerSession, selectedEventId, events, onEventChange }: { dancerSession: DancerSession; selectedEventId: string; events: Array<{id: string; name: string}>; onEventChange: (eventId: string) => void }) {
 const [musicEntries, setMusicEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null);

 useEffect(() => {
 loadMusicEntries();
 }, [dancerSession.eodsaId]);

 const loadMusicEntries = async () => {
 try {
 const response = await fetch(`/api/contestants/music-entries?eodsaId=${dancerSession.eodsaId}`);
 const data = await response.json();
 
 if (data.success) {
 setMusicEntries(data.entries);
 } else {
 setError(data.error || 'Failed to load entries');
 }
 } catch (error) {
 console.error('Error loading music entries:', error);
 setError('Failed to load entries');
 } finally {
 setLoading(false);
 }
 };

 const handleMusicUpload = async (entryId: string, fileData: any) => {
 try {
 setUploadingEntryId(entryId);
 
 const response = await fetch('/api/contestants/upload-music', {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 entryId,
 musicFileUrl: fileData.url,
 musicFileName: fileData.originalFilename,
 eodsaId: dancerSession.eodsaId
 }),
 });

 const result = await response.json();
 
 if (result.success) {
 // Refresh the entries list
 await loadMusicEntries();
 } else {
 setError(result.error || 'Failed to upload music');
 }
 } catch (error) {
 console.error('Error uploading music:', error);
 setError('Failed to upload music');
 } finally {
 setUploadingEntryId(null);
 }
 };

 if (loading) {
 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-6">
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--chrome-mid)]"></div>
 <span className="ml-3 text-gray-300">Loading music upload requirements...</span>
 </div>
 </div> );
 }

 // Filter entries by selected event
 const filteredMusicEntries = selectedEventId === 'all' 
 ? musicEntries 
 : musicEntries.filter(entry => entry.eventId === selectedEventId);

 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white"> Music Uploads Required</h3>
 <p className="text-gray-400 text-sm mt-1">Upload music files for your live performance entries</p>
 </div>
 <select
 value={selectedEventId}
 onChange={(e) => onEventChange(e.target.value)}
 className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 </div>
 </div> {error && (
 <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200"> {error}
 </div> )}

 {filteredMusicEntries.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <p className="text-gray-400 mb-2"> {musicEntries.length === 0 
 ? 'No music uploads required' 
 : 'No music uploads required for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {musicEntries.length === 0 
 ? 'All your live entries already have music files uploaded, or you don\'t have any live entries yet.'
 : 'All entries for this event have music uploaded, or change the event filter to see other events.'}
 </p>
 </div> ) : (
 <div className="p-6">
 <div className="space-y-6"> {filteredMusicEntries.map((entry) => {
 const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
 const isOwner = entry.eodsaId === dancerSession.eodsaId;
 const performanceType = isGroupEntry 
 ? entry.participantIds.length === 2 ? 'Duet'
 : entry.participantIds.length === 3 ? 'Trio' 
 : 'Group'
 : 'Solo';
 
 return (
 <div key={entry.id} className="bg-black/40 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-[rgba(192,192,192,0.35)] transition-all duration-300">
 <div className="mb-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
 <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4> {/* Performance Type Badge */}
 <div className="flex items-center space-x-2">
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
 isGroupEntry 
 ? 'bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] border border-[rgba(192,192,192,0.22)]' 
 : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
 }`}> {isGroupEntry ? ` ${performanceType}` : '🕺 Solo'}
 </span> {/* Access Type Badge */}
 {isGroupEntry && (
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 isOwner 
 ? 'bg-green-500/20 text-green-300 border border-[rgba(192,192,192,0.22)]'
 : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
 }`}> {isOwner ? ' Owner' : '🤝 Participant'}
 </span> )}
 </div>
 </div>  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
 <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
 <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
 <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p> {/* Duration hidden by request */}
 </div> {/* Group Info */}
 {isGroupEntry && (
 <div className="mt-3 p-3 bg-purple-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-[var(--chrome-light)] text-sm font-medium mb-1"> Group Performance ({entry.participantIds.length} dancers)
 </p>
 <p className="text-purple-200 text-xs"> {isOwner 
 ? 'You registered this group entry. Any group member can upload music.'
 : 'You\'re a participant in this group. You can upload music for the entire group.'
 }
 </p>
 </div> )}
 
 <div className="border-t border-gray-600 pt-4 mt-4">
 <p className="text-sm text-gray-400 mb-3">Upload music file for this live performance:</p>
 <MusicUpload
 onUploadSuccess={(fileData) => handleMusicUpload(entry.id, fileData)}
 onUploadError={(error) => setError(error)}
 disabled={uploadingEntryId === entry.id}
 /> {uploadingEntryId === entry.id && (
 <div className="mt-2 text-sm text-blue-400 flex items-center">
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div> Saving music file...
 </div> )}
 </div>
 </div>
 </div> );
 })}
 </div>
 </div> )}
 </div> );
}

// Video Upload Section Component
function VideoUploadSection({ dancerSession, selectedEventId, events, onEventChange }: { dancerSession: DancerSession; selectedEventId: string; events: Array<{id: string; name: string}>; onEventChange: (eventId: string) => void }) {
 const [videoEntries, setVideoEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');

 useEffect(() => {
 loadVideoEntries();
 }, [dancerSession.eodsaId]);

 const loadVideoEntries = async () => {
 try {
 const response = await fetch(`/api/contestants/video-entries?eodsaId=${dancerSession.eodsaId}`);
 const data = await response.json();
 
 if (data.success) {
 setVideoEntries(data.entries);
 } else {
 setError(data.error || 'Failed to load entries');
 }
 } catch (error) {
 console.error('Error loading video entries:', error);
 setError('Failed to load entries');
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-6">
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--chrome-mid)]"></div>
 <span className="ml-3 text-gray-300">Loading video upload requirements...</span>
 </div>
 </div> );
 }

 // Filter entries by selected event
 const filteredVideoEntries = selectedEventId === 'all' 
 ? videoEntries 
 : videoEntries.filter(entry => entry.eventId === selectedEventId);

 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white"> Video Uploads Required</h3>
 <p className="text-gray-400 text-sm mt-1">Submit video links (YouTube/Vimeo/Google Drive) for your virtual performance entries</p>
 </div>
 <select
 value={selectedEventId}
 onChange={(e) => onEventChange(e.target.value)}
 className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 </div>
 </div> {error && (
 <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200"> {error}
 </div> )}

 {filteredVideoEntries.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <p className="text-gray-400 mb-2"> {videoEntries.length === 0 
 ? 'No virtual entries found' 
 : 'No virtual entries found for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {videoEntries.length === 0 
 ? 'You don\'t have any virtual entries yet, or change the event filter to see entries from other events.'
 : 'Submit or update video links for your virtual performance entries.'}
 </p>
 </div> ) : (
 <div className="p-6">
 <div className="space-y-6"> {filteredVideoEntries.map((entry) => {
 const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
 const isOwner = entry.eodsaId === dancerSession.eodsaId;
 const performanceType = isGroupEntry 
 ? entry.participantIds.length === 2 ? 'Duet'
 : entry.participantIds.length === 3 ? 'Trio' 
 : 'Group'
 : 'Solo';
 
 return (
 <div key={entry.id} className="bg-black/40 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-[rgba(192,192,192,0.35)] transition-all duration-300">
 <div className="mb-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
 <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4> {/* Performance Type Badge */}
 <div className="flex items-center space-x-2">
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
 isGroupEntry 
 ? 'bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] border border-[rgba(192,192,192,0.22)]' 
 : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
 }`}> {isGroupEntry ? ` ${performanceType}` : '🕺 Solo'}
 </span> {/* Virtual Badge */}
 <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-[rgba(192,192,192,0.22)]"> Virtual
 </span> {/* Access Type Badge */}
 {isGroupEntry && (
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 isOwner 
 ? 'bg-green-500/20 text-green-300 border border-[rgba(192,192,192,0.22)]'
 : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
 }`}> {isOwner ? ' Owner' : '🤝 Participant'}
 </span> )}
 </div>
 </div>  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
 <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
 <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
 <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p> {/* Duration hidden by request */}
 </div> {/* Group Info */}
 {isGroupEntry && (
 <div className="mt-3 p-3 bg-purple-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-[var(--chrome-light)] text-sm font-medium mb-1"> Group Performance ({entry.participantIds.length} dancers)
 </p>
 <p className="text-purple-200 text-xs"> {isOwner 
 ? 'You registered this group entry. Any group member can upload video.'
 : 'You\'re a participant in this group. You can upload video for the entire group.'
 }
 </p>
 </div> )}
 
 <div className="border-t border-gray-600 pt-4 mt-4">
 <VirtualVideoUploadForm
 entryId={entry.id}
 eodsaId={dancerSession.eodsaId}
 initialVideoUrl={entry.videoExternalUrl || entry.videoFileUrl}
 onSuccess={loadVideoEntries}
 />
 </div>
 </div>
 </div> );
 })}
 </div>
 </div> )}
 </div> );
}

// Scores & Feedback Section Component
function ScoresFeedbackSection({ dancerSession, selectedEventId, events, onEventChange }: { dancerSession: DancerSession; selectedEventId: string; events: Array<{id: string; name: string}>; onEventChange: (eventId: string) => void }) {
 const [scores, setScores] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [selectedScore, setSelectedScore] = useState<any | null>(null);
 const [showScoreDetails, setShowScoreDetails] = useState(false);
 const [isCollapsed, setIsCollapsed] = useState(false);

 useEffect(() => {
 loadScores();
 }, [dancerSession.eodsaId]);

 const loadScores = async () => {
 try {
 const response = await fetch(`/api/dancers/scores?eodsaId=${dancerSession.eodsaId}`);
 const data = await response.json();

 if (data.success) {
 // Group scores by performance
 const groupedScores = data.scores.reduce((acc: any, score: any) => {
 const perfId = score.performanceId;
 if (!acc[perfId]) {
 acc[perfId] = {
 performanceId: perfId,
 performanceTitle: score.performanceTitle,
 scores: [],
 averageScore: 0
 };
 }
 acc[perfId].scores.push(score);
 return acc;
 }, {});

 // Calculate average scores
 Object.keys(groupedScores).forEach(perfId => {
 const group = groupedScores[perfId];
 const totalScores = group.scores.map((s: any) => calculateTotalScore(s));
 const avgScore = totalScores.reduce((sum: number, score: number) => sum + score, 0) / totalScores.length;
 group.averageScore = Math.round(avgScore * 100) / 100; // Round to 2 decimals
 });

 // Convert back to array and flatten
 setScores(data.scores);
 } else {
 setError(data.error || 'Failed to load scores');
 }
 } catch (error) {
 console.error('Error loading scores:', error);
 setError('Failed to load scores');
 } finally {
 setLoading(false);
 }
 };

 const calculateTotalScore = (score: any) => {
 return Number(score.technicalScore) + Number(score.musicalScore) +
 Number(score.performanceScore) + Number(score.stylingScore) +
 Number(score.overallImpressionScore);
 };

 const getScoreMedal = (total: number, scoreOrGroup?: { eventType?: string; region?: string | null }) => {
 const scoringEventType = resolveScoringEventType({
 eventType: scoreOrGroup?.eventType,
 region: scoreOrGroup?.region
 });
 const medal = getMedalFromPercentage(total, scoringEventType);
 return {
 label: medal.label,
 color: getDashboardMedalColor(medal.label)
 };
 };

 if (loading) {
 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-6">
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--chrome-mid)]"></div>
 <span className="ml-3 text-gray-300">Loading scores...</span>
 </div>
 </div> );
 }

 return (
 <>
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white">  My Scores & Feedback
 {!loading && (
 <span className="text-sm font-normal text-gray-400 ml-2"> ({selectedEventId === 'all' ? scores.length : scores.filter(s => s.eventId === selectedEventId).length})
 </span> )}</h3>
 <p className="text-gray-400 text-sm mt-1">View your performance scores and judge feedback</p>
 </div>
 <div className="flex gap-2 items-center">
 <button
 onClick={() => setIsCollapsed(prev => !prev)}
 className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors" >
 {isCollapsed ? '▸ Show list' : '▾ Hide list'}
 </button>
 <select
 value={selectedEventId}
 onChange={(e) => onEventChange(e.target.value)}
 className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <button
 onClick={loadScores}
 disabled={loading}
 className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50" >
 {loading ? '🔄' : '↻'} Refresh
 </button>
 </div>
 </div>
 </div> {!isCollapsed && (
 <> {error && (
 <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200"> {error}
 </div> )}

 {(() => {
 // Filter scores by event
 const filteredScores = selectedEventId === 'all' 
 ? scores 
 : scores.filter(score => score.eventId === selectedEventId);
 
 if (filteredScores.length === 0) {
 return (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <p className="text-gray-400 mb-2"> {scores.length === 0 
 ? 'No scores available yet' 
 : 'No scores found for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {scores.length === 0 
 ? 'Scores will appear here after judges have scored your performances and they\'ve been approved.'
 : 'Change the event filter to see scores from other events.'}
 </p>
 </div> );
 }
 
 return (
 <div className="p-6">
 <div className="space-y-6"> {(() => {
 // Group scores by performance
 const groupedScores = filteredScores.reduce((acc: any, score: any) => {
 const perfId = score.performanceId;
 if (!acc[perfId]) {
 acc[perfId] = {
 performanceId: perfId,
 performanceTitle: score.performanceTitle,
 eventType: score.eventType,
 region: score.region,
 scores: []
 };
 }
 acc[perfId].scores.push(score);
 return acc;
 }, {});

 return Object.values(groupedScores).map((group: any) => {
 // Calculate average score for this performance
 const totalScores = group.scores.map((s: any) => calculateTotalScore(s));
 const avgScore = totalScores.reduce((sum: number, score: number) => sum + score, 0) / totalScores.length;
 const roundedAvg = Math.round(avgScore * 100) / 100;
 const avgMedal = getScoreMedal(roundedAvg, group);

 return (
 <div key={group.performanceId} className="bg-black/40 rounded-xl p-4 border border-gray-600">
 <div className="mb-4 pb-3 border-b border-gray-600">
 <div className="flex justify-between items-start">
 <h4 className="text-xl font-bold text-white">{group.performanceTitle}</h4>
 <div className="text-right">
 <div className={`text-4xl font-bold ${avgMedal.color}`}> {roundedAvg}<span className="text-xl text-gray-400">/100</span>
 </div>
 <div className={`text-sm font-semibold ${avgMedal.color}`}> AVERAGE SCORE
 </div>
 <div className={`text-xs font-semibold ${avgMedal.color} mt-1`}> {avgMedal.label} Medal
 </div>
 <div className="text-xs text-gray-400 mt-1"> From {group.scores.length} {group.scores.length === 1 ? 'judge' : 'judges'}
 </div>
 </div>
 </div>
 </div>  <div className="space-y-3">
 <p className="text-sm text-gray-400 font-semibold mb-2">Individual Judge Scores:</p> {group.scores.map((score: any) => {
 const totalScore = calculateTotalScore(score);
 const judgeMedal = getScoreMedal(totalScore, group);
 return (
 <div
 key={score.id}
 className="bg-[rgba(17,17,17,0.72)] rounded-lg p-3 border border-gray-600 hover:border-[rgba(192,192,192,0.35)] transition-all duration-300 cursor-pointer" onClick={() => {
 setSelectedScore(score);
 setShowScoreDetails(true);
 }}
 >
 <div className="flex justify-between items-start mb-2">
 <div className="flex-1">
 <p className="text-sm font-semibold text-white">Judge: {score.judgeName}</p>
 <p className="text-xs text-gray-500">{new Date(score.scoredAt).toLocaleDateString()}</p>
 </div>
 <div className="text-right">
 <div className={`text-2xl font-bold ${judgeMedal.color}`}> {totalScore}<span className="text-sm text-gray-400">/100</span>
 </div>
 </div>
 </div>  <div className="grid grid-cols-5 gap-2">
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
 <p className="text-xs text-blue-300 italic line-clamp-1">{score.comments}</p>
 </div> )}

 <div className="mt-2 text-xs text-[var(--chrome-mid)] text-right"> Click to view full details 
 </div>
 </div> );
 })}
 </div>
 </div> );
 });
 })()}
 </div>
 </div> );
 })()}
 </> )}
 </div> {/* Score Details Modal */}
 {showScoreDetails && selectedScore && (
 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={() => setShowScoreDetails(false)}>
 <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[rgba(192,192,192,0.15)]" onClick={(e) => e.stopPropagation()}>
 <div className="px-6 py-4 border-b border-[rgba(192,192,192,0.15)] flex justify-between items-center sticky top-0 bg-gray-800 z-10">
 <h3 className="text-xl font-semibold text-white">{selectedScore.performanceTitle}</h3>
 <button
 onClick={() => setShowScoreDetails(false)}
 className="text-gray-400 hover:text-white text-2xl" >
 ✕
 </button>
 </div>  <div className="p-6">
 <div className="bg-gradient-to-r from-[rgba(192,192,192,0.08)] to-[rgba(0,230,255,0.06)] border border-[rgba(192,192,192,0.22)] rounded-xl p-6 mb-6 text-center">
 <p className="text-sm font-semibold text-[var(--chrome-light)] mb-2">TOTAL SCORE</p>
 <p className={`text-5xl font-bold ${getScoreMedal(calculateTotalScore(selectedScore), selectedScore).color}`}> {calculateTotalScore(selectedScore)}
 <span className="text-3xl text-gray-400">/100</span>
 </p>
 <p className={`text-sm font-semibold mt-2 ${getScoreMedal(calculateTotalScore(selectedScore), selectedScore).color}`}>  {getScoreMedal(calculateTotalScore(selectedScore), selectedScore).label}
 </p>
 </div>  <div className="space-y-4 mb-6">
 <div className="bg-black/40 rounded-lg p-4">
 <h4 className="font-bold text-white mb-3 flex items-center">
 <span className="mr-2"></span> Score Breakdown</h4>
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-300">Technical Execution</span>
 <span className="font-bold text-blue-400">{selectedScore.technicalScore}/20</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-300">Musical Interpretation</span>
 <span className="font-bold text-[var(--chrome-mid)]">{selectedScore.musicalScore}/20</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-300">Performance Quality</span>
 <span className="font-bold text-[var(--chrome-mid)]">{selectedScore.performanceScore}/20</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-300">Styling & Presentation</span>
 <span className="font-bold text-orange-400">{selectedScore.stylingScore}/20</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-gray-300">Overall Impression</span>
 <span className="font-bold text-pink-400">{selectedScore.overallImpressionScore}/20</span>
 </div>
 </div>
 </div>  <div className="bg-black/40 rounded-lg p-4">
 <h4 className="font-bold text-white mb-2 flex items-center">
 <span className="mr-2"></span> Performance Info</h4>
 <div className="space-y-1 text-sm">
 <p className="text-gray-300">Judge: <span className="text-white">{selectedScore.judgeName}</span></p>
 <p className="text-gray-300">Scored: <span className="text-white">{new Date(selectedScore.scoredAt).toLocaleString()}</span></p>
 </div>
 </div>
 </div> {selectedScore.comments && (
 <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
 <h4 className="font-bold text-blue-300 mb-2 flex items-center">
 <span className="mr-2">💬</span> Judge Comments</h4>
 <p className="text-sm text-blue-200 italic leading-relaxed">{selectedScore.comments}</p>
 </div> )}
 </div>
 </div>
 </div> )}
 </> );
}

// Competition Entries Section Component
function CompetitionEntriesSection({ dancerSession, selectedEventId, events, onEventChange }: { dancerSession: DancerSession; selectedEventId: string; events: Array<{id: string; name: string}>; onEventChange: (eventId: string) => void }) {
 const [competitionEntries, setCompetitionEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [isCollapsed, setIsCollapsed] = useState(false);

 useEffect(() => {
 loadCompetitionEntries();
 }, [dancerSession.eodsaId]);

 const loadCompetitionEntries = async () => {
 try {
 // Add debug parameter if needed
 const debugMode = process.env.NODE_ENV === 'development';
 const response = await fetch(`/api/contestants/entries?eodsaId=${dancerSession.eodsaId}${debugMode ? '&debug=true' : ''}`);
 const data = await response.json();
 
 if (data.success) {
 setCompetitionEntries(data.entries);
 console.log(`Loaded ${data.entries.length} competition entries for dancer ${dancerSession.eodsaId}`);
 if (data.debug) {
 console.log('Debug info:', data.debug);
 }
 } else {
 setError(data.error || 'Failed to load entries');
 console.error('Failed to load entries:', data.error);
 }
 } catch (error) {
 console.error('Error loading competition entries:', error);
 setError('Failed to load entries');
 } finally {
 setLoading(false);
 }
 };

 const getEntryTypeBadge = (entryType: string) => {
 return entryType === 'live' 
 ? 'bg-green-500/20 text-green-300 border border-[rgba(192,192,192,0.22)]'
 : 'bg-indigo-500/20 text-indigo-300 border border-[rgba(192,192,192,0.22)]';
 };

 const getStatusBadge = (approved: boolean, paid: boolean) => {
 if (!paid) return 'bg-red-500/20 text-red-300 border border-red-500/30';
 if (!approved) return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
 return 'bg-green-500/20 text-green-300 border border-[rgba(192,192,192,0.22)]';
 };

 const getStatusText = (approved: boolean, paid: boolean) => {
 if (!paid) return ' Payment Required';
 if (!approved) return '⏳ Pending Approval';
 return ' Approved';
 };

 if (loading) {
 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-6">
 <div className="flex items-center justify-center py-8">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--chrome-mid)]"></div>
 <span className="ml-3 text-gray-300">Loading competition entries...</span>
 </div>
 </div> );
 }

 // Filter entries by selected event
 const filteredEntries = selectedEventId === 'all' 
 ? competitionEntries 
 : competitionEntries.filter(entry => entry.eventId === selectedEventId);

 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-4 sm:p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col gap-4">
 <div>
 <h3 className="text-xl font-bold text-white"> My Competition Entries 
 {!loading && (
 <span className="text-sm font-normal text-gray-400 ml-2"> ({filteredEntries.length}{selectedEventId !== 'all' ? ` of ${competitionEntries.length}` : ''})
 </span> )}</h3>
 <p className="text-gray-400 text-sm mt-1">All your competition entries across different events</p>
 </div>
 <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full">
 <button
 onClick={() => setIsCollapsed(prev => !prev)}
 className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors" >
 {isCollapsed ? '▸ Show list' : '▾ Hide list'}
 </button>
 <select
 value={selectedEventId}
 onChange={(e) => onEventChange(e.target.value)}
 className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <button
 onClick={loadCompetitionEntries}
 disabled={loading}
 className="w-full sm:w-auto sm:flex-shrink-0 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50" >
 {loading ? '🔄' : '↻'} Refresh
 </button>
 </div>
 </div>
 </div> {!isCollapsed && (
 <> {error && (
 <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-200"> {error}
 </div> )}

 {filteredEntries.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <p className="text-gray-400 mb-2"> {competitionEntries.length === 0 
 ? 'No competition entries found' 
 : `No entries found for selected event${selectedEventId !== 'all' ? '. Try selecting "All Events".' : ''}`}
 </p>
 <p className="text-gray-500 text-sm mb-4"> {competitionEntries.length === 0 
 ? 'You haven\'t entered any competitions yet, or entries may still be processing.'
 : 'Change the event filter to see entries from other events.'}
 </p> {competitionEntries.length === 0 && (
 <>
 <div className="space-y-2 text-xs text-gray-600">
 <p> Entries are typically created by your studio or coach</p>
 <p> EODSA ID being searched: <span className="font-mono text-gray-400">{dancerSession.eodsaId}</span></p>
 <p> Contact your studio if you expect to see entries here</p>
 </div>
 <button
 onClick={loadCompetitionEntries}
 className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" >
 🔄 Check Again
 </button>
 </> )}
 </div> ) : (
 <div className="p-6">
 <div className="space-y-6"> {filteredEntries.map((entry) => {
 if (entry.eventType === 'AUDITION_EVENT') {
 return (
 <div key={entry.id} className="bg-black/40 rounded-xl p-4 sm:p-6 border border-gray-600">
 <h4 className="text-lg font-bold text-white">{entry.eventName}</h4>
 <p className="mt-2 text-sm text-emerald-300">Entry Submitted</p>
 </div>
 );
 }
 const isGroupEntry = entry.participantIds && entry.participantIds.length > 1;
 const isOwner = entry.eodsaId === dancerSession.eodsaId;
 const performanceType = isGroupEntry 
 ? entry.participantIds.length === 2 ? 'Duet'
 : entry.participantIds.length === 3 ? 'Trio' 
 : 'Group'
 : 'Solo';
 
 return (
 <div key={entry.id} className="bg-black/40 rounded-xl p-4 sm:p-6 border border-gray-600 hover:border-[rgba(192,192,192,0.35)] transition-all duration-300">
 <div className="mb-4">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
 <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-0">{entry.itemName}</h4> {/* Badges Row */}
 <div className="flex flex-wrap items-center gap-2"> {/* Performance Type Badge */}
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
 isGroupEntry 
 ? 'bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] border border-[rgba(192,192,192,0.22)]' 
 : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
 }`}> {isGroupEntry ? ` ${performanceType}` : '🕺 Solo'}
 </span> {/* Entry Type Badge */}
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEntryTypeBadge(entry.entryType)}`}> {entry.entryType === 'live' ? ' Live' : ' Virtual'}
 </span> {/* Status Badge */}
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(entry.approved, entry.paid)}`}> {getStatusText(entry.approved, entry.paid)}
 </span> {/* Access Type Badge for Groups */}
 {isGroupEntry && (
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 isOwner 
 ? 'bg-green-500/20 text-green-300 border border-[rgba(192,192,192,0.22)]'
 : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
 }`}> {isOwner ? ' Owner' : '🤝 Participant'}
 </span> )}
 </div>
 </div>  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
 <p className="text-gray-300">Event: <span className="text-white font-medium">{entry.eventName}</span></p>
 <p className="text-gray-300">Style: <span className="text-white font-medium">{entry.itemStyle}</span></p>
 <p className="text-gray-300">Mastery: <span className="text-white font-medium">{entry.mastery}</span></p> {/* Duration hidden by request */}
 {entry.region && (
 <p className="text-gray-300">Region: <span className="text-white font-medium">{entry.region}</span></p> )}
 {entry.venue && entry.venue !== 'TBD' && (
 <p className="text-gray-300">Venue: <span className="text-white font-medium">{entry.venue}</span></p> )}
 </div> {/* Event Date */}
 {entry.eventDate && (
 <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
 <p className="text-blue-300 text-sm"> Event Date: <span className="font-medium">{new Date(entry.eventDate).toLocaleDateString()}</span>
 </p>
 </div> )}
 
 {/* Group Info */}
 {isGroupEntry && (
 <div className="mt-3 p-3 bg-purple-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-[var(--chrome-light)] text-sm font-medium mb-1"> Group Performance ({entry.participantIds.length} dancers)
 </p>
 <p className="text-purple-200 text-xs"> {isOwner 
 ? 'You registered this group entry and can manage it.'
 : 'You\'re a participant in this group entry.'
 }
 </p>
 </div> )}

 {/* Entry Fee Information */}
 <div className="mt-3 p-3 bg-[rgba(17,17,17,0.72)] border border-gray-600 rounded-lg">
 <div className="flex justify-between items-center">
 <p className="text-gray-300 text-sm">Entry Fee:</p>
 <p className="text-white font-semibold">R{entry.entryFee || 0}</p>
 </div> {!entry.paid && (
 <p className="text-red-400 text-xs mt-1"> Payment required to complete registration</p> )}
 </div> {/* File Upload Status */}
 {entry.entryType === 'live' && (
 <div className="mt-3 p-2 bg-green-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-green-300 text-sm"> Music File: {entry.musicFileUrl ? 
 <span className="text-[var(--chrome-mid)] font-medium"> Uploaded</span> : 
 <span className="text-yellow-400 font-medium">📤 Upload Required</span> }
 </p>
 </div> )}

 {entry.entryType === 'virtual' && (
 <div className="mt-3 p-4 bg-indigo-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
 {(entry.videoFileUrl || entry.videoExternalUrl) ? (
 <p className="text-indigo-300 text-sm">
 Video File: <span className="text-[var(--chrome-mid)] font-medium">Uploaded</span>
 </p>
 ) : (
 <>
 <p className="text-yellow-400 text-sm font-medium mb-3">Video upload required</p>
 <VirtualVideoUploadForm
 entryId={entry.id}
 eodsaId={dancerSession.eodsaId}
 initialVideoUrl={entry.videoExternalUrl}
 onSuccess={loadCompetitionEntries}
 compact
 />
 </>
 )}
 </div> )}
 </div>
 </div> );
 })}
 </div>
 </div> )}
 </> )}
 </div> );
}

// Certificates Section Component
function CertificatesSection({ dancerSession, selectedEventId, events, onEventChange }: { dancerSession: DancerSession; selectedEventId: string; events: Array<{id: string; name: string}>; onEventChange: (eventId: string) => void }) {
 const [certificates, setCertificates] = useState<Certificate[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [isCollapsed, setIsCollapsed] = useState(false);

 useEffect(() => {
 loadCertificates();
 }, [dancerSession.eodsaId]);

 const loadCertificates = async () => {
 try {
 // Use eodsaId to filter certificates (more reliable than dancerId)
 const response = await fetch(`/api/certificates/list?eodsaId=${dancerSession.eodsaId}`);
 if (response.ok) {
 const data = await response.json();
 // Map the API response to match the Certificate interface
 const mappedCertificates: Certificate[] = data.map((cert: any) => ({
 id: cert.id,
 dancerName: cert.dancer_name,
 percentage: cert.percentage,
 style: cert.style,
 title: cert.title,
 medallion: cert.medallion,
 eventDate: cert.event_date,
 certificateUrl: cert.certificate_url,
 sentAt: cert.sent_at,
 downloaded: cert.downloaded || false,
 createdAt: cert.created_at,
 // Include eventId for filtering
 eventId: cert.event_id,
 eventName: cert.event_name
 }));
 setCertificates(mappedCertificates);
 } else {
 const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
 setError(errorData.error || 'Failed to load certificates');
 }
 } catch (err) {
 console.error('Error loading certificates:', err);
 setError('Failed to load certificates');
 } finally {
 setLoading(false);
 }
 };

 const handleDownload = async (cert: Certificate) => {
 try {
 window.open(cert.certificateUrl, '_blank');
 
 // Mark as downloaded
 await fetch(`/api/certificates/mark-downloaded`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ certificateId: cert.id })
 });
 
 // Reload certificates
 loadCertificates();
 } catch (err) {
 console.error('Error downloading certificate:', err);
 }
 };

 if (loading) {
 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <h3 className="text-xl font-bold text-white"> My Certificates</h3>
 <p className="text-gray-400 text-sm mt-1">View and download your achievement certificates</p>
 </div>
 <div className="p-12 text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--chrome-mid)] mx-auto mb-4"></div>
 <p className="text-gray-400">Loading certificates...</p>
 </div>
 </div> );
 }

 // Filter certificates by event
 // Note: Multiple certificates can have the same performance name/title, so we filter by eventId
 const filteredCertificates = selectedEventId === 'all' 
 ? certificates 
 : certificates.filter(cert => {
 // Match by eventId - this ensures all certificates for the selected event are shown
 // even if they have the same performance name/title
 return cert.eventId === selectedEventId;
 });

 return (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
 <div>
 <h3 className="text-xl font-bold text-white">  My Certificates
 {!loading && certificates.length > 0 && (
 <span className="text-sm font-normal text-gray-400 ml-2"> ({certificates.length})
 </span> )}</h3>
 <p className="text-gray-400 text-sm mt-1">View and download your achievement certificates</p>
 </div>
 <div className="flex gap-2 items-center">
 <button
 onClick={() => setIsCollapsed(prev => !prev)}
 className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors" >
 {isCollapsed
 ? `▸ View all${certificates.length ? ` (${certificates.length})` : ''}`
 : '▾ Hide list'}
 </button>
 <select
 value={selectedEventId}
 onChange={(e) => onEventChange(e.target.value)}
 className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Events</option> {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 </div>
 </div>
 </div> {!isCollapsed && (
 <> {error && (
 <div className="p-4 bg-red-900/20 border-b border-red-700/30">
 <p className="text-red-400 text-sm">{error}</p>
 </div> )}

 {filteredCertificates.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl">📜</span>
 </div>
 <p className="text-gray-400 mb-2"> {certificates.length === 0 
 ? 'No certificates yet' 
 : 'No certificates found for selected event'}
 </p>
 <p className="text-gray-500 text-sm"> {certificates.length === 0 
 ? 'Certificates will appear here once you\'ve achieved a ranking position in competitions.'
 : 'Change the event filter to see certificates from other events.'}
 </p>
 </div> ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"> {filteredCertificates.map((cert) => (
 <div key={cert.id} className="bg-gray-900/50 rounded-xl border border-[rgba(192,192,192,0.15)] overflow-hidden hover:border-[rgba(192,192,192,0.35)] transition-all">
 <div
 className="relative h-48 cursor-pointer" onClick={() => setPreviewUrl(cert.certificateUrl)}
 >
 <img
 src={cert.certificateUrl}
 alt={`Certificate for ${cert.title}`}
 className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center">
 <span className="text-white text-4xl opacity-0 hover:opacity-100 transition-opacity"></span>
 </div>
 </div>
 <div className="p-4">
 <h4 className="font-semibold text-white mb-2">{cert.title}</h4>
 <div className="space-y-1 text-sm"> {cert.eventName && (
 <p className="text-gray-400">
 <span className="text-gray-500">Event:</span> {cert.eventName}
 </p> )}
 <p className="text-gray-400">
 <span className="text-gray-500">Style:</span> {cert.style}
 </p>
 <p className="text-gray-400">
 <span className="text-gray-500">Score:</span> {cert.percentage}%
 </p>
 <p className="text-gray-400">
 <span className="text-gray-500">Medal:</span> {cert.medallion}
 </p>
 <p className="text-gray-400">
 <span className="text-gray-500">Date:</span> {cert.eventDate}
 </p>
 </div>
 <div className="mt-4 flex gap-2">
 <button
 onClick={() => handleDownload(cert)}
 className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold" >
 📥 Download
 </button>
 <button
 onClick={() => setPreviewUrl(cert.certificateUrl)}
 className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm" >
 
 </button>
 </div>
 </div>
 </div> ))}
 </div> )}

 {/* Preview Modal */}
 {previewUrl && (
 <div
 className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}
 >
 <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={() => setPreviewUrl(null)}
 className="absolute -top-12 right-0 text-white text-xl hover:text-gray-300 bg-[rgba(17,17,17,0.72)] px-4 py-2 rounded-lg" >
 ✕ Close
 </button>
 <img
 src={previewUrl}
 alt="Certificate Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
 </div>
 </div> )}
 </> )}
 </div> );
}

export default function DancerDashboardPage() {
 const [dancerSession, setDancerSession] = useState<DancerSession | null>(null);
 const [applications, setApplications] = useState<StudioApplication[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [historyLoading, setHistoryLoading] = useState(false);
 const [profileHistory, setProfileHistory] = useState<any | null>(null);
 const [selectedEventId, setSelectedEventId] = useState<string>('all');
 const [selectedYear, setSelectedYear] = useState<string>('all');
 const [events, setEvents] = useState<Array<{id: string; name: string; isArchived?: boolean}>>([]);
 const router = useRouter();

 useEffect(() => {
 const session = localStorage.getItem('dancerSession');
 if (!session) {
 router.push('/dancer-login');
 return;
 }

 try {
 const parsedSession = JSON.parse(session);
 setDancerSession(parsedSession);
 loadDancerData(parsedSession.id);
 // Load consolidated history for filters
 loadDancerHistory(parsedSession.id);
 // Load events list for filtering
 loadEvents();
 } catch {
 router.push('/dancer-login');
 }
 }, [router]);

 const loadEvents = async () => {
 try {
 const response = await fetch('/api/events?scope=all');
 if (response.ok) {
 const data = await response.json();
 if (data.success) {
 setEvents(data.events.map((e: any) => ({ id: e.id, name: e.name, isArchived: !!e.isArchived })));
 }
 }
 } catch (error) {
 console.error('Error loading events:', error);
 }
 };

 const loadDancerData = async (dancerId: string) => {
 try {
 const appsResponse = await fetch(`/api/dancers/applications?dancerId=${dancerId}`);
 const appsData = await appsResponse.json();

 if (appsData.success) {
 setApplications(appsData.applications);
 }
 } catch (error) {
 console.error('Error loading dancer data:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const loadDancerHistory = async (dancerId: string) => {
 try {
 setHistoryLoading(true);
 const res = await fetch(`/api/dancers/${dancerId}/profile`, { cache: 'no-store' });
 const data = await res.json();
 if (data?.success) {
 setProfileHistory(data.profile);
 }
 } catch (e) {
 console.error('Failed to load dancer history', e);
 } finally {
 setHistoryLoading(false);
 }
 };

 const handleLogout = () => {
 localStorage.removeItem('dancerSession');
 router.push('/dancer-login');
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case 'pending':
 return 'bg-yellow-500';
 case 'accepted':
 return 'bg-green-500';
 case 'rejected':
 return 'bg-red-500';
 default:
 return 'bg-gray-500';
 }
 };

 const handleGoToEvents = () => {
 if (!dancerSession) return;
 // Take the dancer straight to the events dashboard to choose and enter events
 router.push(`/event-dashboard/Nationals?eodsaId=${dancerSession.eodsaId}`);
 };

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto mb-4"></div>
 <p className="text-[var(--muted-foreground)] text-sm tracking-wide">Loading dancer dashboard...</p>
 </div>
 </div> );
 }

 if (!dancerSession) {
 return null;
 }

 return (
 <AvalonShell
 title="Dashboard" userName={dancerSession.name}
 userMeta={`EODSA ${dancerSession.eodsaId}`}
 onLogout={handleLogout}
 navItems={[
 { id: 'home', label: 'Home', href: '/dancer-dashboard', icon: 'home', active: true },
 { id: 'events', label: 'Events', onClick: handleGoToEvents, icon: 'events' },
 { id: 'profile', label: 'Profile', href: '/dancer-dashboard', icon: 'profile' },
 ]}
 >
 <style jsx global>{`
 @supports(padding: max(0px)) {
 .pb-safe-bottom {
 padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
 }
 }
 .pb-safe-bottom {
 padding-bottom: 100px;
 }
 @media screen and (max-width: 414px) and (min-height: 800px) {
 .pb-safe-bottom {
 padding-bottom: 140px;
 }
 }
 `}</style>  <div className="pb-safe-bottom space-y-6">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
 <div>
 <h1 className="font-display text-4xl sm:text-5xl chrome-text leading-none mb-2">Dashboard</h1>
 <p className="text-sm text-[var(--muted-foreground)]"> {dancerSession.email || 'No email on file'}
 {profileHistory?.studio
 ? ` · Studio: ${profileHistory.studio.name}${
 profileHistory.studio.registrationNumber
 ? ` · Reg: ${profileHistory.studio.registrationNumber}`
 : ''
 }`
 : ''}
 </p>
 </div>
 <button type="button" onClick={handleGoToEvents} className="btn-chrome self-start sm:self-auto">
 <Plus className="w-4 h-4" /> Enter Event
 </button>
 </div>  <div className="glass-panel p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <div>
 <p className="label-caps text-[var(--sidebar-muted)] mb-2">Current Events</p>
 <h2 className="font-display text-2xl text-white leading-none mb-2">Ready to enter events?</h2>
 <p className="text-sm text-[var(--muted-foreground)]"> Choose your event and complete your entries from the events dashboard.
 </p>
 </div>
 <button
 type="button" onClick={handleGoToEvents}
 className="btn-outline-chrome w-full md:w-auto justify-center" >
 Enter events &amp; competitions
 </button>
 </div> {/* History Filters + Timeline */}
 {profileHistory && (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)] flex flex-col md:flex-row md:items-end gap-4">
 <div className="flex-1">
 <h3 className="text-xl font-bold text-white">History</h3>
 <p className="text-gray-400 text-sm mt-1"> Past performances, scores and certificates — including archived events
 </p>
 </div>
 <div className="flex gap-3">
 <select
 value={selectedEventId}
 onChange={(e) => setSelectedEventId(e.target.value)}
 className="px-3 py-2 bg-gray-900 border border-[rgba(192,192,192,0.15)] rounded-lg text-sm text-gray-100" >
 <option value="all">All Events</option> {Array.from(
 new Map(
 profileHistory.performances.map((p: any) => [p.event.id, p.event.name])
 )
 ).map(([id, name]) => (
 <option key={id as string} value={id as string}> {name as string}
 </option> ))}
 </select>
 <select
 value={selectedYear}
 onChange={(e) => setSelectedYear(e.target.value)}
 className="px-3 py-2 bg-gray-900 border border-[rgba(192,192,192,0.15)] rounded-lg text-sm text-gray-100" >
 <option value="all">All Years</option> {Array.from(
 new Set(
 profileHistory.performances
 .map((p: any) => (p.event.date ? new Date(p.event.date).getFullYear() : null))
 .filter(Boolean)
 )
 )
 .sort((a: any, b: any) => b - a)
 .map((year: any) => (
 <option key={year} value={String(year)}> {year}
 </option> ))}
 </select>
 </div>
 </div>
 <div className="divide-y divide-gray-700"> {historyLoading ? (
 <div className="p-6 text-gray-400 text-sm">Loading history…</div> ) : (
 profileHistory.performances
 .filter((p: any) => {
 const byEvent = selectedEventId === 'all' || p.event.id === selectedEventId;
 const yr = p.event.date ? new Date(p.event.date).getFullYear() : null;
 const byYear = selectedYear === 'all' || String(yr) === selectedYear;
 return byEvent && byYear;
 })
 .map((p: any) => (
 <div key={p.performanceId} className="p-6 grid md:grid-cols-12 gap-3 text-sm">
 <div className="md:col-span-4">
 <div className="font-semibold text-white">{p.title || 'Untitled'}</div>
 <div className="text-gray-400"> {p.itemStyle} • {p.mastery} • {p.performanceType || '—'}
 </div>
 </div>
 <div className="md:col-span-4">
 <div className="text-white font-medium">{p.event.name}</div>
 <div className="text-gray-400"> {p.event.region} • {p.event.ageCategory || 'All Ages'}
 </div>
 <div className="text-gray-500">{p.event.date?.slice(0, 10) || '—'}</div>
 </div>
 <div className="md:col-span-2">
 <div className="text-white font-semibold"> {p.scoresPublished ? `${p.percentage}%` : 'Awaiting approval'}
 </div>
 <div className="text-gray-400">{p.judgeCount} judge(s)</div>
 </div>
 <div className="md:col-span-2"> {p.certificate?.url ? (
 <a
 href={p.certificate.url}
 target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white" >
 Download Certificate
 </a> ) : (
 <span className="text-gray-500">No certificate</span> )}
 </div>
 </div> ))
 )}
 </div>
 </div> )}

 {/* Scores & Feedback Section */}
 <ScoresFeedbackSection 
 dancerSession={dancerSession} 
 selectedEventId={selectedEventId}
 events={events}
 onEventChange={setSelectedEventId}
 /> {/* Certificates Section */}
 <CertificatesSection 
 dancerSession={dancerSession}
 selectedEventId={selectedEventId}
 events={events}
 onEventChange={setSelectedEventId}
 /> {/* Video Upload Section - shown before entries so uploads are easy to find */}
 <VideoUploadSection 
 dancerSession={dancerSession}
 selectedEventId={selectedEventId}
 events={events}
 onEventChange={setSelectedEventId}
 /> {/* Competition Entries Section */}
 <CompetitionEntriesSection 
 dancerSession={dancerSession}
 selectedEventId={selectedEventId}
 events={events}
 onEventChange={setSelectedEventId}
 /> {/* Studio Applications Section */}
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.15)]">
 <h3 className="text-xl font-bold text-white">Studio Applications</h3>
 <p className="text-gray-400 text-sm mt-1">Manage your studio membership applications</p>
 </div> {applications.length === 0 ? (
 <div className="p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <p className="text-gray-400 mb-2">No studio applications</p>
 <p className="text-gray-500 text-sm"> You haven't applied to any studios yet, or your applications are still being processed.
 </p>
 </div> ) : (
 <div className="divide-y divide-gray-700"> {applications.map((app) => (
 <div key={app.id} className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <h4 className="text-lg font-semibold text-white">{app.studioName}</h4>
 <p className="text-gray-400 text-sm">Contact: {app.contactPerson}</p>
 <p className="text-gray-500 text-xs">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
 </div>
 <div className="text-right">
 <span className={`inline-block w-3 h-3 rounded-full ${getStatusBadge(app.status)} mr-2`}></span>
 <span className="text-sm font-medium text-white capitalize">{app.status}</span> {app.respondedAt && (
 <p className="text-xs text-gray-500 mt-1"> Responded: {new Date(app.respondedAt).toLocaleDateString()}
 </p> )}
 {app.rejectionReason && (
 <p className="text-xs text-red-400 mt-1 max-w-xs"> {app.rejectionReason}
 </p> )}
 </div>
 </div>
 </div> ))}
 </div> )}
 </div> {/* Music Upload Section */}
 <MusicUploadSection 
 dancerSession={dancerSession}
 selectedEventId={selectedEventId}
 events={events}
 onEventChange={setSelectedEventId}
 />  </div>
 </AvalonShell> );
}
