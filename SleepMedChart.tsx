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
  dailyAvgPain, 
  dailyAvgRls 
} from './utils';

// Subcomponents
import Onboarding from './components/Onboarding';
import PinLock from './components/PinLock';
import WelcomeTab from './components/WelcomeTab';
import DiaryTab from './components/DiaryTab';
import RLSTab from './components/RLSTab';
import MedsTab from './components/MedsTab';
import MoodTab from './components/MoodTab';
import StatsTab from './components/StatsTab';
import SosTab from './components/SosTab';
import ExportTab from './components/ExportTab';
import LegalNotice from './components/LegalNotice';

export default function App() {
  // Global States
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Blood Pressure logging States
  const [bpSystolic, setBpSystolic] = useState<number | ''>('');
  const [bpDiastolic, setBpDiastolic] = useState<number | ''>('');
  const [bpPulse, setBpPulse] = useState<number | ''>('');

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

    // Determine PIN
    const storedPin = localStorage.getItem('symptochron_pin');
    if (storedPin) {
      setPinCode(storedPin);
      setLocked(true);
    }

    // Core dataset recovery
    const loadedDiary = localStorage.getItem('symptochron_diary');
    const loadedMeds = localStorage.getItem('symptochron_meds');
    const loadedMood = localStorage.getItem('symptochron_mood');
    const loadedSurveys = localStorage.getItem('symptochron_rls_surveys');
    const loadedAppts = localStorage.getItem('symptochron_appointments');
    const loadedSos = localStorage.getItem('symptochron_sos_data');
    const loadedBp = localStorage.getItem('symptochron_blood_pressure');
    const loadedPrefs = localStorage.getItem('symptochron_ui_prefs');

    if (loadedDiary) setDiary(JSON.parse(loadedDiary));
    if (loadedMeds) setMeds(JSON.parse(loadedMeds));
    if (loadedMood) setMood(JSON.parse(loadedMood));
    if (loadedSurveys) setRlsSurveys(JSON.parse(loadedSurveys));
    if (loadedAppts) setAppointments(JSON.parse(loadedAppts));
    if (loadedSos) {
      const parsedSos = JSON.parse(loadedSos);
      setSosData(parsedSos);
      if (parsedSos.patientName) setPatientName(parsedSos.patientName);
    }
    if (loadedBp) setBloodPressure(JSON.parse(loadedBp));
    if (loadedPrefs) setUiPrefs(JSON.parse(loadedPrefs));

    // Handle initial mock seed matching
    const hasSeeded = localStorage.getItem('symptochron_seeded');
    if (!hasSeeded && !loadedDiary) {
      triggerSelfSeeding();
    }
  }, []);

  // Sync state helpers to root local storages
  const syncDiary = (updated: Record<string, DiaryEntry>) => {
    setDiary(updated);
    localStorage.setItem('symptochron_diary', JSON.stringify(updated));
  };

  const syncMeds = (updated: Medication[]) => {
    setMeds(updated);
    localStorage.setItem('symptochron_meds', JSON.stringify(updated));
  };

  const syncMood = (updated: Record<string, MoodEntry>) => {
    setMood(updated);
    localStorage.setItem('symptochron_mood', JSON.stringify(updated));
  };

  const syncSurveys = (updated: Record<string, RLSSurvey>) => {
    setRlsSurveys(updated);
    localStorage.setItem('symptochron_rls_surveys', JSON.stringify(updated));
  };

  const syncAppointments = (updated: Appointment[]) => {
    setAppointments(updated);
    localStorage.setItem('symptochron_appointments', JSON.stringify(updated));
  };

  const syncSosData = (updated: SOSData) => {
    setSosData(updated);
    if (updated.patientName) setPatientName(updated.patientName);
    localStorage.setItem('symptochron_sos_data', JSON.stringify(updated));
  };

  const syncBp = (updated: BloodPressureEntry[]) => {
    setBloodPressure(updated);
    localStorage.setItem('symptochron_blood_pressure', JSON.stringify(updated));
  };

  const syncPrefs = (updated: UiPrefs) => {
    setUiPrefs(updated);
    localStorage.setItem('symptochron_ui_prefs', JSON.stringify(updated));
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
        name: 'Gabapentin (Schwaches Opioid)',
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
    showToast('✨ Demo-Daten zur Visualisierung geladen!');
  };

  // Onboarding Complete Handler
  const handleCompleteOnboarding = (name: string, bday?: string) => {
    setOnboarded(true);
    localStorage.setItem('symptochron_onboarded', 'true');

    const updatedSos = { ...sosData, patientName: name, dob: bday || '' };
    syncSosData(updatedSos);
    showToast('🎉 Onboarding abgeschlossen!');
  };

  // Secure PIN change
  const handleConfigurePin = (newPin: string | null) => {
    if (newPin) {
      setPinCode(newPin);
      localStorage.setItem('symptochron_pin', newPin);
      showToast('🔒 PIN-Sperre erfolgreich eingerichtet.');
    } else {
      setPinCode(null);
      localStorage.removeItem('symptochron_pin');
      showToast('🔓 PIN-Schutz deaktiviert.');
    }
  };

  // Toggling medications inline from welcome Schnellbestätigung
  const handleToggleMedTaken = (slotId: string) => {
    const curToday = todayStr();
    const e = diary[curToday] || {};
    let isTakenList = e.medsTaken ? [...e.medsTaken] : [];

    if (isTakenList.includes(slotId)) {
      isTakenList = isTakenList.filter(id => id !== slotId);
    } else {
      isTakenList.push(slotId);
    }

    const updatedDiary = {
      ...diary,
      [curToday]: {
        ...e,
        medsTaken: isTakenList,
        updated: new Date().toISOString(),
      },
    };
    syncDiary(updatedDiary);
    showToast('✓ Medikamentenstatus aktualisiert!');
  };

  // Mark all medications scheduled today as taken
  const handleConfirmAllMedsToday = () => {
    const curToday = todayStr();
    const e = diary[curToday] || {};
    const slots = ['morning', 'noon', 'evening', 'night'];
    
    const allSlotIds: string[] = [];
    meds.forEach(m => {
      slots.forEach(s => {
        if (m.schedule[s] > 0) {
          allSlotIds.push(`${m.id}_${s}`);
        }
      });
      // Bedarfsmedikation: do not pre-apply as taken unless regular dose
    });

    const updatedDiary = {
      ...diary,
      [curToday]: {
        ...e,
        medsTaken: allSlotIds,
        updated: new Date().toISOString(),
      },
    };
    syncDiary(updatedDiary);
    showToast('✅ Alle geplanten Einnahmen bestätigt!');
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
    showToast('🗑️ Alle lokalen App-Daten vollständig gelöscht.');
  };

  const handleRestoreBackup = (data: any) => {
    if (data.diary) syncDiary(data.diary);
    if (data.meds) syncMeds(data.meds);
    if (data.mood) syncMood(data.mood);
    if (data.rlsSurveys) syncSurveys(data.rlsSurveys);
    if (data.sosData) syncSosData(data.sosData);
  };

  // Toggle layout font sizes custom class on body or main frame
  const fontStyleClass = uiPrefs.fontScale === 'large' ? 'text-[108%]' : '';

  // Intercept if onboarding is active
  if (!onboarded) {
    return (
      <Onboarding 
        onComplete={handleCompleteOnboarding} 
        onSkip={() => handleCompleteOnboarding('Patient', '')} 
      />
    );
  }

  // Intercept locked state
  if (locked && pinCode) {
    return (
      <PinLock
        mode="lock"
        checkPin={pinCode}
        onSuccess={() => {
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
      <header className={`sticky top-0 z-80 px-6 py-5 backdrop-blur-md border-b flex items-center justify-between transition-colors ${
        theme === 'dark' ? 'bg-[#0A0A0A]/85 border-[#1F1F1F]' : 'bg-white/70 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-bold text-lg shadow-sm font-serif select-none">S</div>
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
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.985, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -15 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'welcome' && (
              <WelcomeTab
                diary={diary}
                meds={meds}
                mood={mood}
                patientName={patientName}
                onSwitchTab={setActiveTab}
                onToggleMed={handleToggleMedTaken}
                onConfirmAllMeds={handleConfirmAllMedsToday}
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
                onRestoreBackup={handleRestoreBackup}
                onClearAllData={handleClearAllData}
                showToast={showToast}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation Tab rails */}
      <nav className={`fixed bottom-0 left-0 right-0 z-90 px-2 py-2 border-t backdrop-blur-xl flex justify-around transition-colors items-center h-[60px] ${
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

                {/* Seeding diagnostic trigger tools */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Datentransfer &amp; Demos</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSelfSeeding();
                      setShowSettingsDrawer(false);
                    }}
                    className="w-full text-left p-3 border border-slate-800 bg-slate-950/30 rounded-xl text-[10px] text-slate-400 font-semibold flex items-center justify-between hover:text-white hover:border-slate-700 transition"
                  >
                    <span>Lade 10 Tage RLS-Demo-Daten</span>
                    <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="text-[9px] text-slate-600 font-mono text-center pt-8 space-y-2 flex flex-col items-center">
                <span>SymptoChron v1.0.0 (Offline-Pass)</span>
                <div className="flex gap-2.5 text-slate-550 font-sans font-bold uppercase text-[8px] justify-center tracking-wider">
                  <button 
                    type="button" 
                    onClick={() => { setShowSettingsDrawer(false); setShowLegalModal(true); }} 
                    className="hover:text-blue-400 transition cursor-pointer"
                  >
                    Impressum
                  </button>
                  <span>·</span>
                  <button 
                    type="button" 
                    onClick={() => { setShowSettingsDrawer(false); setShowLegalModal(true); }} 
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

      {/* Impressum & Datenschutz disclosure dialog */}
      <LegalNotice 
        isOpen={showLegalModal} 
        onClose={() => setShowLegalModal(false)} 
      />
    </div>
  );
}
