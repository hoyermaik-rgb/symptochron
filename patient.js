function savePatientData() {
  const nameVal = document.getElementById('patientName')?.value || '';
  const bdayVal = document.getElementById('patientBday')?.value || '';
  localStorage.setItem('symptochron_patient_name', nameVal);
  localStorage.setItem('symptochron_patient_bday', bdayVal);
}
function loadPatientData() {
  const savedName = localStorage.getItem('symptochron_patient_name') || '';
  const savedBday = localStorage.getItem('symptochron_patient_bday') || '';
  const nameField = document.getElementById('patientName');
  const bdayField = document.getElementById('patientBday');
  if (nameField) nameField.value = savedName;
  if (bdayField) bdayField.value = savedBday;
}
document.addEventListener('DOMContentLoaded', loadPatientData);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
