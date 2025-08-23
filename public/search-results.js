// public/search-results.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/socianark/api';
    const FRONTEND_MONEY_SYMBOL = '💰';

    const searchTermDisplay = document.getElementById('searchTermDisplay');
    const searchResultsListDiv = document.getElementById('searchResultsList');
    
    // Estos elementos son para mostrar un perfil detallado EN la misma página de resultados.
    // Si siempre rediriges a profile.html al hacer clic, podrías eliminar esta lógica.
    // Por ahora, la mantendremos como estaba en tu código original.
    const userProfileDetailDiv = document.getElementById('userProfileDetail');
    const profileSeparator = document.getElementById('profileSeparator');

    // Obtener el término de búsqueda de los parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (searchTermDisplay) {
        searchTermDisplay.textContent = query ? escapeHtml(query) : 'nada';
    }

    if (query && searchResultsListDiv) {
        fetchAndDisplayResults(query);
    } else if (searchResultsListDiv) {
        searchResultsListDiv.innerHTML = '<p>Por favor, realiza una búsqueda desde la barra superior.</p>';
    }

    async function fetchAndDisplayResults(searchTerm) {
        if (!searchResultsListDiv) return; // Salir si el div no existe

        searchResultsListDiv.innerHTML = '<p>Buscando usuarios...</p>';
        if (userProfileDetailDiv) userProfileDetailDiv.style.display = 'none';
        if (profileSeparator) profileSeparator.style.display = 'none';

        try {
            // Asegurarse de que el '@' no se doble codifique si ya está en el término de búsqueda
            // La API espera el '@' como parte del ID. encodeURIComponent lo manejará bien.
            const encodedQuery = encodeURIComponent(searchTerm); 
            const response = await fetch(`${API_BASE_URL}/user/${encodedQuery}`);

            if (response.status === 404) {
                searchResultsListDiv.innerHTML = `<p class="error">No se encontraron usuarios para: "${escapeHtml(searchTerm)}"</p>`;
                return;
            }
            if (!response.ok) {
                let errorMsg = `Error HTTP: ${response.status} - ${response.statusText}`;
                try {
                    const errorData = await response.json(); // Intenta parsear como JSON
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) {
                    // Si no es JSON, intenta obtener como texto (ya lo haces, pero podemos refinarlo)
                    const textError = await response.text().catch(() => ''); // Evitar que falle si no hay texto
                    errorMsg += `. Detalle: ${textError || '(sin detalle adicional)'}`;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            renderResults(data, searchTerm);

        } catch (error) {
            console.error('Error buscando usuario:', error);
            searchResultsListDiv.innerHTML = `<p class="error">Error al buscar usuarios: ${error.message}</p>`;
        }
    }

    function renderResults(usersData, originalQuery) {
        if (!searchResultsListDiv) return;

        if (!Array.isArray(usersData)) {
            usersData = [usersData]; // Convertir objeto único en array si la API devuelve un solo usuario
        }

        if (usersData.length === 0) {
            searchResultsListDiv.innerHTML = `<p class="error">No se encontraron usuarios para: "${escapeHtml(originalQuery)}"</p>`;
            return;
        }

        let listHTML = '<ul>';
        usersData.forEach(user => {
            const totalMoney = (user.money || 0) + (user.bank || 0);
            
            let profilePicSrc = 'placeholder-profile.jpg'; // Imagen por defecto
            if (user.profilePhotoPath) {
                if (user.profilePhotoPath.startsWith('http://') || user.profilePhotoPath.startsWith('https://')) {
                    profilePicSrc = user.profilePhotoPath;
                } 
                // --- ¡AÑADE ESTA CONDICIÓN! ---
                else if (user.profilePhotoPath.startsWith('/socianark/uploads/')) {
                    profilePicSrc = user.profilePhotoPath; // La ruta ya es correcta
                }
                // --- FIN DE LA MODIFICACIÓN ---
                else if (user.profilePhotoPath.startsWith('uploads/')) { 
                    profilePicSrc = `/${user.profilePhotoPath}`;
                } 
                else {
                    console.warn(`[Search Results] Formato de profilePhotoPath no reconocido...`);
                    // profilePicSrc se mantiene como 'placeholder-profile.jpg'
                }
            }

            listHTML += `
             <li class="search-result-item" data-userid="${escapeHtml(user.userId)}"> 
                 <img src="${escapeHtml(profilePicSrc)}" alt="Perfil de ${escapeHtml(user.pushname) || 'Usuario Desconocido'}" class="result-profile-pic" loading="lazy">
                 <div class="result-user-info">
                    <span class="result-username">${highlightMatch(escapeHtml(user.pushname) || 'N/A', originalQuery)}</span>
                    <span class="result-money">${FRONTEND_MONEY_SYMBOL}${totalMoney.toLocaleString()}</span>
                 </div>
             </li>`;
        });
        listHTML += '</ul>';
        searchResultsListDiv.innerHTML = listHTML;

        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const userIdToView = item.dataset.userid;
                if (userIdToView && userIdToView !== 'undefined' && userIdToView !== 'null') {
                    window.location.href = `profile.html?id=${encodeURIComponent(userIdToView)}`;
                } else {
                    console.error("Error: userIdToView es inválido al hacer clic.", item.dataset);
                    alert("Error al intentar ver el perfil: ID de usuario no válido.");
                }
            });
        });

        const items = searchResultsListDiv.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 75); 
        });
    }

    // La función fetchAndDisplayUserProfile y displayFullUserInfo se mantienen si decides
    // mostrar el perfil detallado en la misma página de resultados.
    // Si siempre rediriges a profile.html, estas dos funciones podrían eliminarse de este archivo.
    // Por ahora, las dejo como estaban en tu versión anterior.

    async function fetchAndDisplayUserProfile(userId) {
        if (!userProfileDetailDiv || !profileSeparator) return; // Salir si los elementos no existen

        userProfileDetailDiv.innerHTML = '<p>Cargando perfil...</p>';
        userProfileDetailDiv.style.display = 'block';
        profileSeparator.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(userId)}`);
            if (!response.ok) {
                 let errorMsg = `Error HTTP: ${response.status} - ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) {
                    const textError = await response.text().catch(() => '');
                    errorMsg += `. Detalle: ${textError || '(sin detalle adicional)'}`;
                }
                throw new Error(errorMsg);
            }
            const user = await response.json();
            displayFullUserInfo(user);
            userProfileDetailDiv.classList.add('visible');
        } catch (error) {
            userProfileDetailDiv.innerHTML = `<p class="error">Error al cargar el perfil: ${error.message}</p>`;
            userProfileDetailDiv.classList.add('visible');
            console.error('Error cargando perfil de usuario:', error);
        }
    }

    function displayFullUserInfo(user) {
        if (!userProfileDetailDiv) return;
        if (!user) {
            userProfileDetailDiv.innerHTML = '<p class="error">No se pudo mostrar la información del usuario.</p>';
            return;
        }
        let userDetailsHTML = `
            <h4>Detalles de ${escapeHtml(user.pushname) || 'Usuario'}:</h4>
            <p><strong>ID:</strong> ${escapeHtml(user.userId)}</p>
            <p><strong>Nombre:</strong> ${escapeHtml(user.pushname) || 'N/A'}</p>
            <p><strong>EXP:</strong> ${(user.exp || 0).toLocaleString()}</p>
            <p><strong>Dinero en Mano:</strong> ${FRONTEND_MONEY_SYMBOL}${(user.money || 0).toLocaleString()}</p>
            <p><strong>Dinero en Banco:</strong> ${FRONTEND_MONEY_SYMBOL}${(user.bank || 0).toLocaleString()}</p>
            <p><strong>Últ. Trabajo:</strong> ${formatTimestamp(user.lastwork)}</p>
            <p><strong>Últ. Robo:</strong> ${formatTimestamp(user.laststeal)}</p>
            <p><strong>Últ. Crimen:</strong> ${formatTimestamp(user.lastcrime)}</p>
            <p><strong>Últ. "Cita":</strong> ${formatTimestamp(user.lastslut)}</p>
            <p><strong>Últ. Ruleta:</strong> ${formatTimestamp(user.lastroulette)}</p>
            <p><strong>Últ. Slots:</strong> ${formatTimestamp(user.lastslots)}</p>
            <p><strong>Últ. Daily:</strong> ${formatTimestamp(user.lastdaily)}</p>
            <p><strong>Racha Daily:</strong> ${user.dailystreak || 0} día(s)</p>
        `;
        userProfileDetailDiv.innerHTML = userDetailsHTML;
    }

    // --- Funciones Auxiliares ---
    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return String(unsafe)
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, ".")
             .replace(/'/g, "'");
    }

    function escapeRegex(string) {
        if (string === null || typeof string === 'undefined') return '';
        return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    function highlightMatch(text, query) {
        if (!text || !query) return text;
        const safeText = String(text); // Asegurarse que text sea un string
        const safeQuery = escapeRegex(String(query));
        try {
            const regex = new RegExp(`(${safeQuery})`, 'gi');
            return safeText.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            console.warn("Error creando RegExp para highlight:", e);
            return safeText; // Devolver texto original si hay error con la regex
        }
    }

    function formatTimestamp(timestamp) {
        if (!timestamp || timestamp === 0 || timestamp === "0") return 'Nunca'; // Manejar "0" como string también
        let dateObj;
        if (typeof timestamp === 'number' || (typeof timestamp === 'string' && /^\d+$/.test(timestamp))) {
            dateObj = new Date(Number(timestamp));
        } else if (typeof timestamp === 'string') {
            dateObj = new Date(timestamp);
        } else {
            return 'Fecha no válida (tipo)';
        }

        if (!dateObj || isNaN(dateObj.getTime())) {
            return 'Fecha inválida';
        }
        try {
            return dateObj.toLocaleString('es-ES', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        } catch (e) { 
            console.error("Error formateando timestamp:", e, "Valor original:", timestamp);
            return 'Error al formatear'; 
        }
    }
});