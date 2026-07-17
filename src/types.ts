export interface DiaryEntry {
  morning_pain?: number;
  noon_pain?: number;
  evening_pain?: number;
  night_pain?: number;
  morning_rls?: number;
  noon_rls?: number;
  evening_rls?: number;
  night_rls?: number;
  notes?: string;
  sleepHours?: number;
  sleepQuality?: number;
  factors?: Record<string, boolean>;
  painAreas?: string[];
  weather?: string;
  pressure?: string;
  medsTaken?: string[];
  medsTakenTimes?: Record<string, string>;
  updated?: string;
}

export interface Medication {
  id: string;
  name: string;
  pzn?: string;
  wirkstoff?: string;
  dose: string;
  form?: string;
  note?: string;
  schedule: {
    morning: number;
    noon: number;
    evening: number;
    night: number;
    [key: string]: number;
  };
  stock?: number;
  packSize?: number;
  thresholdDays: number;
  active: boolean;
  source?: string;
  stand?: string;
  verified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MoodEntry {
  stimmung?: number;
  energie?: number;
  antrieb?: number;
  angst?: number;
  reizbarkeit?: number;
  konzentration?: number;
  hoffnungslosigkeit?: number;
  symptoms?: Record<string, boolean>;
  activities?: Record<string, boolean>;
  notes?: string;
  updated?: string;
}

export interface SOSDocument {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  file: string; // base64
  uploadedAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export type IceContact = EmergencyContact;

export interface SOSData {
  patientName?: string;
  dob?: string;
  bloodType?: string;
  allergies?: string;
  diagnoses?: string;
  emergencyNotes?: string;
  iceContacts?: EmergencyContact[];

  personal?: {
    name: string;
    birthdate: string;
    address: string;
    profilePhoto: string | null;
  };
  medical?: {
    bloodGroup: string;
    allergies: string;
    chronicConditions: string;
  };
  documents?: SOSDocument[];
  emergencyContacts?: EmergencyContact[];
  metadata?: {
    lastUpdated: string;
  };
}

export interface BloodPressureEntry {
  id: string;
  date: string;
  time: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  context?: string;
  note?: string;
}

export interface Appointment {
  id: string;
  date: string;
  type: 'pain' | 'rls';
  preVisitDays: number;
}

export interface RLSSurvey {
  answers: (number | null)[];
  sum: number;
  severity: string;
  updated: string;
}

export interface SurveyConfig {
  date: string;
  answers: number[];
  sum: number;
  severity: string;
  updated: string;
}

export interface UiPrefs {
  fontScale: 'small' | 'normal' | 'large';
  visibleModules?: Record<string, boolean>;
  notificationsEnabled?: boolean;
  alarmTimes?: {
    morning: string;
    noon: string;
    evening: string;
    night: string;
  };
  rlsMode?: 'auto' | 'manual';
  surveyWeekday?: number;
  phq9?: Record<string, any>;
  gad7?: Record<string, any>;
  crisisPlan?: {
    therapist?: string;
    doctor?: string;
    person1?: string;
    person2?: string;
    plan?: string;
    warningSigns?: string;
  };
  modules?: {
    rls: boolean;
    mood: boolean;
    bp: boolean;
    sos: boolean;
    [key: string]: boolean;
  };
}
