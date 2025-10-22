// Phase 1 Types for E-O-D-S-A Competition System

export interface ParentGuardianWaiver {
  id: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationshipToDancer: string;
  signedDate: string;
  signaturePath: string; // Path to signature image
  idDocumentPath: string; // Path to uploaded ID document
  approved: boolean;
  approvedBy?: string; // Admin who approved
  approvedAt?: string;
}

export interface Dancer {
  id: string; // E-O-D-S-A-ID format
  name: string;
  age: number;
  dateOfBirth: string; // NEW: Date of Birth field
  style: string;
  nationalId: string;
  approved: boolean; // NEW: Admin approval status
  approvedBy?: string; // NEW: Admin who approved
  approvedAt?: string; // NEW: Approval timestamp
  rejectionReason?: string; // NEW: Reason if rejected
  waiver?: ParentGuardianWaiver; // NEW: Waiver for minors under 18
  created_at?: string;
  // Registration fee tracking
  registrationFeePaid?: boolean; // NEW: Track if registration fee has been paid
  registrationFeePaidAt?: string; // NEW: When registration fee was paid
  registrationFeeMasteryLevel?: string; // NEW: Mastery level they paid registration for
}

export interface GuardianInfo {
  name: string;
  email: string;
  cell: string;
}

export interface Contestant {
  id: string;
  eodsaId: string; // NEW FORMAT: letter + 6 digits (e.g. "E123456")
  name: string;
  email: string;
  phone: string;
  type: 'studio' | 'private';
  dateOfBirth: string; // NEW: Date of Birth
  guardianInfo?: GuardianInfo; // NEW: Guardian info for minors
  privacyPolicyAccepted: boolean; // NEW: Privacy policy acceptance
  privacyPolicyAcceptedAt?: string; // NEW: Timestamp
  studioName?: string;
  studioInfo?: {
    address: string;
    contactPerson: string;
    registrationNumber?: string; // NEW FORMAT: letter + 6 digits (e.g. "S123456")
  };
  dancers: Dancer[]; // For studio: multiple dancers, for private: single dancer
  registrationDate: string;
  eventEntries: EventEntry[];
}

