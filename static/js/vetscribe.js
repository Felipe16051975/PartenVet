/**
 * VetScribe Professional v3.0 - PartenVet Integration
 * Motor clínico avanzado para generación de recetas y certificados.
 */

const medicationsCatalog = [
  {
    "id": "amoxicillin",
    "genericName": "Amoxicilina",
    "drugClass": "Antibiótico",
    "speciesDosage": {
      "dog": { "doseRangeMgKg": [10, 20], "frequency": "Cada 12 horas", "route": "Oral" },
      "cat": { "doseRangeMgKg": [5, 10], "frequency": "Cada 24 horas", "route": "Oral" }
    },
    "presentations": [
      { "type": "tablet", "form": "Comprimido", "strengthMg": 50 },
      { "type": "tablet", "form": "Comprimido", "strengthMg": 250 },
      { "type": "liquid", "form": "Suspensión", "concentrationMgMl": 50 }
    ],
    "notes": "Administrar con comida."
  },
  {
    "id": "meloxicam",
    "genericName": "Meloxicam",
    "drugClass": "AINE",
    "speciesDosage": {
      "dog": { "defaultDoseMgKg": 0.1, "frequency": "Cada 24 horas" },
      "cat": { "defaultDoseMgKg": 0.05, "frequency": "Cada 24 horas", "notes": "Riesgo renal alto en gatos" }
    },
    "presentations": [
      { "type": "liquid", "form": "Suspensión", "concentrationMgMl": 1.5 },
      { "type": "liquid", "form": "Suspensión", "concentrationMgMl": 0.5 }
    ],
    "notes": "Usar dosis mínima efectiva."
  },
  {
    "id": "tramadol",
    "genericName": "Tramadol",
    "drugClass": "Analgésico",
    "speciesDosage": {
      "dog": { "doseRangeMgKg": [2, 5], "frequency": "Cada 8 horas" },
      "cat": { "doseRangeMgKg": [1, 2], "frequency": "Cada 12 horas" }
    },
    "presentations": [
      { "type": "tablet", "form": "Comprimido", "strengthMg": 50 },
      { "type": "liquid", "form": "Gotas", "concentrationMgMl": 100 }
    ]
  },
  {
    "id": "enrofloxacin",
    "genericName": "Enrofloxacino",
    "drugClass": "Antibiótico",
    "speciesDosage": {
      "dog": { "doseRangeMgKg": [5, 10], "frequency": "Cada 24 horas" },
      "cat": { "doseRangeMgKg": [5, 5], "frequency": "Cada 24 horas", "notes": "Riesgo retinal" }
    },
    "presentations": [
      { "type": "tablet", "form": "Comprimido", "strengthMg": 50 },
      { "type": "tablet", "form": "Comprimido", "strengthMg": 150 }
    ]
  },
  {
    "id": "prednisolone",
    "genericName": "Prednisolona",
    "drugClass": "Corticoide",
    "speciesDosage": {
      "dog": { "doseRangeMgKg": [0.5, 1], "frequency": "Cada 24 horas" },
      "cat": { "doseRangeMgKg": [1, 2], "frequency": "Cada 24 horas" }
    },
    "presentations": [
      { "type": "tablet", "form": "Comprimido", "strengthMg": 5 },
      { "type": "tablet", "form": "Comprimido", "strengthMg": 20 }
    ]
  }
];

const templates = {
    post_op: "1. Reposo absoluto por 10 días.\n2. Uso obligatorio de collar isabelino.\n3. Limpieza de herida con Clorhexidina al 0.5% 2 veces al día.\n4. No permitir saltos ni juegos bruscos.\n5. Control de puntos en 10-12 días.",
    diet: "1. Dieta blanda (pollo hervido con arroz o alimento Gastrointestinal) por 3-5 días.\n2. Fraccionar la ración diaria en 4-5 tomas pequeñas.\n3. Agua fresca a libre disposición.\n4. Reintroducir dieta habitual de forma gradual.",
    skin: "1. No permitir lamido de la zona afectada.\n2. Aplicar tratamiento tópico indicado previo aseo quirúrgico.\n3. Evitar baños hasta nueva indicación.\n4. Mantener zona seca y ventilada."
};

