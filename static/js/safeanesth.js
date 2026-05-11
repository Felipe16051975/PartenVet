/**
 * safeanesth.js — Motor de cálculo anestésico (CASS v2.4)
 * Integrado con la base de datos clínica de PartenVet
 */

const clinicalTips = {
  species: {
    feline: { 
      text: "Lidocaina: No exceder 5 mg/kg. Mayor sensibilidad a toxicidad sistemica en felinos.", 
      level: "critical", 
      source: "Tecnicas Anestesicas en Animales Menores" 
    }
  },
  age: {
    geriatric: { 
      text: "Reducir dosis base entre 25-50%. Riesgo elevado de hipotermia y metabolismo lento.", 
      level: "caution", 
      source: "Tecnicas Anestesicas en Animales Menores" 
    },
    pediatric: { 
      text: "Propension a hipoglucemia. Evitar ayuno prolongado y monitorizar glucosa.", 
      level: "info", 
      source: "Manual de Anestesia T42161" 
    }
  },
  asa: {
    "III": { text: "Analgesia multimodal obligatoria y pre-oxigenacion mandatoria.", level: "caution", source: "Manual T42161" },
    "IV": { text: "Riesgo critico. Estabilizacion hemodinamica previa requerida.", level: "critical", source: "Manual T42161" },
    "V": { text: "Pronostico reservado. Maxima precaucion con inductores.", level: "critical", source: "Manual T42161" }
  },
  comorbidities: {
    cardiac: { 
      text: "Evitar Ketamina en miocardiopatia hipertrofica. Reducir Alfa-2 agonistas.", 
      level: "critical", 
      source: "Manual de Anestesia T42161" 
    },
    renal: { text: "Asegurar fluidoterapia (6-10 ml/kg/h). Evitar AINEs si persiste hipotension.", level: "caution", source: "Manual T42161" },
    hepatic: { text: "Preferir farmacos de vida media corta. Evitar metabolismo hepatico estricto.", level: "caution", source: "Manual T42161" },
    respiratory: { text: "Pre-oxigenar 5 min antes de induccion. Preparar ventilacion asistida.", level: "info", source: "Manual de Anestesia T42161" },
    hypotension: { text: "Acepromacina contraindicada: agrava colapso vascular por vasodilatacion.", level: "critical", source: "Manual de Anestesia T42161" }
  },
  surgeryType: {
    orthopedic: { text: "Alta nocicepcion. Se recomienda bloqueo regional + CRI (FLK).", level: "info", source: "Tecnicas Anestesicas" },
    abdominal_major: { text: "Alta nocicepcion. Considerar Lidocaina en CRI para analgesia visceral.", level: "info", source: "Tecnicas Anestesicas" }
  }
};

const TooltipManager = {
  active: null,
  show(event, key, type) {
    const tip = this.getTip(key, type);
    if (!tip) return;
    
    this.hide();
    const tooltip = document.createElement("div");
    tooltip.className = `clinical-tooltip visible tooltip-level-${tip.level}`;
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span>${tip.level === "critical" ? "CRITICO" : tip.level === "caution" ? "AVISO" : "INFO"}</span>
        <span>CONSEJO: ${type.toUpperCase()}</span>
      </div>
      <div class="tooltip-content">${tip.text}</div>
      <div class="tooltip-ref">Fuente: ${tip.source}</div>
    `;
    document.body.appendChild(tooltip);
    
    const rect = event.currentTarget ? event.currentTarget.getBoundingClientRect() : event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    if (rect.left + 320 > window.innerWidth) {
      tooltip.style.left = `${window.innerWidth - 340}px`;
    }
    this.active = tooltip;
  },
  hide() {
    if (this.active) {
      const el = this.active;
      el.remove();
      this.active = null;
    }
  },
  getTip(key, type) {
    if (type === "medication") {
        const med = medications[key];
        if (!med) return null;
        if (med.risks) {
            const matchingRisk = med.risks.find(r => 
               (r.condition && state.patient.conditions.includes(r.condition)) ||
               (r.species && r.species === state.patient.species) ||
               (r.asa && r.asa.includes(state.patient.asaStatus))
            );
            if (matchingRisk) {
                if (matchingRisk.level === "critical") state.blocked = true;
                return { text: matchingRisk.msg, level: matchingRisk.level, source: "CASS Risk Engine" };
            }
        }
        return { text: "Medicamento indicado para este paciente segun dosis seleccionada.", level: "info", source: "CASS Clinical Guard" };
    }
    const standardTip = clinicalTips[type] ? clinicalTips[type][key] : null;
    return standardTip || null;
  }
};

const safetyGuards = {
  hasCriticalAlerts: false,
  checkAnalgesia() {
    const allSelected = [
        ...state.selectedMedications.premedication,
        ...state.selectedMedications.induction,
        ...state.selectedMedications.maintenance
    ];
    
    const analgesics = ["ketamina", "xilacina", "dexmedetomidina", "ketamina_induction", "ketamina_maintenance", "lidocaina_cri"];
    const hasAnalgesia = allSelected.some(k => analgesics.includes(k)) || state.blockState.volume > 0;
    const profile = surgeryProfiles[state.patient.surgeryType];
    
    if (profile && (profile.intensity === "medium" || profile.intensity === "high") && !hasAnalgesia) {
        showAlert("ATENCION: No se detecta componente analgesico en cirugia de moderada/alta nocicepcion.", "caution");
    }

    state.patient.conditions.forEach(c => {
        const cTip = TooltipManager.getTip(c, "comorbidities");
        if (cTip && cTip.level === "critical") {
            state.blocked = true;
            state.blockReasons.push(cTip.text);
        }
    });

    const ageTip = TooltipManager.getTip(state.patient.ageCategory, "age");
    const asaTip = TooltipManager.getTip(state.patient.asaStatus, "asa");
    if (ageTip && ageTip.level === "critical") { state.blocked = true; state.blockReasons.push(ageTip.text); }
    if (asaTip && asaTip.level === "critical") { state.blocked = true; state.blockReasons.push(asaTip.text); }
    
    state.criticallyRiskyMeds = [];
    
    // Check medication specific risks
    allSelected.forEach(key => {
        const med = medications[key];
        if (med && med.risks) {
            const highRisk = med.risks.find(r => 
                (r.level === "critical") && (
                    (r.condition && state.patient.conditions.includes(r.condition)) ||
                    (r.species && r.species === state.patient.species) ||
                    (r.asa && r.asa.includes(state.patient.asaStatus))
                )
            );
            if (highRisk) {
                state.criticallyRiskyMeds.push(key);
            }
        }
    });

    // Combined Risk: Alpha-2 + Ketamine in ASA IV/V Cats
    if (state.patient.species === "feline" && (state.patient.asaStatus === "IV" || state.patient.asaStatus === "V")) {
      const hasAlpha2Keys = allSelected.filter(k => ["xilacina", "dexmedetomidina"].includes(k));
      const hasKetamineKeys = allSelected.filter(k => ["ketamina", "ketamina_induction", "ketamina_maintenance"].includes(k));
      if (hasAlpha2Keys.length > 0 && hasKetamineKeys.length > 0) {
        state.blocked = true;
        state.blockReasons.push("**RIESGO FATAL**: Combinación de Alfa-2 + Ketamina en gato ASA IV/V. Alto riesgo de colapso cardio-respiratorio.");
        // Mark both as critically risky
        hasAlpha2Keys.forEach(k => state.criticallyRiskyMeds.push(k));
        hasKetamineKeys.forEach(k => state.criticallyRiskyMeds.push(k));
      }
    }
  },
  updatePrintStatus() {
    const banner = document.getElementById("clinicalWarningBanner");
    if (!banner) return;
    if (state.blockReasons.length > 0) {
        banner.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">⚠️ AVISO CLINICO: REVISAR PROTOCOLO</div>
            <ul style="margin: 0; padding-left: 15px; text-align: left; font-size: 0.85rem;">
                ${state.blockReasons.map(r => `<li>${r}</li>`).join("")}
            </ul>
        `;
        banner.style.display = "block";
    } else {
        banner.style.display = "none";
    }
    
    const pTech = document.getElementById("printTechBtn");
    const pClin = document.getElementById("printClinicalBtn");
    if (pTech) pTech.disabled = false;
    if (pClin) pClin.disabled = false;
  }
};

