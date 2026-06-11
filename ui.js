// ── UI-Extras: Hell/Dunkel-Modus + Onboarding ───────────

// ── Theme ───────────────────────────────────────────────
const THEME_KEY = 'symptochron_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.textContent = theme === 'light' ? '🌙' : '☀️';
    btn.title = theme === 'light' ? 'Zum dunklen Modus wechseln' : 'Zum hellen Modus wechseln';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f6fc' : '#0a1628');
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  if (typeof showToast === 'function') {
    showToast(next === 'light' ? '☀️ Heller Modus aktiviert' : '🌙 Dunkler Modus aktiviert');
  }
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
}

// ── Onboarding (erster Start) ───────────────────────────
const ONBOARDING_KEY = 'symptochron_onboarded';

function shouldShowOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY) === '1') return false;
  // Bestandsnutzer mit Daten nicht stören
  try {
    const hasDiary = Object.keys(JSON.parse(localStorage.getItem('painDiary') || '{}')).length > 0;
    const hasMeds = (JSON.parse(localStorage.getItem('painDiaryMeds') || '[]')).length > 0;
    const hasName = !!(localStorage.getItem('symptochron_patient_name') || '').trim();
    if (hasDiary || hasMeds || hasName) {
      localStorage.setItem(ONBOARDING_KEY, '1');
      return false;
    }
  } catch (e) { /* ignore */ }
  return true;
}

function openOnboarding() {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  onboardingNext(1);
  modal.classList.add('open');
}

function onboardingNext(step) {
  document.querySelectorAll('.ob-step').forEach(el => {
    el.style.display = el.dataset.obStep === String(step) ? 'block' : 'none';
  });
  document.querySelectorAll('.ob-dot').forEach(el => {
    el.classList.toggle('active', el.dataset.obDot === String(step));
  });
}

function saveOnboardingPatient() {
  const name = (document.getElementById('obName')?.value || '').trim();
  const bday = document.getElementById('obBday')?.value || '';
  if (name) localStorage.setItem('symptochron_patient_name', name);
  if (bday) localStorage.setItem('symptochron_patient_bday', bday);
  if (typeof loadPatientData === 'function') loadPatientData();
  onboardingNext(3);
}

function skipOnboarding() {
  finishOnboarding();
}

function finishOnboarding(target) {
  localStorage.setItem(ONBOARDING_KEY, '1');
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.remove('open');
  if (typeof renderWelcomeScreen === 'function') renderWelcomeScreen();
  if (target === 'meds') {
    switchTab('meds');
    if (typeof openMedModal === 'function') setTimeout(() => openMedModal(), 250);
  } else if (target === 'scan') {
    switchTab('meds');
    if (typeof startQRScanner === 'function') setTimeout(() => startQRScanner(), 350);
  } else {
    if (typeof showToast === 'function') showToast('✅ Fertig eingerichtet – viel Erfolg!');
  }
}

// ── PIN-Schutz (optional) ───────────────────────────────
const PIN_KEY = 'symptochron_pin_hash';

async function hashPin(pin) {
  try {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode('symptochron:' + pin);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* fallback below */ }
  // Einfacher Fallback-Hash, falls WebCrypto nicht verfügbar (z. B. http)
  let h = 5381;
  const s = 'symptochron:' + pin;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'djb2:' + h.toString(16);
}

function isPinEnabled() {
  return !!localStorage.getItem(PIN_KEY);
}

async function setupPin() {
  const pin1 = prompt('Neue PIN festlegen (4–8 Ziffern):');
  if (pin1 === null) return;
  if (!/^\d{4,8}$/.test(pin1)) {
    if (typeof showToast === 'function') showToast('⚠️ Bitte 4–8 Ziffern verwenden');
    return;
  }
  const pin2 = prompt('PIN zur Bestätigung erneut eingeben:');
  if (pin2 !== pin1) {
    if (typeof showToast === 'function') showToast('❌ PINs stimmen nicht überein');
    return;
  }
  localStorage.setItem(PIN_KEY, await hashPin(pin1));
  if (typeof showToast === 'function') showToast('🔒 PIN-Schutz aktiviert');
  if (typeof renderAppMenu === 'function') renderAppMenu();
}

async function disablePin() {
  const pin = prompt('Zum Deaktivieren aktuelle PIN eingeben:');
  if (pin === null) return;
  if (await hashPin(pin) !== localStorage.getItem(PIN_KEY)) {
    if (typeof showToast === 'function') showToast('❌ Falsche PIN');
    return;
  }
  localStorage.removeItem(PIN_KEY);
  if (typeof showToast === 'function') showToast('🔓 PIN-Schutz deaktiviert');
  if (typeof renderAppMenu === 'function') renderAppMenu();
}

function togglePinProtection() {
  if (isPinEnabled()) disablePin();
  else setupPin();
}

function showLockScreen() {
  if (document.getElementById('appLockScreen')) return;
  const lock = document.createElement('div');
  lock.id = 'appLockScreen';
  lock.className = 'app-lock';
  lock.innerHTML = `
    <div class="app-lock-box">
      <div class="app-lock-icon">🔒</div>
      <div class="app-lock-title">SymptoChron ist gesperrt</div>
      <p class="app-lock-sub">Bitte PIN eingeben</p>
      <input class="form-input app-lock-input" id="appLockInput" type="password" inputmode="numeric" maxlength="8" placeholder="••••" autocomplete="off" />
      <div class="app-lock-error" id="appLockError"></div>
      <button class="btn-primary" type="button" onclick="tryUnlock()">Entsperren</button>
    </div>`;
  document.body.appendChild(lock);
  const input = document.getElementById('appLockInput');
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    setTimeout(() => input.focus(), 150);
  }
}

async function tryUnlock() {
  const input = document.getElementById('appLockInput');
  const err = document.getElementById('appLockError');
  if (!input) return;
  if (await hashPin(input.value) === localStorage.getItem(PIN_KEY)) {
    const lock = document.getElementById('appLockScreen');
    if (lock) lock.remove();
  } else {
    if (err) err.textContent = '❌ Falsche PIN – bitte erneut versuchen';
    input.value = '';
    input.focus();
  }
}

// ── Init ────────────────────────────────────────────────
initTheme();
if (isPinEnabled()) {
  if (document.body) showLockScreen();
  else document.addEventListener('DOMContentLoaded', showLockScreen, { once: true });
}
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (shouldShowOnboarding() && !isPinEnabled()) {
    setTimeout(openOnboarding, 400);
  }
});