const certTemplates = {
    health: "Certifico que he examinado al paciente individualizado anteriormente, encontrándolo al momento de la evaluación en BUEN ESTADO DE SALUD GENERAL, sin signos clínicos de enfermedades infectocontagiosas ni parasitarias aparentes. Se encuentra con sus vacunas y desparasitaciones al día según lo informado por su tutor.",
    travel: "Certifico que el paciente se encuentra APTO PARA EL TRASLADO nacional/internacional. Se realizó examen clínico completo no evidenciándose patologías que impidan su transporte. El ejemplar no presenta signos de enfermedades transmisibles al momento de la emisión de este documento.",
    euthanasia: "Por medio de la presente, el tutor legal autoriza y solicita la realización del procedimiento de EUTANASIA para su mascota, debido a [MOTIVO]. El médico veterinario certifica que el procedimiento se realiza bajo estrictas normas éticas y humanitarias, asegurando la ausencia de sufrimiento del paciente."
};

const state = {
    patient: { id: null, name: "", species: "canine", weight: 0, tutor: "" },
    medications: [],
    selectedMed: null
};

document.addEventListener("DOMContentLoaded", async () => {
    initEventListeners();
    updateCertContent();
    
    // 1. Cargar lista de pacientes para búsqueda manual
    await loadPacientes();
    
    // 2. BUSCAR PACIENTE ACTIVO (Core Integration)
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
            console.log("VetScribe: Cargando paciente activo:", res.data.nombre);
            loadPatientData(res.data);
        }
    } catch (e) {
        console.log("VetScribe: No hay paciente activo.");
    }
}

function loadPatientData(p) {
    state.patient = { 
        id: p.id, 
        name: p.nombre, 
        species: p.especie.toLowerCase().includes('fel') ? 'cat' : 'dog', 
        weight: p.peso_actual || 0, 
        tutor: `${p.tutor_nombres || p.tutor_nombre} ${p.tutor_apellidos || ''}`.trim()
    };
    
    document.getElementById('patientName').value = p.nombre;
    document.getElementById('species').value = p.especie;
    document.getElementById('tutorName').value = state.patient.tutor;
    
    const select = document.getElementById('pacienteSelect');
    if (select) select.value = p.id;
}

async function loadPacientes() {
    try {
        const result = await fetchAPI('/pacientes');
        const select = document.getElementById('pacienteSelect');
        if (result.success && result.data) {
            select.innerHTML = '<option value="">-- Buscar Paciente en Red PartenVet --</option>';
            result.data.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = `${p.nombre} (${p.especie}) - Tutor: ${p.tutor_nombre || p.tutor}`;
                option.dataset.paciente = JSON.stringify(p);
                select.appendChild(option);
            });
        }
    } catch (e) { console.error(e); }
}

function initEventListeners() {
    // Selección de paciente manual
    document.getElementById("pacienteSelect").addEventListener("change", e => {
        const opt = e.target.selectedOptions[0];
        if (opt && opt.value) {
            const p = JSON.parse(opt.dataset.paciente);
            loadPatientData(p);
        }
    });

    // Buscador de medicamentos
    const searchInput = document.getElementById("medSearch");
    const resultsDiv = document.getElementById("medSearchResults");
    
    searchInput.addEventListener("input", e => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) { resultsDiv.style.display = "none"; return; }
        
        const matches = medicationsCatalog.filter(m => m.genericName.toLowerCase().includes(query) || m.drugClass.toLowerCase().includes(query));
        if (matches.length > 0) {
            resultsDiv.innerHTML = matches.map(m => `<div class="search-item" data-id="${m.id}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;"><strong>${m.genericName}</strong> <small style="color:#666">${m.drugClass}</small></div>`).join("");
            resultsDiv.style.display = "block";
            
            resultsDiv.querySelectorAll(".search-item").forEach(item => {
                item.addEventListener("click", () => {
                    const med = medicationsCatalog.find(x => x.id === item.dataset.id);
                    openDoseCalculator(med);
                    resultsDiv.style.display = "none";
                    searchInput.value = "";
                });
            });
        } else { resultsDiv.style.display = "none"; }
    });

    // Calculadora
    document.getElementById("closeCalcBtn").addEventListener("click", () => { document.getElementById("doseCalculator").style.display = "none"; });
    document.getElementById("calcMgKg").addEventListener("input", updateCalcResult);
    document.getElementById("calcPresentation").addEventListener("change", updateCalcResult);
    
    document.getElementById("applyCalcBtn").addEventListener("click", () => {
        const med = state.selectedMed;
        const result = document.getElementById("calcResult").innerText;
        const pres = med.presentations[document.getElementById("calcPresentation").selectedIndex];
        
        document.getElementById("medName").value = med.genericName;
        document.getElementById("medDose").value = `${result} (${pres.form})`;
        
        const spData = med.speciesDosage[state.patient.species] || med.speciesDosage.dog;
        document.getElementById("medDuration").value = "Por 7 días";
        document.getElementById("medNote").value = med.notes || "";
        
        document.getElementById("doseCalculator").style.display = "none";
    });

    // Agregar medicamento
    document.getElementById("addMedBtn").addEventListener("click", () => {
        const name = document.getElementById("medName").value.trim();
        const dose = document.getElementById("medDose").value.trim();
        const dur = document.getElementById("medDuration").value.trim();
        const note = document.getElementById("medNote").value.trim();
        
        if (!name || !dose) { alert("Complete nombre y dosis."); return; }
        
        state.medications.push({ name, dose, dur, note });
        renderMedications();
        
        // Reset
        ["medName", "medDose", "medDuration", "medNote"].forEach(id => document.getElementById(id).value = "");
    });

    // Plantillas de recomendaciones
    document.getElementById("templateSelect").addEventListener("change", e => {
        if (e.target.value) {
            const current = document.getElementById("recommendations").value;
            document.getElementById("recommendations").value = current ? current + "\n\n" + templates[e.target.value] : templates[e.target.value];
        }
    });

    // Certificados
    document.getElementById("certType").addEventListener("change", updateCertContent);

    // Generación y Guardado
    document.getElementById("generatePdfBtn").addEventListener("click", generateProfessionalPDF);
    document.getElementById("generateCertBtn").addEventListener("click", generateCertificatePDF);
    document.getElementById("saveDocumentBtn").addEventListener("click", saveToPartenVet);
}