// NEW: Events are competitions created by admin
export interface Event {
  id: string;
  name: string; // e.g. "EODSA Nationals Championships 2024 - Gauteng"
  description: string;
  region: 'Nationals';
  ageCategory: string;
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group' | 'All';
  eventDate: string;
  eventEndDate?: string; // NEW: For multi-day events
  registrationDeadline: string;
  venue: string;
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed';
  maxParticipants?: number;
  entryFee: number;
  createdBy: string; // admin id
  createdAt: string;
  // Configurable fee structure
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

export interface EventEntry {
  id: string;
  eventId: string; // NOW LINKS TO A SPECIFIC EVENT
  contestantId: string;
  eodsaId: string;
  participantIds: string[]; // E-O-D-S-A-IDs of participating dancers
  calculatedFee: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentMethod?: 'credit_card' | 'bank_transfer' | 'invoice' | 'payfast' | 'eft';
  paymentReference?: string; // Payment reference number/transaction ID
  paymentDate?: string; // Date when payment was processed
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemNumber?: number; // NEW: Item Number for program order
  virtualItemNumber?: number; // NEW: Independent Virtual program number
  // EODSA Nationals Entry Form fields
  itemName: string;
  choreographer: string;
  mastery: string; // UPDATED: New mastery levels
  itemStyle: string;
  estimatedDuration: number; // in minutes
  performanceType?: string; // Calculated from participant count: Solo, Duet, Trio, Group
  ageCategory?: string; // Calculated from average participant ages
  // PHASE 2: Live vs Virtual Entry Support
  entryType: 'live' | 'virtual';
  // For Live entries - music file
  musicFileUrl?: string; // Cloudinary URL for MP3/WAV files
  musicFileName?: string;
  // For Virtual entries - video file or URL
  videoFileUrl?: string; // Cloudinary URL for video files
  videoFileName?: string;
  videoExternalUrl?: string; // YouTube/Vimeo URL
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
}

export interface Performance {
  id: string;
  eventId: string; // NOW LINKS TO EVENT
  eventEntryId: string;
  contestantId: string;
  title: string; // This maps to itemName
  participantNames: string[];
  duration: number; // in minutes (maps to estimatedDuration)
  itemNumber?: number; // NEW: Item Number for program order
  performanceOrder?: number; // NEW: Performance order (different from item number)
  scheduledTime?: string;
  status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
  withdrawnFromJudging?: boolean; // NEW: Admin can withdraw items from judging
  // EODSA Nationals Entry Form fields
  choreographer: string;
  mastery: string; // UPDATED: New mastery levels
  itemStyle: string;
  ageCategory?: string; // NEW: Age category from event
  // NEW: Music cue preference to guide sound start timing
  musicCue?: 'onstage' | 'offstage';
  // NEW: Entry type to distinguish live vs virtual performances
  entryType?: 'live' | 'virtual';
  // NEW: Media files
  musicFileUrl?: string;
  musicFileName?: string;
  videoExternalUrl?: string;
  videoExternalType?: 'youtube' | 'vimeo' | 'other';
  // NEW: Announcer features
  announced?: boolean;
  announcedAt?: string;
  announcerNotes?: string;
}

export interface Judge {
  id: string;
  name: string;
  email: string;
  password: string; // hashed
  isAdmin: boolean;
  role: 'judge' | 'admin' | 'backstage_manager' | 'announcer' | 'registration' | 'media';
  specialization?: string[];
  createdAt: string;
}

// NEW: Direct judge-event assignments
export interface JudgeEventAssignment {
  id: string;
  judgeId: string;
  eventId: string;
  assignedBy: string; // admin id who made the assignment
  assignedAt: string;
  status: 'active' | 'inactive';
}

export interface Score {
  id: string;
  judgeId: string;
  performanceId: string;
  technicalScore: number; // 0-20
  musicalScore: number; // 0-20
  performanceScore: number; // 0-20
  stylingScore: number; // 0-20
  overallImpressionScore: number; // 0-20
  comments: string;
  submittedAt: string;
}

export interface ScoreSheet {
  performanceId: string;
  contestantName: string;
  performanceTitle: string;
  scores: Score[];
  averageScore: number;
  rank?: number;
}

export interface FeeSchedule {
  ageCategory: string;
  soloFee: number;
  duetFee: number;
  trioFee: number;
  groupFee: number;
}

export interface Ranking {
  id: string;
  eventId: string;
  performanceId: string;
  totalScore: number;
  averageScore: number;
  rank: number;
  calculatedAt: string;
}

// NEW: Performance presence status
export interface PerformancePresence {
  id: string;
  performanceId: string;
  eventId: string;
  present: boolean;
  checkedInBy: string; // user ID who checked them in
  checkedInAt: string;
}

// NEW: Score approval system
export interface ScoreApproval {
  id: string;
  performanceId: string;
  judgeId: string;
  scoreId: string;
  approvedBy?: string; // admin ID who approved
  approvedAt?: string;
  rejected?: boolean;
  rejectionReason?: string;
  status: 'pending' | 'approved' | 'rejected';
}

// UPDATED: Age categories to match EODSA requirements exactly
export const AGE_CATEGORIES = [
  'All Ages',
  '4 & Under',
  '6 & Under', 
  '7-9',
  '10-12',
  '13-14',
  '15-17',
  '18-24',
  '25-39',
  '40+',
  '60+'
];

// Helper: map a numeric age to an AGE_CATEGORIES bucket
export function getAgeCategoryFromAge(age: number): string {
  if (age <= 4) return '4 & Under';
  if (age <= 6) return '6 & Under';
  if (age <= 9) return '7-9';
  if (age <= 12) return '10-12';
  if (age <= 14) return '13-14';
  if (age <= 17) return '15-17';
  if (age <= 24) return '18-24';
  if (age <= 39) return '25-39';
  if (age < 60) return '40+';
  return '60+';
}

// Helper: compute age from a birth date relative to a reference date (defaults to today)
export function calculateAgeOnDate(dateOfBirth: Date | string, referenceDate: Date = new Date()): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const REGIONS = [
  'Nationals'
];

export const PERFORMANCE_TYPES = {
  Solo: {
    name: 'Solo',
    description: 'Individual performance',
    icon: '/icons/solo.svg', // Example path
  },
  Duet: {
    name: 'Duet',
    description: 'Two dancers together',
    icon: '/icons/duet.svg',
  },
  Trio: {
    name: 'Trio',
    description: 'Three dancers together',
    icon: '/icons/trio.svg',
  },
  Group: {
    name: 'Group',
    description: '4+ dancers together',
    icon: '/icons/group.svg',
  },
  All: {
    name: 'All',
    description: 'All performance types',
    icon: '/icons/all.svg',
  }
} as const;

// UPDATED: Dance styles to match approved list
export const DANCE_STYLES = [
  'Ballet',
  'Ballet Repertoire',
  'Lyrical',
  'Contemporary',
  'Modern',
  'Jazz',
  'Hip-Hop',
  'Freestyle/Disco',
  'Musical Theatre',
  'Acrobatics',
  'Tap',
  'Open',
  'Speciality Styles'
];

// UPDATED: Mastery levels for nationals competitions only
export const MASTERY_LEVELS = [
  'Water (Competitive)',
  'Fire (Advanced)'
];

// Updated for client requirements
export const ITEM_STYLES = [
  'Ballet',
  'Ballet Repertoire',
  'Lyrical',
  'Contemporary',
  'Modern',
  'Jazz',
  'Hip-Hop',
  'Freestyle/Disco',
  'Musical Theatre',
  'Acrobatics',
  'Tap',
  'Open',
  'Speciality Styles'
];

// UPDATED: Time limits to match EODSA requirements exactly
export const TIME_LIMITS = {
  Solo: 2, // minutes
  Duet: 3, // minutes
  Trio: 3, // minutes
  Group: 3.5 // minutes (3:30)
};

// EODSA Fee Structure - Updated for Nationals 2024 (Water and Fire only)
export const EODSA_FEES = {
  // Registration fees per person
  REGISTRATION: {
    'Water (Competitive)': 300,    // R300 PP for Water (Competition)
    'Fire (Advanced)': 300,        // R300 PP for Fire (Advanced)
    'Nationals': 300               // R300 PP for Nationals entry
  },
  
  // Solo packages - same for both Water and Fire
  SOLO_PACKAGES: {
    1: 300,   // 1 solo: R300
    2: 520,   // 2 solos: R520
    3: 700,   // 3 solos: R700
    4: 880,   // 4 solos: R700 + R180
    5: 1060   // 5 solos: R700 + (2 × R180)
  },
  
  // Performance fees - same for both Water and Fire
  PERFORMANCE: {
    Solo: 300,              // R300 for 1 solo
    SoloAdditional: 180,    // R180 for each additional solo after 3rd
    Duet: 200,              // R200 per dancer
    Trio: 200,              // R200 per dancer  
    SmallGroup: 180,        // R180 per dancer
    LargeGroup: 180         // R180 per dancer
  }
};

// EODSA Fee Calculation Function - Updated for Nationals 2024 (Water and Fire only)
export const calculateEODSAFee = (
  masteryLevel: string,
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group',
  numberOfParticipants: number,
  options?: {
    isMultipleSolos?: boolean;
    soloCount?: number;
    includeRegistration?: boolean;
    participantDancers?: Dancer[];
    eventId?: string;
    eventRegistrationFee?: number; // Event-specific registration fee
    eventSolo1Fee?: number; // Event-specific solo 1 fee
    eventSolo2Fee?: number; // Event-specific solo 2 fee
    eventSolo3Fee?: number; // Event-specific solo 3 fee
    eventSoloAdditionalFee?: number; // Event-specific additional solo fee
    eventDuoTrioFee?: number; // Event-specific duo/trio fee per dancer
    eventGroupFee?: number; // Event-specific group fee per dancer
    eventCurrency?: string; // Event currency
  }
): { registrationFee: number; performanceFee: number; totalFee: number; breakdown: string; registrationBreakdown?: string; currency?: string } => {
  
  const { 
    isMultipleSolos = false, 
    soloCount = 1, 
    includeRegistration = true, 
    participantDancers = [], 
    eventRegistrationFee,
    eventSolo1Fee,
    eventSolo2Fee,
    eventSolo3Fee,
    eventSoloAdditionalFee,
    eventDuoTrioFee,
    eventGroupFee,
    eventCurrency
  } = options || {};
  
  // Calculate registration fee - same for both Water and Fire
  let registrationFee = 0;
  let registrationBreakdown = '';
  
  if (includeRegistration && participantDancers.length > 0) {
    // REGISTRATION FEE CHECKING FOR ALL PERFORMANCE TYPES
    // Check each dancer's registration status
    const unpaidDancers = participantDancers.filter(dancer => {
      if (!dancer.registrationFeePaid) {
        return true; // Not paid at all
      }
      // Check if registration was paid for a different mastery level
      if (dancer.registrationFeeMasteryLevel && dancer.registrationFeeMasteryLevel !== masteryLevel) {
        return true; // Paid for different mastery level, need to pay again
      }
      return false; // Already paid for this mastery level
    });
    
    if (unpaidDancers.length > 0) {
      // Use event-specific registration fee if provided, otherwise use default
      const regFeePerDancer = eventRegistrationFee || EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION];
      registrationFee = regFeePerDancer * unpaidDancers.length;
      
      if (unpaidDancers.length === participantDancers.length) {
        registrationBreakdown = `Registration fee for ${unpaidDancers.length} dancer${unpaidDancers.length > 1 ? 's' : ''} (${masteryLevel})`;
      } else {
        const paidCount = participantDancers.length - unpaidDancers.length;
        registrationBreakdown = `Registration fee for ${unpaidDancers.length} dancer${unpaidDancers.length > 1 ? 's' : ''} (${paidCount} already paid for ${masteryLevel})`;
      }
    } else {
      registrationBreakdown = `All dancers have already paid registration fee for ${masteryLevel}`;
    }
  } else if (includeRegistration) {
    // Fallback calculation if no dancer data provided
    // Use event-specific registration fee if provided, otherwise use default
    const regFeePerDancer = eventRegistrationFee || EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION];
    registrationFee = regFeePerDancer * numberOfParticipants;
    registrationBreakdown = `Registration fee for ${numberOfParticipants} dancer${numberOfParticipants > 1 ? 's' : ''}`;
  }
  
  let performanceFee = 0;
  let breakdown = '';
  
  // Use event-specific fees if provided, otherwise use defaults
  const solo1Fee = eventSolo1Fee ?? EODSA_FEES.PERFORMANCE.Solo;
  const solo2Fee = eventSolo2Fee ?? (EODSA_FEES.SOLO_PACKAGES[2] || 520);
  const solo3Fee = eventSolo3Fee ?? (EODSA_FEES.SOLO_PACKAGES[3] || 700);
  const soloAdditionalFee = eventSoloAdditionalFee ?? EODSA_FEES.PERFORMANCE.SoloAdditional;
  const duoTrioFee = eventDuoTrioFee ?? EODSA_FEES.PERFORMANCE.Duet;
  const groupFee = eventGroupFee ?? EODSA_FEES.PERFORMANCE.SmallGroup;
  const currency = eventCurrency || 'ZAR';
  
  // Calculate performance fees using event-specific or default fees
  if (performanceType === 'Solo') {
    if (soloCount === 1) {
      performanceFee = solo1Fee;
      breakdown = `1 Solo`;
    } else if (soloCount === 2) {
      performanceFee = solo2Fee;
      breakdown = `2 Solos Package`;
    } else if (soloCount === 3) {
      performanceFee = solo3Fee;
      breakdown = `3 Solos Package`;
    } else if (soloCount > 3) {
      // More than 3 solos: use 3-solo package + additional solos
      performanceFee = solo3Fee + ((soloCount - 3) * soloAdditionalFee);
      breakdown = `3 Solos Package + ${soloCount - 3} Additional Solo${soloCount - 3 > 1 ? 's' : ''}`;
    }
  } else if (performanceType === 'Duet' || performanceType === 'Trio') {
    // Duos/trios: per person fee
    performanceFee = duoTrioFee * numberOfParticipants;
    breakdown = `${performanceType} (${currency}${duoTrioFee} × ${numberOfParticipants} dancers)`;
  } else if (performanceType === 'Group') {
    // Groups: per person fee
    performanceFee = groupFee * numberOfParticipants;
    breakdown = `Group (${currency}${groupFee} × ${numberOfParticipants} dancers)`;
  }
  
  const totalFee = registrationFee + performanceFee;
  
  return {
    registrationFee,
    performanceFee,
    totalFee,
    breakdown,
    registrationBreakdown,
    currency
  };
};

