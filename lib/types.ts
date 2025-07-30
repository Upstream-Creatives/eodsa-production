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
}

export interface EventEntry {
  id: string;
  eventId: string; // NOW LINKS TO A SPECIFIC EVENT
  contestantId: string;
  eodsaId: string;
  participantIds: string[]; // E-O-D-S-A-IDs of participating dancers
  calculatedFee: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'credit_card' | 'bank_transfer' | 'invoice';
  paymentReference?: string; // Payment reference number/transaction ID
  paymentDate?: string; // Date when payment was processed
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemNumber?: number; // NEW: Item Number for program order
  // EODSA Nationals Entry Form fields
  itemName: string;
  choreographer: string;
  mastery: string; // UPDATED: New mastery levels
  itemStyle: string;
  estimatedDuration: number; // in minutes
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
  scheduledTime?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  withdrawnFromJudging?: boolean; // NEW: Admin can withdraw items from judging
  // EODSA Nationals Entry Form fields
  choreographer: string;
  mastery: string; // UPDATED: New mastery levels
  itemStyle: string;
}

export interface Judge {
  id: string;
  name: string;
  email: string;
  password: string; // hashed
  isAdmin: boolean;
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
    'Water (Competitive)': 250,    // R250 PP for Water (Competition)
    'Fire (Advanced)': 250,        // R250 PP for Fire (Advanced)
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
  }
): { registrationFee: number; performanceFee: number; totalFee: number; breakdown: string; registrationBreakdown?: string } => {
  
  const { isMultipleSolos = false, soloCount = 1, includeRegistration = true, participantDancers = [] } = options || {};
  
  // Calculate registration fee - same for both Water and Fire
  let registrationFee = 0;
  let registrationBreakdown = '';
  
  if (includeRegistration && participantDancers.length > 0) {
    // Check each dancer's registration status
    const unpaidDancers = participantDancers.filter(dancer => {
      if (!dancer.registrationFeePaid) {
        return true; // Not paid at all
      }
      return false; // Already paid
    });
    
    if (unpaidDancers.length > 0) {
      registrationFee = EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION] * unpaidDancers.length;
      
      if (unpaidDancers.length === participantDancers.length) {
        registrationBreakdown = `Registration fee for ${unpaidDancers.length} dancer${unpaidDancers.length > 1 ? 's' : ''}`;
      } else {
        const paidCount = participantDancers.length - unpaidDancers.length;
        registrationBreakdown = `Registration fee for ${unpaidDancers.length} dancer${unpaidDancers.length > 1 ? 's' : ''} (${paidCount} already paid)`;
      }
    } else {
      registrationBreakdown = 'All dancers have already paid registration fee';
    }
  } else if (includeRegistration) {
    // Fallback calculation if no dancer data provided
    registrationFee = EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION] * numberOfParticipants;
    registrationBreakdown = `Registration fee for ${numberOfParticipants} dancer${numberOfParticipants > 1 ? 's' : ''}`;
  }
  
  let performanceFee = 0;
  let breakdown = '';
  
  // Calculate performance fees - same for both Water and Fire
  if (performanceType === 'Solo') {
    if (soloCount && soloCount > 1) {
      // Multiple solos - use package pricing
      if (soloCount <= 5) {
        performanceFee = EODSA_FEES.SOLO_PACKAGES[soloCount as keyof typeof EODSA_FEES.SOLO_PACKAGES] || 0;
        breakdown = `${soloCount} Solo${soloCount > 1 ? 's' : ''} Package`;
      } else {
        // More than 5 solos: 3-solo package + additional solos at R180 each after 3rd
        const packageFee = EODSA_FEES.SOLO_PACKAGES[3];
        const additionalFee = (soloCount - 3) * EODSA_FEES.PERFORMANCE.SoloAdditional;
        performanceFee = packageFee + additionalFee;
        breakdown = `3 Solos Package + ${soloCount - 3} Additional Solo${soloCount - 3 > 1 ? 's' : ''}`;
      }
    } else {
      // Single solo
      performanceFee = EODSA_FEES.PERFORMANCE.Solo;
      breakdown = '1 Solo';
    }
  } else if (performanceType === 'Duet' || performanceType === 'Trio') {
    // Duos/trios: R200 per person
    const feePerPerson = EODSA_FEES.PERFORMANCE.Duet;
    performanceFee = feePerPerson * numberOfParticipants;
    breakdown = `${performanceType} (R${feePerPerson} × ${numberOfParticipants} dancers)`;
  } else if (performanceType === 'Group') {
    // Groups: R180 per person
    const feePerPerson = EODSA_FEES.PERFORMANCE.SmallGroup;
    performanceFee = feePerPerson * numberOfParticipants;
    breakdown = `Group (R${feePerPerson} × ${numberOfParticipants} dancers)`;
  }
  
  const totalFee = registrationFee + performanceFee;
  
  return {
    registrationFee,
    performanceFee,
    totalFee,
    breakdown,
    registrationBreakdown
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