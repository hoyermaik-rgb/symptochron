import { DiaryEntry, Medication, MoodEntry, RLSSurvey, SOSData, BloodPressureEntry } from './types';

// Helper to generate a compliant UUID v4 for FHIR resources
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Converts internal state to an HL7 FHIR Bundle (type: collection)
export function generateFhirBundle(
  diary: Record<string, DiaryEntry>,
  meds: Medication[],
  mood: Record<string, MoodEntry>,
  rlsSurveys: Record<string, RLSSurvey>,
  sosData: SOSData,
  bloodPressure: BloodPressureEntry[] = []
) {
  const bundle = {
    resourceType: 'Bundle',
    id: generateUUID(),
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [] as any[]
  };

  const patientId = generateUUID();

  // 1. Patient Resource
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    name: [
      {
        text: sosData.patientName || 'Unbekannter Patient'
      }
    ],
    birthDate: sosData.dob || undefined
  };
  bundle.entry.push({ resource: patientResource });

  // 2. Conditions (Diagnoses)
  if (sosData.diagnoses) {
    const diagnoses = sosData.diagnoses.split(',').map(d => d.trim()).filter(d => d);
    diagnoses.forEach(diag => {
      bundle.entry.push({
        resource: {
          resourceType: 'Condition',
          id: generateUUID(),
          subject: { reference: `Patient/${patientId}` },
          code: {
            text: diag
          }
        }
      });
    });
  }

  // 3. AllergyIntolerances
  if (sosData.allergies) {
    const allergies = sosData.allergies.split(',').map(a => a.trim()).filter(a => a);
    allergies.forEach(allergy => {
      bundle.entry.push({
        resource: {
          resourceType: 'AllergyIntolerance',
          id: generateUUID(),
          patient: { reference: `Patient/${patientId}` },
          code: {
            text: allergy
          }
        }
      });
    });
  }

  // 4. MedicationStatements
  meds.forEach(m => {
    bundle.entry.push({
      resource: {
        resourceType: 'MedicationStatement',
        id: generateUUID(),
        status: m.active ? 'active' : 'stopped',
        subject: { reference: `Patient/${patientId}` },
        medicationCodeableConcept: {
          text: `${m.name} ${m.dose}`
        },
        note: m.note ? [{ text: m.note }] : undefined,
        dosage: [
          {
            timing: {
              event: [] // we can map schedule morning/noon/evening/night here if needed
            }
          }
        ]
      }
    });
  });

  // 5. Observations (Blood Pressure)
  bloodPressure.forEach(bp => {
    bundle.entry.push({
      resource: {
        resourceType: 'Observation',
        id: generateUUID(),
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs'
              }
            ]
          }
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel with all children optional'
            }
          ],
          text: 'Blood pressure systolic & diastolic'
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: `${bp.date}T${bp.time}:00Z`,
        component: [
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: bp.systolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          },
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure'
                }
              ]
            },
            valueQuantity: {
              value: bp.diastolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          }
        ]
      }
    });
  });

  // 6. QuestionnaireResponses (IRLS)
  Object.keys(rlsSurveys).forEach(dateStr => {
    const survey = rlsSurveys[dateStr];
    bundle.entry.push({
      resource: {
        resourceType: 'QuestionnaireResponse',
        id: generateUUID(),
        status: 'completed',
        subject: { reference: `Patient/${patientId}` },
        authored: `${dateStr}T12:00:00Z`,
        questionnaire: 'http://example.org/Questionnaire/IRLS', // mock URL for IRLS
        item: survey.answers.map((ans, idx) => ({
          linkId: `q${idx + 1}`,
          text: `IRLS Question ${idx + 1}`,
          answer: [
            {
              valueInteger: ans
            }
          ]
        }))
      }
    });
  });

  return bundle;
}