export interface Studio {
  id: string;
  name: string;
  email: string;
  password: string; // Hashed
  contactPerson: string;
  address: string;
  phone: string;
  registrationNumber: string; // Auto-generated S123456 format
  isActive: boolean;
  createdAt: string;
}

export interface StudioSession {
  id: string;
  name: string;
  email: string;
  registrationNumber: string;
} 

// Nationals Medal System
export type MedalType = 'bronze' | 'silver' | 'silver_plus' | 'gold' | 'legend' | 'opus' | 'elite';

export interface MedalInfo {
  type: MedalType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  emoji: string;
}

export const getMedalFromPercentage = (percentage: number): MedalInfo => {
  if (percentage < 69) {
    return {
      type: 'bronze',
      label: 'Bronze',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-300',
      emoji: '🥉'
    };
  } else if (percentage >= 70 && percentage <= 74) {
    return {
      type: 'silver',
      label: 'Silver',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      emoji: '🥈'
    };
  } else if (percentage >= 75 && percentage <= 79) {
    return {
      type: 'silver_plus',
      label: 'Silver+',
      color: 'text-slate-700',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-300',
      emoji: '🥈+'
    };
  } else if (percentage >= 80 && percentage <= 84) {
    return {
      type: 'gold',
      label: 'Gold',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
      emoji: '🥇'
    };
  } else if (percentage >= 85 && percentage <= 89) {
    return {
      type: 'legend',
      label: 'Legend',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
      emoji: '🏅'
    };
  } else if (percentage >= 90 && percentage <= 94) {
    return {
      type: 'opus',
      label: 'Opus',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
      emoji: '🎖️'
    };
  } else {
    return {
      type: 'elite',
      label: 'Elite',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
      emoji: '🏆'
    };
  }
}; 