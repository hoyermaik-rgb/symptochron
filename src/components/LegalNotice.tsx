import React, { useState } from 'react';
import { Shield, FileText, User, Mail, Phone, Globe, AlertTriangle, ArrowLeft } from 'lucide-react';

interface LegalNoticeProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'impressum' | 'datenschutz';
}

const CONTACT = {
  name: 'Maik Hoyer',
  street: 'Hausmehringer Str. 2a',
  city: '85656 Buch a. Buchrain',
  country: 'Deutschland',
  phoneDisplay: '+49 178 1317629',
  phoneHref: '+491781317629',
  email: 'hoyer.maik@gmail.com',
  website: 'https://symptochron.family-hoyer.de',
};

export default function LegalNotice({ isOpen, onClose, initialTab = 'impressum' }: LegalNoticeProps) {
  const [activeSubTab, setActiveSubTab] = useState<'impressum' | 'datenschutz'>(initialTab);

  React.useEffect(() => {
    if (isOpen) setActiveSubTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-3xl h-[92dvh] sm:h-[88vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden font-sans">
        <div className="shrink-0 p-3 sm:p-5 pb-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/30">
          <div className="flex gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('impressum')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'impressum' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Impressum
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('datenschutz')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'datenschutz' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Shield className="h-3.5 w-3.5" /> Datenschutz
            </button>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 px-3 py-2 text-xs font-bold rounded-xl border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5" aria-label="Zurück zur App">
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto text-slate-300 text-xs leading-relaxed">
          {activeSubTab === 'impressum' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-100">Impressum</h3>
                <p className="text-[11px] text-slate-500">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>
              </div>

              <section className="p-4 bg-slate-950/35 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex gap-2 items-center text-blue-400"><User className="h-4 w-4" /><strong>Diensteanbieter und verantwortlich für den Inhalt</strong></div>
                <address className="not-italic font-mono text-slate-200 space-y-1">
                  <p className="font-bold">{CONTACT.name}</p>
                  <p>{CONTACT.street}</p>
                  <p>{CONTACT.city}</p>
                  <p>{CONTACT.country}</p>
                </address>
              </section>

              <section className="p-4 bg-slate-950/35 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex gap-2 items-center text-blue-400"><Mail className="h-4 w-4" /><strong>Kontakt</strong></div>
                <div className="space-y-2">
                  <p className="flex gap-2 items-center"><Mail className="h-3.5 w-3.5 text-slate-500" /><a className="text-blue-400 hover:underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p>
                  <p className="flex gap-2 items-center"><Phone className="h-3.5 w-3.5 text-slate-500" /><a className="text-blue-400 hover:underline" href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phoneDisplay}</a></p>
                  <p className="flex gap-2 items-center"><Globe className="h-3.5 w-3.5 text-slate-500" /><a className="text-blue-400 hover:underline break-all" href={CONTACT.website} target="_blank" rel="noopener noreferrer">{CONTACT.website}</a></p>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-extrabold text-slate-100">Verbraucherstreitbeilegung</h4>
                <p>Ich bin nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
              </section>

              <section className="space-y-2 border-t border-slate-800 pt-4">
                <h4 className="font-extrabold text-slate-100">Medizinischer Hinweis</h4>
                <p>SymptoChron dient der persönlichen Dokumentation und Vorbereitung von Arztgesprächen. Die App ersetzt keine ärztliche Diagnose, Beratung oder Behandlung. Bei akuten Beschwerden oder einem medizinischen Notfall ist unverzüglich professionelle Hilfe in Anspruch zu nehmen.</p>
              </section>

              <section className="space-y-2">
                <h4 className="font-extrabold text-slate-100">Haftung für Inhalte und Links</h4>
                <p>Die Inhalte wurden mit Sorgfalt erstellt. Eine Gewähr für Richtigkeit, Vollständigkeit und Aktualität wird nicht übernommen. Für Inhalte externer Seiten sind ausschließlich deren Betreiber verantwortlich. Rechtswidrige Inhalte werden nach Kenntnis im Rahmen der gesetzlichen Vorgaben entfernt.</p>
              </section>

              <section className="space-y-2">
                <h4 className="font-extrabold text-slate-100">Urheberrecht</h4>
                <p>Die durch den Betreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Eine Vervielfältigung, Bearbeitung oder Verbreitung außerhalb der gesetzlichen Schranken bedarf der vorherigen Zustimmung.</p>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-100">Datenschutzerklärung</h3>
                <p className="text-[11px] text-slate-500">Stand: 10. Juli 2026</p>
              </div>

              <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p>SymptoChron verarbeitet besonders schützenswerte Gesundheitsdaten. Medizinische Inhalte werden vor der Übertragung an den SymptoChron-Server im Browser verschlüsselt. Nutze ein sicheres Endgerät, eine persönliche PIN und regelmäßige verschlüsselte Backups.</p>
              </div>

              <section className="space-y-2">
                <h4 className="font-extrabold text-slate-100">1. Verantwortlicher</h4>
                <address className="not-italic p-4 bg-slate-950/35 rounded-2xl border border-slate-800 font-mono space-y-1">
                  <p className="font-bold">{CONTACT.name}</p><p>{CONTACT.street}</p><p>{CONTACT.city}</p><p>{CONTACT.country}</p>
                  <p><a className="text-blue-400 hover:underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p>
                  <p><a className="text-blue-400 hover:underline" href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phoneDisplay}</a></p>
                </address>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">2. Art und Zweck der Verarbeitung</h4>
                <p>Die App verarbeitet die von dir eingegebenen Profil-, Symptom-, Stimmungs-, Schlaf-, Blutdruck-, Medikamenten-, Termin-, Notiz- und Krisenplandaten, um das persönliche Gesundheitstagebuch, Auswertungen, Erinnerungen, Exporte und die Wiederherstellung deiner Daten bereitzustellen.</p>
                <p>Die Inhalte werden im Browser mit AES-256-GCM verschlüsselt. Eine verschlüsselte Kopie wird in der zentralen SymptoChron-SQLite-Datenbank auf dem App-Server gespeichert; IndexedDB dient als verschlüsselter Offline-Cache. Der Server erhält den verschlüsselten Inhalt sowie technische Metadaten wie Datensatzschlüssel, Verschlüsselungsversion und Änderungszeitpunkt. Die PIN und der entschlüsselte medizinische Inhalt sollen das Endgerät nicht verlassen.</p>
              </section>

              <section className="space-y-2">
                <h4 className="font-extrabold text-slate-100">3. Rechtsgrundlagen</h4>
                <p>Soweit eine Verarbeitung zur Bereitstellung der ausdrücklich angeforderten App-Funktionen erforderlich ist, erfolgt sie auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Soweit Gesundheitsdaten verarbeitet werden, ist zusätzlich deine ausdrückliche Einwilligung nach Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO maßgeblich. Eine Einwilligung kann mit Wirkung für die Zukunft widerrufen werden; die bis zum Widerruf erfolgte Verarbeitung bleibt rechtmäßig.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">4. Technisch notwendige Speicherung auf dem Endgerät</h4>
                <p>Die App verwendet LocalStorage und IndexedDB unter anderem für Verschlüsselungsschlüssel beziehungsweise Salt, PIN-Status, Einstellungen, Offline-Cache und Funktionszustände. Diese Zugriffe sind für den ausdrücklich gewünschten App-Dienst erforderlich. Es werden nach aktuellem App-Stand keine Werbe- oder Profiling-Cookies eingesetzt.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">5. Serverbetrieb und Protokolldaten</h4>
                <p>Beim Aufruf der Website werden technisch erforderliche Verbindungsdaten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, angeforderte Ressource, Statuscode, Referrer und Browserkennung. Dies dient dem sicheren und störungsfreien Betrieb sowie der Fehleranalyse. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse liegt in Betriebssicherheit, Missbrauchsschutz und Fehlerbehebung.</p>
                <p>Die konkrete Hosting-Infrastruktur und die Speicherfristen der Serverprotokolle müssen vor einer öffentlichen Veröffentlichung anhand des tatsächlich eingesetzten Hosters geprüft und hier ergänzt werden.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">6. Medikamentendatenbank</h4>
                <p>Suchbegriffe werden an den SymptoChron-Server übermittelt, um Treffer aus der lokalen SQLite-Referenzdatenbank bereitzustellen. Es werden keine Medikamentendatensätze durch KI erfunden. Suchanfragen können technisch in Serverprotokollen erscheinen und sollten keine frei formulierten personenbezogenen Angaben enthalten.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">7. Optionale KI-Funktionen mit Google Gemini</h4>
                <p>Trendanalysen und Tageshinweise sind freiwillig und werden nur nach gesonderter Aktivierung verwendet. Dabei werden ausgewählte Gesundheits- und Medikationsdaten über den SymptoChron-Server an die Google-Gemini-API übermittelt. Freitexte werden vorab durch einen Datenschutzfilter bereinigt; eine vollständige Anonymisierung kann technisch nicht garantiert werden. Rechtsgrundlage ist deine ausdrückliche Einwilligung nach Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO.</p>
                <p>Bei Nutzung können Daten an Google-Dienste und gegebenenfalls in Drittländer übermittelt werden. Die konkreten Vertrags-, Empfänger-, Speicher- und Drittlandangaben müssen anhand des tatsächlich verwendeten Google-Cloud-/Gemini-Kontos abschließend dokumentiert werden. Die Aktivierung kann im Bereich „Export &amp; Reset“ widerrufen werden; lokale KI-Caches werden dabei gelöscht.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">8. Spracheingabe</h4>
                <p>Die Spracheingabe nutzt die vom Browser bereitgestellte Web-Speech-Funktion. Abhängig von Browser und Betriebssystem kann Audio zur Erkennung an den Anbieter des Browsers oder Betriebssystems übertragen werden. Die Spracheingabe ist freiwillig. Sensible Inhalte sollten nur verwendet werden, wenn die Datenschutzbedingungen des eingesetzten Browsers bekannt und akzeptiert sind.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">9. Speicherdauer und Löschung</h4>
                <p>App-Daten werden gespeichert, bis du sie innerhalb der App löschst, die App-Daten zurücksetzt oder eine Löschung beim Verantwortlichen verlangst. Lokale Browserdaten können zusätzlich über die Browser- beziehungsweise Geräteeinstellungen entfernt werden. Sicherungskopien und Serverprotokolle können technisch bedingt zeitlich verzögert gelöscht werden; konkrete Fristen sind nach Festlegung des Backup- und Hostingkonzepts zu ergänzen.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">10. Empfänger</h4>
                <p>Empfänger können der technische Hostinganbieter und – nur bei aktivierter KI-Funktion – Google als Anbieter der Gemini-API sein. Eine darüber hinausgehende Weitergabe erfolgt nur, wenn sie gesetzlich erlaubt oder vorgeschrieben ist oder du eingewilligt hast.</p>
              </section>

              <section className="space-y-3">
                <h4 className="font-extrabold text-slate-100">11. Deine Rechte</h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Auskunft nach Art. 15 DSGVO</li><li>Berichtigung nach Art. 16 DSGVO</li><li>Löschung nach Art. 17 DSGVO</li><li>Einschränkung nach Art. 18 DSGVO</li><li>Datenübertragbarkeit nach Art. 20 DSGVO</li><li>Widerspruch nach Art. 21 DSGVO</li><li>Widerruf erteilter Einwilligungen nach Art. 7 Abs. 3 DSGVO</li>
                </ul>
                <p>Zur Ausübung deiner Rechte genügt eine Nachricht an <a className="text-blue-400 hover:underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde, insbesondere bei der für deinen Wohnort oder den Sitz des Verantwortlichen zuständigen Behörde.</p>
              </section>

              <section className="space-y-2 border-t border-slate-800 pt-4">
                <h4 className="font-extrabold text-slate-100">12. Keine automatisierte Entscheidung</h4>
                <p>Es findet keine ausschließlich automatisierte Entscheidung mit rechtlicher oder vergleichbar erheblicher Wirkung im Sinne von Art. 22 DSGVO statt. App-Auswertungen und KI-Hinweise sind keine medizinische Diagnose.</p>
              </section>
            </div>
          )}
        </div>

        <div className="shrink-0 p-3 sm:p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <span className="text-[10px] text-slate-500">SymptoChron · Rechtliche Hinweise</span>
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Zurück zur App</button>
        </div>
      </div>
    </div>
  );
}
