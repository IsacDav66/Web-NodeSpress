// public/script.js

// --- FUNCIONES AUXILIARES GLOBALES ---
function escapeHtmlForGlobalUI(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe)
         .replace(/&/g, "&") // Corregido para entidades HTML correctas
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, ".")
         .replace(/'/g, "'"); // O '
}

// --- FUNCIÓN GLOBAL PARA ACTUALIZAR LA UI DEL USUARIO (SIDEBAR, HEADER) ---
window.updateGlobalUserUI = function(userDataObject) {
    const pagePath = window.location.pathname;
    // Loguear una copia para evitar problemas si el objeto se modifica después
    console.log(`[updateGlobalUserUI en ${pagePath}] Llamada con userDataObject:`, userDataObject ? JSON.parse(JSON.stringify(userDataObject)) : null);

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
            // La ruta ya debería venir con ?v=... de localStorage si se actualizó la imagen
            // El prefijo '/' es importante si profilePhotoPath no lo incluye.
            const newSrc = userDataObject.profilePhotoPath
                ? (userDataObject.profilePhotoPath.startsWith('/') ? userDataObject.profilePhotoPath : `/${userDataObject.profilePhotoPath}`)
                : 'placeholder-profile.jpg';

            console.log(`[updateGlobalUserUI en ${pagePath}] Intentando establecer src de sidebarProfilePicImg a: ${newSrc}`);
            sidebarProfilePicImg.src = newSrc;
            sidebarProfilePicImg.alt = `Foto de ${escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario'}`;
            console.log(`[updateGlobalUserUI en ${pagePath}] src de sidebarProfilePicImg DESPUÉS de setear: ${sidebarProfilePicImg.src}`);
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
        // Lógica para cuando no hay usuario (logout o carga inicial sin sesión)
        if (sidebarProfileInfoDiv) sidebarProfileInfoDiv.style.display = 'none';
        if (sidebarProfilePicImg) {
            console.log(`[updateGlobalUserUI en ${pagePath}] Seteando sidebarProfilePicImg a placeholder (no userDataObject).`);
            sidebarProfilePicImg.src = 'placeholder-profile.jpg';
            sidebarProfilePicImg.alt = 'Foto de perfil';
        }
        if (sidebarProfileNameSpan) sidebarProfileNameSpan.textContent = 'Usuario';
        if (loggedInUserNameSpanHeader) loggedInUserNameSpanHeader.textContent = '';
        if (userInfoAreaHeader) userInfoAreaHeader.style.display = 'none';
        if (sidebarLogoutButtonGlobal) sidebarLogoutButtonGlobal.style.display = 'none';
        if (headerSearchContainerGlobal) headerSearchContainerGlobal.style.display = 'none';
    }
};