function getAdjustedRange(medData, patient) {
    const species = patient.species;
    const base = medData.doses[species];
    let factor = 1.0;
    
    if (patient.ageCategory === "geriatric") factor *= 0.75;
    if (patient.asaStatus === "III") factor *= 0.80;
    if (patient.asaStatus === "IV" || patient.asaStatus === "V") factor *= 0.65;
    
    if (patient.conditions.includes("cardiac") || patient.conditions.includes("renal") || patient.conditions.includes("hepatic")) {
        factor *= 0.85;
    }

    return {
        min: parseFloat((base.min * factor).toFixed(3)),
        max: parseFloat((base.max * factor).toFixed(3)),
        default: parseFloat((base.default * factor).toFixed(3)),
        isAdjusted: factor < 1.0
    };
}

const medications = {
  // ---- PREMEDICACION ----
  ketamina: {
    name: "Ketamina", concentration: 115, unit: "mg/ml",
    phase: "premedication", routes: ["IM"],
    doses: { canine: { min: 2, max: 15, default: 5 }, feline: { min: 2, max: 15, default: 5 } },
    hardLimits: { canine: 20, feline: 15 },
    risks: [
      { condition: "renal", level: "caution", msg: "**Ketamina**: Reducir dosis en nefropatía. En gatos se excreta vía renal; la falla renal prolonga su efecto y aumenta toxicidad." }
    ],
    mixable: true, isCRI: false
  },
  xilacina: {
    name: "Xilacina", concentration: 20, unit: "mg/ml",
    phase: "premedication", routes: ["IM","IV"],
    doses: { canine: { min: 0.5, max: 1.0, default: 0.5 }, feline: { min: 0.5, max: 1.0, default: 0.5 } },
    hardLimits: { canine: 1.0, feline: 0.5 },
    risks: [
      { condition: "cardiac", level: "caution", msg: "**Xilacina**: produce bradicardia y vasoconstriccion periferica" },
      { asa: ["III"], level: "caution", msg: "**Xilacina** en ASA III: riesgo de bradicardia severa" },
      { asa: ["IV","V"], level: "critical", msg: "**Xilacina** en ASA IV/V: Contraindicada por depresión cardiovascular severa. Riesgo de muerte." }
    ],
    mixable: true, isCRI: false
  },
  dexmedetomidina: {
    name: "Dexmedetomidina", concentration: 0.5, unit: "mg/ml",
    phase: "premedication", routes: ["IM","IV"],
    doses: { canine: { min: 0.005, max: 0.02, default: 0.01 }, feline: { min: 0.005, max: 0.04, default: 0.02 } },
    hardLimits: { canine: 0.04, feline: 0.04 },
    risks: [
      { condition: "cardiac", level: "critical", msg: "Dexmedetomidina: contraindicada en cardiopatia severa" },
      { asa: ["IV","V"], level: "critical", msg: "Dexmedetomidina: evitar en ASA IV-V" }
    ],
    mixable: true, isCRI: false
  },
  atropina: {
    name: "Atropina", concentration: 1, unit: "mg/ml",
    phase: "premedication", routes: ["SC","IM"],
    doses: { canine: { min: 0.01, max: 0.05, default: 0.02 }, feline: { min: 0.01, max: 0.05, default: 0.02 } },
    hardLimits: { canine: 0.1, feline: 0.1 },
    risks: [], mixable: true, isCRI: false
  },
  acepromacina: {
    name: "Pacifor (Acepromacina)", concentration: 10, unit: "mg/ml",
    phase: "premedication", routes: ["IM","SC"],
    doses: { canine: { min: 0.01, max: 0.05, default: 0.03 }, feline: { min: 0.04, max: 0.1, default: 0.06 } },
    hardLimits: { canine: 0.1, feline: 0.1 },
    risks: [
      { condition: "cardiac", level: "critical", msg: "Acepromacina: vasodilatacion e hipotension en cardiopatia - evitar" },
      { condition: "respiratory", level: "caution", msg: "Acepromacina: puede potenciar depresion respiratoria" },
      { asa: ["IV","V"], level: "critical", msg: "Acepromacina: contraindicada en ASA IV-V" }
    ],
    mixable: true, isCRI: false
  },
  diazepam_premed: {
    name: "Diazepam", concentration: 5, unit: "mg/ml",
    phase: "premedication", routes: ["IV","IM"],
    doses: { canine: { min: 0.1, max: 0.5, default: 0.3 }, feline: { min: 0.1, max: 0.5, default: 0.3 } },
    hardLimits: { canine: 0.5, feline: 0.5 },
    risks: [{ condition: "hepatic", level: "caution", msg: "Diazepam: metabolismo hepatico - reducir dosis en hepatopatia" }],
    mixable: true, isCRI: false
  },
  midazolam: {
    name: "Midazolam", concentration: 5, unit: "mg/ml",
    phase: "premedication", routes: ["IM","IV"],
    doses: { canine: { min: 0.1, max: 0.3, default: 0.2 }, feline: { min: 0.1, max: 0.4, default: 0.2 } },
    hardLimits: { canine: 0.5, feline: 0.5 },
    risks: [{ condition: "hepatic", level: "caution", msg: "Midazolam: metabolismo hepatico - reducir dosis en hepatopatia" }],
    mixable: true, isCRI: false
  },
  propofol1_induction: {
    name: "Propofol 1%", concentration: 10, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 2, max: 6, default: 4 }, feline: { min: 2, max: 6, default: 4 } },
    hardLimits: { canine: 8, feline: 7 },
    risks: [{ species: "feline", level: "caution", msg: "Propofol en gato: preferir libre de conservantes" }],
    mixable: false, isCRI: false
  },
  propofol2_induction: {
    name: "Propofol 2%", concentration: 20, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 2, max: 6, default: 4 }, feline: { min: 2, max: 6, default: 4 } },
    hardLimits: { canine: 8, feline: 7 },
    risks: [{ species: "feline", level: "caution", msg: "Propofol en gato: preferir libre de conservantes" }],
    mixable: false, isCRI: false
  },
  ketamina_induction: {
    name: "Ketamina", concentration: 115, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 1, max: 5, default: 2 }, feline: { min: 2, max: 8, default: 5 } },
    hardLimits: { canine: 10, feline: 10 },
    risks: [{ condition: "renal", level: "caution", msg: "Ketamina: excrecion renal - reducir en nefropatia" }],
    mixable: true, isCRI: false
  },
  diazepam_induction: {
    name: "Diazepam", concentration: 5, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 0.1, max: 0.5, default: 0.25 }, feline: { min: 0.1, max: 0.5, default: 0.25 } },
    hardLimits: { canine: 0.5, feline: 0.5 },
    risks: [{ condition: "hepatic", level: "caution", msg: "Diazepam: metabolismo hepatico - reducir en hepatopatia" }],
    mixable: true, isCRI: false
  },
  midazolam_induction: {
    name: "Midazolam", concentration: 5, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 0.1, max: 0.3, default: 0.2 }, feline: { min: 0.1, max: 0.3, default: 0.15 } },
    hardLimits: { canine: 0.5, feline: 0.5 },
    risks: [{ condition: "hepatic", level: "caution", msg: "Midazolam: metabolismo hepatico - precaucion en hepatopatia" }],
    mixable: true, isCRI: false
  },
  thiopental: {
    name: "Tiopental 10%", concentration: 100, unit: "mg/ml",
    phase: "induction", routes: ["IV"],
    doses: { canine: { min: 10, max: 15, default: 12 }, feline: { min: 8, max: 12, default: 10 } },
    hardLimits: { canine: 20, feline: 15 },
    risks: [
      { species: "feline", level: "critical", msg: "Tiopental en gato: riesgo de apnea" },
      { condition: "cardiac", level: "caution", msg: "Tiopental: depresion miocardica" },
      { condition: "respiratory", level: "critical", msg: "Tiopental: depresion respiratoria" }
    ],
    mixable: false, isCRI: false
  },
  propofol2_maintenance: {
    name: "Propofol 2%", concentration: 20, unit: "mg/ml",
    phase: "maintenance", routes: ["IV (CRI)"],
    doses: { canine: { min: 0.1, max: 0.4, default: 0.2 }, feline: { min: 0.05, max: 0.3, default: 0.15 } },
    hardLimits: { canine: 0.5, feline: 0.4 },
    criUnit: "mg/kg/min",
    risks: [{ species: "feline", level: "caution", msg: "Propofol en gato >60 min: riesgo de cuerpos de Heinz" }],
    mixable: true, isCRI: true
  },
  propofol1_maintenance: {
    name: "Propofol 1%", concentration: 10, unit: "mg/ml",
    phase: "maintenance", routes: ["IV (CRI)"],
    doses: { canine: { min: 0.1, max: 0.4, default: 0.2 }, feline: { min: 0.05, max: 0.3, default: 0.15 } },
    hardLimits: { canine: 0.5, feline: 0.4 },
    criUnit: "mg/kg/min",
    mixable: true, isCRI: true
  },
  ketamina_maintenance: {
    name: "Ketamina (CRI)", concentration: 115, unit: "mg/ml",
    phase: "maintenance", routes: ["IV (CRI)"],
    doses: { canine: { min: 0.3, max: 1.0, default: 0.5 }, feline: { min: 0.2, max: 0.6, default: 0.3 } },
    hardLimits: { canine: 1.5, feline: 1.0 },
    criUnit: "mg/kg/hr",
    risks: [{ condition: "cardiac", level: "caution", msg: "Ketamina: aumenta FC/PA" }],
    mixable: true, isCRI: true
  },
  lidocaina_cri: {
    name: "Lidocaina IV (CRI)", concentration: 20, unit: "mg/ml",
    phase: "maintenance", routes: ["IV (CRI)"],
    doses: { canine: { min: 0.5, max: 1.5, default: 1.0 }, feline: { min: 0.2, max: 0.5, default: 0.3 } },
    hardLimits: { canine: 2.0, feline: 0.5 },
    criUnit: "mg/kg/hr",
    risks: [{ species: "feline", level: "critical", msg: "Lidocaina IV en gatos: max 0.5 mg/kg/hr." }],
    mixable: true, isCRI: true
  }
};

