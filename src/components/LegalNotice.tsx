import React, { useState } from 'react';
import { Shield, FileText, Scale, User, Mail, Globe, Check, AlertCircle, HelpCircle } from 'lucide-react';

interface LegalNoticeProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LegalNotice({ isOpen, onClose }: LegalNoticeProps) {
  const [activeSubTab, setActiveSubTab] = useState<'impressum' | 'datenschutz'>('impressum');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-2xl h-[85vh] flex flex-col bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl overflow-hidden font-sans">
        
        {/* Header Tabs */}
        <div className="p-5 pb-3 border-b border-slate-850 flex items-center justify-between bg-slate-950/20">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab('impressum')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'impressum'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Impressum
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('datenschutz')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'datenschutz'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Datenschutz
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-800 hover:border-slate-755 text-slate-400 hover:text-white transition cursor-pointer"
          >
            Schließen
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin text-slate-350 text-xs leading-relaxed">
          {activeSubTab === 'impressum' ? (
            <div className="space-y-6 animate-fade-in pl-1">
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-100 uppercase tracking-tight">Impressum</h3>
                <p className="text-[11px] text-slate-500 font-mono">Angaben gemäß § 5 TMG</p>
              </div>

              {/* Legal Representative Details */}
              <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-850 space-y-2.5">
                <div className="flex gap-2 items-center text-blue-400">
                  <User className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Diensteanbieter / Betreiber</span>
                </div>
                <div className="space-y-1 text-slate-300 font-mono">
                  <p className="font-bold">[Vorname] [Nachname] (Platzhalter)</p>
                  <p>[Straße und Hausnummer]</p>
                  <p>[PLZ] [Ort]</p>
                  <p>[Land]</p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-850 space-y-2.5">
                <div className="flex gap-2 items-center text-blue-400">
                  <Mail className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Kontaktmöglichkeiten</span>
                </div>
                <div className="space-y-1 text-slate-300 font-mono">
                  <p><strong>E-Mail:</strong> [E-Mail-Adresse] (Platzhalter)</p>
                  <p><strong>Telefon:</strong> [Telefonnummer, optional]</p>
                  <p><strong>Webseite:</strong> [URL der Webseite]</p>
                </div>
              </div>

              {/* Responsible Representative for Editorial Content */}
              <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-850 space-y-2.5">
                <div className="flex gap-2 items-center text-blue-400">
                  <Scale className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Verantwortlich nach § 18 MStV</span>
                </div>
                <div className="space-y-1 text-slate-300 font-mono">
                  <p className="font-bold">[Vorname] [Nachname] (Platzhalter)</p>
                  <p>[Zuständige Abteilung oder Adresse]</p>
                </div>
              </div>

              {/* Online Dispute Resolution Statement */}
              <div className="space-y-2.5 pt-2">
                <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Streitschlichtung</h4>
                <p className="text-slate-400 leading-normal text-[11px]">
                  Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">https://ec.europa.eu/consumers/odr</a>.
                  Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                </p>
              </div>

              {/* Liability and Copyright notes */}
              <div className="space-y-4 pt-2 border-t border-slate-850/60">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Haftung für Inhalte</h4>
                  <p className="text-slate-400 leading-normal text-[11px]">
                    Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Haftung für Links</h4>
                  <p className="text-slate-400 leading-normal text-[11px]">
                    Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in pl-1">
              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-100 uppercase tracking-tight">Datenschutzerklärung</h3>
                <p className="text-[11px] text-slate-500 font-mono">Stand: Juni 2026</p>
              </div>

              {/* General Notice */}
              <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-850 space-y-2 leading-relaxed">
                <div className="flex gap-2 items-center text-blue-400">
                  <Shield className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Sicherheit first (DSGVO-Konformität)</span>
                </div>
                <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
                  Deine Privatsphäre ist unser höchstes Anliegen. Die SymptoChron App ist standardmäßig so konzipiert, dass alle Eingaben (RLS-Verläufe, Stimmungswerterfassung, Medikamentenprotokolle) <strong>ausschließlich lokal in deinem Browser (LocalStorage)</strong> gesichert werden. Es findet keine unautorisierte Übertragung an externe Server statt, ausgenommen von dir manuell angeforderte AI-Untersuchungen, welche anonymisierte Datensätze nutzen.
                </p>
              </div>

              {/* Data Controller */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">1. Name und Anschrift des Verantwortlichen</h4>
                <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-850 font-mono text-slate-300">
                  <p className="font-bold">[Name/Firma - Verantwortlicher] (Platzhalter)</p>
                  <p>[Anschrift]</p>
                  <p>[E-Mail-Adresse]</p>
                </div>
              </div>

              {/* Data Category Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">2. Erhebung und Speicherung personenbezogener Daten</h4>
                
                <div className="space-y-2 mt-1">
                  <h5 className="font-bold text-slate-300 text-[11px]">a) Lokale Speicherung</h5>
                  <p className="text-slate-400 text-[11px] leading-normal">
                    Alle Logs wie RLS-Tagebuch Einträge, Medikamenteneinnahmen sowie dein Name werden geschützt im <strong>HTML5 LocalStorage</strong> deines Webbrowsers auf deinem Endgerät festgehalten. Du hast jederzeit die volle Kontrolle und kannst alle Daten über das Tab "Export &amp; Reset" unwiderruflich löschen.
                  </p>
                </div>

                <div className="space-y-2 mt-1">
                  <h5 className="font-bold text-slate-300 text-[11px]">b) Nutzung von KI/Gemini Features (Analysen &amp; Tages-Insights)</h5>
                  <p className="text-slate-400 text-[11px] leading-normal">
                    Wenn du die AI-Verlaufsanalyse oder den "Gesundheits-Tipp des Tages" anforderst, senden wir die dafür notwendigen, medizinischen Rohdaten (Stärken, Schlafzeiten und Einnahmestatus der Medikamente) an den sicheren Backend-Proxy, um mit der Google Gemini-API korrelierende RLS-Trends zu evaluieren. Diese Datenübermittlung erfolgt anonymisiert ohne Rückschluss auf Klarnamen oder personenbezogene Identifikationsmerkmale des Betroffenen.
                  </p>
                </div>
              </div>

              {/* User Rights */}
              <div className="space-y-3 pt-2 border-t border-slate-850/60">
                <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">3. Deine gesetzlichen Rechte (DSGVO)</h4>
                <p className="text-slate-400 text-[11px] leading-normal">
                  Als betroffene Person hast du das Recht auf:
                </p>
                <ul className="space-y-1.5 pl-4 text-slate-400 text-[11px] list-disc leading-normal">
                  <li><strong>Auskunft (Art. 15 DSGVO):</strong> Zu sehen, welche Daten verarbeitet werden.</li>
                  <li><strong>Berichtigung (Art. 16 DSGVO):</strong> Berichtigung fehlerhafter Datensätze.</li>
                  <li><strong>Löschung (Art. 17 DSGVO):</strong> Vollständiges Löschen deines Profils ("Recht auf Vergessenwerden").</li>
                  <li><strong>Einschränkung der Verarbeitung (Art. 18 DSGVO)</strong> sowie <strong>Datenübertragbarkeit (Art. 20 DSGVO)</strong>.</li>
                </ul>
                <p className="text-slate-450 text-[11.5px] font-medium">
                  Zur Geltendmachung deiner Rechte kannst du dich jederzeit an die oben angegebene E-Mail-Adresse des Verantwortlichen richten.
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Action / Disclaimer bar */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-850 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono tracking-tight">SymptoChron Applet Legal Pass</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/10 cursor-pointer active:scale-97 transition-all"
          >
            Verstanden
          </button>
        </div>

      </div>
    </div>
  );
}
