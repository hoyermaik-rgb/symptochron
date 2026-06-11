// ══════════════════════════════════════════════
//  SOS & DATEN – Notfall- und Identitätsmodul
// ══════════════════════════════════════════════

const SOS_STORAGE_KEY = 'symptochron_sos_data';

function getSOSData() {
  try {
    return JSON.parse(localStorage.getItem(SOS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

window.getSOSData = getSOSData;

function saveSOSData() {
  const data = {
    personal: {
      name: document.getElementById('sosName')?.value.trim() || '',
      birthdate: document.getElementById('sosBirthdate')?.value || '',
      address: document.getElementById('sosAddress')?.value.trim() || '',
      profile_photo: getSOSData().personal?.profile_photo || null
    },
    medical: {
      blood_group: document.getElementById('sosBloodGroup')?.value || '',
      allergies: document.getElementById('sosAllergies')?.value.trim() || '',
      chronic_conditions: document.getElementById('sosChronic')?.value.trim() || '',
      medication_plan_file: getSOSData().medical?.medication_plan_file || null
    },
    documents: getSOSData().documents || [],
    emergency_contacts: getSOSData().emergency_contacts || [],
    crisis_plan: getSOSData().crisis_plan || {},
    metadata: {
      last_updated: new Date().toISOString()
    }
  };

  localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
}

function loadSOSData() {
  const data = getSOSData();

  // Persönliche Daten
  if (document.getElementById('sosName')) document.getElementById('sosName').value = data.personal?.name || '';
  if (document.getElementById('sosBirthdate')) document.getElementById('sosBirthdate').value = data.personal?.birthdate || '';
  if (document.getElementById('sosAddress')) document.getElementById('sosAddress').value = data.personal?.address || '';

  // Medizinische Daten
  if (document.getElementById('sosBloodGroup')) document.getElementById('sosBloodGroup').value = data.medical?.blood_group || '';
  if (document.getElementById('sosAllergies')) document.getElementById('sosAllergies').value = data.medical?.allergies || '';
  if (document.getElementById('sosChronic')) document.getElementById('sosChronic').value = data.medical?.chronic_conditions || '';

  // Foto-Vorschau
  if (data.personal?.profile_photo) {
    renderPhotoPreview(data.personal.profile_photo);
  }

  // Dokumente rendern
  renderDocumentList();

  // Notfallkontakte rendern
  renderEmergencyContacts();

  // Krisenplan (falls vorhanden)
  if (data.crisis_plan) {
    // Hier könnte man noch Felder für Krisenplan hinzufügen
  }
}

function handleSOSPhotoUpload(input) {
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = getSOSData();
    if (!data.personal) data.personal = {};
    data.personal.profile_photo = e.target.result;
    localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
    renderPhotoPreview(e.target.result);
  };

  reader.readAsDataURL(file);
}

function renderPhotoPreview(base64) {
  const preview = document.getElementById('sosPhotoPreview');
  if (!preview) return;

  preview.innerHTML = `
    <img src="${base64}" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid var(--border)">
    <button class="btn-secondary" style="margin-top:8px" onclick="removeSOSPhoto()">Foto entfernen</button>
  `;
}

function removeSOSPhoto() {
  const data = getSOSData();
  if (data.personal) delete data.personal.profile_photo;
  localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
  const preview = document.getElementById('sosPhotoPreview');
  if (preview) preview.innerHTML = '';
}

function handleSOSDocumentUpload(input) {
  if (!input.files || input.files.length === 0) return;

  const data = getSOSData();
  if (!data.documents) data.documents = [];

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      data.documents.push({
        id: 'doc_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        file: e.target.result,
        uploaded_at: new Date().toISOString()
      });
      localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
      renderDocumentList();
    };
    reader.readAsDataURL(file);
  });

  input.value = '';
}

