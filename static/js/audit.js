/**
 * PartenVet - Auditoría de Sistema
 * Maneja la carga y renderizado de logs de seguridad.
 */

document.addEventListener('DOMContentLoaded', () => {
    loadAuditLogs();
});

async function loadAuditLogs() {
    const tableBody = document.getElementById('auditTableBody');
    
    try {
        const response = await fetch('/api/logs');
        const result = await response.json();
        
        if (result.success) {
            renderLogs(result.logs);
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="error-cell">Error: ${result.message}</td></tr>`;
        }
    } catch (error) {
        console.error('Error cargando logs:', error);
        tableBody.innerHTML = '<tr><td colspan="5" class="error-cell">Error de conexión con el servidor</td></tr>';
    }
}

function renderLogs(logs) {
    const tableBody = document.getElementById('auditTableBody');
    
    if (!logs || logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No hay registros de auditoría disponibles</td></tr>';
        return;
    }
    
    tableBody.innerHTML = logs.map(log => {
        const badgeClass = getBadgeClass(log.accion);
        const fecha = formatDateTime(log.created_at);
        const usuario = log.usuario_nombre || '<span class="text-muted">Sistema</span>';
        
        return `
            <tr>
                <td><strong>${fecha}</strong></td>
                <td>${usuario}</td>
                <td><span class="event-badge ${badgeClass}">${log.accion}</span></td>
                <td><span class="module-tag">${log.descripcion}</span></td>
                <td><span class="ip-text">${log.ip_origen || 'N/A'}</span></td>
            </tr>
        `;
    }).join('');
}

function getBadgeClass(action) {
    const successActions = [
        'LOGIN_SUCCESS', 'INICIO_SESION', 'SAVE_PATIENT', 'UPDATE_PATIENT',
        'SAVE_PROTOCOL', 'GEN_PDF', 'DB_BACKUP', 'CREATE_USER', 'UPDATE_USER'
    ];
    const errorActions = [
        'LOGIN_FALLIDO', 'LOGIN_FAILED', 'ACCESS_DENIED', 'ERROR_SQL',
        'DELETE_USER', 'DELETE_PATIENT'
    ];
    const warningActions = ['DB_RESTORE', 'UPDATE_CONFIG'];
    
    if (successActions.includes(action)) return 'badge-success';
    if (errorActions.includes(action)) return 'badge-error';
    if (warningActions.includes(action)) return 'badge-warning';
    return 'badge-info';
}

function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    // Asumiendo formato ISO o similar de la DB
    const date = new Date(dateStr);
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