const blockAgents = {
  lidocaine2: { name: "Lidocaina 2%", concentration: 20, maxDoseCanine: 10, maxDoseFeline: 5 },
  lidocaine1: { name: "Lidocaina 1%", concentration: 10, maxDoseCanine: 10, maxDoseFeline: 5 },
  bupivacaine: { name: "Bupivacaina 0.5%", concentration: 5, maxDoseCanine: 2, maxDoseFeline: 1 }
};

const surgeryProfiles = {
  castration:         { label: "Castracion",          intensity: "medium", suggestKetCRI: true,  suggestBlock: true,  suggestLidoCRI: false },
  ovariohysterectomy: { label: "OVH",                intensity: "high",   suggestKetCRI: true,  suggestBlock: true,  suggestLidoCRI: true  },
  dental:             { label: "Dental",              intensity: "low",    suggestKetCRI: false, suggestBlock: true,  suggestLidoCRI: false },
  orthopedic:         { label: "Ortopedica",          intensity: "high",   suggestKetCRI: true,  suggestBlock: true,  suggestLidoCRI: true  },
  soft_tissue:        { label: "Tejido Blando",       intensity: "medium", suggestKetCRI: true,  suggestBlock: true,  suggestLidoCRI: false },
  other:              { label: "Otro",                intensity: "medium", suggestKetCRI: false, suggestBlock: false, suggestLidoCRI: false }
};

