import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ClipboardList, 
  Pill, 
  Brain, 
  BarChart3, 
  Settings, 
  ShieldAlert, 
  Activity, 
  Sun, 
  Moon, 
  Heart, 
  Trash2, 
  RotateCcw, 
  Volume2, 
  User, 
  Plus, 
  Check, 
  Lock,
  ChevronRight,
  Sliders,
  Sparkles
} from 'lucide-react';

// Core imports
import { 
  DiaryEntry, 
  Medication, 
  MoodEntry, 
  RLSSurvey, 
  SOSData, 
  Appointment, 
  UiPrefs, 
  BloodPressureEntry 
} from './types';
import { 
  todayStr, 
  addDays, 
  dailyAvgRls 
} from './utils';

import { secureStore } from './db/secureStore';

const PIN_ENABLED_KEY = 'symptochron_pin_enabled';
const LEGACY_PIN_KEY = 'symptochron_pin';
const APP_MODE_KEY = 'symptochron_app_mode';
const SECURE_DATA_KEYS = ['diary', 'meds', 'mood', 'surveys', 'appts', 'sos', 'bp', 'prefs'];

// Subcomponents
import Onboarding, { OnboardingCompletePayload } from './components/Onboarding';
import PinLock from './components/PinLock';
import WelcomeTab from './components/WelcomeTab';
import DiaryTab from './components/DiaryTab';
import RLSTab from './components/RLSTab';
import MoodTab from './components/MoodTab';
import SosTab from './components/SosTab';
import LegalNotice from './components/LegalNotice';
import PrivateMigrationPanel from './components/PrivateMigrationPanel';
import { readMigrationStatus, isPrivateMigrationEnabled } from './migration/privateMigration';

// Lazy loaded heavy tabs (AP-11)
const MedsTab = React.lazy(() => import('./components/MedsTab'));
const StatsTab = React.lazy(() => import('./components/StatsTab'));
const ExportTab = React.lazy(() => import('./components/ExportTab'));