function renderDocumentList() {
  const container = document.getElementById('sosDocumentList');
  if (!container) return;

  const data = getSOSData();
  const docs = data.documents || [];

  if (docs.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-3)">Noch keine Dokumente hochgeladen.</p>';
    return;
  }

  container.innerHTML = docs.map(doc => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">${doc.type === 'pdf' ? '📄' : '🖼️'}</span>
        <span style="font-size:13px">${doc.name}</span>
      </div>
      <button class="btn-danger" style="padding:4px 10px;font-size:11px" onclick="deleteSOSDocument('${doc.id}')">Löschen</button>
    </div>
  `).join('');
}

function deleteSOSDocument(id) {
  const data = getSOSData();
  data.documents = (data.documents || []).filter(d => d.id !== id);
  localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
  renderDocumentList();
}

function renderEmergencyContacts() {
  const container = document.getElementById('sosEmergencyContacts');
  if (!container) return;

  const data = getSOSData();
  const contacts = data.emergency_contacts || [];

  if (contacts.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-3)">Noch keine Notfallkontakte hinterlegt.</p>';
    return;
  }

  container.innerHTML = contacts.map((c, idx) => `
    <div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${c.name}</div>
          <div style="font-size:13px;color:var(--text-2)">${c.relationship || ''}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" style="padding:6px 12px" onclick="callEmergencyContact('${c.phone}')">📞 Anrufen</button>
          <button class="btn-danger" style="padding:6px 10px" onclick="deleteEmergencyContact(${idx})">✕</button>
        </div>
      </div>
      <div style="margin-top:6px;font-family:var(--mono);font-size:14px">${c.phone}</div>
    </div>
  `).join('');
}

function addEmergencyContact() {
  const name = prompt('Name des Kontakts:');
  if (!name) return;

  const phone = prompt('Telefonnummer:');
  if (!phone) return;

  const relationship = prompt('Beziehung (z. B. Ehepartner, Tochter):') || '';

  const data = getSOSData();
  if (!data.emergency_contacts) data.emergency_contacts = [];

  data.emergency_contacts.push({
    id: 'ice_' + Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    relationship: relationship.trim()
  });

  localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
  renderEmergencyContacts();
}

function deleteEmergencyContact(index) {
  const data = getSOSData();
  data.emergency_contacts.splice(index, 1);
  localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(data));
  renderEmergencyContacts();
}

function callEmergencyContact(phone) {
  if (confirm(`Möchten Sie ${phone} anrufen?`)) {
    window.location.href = `tel:${phone}`;
  }
}

function triggerSOS() {
  const data = getSOSData();
  const contacts = data.emergency_contacts || [];

  if (contacts.length === 0) {
    if (confirm('Keine ICE-Kontakte hinterlegt. Möchten Sie trotzdem den Notruf 112 wählen?')) {
      window.location.href = 'tel:112';
    }
    return;
  }

  const message = `Notfall! Bitte helfen Sie mir.\n\nName: ${data.personal?.name || 'Unbekannt'}\nAdresse: ${data.personal?.address || 'Nicht angegeben'}`;

  if (confirm('Möchten Sie den Notruf 112 wählen oder eine SMS an Ihre ICE-Kontakte senden?')) {
    // Primär Notruf
    window.location.href = 'tel:112';
  } else {
    // SMS an alle Kontakte (funktioniert nur auf manchen Geräten)
    contacts.forEach(c => {
      const smsLink = `sms:${c.phone}?body=${encodeURIComponent(message)}`;
      window.open(smsLink, '_blank');
    });
  }
}

// ── Home-Screen Install Prompt ───────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function promptInstallSOS() {
  // Versuche zuerst den Deep-Link mit Hash zu nutzen
  const url = new URL(window.location.href);
  url.hash = '#sos';

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('✅ App wurde zum Startbildschirm hinzugefügt');
      }
      deferredPrompt = null;
    });
  } else {
    // Fallback: Anleitung anzeigen
    const msg = `Um die App direkt im SOS-Bereich auf dem Startbildschirm zu haben:\n\n` +
                `1. Tippe auf die Teilen-Schaltfläche deines Browsers\n` +
                `2. Wähle „Zum Startbildschirm hinzufügen“\n` +
                `3. Die App öffnet sich dann standardmäßig im SOS-Bereich.`;
    
    alert(msg);
    
    // Optional: Hash in URL setzen, damit beim nächsten Start direkt SOS kommt
    history.replaceState(null, '', url.toString());
  }
}

// Beim Start prüfen, ob direkt zum SOS-Tab gesprungen werden soll
if (window.location.hash === '#sos') {
  setTimeout(() => {
    if (typeof switchTab === 'function') {
      switchTab('sos');
    }
  }, 300);
}

// Initialisierung beim Tab-Wechsel
const originalSwitchTabSOS = window.switchTab;
window.switchTab = function(name) {
  originalSwitchTabSOS(name);
  if (name === 'sos') {
    setTimeout(() => {
      loadSOSData();
    }, 80);
  }
};

// Globale Funktion für den Medikamenten-Link
window.goToMedsFromSOS = function() {
  switchTab('meds');
};