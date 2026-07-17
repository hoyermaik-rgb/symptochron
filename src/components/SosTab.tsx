import React, { useState } from 'react';
import {
  AlertTriangle,
  User,
  Phone,
  HelpCircle,
  Save,
  ShieldAlert,
  Smartphone,
  Activity,
  Info,
  Award,
  Heart,
  Plus,
  Trash2
} from 'lucide-react';
import { SOSData, IceContact } from '../types';
import { jsPDF } from 'jspdf';

interface SosTabProps {
  sosData: SOSData;
  onSaveSosData: (data: SOSData) => void;
  showToast: (msg: string) => void;
}

export default function SosTab({ sosData, onSaveSosData, showToast }: SosTabProps) {
  // Personal profile local states
  const [patientName, setPatientName] = useState(sosData.patientName || '');
  const [dob, setDob] = useState(sosData.dob || '');
  const [bloodGroup, setBloodGroup] = useState(sosData.bloodType || '');
  const [allergies, setAllergies] = useState(sosData.allergies || '');
  const [diagnoses, setDiagnoses] = useState(sosData.diagnoses || '');
  const [emergencyNotes, setEmergencyNotes] = useState(sosData.emergencyNotes || '');
  const [dsgvoConsent, setDsgvoConsent] = useState(false);

  const generateQrText = () => {
    let text = `SOS NOTFALLDATEN - SYMPTOCHRON\n`;
    text += `Name: ${patientName || 'Nicht angegeben'}\n`;
    text += `Geb.: ${dob || 'Nicht angegeben'}\n`;
    text += `Blutgruppe: ${bloodGroup || 'Nicht angegeben'}\n`;
    text += `Allergien: ${allergies || 'Keine angegeben'}\n`;
    text += `Diagnosen: ${diagnoses || 'Keine angegeben'}\n`;
    if (iceContacts && iceContacts.length > 0) {
      text += `Notfallkontakte (ICE):\n`;
      iceContacts.forEach(contact => {
        text += `- ${contact.name} (${contact.relationship}): ${contact.phone}\n`;
      });
    }
    return text;
  };

  const getBase64ImageFromUrl = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string));
      reader.addEventListener('error', () => reject(new Error('Failed to load image')));
      reader.readAsDataURL(blob);
    });
  };

  const handleExportEmergencyCardPdf = async () => {
    showToast('⏳ SOS-Notfallausweis wird generiert...');
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });

      const x = 20;
      const y1 = 20;
      const y2 = 79;
      const w = 85;
      const h = 54;

      // --- FRONT SIDE ---
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.3);
      doc.rect(x, y1, w, h);

      doc.setFillColor(190, 24, 74);
      doc.rect(x + 0.2, y1 + 0.2, w - 0.4, 10, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('SOS NOTFALLKARTE', x + 5, y1 + 6.5);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text(`Name:`, x + 5, y1 + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(patientName || 'Nicht angegeben', x + 16, y1 + 18);

      doc.setFont('helvetica', 'bold');
      doc.text(`Geb.:`, x + 5, y1 + 24);
      doc.setFont('helvetica', 'normal');
      doc.text(dob || 'Nicht angegeben', x + 16, y1 + 24);

      doc.setFont('helvetica', 'bold');
      doc.text(`Blut:`, x + 5, y1 + 30);
      doc.setFont('helvetica', 'normal');
      doc.text(bloodGroup || 'Nicht angegeben', x + 16, y1 + 30);

      const qrText = generateQrText();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrText)}`;
      try {
        const qrBase64 = await getBase64ImageFromUrl(qrUrl);
        doc.addImage(qrBase64, 'PNG', x + w - 34, y1 + 14, 30, 30);
      } catch (e) {
        console.error("QR Code image loading failed", e);
        doc.setFontSize(6);
        doc.text("QR-Code laden fehlgeschlagen", x + w - 34, y1 + 25);
      }

      doc.setFillColor(30, 41, 59);
      doc.rect(x + 0.2, y1 + h - 6.2, w - 0.4, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text('SymptoChron App', x + 5, y1 + h - 2.2);

      // --- BACK SIDE ---
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.3);
      doc.rect(x, y2, w, h);

      doc.setFillColor(30, 41, 59);
      doc.rect(x + 0.2, y2 + 0.2, w - 0.4, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('MEDIZINISCHE DETAILS & ICE', x + 5, y2 + 5.5);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Allergien / Risiken:', x + 5, y2 + 14);
      doc.setFont('helvetica', 'normal');
      const allergyTxt = allergies || 'Keine bekannt';
      doc.text(doc.splitTextToSize(allergyTxt, w - 10), x + 5, y2 + 17.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Diagnosen (Chronisch):', x + 5, y2 + 25);
      doc.setFont('helvetica', 'normal');
      const diagTxt = diagnoses || 'Keine angegeben';
      doc.text(doc.splitTextToSize(diagTxt, w - 10), x + 5, y2 + 28.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Im Notfall (ICE Contacts):', x + 5, y2 + 37);
      doc.setFont('helvetica', 'normal');
      let iceTxt = '';
      if (iceContacts.length > 0) {
        iceContacts.slice(0, 2).forEach((c, idx) => {
          iceTxt += `${idx + 1}. ${c.name} (${c.relationship}): ${c.phone}\n`;
        });
      } else {
        iceTxt = 'Keine Notfallkontakte hinterlegt.';
      }
      doc.text(iceTxt, x + 5, y2 + 40.5);

      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(x, y1 + h + 2.5, x + w, y1 + h + 2.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('<- Hier ausschneiden und entlang der gestrichelten Linie falten ->', x, y2 + h + 5);

      doc.save(`SOS_Notfallausweis_${patientName ? patientName.replace(/\s+/g, '_') : 'Patient'}.pdf`);
      showToast('📄 SOS-Notfallausweis PDF generiert!');
    } catch (err) {
      console.error(err);
      showToast('❌ Fehler bei der PDF-Generierung.');
    }
  };

  // ICE Contacts list
  const [iceContacts, setIceContacts] = useState<IceContact[]>(sosData.iceContacts || []);
  const [newIceName, setNewIceName] = useState('');
  const [newIcePhone, setNewIcePhone] = useState('');
  const [newIceRel, setNewIceRel] = useState('');

  // Local simulated alarm trigger states
  const [alarmTriggered, setAlarmTriggered] = useState(false);

  const handleSaveProfile = () => {
    onSaveSosData({
      ...sosData,
      patientName: patientName.trim(),
      dob: dob.trim(),
      bloodType: bloodGroup,
      allergies: allergies.trim(),
      diagnoses: diagnoses.trim(),
      emergencyNotes: emergencyNotes.trim(),
      iceContacts,
    });
    showToast('💾 Medizinischer SOS-Pass geladen.');
  };

  const handleAddIce = () => {
    if (!newIceName.trim() || !newIcePhone.trim()) {
      showToast('⚠️ Bitte Namen und Telefonnummer eingeben.');
      return;
    }

    const item: IceContact = {
      id: 'ice_' + Date.now().toString(36),
      name: newIceName.trim(),
      phone: newIcePhone.trim(),
      relationship: newIceRel.trim() || 'Verwandte/r',
    };

    const updated = [...iceContacts, item];
    setIceContacts(updated);

    onSaveSosData({
      ...sosData,
      iceContacts: updated,
    });

    setNewIceName('');
    setNewIcePhone('');
    setNewIceRel('');
    showToast('✅ ICE-Notfallkontakt erfasst.');
  };

  const handleDeleteIce = (id: string) => {
    const updated = iceContacts.filter(c => c.id !== id);
    setIceContacts(updated);
    onSaveSosData({
      ...sosData,
      iceContacts: updated,
    });
    showToast('🗑️ ICE-Kontakt gelöscht.');
  };

  const handleTriggerWarningAlarm = () => {
    setAlarmTriggered(prev => !prev);
    if (!alarmTriggered) {
      showToast('🚨 SOS-Notfallalarm ausgelöst (simuliert)!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual red red red critical panic alert widget */}
      <div className={`p-6 border rounded-3xl transition-all duration-300 ${
        alarmTriggered
          ? 'bg-rose-600/25 border-rose-500 animate-pulse text-rose-100'
          : 'bg-slate-900/40 border-slate-800 text-slate-300'
      }`}>
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between text-center sm:text-left">
          <div className="space-y-2">
            <h4 className="text-base font-bold text-slate-100 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2.5">
              <ShieldAlert className={`h-6 w-6 shrink-0 ${alarmTriggered ? 'text-rose-500' : 'text-slate-500'}`} />
              <span>Medizinischer SOS-Pass &amp; Notruf</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
              Bei akuten gesundheitlichen Krisen oder Unfällen hilft dieser Bereich Ersthelfern, deine ärztlichen Diagnosen, Medikationspläne und Notfallkontakte in Sekundenschnelle einzusehen.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTriggerWarningAlarm}
            className={`w-28 h-28 shrink-0 flex flex-col items-center justify-center rounded-full text-xs font-black uppercase text-white transition-all transform active:scale-95 cursor-pointer select-none ${
              alarmTriggered
                ? 'bg-rose-500 border border-rose-455 shadow-2xl shadow-rose-500/50'
                : 'bg-rose-600/90 hover:bg-rose-600 border border-rose-650 shadow-lg shadow-rose-600/20'
            }`}
          >
            <span className="text-3xl mb-1">{alarmTriggered ? '🚨' : '🔴'}</span>
            <span>{alarmTriggered ? 'STOP' : 'SOS'}</span>
          </button>
        </div>
      </div>

      {/* SOS QR-Code Generator Card */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="bg-white p-3.5 rounded-2xl shrink-0 shadow-lg shadow-black/30">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generateQrText())}`}
            alt="Notfall QR-Code"
            className="w-32 h-32"
          />
        </div>
        <div className="space-y-2.5">
          <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">SOS Notfall-QR-Code</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Dieser Code enthält deine lebenswichtigen SOS-Angaben in kompakter Form. Ersthelfer oder Ärzte können ihn mit jedem Smartphone scannen, um im Notfall sofort deine Diagnosen, Allergien und ICE-Kontakte abzurufen.
          </p>
          <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-medium">
            💡 <strong>Tipp für maximale Sicherheit:</strong> Mache einen Screenshot dieses QR-Codes und richte ihn als Hintergrundbild für deinen Sperrbildschirm (Lockscreen) ein. So ist er auch bei gesperrtem Handy sofort lesbar.
          </div>
          <button
            type="button"
            onClick={handleExportEmergencyCardPdf}
            className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
          >
            🪪 SOS-Notfallausweis drucken (PDF)
          </button>
        </div>
      </div>

      {/* Emergency notes profile form */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <User className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">SOS-Patientendaten</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Ärztlicher Befundbogen für Notärzte</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Patientenname</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="z.B. Erika Mustermann"
              className="w-full py-3 px-4 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Geburtsdatum</label>
            <input
              type="text"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="z.B. 12.04.1978"
              className="w-full py-3 px-4 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5 flex flex-col">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Blutgruppe</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="py-3.5 px-3 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-300"
            >
              <option value="">–</option>
              <option value="A+">A pos. (A+)</option>
              <option value="A-">A neg. (A-)</option>
              <option value="B+">B pos. (B+)</option>
              <option value="B-">B neg. (B-)</option>
              <option value="AB+">AB pos. (AB+)</option>
              <option value="AB-">AB neg. (AB-)</option>
              <option value="0+">0 pos. (0+)</option>
              <option value="0-">0 neg. (0-)</option>
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Allergien / Risiken</label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="z.B. Penicillin-Allergie, Kontrastmittelunverträglichkeit"
              className="w-full py-3 px-4 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Erhaltene Diagnosen (Chronische Krankheiten)</label>
            <input
              type="text"
              value={diagnoses}
              onChange={(e) => setDiagnoses(e.target.value)}
              placeholder="z.B. Restless-Legs-Syndrom, Fibromyalgie, rezidivierende Depression"
              className="w-full py-3 px-4 bg-slate-955 border border-slate-850 rounded-xl text-xs text-slate-200"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Notfallmedikation &amp; Anmerkungen</label>
            <textarea
              value={emergencyNotes}
              onChange={(e) => setEmergencyNotes(e.target.value)}
              placeholder="z.B. im Notfall Bedarfsmedikation Tramadol 50mg verabreichen..."
              className="notes-area min-h-[70px] text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 pb-1">
          <input
            type="checkbox"
            id="dsgvo-consent"
            checked={dsgvoConsent}
            onChange={(e) => setDsgvoConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-950"
          />
          <label htmlFor="dsgvo-consent" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
            Ich willige ausdrücklich ein, dass diese hochsensiblen Notfalldaten lokal in diesem Browser gespeichert und unverschlüsselt für den Notfallausweis verarbeitet werden dürfen (DSGVO).
          </label>
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={!dsgvoConsent}
          className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md ${
            dsgvoConsent
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/10 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          Notfallpass aktualisieren
        </button>
      </div>

      {/* ICE contacts configuration */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/25 rounded-2xl">
            <Phone className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">In Case of Emergency (ICE)</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Kontaktdaten deiner Angehörigen oder Betreuer im Notfall</p>
          </div>
        </div>

        {/* Existing ICE table/list */}
        {iceContacts.length > 0 && (
          <div className="space-y-2">
            {iceContacts.map((c) => (
              <div key={c.id} className="flex justify-between items-center p-4 bg-slate-950/45 border border-slate-850 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-slate-200">{c.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                    {c.relationship} · {c.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteIce(c.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-455 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add ICE form */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</label>
            <input
              type="text"
              value={newIceName}
              onChange={(e) => setNewIceName(e.target.value)}
              placeholder="z.B. Karin Mustermann"
              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefon</label>
            <input
              type="text"
              value={newIcePhone}
              onChange={(e) => setNewIcePhone(e.target.value)}
              placeholder="z.B. +49 171 123456"
              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Beziehung</label>
            <input
              type="text"
              value={newIceRel}
              onChange={(e) => setNewIceRel(e.target.value)}
              placeholder="z.B. Lebenspartner, Ehefrau"
              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={handleAddIce}
            className="flex items-center justify-center gap-1.5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" /> Speichern
          </button>
        </div>
      </div>

      {/* Progressive Web App (PWA) installation manual */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex gap-3">
          <div className="p-2.5 bg-blue-600/10 border border-blue-500/25 rounded-2xl">
            <Smartphone className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-widest">SymptoChron auf dem Smartphone</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Erklärt das Speichern auf dem Home-Bildschirm wie eine native App</p>
          </div>
        </div>

        <div className="space-y-3.5 pt-1.5 text-xs text-slate-350 leading-relaxed pl-1">
          <p>
            SymptoChron wurde nach modernen Offline-First-Leitpfaden entworfen und lässt sich wie eine vollwertige App auf deinem Smartphone installieren:
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/25 rounded-full">
                1
              </span>
              <div>
                <strong>Für iOS (Aple Safari):</strong>
                <br />
                Tippe unten in der Symbolleiste deines Browsers auf das Teilen-Symbol (Viereck mit Pfeil nach oben) und wähle anschließend <strong>&quot;Zum Home-Bildschirm&quot;</strong>.
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/25 rounded-full">
                2
              </span>
              <div>
                <strong>Für Android (Google Chrome):</strong>
                <br />
                Tippe oben rechts auf die drei Punkte und wähle im Menü den Punkt <strong>&quot;App installieren&quot;</strong> oder <strong>&quot;Zum Startbildschirm hinzufügen&quot;</strong> aus.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
