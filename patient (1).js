function getPatientData() {
  return {
    name: localStorage.getItem('symptochron_patient_name') || '',
    bday: localStorage.getItem('symptochron_patient_bday') || '',
  };
}

function savePatientData() {
  const nameVal = document.getElementById('patientName')?.value || '';
  const bdayVal = document.getElementById('patientBday')?.value || '';
  localStorage.setItem('symptochron_patient_name', nameVal);
  localStorage.setItem('symptochron_patient_bday', bdayVal);
}

function loadPatientData() {
  const patient = getPatientData();
  const nameField = document.getElementById('patientName');
  const bdayField = document.getElementById('patientBday');
  if (nameField) nameField.value = patient.name;
  if (bdayField) bdayField.value = patient.bday;
}

document.addEventListener('DOMContentLoaded', loadPatientData);