// --- LISTENER PARA EL EVENTO 'storage' (CAMBIOS EN LOCALSTORAGE DESDE OTRAS PESTAÑAS) ---
window.addEventListener('storage', function(event) {
    if (event.key === 'loggedInUser') {
        const pagePath = window.location.pathname;
        // Loguear solo una parte del string si es muy largo
        const newV = event.newValue ? (event.newValue.length > 150 ? event.newValue.substring(0, 150) + '...' : event.newValue) : 'null';
        const oldV = event.oldValue ? (event.oldValue.length > 150 ? event.oldValue.substring(0, 150) + '...' : event.oldValue) : 'null';
        console.log(`[Storage Event en ${pagePath}] Clave: ${event.key}, Valor Nuevo: ${newV}, Valor Antiguo: ${oldV}`);

        if (event.newValue) { // Se actualizó o se inició sesión en otra pestaña
            try {
                const updatedUserFromStorage = JSON.parse(event.newValue);
                console.log(`[Storage Event en ${pagePath}] Usuario parseado de newValue:`, updatedUserFromStorage ? JSON.parse(JSON.stringify(updatedUserFromStorage)) : null);

                if (updatedUserFromStorage && updatedUserFromStorage.userId) {
                    console.log(`[Storage Event en ${pagePath}] Llamando a updateGlobalUserUI con profilePhotoPath: ${updatedUserFromStorage.profilePhotoPath}`);
                    window.updateGlobalUserUI(updatedUserFromStorage);
                } else {
                    console.warn(`[Storage Event en ${pagePath}] updatedUserFromStorage no es válido o no tiene userId. Llamando a updateGlobalUserUI con null.`);
                    window.updateGlobalUserUI(null);
                }
            } catch (e) {
                console.error(`[Storage Event en ${pagePath}] Error parseando newValue:`, e, event.newValue);
                window.updateGlobalUserUI(null);
            }
        } else { // loggedInUser fue eliminado de localStorage (logout en otra pestaña)
            console.log(`[Storage Event en ${pagePath}] loggedInUser eliminado (logout en otra pestaña).`);
            window.updateGlobalUserUI(null);
            // Mostrar sección de login si estamos en una página que la tenga
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

    // --- Obtención de Elementos del DOM ---
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
    const sidebarLogoutButton = document.getElementById('sidebarLogoutButton');

    let loggedInUserObject = null; // Variable global en este script para el usuario actual

    function showLogin() {
        const pagePath = window.location.pathname;
        console.log(`[${pagePath}] showLogin: Mostrando sección de login.`);
        loggedInUserObject = null; // Limpiar el objeto de usuario en memoria
        if (loginSection) loginSection.style.display = 'block';
        if (mainContentDiv) mainContentDiv.style.display = 'none';
        window.updateGlobalUserUI(null); // Actualiza header/sidebar a estado "no logueado"
        localStorage.removeItem('loggedInUser'); // Asegurar que se limpie
    }

    async function showMainContent(userObjectReceived, fromLocalStorage = false) {
        const pagePath = window.location.pathname;
        console.log(`[${pagePath}] showMainContent para usuario:`, userObjectReceived ? JSON.parse(JSON.stringify(userObjectReceived)) : null, `Desde localStorage: ${fromLocalStorage}`);
        
        if (!userObjectReceived || !userObjectReceived.userId) {
            console.error(`[${pagePath}] showMainContent llamado sin datos de usuario válidos.`);
            showLogin();
            return;
        }

        loggedInUserObject = userObjectReceived; // Actualizar la referencia en memoria

        if (loginSection) loginSection.style.display = 'none';
        if (mainContentDiv) mainContentDiv.style.display = 'block';
        
        window.updateGlobalUserUI(loggedInUserObject);
        
        // Solo actualizamos localStorage si los datos NO vienen de localStorage
        // o si vienen del login (que son los más frescos en ese momento).
        // Si fromLocalStorage es true, ya están en localStorage.
        // Si es una actualización de fetchAndUpdateCurrentUser, esa función se encargará de actualizar localStorage si es necesario.
        if (!fromLocalStorage) {
             console.log(`[${pagePath}] Actualizando localStorage en showMainContent con:`, JSON.parse(JSON.stringify(loggedInUserObject)));
             localStorage.setItem('loggedInUser', JSON.stringify(loggedInUserObject));
        }


        // Lógica específica de la página
        if (pagePath.endsWith('/') || pagePath.endsWith('index.html')) {
            if (millonariosListDiv) {
                await loadMillonarios();
            }
        }
    }

    async function fetchAndUpdateCurrentUser(userIdToFetch) {
        const pagePath = window.location.pathname;
        console.log(`[${pagePath}] fetchAndUpdateCurrentUser para userId: ${userIdToFetch}`);
        try {
            const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(userIdToFetch)}`);
            if (!response.ok) {
                console.warn(`[${pagePath}] Error al refrescar datos del usuario ${userIdToFetch}. Estado: ${response.status}`);
                if (response.status === 401 || response.status === 404) {
                    showLogin(); // Forzar logout si el usuario ya no es válido o no autorizado
                }
                return; // No se pudo refrescar
            }
            const freshUserData = await response.json();
            if (freshUserData && freshUserData.userId) {
                console.log(`[${pagePath}] Datos frescos recibidos para ${userIdToFetch}:`, JSON.parse(JSON.stringify(freshUserData)));
                
                // Comprobar si el usuario actual en memoria (loggedInUserObject) es el mismo y si los datos han cambiado.
                // Si loggedInUserObject es null (primera carga, por ejemplo), o si los datos difieren.
                let needsUIUpdate = true; // Asumir que se necesita actualizar por defecto
                if (loggedInUserObject && loggedInUserObject.userId === freshUserData.userId) {
                    if (loggedInUserObject.profilePhotoPath === freshUserData.profilePhotoPath &&
                        loggedInUserObject.pushname === freshUserData.pushname) {
                        // No hay cambios visuales significativos, pero actualizamos el objeto y localStorage para otros campos
                        console.log(`[${pagePath}] Datos del usuario no cambiaron visualmente (foto, nombre). Actualizando otros campos si es necesario.`);
                        needsUIUpdate = false; // No es necesario un re-renderizado completo de la UI principal por showMainContent
                    }
                }

                // Actualizar el objeto en memoria y localStorage con los datos más frescos
                loggedInUserObject = freshUserData;
                localStorage.setItem('loggedInUser', JSON.stringify(loggedInUserObject));
                console.log(`[${pagePath}] localStorage actualizado por fetchAndUpdateCurrentUser.`);


                if (needsUIUpdate) {
                    console.log(`[${pagePath}] Datos del usuario cambiaron. Llamando a updateGlobalUserUI con datos frescos.`);
                    window.updateGlobalUserUI(loggedInUserObject); // Actualiza solo el sidebar/header
                    // Si estás en una página que muestra más detalles (como index con millonarios),
                    // podrías necesitar recargar esa sección específica aquí también.
                    // Por ahora, showMainContent (que llama a updateGlobalUserUI) se encarga de la UI global.
                    // Si la llamada original a showMainContent ya renderizó la página con datos de localStorage,
                    // esta llamada a updateGlobalUserUI es suficiente para el sidebar/header.
                }
            } else {
                 console.warn(`[${pagePath}] fetchAndUpdateCurrentUser: No se recibieron datos válidos para el usuario ${userIdToFetch}.`);
            }
        } catch (error) {
            console.error(`[${pagePath}] Excepción al refrescar datos del usuario ${userIdToFetch}:`, error);
        }
    }

    // --- Lógica de Inicialización de UI al Cargar la Página ---
    const storedUserStringOnLoad = localStorage.getItem('loggedInUser');
    if (storedUserStringOnLoad) {
        try {
            const parsedUserOnLoad = JSON.parse(storedUserStringOnLoad);
            if (parsedUserOnLoad && parsedUserOnLoad.userId) {
                const pagePath = window.location.pathname;
                console.log(`[${pagePath}] Usuario encontrado en localStorage al cargar. Mostrando UI con datos cacheados y refrescando en segundo plano:`, JSON.parse(JSON.stringify(parsedUserOnLoad)));
                showMainContent(parsedUserOnLoad, true); // Mostrar UI con datos cacheados, fromLocalStorage = true
                fetchAndUpdateCurrentUser(parsedUserOnLoad.userId); // Luego, intentar refrescar desde el servidor
            } else {
                console.warn(`[${window.location.pathname}] Datos de usuario en localStorage no válidos al cargar.`);
                showLogin();
            }
        } catch (e) {
            console.error(`[${window.location.pathname}] Error parseando storedUser al cargar:`, e);
            showLogin();
        }
    } else {
        console.log(`[${window.location.pathname}] No hay usuario en localStorage al cargar, mostrando login.`);
        showLogin();
    }

    // --- Event Listeners ---
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            const phoneNumber = loginPhoneNumberInput.value.trim();
            const password = loginPasswordInput.value.trim();
            const pagePath = window.location.pathname;

            loginMessageDiv.className = 'message-area';
            if (!phoneNumber || !password) {
                loginMessageDiv.textContent = 'Por favor, ingresa número y contraseña.';
                loginMessageDiv.classList.add('error', 'visible');
                return;
            }
            loginMessageDiv.textContent = 'Iniciando sesión...';
            loginMessageDiv.classList.add('visible');
            
            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber, password }),
                });
                const data = await response.json();
                if (response.ok && data.user) {
                    loginMessageDiv.textContent = data.message || "Inicio de sesión exitoso.";
                    loginMessageDiv.classList.add('success');
                    console.log(`[${pagePath}] Login exitoso, llamando a showMainContent con:`, JSON.parse(JSON.stringify(data.user)));
                    await showMainContent(data.user); // Esto setea loggedInUserObject y localStorage
                } else {
                    loginMessageDiv.textContent = data.message || 'Error al iniciar sesión.';
                    loginMessageDiv.classList.add('error');
                }
            } catch (error) { 
                console.error('Error en fetch de login:', error);
                loginMessageDiv.textContent = 'Error de conexión al intentar iniciar sesión.';
                loginMessageDiv.classList.add('error', 'visible');
            }
        });
    }

    if (sidebarLogoutButton) {
        sidebarLogoutButton.addEventListener('click', () => {
            console.log(`[${window.location.pathname}] Botón de logout presionado.`);
            showLogin();
        });
    }
    
    if (sidebarProfileInfoDiv) {
        sidebarProfileInfoDiv.addEventListener('click', () => {
            console.log(`[${window.location.pathname}] Click en perfil del sidebar.`);
            if (loggedInUserObject && loggedInUserObject.userId) { // Solo redirigir si hay un usuario
                 window.location.href = 'profile.html'; // Siempre va al perfil propio del usuario logueado
            } else {
                console.warn("Click en perfil del sidebar, pero no hay usuario logueado (loggedInUserObject es null).");
                // Opcional: redirigir a login si no hay usuario logueado
                // window.location.href = 'index.html'; // o la página de login
            }
        });
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
        console.log("[formatTimestamp] Valor de entrada:", timestamp, "| Tipo:", typeof timestamp); // Log inicial
    
        if (timestamp === null || timestamp === undefined || timestamp === 0 || timestamp === '') {
            console.log("[formatTimestamp] Devolviendo 'Nunca' por valor nulo/vacío/cero.");
            return 'Nunca';
        }
    
        let dateObj;
    
        if (typeof timestamp === 'number') {
            console.log("[formatTimestamp] Es tipo número.");
            dateObj = new Date(timestamp);
        } 
        else if (typeof timestamp === 'string') {
            console.log("[formatTimestamp] Es tipo string.");
            const numericTimestamp = Number(timestamp);
            console.log("[formatTimestamp] String convertida a número:", numericTimestamp, "| es NaN?:", isNaN(numericTimestamp));
    
            if (!isNaN(numericTimestamp) && String(numericTimestamp) === timestamp.trim()) { // Añadido .trim() por si acaso
                console.log("[formatTimestamp] Es una cadena numérica válida. Usando el valor numérico.");
                dateObj = new Date(numericTimestamp);
            } else {
                console.log("[formatTimestamp] No es una cadena puramente numérica o la conversión falló. Intentando parsear string directamente.");
                dateObj = new Date(timestamp);
            }
        } 
        else {
            console.warn("[formatTimestamp] Tipo de timestamp no reconocido:", timestamp, typeof timestamp);
            return 'Fecha no válida (tipo)';
        }
    
        console.log("[formatTimestamp] Objeto Date antes de chequeo de validez:", dateObj);
    
        if (!dateObj || isNaN(dateObj.getTime())) { // Añadido chequeo por si dateObj es undefined
            console.warn("[formatTimestamp] El valor resultó en 'Invalid Date'. Original:", timestamp, "| dateObj:", dateObj);
            return 'Fecha inválida';
        }
    
        console.log("[formatTimestamp] Fecha válida. Formateando:", dateObj);
        try {
            return dateObj.toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit',
            });
        } catch (e) {
            console.error("[formatTimestamp] Error formateando la fecha:", e, dateObj);
            return 'Error al formatear';
        }
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
                 if (targetLink.closest('ul:not(#game-menu)')) {
                    sidebar.classList.remove('open');
                    pageOverlay.classList.remove('visible');
                    document.body.classList.remove('sidebar-open-no-scroll');
                }
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
            // No manejamos otros modales aquí ya que son específicos de otras páginas (profile.js)
        }
    });
});