const state = {
  patient: {
    id: null, name: "", tutor: "", species: "canine", age: "", weight: 0,
    ageCategory: "adult", asaStatus: "I", conditions: [], surgeryType: "castration"
  },
  selectedMedications: { premedication: [], induction: [], maintenance: [] },
  selectedDoses: {},
  currentPhase: "premedication",
  maintenanceDuration: 60,
  results: { premedication: [], induction: [], maintenance: [] },
  tivaMixResults: null,
  blockState: { agent: "lidocaine2", type: "local", volume: 0 },
  currentView: "technical",
  auditLog: [],
  blocked: false,
  blockReasons: [],
  criticallyRiskyMeds: [],
  includeBlockInPrint: false
};

document.addEventListener("DOMContentLoaded", async () => {
  initEventListeners();
  renderMedicationCards();
  updateSurgerySuggestions();
  
  // Cargar pacientes y contexto activo
  await loadPacientes();
  await checkActivePatient();
});

async function checkActivePatient() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('paciente_id');
    
    let res;
    if (idFromUrl) {
      res = await fetchAPI(`/pacientes/${idFromUrl}`);
    } else {
      res = await fetchAPI('/paciente-activo');
    }
    
    if (res.success && res.data) {
      console.log("SafeAnesthesia: Cargando paciente activo:", res.data.nombre);
      loadPatientData(res.data);
    }
  } catch (e) {
    console.log("SafeAnesthesia: No hay paciente activo.");
  }
}

function loadPatientData(p) {
  state.patient.id = p.id;
  state.patient.name = p.nombre;
  state.patient.tutor = `${p.tutor_nombres || p.tutor_nombre || ''} ${p.tutor_apellidos || ''}`.trim();
  
  // Mapear especie a los valores que espera el motor CASS
  const especieLower = (p.especie || '').toLowerCase();
  if (especieLower.includes('fel') || especieLower.includes('gat')) {
    state.patient.species = 'feline';
  } else {
    state.patient.species = 'canine';
  }
  
  state.patient.weight = parseFloat(p.peso_actual) || 0;
  state.patient.age = p.edad || "";
  
  // Calcular edad si solo tenemos fecha_nacimiento
  if (!state.patient.age && p.fecha_nacimiento) {
    const born = new Date(p.fecha_nacimiento);
    const now = new Date();
    let ageYears = now.getFullYear() - born.getFullYear();
    const m = now.getMonth() - born.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < born.getDate())) {
        ageYears--;
    }
    state.patient.age = ageYears < 0 ? 0 : ageYears;
  }
  
  state.patient.ageCategory = determineAgeCategory(state.patient.age, state.patient.species);
  
  // Actualizar UI
  document.getElementById('patientName').value = state.patient.name;
  document.getElementById('species').value = state.patient.species;
  document.getElementById('weight').value = state.patient.weight;
  document.getElementById('age').value = state.patient.age;
  
  const select = document.getElementById('pacienteSelect');
  if (select) select.value = p.id;
  
  calculateProtocol();
}