function openDoseCalculator(med) {
    state.selectedMed = med;
    const calc = document.getElementById("doseCalculator");
    document.getElementById("calcMedName").innerText = med.genericName;
    
    const spData = med.speciesDosage[state.patient.species] || med.speciesDosage.dog;
    document.getElementById("calcMgKg").value = spData.defaultDoseMgKg || (spData.doseRangeMgKg ? spData.doseRangeMgKg[0] : 0);
    
    const presSelect = document.getElementById("calcPresentation");
    presSelect.innerHTML = med.presentations.map((p, i) => `<option value="${i}">${p.form} - ${p.strengthMg || p.concentrationMgMl} ${p.strengthMg ? 'mg' : 'mg/ml'}</option>`).join("");
    
    calc.style.display = "block";
    updateCalcResult();
}

function updateCalcResult() {
    if (!state.selectedMed || !state.patient.weight) return;
    
    const mgKg = parseFloat(document.getElementById("calcMgKg").value);
    const pres = state.selectedMed.presentations[document.getElementById("calcPresentation").value];
    const weight = state.patient.weight;
    
    const totalMg = mgKg * weight;
    let result = "";
    
    if (pres.strengthMg) {
        const count = totalMg / pres.strengthMg;
        result = count.toFixed(2) + " comp";
    } else if (pres.concentrationMgMl) {
        const ml = totalMg / pres.concentrationMgMl;
        result = ml.toFixed(2) + " ml";
    }
    
    document.getElementById("calcResult").innerText = result;
}

function renderMedications() {
    const list = document.getElementById("medList");
    const container = document.getElementById("prescriptionContainer");
    list.innerHTML = "";
    
    if (state.medications.length === 0) { container.style.display = "none"; return; }
    container.style.display = "block";
    
    state.medications.forEach((m, i) => {
        const li = document.createElement("li");
        li.className = "prescription-item";
        li.innerHTML = `
            <div style="flex:1">
                <div style="font-weight:700; color:#1e293b;">${m.name}</div>
                <div style="font-size:0.85rem; color:#64748b;">${m.dose} · ${m.dur}</div>
                ${m.note ? `<div style="font-size:0.8rem; color:#0d9488; font-style:italic;">Nota: ${m.note}</div>` : ""}
            </div>
            <button class="remove-btn" onclick="removeMed(${i})">✕</button>
        `;
        list.appendChild(li);
    });
}

window.removeMed = function(i) {
    state.medications.splice(i, 1);
    renderMedications();
};

function updateCertContent() {
    const type = document.getElementById("certType").value;
    if (type !== "custom") {
        document.getElementById("certContent").value = certTemplates[type] || "";
    }
}

