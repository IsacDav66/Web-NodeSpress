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
            let newSrc = 'placeholder-profile.jpg'; // Default
            if (userDataObject.profilePhotoPath) {
                // Si profilePhotoPath ya es una URL completa (https://...), usarla directamente.
                // Si es una ruta relativa (comienza con 'uploads/'), entonces prefijar.
                // CON S3, AHORA SIEMPRE DEBERÍA SER UNA URL COMPLETA.
                if (userDataObject.profilePhotoPath.startsWith('https://') || userDataObject.profilePhotoPath.startsWith('http://')) {
                    newSrc = userDataObject.profilePhotoPath;
                } else if (userDataObject.profilePhotoPath.startsWith('uploads/')) {
                    // Esta rama es para el sistema de archivos local, podría eliminarse si ya no se usa.
                    newSrc = `/${userDataObject.profilePhotoPath}`; 
                } else if (userDataObject.profilePhotoPath) {
                     // Si no es una URL completa ni empieza con 'uploads/', podría ser un path local sin el prefijo.
                     // Esto es menos probable con S3, pero por si acaso.
                     // Si es S3, ya debería ser una URL completa. Si no, hay un problema en cómo se guarda/devuelve.
                     // Por seguridad, si no es una URL http/https, asumimos placeholder o logueamos un error.
                     console.warn("[updateGlobalUserUI] profilePhotoPath no es una URL completa HTTPS/HTTP y no empieza con 'uploads/'. Usando placeholder. Path:", userDataObject.profilePhotoPath);
                     newSrc = 'placeholder-profile.jpg'; // O manejar el error de otra forma
                }
            }
            // console.log(`[updateGlobalUserUI en ${pagePath}] Intentando establecer src de sidebarProfilePicImg a: ${newSrc}`);
            sidebarProfilePicImg.src = newSrc;
            sidebarProfilePicImg.alt = `Foto de ${escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario'}`;
        
        }
        if (sidebarProfileNameSpan) {
            sidebarProfileNameSpan.textContent = escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario';
        }
        if (loggedInUserNameSpanHeader) {
             loggedInUserNameSpanHeader.textContent = `${escapeHtmlForGlobalUI(userDataObject.pushname) || 'Usuario'}`;
        }
        if (userInfoAreaHeader) userInfoAreaHeader.style.display = 'flex';
        if (sidebarLogoutButtonGlobal) sidebarLogoutButtonGlobal.style.display = 'flex'; // Mostrar botón de logout
        if (headerSearchContainerGlobal) headerSearchContainerGlobal.style.display = 'flex'; // Mostrar búsqueda
    } else {
        if (sidebarProfileInfoDiv) sidebarProfileInfoDiv.style.display = 'none';
        if (sidebarProfilePicImg) {
            sidebarProfilePicImg.src = 'placeholder-profile.jpg';
            sidebarProfilePicImg.alt = 'Foto de perfil';
        }
        if (sidebarProfileNameSpan) sidebarProfileNameSpan.textContent = 'Usuario';
        if (loggedInUserNameSpanHeader) loggedInUserNameSpanHeader.textContent = '';
        if (userInfoAreaHeader) userInfoAreaHeader.style.display = 'none';
        if (sidebarLogoutButtonGlobal) sidebarLogoutButtonGlobal.style.display = 'none'; // Ocultar botón de logout
        if (headerSearchContainerGlobal) headerSearchContainerGlobal.style.display = 'none'; // Ocultar búsqueda
    }
};

// --- LISTENER PARA EL EVENTO 'storage' (CAMBIOS EN LOCALSTORAGE DESDE OTRAS PESTAÑAS) ---
window.addEventListener('storage', function(event) {
    if (event.key === 'loggedInUser') {
        const pagePath = window.location.pathname;
        const newV = event.newValue ? (event.newValue.length > 150 ? event.newValue.substring(0, 150) + '...' : event.newValue) : 'null';
        console.log(`[Storage Event en ${pagePath}] Clave: ${event.key}, Nuevo valor: ${newV}`);

        if (event.newValue) {
            try {
                const updatedUserFromStorage = JSON.parse(event.newValue);
                if (updatedUserFromStorage && updatedUserFromStorage.userId) {
                    window.updateGlobalUserUI(updatedUserFromStorage);
                } else {
                    window.updateGlobalUserUI(null);
                }
            } catch (e) {
                console.error(`[Storage Event en ${pagePath}] Error parseando newValue:`, e);
                window.updateGlobalUserUI(null);
            }
        } else {
            window.updateGlobalUserUI(null);
            const loginSect = document.getElementById('login-section');
            const mainCont = document.getElementById('main-content');
            if (loginSect && mainCont) { // Asegurarse que existen antes de manipularlos
                 loginSect.style.display = 'block';
                 mainCont.style.display = 'none';
            }
        }
    } else if (event.key === 'theme') { // Escuchar cambios de tema desde otras pestañas
        const newTheme = event.newValue;
        if (newTheme) {
            applyTheme(newTheme); // Definir applyTheme globalmente o dentro de DOMContentLoaded y llamarla
        }
    }
});