async function loadPacientes() {
  try {
    const result = await fetchAPI('/pacientes');
    const select = document.getElementById('pacienteSelect');
    if (result.success && result.data) {
      select.innerHTML = '<option value="">-- Seleccionar Paciente en Red PartenVet --</option>';
      result.data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre} (${p.especie}) - Tutor: ${p.tutor_nombre || p.tutor_nombres || ''}`;
        select.appendChild(opt);
      });
      
      select.addEventListener('change', async (e) => {
        if (e.target.value) {
          const res = await fetchAPI(`/pacientes/${e.target.value}`);
          if (res.success) loadPatientData(res.data);
        }
      });
    }
  } catch (e) { console.error("Error al cargar pacientes:", e); }
}

function clearAlerts() {
  const container = document.getElementById("alertContainer");
  if (container) container.innerHTML = "";
  state.blocked = false;
  state.blockReasons = [];
  safetyGuards.updatePrintStatus();
}

function initEventListeners() {
  document.getElementById("patientName").addEventListener("input", e => state.patient.name = e.target.value);
  document.getElementById("species").addEventListener("change", e => {
    state.patient.species = e.target.value;
    state.selectedMedications = { premedication: [], induction: [], maintenance: [] };
    state.selectedDoses = {};
    TooltipManager.hide();
    clearAlerts();
    renderMedicationCards();
    updateSurgerySuggestions();
    updateBlockResults();
  });
  
  const ageInput = document.getElementById("age");
  if (ageInput) {
    ageInput.addEventListener("mouseenter", (e) => TooltipManager.show(e, state.patient.ageCategory, "age"));
    ageInput.addEventListener("mouseleave", () => TooltipManager.hide());
    ageInput.addEventListener("input", e => {
        state.patient.age = e.target.value;
        state.patient.ageCategory = determineAgeCategory(e.target.value, state.patient.species);
        calculateProtocol();
    });
  }

  const weightInput = document.getElementById("weight");
  if (weightInput) {
    weightInput.addEventListener("input", e => {
        let val = parseFloat(e.target.value);
        state.patient.weight = (isNaN(val) || val <= 0) ? 0 : val;
        calculateProtocol();
    });
  }

  const asaInput = document.getElementById("asaStatus");
  if (asaInput) {
    asaInput.addEventListener("mouseenter", (e) => TooltipManager.show(e, state.patient.asaStatus, "asa"));
    asaInput.addEventListener("mouseleave", () => TooltipManager.hide());
    asaInput.addEventListener("change", e => {
        state.patient.asaStatus = e.target.value;
        updateSurgerySuggestions();
        calculateProtocol();
    });
  }

  const surgInput = document.getElementById("surgeryType");
  if (surgInput) {
    surgInput.addEventListener("mouseenter", (e) => TooltipManager.show(e, state.patient.surgeryType, "surgeryType"));
    surgInput.addEventListener("mouseleave", () => TooltipManager.hide());
    surgInput.addEventListener("change", e => {
        state.patient.surgeryType = e.target.value;
        const otherGrp = document.getElementById("surgeryOtherGroup");
        if (otherGrp) otherGrp.style.display = e.target.value === "other" ? "block" : "none";
        updateSurgerySuggestions();
    });
  }

  document.querySelectorAll(".condition-checkbox").forEach(cb => {
    const val = cb.value;
    cb.parentElement.onmouseenter = (e) => TooltipManager.show(e, val, "comorbidities");
    cb.parentElement.onmouseleave = () => TooltipManager.hide();
    cb.addEventListener("change", e => {
      if (e.target.checked) state.patient.conditions.push(e.target.value);
      else state.patient.conditions = state.patient.conditions.filter(c => c !== e.target.value);
      updateSurgerySuggestions();
      calculateProtocol();
    });
  });

  document.querySelectorAll(".phase-tab").forEach(tab => {
    tab.addEventListener("click", e => switchPhase(e.target.dataset.phase));
  });

  const mDur = document.getElementById("maintenanceDuration");
  if (mDur) {
    mDur.addEventListener("input", e => {
        state.maintenanceDuration = parseInt(e.target.value) || 60;
    });
  }

  const bAgent = document.getElementById("blockAgent");
  if (bAgent) bAgent.addEventListener("change", e => { state.blockState.agent = e.target.value; updateBlockResults(); });
  const bVol = document.getElementById("blockVolume");
  if (bVol) bVol.addEventListener("input", e => { state.blockState.volume = parseFloat(e.target.value) || 0; updateBlockResults(); });
  
  const calcBtn = document.getElementById("calculateBtn");
  if (calcBtn) calcBtn.addEventListener("click", calculateProtocol);
  
  const vTech = document.getElementById("viewTechnicalBtn");
  if (vTech) vTech.addEventListener("click", () => switchView("technical"));
  const vClin = document.getElementById("viewClinicalBtn");
  if (vClin) vClin.addEventListener("click", () => switchView("clinical"));
  
  const pTech = document.getElementById("printTechBtn");
  if (pTech) pTech.addEventListener("click", () => { document.body.dataset.printMode = "technical"; window.print(); });
  const pClin = document.getElementById("printClinicalBtn");
  if (pClin) pClin.addEventListener("click", () => { document.body.dataset.printMode = "clinical"; window.print(); });

  const saveBtn = document.getElementById("saveProtocolBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveProtocolToDB);
}

async function saveProtocolToDB() {
    if (!state.patient.id) { alert("Debe seleccionar un paciente primero."); return; }
    
    const btn = document.getElementById('saveProtocolBtn');
    const origText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
    
    try {
        const result = await fetchAPI('/calculos_anestesia', {
            method: 'POST',
            body: JSON.stringify({
                paciente_id: state.patient.id,
                peso_utilizado: state.patient.weight,
                riesgo_asa: state.patient.asaStatus,
                protocolo_json: {
                    medications: state.selectedMedications,
                    results: state.results,
                    tiva: state.tivaMixResults,
                    block: state.blockState,
                    blockReasons: state.blockReasons
                }
            })
        });
        if (result.success) {
            alert('✅ Protocolo guardado en el historial clínico de PartenVet.');
        }
    } catch (e) { 
        alert('Error al guardar: ' + e.message); 
    } finally {
        if (btn) { btn.textContent = origText; btn.disabled = false; }
    }
}

function determineAgeCategory(age, species) {
  const a = parseFloat(age);
  if (isNaN(a)) return "adult";
  if (species === "canine") return a < 1 ? "pediatric" : a > 7 ? "geriatric" : "adult";
  return a < 1 ? "pediatric" : a > 10 ? "geriatric" : "adult";
}

function suggestSyringeSize(totalMl) {
  if (totalMl <= 1)  return "1 ml";
  if (totalMl <= 3)  return "3 ml";
  if (totalMl <= 5)  return "5 ml";
  if (totalMl <= 10) return "10 ml";
  return "DIVIDIR - >10 ml";
}

function switchPhase(phase) {
  state.currentPhase = phase;
  document.querySelectorAll(".phase-tab").forEach(t => t.classList.remove("active"));
  document.querySelector("[data-phase='" + phase + "']").classList.add("active");
  document.querySelectorAll(".phase-content").forEach(c => c.classList.remove("active"));
  const phaseEl = document.getElementById(phase + "Phase");
  if (phaseEl) phaseEl.classList.add("active");
  renderMedicationCards();
}

function switchView(view) {
  state.currentView = view;
  const tV = document.getElementById("technicalView");
  const cV = document.getElementById("clinicalView");
  if (tV) tV.style.display = view === "technical" ? "block" : "none";
  if (cV) cV.style.display = view === "clinical" ? "block" : "none";
  
  document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
  const activeBtn = document.querySelector(`[data-view="${view}"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

function updateSurgerySuggestions() {
  const el = document.getElementById("surgerySuggestions");
  if (!el) return;
  const profile = surgeryProfiles[state.patient.surgeryType];
  const items = [];
  if (profile && profile.suggestKetCRI) items.push("Moderada/Alta: incluir <strong>Ketamina CRI</strong>.");
  if (profile && profile.suggestBlock) items.push("Local: considerar <strong>bloqueo regional</strong>.");
  if (state.patient.conditions.includes("cardiac")) items.push("Cardiopatia: evitar Acepromacina/Xilacina.");
  if (items.length > 0) {
    el.innerHTML = "<strong>Tips:</strong><ul>" + items.map(i => "<li>" + i + "</li>").join("") + "</ul>";
    el.style.display = "block";
  } else el.style.display = "none";
}

function renderMedicationCards() {
  const container = document.getElementById(state.currentPhase + "Medications");
  if (!container) return;
  container.innerHTML = "";
  Object.entries(medications)
    .filter(([, m]) => m.phase === state.currentPhase)
    .forEach(([key, med]) => container.appendChild(createMedicationCard(key, med)));
}

function createMedicationCard(key, med) {
  const patient = state.patient;
  const adjRange = getAdjustedRange(med, patient);
  
  if (!state.selectedDoses[key]) state.selectedDoses[key] = adjRange.default;
  const isSelected = state.selectedMedications[state.currentPhase].includes(key);
  const isCriticallyRisky = state.criticallyRiskyMeds.includes(key);
  
  const card = document.createElement("div");
  card.className = "medication-card" + (isSelected ? " selected" : "") + (isCriticallyRisky ? " critically-risky" : "");
  
  const criLabel = med.isCRI ? " (" + (med.criUnit || "mg/kg/hr") + ")" : "";
  const userDose = state.selectedDoses[key];
  
  let doseClass = "";
  let doseMsg = "";
  if (userDose > adjRange.max) {
      doseClass = "dose-high-range";
      const limitType = adjRange.isAdjusted ? "Ajustado" : "Máx";
      doseMsg = `<div class='dose-warning-inline'>Dosis Alta: ${limitType} ${adjRange.max}</div>`;
  } else if (userDose < adjRange.min) {
      doseClass = "dose-low-range";
      const limitType = adjRange.isAdjusted ? "Ajustado" : "Mín";
      doseMsg = `<div class='dose-info-inline'>Dosis Baja: ${limitType} ${adjRange.min}</div>`;
  }

  card.innerHTML = `
    <input type='checkbox' class='medication-checkbox' ${isSelected ? "checked" : ""}>
    <div class='medication-name'>${med.name} ${isCriticallyRisky ? '<span title="ALTO RIESGO">⚠️</span>' : ''}</div>
    <div class='medication-concentration'>${med.concentration} ${med.unit} | ${med.routes.join("/")} ${adjRange.isAdjusted ? "<span title='Rango ajustado por perfil clinico'>⚖️</span>" : ""}</div>
    <div class='dose-range-display'>Rango SEGURO: ${adjRange.min} - ${adjRange.max} mg/kg${criLabel}</div>
    ${isSelected ? `
      <div class='dose-selector' style='margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;'>
        <label style='font-size: 0.8rem;'>Dosis mg/kg:</label>
        <input type='number' class='dose-input ${doseClass}' value='${userDose}' step='0.001' style='width: 80px;'>
        ${doseMsg}
        ${ (doseClass === "dose-high-range" || isCriticallyRisky) ? `<button class='btn-suggest-dose' onclick='event.stopPropagation(); suggestSafeDose("${key}")' style='display:block; margin-top:5px; font-size:0.7rem; color:var(--primary-color); border:none; background:none; cursor:pointer;'>Ajustar a Dosis Clínica Segura</button>` : "" }
      </div>` : ""}
  `;
  
  card.onmouseenter = (e) => { e.stopPropagation(); TooltipManager.show(e, key, "medication"); };
  card.onmouseleave = (e) => { e.stopPropagation(); TooltipManager.hide(); };
  card.onclick = (e) => { if (!e.target.matches("input, button")) toggleMedication(key, !isSelected); };
  
  const cb = card.querySelector(".medication-checkbox");
  cb?.addEventListener("change", (e) => {
      e.stopPropagation();
      toggleMedication(key, e.target.checked);
  });
  
  if (isSelected) {
    const inp = card.querySelector(".dose-input");
    inp.onchange = (e) => { 
      state.selectedDoses[key] = parseFloat(e.target.value); 
      calculateProtocol(); 
    };
  }
  return card;
}

function suggestSafeDose(key) {
    const med = medications[key];
    const adjRange = getAdjustedRange(med, state.patient);
    state.selectedDoses[key] = adjRange.default;
    calculateProtocol();
}

function toggleMedication(key, isSelected) {
  const phase = state.currentPhase;
  if (isSelected) {
    if (!state.selectedMedications[phase].includes(key)) state.selectedMedications[phase].push(key);
  } else state.selectedMedications[phase] = state.selectedMedications[phase].filter(k => k !== key);
  renderMedicationCards();
}

function applyAdjustments(medKey, med, baseDose) {
  const steps = [{ label: "Dosis Seleccionada", dose: baseDose, factor: 1.0 }];
  let d = baseDose;
  
  if (medKey === "lidocaina_cri" && state.patient.species === "feline" && d > 0.5) d = 0.5;
  
  const finalAdj = { finalDose: d, steps, totalReductionPct: 0 };
  
  const species = state.patient.species;
  if (med.hardLimits && d > med.hardLimits[species]) {
      state.blocked = true;
      const msg = `CRITICO: ${med.name} excede limite de seguridad (${med.hardLimits[species]} mg/kg).`;
      state.blockReasons.push(msg);
      showAlert(msg, "critical");
  }

  return finalAdj;
}

function calculateProtocol() {
  clearAlerts();
  
  let resetTriggered = false;
  state.selectedMedications.premedication.concat(state.selectedMedications.induction, state.selectedMedications.maintenance).forEach(key => {
      const med = medications[key];
      const adjRange = getAdjustedRange(med, state.patient);
      if (state.selectedDoses[key] > adjRange.max) {
          state.selectedDoses[key] = adjRange.default;
          resetTriggered = true;
      }
  });

  if (resetTriggered) {
      showAlert("⚠️ MEDICAMENTOS AJUSTADOS: Algunas dosis se han reducido automáticamente para ajustarse al nuevo perfil de riesgo del paciente.", "caution");
  }

  state.results.premedication = calcPhase("premedication");
  state.results.induction = calcPhase("induction");
  state.tivaMixResults = calculateAutomaticTiva();
  
  safetyGuards.checkAnalgesia();
  renderResults();
  renderMedicationCards();
  safetyGuards.updatePrintStatus();

  document.getElementById("resultsSection").style.display = "block";
}

function calcPhase(phase) {
  const w = state.patient.weight;
  return state.selectedMedications[phase].map(key => {
    const med = medications[key];
    const adj = applyAdjustments(key, med, state.selectedDoses[key]);
    const totalMg = adj.finalDose * w;
    return { name: med.name, finalDose: adj.finalDose, totalMg, volume: totalMg / med.concentration, steps: adj.steps, totalReductionPct: adj.totalReductionPct, route: med.routes[0] };
  });
}

function calculateAutomaticTiva() {
  const keys = state.selectedMedications.maintenance;
  if (keys.length === 0) return null;
  const w = state.patient.weight;
  const dur = state.maintenanceDuration;
  const drugs = keys.map(key => {
    const med = medications[key];
    const adj = applyAdjustments(key, med, state.selectedDoses[key]);
    const mgTotal = adj.finalDose * w;
    return { med, mgTotal, vol: mgTotal / med.concentration };
  });
  const totalVol = drugs.reduce((acc, d) => acc + d.vol, 0);
  
  const mlPerMin = totalVol / dur;
  const minPer01 = 0.1 / mlPerMin;
  const secPer01 = minPer01 * 60;
  
  let titrationStr = "";
  if (secPer01 >= 60) titrationStr = `${(secPer01 / 60).toFixed(1)} min`;
  else titrationStr = `${Math.round(secPer01)} seg`;

  return { 
    drugs, totalVol, 
    rateEvery5Min: (totalVol/dur)*5, 
    rateMlMin: totalVol/dur, 
    titration: titrationStr,
    duration: dur, 
    syringe: suggestSyringeSize(totalVol) 
  };
}

function updateBlockResults() {
  const el = document.getElementById("blockResults");
  if (!el) return;
  const agent = blockAgents[state.blockState.agent];
  const w = state.patient.weight;
  const sp = state.patient.species;
  if (!w || w <= 0) { el.innerHTML = ""; return; }
  
  const maxMgKg = sp === "feline" ? agent.maxDoseFeline : agent.maxDoseCanine;
  const maxVol = (maxMgKg * w) / agent.concentration;
  const indicated = state.blockState.volume;
  const pct = ( (indicated * agent.concentration) / (maxMgKg * w) ) * 100;

  if (pct > 100) {
      state.blocked = true;
      state.blockReasons.push(`Sobredosis de Anestesia Regional: ${agent.name} excede el limite maximo.`);
      safetyGuards.updatePrintStatus();
  }

  el.innerHTML = `
    <div class="block-results-card ${pct > 100 ? "block-status-critical" : pct > 80 ? "block-status-warning" : "block-status-ok"}" style="padding:1rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
        <span style="font-weight:bold; color:var(--primary-color);">${agent.name}</span>
        <span style="font-weight:bold; color:${pct > 100 ? 'red' : 'green'};">${pct > 100 ? "SOBREDOSIS" : "Seguro"}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center;">
        <div><label style="font-size:0.7rem; color:#64748b;">Limite Max</label><div style="font-weight:bold;">${maxVol.toFixed(2)} ml</div></div>
        <div><label style="font-size:0.7rem; color:#64748b;">A Cargar</label><div style="font-weight:bold; color:var(--primary-color);">${indicated.toFixed(2)} ml</div></div>
        <div><label style="font-size:0.7rem; color:#64748b;">% Dosis</label><div style="font-weight:bold;">${Math.round(pct)}%</div></div>
      </div>
    </div>
    <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="includeBlockInPrint" ${state.includeBlockInPrint ? "checked" : ""}>
        <label for="includeBlockInPrint" style="font-size: 0.85rem; color: #64748b; cursor: pointer;">Incluir este bloqueo en el reporte PDF</label>
    </div>
    `;
    
  const includeCheck = document.getElementById("includeBlockInPrint");
  if (includeCheck) {
    includeCheck.addEventListener("change", e => {
      state.includeBlockInPrint = e.target.checked;
      updateTechnicalBlockView(agent, indicated, maxVol);
    });
  }

  updateTechnicalBlockView(agent, indicated, maxVol);
}

function updateTechnicalBlockView(agent, vol, maxVol) {
  if (vol <= 0 || !state.includeBlockInPrint) { 
    state.regionalSummary = null;
    renderPatientSummary();
    return; 
  }
  const pct = ((vol * agent.concentration) / ( (state.patient.species === "feline" ? agent.maxDoseFeline : agent.maxDoseCanine) * state.patient.weight )) * 100;
  state.regionalSummary = `${agent.name} – Max: ${maxVol.toFixed(1)}ml – Usando: ${vol.toFixed(1)}ml (${Math.round(pct)}%)`;
  renderPatientSummary();
}

function renderResults() {
  updateBlockResults();
  renderPatientSummary();
  const techPre = document.getElementById("premedicationResultsTech");
  const techInd = document.getElementById("inductionResultsTech");
  const techMaint = document.getElementById("maintenanceResultsTech");
  
  if (techPre) techPre.innerHTML = buildPhaseTable(state.results.premedication, "1. PREMEDICACION");
  if (techInd) techInd.innerHTML = buildPhaseTable(state.results.induction, "2. INDUCCION");
  
  renderClinicalView();
  
  const mix = state.tivaMixResults;
  if (mix && techMaint) {
    let acc = 0;
    techMaint.innerHTML = `
      <div class="tech-phase-block">
        <div class="tech-phase-title">3. MANTENIMIENTO TIVA (${mix.duration} min)</div>
        <table class="tiva-table">
          <thead><tr><th>Farmaco</th><th>Volumen</th><th>Acumulado</th></tr></thead>
          <tbody>${mix.drugs.map(d => { acc += d.vol; return `<tr><td>${d.med.name}</td><td><strong>${d.vol.toFixed(2)} ml</strong></td><td>${acc.toFixed(2)} ml</td></tr>` }).join("")}</tbody>
        </table>
        <div style="margin-top:10px; font-size:0.9rem; background:#f1f5f9; padding:10px; border-radius:8px;">
            <div>Total Mezcla: <strong>${mix.totalVol.toFixed(2)} ml</strong></div>
            <div>Jeringa: <strong>${mix.syringe}</strong></div>
            <div>Titulación: <strong>0.1 ml cada ${mix.titration}</strong></div>
        </div>
      </div>`;
  }
}

function renderClinicalView() {
    const el = document.getElementById("clinicalAuditLog");
    if (!el) return;
    
    const allSelected = [
        ...state.results.premedication,
        ...state.results.induction
    ];
    
    let html = `
        <div style="font-weight:bold; margin-bottom:15px; color:var(--primary-dark);">RESUMEN CLINICO DEL PROTOCOLO</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            ${allSelected.map(r => `
                <div style="padding:10px; background:#fff; border:1px solid #eee; border-radius:8px;">
                    <div style="font-weight:bold;">${r.name}</div>
                    <div style="font-size:0.8rem;">Dosis: ${r.finalDose.toFixed(2)} mg/kg | Vol: ${r.volume.toFixed(2)} ml</div>
                </div>
            `).join("")}
        </div>
    `;
    
    if (state.blockReasons.length > 0) {
        html += `
            <div style="margin-top:20px; padding:15px; background:#fff1f2; border:1px solid #fecaca; border-radius:8px;">
                <div style="font-weight:bold; color:#be123c;">ANALISIS DE RIESGO Y SEGURIDAD</div>
                <ul style="margin-top:10px; font-size:0.85rem; color:#9f1239;">
                    ${state.blockReasons.map(r => `<li>${r}</li>`).join("")}
                </ul>
            </div>
        `;
    } else {
        html += `<div style="margin-top:20px; padding:10px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:8px; text-align:center;">SISTEMA CASS: No se detectan contraindicaciones criticas para este perfil.</div>`;
    }
    
    el.innerHTML = html;
}

function renderPatientSummary() {
  const s = state.patient;
  const sp = s.species === "canine" ? "Canino" : "Felino";
  const el = document.getElementById("patientSummary");
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div>
        <strong style="display:block; font-size:0.7rem; color:#64748b;">Paciente</strong>
        <span>${s.name || "---"} (${sp}) / ${s.weight} kg</span>
      </div>
      <div>
        <strong style="display:block; font-size:0.7rem; color:#64748b;">Clinica</strong>
        <span>ASA ${s.asaStatus} / ${s.age||"---"}a / ${s.surgeryType}</span>
      </div>
      <div>
        <strong style="display:block; font-size:0.7rem; color:#64748b;">Regional</strong>
        <span>${state.regionalSummary || "No aplica"}</span>
      </div>
    </div>`;
}

function buildPhaseTable(results, title) {
  let acc = 0;
  return `
    <div class="tech-phase-block">
      <div class="tech-phase-title">${title}</div>
      <table class="tiva-table">
        <thead><tr><th>Farmaco</th><th>Dosis</th><th>Volumen</th><th>Acumulado</th></tr></thead>
        <tbody>${results.map(r => { acc += r.volume; return `<tr><td>${r.name}</td><td>${r.finalDose.toFixed(2)}</td><td><strong>${r.volume.toFixed(2)} ml</strong></td><td>${acc.toFixed(2)} ml</td></tr>` }).join("")}</tbody>
      </table>
    </div>`;
}

function showAlert(m, l) {
  const c = document.getElementById("alertContainer");
  if (!c) return;
  const a = document.createElement("div");
  a.className = "alert alert-" + l;
  a.innerHTML = "<span>" + m + "</span>";
  c.appendChild(a);
  
  safetyGuards.updatePrintStatus();
  
  setTimeout(() => {
    a.remove();
    safetyGuards.updatePrintStatus();
  }, 10000);
}
