// public/script.js

// --- FUNCIONES AUXILIARES GLOBALES ---
function escapeHtmlForGlobalUI(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    // Corregido para usar las entidades HTML correctas, importante para seguridad y visualización.
    return String(unsafe)
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, ".")
         .replace(/'/g, "'");
}

// --- FUNCIÓN GLOBAL PARA ACTUALIZAR LA UI DEL USUARIO (SIDEBAR, HEADER) ---
window.updateGlobalUserUI = function(userDataObject) { // Renombrado parámetro para claridad
    const sidebarProfileInfoDiv = document.getElementById('sidebarProfileInfo');
    const sidebarProfilePicImg = document.getElementById('sidebarProfilePic');
    const sidebarProfileNameSpan = document.getElementById('sidebarProfileName');
    const loggedInUserNameSpanHeader = document.getElementById('loggedInUserName');
    const userInfoAreaHeader = document.getElementById('userInfoArea');
    const sidebarLogoutButtonGlobal = document.getElementById('sidebarLogoutButton');
    const headerSearchContainerGlobal = document.getElementById('headerSearchContainer');

    if (userDataObject && userDataObject.userId) {
        if (sidebarProfileInfoDiv) sidebarProfileInfoDiv.style.display = 'flex';
        if (sidebarProfilePicImg) {
            sidebarProfilePicImg.src = userDataObject.profilePhotoPath ? `/${userDataObject.profilePhotoPath}` : 'placeholder-profile.jpg'; // Corregido placeholder
            sidebarProfilePicImg.alt = `Foto de ${escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario'}`;
        }
        if (sidebarProfileNameSpan) {
            sidebarProfileNameSpan.textContent = escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario';
        }
        if (loggedInUserNameSpanHeader) {
             loggedInUserNameSpanHeader.textContent = `${escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario'}`;
        }
        if (userInfoAreaHeader) userInfoAreaHeader.style.display = 'flex';
        if (sidebarLogoutButtonGlobal) sidebarLogoutButtonGlobal.style.display = 'flex';
        if (headerSearchContainerGlobal) headerSearchContainerGlobal.style.display = 'flex';
    } else {
        if (sidebarProfileInfoDiv) sidebarProfileInfoDiv.style.display = 'none';
        if (sidebarProfilePicImg) sidebarProfilePicImg.src = 'placeholder-profile.jpg'; // Corregido placeholder
        if (sidebarProfileNameSpan) sidebarProfileNameSpan.textContent = 'Usuario';
        if (loggedInUserNameSpanHeader) loggedInUserNameSpanHeader.textContent = '';
        if (userInfoAreaHeader) userInfoAreaHeader.style.display = 'none';
        if (sidebarLogoutButtonGlobal) sidebarLogoutButtonGlobal.style.display = 'none';
        if (headerSearchContainerGlobal) headerSearchContainerGlobal.style.display = 'none';
    }
};

