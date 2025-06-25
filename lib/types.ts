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
  name: string; // e.g. "EODSA Regional Championships 2024 - Gauteng"
  description: string;
  region: 'Gauteng' | 'Free State' | 'Mpumalanga';
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
  submittedAt: string;
  approved: boolean;
  qualifiedForNationals: boolean;
  itemNumber?: number; // NEW: Item Number for program order
  // EODSA Regional Entry Form fields
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
  // EODSA Regional Entry Form fields
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
  'Gauteng',
  'Free State', 
  'Mpumalanga'
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

// UPDATED: Mastery levels to match client requirements
export const MASTERY_LEVELS = [
  'Water (Competition)',
  'Fire (Advanced)',
  'Earth (Eisteddfod)',
  'Air (Special Needs)'
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

// EODSA Fee Structure based on official pricing (Updated from Gabriel's fee structure)
export const EODSA_FEES = {
  // Registration fees per person (flat once-off charge per dancer)
  REGISTRATION: {
    'Water (Competition)': 250,    // R250 PP for Competitive
    'Fire (Advanced)': 250,        // R250 PP for Advanced  
    'Earth (Eisteddfod)': 150,     // R150 PP for Eisteddfod
    'Air (Special Needs)': 150     // R150 PP for Special Needs
  },
  
  // Performance fees by mastery level
  PERFORMANCE: {
    'Water (Competition)': {
      Solo: 300,           // R300 for 1st solo
      SoloAdditional: 180, // R180 for each additional solo
      Duet: 200,           // R200 per dancer (so R400 total for 2 dancers)
      Trio: 200,           // R200 per dancer (so R600 total for 3 dancers)
      Group: 180           // R180 per dancer
    },
    'Fire (Advanced)': {
      Solo: 300,           // R300 for 1st solo
      SoloAdditional: 180, // R180 for each additional solo
      Duet: 200,           // R200 per dancer (so R400 total for 2 dancers)
      Trio: 200,           // R200 per dancer (so R600 total for 3 dancers)
      Group: 180           // R180 per dancer
    },
    'Earth (Eisteddfod)': {
      Solo: 200,           // R200 for solo
      SoloAdditional: 200, // R200 for each additional solo (no package deals)
      Duet: 200,           // R200 per dancer (so R400 total for 2 dancers)
      Trio: 200,           // R200 per dancer (so R600 total for 3 dancers)
      Group: 180           // R180 per dancer
    },
    'Air (Special Needs)': {
      Solo: 200,           // R200 for solo
      SoloAdditional: 200, // R200 for each additional solo (no package deals)
      Duet: 200,           // R200 per dancer (so R400 total for 2 dancers)
      Trio: 200,           // R200 per dancer (so R600 total for 3 dancers)
      Group: 180           // R180 per dancer
    }
  },
  
  // Multiple solo packages for Competitive/Advanced ONLY
  SOLO_PACKAGES: {
    'Water (Competition)': {
      1: 300,   // 1 solo: R300
      2: 520,   // 2 solos: R520 (saves R80)
      3: 700    // 3 solos: R700 (saves R140)
      // 4+ solos: R700 + (additional_solos × R180)
    },
    'Fire (Advanced)': {
      1: 300,   // 1 solo: R300
      2: 520,   // 2 solos: R520 (saves R80)
      3: 700    // 3 solos: R700 (saves R140)
      // 4+ solos: R700 + (additional_solos × R180)
    }
    // Note: Earth (Eisteddfod) and Air (Special Needs) don't have package deals
  }
};

// EODSA Fee Calculation Function
export const calculateEODSAFee = (
  masteryLevel: string,
  performanceType: 'Solo' | 'Duet' | 'Trio' | 'Group',
  numberOfParticipants: number,
  options?: {
    isMultipleSolos?: boolean;
    soloCount?: number;
    includeRegistration?: boolean; // New option to control registration fee inclusion
    participantDancers?: Dancer[]; // NEW: Array of dancer objects to check registration status
  }
): { registrationFee: number; performanceFee: number; totalFee: number; breakdown: string; registrationBreakdown?: string } => {
  
  const { isMultipleSolos = false, soloCount = 1, includeRegistration = true, participantDancers = [] } = options || {};
  
  // Calculate registration fee intelligently based on dancer payment status
  let registrationFee = 0;
  let registrationBreakdown = '';
  
  if (includeRegistration && participantDancers.length > 0) {
    const masteryFeeMap = EODSA_FEES.REGISTRATION;
    
    // Check each dancer's registration status
    const unpaidDancers = participantDancers.filter(dancer => {
      if (!dancer.registrationFeePaid || !dancer.registrationFeeMasteryLevel) {
        return true; // Not paid at all or mastery level at time of payment is unknown
      }
      
      const paidFee = masteryFeeMap[dancer.registrationFeeMasteryLevel as keyof typeof masteryFeeMap] || 0;
      const currentFee = masteryFeeMap[masteryLevel as keyof typeof masteryFeeMap] || 0;
      
      // Charge if current fee is higher than what they paid
      return currentFee > paidFee;
    });
    
    if (unpaidDancers.length > 0) {
      // For upgrades, we could charge the difference, but for simplicity, we'll charge the full new fee
      // as the system doesn't yet support partial payments on registration.
      const registrationFeePerPerson = EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION] || 0;
      registrationFee = registrationFeePerPerson * unpaidDancers.length;
      
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
    // Fallback to old calculation if no dancer data provided
  const registrationFeePerPerson = EODSA_FEES.REGISTRATION[masteryLevel as keyof typeof EODSA_FEES.REGISTRATION] || 0;
    registrationFee = registrationFeePerPerson * numberOfParticipants;
    registrationBreakdown = `Registration fee for ${numberOfParticipants} dancer${numberOfParticipants > 1 ? 's' : ''}`;
  }
  
  let performanceFee = 0;
  let breakdown = '';
  
  // Handle solo packages for competitive/advanced levels ONLY
  if (performanceType === 'Solo' && (masteryLevel === 'Water (Competition)' || masteryLevel === 'Fire (Advanced)')) {
    const packages = EODSA_FEES.SOLO_PACKAGES[masteryLevel as keyof typeof EODSA_FEES.SOLO_PACKAGES];
    if (packages && soloCount && soloCount <= 3) {
      performanceFee = packages[soloCount as keyof typeof packages] || 0;
      breakdown = `${soloCount} Solo${soloCount > 1 ? 's' : ''} Package`;
    } else if (soloCount && soloCount > 3) {
      // 3 solos package + additional solos at R180 each
      const packageFee = packages[3];
      const additionalFee = (soloCount - 3) * EODSA_FEES.PERFORMANCE[masteryLevel as keyof typeof EODSA_FEES.PERFORMANCE].SoloAdditional;
      performanceFee = packageFee + additionalFee;
      breakdown = `3 Solos Package + ${soloCount - 3} Additional Solo${soloCount - 3 > 1 ? 's' : ''}`;
    } else {
      // Single solo
      performanceFee = EODSA_FEES.PERFORMANCE[masteryLevel as keyof typeof EODSA_FEES.PERFORMANCE].Solo;
      breakdown = '1 Solo';
    }
  } else {
    // Regular performance fees (no packages for Eisteddfod/Special Needs, or for non-solo performances)
    const performanceFees = EODSA_FEES.PERFORMANCE[masteryLevel as keyof typeof EODSA_FEES.PERFORMANCE];
    if (performanceFees) {
      const baseFee = performanceFees[performanceType as keyof typeof performanceFees] || 0;
      
      if (performanceType === 'Solo') {
        performanceFee = baseFee;
        breakdown = '1 Solo';
      } else {
        // For Duet, Trio, Group - multiply by number of dancers
        performanceFee = baseFee * numberOfParticipants;
        breakdown = `${performanceType} (R${baseFee} × ${numberOfParticipants} dancers)`;
      }
    }
  }
  
  return {
    registrationFee,
    performanceFee,
    totalFee: registrationFee + performanceFee,
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