export default function App() {
  // Global States
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  
  // Tab Navigator
  const [activeTab, setActiveTab] = useState<'welcome' | 'diary' | 'rls' | 'meds' | 'mood' | 'charts' | 'sos' | 'export'>('welcome');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  // Database core states
  const [patientName, setPatientName] = useState<string>('');
  const [diary, setDiary] = useState<Record<string, DiaryEntry>>({});
  const [meds, setMeds] = useState<Medication[]>([]);
  const [mood, setMood] = useState<Record<string, MoodEntry>>({});
  const [rlsSurveys, setRlsSurveys] = useState<Record<string, RLSSurvey>>({});
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sosData, setSosData] = useState<SOSData>({
    patientName: '',
    dob: '',
    bloodType: '',
    allergies: '',
    diagnoses: '',
    emergencyNotes: '',
    iceContacts: [],
  });
  const [bloodPressure, setBloodPressure] = useState<BloodPressureEntry[]>([]);

  // Settings & Secure PIN
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinEnabled, setPinEnabled] = useState<boolean>(false);
  const [uiPrefs, setUiPrefs] = useState<UiPrefs>({
    fontScale: 'normal',
    visibleModules: {
      welcome: true,
      diary: true,
      rls: true,
      meds: true,
      mood: true,
      stats: true,
    },
    notificationsEnabled: false,
    alarmTimes: {
      morning: '08:00',
      noon: '12:00',
      evening: '18:00',
      night: '22:00',
    },
  });

  // UI Drawer / Modals
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showBpModal, setShowBpModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState<'impressum' | 'datenschutz'>('impressum');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [appMode, setAppMode] = useState<'real' | 'demo'>('real');
  const [demoQuery, setDemoQuery] = useState('');
  const [demoResults, setDemoResults] = useState<any[]>([]);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [privateMigrationVisible, setPrivateMigrationVisible] = useState(false);

  // Blood Pressure logging States
  const [bpSystolic, setBpSystolic] = useState<number | ''>('');
  const [bpDiastolic, setBpDiastolic] = useState<number | ''>('');
  const [bpPulse, setBpPulse] = useState<number | ''>('');

  const loadSecureData = async (pin: string | null, requirePinVerifier = false): Promise<boolean> => {
    await secureStore.init(pin);

    if (requirePinVerifier) {
      const pinOk = await secureStore.verifyPin();
      if (!pinOk) return false;
    }

    // Core dataset recovery & Migration
    // Check for old clear-text data first to migrate
    const oldDiary = localStorage.getItem('symptochron_diary');
    const oldMeds = localStorage.getItem('symptochron_meds');
    const oldMood = localStorage.getItem('symptochron_mood');
    const oldSurveys = localStorage.getItem('symptochron_rls_surveys');
    const oldAppts = localStorage.getItem('symptochron_appointments');
    const oldSos = localStorage.getItem('symptochron_sos_data');
    const oldBp = localStorage.getItem('symptochron_blood_pressure');
    const oldPrefs = localStorage.getItem('symptochron_ui_prefs');

    // Migrate if found
    if (oldDiary) { await secureStore.save('diary', JSON.parse(oldDiary)); localStorage.removeItem('symptochron_diary'); }
    if (oldMeds) { await secureStore.save('meds', JSON.parse(oldMeds)); localStorage.removeItem('symptochron_meds'); }
    if (oldMood) { await secureStore.save('mood', JSON.parse(oldMood)); localStorage.removeItem('symptochron_mood'); }
    if (oldSurveys) { await secureStore.save('surveys', JSON.parse(oldSurveys)); localStorage.removeItem('symptochron_rls_surveys'); }
    if (oldAppts) { await secureStore.save('appts', JSON.parse(oldAppts)); localStorage.removeItem('symptochron_appointments'); }
    if (oldSos) { await secureStore.save('sos', JSON.parse(oldSos)); localStorage.removeItem('symptochron_sos_data'); }
    if (oldBp) { await secureStore.save('bp', JSON.parse(oldBp)); localStorage.removeItem('symptochron_blood_pressure'); }
    if (oldPrefs) { await secureStore.save('prefs', JSON.parse(oldPrefs)); localStorage.removeItem('symptochron_ui_prefs'); }

    // Load data from secure store
    const loadedDiary = await secureStore.load('diary');
    const loadedMeds = await secureStore.load('meds');
    const loadedMood = await secureStore.load('mood');
    const loadedSurveys = await secureStore.load('surveys');
    const loadedAppts = await secureStore.load('appts');
    const loadedSos = await secureStore.load('sos');
    const loadedBp = await secureStore.load('bp');
    const loadedPrefs = await secureStore.load('prefs');

    if (loadedDiary) setDiary(loadedDiary);
    if (loadedMeds) setMeds(loadedMeds);
    if (loadedMood) setMood(loadedMood);
    if (loadedSurveys) setRlsSurveys(loadedSurveys);
    if (loadedAppts) setAppointments(loadedAppts);
    if (loadedSos) {
      setSosData(loadedSos);
      if (loadedSos.patientName) setPatientName(loadedSos.patientName);
    }
    if (loadedBp) setBloodPressure(loadedBp);
    if (loadedPrefs) setUiPrefs(loadedPrefs);

    return true;
  };

  // Initial Seed & Recovery
  useEffect(() => {
    // Determine Theme
    const storedTheme = localStorage.getItem('symptochron_theme') as 'light' | 'dark' | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }

    // Determine Onboarding
    const storedOnboard = localStorage.getItem('symptochron_onboarded');
    if (storedOnboard === 'true') {
      setOnboarded(true);
    }

    const storedAppMode = localStorage.getItem(APP_MODE_KEY);
    setAppMode(storedAppMode === 'demo' ? 'demo' : 'real');

    const bootSecureStore = async () => {
      try {
        const legacyStoredPin = localStorage.getItem(LEGACY_PIN_KEY);
        const storedPinEnabled = localStorage.getItem(PIN_ENABLED_KEY) === 'true';

        if (legacyStoredPin) {
          await secureStore.init(legacyStoredPin);
          await secureStore.savePinVerifier();
          localStorage.setItem(PIN_ENABLED_KEY, 'true');
          localStorage.removeItem(LEGACY_PIN_KEY);
          setPinEnabled(true);
          setLocked(true);
          return;
        }

        if (storedPinEnabled) {
          setPinEnabled(true);
          setLocked(true);
          return;
        }

        await loadSecureData(null);
      } catch (e) {
        console.error("Boot failure:", e);
      } finally {
        setIsBooting(false);
      }
    };

    bootSecureStore();
  }, []);

  // Sync state helpers to root local storages
  // Sync state helpers to secure encrypted storage
  const syncDiary = (updated: Record<string, DiaryEntry>) => {
    setDiary(updated);
    secureStore.save('diary', updated).catch(console.error);
  };

  const syncMeds = (updated: Medication[]) => {
    setMeds(updated);
    secureStore.save('meds', updated).catch(console.error);
  };

  const syncMood = (updated: Record<string, MoodEntry>) => {
    setMood(updated);
    secureStore.save('mood', updated).catch(console.error);
  };

  const syncSurveys = (updated: Record<string, RLSSurvey>) => {
    setRlsSurveys(updated);
    secureStore.save('surveys', updated).catch(console.error);
  };

  const syncAppointments = (updated: Appointment[]) => {
    setAppointments(updated);
    secureStore.save('appts', updated).catch(console.error);
  };

  const syncSosData = (updated: SOSData) => {
    setSosData(updated);
    if (updated.patientName) setPatientName(updated.patientName);
    secureStore.save('sos', updated).catch(console.error);
  };

  const syncBp = (updated: BloodPressureEntry[]) => {
    setBloodPressure(updated);
    secureStore.save('bp', updated).catch(console.error);
  };

  const syncPrefs = (updated: UiPrefs) => {
    setUiPrefs(updated);
    secureStore.save('prefs', updated).catch(console.error);
  };

  // Medication Reminders background poller
  useEffect(() => {
    if (!uiPrefs.notificationsEnabled) return;

    // Check if permission is granted, otherwise request it
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkReminders = () => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // Year-Month-Day
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const slots: ('morning' | 'noon' | 'evening' | 'night')[] = ['morning', 'noon', 'evening', 'night'];

      slots.forEach((slot) => {
        const alarmTime = uiPrefs.alarmTimes?.[slot];
        if (!alarmTime) return;

        // Check if current time matches alarm configured time
        if (alarmTime === timeStr) {
          const storageKey = `symptochron_notified_${slot}_${dateStr}`;
          if (localStorage.getItem(storageKey)) return;

          // Find active meds with schedule in this slot
          const slotMeds = meds.filter(m => m.active && m.schedule?.[slot] > 0);
          if (slotMeds.length === 0) return;

          // Register notified in localStorage immediately to avoid repeat firings in this minute
          localStorage.setItem(storageKey, 'true');

          const slotGerman: Record<string, string> = {
            morning: 'Morgens',
            noon: 'Mittags',
            evening: 'Abends',
            night: 'Nachts'
          };

          const title = `💊 Medikamenten-Erinnerung: ${slotGerman[slot]} (${alarmTime})`;
          const body = slotMeds.map(m => `• ${m.name} ${m.dose ? `(${m.dose})` : ''}: ${m.schedule[slot]}x`).join('\n');

          // 1. Browser Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification(title, {
                body,
                tag: `meds-${slot}-${dateStr}`,
                requireInteraction: true,
              });
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch (err) {
              console.error('Failed to throw web notification:', err);
            }
          }

          // 2. In-App Toast
          showToast(`🔔 Erinnerung: Bitte deine Medikamente für ${slotGerman[slot]} einnehmen!`);
        }
      });
    };

    // Poll every 30 seconds
    const interval = setInterval(checkReminders, 30000);
    // Execute immediately on mount
    checkReminders();

    return () => clearInterval(interval);
  }, [uiPrefs.notificationsEnabled, uiPrefs.alarmTimes, meds]);

  // Toast Notification manager
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Automated 30-day Backup Reminder
  useEffect(() => {
    const lastBackup = localStorage.getItem('symptochron_last_backup_reminder');
    const now = new Date().getTime();
    // 30 days in ms = 30 * 24 * 60 * 60 * 1000 = 2592000000
    if (!lastBackup || now - parseInt(lastBackup, 10) > 2592000000) {
      const timer = setTimeout(() => {
        setToastMessage('⚠️ Sicherheits-Erinnerung: Bitte erstelle heute ein verschlüsseltes Daten-Backup unter Export & Settings!');
        setTimeout(() => setToastMessage(null), 5000);
        localStorage.setItem('symptochron_last_backup_reminder', now.toString());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Self seeding mock records for high fidelity views!
  const triggerSelfSeeding = () => {
    const today = todayStr();

    // Erika's meds list
    const seededMeds: Medication[] = [
      {
        id: 'med_see1',
        name: 'Pramipexol (Dopaminagonist)',
        dose: '0.18 mg',
        form: 'Tablette',
        schedule: { morning: 0, noon: 0, evening: 0, night: 1 },
        stock: 84,
        packSize: 100,
        thresholdDays: 10,
        note: 'Gegen RLS-Symptome, abends einnehmen',
        active: true,
      },
      {
        id: 'med_see2',
        name: 'Gabapentin (Gabapentinoid / Antikonvulsivum)',
        dose: '300 mg',
        form: 'Kapsel',
        schedule: { morning: 1, noon: 0, evening: 1, night: 0 },
        stock: 45,
        packSize: 100,
        thresholdDays: 7,
        note: 'Nach dem Essen einnehmen',
        active: true,
      },
      {
        id: 'med_see3',
        name: 'Ibuprofen',
        dose: '400 mg',
        form: 'Filmtablette',
        schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
        stock: 20,
        packSize: 20,
        thresholdDays: 5,
        note: 'Bei Bedarf bei schweren Schmerzschüben',
        active: true,
      }
    ];

    // Seed 10 previous days of Diary content
    const seededDiary: Record<string, DiaryEntry> = {};
    const seededMood: Record<string, MoodEntry> = {};

    for (let i = 10; i >= 0; i--) {
      const d = addDays(today, -i);
      
      // Seed pain indicators and factors fluctuate based on coffee/stress
      const hasCoffee = i % 3 === 0;
      const hasStress = i % 4 === 1;
      const isWeekend = i === 2 || i === 3 || i === 9 || i === 10;

      // Higher coffee and stress directly triggers worse RLS and pain indices
      const painFactor = hasStress ? 2 : 0;
      const rlsFactor = hasCoffee ? 3 : 0;

      seededDiary[d] = {
        morning_pain: Math.max(1, 2 + painFactor - (isWeekend ? 1 : 0)),
        noon_pain: Math.max(1, 3 + painFactor - (isWeekend ? 1 : 0)),
        evening_pain: Math.max(1, 4 + painFactor + rlsFactor),
        night_pain: Math.max(2, 5 + painFactor + rlsFactor * 1.5),

        morning_rls: Math.max(0, 1 + rlsFactor),
        noon_rls: Math.max(0, 1 + rlsFactor),
        evening_rls: Math.max(1, 4 + rlsFactor),
        night_rls: Math.max(2, 7 + rlsFactor * 1.5),

        sleepHours: Math.max(4, 7.5 - rlsFactor * 0.5 - (hasStress ? 1 : 0)),
        sleepQuality: Math.max(1, 4 - (rlsFactor > 0 ? 1.5 : 0)),
        
        factors: {
          coffee: hasCoffee,
          alcohol: i % 5 === 0,
          stress: hasStress,
          sport: i % 3 === 1,
          poorSleep: rlsFactor > 3,
        },
        painAreas: i % 3 === 0 ? ['l_shoulder', 'l_hand'] : ['l_leg_lower', 'r_leg_lower'],
        weather: i % 2 === 0 ? 'sun' : 'rain',
        pressure: i % 3 === 1 ? 'high' : 'normal',
        medsTaken: ['med_see1_night', 'med_see2_morning', 'med_see2_evening'],
        notes: `Tagebucheintrag vor ${i} Tagen. RLS kribbelte abends. ${hasCoffee ? 'Kaffee trug eventuell bei.' : ''}`,
      };

      // Seed mood logs correspondingly
      seededMood[d] = {
        stimmung: Math.max(2, 7 - (hasStress ? 2 : 0) - (rlsFactor > 3 ? 1.5 : 0)),
        energie: Math.max(2, 6 - (hasStress ? 1.5 : 0)),
        antrieb: Math.max(2, 7 - (hasStress ? 1 : 0)),
        angst: Math.max(1, 2 + (hasStress ? 3 : 0)),
        reizbarkeit: Math.max(1, 3 + (hasStress ? 2 : 0)),
        konzentration: Math.max(3, 7 - (hasStress ? 1 : 0)),
        hoffnungslosigkeit: Math.max(1, 2 + (hasStress ? 1.5 : 0)),
        activities: {
          spaziergang: i % 2 === 0,
          sport: i % 3 === 1,
          meditation: i % 4 === 0,
        },
        symptoms: {
          gruebeln: hasStress,
          antriebslosigkeit: hasStress && rlsFactor > 3,
        },
        notes: `Stimmungsnotizen vor ${i} Tagen. Befinden war mäßig stabil.`,
      };
    }

    // Seed weekly IRLS questionnaire
    const seededSurveys: Record<string, RLSSurvey> = {
      [addDays(today, -7)]: {
        sum: 27,
        severity: 'Schwere RLS-Beschwerden',
        answers: [3, 3, 2, 4, 3, 3, 3, 2, 2, 2],
        updated: addDays(today, -7),
      }
    };

    // Seed ICE contacts & clinical dossier
    const seededSos: SOSData = {
      patientName: 'Erika Mustermann',
      dob: '12.04.1978',
      bloodType: 'A+',
      allergies: 'Penicillin-Allergie',
      diagnoses: 'Restless-Legs-Syndrom (schwer), Fibromyalgie, chronische Migräne',
      emergencyNotes: 'Symptomatische Schübe vorwiegend nachts. Betroffene reagiert gut auf Kaltbäder.',
      iceContacts: [
        {
          id: 'ice_1',
          name: 'Thomas Mustermann',
          phone: '+49 170 5551234',
          relationship: 'Ehepartner',
        }
      ],
    };

    // Seed Blood pressures
    const seededBp: BloodPressureEntry[] = [
      { id: 'bp_1', date: addDays(today, -3), time: '08:30', systolic: 124, diastolic: 82, pulse: 72 },
      { id: 'bp_2', date: addDays(today, -2), time: '20:15', systolic: 128, diastolic: 84, pulse: 68 },
      { id: 'bp_3', date: addDays(today, -1), time: '08:15', systolic: 122, diastolic: 80, pulse: 70 },
    ];

    syncMeds(seededMeds);
    syncDiary(seededDiary);
    syncMood(seededMood);
    syncSurveys(seededSurveys);
    syncSosData(seededSos);
  syncBp(seededBp);

  localStorage.setItem('symptochron_seeded', 'true');
  localStorage.setItem(APP_MODE_KEY, 'demo');
  setAppMode('demo');
  showToast('✨ Demo-Daten zur Visualisierung geladen!');
};

  // Onboarding Complete Handler
  const handleCompleteOnboarding = async ({ name, bday, pin, mode }: OnboardingCompletePayload) => {
  setIsBooting(true);
  try {
    await secureStore.changePin(pinCode, pin, SECURE_DATA_KEYS);

    setPinCode(pin);
    setPinEnabled(true);
    localStorage.setItem(PIN_ENABLED_KEY, 'true');
    localStorage.removeItem(LEGACY_PIN_KEY);

    const updatedSos = { ...sosData, patientName: name, dob: bday || '' };
    syncSosData(updatedSos);

    localStorage.setItem('symptochron_onboarded', 'true');
    setOnboarded(true);

    if (mode === 'demo') {
      triggerSelfSeeding();
      setActiveTab('welcome');
    } else if (mode === 'import') {
      localStorage.setItem(APP_MODE_KEY, 'real');
      localStorage.removeItem('symptochron_seeded');
      setAppMode('real');
      setActiveTab('export');
      showToast('📦 Wähle im Importbereich deine SymptoChron-Backupdatei aus.');
    } else {
      localStorage.setItem(APP_MODE_KEY, 'real');
      localStorage.removeItem('symptochron_seeded');
      setAppMode('real');
      setActiveTab('welcome');
      showToast('🎉 Onboarding abgeschlossen!');
    }
  } catch (e) {
    console.error('Onboarding PIN setup failed:', e);
    throw e;
  } finally {
    setIsBooting(false);
  }
};

  // Secure PIN change & DB Re-encryption
  const handleConfigurePin = async (newPin: string | null) => {
    setIsBooting(true);
    try {
      await secureStore.changePin(pinCode, newPin, SECURE_DATA_KEYS);

      if (newPin) {
        setPinCode(newPin);
        setPinEnabled(true);
        localStorage.setItem(PIN_ENABLED_KEY, 'true');
        localStorage.removeItem(LEGACY_PIN_KEY);
        showToast('🔒 PIN-Sperre erfolgreich eingerichtet & Daten verschlüsselt.');
      } else {
        setPinCode(null);
        setPinEnabled(false);
        localStorage.removeItem(PIN_ENABLED_KEY);
        localStorage.removeItem(LEGACY_PIN_KEY);
        showToast('🔓 PIN-Schutz deaktiviert. Auto-Key gesetzt.');
      }
    } catch (e) {
      console.error('Failed to change PIN:', e);
      showToast('❌ Fehler bei der Neuausrichtung der Verschlüsselung.');
    } finally {
      setIsBooting(false);
    }
  };

  // Toggling medications inline from welcome Schnellbestätigung
  const handleToggleMedTaken = (slotId: string) => {
    const curToday = todayStr();
    const e = diary[curToday] || {};
    let isTakenList = e.medsTaken ? [...e.medsTaken] : [];

    const isMarkingAsTaken = !isTakenList.includes(slotId);
    if (isMarkingAsTaken) {
      isTakenList.push(slotId);
    } else {
      isTakenList = isTakenList.filter(id => id !== slotId);
    }

    // Dynamic stock adjustment
    const medId = slotId.includes('_') ? slotId.split('_')[0] : slotId;
    const slotKey = slotId.includes('_') ? slotId.split('_')[1] : null;

    const updatedMeds = meds.map(m => {
      if (m.id === medId && m.stock !== undefined) {
        const amount = slotKey ? (m.schedule[slotKey] || 1) : 1;
        const newStock = isMarkingAsTaken 
          ? Math.max(0, m.stock - amount) 
          : m.stock + amount;
        return { ...m, stock: newStock };
      }
      return m;
    });

    syncMeds(updatedMeds);

    const updatedDiary = {
      ...diary,
      [curToday]: {
        ...e,
        medsTaken: isTakenList,
        updated: new Date().toISOString(),
      },
    };
    syncDiary(updatedDiary);
    showToast(isMarkingAsTaken ? '✓ Einnahme bestätigt & Bestand aktualisiert!' : '✓ Einnahme widerrufen & Bestand zurückgesetzt.');
  };

  // Mark all medications scheduled today as taken
  const handleConfirmAllMedsToday = () => {
    const curToday = todayStr();
    const e = diary[curToday] || {};
    const slots = ['morning', 'noon', 'evening', 'night'];
    const currentTaken = e.medsTaken || [];
    
    const allSlotIds: string[] = [];
    const stockDeductions: Record<string, number> = {};

    meds.forEach(m => {
      slots.forEach(s => {
        if (m.schedule[s] > 0) {
          const slotId = `${m.id}_${s}`;
          allSlotIds.push(slotId);

          // Deduct stock if not already taken
          if (!currentTaken.includes(slotId) && m.stock !== undefined) {
            stockDeductions[m.id] = (stockDeductions[m.id] || 0) + m.schedule[s];
          }
        }
      });
    });

    // Apply stock deductions
    const updatedMeds = meds.map(m => {
      if (stockDeductions[m.id] !== undefined && m.stock !== undefined) {
        return { ...m, stock: Math.max(0, m.stock - stockDeductions[m.id]) };
      }
      return m;
    });

    syncMeds(updatedMeds);

    const updatedDiary = {
      ...diary,
      [curToday]: {
        ...e,
        medsTaken: allSlotIds,
        updated: new Date().toISOString(),
      },
    };
    syncDiary(updatedDiary);
    showToast('✅ Alle Einnahmen bestätigt & Bestände aktualisiert!');
  };

  // "Wie gestern ausfüllen" - copies from yesterday to today or selected day
  const handleCopyFromYesterday = () => {
    const yesterday = addDays(selectedDate, -1);
    const yEntry = diary[yesterday];
    
    if (!yEntry) {
      showToast('⚠️ Gestern wurde kein Tagebucheintrag erfasst.');
      return;
    }

    // copy indices excluding timestamp elements
    const copied: DiaryEntry = {
      ...yEntry,
      updated: new Date().toISOString(),
      medsTaken: [], // Clear intake ticks to let patient fill fresh
    };

    const updatedDiary = {
      ...diary,
      [selectedDate]: copied,
    };
    syncDiary(updatedDiary);
    showToast('📋 Daten von gestern übernommen!');
  };

  const handleRefillInventory = (id: string) => {
    const updated = meds.map(m => {
      if (m.id === id) {
        return {
          ...m,
          stock: (m.stock || 0) + (m.packSize || 100),
        };
      }
      return m;
    });
    syncMeds(updated);
    showToast('📦 Bestand aufgefüllt!');
  };

  // Saving daily logs
  const handleSaveDiaryEntry = (date: string, entry: DiaryEntry) => {
    const updated = {
      ...diary,
      [date]: entry,
    };
    syncDiary(updated);
    showToast('💾 Tagebucheintrag gespeichert!');
  };

  // Save Mood logs
  const handleSaveMoodLog = (date: string, entry: MoodEntry) => {
    const updated = {
      ...mood,
      [date]: entry,
    };
    syncMood(updated);
    showToast('🧠 Stimmungseintrag protokolliert!');
  };

  // Add Appointment
  const handleAddAppointment = (appt: Appointment) => {
    const updated = [...appointments, appt];
    syncAppointments(updated);
    showToast('📅 Konsultationstermin vorgemerkt.');
  };

  // Delete Appointment
  const handleDeleteAppointment = (id: string) => {
    const updated = appointments.filter(a => a.id !== id);
    syncAppointments(updated);
    showToast('🗑️ Termin gelöscht.');
  };

  // Save clinical questionnaires
  const handleSaveIRLSSurvey = (answers: number[]) => {
    const date = todayStr();
    const sum = answers.reduce((a, b) => a + b, 0);
    
    let severity = 'Leichte Symptome';
    if (sum >= 11 && sum <= 20) severity = 'Mäßige Symptome';
    if (sum >= 21 && sum <= 30) severity = 'Schwere Symptome';
    if (sum >= 31) severity = 'Sehr schwere Symptome';

    const item: RLSSurvey = {
      answers,
      sum,
      severity,
      updated: date,
    };

    const updated = {
      ...rlsSurveys,
      [date]: item,
    };
    syncSurveys(updated);
  };

  // Save PHQ-9 & GAD-7
  const handleSavePHQ9 = (date: string, answers: number[]) => {
    const sum = answers.reduce((a, b) => a + b, 0);
    let severity = 'Minimale oder keine Depression';
    if (sum >= 5 && sum <= 9) severity = 'Leichte depressive Episode';
    if (sum >= 10 && sum <= 14) severity = 'Mittelgradige depressive Episode';
    if (sum >= 15 && sum <= 19) severity = 'Mittelgradig schwere Episode';
    if (sum >= 20) severity = 'Schwere depressive Episode';

    const updated = {
      ...uiPrefs,
      phq9: {
        ...uiPrefs.phq9,
        [date]: { answers, sum, severity, updated: new Date().toISOString() },
      }
    };
    syncPrefs(updated);
  };

  const handleSaveGAD7 = (date: string, answers: number[]) => {
    const sum = answers.reduce((a, b) => a + b, 0);
    let severity = 'Keine oder minimale Angst';
    if (sum >= 5 && sum <= 9) severity = 'Leichte Angststörung';
    if (sum >= 10 && sum <= 14) severity = 'Mittelgradige Angststörung';
    if (sum >= 15) severity = 'Schwere Angststörung';

    const updated = {
      ...uiPrefs,
      gad7: {
        ...uiPrefs.gad7,
        [date]: { answers, sum, severity, updated: new Date().toISOString() },
      }
    };
    syncPrefs(updated);
  };

  // Blood pressure logs add
  const handleAddBloodPressure = () => {
    if (bpSystolic === '' || bpDiastolic === '') {
      showToast('⚠️ Bitte Werte für Systole und Diastole angeben.');
      return;
    }

    const today = todayStr();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const item: BloodPressureEntry = {
      id: 'bp_' + Date.now().toString(36),
      date: today,
      time: timeStr,
      systolic: Number(bpSystolic),
      diastolic: Number(bpDiastolic),
      pulse: bpPulse !== '' ? Number(bpPulse) : undefined,
    };

    const updated = [...bloodPressure, item];
    syncBp(updated);

    setBpSystolic('');
    setBpDiastolic('');
    setBpPulse('');
    setShowBpModal(false);
    showToast('🩸 Blutdruck-Messung erfasst!');
  };

  const handleDeleteBp = (id: string) => {
    const updated = bloodPressure.filter(e => e.id !== id);
    syncBp(updated);
    showToast('🗑️ Messung entfernt.');
  };

  const handleClearAllData = () => {
    const migrationStatus = readMigrationStatus();
    if (isPrivateMigrationEnabled() && migrationStatus.verificationStatus === 'in_progress') {
      showToast('⚠️ Löschfunktion während aktiver Migration blockiert.');
      return;
    }
    localStorage.clear();
    setDiary({});
    setMeds([]);
    setMood({});
    setRlsSurveys({});
    setAppointments([]);
    setSosData({ patientName: '', dob: '', bloodType: '', allergies: '', diagnoses: '', emergencyNotes: '', iceContacts: [] });
    setBloodPressure([]);
    setOnboarded(false);
    setLocked(false);
    setPinCode(null);
    setAppMode('real');
    showToast('🗑️ Alle lokalen App-Daten vollständig gelöscht.');
  };

  const handleRestoreBackup = (data: any) => {
    if (data.diary) syncDiary(data.diary);
    if (data.meds) syncMeds(data.meds);
    if (data.mood) syncMood(data.mood);
    if (data.rlsSurveys) syncSurveys(data.rlsSurveys);
    if (data.sosData) syncSosData(data.sosData);
    localStorage.setItem(APP_MODE_KEY, 'real');
    localStorage.removeItem('symptochron_seeded');
    setAppMode('real');
  };

  // Toggle layout font sizes custom class on body or main frame
  const fontStyleClass = uiPrefs.fontScale === 'large' ? 'text-[108%]' : '';

  // Intercept if booting/decrypting DB
  if (isBooting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black font-bold text-2xl shadow-lg shadow-white/10 font-serif select-none mb-6"
        >
          S
        </motion.div>
        <Lock className="w-5 h-5 mb-3 text-violet-400 animate-pulse" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Datenbank wird entschlüsselt...</h2>
      </div>
    );
  }

  // Intercept if onboarding is active
  if (!onboarded) {
    return (
      <Onboarding 
        onComplete={handleCompleteOnboarding} 
      />
    );
  }

  // Intercept locked state
  if (locked && pinEnabled) {
    return (
      <PinLock
        mode="lock"
        checkPin={null}
        verifyPin={async (pin) => {
          try {
            return await loadSecureData(pin, true);
          } catch (e) {
            console.error('PIN verification failed:', e);
            return false;
          }
        }}
        onSuccess={(pin) => {
          setPinCode(pin);
          setLocked(false);
          showToast('🔓 Willkommen zurück!');
        }}
        onCancel={() => {}}
      />
    );
  }

  return (
    <div className={`min-h-screen relative flex flex-col ${
      theme === 'dark' 
        ? 'bg-[#0A0A0A] text-[#E0E0E0] font-sans' 
        : 'bg-slate-50 text-slate-900 font-sans'
    } ${fontStyleClass}`}>

      {/* Floating toast alerts banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-110 px-5 py-3 rounded-2xl bg-slate-900/90 text-white text-xs font-bold shadow-2xl border border-slate-800 shadow-slate-950/40 select-none flex items-center gap-2"
          >
            <span>✨</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Header section */}
      <header className={`sticky top-0 z-80 px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-md border-b flex items-center justify-between transition-colors ${
        theme === 'dark' ? 'bg-gradient-to-r from-black via-[#0A0A0A]/95 to-[#0A0A0A]/85 border-[#1F1F1F]' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <img
            src="/icon-192-header.png"
            alt="SymptoChron Logo"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/icon-192.png';
            }}
            className="h-8 w-auto sm:h-9 object-contain drop-shadow-md select-none shrink-0"
          />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#888] mb-0.5 leading-none">Diagnose &amp; Chronik</p>
            <h1 className="text-xl font-light tracking-tight italic font-serif text-slate-100">SymptoChron</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Theme custom triggers */}
          <button
            type="button"
            onClick={() => {
              const updated = theme === 'dark' ? 'light' : 'dark';
              setTheme(updated);
              localStorage.setItem('symptochron_theme', updated);
            }}
            className={`p-2 rounded-xl border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-900 border-slate-850 text-amber-400 hover:text-amber-300' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Core settings cog trigger */}
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(true)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200' 
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Container body panel */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-5 md:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.985, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -15 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center py-24 text-slate-500 animate-pulse text-[10px] uppercase tracking-widest gap-3 font-semibold">
                <div className="w-5 h-5 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                Bereich wird geladen...
              </div>
            }>
              {activeTab === 'welcome' && (
              <WelcomeTab
                diary={diary}
                meds={meds}
                mood={mood}
                patientName={patientName}
                onSwitchTab={setActiveTab}
                onToggleMed={handleToggleMedTaken}
                onConfirmAllMeds={handleConfirmAllMedsToday}
                appointments={appointments}
              />
            )}

            {activeTab === 'diary' && (
              <DiaryTab
                diary={diary}
                meds={meds}
                selectedDate={selectedDate}
                onSetSelectedDate={setSelectedDate}
                onSaveEntry={handleSaveDiaryEntry}
                onCopyFromYesterday={handleCopyFromYesterday}
                showToast={showToast}
              />
            )}

            {activeTab === 'rls' && (
              <RLSTab
                diary={diary}
                appointments={appointments}
                rlsSurveys={rlsSurveys}
                onAddAppointment={handleAddAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                onSaveSurvey={handleSaveIRLSSurvey}
                rlsMode={uiPrefs.rlsMode || 'auto'}
                onSetRlsMode={(mode) => syncPrefs({ ...uiPrefs, rlsMode: mode })}
                surveyWeekday={uiPrefs.surveyWeekday !== undefined ? uiPrefs.surveyWeekday : 6}
                onSetSurveyWeekday={(day) => syncPrefs({ ...uiPrefs, surveyWeekday: day })}
              />
            )}

            {activeTab === 'meds' && (
              <MedsTab
                meds={meds}
                onAddMed={(med) => syncMeds([...meds, med])}
                onDeleteMed={(id) => syncMeds(meds.filter(m => m.id !== id))}
                onUpdateMed={(item) => syncMeds(meds.map(m => m.id === item.id ? item : m))}
                onRefillMed={handleRefillInventory}
                settings={uiPrefs}
                onSaveSettings={syncPrefs}
                showToast={showToast}
                patientName={patientName}
                patientBday={sosData.dob}
              />
            )}

            {activeTab === 'mood' && (
              <MoodTab
                mood={mood}
                selectedDate={selectedDate}
                onSetSelectedDate={setSelectedDate}
                onSaveMood={handleSaveMoodLog}
                phq9={uiPrefs.phq9 || {}}
                onSavePhq9={handleSavePHQ9}
                gad7={uiPrefs.gad7 || {}}
                onSaveGad7={handleSaveGAD7}
                crisisPlan={{
                  therapist: uiPrefs.crisisPlan?.therapist || '',
                  doctor: uiPrefs.crisisPlan?.doctor || '',
                  person1: uiPrefs.crisisPlan?.person1 || '',
                  person2: uiPrefs.crisisPlan?.person2 || '',
                  plan: uiPrefs.crisisPlan?.plan || '',
                  warningSigns: uiPrefs.crisisPlan?.warningSigns || '',
                }}
                onSaveCrisisPlan={(data) => syncPrefs({ ...uiPrefs, crisisPlan: data })}
                showToast={showToast}
              />
            )}

            {activeTab === 'charts' && (
              <StatsTab
                diary={diary}
                mood={mood}
                rlsSurveys={rlsSurveys}
                meds={meds}
              />
            )}

            {activeTab === 'sos' && (
              <SosTab
                sosData={sosData}
                onSaveSosData={syncSosData}
                showToast={showToast}
              />
            )}

            {activeTab === 'export' && (
              <ExportTab
                diary={diary}
                meds={meds}
                mood={mood}
              rlsSurveys={rlsSurveys}
              sosData={sosData}
              isDemoMode={appMode === 'demo'}
              onRestoreBackup={handleRestoreBackup}
                onClearAllData={handleClearAllData}
                showToast={showToast}
              />
            )}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation Tab rails */}
      <nav className={`fixed bottom-0 left-0 right-0 z-90 px-2 py-2 border-t backdrop-blur-xl flex justify-around transition-colors items-center min-h-[60px] pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${
        theme === 'dark' 
          ? 'bg-[#0A0A0A]/90 border-[#1F1F1F]' 
          : 'bg-white/85 border-slate-100/70'
      }`}>
        {[
          { id: 'welcome', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
          { id: 'diary', label: 'Log', icon: <ClipboardList className="h-4 w-4" /> },
          { id: 'rls', label: 'RLS', icon: <Activity className="h-4 w-4" /> },
          { id: 'meds', label: 'Meds', icon: <Pill className="h-4 w-4" /> },
          { id: 'mood', label: 'Stimmung', icon: <Brain className="h-4 w-4" /> },
          { id: 'charts', label: 'Charts', icon: <BarChart3 className="h-4 w-4" /> },
          { id: 'sos', label: 'SOS', icon: <ShieldAlert className="h-4 w-4" /> },
          { id: 'export', label: 'Export', icon: <RotateCcw className="h-4 w-4" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 transition-all rounded-xl cursor-pointer ${
                isActive 
                  ? theme === 'dark' 
                    ? 'text-white bg-[#111111] border border-[#1F1F1F] font-bold scale-102' 
                    : 'text-blue-600 bg-slate-100 font-bold scale-102' 
                  : theme === 'dark'
                    ? 'text-[#555] hover:text-[#888]'
                    : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              <span className="text-[9px] mt-1 font-semibold leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Space spacer for bottom nav */}
      <div className="h-[60px]" />

      {/* Sliding Drawer Settings panel */}
      <AnimatePresence>
        {showSettingsDrawer && (
          <div className="fixed inset-0 z-100 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsDrawer(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`relative w-80 max-w-full h-full p-6 flex flex-col justify-between shadow-2xl z-10 border-l overflow-y-auto ${
                theme === 'dark' ? 'bg-[#0A0A0A] border-[#1F1F1F]' : 'bg-white border-slate-250'
              }`}
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-base font-black tracking-tight flex items-center gap-2">
                    <Sliders className="h-4.5 w-4.5 text-blue-500" /> Einstellungen
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowSettingsDrawer(false)}
                    className="p-1 px-2 hover:bg-slate-800 text-xs font-bold text-slate-500 rounded-lg"
                  >
                    Schließen
                  </button>
                </div>

                {/* Patient profiles configurations */}
                <div className="space-y-4 pt-2 border-t border-slate-850/65">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Patienten-Dossier</div>
                  
                  <div className="space-y-1.5 bg-slate-950/40 p-3.5 border border-slate-850 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-450 block mb-1">Patientenname</span>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => {
                        setPatientName(e.target.value);
                        syncSosData({ ...sosData, patientName: e.target.value });
                      }}
                      className="w-full text-xs font-bold py-2 bg-transparent border-b border-slate-850 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Font Scaling config */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Layout &amp; Schriftgröße</span>
                  
                  <div className="flex gap-2.5">
                    {[
                      { scale: 'normal', label: 'Standard (1x)' },
                      { scale: 'large', label: 'Barrierefrei (1.1x)' }
                    ].map(item => (
                      <button
                        key={item.scale}
                        type="button"
                        onClick={() => syncPrefs({ ...uiPrefs, fontScale: item.scale as any })}
                        className={`flex-1 py-3 text-[10px] font-bold rounded-xl border transition-all ${
                          uiPrefs.fontScale === item.scale
                            ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                            : 'bg-slate-950/45 border-slate-850 text-slate-400 hover:text-slate-205'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PIN Code Configuration */}
                <div className="space-y-3.5 pt-2 border-t border-slate-850/60">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">🔒 App-Sperre (PIN-Schutz)</span>
                  
                  {pinCode ? (
                    <div className="space-y-2">
                      <span className="text-[11px] text-slate-400 block font-semibold">🔒 Schützt deine Patientenakten und Notizen vor fremdem Zugriff.</span>
                      <button
                        type="button"
                        onClick={() => handleConfigurePin(null)}
                        className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600/15 border border-rose-500/25 text-rose-400 rounded-xl text-[10px] font-bold"
                      >
                        PIN-Code entfernen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <span className="text-[11px] text-slate-500 block">Richte einen 4-stelligen Absicherungs-PIN ein.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const code = prompt('Gib einen 4-stelligen neuen PIN ein:');
                          if (code && code.match(/^\d{4}$/)) {
                            handleConfigurePin(code);
                          } else if (code) {
                            alert('Ungültig! Der PIN muss genau aus 4 Ziffern bestehen.');
                          }
                        }}
                        className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-extrabold active:scale-95 transition-all"
                      >
                        + PIN-Satz einrichten
                      </button>
                    </div>
                  )}
                </div>

                {/* Blood pressure logging modal trigger inside sidebar */}
                <div className="space-y-3 pt-2.5 border-t border-slate-850/60">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">🩸 Blutdruck logs</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsDrawer(false);
                      setShowBpModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/15 transition-all cursor-pointer"
                  >
                    🩸 Blutdruck protokollieren
                  </button>
                </div>

                {/* Developer Demo API */}
                <div className="space-y-3 pt-2.5 border-t border-slate-850/60">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">🧪 Entwickleroptionen</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsDrawer(false);
                      setShowDemoModal(true);
                    }}
                    className="w-full py-3 bg-violet-600/10 hover:bg-violet-600/15 border border-violet-500/20 text-violet-400 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    BfArM Demo-Suche testen
                  </button>
                </div>

                {/* Seeding diagnostic trigger tools */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Datentransfer &amp; Demos</span>
                  <button
                    type="button"
                    onClick={() => {
                      const hasRealData = Object.keys(diary).length > 0 || meds.length > 0 || Object.keys(mood).length > 0;
                      if (appMode === 'real' && hasRealData) {
                        showToast('⚠️ Demo-Daten können im Echtmodus mit vorhandenen Daten nicht geladen werden.');
                        return;
                      }
                      triggerSelfSeeding();
                      setShowSettingsDrawer(false);
                    }}
                    className="w-full text-left p-3 border border-slate-800 bg-slate-950/30 rounded-xl text-[10px] text-slate-400 font-semibold flex items-center justify-between hover:text-white hover:border-slate-700 transition"
                  >
                    <span>Lade 10 Tage RLS-Demo-Daten</span>
                    <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                    </button>
                </div>

                {isPrivateMigrationEnabled() && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-850/60">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">🛠 Private Erstübernahme</span>
                    <button
                      type="button"
                      onClick={() => setPrivateMigrationVisible(true)}
                      className="w-full py-3 bg-emerald-600/10 hover:bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      Verlustfreie Migration öffnen
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-slate-600 font-mono text-center pt-8 space-y-2 flex flex-col items-center">
                <span>SymptoChron v1.0.0 (Offline-Pass)</span>
                <div className="flex gap-2.5 text-slate-550 font-sans font-bold uppercase text-[8px] justify-center tracking-wider">
                  <button 
                    type="button" 
                    onClick={() => { setLegalInitialTab('impressum'); setShowSettingsDrawer(false); setShowLegalModal(true); }} 
                    className="hover:text-blue-400 transition cursor-pointer"
                  >
                    Impressum
                  </button>
                  <span>·</span>
                  <button 
                    type="button" 
                    onClick={() => { setLegalInitialTab('datenschutz'); setShowSettingsDrawer(false); setShowLegalModal(true); }} 
                    className="hover:text-blue-400 transition cursor-pointer"
                  >
                    Datenschutz
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Blood Pressure logging modal overlay */}
      {showBpModal && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              🩸 Blutdruck-Logbuch
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400">Systole (mmHg)</label>
                <input
                  type="number"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="z.B. 120"
                  className="w-full text-center py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400">Diastole (mmHg)</label>
                <input
                  type="number"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="z.B. 80"
                  className="w-full text-center py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400">Puls (BPM)</label>
                <input
                  type="number"
                  value={bpPulse}
                  onChange={(e) => setBpPulse(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="z.B. 72"
                  className="w-full text-center py-3 bg-slate-955 border border-slate-850 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowBpModal(false)}
                className="flex-1 py-3 bg-slate-800 text-slate-350 font-bold rounded-xl text-xs"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAddBloodPressure}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-505 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10"
              >
                Hinzufügen
              </button>
            </div>

            {/* Past Blood pressure records list */}
            {bloodPressure.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-850/60 max-h-48 overflow-y-auto">
                <span className="text-[10px] text-slate-550 uppercase font-black tracking-wide block">Bisherige Messungen</span>
                
                {bloodPressure.slice().reverse().map(bp => {
                  let bpStatus = 'Normal';
                  let bpColor = 'text-emerald-400';
                  if (bp.systolic >= 140 || bp.diastolic >= 90) {
                    bpStatus = 'Hypertonie Grad 1+';
                    bpColor = 'text-rose-455 font-bold animate-pulse';
                  } else if (bp.systolic >= 130 || bp.diastolic >= 85) {
                    bpStatus = 'Hoch normal';
                    bpColor = 'text-amber-400';
                  }

                  return (
                    <div key={bp.id} className="flex justify-between items-center p-3 bg-slate-955/60 border border-slate-850/65 rounded-xl font-sans">
                      <div>
                        <div className="text-[11px] font-bold text-slate-200">
                          {bp.systolic} / {bp.diastolic} mmHg {bp.pulse && `· 💓 ${bp.pulse} BPM`}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                          {bp.date} · {bp.time} Uhr
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${bpColor}`}>{bpStatus}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBp(bp.id)}
                          className="text-[10px] text-slate-505 hover:text-rose-450 pl-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BfArM Demo Search Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowDemoModal(false)} />
          <div className="relative w-full sm:w-[500px] sm:mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              🧪 BfArM Demo API Suche
            </h3>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="PZN, Wirkstoff oder Name suchen..."
                value={demoQuery}
                onChange={(e) => setDemoQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsDemoLoading(true);
                    fetch('/api/bfarm/demo-search', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: demoQuery })
                    })
                    .then(res => res.json())
                    .then(data => {
                      setDemoResults(data.results || []);
                      setIsDemoLoading(false);
                    })
                    .catch(() => setIsDemoLoading(false));
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (!demoQuery.trim()) return;
                  setIsDemoLoading(true);
                  fetch('/api/bfarm/demo-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: demoQuery })
                  })
                  .then(res => res.json())
                  .then(data => {
                    setDemoResults(data.results || []);
                    setIsDemoLoading(false);
                  })
                  .catch(() => setIsDemoLoading(false));
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold transition-all"
              >
                Suchen
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {isDemoLoading ? (
                <div className="text-center text-sm text-slate-500 py-4">Suche läuft...</div>
              ) : demoResults.length > 0 ? (
                demoResults.map((m: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl">
                    <div className="text-sm font-bold text-slate-200">{m.name}</div>
                    <div className="text-xs text-slate-400 mt-1">Wirkstoff: {m.wirkstoff || 'unbekannt'}</div>
                    <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-mono">
                      <span>PZN: {m.pzn}</span>
                      <span>Form: {m.form || '-'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-slate-500 py-4">
                  {demoQuery ? 'Keine Ergebnisse gefunden.' : 'Bitte gib einen Suchbegriff ein.'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="mt-4 w-full py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Impressum & Datenschutz disclosure dialog */}
      <LegalNotice 
        isOpen={showLegalModal} 
        onClose={() => setShowLegalModal(false)}
        initialTab={legalInitialTab}
      />

      {privateMigrationVisible && isPrivateMigrationEnabled() && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">SC-MD-01 Private Erstübernahme</h3>
                <p className="text-xs text-slate-400">Nur für Entwicklerzugriff. Keine automatische Ausführung beim Start.</p>
              </div>
              <button
                type="button"
                onClick={() => setPrivateMigrationVisible(false)}
                className="rounded-xl border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                Schließen
              </button>
            </div>

            <PrivateMigrationPanel showToast={showToast} />
          </div>
        </div>
      )}
    </div>
  );
}