// --- INICIO LÓGICA DE TEMA ---
// Estas funciones y variables para el tema deben estar accesibles globalmente
// o, si están dentro de DOMContentLoaded, el listener de 'storage' también debe estarlo
// o tener una forma de llamar a la función applyTheme.
// Por simplicidad, las definiré aquí y el DOMContentLoaded las usará.

const htmlElementForTheme  = document.documentElement;
let availableThemes = {}; // Objeto para almacenar {id: "Nombre para Mostrar"}
// Función para aplicar el tema
function applyTheme(themeId) {
    if (!themeId) return;

    htmlElementForTheme.setAttribute('data-theme', themeId); // Aplicar a <html>
    localStorage.setItem('theme', themeId);
    
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect && themeSelect.value !== themeId) {
        themeSelect.value = themeId;
    }
    console.log(`[Tema] Tema aplicado: ${themeId}`);
}
// Función para leer temas del CSS
async function loadThemesFromCSS() {
    availableThemes = {}; // Resetear por si se llama múltiples veces (aunque usualmente es una vez)
    console.log("[Tema] Iniciando carga de temas desde CSS...");

    let themeSheet = null;
    // Intentar encontrar la hoja de estilos 'themes.css'
    for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        // Comprobar que sheet.href exista y que termine con 'themes.css'
        // Usar endsWith es más preciso que includes si tienes otros CSS con 'themes' en el nombre
        if (sheet.href && sheet.href.endsWith('themes.css')) {
            themeSheet = sheet;
            console.log("[Tema] Hoja de estilos 'themes.css' encontrada en:", themeSheet.href);
            break;
        }
    }

    if (!themeSheet) {
        console.warn("[Tema] ADVERTENCIA: Hoja de estilos 'themes.css' no encontrada en document.styleSheets. " +
                     "Verifique la etiqueta <link> en su HTML, la ruta del archivo y el orden de carga. " +
                     "Usando temas de fallback.");
        availableThemes = { 'dark': 'Oscuro (Fallback)', 'light': 'Claro (Fallback)' };
        return; // Salir si no se encuentra la hoja, ya se establecieron los fallbacks
    }
    
    try {
        // Esperar a que las reglas CSS estén disponibles si es necesario.
        let retries = 10; // Aumentar un poco los reintentos y el tiempo
        let rulesAvailable = false;
        if (themeSheet.cssRules !== null) {
            rulesAvailable = true;
        } else {
            // Si las reglas no están disponibles inmediatamente (ej. CSS cargado asíncronamente o muy grande),
            // intentar obtenerlas después de un breve retraso.
            // Esto es más probable si el script se ejecuta antes de que el CSS esté completamente parseado
            // a pesar de DOMContentLoaded.
            while (retries > 0) {
                console.log(`[Tema] cssRules para 'themes.css' es null, reintentando... (${retries} restantes)`);
                await new Promise(resolve => setTimeout(resolve, 100)); // Esperar 100ms
                if (themeSheet.cssRules !== null) {
                    rulesAvailable = true;
                    break;
                }
                retries--;
            }
        }

        if (!rulesAvailable) {
            console.error("[Tema] ERROR: cssRules para 'themes.css' siguen siendo null después de los reintentos. " +
                          "Esto puede suceder si el archivo está vacío, malformado, o hay problemas de carga/CORS " +
                          "(aunque CORS no debería ser un problema para archivos del mismo origen). Usando temas de fallback.");
            availableThemes = { 'dark': 'Oscuro (Fallback Crit.)', 'light': 'Claro (Fallback Crit.)' };
            return;
        }

        console.log(`[Tema] Número de reglas en themes.css: ${themeSheet.cssRules.length}`);

        for (const rule of themeSheet.cssRules) {
            // Solo procesar reglas de estilo (CSSRule.STYLE_RULE === 1)
            if (rule.type === 1 /* CSSRule.STYLE_RULE */) {
                const selectorText = rule.selectorText;

                // Buscar temas definidos con html[data-theme="..."]
                if (selectorText && selectorText.startsWith('html[data-theme="')) {
                    const themeIdMatch = selectorText.match(/html\[data-theme="([^"]+)"\]/);
                    if (themeIdMatch && themeIdMatch[1]) {
                        const themeId = themeIdMatch[1];
                        let themeName = themeId.charAt(0).toUpperCase() + themeId.slice(1); // Nombre por defecto

                        // Intentar leer la variable --theme-name de la regla
                        const nameMatch = rule.style.getPropertyValue('--theme-name').trim();
                        if (nameMatch) {
                            // Quitar comillas si están presentes (ej. "'Nombre Tema'" o '"Nombre Tema"')
                            themeName = nameMatch.replace(/^['"]|['"]$/g, "");
                        }
                        availableThemes[themeId] = themeName;
                        // console.log(`[Tema] Encontrado tema [${themeId}]: ${themeName} desde selector "${selectorText}"`);
                    }
                } 
                // Buscar el tema por defecto (asumido 'dark')
                // Lo busca en selectores como 'html:not([data-theme])' o explícitamente 'html[data-theme="dark"]'
                // y solo si 'dark' no ha sido ya añadido (para evitar sobreescribir una definición explícita de 'dark').
                else if (selectorText && 
                         (selectorText.includes('html:not([data-theme])') || selectorText.includes('html[data-theme="dark"]')) &&
                         !availableThemes['dark']) {
                    
                    let defaultThemeName = "Oscuro Defecto"; // Nombre por defecto si no se encuentra --theme-name
                    const nameMatch = rule.style.getPropertyValue('--theme-name').trim();
                    if (nameMatch) {
                        defaultThemeName = nameMatch.replace(/^['"]|['"]$/g, "");
                    }
                    availableThemes['dark'] = defaultThemeName; // Asignar al ID 'dark'
                    // console.log(`[Tema] Encontrado tema por defecto (dark): ${defaultThemeName} desde selector "${selectorText}"`);
                }
            }
        }
        
        if (Object.keys(availableThemes).length === 0) {
            console.warn("[Tema] No se extrajeron temas de themes.css. " +
                         "Asegúrese de que las reglas estén bien definidas (ej. html[data-theme='nombre'] { --theme-name: 'Nombre Bonito'; ... }). " +
                         "Usando temas de fallback.");
            availableThemes = { 'dark': 'Oscuro (Fallback Vacío)', 'light': 'Claro (Fallback Vacío)' };
        } else if (!availableThemes['dark']) { 
            // Si se extrajeron temas pero 'dark' (nuestro default esperado) no está, añadirlo.
            console.warn("[Tema] Tema 'dark' no encontrado explícitamente, añadiendo como fallback.");
            availableThemes['dark'] = 'Oscuro';
        }

        console.log("[Tema] Temas disponibles cargados final:", availableThemes);

    } catch (error) {
        console.error("[Tema] ERROR CRÍTICO cargando/parseando temas desde CSS:", error, error.stack);
        availableThemes = { 'dark': 'Oscuro (Error Carga)', 'light': 'Claro (Error Carga)' };
    }
}
// Función para poblar el selector de temas
function populateThemeSelector() {
    const themeSelect = document.getElementById('themeSelect');
    if (!themeSelect || Object.keys(availableThemes).length === 0) return;

    themeSelect.innerHTML = ''; // Limpiar opciones anteriores

    // Asegurarse que el tema por defecto (ej. 'dark') aparezca, y quizás primero.
    const themeOrder = ['dark', ...Object.keys(availableThemes).filter(id => id !== 'dark')];


    themeOrder.forEach(themeId => {
        if (availableThemes[themeId]) {
            const option = document.createElement('option');
            option.value = themeId;
            option.textContent = availableThemes[themeId];
            themeSelect.appendChild(option);
        }
    });

    const currentTheme = localStorage.getItem('theme') || 'dark'; // Asumir 'dark' como default
    if (availableThemes[currentTheme]) {
        themeSelect.value = currentTheme;
    }

    themeSelect.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });
}

function toggleTheme() {
    const isCurrentlyLight = bodyElementForTheme.classList.contains('light-theme');
    const newTheme = isCurrentlyLight ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}
// --- FIN LÓGICA DE TEMA ---


document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = '/socianark/api';
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
    const sidebarLogoutButton = document.getElementById('sidebarLogoutButton');

    // --- LÓGICA DE TEMA (OBTENCIÓN DE BOTÓN Y CARGA INICIAL) ---
    const themeToggleButton = document.getElementById('themeToggleButton');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }
    await loadThemesFromCSS(); // Esperar a que se carguen los temas
    populateThemeSelector();   // Llenar el dropdown
    // Aplicar tema guardado o por defecto al cargar la página
    const savedTheme = localStorage.getItem('theme');
    let initialTheme = 'dark'; // Tema por defecto
    if (savedTheme && availableThemes[savedTheme]) {
        initialTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches && availableThemes['light']) {
        initialTheme = 'light';
    }
    // Si el initialTheme no está en availableThemes (ej. localStorage corrupto), se queda 'dark' (o el primero de availableThemes)
    if (!availableThemes[initialTheme] && Object.keys(availableThemes).length > 0) {
        initialTheme = Object.keys(availableThemes)[0];
    }

    applyTheme(initialTheme);
    if (!localStorage.getItem('theme')) { // Si no había nada guardado, guardar el inicial
        localStorage.setItem('theme', initialTheme);
    }
    // --- FIN LÓGICA DE TEMA ---

    let loggedInUserObject = null; // Variable global en este script para el usuario actual

    function showLogin() {
    const pagePath = window.location.pathname;
    const queryString = window.location.search;
    console.log(`[${pagePath}] showLogin: Usuario no autenticado. Redirigiendo a la página de login.`);
    
    // Limpiar cualquier dato de usuario anterior
    loggedInUserObject = null;
    localStorage.removeItem('loggedInUser'); 

    // Ocultar la UI principal inmediatamente para evitar destellos de contenido protegido
    if (mainContentDiv) mainContentDiv.style.display = 'none';
    if (loginSection) loginSection.style.display = 'none'; // Ocultar también la vieja sección por si acaso
    window.updateGlobalUserUI(null);

    // --- LÓGICA DE REDIRECCIÓN ---
    // Construye la URL a la que se debe regresar después del login.
    const redirectUrl = `${pagePath}${queryString}`;

    // Redirige a la nueva página de login, pasando la URL actual como parámetro.
    window.location.href = `/login.html?redirectUrl=${encodeURIComponent(redirectUrl)}`;
}