// --- LISTENER PARA EL EVENTO 'storage' ---
window.addEventListener('storage', function(event) {
    if (event.key === 'loggedInUser') {
        console.log('Evento storage detectado para loggedInUser:', event.key);
        if (event.newValue) {
            try {
                const updatedUser = JSON.parse(event.newValue);
                if (updatedUser && updatedUser.userId) {
                    window.updateGlobalUserUI(updatedUser);
                } else {
                     window.updateGlobalUserUI(null);
                }
            } catch (e) {
                console.error("Error procesando evento de storage (newValue):", e);
                window.updateGlobalUserUI(null);
            }
        } else {
            console.log('loggedInUser eliminado de localStorage (logout en otra pestaña).');
            window.updateGlobalUserUI(null);
            const loginSect = document.getElementById('login-section');
            const mainCont = document.getElementById('main-content');
            if (loginSect) loginSect.style.display = 'block';
            if (mainCont) mainCont.style.display = 'none';
        }
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api';
    const FRONTEND_MONEY_SYMBOL = '💰';

    const loginSection = document.getElementById('login-section');
    const loginPhoneNumberInput = document.getElementById('loginPhoneNumber');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginButton = document.getElementById('loginButton');
    const loginMessageDiv = document.getElementById('loginMessage');
    const mainContentDiv = document.getElementById('main-content');
    const millonariosListDiv = document.getElementById('millonariosList');
    const headerUserIdInput = document.getElementById('headerUserIdInput');
    const headerSearchUserButton = document.getElementById('headerSearchUserButton');
    const sidebarProfileInfoDiv = document.getElementById('sidebarProfileInfo');
    const sidebarLogoutButton = document.getElementById('sidebarLogoutButton'); // Definido aquí para su listener
    const userInfoArea = document.getElementById('userInfoArea'); // Para mostrar/ocultar en login/logout
    const headerSearchContainer = document.getElementById('headerSearchContainer'); // Para mostrar/ocultar

    function showLogin() {
        if (loginSection) loginSection.style.display = 'block';
        if (mainContentDiv) mainContentDiv.style.display = 'none';
        window.updateGlobalUserUI(null);
        localStorage.removeItem('loggedInUser');
        // Asegurar que los elementos del header que dependen del login también se oculten
        if (userInfoArea) userInfoArea.style.display = 'none';
        if (sidebarLogoutButton) sidebarLogoutButton.style.display = 'none';
        if (headerSearchContainer) headerSearchContainer.style.display = 'none';
    }

    // CORREGIDO: El parámetro se llama 'userObjectReceived'
    async function showMainContent(userObjectReceived) { 
        // CORREGIDO: Usar el nombre del parámetro 'userObjectReceived' consistentemente
        if (!userObjectReceived || !userObjectReceived.userId) { 
            console.error("showMainContent llamado sin datos de usuario válidos.");
            showLogin();
            return;
        }

        if (loginSection) loginSection.style.display = 'none';
        if (mainContentDiv) mainContentDiv.style.display = 'block';
        
        window.updateGlobalUserUI(userObjectReceived); 
        
        localStorage.setItem('loggedInUser', JSON.stringify(userObjectReceived));

        if (millonariosListDiv) {
            await loadMillonarios();
        }
    }

    const storedUserString = localStorage.getItem('loggedInUser');
    if (storedUserString) {
        try {
            const parsedUser = JSON.parse(storedUserString);
            if (parsedUser && parsedUser.userId) {
                showMainContent(parsedUser);
            } else {
                console.warn("Datos de usuario en localStorage no válidos al cargar página.");
                showLogin();
            }
        } catch (e) {
            console.error("Error parseando storedUser al cargar página:", e);
            showLogin();
        }
    } else {
        showLogin();
    }

    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            const phoneNumber = loginPhoneNumberInput.value.trim();
            const password = loginPasswordInput.value.trim();
            if (!phoneNumber || !password) {
                loginMessageDiv.textContent = 'Por favor, ingresa número y contraseña.';
                loginMessageDiv.className = 'message-area error visible';
                return;
            }
            loginMessageDiv.textContent = 'Iniciando sesión...';
            loginMessageDiv.className = 'message-area visible';
            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber, password }),
                });
                const data = await response.json();
                if (response.ok && data.user) {
                    loginMessageDiv.textContent = data.message;
                    loginMessageDiv.className = 'message-area success visible';
                    await showMainContent(data.user);
                } else {
                    loginMessageDiv.textContent = data.message || 'Error al iniciar sesión.';
                    loginMessageDiv.className = 'message-area error visible';
                }
            } catch (error) { 
                console.error('Error en login:', error);
                loginMessageDiv.textContent = 'Error de conexión al intentar iniciar sesión.';
                loginMessageDiv.className = 'message-area error visible';
            }
        });
    }

    if (sidebarLogoutButton) {
        sidebarLogoutButton.addEventListener('click', () => {
            showLogin();
        });
    }
    
    if (sidebarProfileInfoDiv) {
        sidebarProfileInfoDiv.addEventListener('click', () => {
            const currentPath = window.location.pathname.split('/').pop();
            const urlParams = new URLSearchParams(window.location.search);
            const queryUserId = urlParams.get('id');
            let localLoggedInUserId = null;
            const localStoredUser = localStorage.getItem('loggedInUser');
            if(localStoredUser) {
                try { localLoggedInUserId = JSON.parse(localStoredUser).userId; } catch(e) {}
            }

            if (currentPath === 'profile.html' && (!queryUserId || queryUserId === localLoggedInUserId) && localLoggedInUserId) {
                sidebarProfileInfoDiv.style.transform = 'scale(0.98)';
                setTimeout(() => sidebarProfileInfoDiv.style.transform = 'scale(1)', 150);
            } else {
                window.location.href = 'profile.html';
            }
        });
        sidebarProfileInfoDiv.style.cursor = 'pointer';
    }

    async function loadMillonarios() {
        if (!millonariosListDiv) return;
        millonariosListDiv.innerHTML = '<p>Cargando millonarios...</p>';
        try {
            const response = await fetch(`${API_BASE_URL}/user/ranking/millonarios?limit=10`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error HTTP: ${response.status} - ${errorText || response.statusText}`);
            }
            const users = await response.json();
            if (!users || users.length === 0) {
                millonariosListDiv.innerHTML = '<p>No hay millonarios para mostrar.</p>';
                return;
            }
            let tableHTML = '<table><thead><tr><th>#</th><th>Nombre</th><th>Dinero Total</th></tr></thead><tbody>';
            users.forEach((user, index) => {
                let medal = '';
                if (index === 0) medal = '🥇'; else if (index === 1) medal = '🥈'; else if (index === 2) medal = '🥉'; else medal = `${index + 1}.`;
                tableHTML += `<tr><td>${medal}</td><td>${escapeHtmlForGlobalUI(user.pushname) || 'N/A'}</td><td>${FRONTEND_MONEY_SYMBOL}${(user.totalMoney || 0).toLocaleString()}</td></tr>`;
            });
            tableHTML += '</tbody></table>';
            millonariosListDiv.innerHTML = tableHTML;
        } catch (error) {
            console.error('Error cargando millonarios (catch block):', error);
            millonariosListDiv.innerHTML = `<p class="error">Error al cargar los datos de millonarios: ${error.message}</p>`;
        }
    }

    function searchUserHandlerFromHeader() {
        if (!headerUserIdInput) return;
        const query = headerUserIdInput.value.trim();
        if (!query) {
            if (headerUserIdInput.placeholder) {
                 const originalPlaceholder = headerUserIdInput.placeholder;
                 headerUserIdInput.placeholder = "¡Escribe algo para buscar!";
                 headerUserIdInput.classList.add('input-error-pulse');
                 setTimeout(() => {
                    headerUserIdInput.placeholder = originalPlaceholder;
                    headerUserIdInput.classList.remove('input-error-pulse');
                 }, 2000);
            }
            headerUserIdInput.focus();
            return;
        }
        window.location.href = `search-results.html?q=${encodeURIComponent(query)}`;
    }
    
    if (headerSearchUserButton && headerUserIdInput) {
        headerSearchUserButton.addEventListener('click', searchUserHandlerFromHeader);
        headerUserIdInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); searchUserHandlerFromHeader(); }
        });
    }

    function formatTimestamp(timestamp) {
        if (!timestamp || timestamp === 0) return 'Nunca';
        try {
            return new Date(timestamp).toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        } catch (e) { return 'Fecha inválida'; }
    }
    
    const menuToggleButton = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const pageOverlay = document.getElementById('pageOverlay');

    if (menuToggleButton && sidebar && pageOverlay) {
        menuToggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            sidebar.classList.toggle('open');
            pageOverlay.classList.toggle('visible', sidebar.classList.contains('open'));
            document.body.classList.toggle('sidebar-open-no-scroll', sidebar.classList.contains('open'));
        });
        pageOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            pageOverlay.classList.remove('visible');
            document.body.classList.remove('sidebar-open-no-scroll');
        });
        sidebar.addEventListener('click', (event) => {
            event.stopPropagation();
            const targetLink = event.target.closest('a');
            if (window.innerWidth <= 768 && targetLink && !targetLink.hasAttribute('data-noclose')) {
                sidebar.classList.remove('open');
                pageOverlay.classList.remove('visible');
                document.body.classList.remove('sidebar-open-no-scroll');
            }
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                if(pageOverlay) pageOverlay.classList.remove('visible');
                document.body.classList.remove('sidebar-open-no-scroll');
            }
            // Cerrar otros modales si están abiertos
            const followModal = document.getElementById('followListModal');
            const imageModal = document.getElementById('imageEditModal');
            if (followModal && followModal.classList.contains('visible')) {
                // Asumiendo que tienes una función closeModal para este modal, similar a la de profile.js
                // o llama a la lógica directamente:
                followModal.classList.remove('visible');
                document.body.classList.remove('modal-open-no-scroll'); // Si este modal también bloquea scroll
                setTimeout(() => { if (!followModal.classList.contains('visible')) followModal.style.display = 'none'; }, 300);
            }
            if (imageModal && imageModal.classList.contains('visible')) {
                imageModal.classList.remove('visible');
                document.body.classList.remove('modal-open-no-scroll');
                setTimeout(() => { if (!imageModal.classList.contains('visible')) imageModal.style.display = 'none'; }, 300);
            }
        }
    });

});