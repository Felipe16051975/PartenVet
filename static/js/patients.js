/**
 * patients.js — Listado, registro y edición de pacientes
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Listado ---

    const tableBody   = document.getElementById('patientsTableBody');
    const searchBtn   = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (tableBody) {
        loadPatients();

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => loadPatients(searchInput.value.trim()));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') loadPatients(searchInput.value.trim());
            });
        }
    }

    async function loadPatients(query = '') {
        tableBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        try {
            const url = query ? `/pacientes?q=${encodeURIComponent(query)}` : '/pacientes';
            const res  = await fetchAPI(url);
            if (res.success && res.data.length > 0) {
                renderPatients(res.data);
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se encontraron pacientes.</td></tr>';
            }
        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center;">Error: ${err.message}</td></tr>`;
        }
    }

    function renderPatients(patients) {
        const userInfo = JSON.parse(localStorage.getItem('partenvet_user') || '{}');
        const isAdmin = userInfo.role === 'admin';
        
        tableBody.innerHTML = '';
        patients.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${p.id}</td>
                <td><strong>${p.nombre}</strong><br><small>${p.especie}</small></td>
                <td>${p.raza || 'N/A'}<br><small>${p.peso_actual || '?'} kg</small></td>
                <td>${p.tutor_nombre} ${p.tutor_apellidos}</td>
                <td class="action-links">
                    <button onclick="selectPatient(${p.id}, '${p.nombre}')" class="btn-primary" style="padding:0.4rem 0.8rem;font-size:0.8rem;margin-bottom:0.3rem;width:100%;">⚡ Iniciar Consulta</button>
                    <div style="display:flex;gap:0.2rem;margin-bottom:0.3rem;">
                        <a href="/pacientes/${p.id}/perfil" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex:1;text-align:center;background:var(--primary-color);color:white;border:none;">Ver Historial</a>
                    </div>
                    ${isAdmin ? `
                    <div style="display:flex;gap:0.2rem;margin-bottom:0.3rem;">
                        <a href="/vetscribe?paciente_id=${p.id}" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex:1;text-align:center;">VetScribe</a>
                        <a href="/safe-anesthesia?paciente_id=${p.id}" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex:1;text-align:center;">SafeAnesth</a>
                    </div>
                    ` : ''}
                    <div style="display:flex;gap:0.2rem;">
                        <button onclick="editPatient(${p.id})" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex:1;background:#94a3b8;">Editar</button>
                        <button onclick="deletePatient(${p.id}, '${p.nombre}')" class="btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;flex:1;background:#f87171;color:white;">Eliminar</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    window.selectPatient = async function(id, nombre) {
        try {
            const res = await fetchAPI(`/paciente-activo/${id}`, { method: 'POST' });
            if (res.success) {
                alert(`Paciente ${nombre} seleccionado.`);
                window.location.href = '/dashboard';
            }
        } catch (e) {
            alert('Error al seleccionar paciente: ' + e.message);
        }
    };

    window.editPatient = function(id) {
        window.location.href = `/pacientes/nuevo?edit_id=${id}`;
    };

    window.deletePatient = async function(id, nombre) {
        if (!confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetchAPI(`/pacientes/${id}`, { method: 'DELETE' });
            if (res.success) {
                alert(res.message);
                loadPatients();
            }
        } catch (e) {
            alert('Error al eliminar: ' + e.message);
        }
    };


    // --- Registro / Edición ---

    const registerForm = document.getElementById('registerPatientForm');
    const urlParams    = new URLSearchParams(window.location.search);
    const editId       = urlParams.get('edit_id');

    if (registerForm) {
        if (editId) {
            const h2 = document.querySelector('h2');
            if (h2) h2.textContent = 'Editar Paciente';
            loadPatientData(editId);
        }

        async function loadPatientData(id) {
            try {
                const res = await fetchAPI(`/pacientes/${id}`);
                if (!res.success) return;
                const p = res.data;
                document.getElementById('rut').value              = p.rut_dni || '';
                document.getElementById('nombre_tutor').value     = p.tutor_nombres || '';
                document.getElementById('apellidos_tutor').value  = p.tutor_apellidos || '';
                document.getElementById('telefono_tutor').value   = p.tutor_telefono || '';
                document.getElementById('correo_tutor').value     = p.tutor_correo || '';
                document.getElementById('direccion_tutor').value  = p.tutor_direccion || '';
                document.getElementById('nombre_paciente').value  = p.nombre || '';
                document.getElementById('especie').value          = p.especie || '';
                document.getElementById('raza').value             = p.raza || '';
                document.getElementById('sexo').value             = p.sexo || 'M';
                document.getElementById('peso').value             = p.peso_actual || 0;
                document.getElementById('fecha_nacimiento').value = p.fecha_nacimiento || '';
            } catch (e) {
                console.error('Error al cargar paciente:', e);
            }
        }

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const msgBox = document.getElementById('formMessage');
            msgBox.className = 'form-message';

            const data = {
                rut_tutor:        document.getElementById('rut').value.trim(),
                nombres_tutor:    document.getElementById('nombre_tutor').value.trim(),
                apellidos_tutor:  document.getElementById('apellidos_tutor').value.trim(),
                telefono_tutor:   document.getElementById('telefono_tutor').value.trim(),
                correo_tutor:     document.getElementById('correo_tutor').value.trim(),
                direccion_tutor:  document.getElementById('direccion_tutor').value.trim(),
                nombre_paciente:  document.getElementById('nombre_paciente').value.trim(),
                especie:          document.getElementById('especie').value,
                raza:             document.getElementById('raza').value.trim(),
                sexo:             document.getElementById('sexo').value,
                peso:             document.getElementById('peso').value,
                fecha_nacimiento: document.getElementById('fecha_nacimiento').value || null
            };

            const btn = document.getElementById('savePatientBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Guardando...';
            btn.disabled = true;

            try {
                const url    = editId ? `/pacientes/${editId}` : '/pacientes';
                const method = editId ? 'PUT' : 'POST';
                const res    = await fetchAPI(url, { method, body: JSON.stringify(data) });

                if (res.success) {
                    msgBox.textContent = editId ? 'Cambios guardados.' : 'Paciente registrado.';
                    msgBox.classList.add('success');
                    setTimeout(() => { window.location.href = '/pacientes'; }, 1500);
                }
            } catch (err) {
                msgBox.textContent = err.message || 'Error al guardar.';
                msgBox.classList.add('error');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});
