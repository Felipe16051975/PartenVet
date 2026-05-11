/**
 * auth.js - Manejo de inicio de sesión y validaciones
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const correo = document.getElementById('correo').value.trim();
            const password = document.getElementById('password').value.trim();
            
            // Validaciones frontend básicas
            let isValid = true;
            
            if (!correo) {
                document.getElementById('correoError').textContent = 'El correo es obligatorio';
                isValid = false;
            } else {
                document.getElementById('correoError').textContent = '';
            }
            
            if (!password) {
                document.getElementById('passwordError').textContent = 'La contraseña es obligatoria';
                isValid = false;
            } else {
                document.getElementById('passwordError').textContent = '';
            }
            
            if (!isValid) return;
            
            // Petición al backend
            const btn = document.getElementById('loginBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Autenticando...';
            btn.disabled = true;
            
            try {
                const response = await fetchAPI('/login', {
                    method: 'POST',
                    body: JSON.stringify({ correo, password })
                });
                
                if (response.success) {
                    // Guardar info básica en localStorage
                    localStorage.setItem('partenvet_token', 'token_simulado'); // Simulación de JWT
                    localStorage.setItem('partenvet_user', JSON.stringify(response.usuario));
                    
                    // Redirigir al dashboard
                    window.location.href = '/dashboard';
                }
            } catch (error) {
                // Mostrar error general
                document.getElementById('passwordError').textContent = error.message || 'Error al iniciar sesión';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
});