async function generateProfessionalPDF() {
    const patientNameVal = document.getElementById("patientName").value.trim();
    const speciesVal = document.getElementById("species").value.trim();
    const tutorNameVal = document.getElementById("tutorName").value.trim();

    if (!patientNameVal) { alert("Por favor, ingrese el nombre del paciente o seleccione uno."); return; }
    if (state.medications.length === 0) { alert("Agregue al menos un medicamento a la receta."); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    
    // --- ESTILO PROFESIONAL ---
    // Cabecera con barra azul
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("RECETA MEDICA", margin, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PartenVet Clinical System · Medicina Veterinaria de Alta Precisión", margin, 32);
    
    // Datos del Paciente y Tutor
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    let y = 50;
    
    doc.setDrawColor(230);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, 170, 25, "F");
    doc.rect(margin, y, 170, 25, "S");
    
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("PACIENTE:", margin + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${patientNameVal} (${speciesVal}) · ${state.patient.weight || 0} kg`, margin + 35, y);
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("TUTOR:", margin + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${tutorNameVal}`, margin + 35, y);
    
    y = 85;
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text("Rx", margin, y);
    
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    state.medications.forEach((m, i) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}. ${m.name}`, margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`   Dosis: ${m.dose} · ${m.dur}`, margin, y);
        y += 5;
        if (m.note) {
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`   Nota: ${m.note}`, margin, y);
            doc.setFontSize(11);
            doc.setTextColor(0);
            y += 5;
        }
        y += 5;
        
        if (y > 220) { doc.addPage(); y = 20; }
    });
    
    // Recomendaciones
    const recs = document.getElementById("recommendations").value.trim();
    if (recs) {
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.text("INDICACIONES DE MANEJO:", margin, y);
        y += 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitRecs = doc.splitTextToSize(recs, 170);
        doc.text(splitRecs, margin, y);
        y += (splitRecs.length * 5) + 5;
    }
    
    // Cita
    const citaDate = document.getElementById("followUpDate").value;
    if (citaDate) {
        const reason = document.getElementById("followUpReason").value || "Control Médico";
        doc.setFillColor(239, 246, 255);
        doc.rect(margin, y, 170, 15, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 78, 216);
        doc.text(`PRÓXIMO CONTROL: ${citaDate} · Motivo: ${reason}`, margin + 5, y + 9);
    }
    
    // Firma y Pie
    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text("Documento electrónico generado por PartenVet. La validez clínica depende de la firma y timbre del profesional responsable.", 105, 285, { align: "center" });
    
    doc.save(`Receta_${state.patient.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

async function generateCertificatePDF() {
    const patientNameVal = document.getElementById("patientName").value.trim();
    const speciesVal = document.getElementById("species").value.trim();
    const tutorNameVal = document.getElementById("tutorName").value.trim();
    const content = document.getElementById("certContent").value.trim();

    if (!patientNameVal) { alert("Por favor, ingrese el nombre del paciente o seleccione uno."); return; }
    if (!content) { alert("El cuerpo del certificado está vacío."); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 25;
    
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CERTIFICADO MEDICO VETERINARIO", 105, 25, { align: "center" });
    
    doc.setTextColor(50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    let y = 60;
    
    doc.text(`A QUIEN CORRESPONDA:`, margin, y);
    y += 15;
    
    const intro = `Por la presente certifico que el paciente ${patientNameVal}, especie ${speciesVal}, de propiedad de don/doña ${tutorNameVal}, ha sido evaluado clínicamente en nuestras dependencias.`;
    const splitIntro = doc.splitTextToSize(intro, 160);
    doc.text(splitIntro, margin, y);
    y += (splitIntro.length * 7) + 5;
    
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVACIONES CLÍNICAS:", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    const splitContent = doc.splitTextToSize(content, 160);
    doc.text(splitContent, margin, y);
    
    doc.text(`Emitido en Santiago, a fecha: ${new Date().toLocaleDateString()}`, margin, 240);
    doc.line(120, 260, 180, 260);
    doc.text("Firma Médico Veterinario", 150, 265, { align: "center" });
    
    doc.save(`Certificado_${state.patient.name.replace(/\s+/g, '_')}.pdf`);
}

async function saveToPartenVet() {
    if (!state.patient.id || state.medications.length === 0) {
        alert("Por favor, seleccione un paciente de la base de datos y agregue medicamentos a la receta.");
        return;
    }
    
    const btn = document.getElementById("saveDocumentBtn");
    btn.disabled = true;
    btn.innerText = "Guardando...";
    
    try {
        const res = await fetchAPI('/documentos', {
            method: 'POST',
            body: JSON.stringify({
                paciente_id: state.patient.id,
                tipo_documento: 'Receta',
                contenido_json: {
                    medications: state.medications,
                    recommendations: document.getElementById("recommendations").value,
                    followUp: {
                        date: document.getElementById("followUpDate").value,
                        reason: document.getElementById("followUpReason").value
                    }
                }
            })
        });
        
        if (res.success) {
            alert("Documento guardado en el historial clínico.");
            state.medications = [];
            renderMedications();
            document.getElementById("recommendations").value = "";
        }
    } catch (e) { console.error(e); }
    finally {
        btn.disabled = false;
        btn.innerText = "💾 Guardar en Historial";
    }
}
