// public/profile.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api';
    const FRONTEND_MONEY_SYMBOL = '💰';

    // --- Elementos del DOM de la Página de Perfil Principal ---
    const userCoverPhotoElement = document.getElementById('userCoverPhoto'); // La <img> de portada
    const userProfilePhotoElement = document.getElementById('userProfilePhoto'); // La <img> de perfil
    const userProfileNameH1 = document.getElementById('userProfileName');
    const userProfileRankBadge = document.getElementById('userProfileRankBadge');

    const userFollowersSpan = document.getElementById('userFollowers');
    const userFollowingSpan = document.getElementById('userFollowing');
    const userMoneyTotalSpan = document.getElementById('userMoneyTotal');
    const userExperienceSpan = document.getElementById('userExperience');
    const userFullDetailsDiv = document.getElementById('userFullDetails');

    const profileInfoActionsDiv = document.querySelector('.profile-info-actions');
    const sidebarMyProfileLinkContainer = document.getElementById('sidebarMyProfileLinkContainer');

    // --- Elementos del DOM del Modal de Lista de Seguidores/Siguiendo ---
    const followListModal = document.getElementById('followListModal');
    const closeFollowListModalButton = document.getElementById('closeFollowListModal');
    const tabFollowersButton = document.getElementById('tabFollowers');
    const tabFollowingButton = document.getElementById('tabFollowing');
    const modalUserListContainer = document.getElementById('modalUserListContainer');

    // --- Elementos del DOM del Modal de Edición de Imagen ---
    const imageEditModal = document.getElementById('imageEditModal');
    const closeImageEditModalButton = document.getElementById('closeImageEditModal');
    const imageEditModalTitle = document.getElementById('imageEditModalTitle');
    const imageEditPreview = document.getElementById('imageEditPreview');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const triggerImageUploadButton = document.getElementById('triggerImageUploadButton');
    const saveImageButton = document.getElementById('saveImageButton');
    const uploadStatusMessage = document.getElementById('uploadStatusMessage');

    // --- Botón de Seguir/Dejar de Seguir (Principal) ---
    const followButtonContainer = document.createElement('div');
    followButtonContainer.className = 'profile-action-buttons';
    const followButton = document.createElement('button');
    followButton.id = 'followToggleButton';
    // El listener se añade una sola vez en initializeProfilePage después de crear el botón

    // Elementos para la edición de nombre
    const editNameContainer = document.getElementById('editNameContainer');
    const editNameInput = document.getElementById('editNameInput');
    const saveNameButton = document.getElementById('saveNameButton');
    const cancelEditNameButton = document.getElementById('cancelEditNameButton');
    const editNameStatus = document.getElementById('editNameStatus');

    // --- Elementos del DOM para Spotify ---
    const connectSpotifyButton = document.getElementById('connectSpotifyButton');
    const disconnectSpotifyButton = document.getElementById('disconnectSpotifyButton');
    const spotifyStatusText = document.getElementById('spotifyStatusText');
    const spotifyInfoDiv = document.getElementById('spotifyInfo');
    const spotifyDisplayNameSpan = document.getElementById('spotifyDisplayName');
    const spotifyProfileImage = document.getElementById('spotifyProfileImage');
    const testConnectBtn = document.getElementById('connectSpotifyButton');
    console.log('Boton Conectar al inicio del DOMContentLoaded:', testConnectBtn); // ¿Es null?

    let isEditingName = false;

    // --- Estado Global del Script ---
    let viewingUserId = null;
    let loggedInUserId = null;
    let currentUserData = null;
    let currentModalTab = 'followers';
    let userIdForModalList = null;
    let currentImageTypeToEdit = null;
    let selectedFile = null;


    // =========================================================================
    // INICIALIZACIÓN DE LA PÁGINA DE PERFIL
    // =========================================================================
    async function initializeProfilePage() {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser && parsedUser.userId) {
                    loggedInUserId = parsedUser.userId;
                }
            } catch (e) { console.error("Error parseando loggedInUser de localStorage", e); }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryUserId = urlParams.get('id');
        let viendoMiPropioPerfil = false;

        if (queryUserId) {
            viewingUserId = queryUserId;
            viendoMiPropioPerfil = loggedInUserId && viewingUserId === loggedInUserId;
        } else if (loggedInUserId) {
            viewingUserId = loggedInUserId; // Viendo mi propio perfil por defecto si no hay ID en URL
            window.history.replaceState({}, document.title, `${window.location.pathname}?id=${loggedInUserId}`); // Actualizar URL
            viendoMiPropioPerfil = true;
        } else {
            // No hay queryUserId ni loggedInUserId, no se puede determinar qué perfil ver.
            // Redirigir a la página de inicio/login o mostrar un error genérico.
            // Por ahora, mostraremos un error y ocultaremos el enlace de "Mi Perfil".
            displayProfileError("Perfil no disponible. Por favor, inicia sesión o especifica un perfil para ver.");
            if (sidebarMyProfileLinkContainer) sidebarMyProfileLinkContainer.style.display = 'none';
            // Ocultar sección de Spotify si no se puede determinar el perfil
            const spotifySection = document.getElementById('spotifyProfileSection');
            if(spotifySection) spotifySection.style.display = 'none';
            return;
        }

        // Añadir botón de seguir/dejar de seguir (si no es mi perfil)
        if (profileInfoActionsDiv) {
             // Asegurarse de que el botón de seguir/dejar de seguir y el contenedor de edición de nombre
             // estén en el orden correcto y solo se muestren si es aplicable.
            if (editNameContainer && userProfileNameH1 && followButtonContainer) {
                // Colocar el editNameContainer (si existe) después del H1
                if (userProfileNameH1.nextSibling !== editNameContainer) {
                     userProfileNameH1.parentNode.insertBefore(editNameContainer, userProfileNameH1.nextSibling);
                }
                // Colocar el followButtonContainer después del editNameContainer
                if (editNameContainer.nextSibling !== followButtonContainer) {
                    editNameContainer.parentNode.insertBefore(followButtonContainer, editNameContainer.nextSibling);
                }
            } else if (userProfileNameH1 && followButtonContainer) { // Si no hay editNameContainer
                if (userProfileNameH1.nextSibling !== followButtonContainer) {
                    userProfileNameH1.parentNode.insertBefore(followButtonContainer, userProfileNameH1.nextSibling);
                }
            }
            // Añadir listener al botón de seguir una vez que está en el DOM (o asegurarse de que ya lo tiene)
            if (!followButton.onclick) { // Añadir solo si no existe ya
                followButton.addEventListener('click', handleFollowToggle);
            }
        }

        updateSidebarMyProfileLink(viendoMiPropioPerfil);
        await loadUserProfileData(viewingUserId); // Esperar a que los datos se carguen

        // Comprobar parámetros de Spotify después de cargar el perfil
        const urlParamsOnLoad = new URLSearchParams(window.location.search);
        const spotifyError = urlParamsOnLoad.get('spotify_error');
        const spotifyLinked = urlParamsOnLoad.get('spotify_linked');

        if (spotifyError) {
            let message = "Ocurrió un error con la vinculación de Spotify.";
            if (spotifyError === 'state_mismatch') message = "Error de validación de Spotify. Intenta de nuevo.";
            else if (spotifyError === 'callback_failed') message = "Fallo en la comunicación con Spotify. Intenta de nuevo.";
            else if (spotifyError === 'app_user_id_missing') message = "Error interno: Falta ID de usuario de la app. Contacta soporte.";
            else if (spotifyError === 'spotify_account_already_linked_to_another_app_user') message = "Esa cuenta de Spotify ya está vinculada a otro usuario de esta aplicación.";
            else if (spotifyError === 'access_denied') message = "No has concedido los permisos necesarios en Spotify.";
            else message = `Error de Spotify: ${decodeURIComponent(spotifyError)}`;


            if (spotifyStatusText) {
                spotifyStatusText.textContent = message;
                spotifyStatusText.style.color = 'var(--error-color)';
                spotifyStatusText.style.display = 'block';
            }
            window.history.replaceState({}, document.title, `${window.location.pathname}?id=${viewingUserId}`);
        } else if (spotifyLinked === 'true') {
            if (spotifyStatusText) {
                spotifyStatusText.textContent = "¡Cuenta de Spotify vinculada exitosamente! La información se está actualizando...";
                spotifyStatusText.style.color = 'var(--success-color)';
                spotifyStatusText.style.display = 'block';
            }
            // Los datos del perfil ya se deberían haber cargado, incluyendo los de Spotify si el callback funcionó
            // setupSpotifySection(currentUserData) se llamará dentro de displayUserProfileData
            window.history.replaceState({}, document.title, `${window.location.pathname}?id=${viewingUserId}`);
        }
    }


    function displayProfileError(message) {
        if (userProfileNameH1) userProfileNameH1.textContent = "Error";
        if (userFullDetailsDiv) userFullDetailsDiv.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
        if (document.querySelector('.profile-stats')) document.querySelector('.profile-stats').style.display = 'none';
        if (followButtonContainer) followButtonContainer.innerHTML = ''; // Limpiar botón de seguir
        const spotifySection = document.getElementById('spotifyProfileSection');
        if(spotifySection) spotifySection.style.display = 'none';
    }

    function updateSidebarMyProfileLink(esMiPerfil) {
        if (sidebarMyProfileLinkContainer) {
            const link = sidebarMyProfileLinkContainer.querySelector('a');
            if (esMiPerfil) {
                sidebarMyProfileLinkContainer.style.display = 'list-item';
                if (link) {
                    link.classList.add('active');
                    link.href = `profile.html?id=${loggedInUserId}`; // Asegurar que siempre lleve a mi perfil
                }
                document.querySelectorAll('.sidebar ul > li > a:not([href^="profile.html"])').forEach(a => a.classList.remove('active'));
            } else {
                // No ocultarlo necesariamente, sino quitarle el 'active' si estamos viendo el perfil de otro
                // sidebarMyProfileLinkContainer.style.display = 'none';
                if (link) link.classList.remove('active');
            }
        }
    }

    // =========================================================================
    // CARGA Y VISUALIZACIÓN DE DATOS DEL PERFIL PRINCIPAL
    // =========================================================================
    async function loadUserProfileData(userIdToLoad) {
        if (!userIdToLoad) {
            console.error("loadUserProfileData: userIdToLoad es nulo.");
            displayProfileError("No se especificó un ID de usuario para cargar el perfil.");
            return;
        }
        setPlaceholders(true);
        try {
            let fetchUrl = `${API_BASE_URL}/user/${encodeURIComponent(userIdToLoad)}`;
            if (loggedInUserId) { // Solo añadir viewerId si el usuario está logueado
                fetchUrl += `?viewerId=${encodeURIComponent(loggedInUserId)}`;
            }

            const response = await fetch(fetchUrl);
            if (!response.ok) {
                let errorMsg = `Error ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) { /* No hacer nada si no es JSON */ }
                throw new Error(errorMsg);
            }
            currentUserData = await response.json();
            if (!currentUserData || !currentUserData.userId) { // Verificar que el userId exista en la respuesta
                throw new Error("Datos de usuario no recibidos o incompletos de la API.");
            }
            displayUserProfileData(currentUserData);
        } catch (error) {
            console.error('Error cargando datos del perfil:', error.message, error);
            displayProfileError(`No se pudo cargar la información del perfil: ${error.message}`);
        } finally {
            setPlaceholders(false);
        }
    }

    function setPlaceholders(isLoading) {
        // ... (código de setPlaceholders sin cambios)
        if (isLoading) {
            if (userCoverPhotoElement) userCoverPhotoElement.src = 'placeholder-cover.jpg';
            if (userProfilePhotoElement) userProfilePhotoElement.src = 'placeholder-profile.jpg';
            if (userProfileNameH1) userProfileNameH1.textContent = 'Cargando...';
            if (userFollowersSpan) userFollowersSpan.textContent = '--';
            if (userFollowingSpan) userFollowingSpan.textContent = '--';
            if (userMoneyTotalSpan) userMoneyTotalSpan.textContent = '--';
            if (userExperienceSpan) userExperienceSpan.textContent = '--';
            if (userFullDetailsDiv) userFullDetailsDiv.innerHTML = '<p>Cargando detalles...</p>';
            if (userProfileRankBadge) userProfileRankBadge.style.display = 'none';
            if (spotifyStatusText) spotifyStatusText.textContent = 'Comprobando estado de Spotify...';
            if (connectSpotifyButton) connectSpotifyButton.style.display = 'none';
            if (disconnectSpotifyButton) disconnectSpotifyButton.style.display = 'none';
            if (spotifyInfoDiv) spotifyInfoDiv.style.display = 'none';

        }
    }

    function displayUserProfileData(user) {
        // ... (lógica de displayUserProfileData sin cambios hasta la llamada a setupSpotifySection)
        if (!user) { displayProfileError("Datos de usuario no válidos."); return; }
        currentUserData = user; // Actualizar estado global

        document.title = `${escapeHtml(user.pushname) || 'Usuario'} - Perfil`;
        if (userProfileNameH1) {
            userProfileNameH1.textContent = escapeHtml(user.pushname) || 'Usuario Desconocido';
            if (loggedInUserId && user.userId === loggedInUserId) {
                userProfileNameH1.classList.add('editable-name');
                userProfileNameH1.title = "Haz clic para cambiar tu nombre";
                if(editNameContainer) editNameContainer.style.display = 'none'; // Ocultar input de edición al cargar
            } else {
                userProfileNameH1.classList.remove('editable-name');
                userProfileNameH1.title = "";
                if(editNameContainer) editNameContainer.style.display = 'none'; // Ocultar si no es mi perfil
            }
        }

        if (userCoverPhotoElement) userCoverPhotoElement.src = user.coverPhotoPath || 'placeholder-cover.jpg';
        if (userProfilePhotoElement) userProfilePhotoElement.src = user.profilePhotoPath || 'placeholder-profile.jpg';

        if (userFollowersSpan) userFollowersSpan.textContent = (user.followersCount === undefined ? '--' : (user.followersCount || 0).toLocaleString());
        if (userFollowingSpan) userFollowingSpan.textContent = (user.followingCount === undefined ? '--' : (user.followingCount || 0).toLocaleString());
        if (userMoneyTotalSpan) userMoneyTotalSpan.textContent = `${FRONTEND_MONEY_SYMBOL}${((user.money || 0) + (user.bank || 0)).toLocaleString()}`;
        if (userExperienceSpan) userExperienceSpan.textContent = (user.exp === undefined ? '--' : (user.exp || 0).toLocaleString());

        updateFollowButtonState(user);
        updateRankBadge(user.rank);
        displayFullUserDetails(user);

        if (loggedInUserId && user.userId === loggedInUserId) {
            if (window.updateGlobalUserUI) {
                window.updateGlobalUserUI(user); // Actualiza sidebar/header
            }
        }
        makeImagesEditableIfMyProfile(user.userId === loggedInUserId);
        console.log("[ProfileLoad] Datos del usuario recibidos del backend:", JSON.parse(JSON.stringify(user)));
        setupSpotifySection(user); // <--- LLAMAR A LA FUNCIÓN DE SPOTIFY AQUÍ
    }

    // --- Lógica de Spotify ---
    function setupSpotifySection(userData) {
        const spotifySection = document.getElementById('spotifyProfileSection');
    
        // Logs de depuración al inicio de la función
        console.log("[SpotifyDebug] Entrando a setupSpotifySection. Viewing:", viewingUserId, "Logged In:", loggedInUserId);
        console.log("[SpotifyDebug] userData recibida:", userData ? JSON.parse(JSON.stringify(userData)) : 'null o undefined');
    
        // Verificación única de que todos los elementos necesarios existen
        if (!spotifySection || !connectSpotifyButton || !disconnectSpotifyButton || !spotifyStatusText || !spotifyInfoDiv || !spotifyDisplayNameSpan || !spotifyProfileImage) {
            console.warn("[SpotifyDebug] Uno o más elementos de la sección Spotify NO fueron encontrados en el DOM. La sección podría no mostrarse o no funcionar correctamente.");
            if (spotifySection) {
                spotifySection.style.display = 'none'; // Ocultar si faltan elementos cruciales
                spotifySection.classList.remove('visible');
            }
            return; // Salir si falta algún elemento esencial
        }
    
        // Si todos los elementos existen, la clase .user-info-card ya debería manejar display:block.
        // La visibilidad real (opacidad) será controlada por la clase .visible.
    
        if (!userData) {
            console.log("[SpotifyDebug] userData es null o undefined. No se puede configurar la sección de Spotify.");
            spotifyStatusText.textContent = 'No se pudieron cargar los datos del usuario para Spotify.';
            spotifyStatusText.style.display = 'block';
            connectSpotifyButton.style.display = 'none';
            disconnectSpotifyButton.style.display = 'none';
            spotifyInfoDiv.style.display = 'none';
            spotifySection.classList.remove('visible'); // Asegurarse que no sea visible si no hay datos
            return;
        }
    
        const isMyProfile = viewingUserId === loggedInUserId;
        console.log("[SpotifyDebug] isMyProfile:", isMyProfile);
        // Asumimos que si userData.spotify_user_id existe (y no es null/undefined), está vinculado.
        // Tu backend debería devolver null o no incluir la propiedad spotify_user_id si no hay vinculación.
        const isLinkedToSpotify = !!userData.spotify_user_id;
        console.log("[SpotifyDebug] isLinkedToSpotify (basado en userData.spotify_user_id):", isLinkedToSpotify, "(valor:", userData.spotify_user_id, ")");
    
    
        if (isLinkedToSpotify) { // Usuario vinculado
            console.log("[SpotifyDebug] Usuario vinculado a Spotify.");
            spotifyStatusText.style.display = 'none'; // Ocultar texto de estado si está vinculado
    
            spotifyDisplayNameSpan.textContent = userData.spotify_display_name || 'Usuario de Spotify';
            if (userData.spotify_profile_image_url) {
                spotifyProfileImage.src = userData.spotify_profile_image_url;
                spotifyProfileImage.style.display = 'block'; // O 'inline-block' si prefieres
            } else {
                spotifyProfileImage.style.display = 'none';
            }
            spotifyInfoDiv.style.display = 'block'; // O 'flex' si es un contenedor flex
    
            if (isMyProfile) {
                console.log("[SpotifyDebug] Es mi perfil y está vinculado: Mostrar Desvincular.");
                connectSpotifyButton.style.display = 'none';
                disconnectSpotifyButton.style.display = 'inline-block';
            } else {
                console.log("[SpotifyDebug] Es perfil de otro y está vinculado: No mostrar botones de acción.");
                connectSpotifyButton.style.display = 'none';
                disconnectSpotifyButton.style.display = 'none';
            }
        } else { // Usuario NO vinculado
            console.log("[SpotifyDebug] Usuario NO vinculado a Spotify.");
            spotifyInfoDiv.style.display = 'none'; // Ocultar info de perfil de Spotify
    
            if (isMyProfile) {
                console.log("[SpotifyDebug] Es mi perfil y NO está vinculado: Mostrar Conectar.");
                spotifyStatusText.textContent = 'Vincula tu cuenta de Spotify para compartir tu música.';
                spotifyStatusText.style.display = 'block';
                connectSpotifyButton.style.display = 'inline-block'; // Mostrar el botón de conectar
                disconnectSpotifyButton.style.display = 'none';
            } else {
                console.log("[SpotifyDebug] Es perfil de otro y NO está vinculado.");
                spotifyStatusText.textContent = `${escapeHtml(userData.pushname || 'Este usuario')} no ha vinculado su Spotify.`;
                spotifyStatusText.style.display = 'block';
                connectSpotifyButton.style.display = 'none';
                disconnectSpotifyButton.style.display = 'none';
            }
        }
    
        // Finalmente, después de configurar el contenido interno,
        // hacer visible la sección de Spotify (esto activará la animación CSS)
        spotifySection.classList.add('visible');
    }
    


    if (connectSpotifyButton) {
        connectSpotifyButton.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `${API_BASE_URL}/spotify/login?app_user_id=${encodeURIComponent(loggedInUserId)}`;
            } else {
                alert("Debes iniciar sesión para vincular tu cuenta de Spotify.");
                // Opcional: redirigir al login
                // window.location.href = '/';
            }
        });
    }

    if (disconnectSpotifyButton) {
        disconnectSpotifyButton.addEventListener('click', async () => {
            if (loggedInUserId) {
                if (!confirm("¿Estás seguro de que quieres desvincular tu cuenta de Spotify?")) {
                    return;
                }
                disconnectSpotifyButton.disabled = true;
                disconnectSpotifyButton.textContent = 'Desvinculando...';
                try {
                    const response = await fetch(`${API_BASE_URL}/spotify/unlink`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ app_user_id: loggedInUserId })
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message || "Cuenta de Spotify desvinculada.");
                        // Actualizar UI: recargar datos del perfil para reflejar desvinculación
                        // O modificar currentUserData y llamar a setupSpotifySection
                        if (currentUserData) {
                            currentUserData.spotify_user_id = null;
                            currentUserData.spotify_display_name = null;
                            currentUserData.spotify_profile_image_url = null;
                            // Actualizar localStorage si es el usuario logueado
                             const storedUser = localStorage.getItem('loggedInUser');
                             if(storedUser){
                                 const parsedUser = JSON.parse(storedUser);
                                 if(parsedUser.userId === loggedInUserId){
                                     parsedUser.spotify_user_id = null; // Asumimos que estos campos están en el objeto del localStorage
                                     parsedUser.spotify_display_name = null;
                                     localStorage.setItem('loggedInUser', JSON.stringify(parsedUser));
                                     if(window.updateGlobalUserUI) window.updateGlobalUserUI(parsedUser);
                                 }
                             }
                            setupSpotifySection(currentUserData);
                        }
                    } else {
                        alert(`Error: ${result.message || 'No se pudo desvincular.'}`);
                    }
                } catch (error) {
                    console.error("Error desvinculando Spotify:", error);
                    alert("Error de red al intentar desvincular Spotify.");
                } finally {
                    disconnectSpotifyButton.disabled = false;
                    disconnectSpotifyButton.textContent = 'Desvincular Spotify';
                }
            }
        });
    }
    // --- Fin Lógica de Spotify ---


    // ... (resto del código de profile.js: toggleNameEditMode, listeners de nombre,
    //      updateFollowButtonState, updateRankBadge, displayFullUserDetails,
    //      makeImagesEditableIfMyProfile, handleFollowToggle,
    //      lógica de modales, openImageEditModal, listeners de imagen,
    //      funciones auxiliares escapeHtml, formatTimestamp) ...

    // Copio el resto del código que me diste para que esté completo:

    function toggleNameEditMode(editMode) {
        isEditingName = editMode;
        if (editMode) {
            userProfileNameH1.style.display = 'none';
            editNameContainer.style.display = 'flex';
            editNameInput.value = currentUserData ? (currentUserData.pushname || '') : '';
            editNameInput.focus();
            editNameStatus.style.display = 'none';
            editNameStatus.textContent = '';
            if (profileInfoActionsDiv && followButtonContainer.parentElement === profileInfoActionsDiv) {
                 profileInfoActionsDiv.insertBefore(editNameContainer, followButtonContainer);
            } else if (profileInfoActionsDiv) {
                 profileInfoActionsDiv.appendChild(editNameContainer);
            }
        } else {
            userProfileNameH1.style.display = 'block';
            editNameContainer.style.display = 'none';
             if (profileInfoActionsDiv && userProfileNameH1.nextSibling !== followButtonContainer) {
                profileInfoActionsDiv.insertBefore(followButtonContainer, userProfileNameH1.nextSibling);
            }
        }
    }

    if (userProfileNameH1) {
        userProfileNameH1.addEventListener('click', () => {
            if (loggedInUserId && viewingUserId === loggedInUserId && !isEditingName) {
                toggleNameEditMode(true);
            }
        });
    }

    if (saveNameButton) {
        saveNameButton.addEventListener('click', async () => {
            const newName = editNameInput.value.trim();
            editNameInput.classList.remove('input-error-pulse');
            editNameStatus.style.display = 'none';
            editNameStatus.textContent = '';
            editNameStatus.className = 'message-area';

            if (newName.length < 3 || newName.length > 25) {
                editNameStatus.textContent = "El nombre debe tener entre 3 y 25 caracteres.";
                editNameStatus.className = 'message-area error visible';
                editNameInput.classList.add('input-error-pulse');
                editNameInput.focus();
                setTimeout(() => { editNameInput.classList.remove('input-error-pulse'); }, 1500);
                return;
            }
            if (currentUserData && newName === currentUserData.pushname) {
                toggleNameEditMode(false); return;
            }
            saveNameButton.disabled = true; saveNameButton.textContent = 'Guardando...';
            editNameStatus.textContent = 'Guardando nombre...'; editNameStatus.className = 'message-area visible';
            editNameStatus.classList.remove('success', 'error');
            try {
                const response = await fetch(`${API_BASE_URL}/user/update-name`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newName: newName, userId: loggedInUserId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Error al actualizar.');
                editNameStatus.textContent = result.message; editNameStatus.classList.add('success');
                if (currentUserData) {
                    currentUserData.pushname = newName;
                    localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));
                    if (window.updateGlobalUserUI) window.updateGlobalUserUI(currentUserData);
                    displayUserProfileData(currentUserData);
                }
                saveNameButton.disabled = false; saveNameButton.textContent = 'Guardar';
                setTimeout(() => toggleNameEditMode(false), 1500);
            } catch (error) {
                console.error("Error actualizando nombre:", error);
                editNameStatus.textContent = `Error: ${error.message}`;
                editNameStatus.classList.add('error');
                saveNameButton.disabled = false; saveNameButton.textContent = 'Guardar';
            }
        });
    }
    if(editNameInput) {
        editNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && isEditingName) { e.preventDefault(); saveNameButton.click(); }
        });
    }
    if (cancelEditNameButton) {
        cancelEditNameButton.addEventListener('click', () => toggleNameEditMode(false));
    }

    function updateFollowButtonState(user) {
        followButtonContainer.innerHTML = '';
        if (loggedInUserId && viewingUserId !== loggedInUserId && user) { // Añadido chequeo de user
            followButton.textContent = user.isFollowing ? 'Dejar de Seguir' : 'Seguir';
            followButton.className = user.isFollowing ? 'button-unfollow' : 'button-follow';
            followButtonContainer.appendChild(followButton);
            followButton.style.display = 'inline-block';
            followButton.disabled = false;
        } else {
            followButton.style.display = 'none'; // Ocultar si es mi perfil o no hay datos
        }
    }
    function updateRankBadge(rank) {
        if (userProfileRankBadge) {
            if (rank !== null && rank !== undefined) {
                userProfileRankBadge.innerHTML = (rank === 1) ? '🥇' : (rank === 2) ? '🥈' : (rank === 3) ? '🥉' : rank.toString();
                userProfileRankBadge.style.display = 'flex';
            } else {
                userProfileRankBadge.style.display = 'none';
            }
        }
    }

    function displayFullUserDetails(user) {
        if (userFullDetailsDiv && user) { // Añadido chequeo de user
            let detailsHTML = `<h4>Más sobre ${escapeHtml(user.pushname || 'este usuario')}:</h4>`;
            detailsHTML += `<p><strong>ID:</strong> ${escapeHtml(user.userId)}</p>`;
            detailsHTML += `<p><strong>Últ. Daily:</strong> ${formatTimestamp(user.lastdaily)}</p>`;
            detailsHTML += `<p><strong>Racha Daily:</strong> ${user.dailystreak || 0} día(s)</p>`;
            detailsHTML += `<p><strong>Últ. Trabajo:</strong> ${formatTimestamp(user.lastwork)}</p>`;
            detailsHTML += `<p><strong>Últ. Robo:</strong> ${formatTimestamp(user.laststeal)}</p>`;
            detailsHTML += `<p><strong>Últ. Crimen:</strong> ${formatTimestamp(user.lastcrime)}</p>`;
            detailsHTML += `<p><strong>Últ. "Cita":</strong> ${formatTimestamp(user.lastslut)}</p>`;
            detailsHTML += `<p><strong>Últ. Ruleta:</strong> ${formatTimestamp(user.lastroulette)}</p>`;
            detailsHTML += `<p><strong>Últ. Slots:</strong> ${formatTimestamp(user.lastslots)}</p>`;

            userFullDetailsDiv.innerHTML = detailsHTML;
            userFullDetailsDiv.classList.add('visible');
        } else if (userFullDetailsDiv) {
            userFullDetailsDiv.innerHTML = '<p>No hay detalles adicionales para mostrar.</p>';
        }
    }

    function makeImagesEditableIfMyProfile(isMyProfile) {
        const coverPhotoContainer = userCoverPhotoElement ? userCoverPhotoElement.parentElement : null;
        const profilePhotoContainer = userProfilePhotoElement ? userProfilePhotoElement.parentElement : null;
        [coverPhotoContainer, profilePhotoContainer].forEach(container => {
            if (container) {
                if (isMyProfile) {
                    container.classList.add('editable');
                    container.title = `Cambiar foto de ${container === coverPhotoContainer ? 'portada' : 'perfil'}`;
                    container.onclick = () => {
                        const imageType = container === coverPhotoContainer ? 'cover' : 'profile';
                        const currentImage = imageType === 'cover' ?
                            (currentUserData?.coverPhotoPath || 'placeholder-cover.jpg') :
                            (currentUserData?.profilePhotoPath || 'placeholder-profile.jpg');
                        openImageEditModal(imageType, currentImage);
                    };
                } else {
                    container.classList.remove('editable'); container.title = ""; container.onclick = null;
                }
            }
        });
    }

    async function handleFollowToggle() {
        if (!loggedInUserId || !viewingUserId || loggedInUserId === viewingUserId || !currentUserData) return;
        const currentlyFollowing = currentUserData.isFollowing;
        const action = currentlyFollowing ? 'unfollow' : 'follow';
        followButton.disabled = true; followButton.textContent = 'Procesando...';
        try {
            const response = await fetch(`${API_BASE_URL}/user/${viewingUserId}/${action}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followerId: loggedInUserId })
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Error al ${action}`);}
            currentUserData.isFollowing = !currentlyFollowing;
            if (userFollowersSpan) {
                 currentUserData.followersCount = (currentUserData.followersCount || 0) + (!currentlyFollowing ? 1 : -1);
                 if(currentUserData.followersCount < 0) currentUserData.followersCount = 0;
            }
            // Para el usuario logueado, si es el que está viendo su propio perfil (aunque este botón no debería mostrarse)
            // o si necesitamos actualizar el contador de "siguiendo" del usuario logueado globalmente.
            const storedUserRaw = localStorage.getItem('loggedInUser');
            if(storedUserRaw){
                const storedUser = JSON.parse(storedUserRaw);
                if(storedUser.userId === loggedInUserId){
                    storedUser.followingCount = (storedUser.followingCount || 0) + (!currentlyFollowing ? 1 : -1);
                    if(storedUser.followingCount < 0) storedUser.followingCount = 0;
                    localStorage.setItem('loggedInUser', JSON.stringify(storedUser));
                    if(window.updateGlobalUserUI) window.updateGlobalUserUI(storedUser);
                }
            }
            displayUserProfileData(currentUserData);
        } catch (error) {
            console.error(`Error en acción ${action}:`, error); alert(`Error: ${error.message}`);
            loadUserProfileData(viewingUserId);
        }
    }

    function openFollowListModal(tabToOpen = 'followers') {
        if (!followListModal || !viewingUserId) return;
        userIdForModalList = viewingUserId; currentModalTab = tabToOpen;
        updateModalTabsUI(); loadUsersForModalList(currentModalTab);
        followListModal.style.display = 'flex';
        setTimeout(() => { followListModal.classList.add('visible'); document.body.classList.add('modal-open-no-scroll'); }, 10);
    }
    function closeModal(modalElement) {
        if (!modalElement) return;
        modalElement.classList.remove('visible'); document.body.classList.remove('modal-open-no-scroll');
        setTimeout(() => { if (!modalElement.classList.contains('visible')) modalElement.style.display = 'none';
        }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-speed-normal') || '0.3') * 1000);
    }
    function updateModalTabsUI() {
        if (!tabFollowersButton || !tabFollowingButton) return;
        tabFollowersButton.classList.toggle('active', currentModalTab === 'followers');
        tabFollowingButton.classList.toggle('active', currentModalTab === 'following');
    }
    async function loadUsersForModalList(tabName) {
        // ... (código de loadUsersForModalList sin cambios)
        if (!modalUserListContainer || !userIdForModalList) return;
        modalUserListContainer.innerHTML = '<p>Cargando...</p>';
        const endpoint = tabName === 'followers' ? 'followers' : 'following';
        try {
            const fetchUrl = loggedInUserId
                ? `${API_BASE_URL}/user/${userIdForModalList}/${endpoint}?viewerId=${loggedInUserId}`
                : `${API_BASE_URL}/user/${userIdForModalList}/${endpoint}`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`Error al cargar la lista de ${tabName}`);
            const users = await response.json();
            renderUserListInModal(users, tabName);
        } catch (error) {
            console.error(error);
            modalUserListContainer.innerHTML = `<p class="error">No se pudo cargar la lista: ${error.message}</p>`;
        }
    }
    function renderUserListInModal(users, tabType) {
        // ... (código de renderUserListInModal sin cambios)
        if (!modalUserListContainer) return;
        if (!users || users.length === 0) {
            modalUserListContainer.innerHTML = `<p>No hay ${tabType === 'followers' ? 'seguidores' : 'usuarios seguidos'} para mostrar.</p>`;
            return;
        }
        const ul = document.createElement('ul');
        users.forEach(userInList => {
            const li = document.createElement('li');
            li.className = 'modal-user-list-item';
            li.dataset.userIdInList = userInList.userId;
            let actionButtonHtml = '';
            if (loggedInUserId) {
                if (loggedInUserId === userInList.userId) { /* No action for self */ }
                else if (tabType === 'following' && userIdForModalList === loggedInUserId) { // Estoy viendo mi lista de "siguiendo"
                    actionButtonHtml = `<button class="follow-action-btn button-unfollow" data-action="unfollow" data-target-userId="${userInList.userId}">Dejar de seguir</button>`;
                } else if (tabType === 'followers' && userIdForModalList === loggedInUserId) { // Estoy viendo mi lista de "seguidores"
                    actionButtonHtml = `<button class="follow-action-btn button-remove-follower" data-action="remove-follower" data-target-userId="${userInList.userId}">Eliminar</button>`;
                } else if (userIdForModalList !== loggedInUserId && userInList.isFollowedByViewer !== undefined) { // Estoy viendo el perfil de otro, y sé si sigo a esta persona de la lista
                    actionButtonHtml = userInList.isFollowedByViewer ?
                        `<button class="follow-action-btn button-unfollow" data-action="unfollow" data-target-userId="${userInList.userId}">Dejar de seguir</button>` :
                        `<button class="follow-action-btn button-follow" data-action="follow" data-target-userId="${userInList.userId}">Seguir</button>`;
                }
            }
            li.innerHTML = `
                <img src="${userInList.profilePhotoPath || 'placeholder-profile.jpg'}" alt="Perfil" class="profile-pic">
                <span class="username" data-user-id-link="${userInList.userId}">${escapeHtml(userInList.pushname) || 'Usuario'}</span>
                ${actionButtonHtml}`;
            ul.appendChild(li);
        });
        modalUserListContainer.innerHTML = '';
        modalUserListContainer.appendChild(ul);
    }
    if (userFollowersSpan && userFollowersSpan.parentElement) userFollowersSpan.parentElement.addEventListener('click', () => openFollowListModal('followers'));
    if (userFollowingSpan && userFollowingSpan.parentElement) userFollowingSpan.parentElement.addEventListener('click', () => openFollowListModal('following'));
    if (closeFollowListModalButton) closeFollowListModalButton.addEventListener('click', () => closeModal(followListModal));
    if (followListModal) followListModal.addEventListener('click', (e) => { if (e.target === followListModal) closeModal(followListModal); });
    if (tabFollowersButton) tabFollowersButton.addEventListener('click', () => { if (currentModalTab !== 'followers') { currentModalTab = 'followers'; updateModalTabsUI(); loadUsersForModalList('followers'); }});
    if (tabFollowingButton) tabFollowingButton.addEventListener('click', () => { if (currentModalTab !== 'following') { currentModalTab = 'following'; updateModalTabsUI(); loadUsersForModalList('following'); }});

    if (modalUserListContainer) {
        modalUserListContainer.addEventListener('click', async (event) => {
            // ... (código del listener de modalUserListContainer sin cambios)
            const actionButton = event.target.closest('.follow-action-btn[data-action]');
            const usernameLink = event.target.closest('.username[data-user-id-link]');

            if (usernameLink) { closeModal(followListModal); window.location.href = `profile.html?id=${encodeURIComponent(usernameLink.dataset.userIdLink)}`; return; }

            if (actionButton && loggedInUserId) {
                const targetUserId = actionButton.dataset.targetUserid;
                const action = actionButton.dataset.action;
                if (!targetUserId || !action) return;

                const originalButtonText = actionButton.textContent;
                actionButton.disabled = true; actionButton.textContent = '...';
                let apiUrl = '', body = {}, method = 'POST';
                if (action === 'follow' || action === 'unfollow') {
                    apiUrl = `${API_BASE_URL}/user/${targetUserId}/${action}`; body = { followerId: loggedInUserId };
                } else if (action === 'remove-follower') {
                    apiUrl = `${API_BASE_URL}/user/${loggedInUserId}/remove-follower`; body = { followerToRemoveId: targetUserId };
                } else { actionButton.disabled = false; actionButton.textContent = originalButtonText; return; }

                try {
                    const response = await fetch(apiUrl, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || `Error: ${action}`); }
                    
                    loadUsersForModalList(currentModalTab);
                    loadUserProfileData(viewingUserId); // Esto actualiza el perfil principal y los contadores
                } catch (error) {
                    console.error(`Error en ${action} desde modal:`, error); alert(`Error: ${error.message}`);
                    actionButton.textContent = originalButtonText; actionButton.disabled = false;
                }
            }
        });
    }

    function openImageEditModal(imageType, currentImageUrl) {
        // ... (código de openImageEditModal sin cambios)
        if (!imageEditModal || !loggedInUserId || viewingUserId !== loggedInUserId) return;
        currentImageTypeToEdit = imageType; selectedFile = null; imageUploadInput.value = '';
        imageEditModalTitle.textContent = imageType === 'profile' ? 'Cambiar Foto de Perfil' : 'Cambiar Foto de Portada';
        imageEditPreview.src = currentImageUrl || (imageType === 'profile' ? 'placeholder-profile.jpg' : 'placeholder-cover.jpg');
        saveImageButton.style.display = 'none';
        uploadStatusMessage.style.display = 'none'; uploadStatusMessage.textContent = ''; uploadStatusMessage.className = 'message-area';
        imageEditModal.style.display = 'flex';
        setTimeout(() => { imageEditModal.classList.add('visible'); document.body.classList.add('modal-open-no-scroll'); }, 10);
    }
    if (closeImageEditModalButton) closeImageEditModalButton.addEventListener('click', () => closeModal(imageEditModal));
    if (imageEditModal) imageEditModal.addEventListener('click', (e) => { if (e.target === imageEditModal) closeModal(imageEditModal); });
    if (triggerImageUploadButton) triggerImageUploadButton.addEventListener('click', () => imageUploadInput.click());
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', (event) => {
            // ... (código del listener de imageUploadInput sin cambios)
            const file = event.target.files[0];
            if (file) {
                selectedFile = file;
                const reader = new FileReader();
                reader.onload = (e) => { imageEditPreview.src = e.target.result; }
                reader.readAsDataURL(file);
                saveImageButton.style.display = 'inline-block';
                uploadStatusMessage.style.display = 'none';
            } else {
                selectedFile = null;
                const currentPath = currentUserData ? 
                    (currentImageTypeToEdit === 'profile' ? currentUserData.profilePhotoPath : currentUserData.coverPhotoPath) 
                    : null;
                imageEditPreview.src = currentPath || (currentImageTypeToEdit === 'profile' ? 'placeholder-profile.jpg' : 'placeholder-cover.jpg');
                saveImageButton.style.display = 'none';
            }
        });
    }
    if (saveImageButton) {
        saveImageButton.addEventListener('click', async () => {
            // ... (código del listener de saveImageButton sin cambios)
            if (!selectedFile || !currentImageTypeToEdit || !loggedInUserId) {
                uploadStatusMessage.textContent = 'Por favor, selecciona un archivo primero.';
                uploadStatusMessage.className = 'message-area error visible'; return;
            }
            saveImageButton.disabled = true; saveImageButton.textContent = 'Subiendo...';
            uploadStatusMessage.textContent = 'Subiendo imagen...';
            uploadStatusMessage.className = 'message-area visible';
            uploadStatusMessage.classList.remove('success', 'error');
            const formData = new FormData();
            formData.append(currentImageTypeToEdit === 'profile' ? 'profileImage' : 'coverImage', selectedFile);
            formData.append('userId', loggedInUserId);
            const endpointSuffix = currentImageTypeToEdit === 'profile' ? '/upload/profile-photo' : '/upload/cover-photo';
            try {
                const response = await fetch(`${API_BASE_URL}/user${endpointSuffix}`, { method: 'POST', body: formData });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || `Error del servidor: ${response.status}`);
                uploadStatusMessage.textContent = result.message || "Imagen subida con éxito.";
                uploadStatusMessage.classList.add('success');
                if (currentUserData) {
                    const pathFieldToUpdate = currentImageTypeToEdit === 'profile' ? 'profilePhotoPath' : 'coverPhotoPath';
                    currentUserData[pathFieldToUpdate] = result.filePath;
                    if (loggedInUserId && viewingUserId === loggedInUserId) {
                        localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));
                        if (window.updateGlobalUserUI) window.updateGlobalUserUI(currentUserData);
                    }
                    displayUserProfileData(currentUserData);
                }
                setTimeout(() => {
                    closeModal(imageEditModal);
                    saveImageButton.textContent = 'Guardar Cambios'; saveImageButton.style.display = 'none';
                    selectedFile = null; imageUploadInput.value = '';
                }, 1500);
            } catch (error) {
                console.error("Error subiendo imagen:", error);
                uploadStatusMessage.textContent = `Error: ${error.message}`;
                uploadStatusMessage.classList.add('error');
                saveImageButton.disabled = false; saveImageButton.textContent = 'Guardar Cambios';
            }
        });
    }

    // --- Funciones Auxiliares ---
    function escapeHtml(unsafe) { if (unsafe === null || typeof unsafe === 'undefined') return ''; return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'"); }
    function formatTimestamp(timestamp) {
        if (timestamp === null || typeof timestamp === 'undefined' || timestamp === 0 || timestamp === '') {
            return 'Nunca';
        }
        let dateObj;
        if (typeof timestamp === 'number') {
            dateObj = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            const numericTimestamp = Number(timestamp);
            if (!isNaN(numericTimestamp) && String(numericTimestamp) === timestamp.trim()) {
                dateObj = new Date(numericTimestamp);
            } else {
                dateObj = new Date(timestamp); // Intentar parsear la cadena directamente
            }
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
            return 'Error al formatear';
        }
    }

    // --- INICIAR LA PÁGINA ---
    initializeProfilePage();
});