// --- Localiza la función showMainContent() y asegúrate de que el antiguo loginSection se oculte ---

async function showMainContent(userObjectReceived, fromLocalStorage = false) {
    const pagePath = window.location.pathname;
    console.log(`[${pagePath}] showMainContent para usuario:`, userObjectReceived ? JSON.parse(JSON.stringify(userObjectReceived)) : null, `Desde localStorage: ${fromLocalStorage}`);
    
    if (!userObjectReceived || !userObjectReceived.userId) {
        console.error(`[${pagePath}] showMainContent llamado sin datos de usuario válidos.`);
        showLogin(); // Esto ahora redirigirá
        return;
    }

    loggedInUserObject = userObjectReceived;

    // AHORA: solo necesitamos ocultar la sección de login si todavía existe en alguna página (aunque la vamos a borrar).
    // Y mostrar el contenido principal.
    const loginSect = document.getElementById('login-section'); // Busca si existe la sección de login en la página actual
    if (loginSect) loginSect.style.display = 'none';
    if (mainContentDiv) mainContentDiv.style.display = 'block';
    
    window.updateGlobalUserUI(loggedInUserObject);
    
    if (!fromLocalStorage) {
         console.log(`[${pagePath}] Actualizando localStorage en showMainContent con:`, JSON.parse(JSON.stringify(loggedInUserObject)));
         localStorage.setItem('loggedInUser', JSON.stringify(loggedInUserObject));
    }


    // Lógica específica de la página (esta parte no cambia)
    if (pagePath.endsWith('/') || pagePath.endsWith('estadisticas.html')) {
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