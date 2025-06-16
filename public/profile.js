// public/profile.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api';
    const FRONTEND_MONEY_SYMBOL = '💰';

    // --- Elementos del DOM de la Página de Perfil Principal ---
    const userCoverPhotoElement = document.getElementById('userCoverPhoto');
    const userProfilePhotoElement = document.getElementById('userProfilePhoto');
    const userProfileNameH1 = document.getElementById('userProfileName');
    const userProfileRankBadge = document.getElementById('userProfileRankBadge');
    const userFollowersSpan = document.getElementById('userFollowers');
    const userFollowingSpan = document.getElementById('userFollowing');
    const userMoneyTotalSpan = document.getElementById('userMoneyTotal');
    const userExperienceSpan = document.getElementById('userExperience');
    const userFullDetailsDiv = document.getElementById('userFullDetails');
    const profileInfoActionsDiv = document.querySelector('.profile-info-actions');
    const sidebarMyProfileLinkContainer = document.getElementById('sidebarMyProfileLinkContainer');

    // --- Elementos para Publicaciones y Pestañas del Perfil ---
    const profileContentTabsContainer = document.getElementById('profileContentTabsContainer');
    const profileTabs = document.querySelectorAll('.profile-tab-button'); // NodeList de botones de pestaña
    const profileTabPanes = document.querySelectorAll('.profile-tab-pane'); // NodeList de paneles de contenido
    const profileSavedPostsTabButton = document.getElementById('profileSavedPostsTabButton');

    const userProfilePostsSection = document.getElementById('userProfilePostsSection'); // Panel de "Publicaciones"
    const userProfilePostsContainer = document.getElementById('userProfilePostsContainer');
    const loadMoreProfilePostsBtn = document.getElementById('loadMoreProfilePostsBtn');
    const profilePostsUsernamePlaceholder = document.querySelector('.profile-posts-username-placeholder'); // Dentro del h4 de userProfilePostsSection

    const userProfileSavedPostsContainer = document.getElementById('userProfileSavedPostsContainer'); // Contenedor para posts guardados
    const loadMoreProfileSavedPostsBtn = document.getElementById('loadMoreProfileSavedPostsBtn');


    // --- Elementos Modales (existentes) ---
    const followListModal = document.getElementById('followListModal');
    const closeFollowListModalButton = document.getElementById('closeFollowListModal');
    const tabFollowersButton = document.getElementById('tabFollowers');
    const tabFollowingButton = document.getElementById('tabFollowing');
    const modalUserListContainer = document.getElementById('modalUserListContainer');
    const imageEditModal = document.getElementById('imageEditModal');
    const closeImageEditModalButton = document.getElementById('closeImageEditModal');
    const imageEditModalTitle = document.getElementById('imageEditModalTitle');
    const imageEditPreview = document.getElementById('imageEditPreview');
    const imageUploadInput = document.getElementById('imageUploadInput');
    const triggerImageUploadButton = document.getElementById('triggerImageUploadButton');
    const saveImageButton = document.getElementById('saveImageButton');
    const uploadStatusMessage = document.getElementById('uploadStatusMessage');
    const editNameContainer = document.getElementById('editNameContainer');
    const editNameInput = document.getElementById('editNameInput');
    const saveNameButton = document.getElementById('saveNameButton');
    const cancelEditNameButton = document.getElementById('cancelEditNameButton');
    const editNameStatus = document.getElementById('editNameStatus');
    const connectSpotifyButton = document.getElementById('connectSpotifyButton');
    const disconnectSpotifyButton = document.getElementById('disconnectSpotifyButton');
    const spotifyStatusText = document.getElementById('spotifyStatusText');
    const spotifyInfoDiv = document.getElementById('spotifyInfo');
    const spotifyDisplayNameSpan = document.getElementById('spotifyDisplayName');
    const spotifyProfileImage = document.getElementById('spotifyProfileImage');
    
    const followButtonContainer = document.createElement('div');
    followButtonContainer.className = 'profile-action-buttons';
    const followButton = document.createElement('button');
    followButton.id = 'followToggleButton';

    let isEditingName = false;
    let viewingUserId = null;
    let loggedInUserObject = null; 
    let currentUserData = null; 
    let currentModalTab = 'followers';
    let userIdForModalList = null;
    let currentImageTypeToEdit = null;
    let selectedFile = null;

    let profilePostsCurrentPage = 1;
    const profilePostsPerPage = 5;
    let profileSavedPostsCurrentPage = 1;
    const profileSavedPostsPerPage = 5;


    async function initializeProfilePage() {
        const storedUserString = localStorage.getItem('loggedInUser');
        if (storedUserString) {
            try {
                const parsedUser = JSON.parse(storedUserString);
                if (parsedUser && parsedUser.userId) {
                    loggedInUserObject = parsedUser; 
                }
            } catch (e) { console.error("Error parseando loggedInUser de localStorage", e); }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryUserId = urlParams.get('id');
        let viendoMiPropioPerfil = false;
        
        if (queryUserId) {
            viewingUserId = queryUserId;
        } else if (loggedInUserObject && loggedInUserObject.userId) { 
            viewingUserId = loggedInUserObject.userId;
            window.history.replaceState({}, document.title, `${window.location.pathname}?id=${viewingUserId}`);
        } else { 
            displayProfileError("Perfil no disponible. Por favor, inicia sesión o especifica un perfil para ver.");
            if (sidebarMyProfileLinkContainer) sidebarMyProfileLinkContainer.style.display = 'none';
            const spotifySection = document.getElementById('spotifyProfileSection');
            if(spotifySection) spotifySection.style.display = 'none';
            if(profileContentTabsContainer) profileContentTabsContainer.style.display = 'none'; // Ocultar tabs también
            return;
        }
        
        viendoMiPropioPerfil = loggedInUserObject && viewingUserId === loggedInUserObject.userId;

        if (profileInfoActionsDiv) {
            if (editNameContainer && userProfileNameH1 && followButtonContainer) {
                if (userProfileNameH1.nextSibling !== editNameContainer) {
                     userProfileNameH1.parentNode.insertBefore(editNameContainer, userProfileNameH1.nextSibling);
                }
                if (editNameContainer.nextSibling !== followButtonContainer) {
                    editNameContainer.parentNode.insertBefore(followButtonContainer, editNameContainer.nextSibling);
                }
            } else if (userProfileNameH1 && followButtonContainer) {
                if (userProfileNameH1.nextSibling !== followButtonContainer) {
                    userProfileNameH1.parentNode.insertBefore(followButtonContainer, userProfileNameH1.nextSibling);
                }
            }
            if (!followButton.onclick) {
                followButton.addEventListener('click', handleFollowToggle);
            }
        }

        updateSidebarMyProfileLink(viendoMiPropioPerfil);
        await loadUserProfileData(viewingUserId); 

        if (currentUserData && viewingUserId) {
            if (profileContentTabsContainer) {
                profileContentTabsContainer.style.display = 'block';
                setTimeout(() => profileContentTabsContainer.classList.add('visible'), 50);
            }

            const userPostsSectionPane = document.getElementById('userProfilePostsSection');
            if (userPostsSectionPane) {
                // El h4 para "Publicaciones de Usuario" ya está en el HTML,
                // solo actualizamos el placeholder del nombre si es necesario.
                 if (profilePostsUsernamePlaceholder && currentUserData.pushname) {
                    const escaper = window.PostRenderer?.escapeHtml || escapeHtml;
                    profilePostsUsernamePlaceholder.textContent = escaper(currentUserData.pushname);
                }
                fetchProfilePosts(viewingUserId, true);
            }

            if (loggedInUserObject && viewingUserId === loggedInUserObject.userId) {
                if (profileSavedPostsTabButton) profileSavedPostsTabButton.style.display = 'flex';
            } else {
                if (profileSavedPostsTabButton) profileSavedPostsTabButton.style.display = 'none';
                const savedPostsSectionPane = document.getElementById('userProfileSavedPostsSection');
                if (savedPostsSectionPane) savedPostsSectionPane.style.display = 'none'; 
            }
        } else if (profileContentTabsContainer) {
            profileContentTabsContainer.style.display = 'none';
        }

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
            if (spotifyStatusText) { spotifyStatusText.textContent = message; spotifyStatusText.style.color = 'var(--error-color)'; spotifyStatusText.style.display = 'block'; }
            if (viewingUserId) window.history.replaceState({}, document.title, `${window.location.pathname}?id=${viewingUserId}`);
            else window.history.replaceState({}, document.title, `${window.location.pathname}`);
        } else if (spotifyLinked === 'true') {
            if (spotifyStatusText) { spotifyStatusText.textContent = "¡Cuenta de Spotify vinculada exitosamente! La información se está actualizando..."; spotifyStatusText.style.color = 'var(--success-color)'; spotifyStatusText.style.display = 'block';}
            if (viewingUserId) window.history.replaceState({}, document.title, `${window.location.pathname}?id=${viewingUserId}`);
            else window.history.replaceState({}, document.title, `${window.location.pathname}`);
        }
    }
    
    function displayProfileError(message) {
        if (userProfileNameH1) userProfileNameH1.textContent = "Error";
        if (userFullDetailsDiv) userFullDetailsDiv.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
        if (document.querySelector('.profile-stats')) document.querySelector('.profile-stats').style.display = 'none';
        if (followButtonContainer) followButtonContainer.innerHTML = ''; 
        const spotifySection = document.getElementById('spotifyProfileSection');
        if(spotifySection) spotifySection.style.display = 'none';
        if(profileContentTabsContainer) profileContentTabsContainer.style.display = 'none'; // Ocultar tabs si hay error de perfil
    }

    function updateSidebarMyProfileLink(esMiPerfil) {
        if (sidebarMyProfileLinkContainer) {
            const link = sidebarMyProfileLinkContainer.querySelector('a');
            if (esMiPerfil && loggedInUserObject && loggedInUserObject.userId) { 
                sidebarMyProfileLinkContainer.style.display = 'list-item';
                if (link) {
                    link.classList.add('active');
                    link.href = `profile.html?id=${loggedInUserObject.userId}`; 
                }
                document.querySelectorAll('.sidebar ul > li > a:not([href^="profile.html"])').forEach(a => a.classList.remove('active'));
            } else {
                if (link) link.classList.remove('active');
            }
        }
    }

    async function loadUserProfileData(userIdToLoad) {
        if (!userIdToLoad) { displayProfileError("No se especificó un ID de usuario para cargar el perfil."); return; }
        setPlaceholders(true);
        try {
            let fetchUrl = `${API_BASE_URL}/user/${encodeURIComponent(userIdToLoad)}`;
            if (loggedInUserObject && loggedInUserObject.userId) { 
                fetchUrl += `?viewerId=${encodeURIComponent(loggedInUserObject.userId)}`;
            }
            const response = await fetch(fetchUrl);
            if (!response.ok) { let errorMsg = `Error ${response.status}`; try { const errorData = await response.json(); errorMsg = errorData.message || errorData.error || errorMsg; } catch (e) { /* No hacer nada */ } throw new Error(errorMsg); }
            currentUserData = await response.json();
            if (!currentUserData || !currentUserData.userId) { throw new Error("Datos de usuario no recibidos o incompletos de la API."); }
            displayUserProfileData(currentUserData);
        } catch (error) {
            console.error('Error cargando datos del perfil:', error.message, error);
            displayProfileError(`No se pudo cargar la información del perfil: ${error.message}`);
        } finally {
            setPlaceholders(false);
        }
    }

    function setPlaceholders(isLoading) {
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
            // Placeholders para las secciones de posts
            if (userProfilePostsContainer) userProfilePostsContainer.innerHTML = '<p>Cargando publicaciones...</p>';
            if (userProfileSavedPostsContainer) userProfileSavedPostsContainer.innerHTML = '<p>Cargando guardados...</p>';
        }
    }

    function displayUserProfileData(user) {
        if (!user) { displayProfileError("Datos de usuario no válidos."); return; }
        currentUserData = user; 
        const escaper = window.PostRenderer?.escapeHtml || escapeHtml; // Usar la global si está, sino la local
        document.title = `${escaper(user.pushname) || 'Usuario'} - Perfil`;
        if (userProfileNameH1) {
            userProfileNameH1.textContent = escaper(user.pushname) || 'Usuario Desconocido';
            if (loggedInUserObject && user.userId === loggedInUserObject.userId) { userProfileNameH1.classList.add('editable-name'); userProfileNameH1.title = "Haz clic para cambiar tu nombre"; if(editNameContainer) editNameContainer.style.display = 'none'; } 
            else { userProfileNameH1.classList.remove('editable-name'); userProfileNameH1.title = ""; if(editNameContainer) editNameContainer.style.display = 'none';}
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
        if (loggedInUserObject && user.userId === loggedInUserObject.userId) { if (window.updateGlobalUserUI) { window.updateGlobalUserUI(user); } }
        makeImagesEditableIfMyProfile(loggedInUserObject && user.userId === loggedInUserObject.userId);
        setupSpotifySection(user); 
    }

    function setupSpotifySection(userData) {
        const spotifySection = document.getElementById('spotifyProfileSection');
        if (!spotifySection || !connectSpotifyButton || !disconnectSpotifyButton || !spotifyStatusText || !spotifyInfoDiv || !spotifyDisplayNameSpan || !spotifyProfileImage) {
            if (spotifySection) { spotifySection.style.display = 'none'; spotifySection.classList.remove('visible'); } return;
        }
        if (!userData) { spotifyStatusText.textContent = 'No se pudieron cargar los datos para Spotify.'; spotifyStatusText.style.display = 'block'; connectSpotifyButton.style.display = 'none'; disconnectSpotifyButton.style.display = 'none'; spotifyInfoDiv.style.display = 'none'; spotifySection.classList.remove('visible'); return; }
        const isMyProfile = viewingUserId && loggedInUserObject && viewingUserId === loggedInUserObject.userId;
        const isLinkedToSpotify = !!userData.spotify_user_id;
        if (isLinkedToSpotify) {
            spotifyStatusText.style.display = 'none'; 
            spotifyDisplayNameSpan.textContent = userData.spotify_display_name || 'Usuario de Spotify';
            if (userData.spotify_profile_image_url) { spotifyProfileImage.src = userData.spotify_profile_image_url; spotifyProfileImage.style.display = 'block'; } 
            else { spotifyProfileImage.style.display = 'none'; }
            spotifyInfoDiv.style.display = 'block'; 
            if (isMyProfile) { connectSpotifyButton.style.display = 'none'; disconnectSpotifyButton.style.display = 'inline-block'; } 
            else { connectSpotifyButton.style.display = 'none'; disconnectSpotifyButton.style.display = 'none'; }
        } else {
            spotifyInfoDiv.style.display = 'none'; 
            if (isMyProfile) { spotifyStatusText.textContent = 'Vincula tu cuenta de Spotify para compartir tu música.'; spotifyStatusText.style.display = 'block'; connectSpotifyButton.style.display = 'inline-block'; disconnectSpotifyButton.style.display = 'none'; } 
            else { const escaper = window.PostRenderer?.escapeHtml || escapeHtml; spotifyStatusText.textContent = `${escaper(userData.pushname || 'Este usuario')} no ha vinculado su Spotify.`; spotifyStatusText.style.display = 'block'; connectSpotifyButton.style.display = 'none'; disconnectSpotifyButton.style.display = 'none'; }
        }
        spotifySection.classList.add('visible');
    }

    if (connectSpotifyButton) { connectSpotifyButton.addEventListener('click', () => { if (loggedInUserObject && loggedInUserObject.userId) { window.location.href = `${API_BASE_URL}/spotify/login?app_user_id=${encodeURIComponent(loggedInUserObject.userId)}`; } else { alert("Debes iniciar sesión para vincular tu cuenta de Spotify."); } }); }
    if (disconnectSpotifyButton) { disconnectSpotifyButton.addEventListener('click', async () => { if (loggedInUserObject && loggedInUserObject.userId) { if (!confirm("¿Estás seguro de que quieres desvincular tu cuenta de Spotify?")) { return; } disconnectSpotifyButton.disabled = true; disconnectSpotifyButton.textContent = 'Desvinculando...'; try { const response = await fetch(`${API_BASE_URL}/spotify/unlink`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_user_id: loggedInUserObject.userId }) }); const result = await response.json(); if (response.ok) { alert(result.message || "Cuenta de Spotify desvinculada."); if (currentUserData) { currentUserData.spotify_user_id = null; currentUserData.spotify_display_name = null; currentUserData.spotify_profile_image_url = null; const storedUser = localStorage.getItem('loggedInUser'); if(storedUser){ const parsedUser = JSON.parse(storedUser); if(parsedUser.userId === loggedInUserObject.userId){ parsedUser.spotify_user_id = null; parsedUser.spotify_display_name = null; localStorage.setItem('loggedInUser', JSON.stringify(parsedUser)); if(window.updateGlobalUserUI) window.updateGlobalUserUI(parsedUser); } } setupSpotifySection(currentUserData); } } else { alert(`Error: ${result.message || 'No se pudo desvincular.'}`); } } catch (error) { console.error("Error desvinculando Spotify:", error); alert("Error de red al intentar desvincular Spotify."); } finally { disconnectSpotifyButton.disabled = false; disconnectSpotifyButton.textContent = 'Desvincular Spotify'; } } }); }
    
    function toggleNameEditMode(editMode) { isEditingName = editMode; if (editMode) { userProfileNameH1.style.display = 'none'; editNameContainer.style.display = 'flex'; editNameInput.value = currentUserData ? (currentUserData.pushname || '') : ''; editNameInput.focus(); editNameStatus.style.display = 'none'; editNameStatus.textContent = ''; if (profileInfoActionsDiv && followButtonContainer.parentElement === profileInfoActionsDiv) { profileInfoActionsDiv.insertBefore(editNameContainer, followButtonContainer); } else if (profileInfoActionsDiv) { profileInfoActionsDiv.appendChild(editNameContainer); } } else { userProfileNameH1.style.display = 'block'; editNameContainer.style.display = 'none'; if (profileInfoActionsDiv && userProfileNameH1.nextSibling !== followButtonContainer) { profileInfoActionsDiv.insertBefore(followButtonContainer, userProfileNameH1.nextSibling); } } }
    if (userProfileNameH1) { userProfileNameH1.addEventListener('click', () => { if (loggedInUserObject && viewingUserId === loggedInUserObject.userId && !isEditingName) { toggleNameEditMode(true); } }); }
    if (saveNameButton) { saveNameButton.addEventListener('click', async () => { const newName = editNameInput.value.trim(); editNameInput.classList.remove('input-error-pulse'); editNameStatus.style.display = 'none'; editNameStatus.textContent = ''; editNameStatus.className = 'message-area'; if (newName.length < 3 || newName.length > 25) { editNameStatus.textContent = "El nombre debe tener entre 3 y 25 caracteres."; editNameStatus.className = 'message-area error visible'; editNameInput.classList.add('input-error-pulse'); editNameInput.focus(); setTimeout(() => { editNameInput.classList.remove('input-error-pulse'); }, 1500); return; } if (currentUserData && newName === currentUserData.pushname) { toggleNameEditMode(false); return; } saveNameButton.disabled = true; saveNameButton.textContent = 'Guardando...'; editNameStatus.textContent = 'Guardando nombre...'; editNameStatus.className = 'message-area visible'; editNameStatus.classList.remove('success', 'error'); try { const response = await fetch(`${API_BASE_URL}/user/update-name`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName: newName, userId: loggedInUserObject.userId }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Error al actualizar.'); editNameStatus.textContent = result.message; editNameStatus.classList.add('success'); if (currentUserData) { currentUserData.pushname = newName; localStorage.setItem('loggedInUser', JSON.stringify(currentUserData)); if (window.updateGlobalUserUI) window.updateGlobalUserUI(currentUserData); displayUserProfileData(currentUserData); } saveNameButton.disabled = false; saveNameButton.textContent = 'Guardar'; setTimeout(() => toggleNameEditMode(false), 1500); } catch (error) { console.error("Error actualizando nombre:", error); editNameStatus.textContent = `Error: ${error.message}`; editNameStatus.classList.add('error'); saveNameButton.disabled = false; saveNameButton.textContent = 'Guardar'; } }); }
    if(editNameInput) { editNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && isEditingName) { e.preventDefault(); saveNameButton.click(); } }); }
    if (cancelEditNameButton) { cancelEditNameButton.addEventListener('click', () => toggleNameEditMode(false)); }

    function updateFollowButtonState(user) { followButtonContainer.innerHTML = ''; if (loggedInUserObject && viewingUserId !== loggedInUserObject.userId && user) { followButton.textContent = user.isFollowing ? 'Dejar de Seguir' : 'Seguir'; followButton.className = user.isFollowing ? 'button-unfollow' : 'button-follow'; followButtonContainer.appendChild(followButton); followButton.style.display = 'inline-block'; followButton.disabled = false; } else { followButton.style.display = 'none'; } }
    function updateRankBadge(rank) { if (userProfileRankBadge) { if (rank !== null && rank !== undefined) { userProfileRankBadge.innerHTML = (rank === 1) ? '🥇' : (rank === 2) ? '🥈' : (rank === 3) ? '🥉' : rank.toString(); userProfileRankBadge.style.display = 'flex'; } else { userProfileRankBadge.style.display = 'none'; } } }
    function displayFullUserDetails(user) { const escaper = window.PostRenderer?.escapeHtml || escapeHtml; if (userFullDetailsDiv && user) { let detailsHTML = `<h4>Más sobre ${escaper(user.pushname || 'este usuario')}:</h4>`; detailsHTML += `<p><strong>ID:</strong> ${escaper(user.userId)}</p>`; detailsHTML += `<p><strong>Últ. Daily:</strong> ${formatTimestamp(user.lastdaily)}</p>`; detailsHTML += `<p><strong>Racha Daily:</strong> ${user.dailystreak || 0} día(s)</p>`; detailsHTML += `<p><strong>Últ. Trabajo:</strong> ${formatTimestamp(user.lastwork)}</p>`; detailsHTML += `<p><strong>Últ. Robo:</strong> ${formatTimestamp(user.laststeal)}</p>`; detailsHTML += `<p><strong>Últ. Crimen:</strong> ${formatTimestamp(user.lastcrime)}</p>`; detailsHTML += `<p><strong>Últ. "Cita":</strong> ${formatTimestamp(user.lastslut)}</p>`; detailsHTML += `<p><strong>Últ. Ruleta:</strong> ${formatTimestamp(user.lastroulette)}</p>`; detailsHTML += `<p><strong>Últ. Slots:</strong> ${formatTimestamp(user.lastslots)}</p>`; userFullDetailsDiv.innerHTML = detailsHTML; userFullDetailsDiv.classList.add('visible'); } else if (userFullDetailsDiv) { userFullDetailsDiv.innerHTML = '<p>No hay detalles adicionales para mostrar.</p>'; } }
    function makeImagesEditableIfMyProfile(isMyProfile) { const coverPhotoContainer = userCoverPhotoElement ? userCoverPhotoElement.parentElement : null; const profilePhotoContainer = userProfilePhotoElement ? userProfilePhotoElement.parentElement : null; [coverPhotoContainer, profilePhotoContainer].forEach(container => { if (container) { if (isMyProfile) { container.classList.add('editable'); container.title = `Cambiar foto de ${container === coverPhotoContainer ? 'portada' : 'perfil'}`; container.onclick = () => { const imageType = container === coverPhotoContainer ? 'cover' : 'profile'; const currentImage = imageType === 'cover' ? (currentUserData?.coverPhotoPath || 'placeholder-cover.jpg') : (currentUserData?.profilePhotoPath || 'placeholder-profile.jpg'); openImageEditModal(imageType, currentImage); }; } else { container.classList.remove('editable'); container.title = ""; container.onclick = null; } } }); }
    async function handleFollowToggle() { if (!loggedInUserObject || !viewingUserId || loggedInUserObject.userId === viewingUserId || !currentUserData) return; const currentlyFollowing = currentUserData.isFollowing; const action = currentlyFollowing ? 'unfollow' : 'follow'; followButton.disabled = true; followButton.textContent = 'Procesando...'; try { const response = await fetch(`${API_BASE_URL}/user/${viewingUserId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followerId: loggedInUserObject.userId }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Error al ${action}`);} currentUserData.isFollowing = !currentlyFollowing; if (userFollowersSpan) { currentUserData.followersCount = (currentUserData.followersCount || 0) + (!currentlyFollowing ? 1 : -1); if(currentUserData.followersCount < 0) currentUserData.followersCount = 0; } const storedUserRaw = localStorage.getItem('loggedInUser'); if(storedUserRaw){ const storedUser = JSON.parse(storedUserRaw); if(storedUser.userId === loggedInUserObject.userId){ storedUser.followingCount = (storedUser.followingCount || 0) + (!currentlyFollowing ? 1 : -1); if(storedUser.followingCount < 0) storedUser.followingCount = 0; localStorage.setItem('loggedInUser', JSON.stringify(storedUser)); if(window.updateGlobalUserUI) window.updateGlobalUserUI(storedUser); } } displayUserProfileData(currentUserData); } catch (error) { console.error(`Error en acción ${action}:`, error); alert(`Error: ${error.message}`); loadUserProfileData(viewingUserId); } }    

    function openFollowListModal(tabToOpen = 'followers') { if (!followListModal || !viewingUserId) return; userIdForModalList = viewingUserId; currentModalTab = tabToOpen; updateModalTabsUI(); loadUsersForModalList(currentModalTab); followListModal.style.display = 'flex'; setTimeout(() => { followListModal.classList.add('visible'); document.body.classList.add('modal-open-no-scroll'); }, 10); }
    function closeModal(modalElement) { if (!modalElement) return; modalElement.classList.remove('visible'); document.body.classList.remove('modal-open-no-scroll'); setTimeout(() => { if (!modalElement.classList.contains('visible')) modalElement.style.display = 'none'; }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-speed-normal') || '0.3') * 1000); }
    function updateModalTabsUI() { if (!tabFollowersButton || !tabFollowingButton) return; tabFollowersButton.classList.toggle('active', currentModalTab === 'followers'); tabFollowingButton.classList.toggle('active', currentModalTab === 'following'); }
    async function loadUsersForModalList(tabName) { if (!modalUserListContainer || !userIdForModalList) return; modalUserListContainer.innerHTML = '<p>Cargando...</p>'; const endpoint = tabName === 'followers' ? 'followers' : 'following'; try { const fetchUrl = (loggedInUserObject && loggedInUserObject.userId) ? `${API_BASE_URL}/user/${userIdForModalList}/${endpoint}?viewerId=${loggedInUserObject.userId}` : `${API_BASE_URL}/user/${userIdForModalList}/${endpoint}`; const response = await fetch(fetchUrl); if (!response.ok) throw new Error(`Error al cargar la lista de ${tabName}`); const users = await response.json(); renderUserListInModal(users, tabName); } catch (error) { console.error(error); modalUserListContainer.innerHTML = `<p class="error">No se pudo cargar la lista: ${error.message}</p>`; } }
    function renderUserListInModal(users, tabType) { const escaper = window.PostRenderer?.escapeHtml || escapeHtml; if (!modalUserListContainer) return; if (!users || users.length === 0) { modalUserListContainer.innerHTML = `<p>No hay ${tabType === 'followers' ? 'seguidores' : 'usuarios seguidos'} para mostrar.</p>`; return; } const ul = document.createElement('ul'); users.forEach(userInList => { const li = document.createElement('li'); li.className = 'modal-user-list-item'; li.dataset.userIdInList = userInList.userId; let actionButtonHtml = ''; if (loggedInUserObject && loggedInUserObject.userId) { if (loggedInUserObject.userId === userInList.userId) { /* No action for self */ } else if (tabType === 'following' && userIdForModalList === loggedInUserObject.userId) { actionButtonHtml = `<button class="follow-action-btn button-unfollow" data-action="unfollow" data-target-userId="${userInList.userId}">Dejar de seguir</button>`; } else if (tabType === 'followers' && userIdForModalList === loggedInUserObject.userId) { actionButtonHtml = `<button class="follow-action-btn button-remove-follower" data-action="remove-follower" data-target-userId="${userInList.userId}">Eliminar</button>`; } else if (userIdForModalList !== loggedInUserObject.userId && userInList.isFollowedByViewer !== undefined) { actionButtonHtml = userInList.isFollowedByViewer ? `<button class="follow-action-btn button-unfollow" data-action="unfollow" data-target-userId="${userInList.userId}">Dejar de seguir</button>` : `<button class="follow-action-btn button-follow" data-action="follow" data-target-userId="${userInList.userId}">Seguir</button>`; } } li.innerHTML = ` <img src="${userInList.profilePhotoPath || 'placeholder-profile.jpg'}" alt="Perfil" class="profile-pic"> <span class="username" data-user-id-link="${userInList.userId}">${escaper(userInList.pushname) || 'Usuario'}</span> ${actionButtonHtml}`; ul.appendChild(li); }); modalUserListContainer.innerHTML = ''; modalUserListContainer.appendChild(ul); }
    if (userFollowersSpan && userFollowersSpan.parentElement) userFollowersSpan.parentElement.addEventListener('click', () => openFollowListModal('followers'));
    if (userFollowingSpan && userFollowingSpan.parentElement) userFollowingSpan.parentElement.addEventListener('click', () => openFollowListModal('following'));
    if (closeFollowListModalButton) closeFollowListModalButton.addEventListener('click', () => closeModal(followListModal));
    if (followListModal) followListModal.addEventListener('click', (e) => { if (e.target === followListModal) closeModal(followListModal); });
    if (tabFollowersButton) tabFollowersButton.addEventListener('click', () => { if (currentModalTab !== 'followers') { currentModalTab = 'followers'; updateModalTabsUI(); loadUsersForModalList('followers'); }});
    if (tabFollowingButton) tabFollowingButton.addEventListener('click', () => { if (currentModalTab !== 'following') { currentModalTab = 'following'; updateModalTabsUI(); loadUsersForModalList('following'); }});
    if (modalUserListContainer) { modalUserListContainer.addEventListener('click', async (event) => { const actionButton = event.target.closest('.follow-action-btn[data-action]'); const usernameLink = event.target.closest('.username[data-user-id-link]'); if (usernameLink) { closeModal(followListModal); window.location.href = `profile.html?id=${encodeURIComponent(usernameLink.dataset.userIdLink)}`; return; } if (actionButton && loggedInUserObject && loggedInUserObject.userId) { const targetUserId = actionButton.dataset.targetUserid; const action = actionButton.dataset.action; if (!targetUserId || !action) return; const originalButtonText = actionButton.textContent; actionButton.disabled = true; actionButton.textContent = '...'; let apiUrl = '', body = {}, method = 'POST'; if (action === 'follow' || action === 'unfollow') { apiUrl = `${API_BASE_URL}/user/${targetUserId}/${action}`; body = { followerId: loggedInUserObject.userId }; } else if (action === 'remove-follower') { apiUrl = `${API_BASE_URL}/user/${loggedInUserObject.userId}/remove-follower`; body = { followerToRemoveId: targetUserId }; } else { actionButton.disabled = false; actionButton.textContent = originalButtonText; return; } try { const response = await fetch(apiUrl, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || `Error: ${action}`); } loadUsersForModalList(currentModalTab); loadUserProfileData(viewingUserId); } catch (error) { console.error(`Error en ${action} desde modal:`, error); alert(`Error: ${error.message}`); actionButton.textContent = originalButtonText; actionButton.disabled = false; } } }); }
    
    function openImageEditModal(imageType, currentImageUrl) { if (!imageEditModal || !(loggedInUserObject && loggedInUserObject.userId) || viewingUserId !== loggedInUserObject.userId) return; currentImageTypeToEdit = imageType; selectedFile = null; imageUploadInput.value = ''; imageEditModalTitle.textContent = imageType === 'profile' ? 'Cambiar Foto de Perfil' : 'Cambiar Foto de Portada'; imageEditPreview.src = currentImageUrl || (imageType === 'profile' ? 'placeholder-profile.jpg' : 'placeholder-cover.jpg'); saveImageButton.style.display = 'none'; uploadStatusMessage.style.display = 'none'; uploadStatusMessage.textContent = ''; uploadStatusMessage.className = 'message-area'; imageEditModal.style.display = 'flex'; setTimeout(() => { imageEditModal.classList.add('visible'); document.body.classList.add('modal-open-no-scroll'); }, 10); }
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
    if (saveImageButton) { saveImageButton.addEventListener('click', async () => { if (!selectedFile || !currentImageTypeToEdit || !(loggedInUserObject && loggedInUserObject.userId) ) { uploadStatusMessage.textContent = 'Por favor, selecciona un archivo primero.'; uploadStatusMessage.className = 'message-area error visible'; return; } saveImageButton.disabled = true; saveImageButton.textContent = 'Subiendo...'; uploadStatusMessage.textContent = 'Subiendo imagen...'; uploadStatusMessage.className = 'message-area visible'; uploadStatusMessage.classList.remove('success', 'error'); const formData = new FormData(); formData.append(currentImageTypeToEdit === 'profile' ? 'profileImage' : 'coverImage', selectedFile); formData.append('userId', loggedInUserObject.userId); const endpointSuffix = currentImageTypeToEdit === 'profile' ? '/upload/profile-photo' : '/upload/cover-photo'; try { const response = await fetch(`${API_BASE_URL}/user${endpointSuffix}`, { method: 'POST', body: formData }); const result = await response.json(); if (!response.ok) throw new Error(result.message || `Error del servidor: ${response.status}`); uploadStatusMessage.textContent = result.message || "Imagen subida con éxito."; uploadStatusMessage.classList.add('success'); if (currentUserData) { const pathFieldToUpdate = currentImageTypeToEdit === 'profile' ? 'profilePhotoPath' : 'coverPhotoPath'; currentUserData[pathFieldToUpdate] = result.filePath; if (loggedInUserObject && viewingUserId === loggedInUserObject.userId) { localStorage.setItem('loggedInUser', JSON.stringify(currentUserData)); if (window.updateGlobalUserUI) window.updateGlobalUserUI(currentUserData); } displayUserProfileData(currentUserData); } setTimeout(() => { closeModal(imageEditModal); saveImageButton.textContent = 'Guardar Cambios'; saveImageButton.style.display = 'none'; selectedFile = null; imageUploadInput.value = ''; }, 1500); } catch (error) { console.error("Error subiendo imagen:", error); uploadStatusMessage.textContent = `Error: ${error.message}`; uploadStatusMessage.classList.add('error'); saveImageButton.disabled = false; saveImageButton.textContent = 'Guardar Cambios'; } }); }
    
    function escapeHtml(unsafe) { if (unsafe === null || typeof unsafe === 'undefined') return ''; return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'"); }
    function formatTimestamp(timestamp) { if (timestamp === null || typeof timestamp === 'undefined' || timestamp === 0 || timestamp === '') { return 'Nunca'; } let dateObj; if (typeof timestamp === 'number') { dateObj = new Date(timestamp); } else if (typeof timestamp === 'string') { const numericTimestamp = Number(timestamp); if (!isNaN(numericTimestamp) && String(numericTimestamp) === timestamp.trim()) { dateObj = new Date(numericTimestamp); } else { dateObj = new Date(timestamp); } } else { return 'Fecha no válida (tipo)'; } if (!dateObj || isNaN(dateObj.getTime())) { return 'Fecha inválida'; } try { return dateObj.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return 'Error al formatear'; } }

    async function fetchProfilePosts(userIdForPosts, replace = false) {
        if (!userProfilePostsContainer || !window.PostRenderer) {
            console.error("Contenedor de posts de perfil o PostRenderer no está disponible/cargado.");
            if(userProfilePostsContainer) userProfilePostsContainer.innerHTML = '<p class="error">Error al inicializar sección de publicaciones.</p>';
        return;
    }
    if (replace) {
            profilePostsCurrentPage = 1;
            userProfilePostsContainer.innerHTML = '<p>Cargando publicaciones...</p>';
    }

        const viewerIdParam = (loggedInUserObject && loggedInUserObject.userId) ? `&viewerId=${encodeURIComponent(loggedInUserObject.userId)}` : '';

    try {
            const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(userIdForPosts)}/posts?page=${profilePostsCurrentPage}&limit=${profilePostsPerPage}${viewerIdParam}`);
        if (!response.ok) {
                const errData = await response.json().catch(() => ({message: 'Error del servidor obteniendo posts del perfil.'}));
                throw new Error(errData.message || 'Error al cargar las publicaciones del perfil.');
        }
        const posts = await response.json();

            if (replace) userProfilePostsContainer.innerHTML = '';

            if (posts.length === 0 && profilePostsCurrentPage === 1) {
                const escaper = window.PostRenderer?.escapeHtml || escapeHtml;
                const placeholderName = (currentUserData && currentUserData.pushname) 
                    ? (escaper(currentUserData.pushname)) 
                    : 'Este usuario';
                userProfilePostsContainer.innerHTML = `<p>${placeholderName} aún no ha realizado publicaciones.</p>`;
        } else {
            posts.forEach(post => {
                    userProfilePostsContainer.appendChild(window.PostRenderer.createPostElement(post, loggedInUserObject));
            });
        }

            if (loadMoreProfilePostsBtn) {
                loadMoreProfilePostsBtn.style.display = posts.length < profilePostsPerPage ? 'none' : 'block';
        }
            profilePostsCurrentPage++;

    } catch (error) {
            console.error("Error en fetchProfilePosts:", error);
            if (replace && userProfilePostsContainer) userProfilePostsContainer.innerHTML = `<p class="error">${error.message}</p>`;
            if (loadMoreProfilePostsBtn) loadMoreProfilePostsBtn.style.display = 'none';
    }
}

    if (loadMoreProfilePostsBtn) {
        loadMoreProfilePostsBtn.addEventListener('click', () => {
            if (viewingUserId) {
                fetchProfilePosts(viewingUserId, false);
            }
        });
    }
    
    // --- LÓGICA PARA PESTAÑAS DE CONTENIDO DEL PERFIL ---
    profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active')) return;

            profileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            profileTabPanes.forEach(pane => {
                pane.classList.remove('active'); // Oculta todos los paneles
            });

            const targetPaneId = tab.dataset.tabTarget;
            const targetPane = document.querySelector(targetPaneId);
            if (targetPane) {
                targetPane.classList.add('active'); // Muestra el panel objetivo

                // Cargar contenido si es la primera vez que se activa la pestaña de guardados
                if (targetPaneId === '#userProfileSavedPostsSection' && !targetPane.dataset.loaded) {
                    if (loggedInUserObject && viewingUserId === loggedInUserObject.userId) {
                        fetchProfileSavedPosts(viewingUserId, true);
                        targetPane.dataset.loaded = 'true'; // Marcar como cargado
                    }
                }
            }
        });
    });

    async function fetchProfileSavedPosts(userId, replace = false) {
        if (!userProfileSavedPostsContainer || !window.PostRenderer) {
            console.error("Contenedor de posts guardados o PostRenderer no disponible.");
            if(userProfileSavedPostsContainer) userProfileSavedPostsContainer.innerHTML = '<p class="error">Error al inicializar sección.</p>';
            return;
        }
        if (replace) {
            profileSavedPostsCurrentPage = 1;
            userProfileSavedPostsContainer.innerHTML = '<p>Cargando...</p>';
        }

        // El viewerId es crucial para que el backend sepa para quién verificar los 'liked_by_viewer'
        // y en este caso, como solo el dueño ve sus guardados, viewerId es el mismo que userId.
        const viewerIdParam = userId ? `?viewerId=${encodeURIComponent(userId)}` : ''; 

        try {
            // Corregir el endpoint: quitar el '&' extra antes de page=
            const response = await fetch(`${API_BASE_URL}/user/${encodeURIComponent(userId)}/saved-posts${viewerIdParam}&page=${profileSavedPostsCurrentPage}&limit=${profileSavedPostsPerPage}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({message: 'Error del servidor.'}));
                throw new Error(errData.message || 'Error al cargar publicaciones guardadas.');
            }
            const posts = await response.json();

            if (replace) userProfileSavedPostsContainer.innerHTML = '';

            if (posts.length === 0 && profileSavedPostsCurrentPage === 1) {
                userProfileSavedPostsContainer.innerHTML = `<p>No tienes ninguna publicación guardada.</p>`;
            } else {
                posts.forEach(post => {
                    userProfileSavedPostsContainer.appendChild(window.PostRenderer.createPostElement(post, loggedInUserObject));
                });
            }

            if (loadMoreProfileSavedPostsBtn) {
                loadMoreProfileSavedPostsBtn.style.display = posts.length < profileSavedPostsPerPage ? 'none' : 'block';
            }
            profileSavedPostsCurrentPage++;

        } catch (error) {
            console.error("Error en fetchProfileSavedPosts:", error);
            if (replace && userProfileSavedPostsContainer) userProfileSavedPostsContainer.innerHTML = `<p class="error">${error.message}</p>`;
            if (loadMoreProfileSavedPostsBtn) loadMoreProfileSavedPostsBtn.style.display = 'none';
        }
    }
    
    if (loadMoreProfileSavedPostsBtn) {
        loadMoreProfileSavedPostsBtn.addEventListener('click', () => {
            if (loggedInUserObject && viewingUserId === loggedInUserObject.userId) {
                fetchProfileSavedPosts(viewingUserId, false);
            }
        });
    }
    // --- FIN LÓGICA PESTAÑAS ---

    initializeProfilePage();
});