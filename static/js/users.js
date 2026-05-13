/**
 * users.js — Lógica para la gestión de usuarios del sistema
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const tableBody = document.getElementById('usersTableBody');
    const createSection = document.getElementById('createUserSection');
    const showCreateBtn = document.getElementById('showCreateFormBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createForm = document.getElementById('createUserForm');
    const formMessage = document.getElementById('formMessage');
    const roleSelect = document.getElementById('userRole');

    // Inicializar
    if (tableBody) {
        loadUsers();
        loadRoles();
    }

    // Toggle formulario
    if (showCreateBtn && createSection) {
        showCreateBtn.addEventListener('click', () => {
            createSection.style.display = 'block';
            showCreateBtn.style.display = 'none';
        });
    }

    if (cancelCreateBtn && createSection) {
        cancelCreateBtn.addEventListener('click', () => {
            createSection.style.display = 'none';
            showCreateBtn.style.display = 'block';
            createForm.reset();
            formMessage.style.display = 'none';
        });
    }

    // Cargar Roles para el select
    async function loadRoles() {
        try {
            const res = await fetchAPI('/roles');
            if (res.success) {
                roleSelect.innerHTML = '<option value="">-- Seleccione un Rol --</option>';
                res.data.forEach(r => {
                    const option = document.createElement('option');
                    option.value = r.id;
                    option.textContent = r.nombre;
                    roleSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error cargando roles:", error);
            roleSelect.innerHTML = '<option value="">Error al cargar roles</option>';
        }
    }

    // Cargar Lista de Usuarios
    async function loadUsers() {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando usuarios...</td></tr>';
        try {
            const res = await fetchAPI('/usuarios');
            if (res.success && res.data.length > 0) {
                renderUsers(res.data);
            } else {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay usuarios registrados.</td></tr>';
            }
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error al cargar usuarios: ${error.message}</td></tr>`;
        }
    }

    function renderUsers(users) {
        tableBody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${u.id}</td>
                <td><strong>${u.nombre}</strong></td>
                <td>${u.correo}</td>
                <td><span style="background: #e2e8f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${u.rol}</span></td>
                <td>
                    <span style="color: ${u.estado === 'activo' ? '#059669' : '#dc2626'}; font-weight: 500;">
                        ${u.estado.toUpperCase()}
                    </span>
                </td>
                <td>
                    <button onclick="deleteUser(${u.id}, '${u.nombre}')" class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: #ef4444; border: none; color: white; cursor: pointer; border-radius: 4px;">Eliminar</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Crear Usuario
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('saveUserBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';
            
            const data = {
                nombre: document.getElementById('userName').value.trim(),
                correo: document.getElementById('userEmail').value.trim(),
                password: document.getElementById('userPassword').value,
                role: document.getElementById('userRole').value
            };

            try {
                const res = await fetchAPI('/usuarios', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });

                if (res.success) {
                    showMessage(res.message, 'success');
                    createForm.reset();
                    loadUsers();
                    setTimeout(() => {
                        createSection.style.display = 'none';
                        showCreateBtn.style.display = 'block';
                        formMessage.style.display = 'none';
                    }, 2000);
                }
            } catch (error) {
                showMessage(error.message || 'Error al crear usuario', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Guardar Usuario';
            }
        });
    }

    function showMessage(msg, type) {
        formMessage.textContent = msg;
        formMessage.style.display = 'block';
        if (type === 'success') {
            formMessage.style.backgroundColor = '#d1fae5';
            formMessage.style.color = '#065f46';
            formMessage.style.border = '1px solid #10b981';
        } else {
            formMessage.style.backgroundColor = '#fee2e2';
            formMessage.style.color = '#b91c1c';
            formMessage.style.border = '1px solid #ef4444';
        }
    }

    // Eliminar Usuario (Global para onclick)
    window.deleteUser = async function(id, nombre) {
        if (!confirm(`¿Estás seguro de que deseas eliminar al usuario ${nombre}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const res = await fetchAPI(`/usuarios/${id}`, {
                method: 'DELETE'
            });
            
            if (res.success) {
                alert(res.message);
                loadUsers();
            }
        } catch (error) {
            alert(error.message || 'Error al eliminar usuario');
        }
    };
});
