// public/search-results.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api';
    const FRONTEND_MONEY_SYMBOL = '💰';

    const searchTermDisplay = document.getElementById('searchTermDisplay');
    const searchResultsListDiv = document.getElementById('searchResultsList');
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
        searchResultsListDiv.innerHTML = '<p>Buscando usuarios...</p>';
        userProfileDetailDiv.style.display = 'none'; // Ocultar detalles del perfil anterior
        profileSeparator.style.display = 'none';

        try {
            const encodedQuery = encodeURIComponent(searchTerm).replace(/%40/g, '@');
            const response = await fetch(`${API_BASE_URL}/user/${encodedQuery}`);

            if (response.status === 404) {
                searchResultsListDiv.innerHTML = `<p class="error">No se encontraron usuarios para: "${escapeHtml(searchTerm)}"</p>`;
                return;
            }
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}. Detalle: ${errorData}`);
            }

            const data = await response.json();
            renderResults(data, searchTerm);

        } catch (error) {
            console.error('Error buscando usuario:', error);
            searchResultsListDiv.innerHTML = `<p class="error">Error al buscar usuarios: ${error.message}</p>`;
        }
    }

    function renderResults(usersData, originalQuery) {
        if (!Array.isArray(usersData)) { // Si la API devuelve un solo usuario (búsqueda por ID exacto)
            usersData = [usersData];
        }

        if (usersData.length === 0) {
            searchResultsListDiv.innerHTML = `<p class="error">No se encontraron usuarios para: "${escapeHtml(originalQuery)}"</p>`;
            return;
        }

        let listHTML = '<ul>';
        usersData.forEach(user => {
            // Asumimos que el usuario tiene 'userId', 'pushname', 'money', 'bank'.
            // Necesitaríamos una forma de obtener la URL de la foto de perfil si existiera.
            const totalMoney = (user.money || 0) + (user.bank || 0);
            const profilePicSrc = user.profilePhotoPath ? `/${user.profilePhotoPath}` : 'placeholder-profile.jpg';

            listHTML += `
                <li class="search-result-item" data-userid="${escapeHtml(user.userId)}">
                    <img src="${profilePicSrc}" alt="Perfil de ${escapeHtml(user.pushname) || 'Usuario'}" class="result-profile-pic">
                    <span class="result-username">${highlightMatch(escapeHtml(user.pushname) || 'N/A', originalQuery)}</span>
                    <span class="result-money">${FRONTEND_MONEY_SYMBOL}${totalMoney.toLocaleString()}</span>
                </li>`;
        });
        listHTML += '</ul>';
        searchResultsListDiv.innerHTML = listHTML;

        // Añadir event listeners a los items de la lista (sin cambios aquí)
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const userIdToView = item.dataset.userid;
                window.location.href = `profile.html?id=${encodeURIComponent(userIdToView)}`;
            });
        });

        // Para la animación de aparición escalonada (si la tienes)
        const items = searchResultsListDiv.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 75); 
        });
    }

    async function fetchAndDisplayUserProfile(userId) {
        if (!userProfileDetailDiv) return;
        userProfileDetailDiv.innerHTML = '<p>Cargando perfil...</p>';
        userProfileDetailDiv.style.display = 'block';
        if (profileSeparator) profileSeparator.style.display = 'block';


        try {
            // La API ya debería devolver todos los detalles con /api/user/:userId
            const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(userId)}`);
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}. Detalle: ${errorData}`);
            }
            const user = await response.json();
            displayFullUserInfo(user); // Usaremos una función similar a la de script.js
            userProfileDetailDiv.classList.add('visible'); // Mostrar con animación
        } catch (error) {
            userProfileDetailDiv.innerHTML = `<p class="error">Error al cargar el perfil: ${error.message}</p>`;
            userProfileDetailDiv.classList.add('visible'); // Mostrar el error también
            console.error('Error cargando perfil de usuario:', error);
        }
    }

    function displayFullUserInfo(user) { // Adaptada de script.js
        if (!user) {
            userProfileDetailDiv.innerHTML = '<p class="error">No se pudo mostrar la información del usuario.</p>';
            return;
        }
        // Aquí podrías tener una foto de perfil más grande si la tuvieras
        // <img src="${user.profilePicUrl || 'placeholder-profile.jpg'}" alt="Perfil" class="profile-detail-pic">
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


    // Funciones auxiliares (copiadas/adaptadas de script.js para ser autocontenido)
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
        const safeQuery = escapeRegex(String(query));
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
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
});