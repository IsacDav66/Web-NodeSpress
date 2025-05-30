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
    followButton.addEventListener('click', handleFollowToggle); // Listener único

    const globalSidebarProfilePic = document.getElementById('sidebarProfilePic'); 

    // Elementos para la edición de nombre
    const editNameContainer = document.getElementById('editNameContainer');
    const editNameInput = document.getElementById('editNameInput');
    const saveNameButton = document.getElementById('saveNameButton');
    const cancelEditNameButton = document.getElementById('cancelEditNameButton');
    const editNameStatus = document.getElementById('editNameStatus');

    let isEditingName = false; // Bandera para el estado de edición

    // --- Estado Global del Script ---
    let viewingUserId = null;       // ID del perfil que se está viendo
    let loggedInUserId = null;      // ID del usuario que ha iniciado sesión
    let currentUserData = null;     // Datos del perfil que se está viendo actualmente
    let currentModalTab = 'followers'; // Pestaña activa en el modal de lista
    let userIdForModalList = null;  // ID del perfil para el que se muestra la lista en el modal
    let currentImageTypeToEdit = null; // 'profile' o 'cover' para el modal de edición de imagen
    let selectedFile = null;        // Archivo seleccionado en el modal de edición de imagen


    // =========================================================================
    // INICIALIZACIÓN DE LA PÁGINA DE PERFIL
    // =========================================================================
    async function initializeProfilePage() {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            try {
                loggedInUserId = JSON.parse(storedUser).userId;
            } catch (e) { console.error("Error parseando loggedInUser de localStorage", e); }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryUserId = urlParams.get('id');
        let viendoMiPropioPerfil = false;

        if (queryUserId) {
            viewingUserId = queryUserId;
            viendoMiPropioPerfil = loggedInUserId && viewingUserId === loggedInUserId;
        } else if (loggedInUserId) {
            viewingUserId = loggedInUserId;
            viendoMiPropioPerfil = true;
        } else {
            displayProfileError("Perfil no disponible. Por favor, inicia sesión o especifica un perfil.");
            if (sidebarMyProfileLinkContainer) sidebarMyProfileLinkContainer.style.display = 'none';
            return;
        }
        
        if (profileInfoActionsDiv) {
            profileInfoActionsDiv.appendChild(followButtonContainer);
        }

        if (profileInfoActionsDiv) {
            // El editNameContainer está en el HTML, solo necesitamos el followButtonContainer
            // Asegurémonos que followButtonContainer esté después de editNameContainer
            if (editNameContainer && editNameContainer.parentNode === profileInfoActionsDiv) {
                profileInfoActionsDiv.insertBefore(followButtonContainer, editNameContainer.nextSibling);
            } else if (userProfileNameH1 && userProfileNameH1.parentNode === profileInfoActionsDiv) {
                profileInfoActionsDiv.insertBefore(followButtonContainer, userProfileNameH1.nextSibling);
            } else {
                 profileInfoActionsDiv.appendChild(followButtonContainer);
            }
        }
        updateSidebarMyProfileLink(viendoMiPropioPerfil);
        loadUserProfileData(viewingUserId);
    }


    function displayProfileError(message) {
        if (userProfileNameH1) userProfileNameH1.textContent = "Error";
        if (userFullDetailsDiv) userFullDetailsDiv.innerHTML = `<p class="error">${message}</p>`;
        // Ocultar otros elementos
        if (document.querySelector('.profile-stats')) document.querySelector('.profile-stats').style.display = 'none';
        if (followButtonContainer) followButtonContainer.innerHTML = '';
    }

    function updateSidebarMyProfileLink(esMiPerfil) {
        if (sidebarMyProfileLinkContainer) {
            const link = sidebarMyProfileLinkContainer.querySelector('a');
            if (esMiPerfil) {
                sidebarMyProfileLinkContainer.style.display = 'list-item';
                if (link) link.classList.add('active');
                document.querySelectorAll('.sidebar ul > li > a:not([href="profile.html"])').forEach(a => a.classList.remove('active'));
            } else {
                sidebarMyProfileLinkContainer.style.display = 'none';
                if (link) link.classList.remove('active'); 
            }
        }
    }

    // =========================================================================
    // CARGA Y VISUALIZACIÓN DE DATOS DEL PERFIL PRINCIPAL
    // =========================================================================
    async function loadUserProfileData(userId) {
        if (!userId) { console.error("loadUserProfileData: userId es nulo."); return; }

        setPlaceholders(true); // Mostrar placeholders
        try {
            let fetchUrl = `${API_BASE_URL}/user/${encodeURIComponent(userId)}`;
            if (loggedInUserId) fetchUrl += `?viewerId=${encodeURIComponent(loggedInUserId)}`;

            const response = await fetch(fetchUrl);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
            }
            currentUserData = await response.json();
            if (!currentUserData) throw new Error("Datos de usuario no recibidos de la API.");
            
            displayUserProfileData(currentUserData);
        } catch (error) {
            console.error('Error cargando datos del perfil:', error);
            displayProfileError(`No se pudo cargar la información del perfil: ${error.message}`);
        } finally {
            setPlaceholders(false); // Ocultar placeholders (o ya fueron reemplazados)
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
        }
        // No necesitamos una acción para "ocultar" placeholders si los datos los reemplazan.
    }

    function displayUserProfileData(user) {
        if (!user) { displayProfileError("Datos de usuario no válidos."); return; }
        currentUserData = user; // Actualizar estado global

        document.title = `${escapeHtml(user.pushname) || 'Usuario'} - Perfil`;
        if (userProfileNameH1) {
            userProfileNameH1.textContent = escapeHtml(user.pushname) || 'Usuario Desconocido';
            // Hacer el nombre clickeable para editar SOLO si es mi perfil
            if (loggedInUserId && user.userId === loggedInUserId) {
                userProfileNameH1.classList.add('editable-name');
                userProfileNameH1.title = "Haz clic para cambiar tu nombre";
            } else {
                userProfileNameH1.classList.remove('editable-name');
                userProfileNameH1.title = "";
            }
        }
        
        if (userCoverPhotoElement) userCoverPhotoElement.src = user.coverPhotoPath || 'placeholder-cover.jpg';
        if (userProfilePhotoElement) userProfilePhotoElement.src = user.profilePhotoPath || 'placeholder-profile.jpg';

        if (userFollowersSpan) userFollowersSpan.textContent = (user.followersCount || 0).toLocaleString();
        if (userFollowingSpan) userFollowingSpan.textContent = (user.followingCount || 0).toLocaleString();
        if (userMoneyTotalSpan) userMoneyTotalSpan.textContent = `${FRONTEND_MONEY_SYMBOL}${((user.money || 0) + (user.bank || 0)).toLocaleString()}`;
        if (userExperienceSpan) userExperienceSpan.textContent = (user.exp || 0).toLocaleString();

        updateFollowButtonState(user);
        updateRankBadge(user.rank);
        displayFullUserDetails(user);

        // --- ACTUALIZAR LA FOTO DEL SIDEBAR ---
        if (loggedInUserId && user.userId === loggedInUserId) {
            if (window.updateGlobalUserUI) {
                window.updateGlobalUserUI(user);
            }
        }

        makeImagesEditableIfMyProfile(user.userId === loggedInUserId);
    }

    function toggleNameEditMode(editMode) {
        isEditingName = editMode;
        if (editMode) {
            userProfileNameH1.style.display = 'none';
            editNameContainer.style.display = 'flex'; // O 'block'
            editNameInput.value = currentUserData ? (currentUserData.pushname || '') : '';
            editNameInput.focus();
            editNameStatus.style.display = 'none';
            editNameStatus.textContent = '';
            // El followButtonContainer podría necesitar ajustarse si el H1 desaparece
            if (profileInfoActionsDiv && followButtonContainer.parentElement === profileInfoActionsDiv) {
                 profileInfoActionsDiv.insertBefore(editNameContainer, followButtonContainer);
            } else if (profileInfoActionsDiv) {
                 profileInfoActionsDiv.appendChild(editNameContainer); // Si followButtonContainer no está o no es referencia
            }


        } else {
            userProfileNameH1.style.display = 'block'; // O el display original del H1
            editNameContainer.style.display = 'none';
             // Mover el followButtonContainer después del H1 si es necesario
             if (profileInfoActionsDiv && userProfileNameH1.nextSibling !== followButtonContainer) {
                profileInfoActionsDiv.insertBefore(followButtonContainer, userProfileNameH1.nextSibling);
            }
        }
    }

    // Event Listener para hacer el nombre H1 clickeable (si es editable)
    if (userProfileNameH1) {
        userProfileNameH1.addEventListener('click', () => {
            if (loggedInUserId && viewingUserId === loggedInUserId && !isEditingName) {
                toggleNameEditMode(true);
            }
        });
    }

    // Event Listener para el botón Guardar Nombre
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
                editNameStatus.style.display = 'block';
                editNameInput.classList.add('input-error-pulse');
                editNameInput.focus();
                setTimeout(() => { editNameInput.classList.remove('input-error-pulse'); }, 2000);
                return;
            }
            // (Puedes añadir otra validación para newName vacío si quieres, aunque la de longitud lo cubre si min > 0)

            if (currentUserData && newName === currentUserData.pushname) {
                toggleNameEditMode(false);
                return;
            }

            saveNameButton.disabled = true;
            saveNameButton.textContent = 'Guardando...';
            editNameStatus.textContent = 'Guardando nombre...';
            editNameStatus.className = 'message-area visible'; // Mostrar mensaje
            editNameStatus.classList.remove('success', 'error');


            try {
                const response = await fetch(`${API_BASE_URL}/user/update-name`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newName: newName, userId: loggedInUserId })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Error al actualizar el nombre.');
                }

                editNameStatus.textContent = result.message;
                editNameStatus.classList.add('success');

                if (currentUserData) {
                    currentUserData.pushname = newName;
                    localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));
                    if (window.updateGlobalUserUI) {
                        window.updateGlobalUserUI(currentUserData);
                    }
                    displayUserProfileData(currentUserData); // Actualiza H1 y otros elementos del perfil
                }
                
                // Revertir estado del botón ANTES de ocultar el contenedor con toggleNameEditMode
                saveNameButton.disabled = false;
                saveNameButton.textContent = 'Guardar';

                setTimeout(() => {
                    toggleNameEditMode(false); // Ahora esto solo se encarga de la visibilidad
                }, 1500); // Retraso para que el usuario vea el mensaje de éxito

            } catch (error) {
                console.error("Error actualizando nombre:", error);
                editNameStatus.textContent = `Error: ${error.message}`;
                editNameStatus.classList.add('error');
                
                // REVERTIR ESTADO DEL BOTÓN EN CASO DE ERROR
                saveNameButton.disabled = false;
                saveNameButton.textContent = 'Guardar';
            } 
            // No se necesita un 'finally' aquí si ambos caminos (try y catch)
            // manejan explícitamente el estado del botón.
        });
    }
    
    // Permitir guardar con Enter en el input
    if(editNameInput) {
        editNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && isEditingName) {
                e.preventDefault();
                saveNameButton.click();
            }
        });
    }


    // Event Listener para el botón Cancelar Edición de Nombre
    if (cancelEditNameButton) {
        cancelEditNameButton.addEventListener('click', () => {
            toggleNameEditMode(false);
        });
    }



    function updateFollowButtonState(user) {
        followButtonContainer.innerHTML = ''; // Limpiar para evitar duplicados
        if (loggedInUserId && viewingUserId !== loggedInUserId) {
            followButton.textContent = user.isFollowing ? 'Dejar de Seguir' : 'Seguir';
            followButton.className = user.isFollowing ? 'button-unfollow' : 'button-follow';
            followButtonContainer.appendChild(followButton);
            followButton.style.display = 'inline-block';
            followButton.disabled = false;
        } else {
            // No mostrar botón si es mi perfil o no estoy logueado
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
        if (userFullDetailsDiv) {
            console.log("Datos para displayFullUserDetails:", user); // LOG GENERAL DEL USUARIO
            console.log("Valor de user.lastdaily:", user.lastdaily, "| Tipo:", typeof user.lastdaily);
            console.log("Valor de user.lastwork:", user.lastwork, "| Tipo:", typeof user.lastwork);
            // Y así para cualquier otro campo de fecha que dé problemas
    
            let detailsHTML = `<h4>Más sobre ${escapeHtml(user.pushname)}:</h4>`;
            detailsHTML += `<p><strong>ID:</strong> ${escapeHtml(user.userId)}</p>`;
            detailsHTML += `<p><strong>Últ. Daily:</strong> ${formatTimestamp(user.lastdaily)}</p>`; // Aquí se usa
            detailsHTML += `<p><strong>Racha Daily:</strong> ${user.dailystreak || 0} día(s)</p>`;
            detailsHTML += `<p><strong>Últ. Trabajo:</strong> ${formatTimestamp(user.lastwork)}</p>`; // Y aquí
            // ... más detalles ...
            userFullDetailsDiv.innerHTML = detailsHTML;
            userFullDetailsDiv.classList.add('visible');
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
                    container.onclick = () => { // Usar onclick para reemplazar listeners anteriores si los hubiera
                        const imageType = container === coverPhotoContainer ? 'cover' : 'profile';
                        const currentImage = imageType === 'cover' ? 
                            (currentUserData.coverPhotoPath || 'placeholder-cover.jpg') : 
                            (currentUserData.profilePhotoPath || 'placeholder-profile.jpg');
                        openImageEditModal(imageType, currentImage);
                    };
                } else {
                    container.classList.remove('editable');
                    container.title = "";
                    container.onclick = null; // Quitar listener
                }
            }
        });
    }

    // =========================================================================
    // LÓGICA DEL BOTÓN SEGUIR/DEJAR DE SEGUIR (PRINCIPAL)
    // =========================================================================
    async function handleFollowToggle() {
        if (!loggedInUserId || !viewingUserId || loggedInUserId === viewingUserId || !currentUserData) return;

        const currentlyFollowing = currentUserData.isFollowing;
        const action = currentlyFollowing ? 'unfollow' : 'follow';
        
        followButton.disabled = true;
        followButton.textContent = 'Procesando...';

        try {
            const response = await fetch(`${API_BASE_URL}/user/${viewingUserId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followerId: loggedInUserId }) 
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al ${action} usuario.`);
            }
            // const result = await response.json(); // Mensaje de éxito
            
            // Actualización optimista y re-renderizado parcial
            currentUserData.isFollowing = !currentlyFollowing;
            if (userFollowersSpan) { // El contador de seguidores del PERFIL VISTO cambia
                 currentUserData.followersCount += (!currentlyFollowing ? 1 : -1);
                 if(currentUserData.followersCount < 0) currentUserData.followersCount = 0;
            }
            displayUserProfileData(currentUserData); // Esto actualiza el botón y contadores

        } catch (error) {
            console.error(`Error en acción ${action}:`, error);
            alert(`Error: ${error.message}`);
            loadUserProfileData(viewingUserId); // Recargar en caso de error para estado consistente
        }
    }

    // =========================================================================
    // LÓGICA DEL MODAL DE LISTA DE SEGUIDORES/SIGUIENDO
    // =========================================================================
    function openFollowListModal(tabToOpen = 'followers') {
        if (!followListModal || !viewingUserId) return;
        userIdForModalList = viewingUserId;
        currentModalTab = tabToOpen;
        updateModalTabsUI();
        loadUsersForModalList(currentModalTab);
        
        followListModal.style.display = 'flex';
        setTimeout(() => { followListModal.classList.add('visible'); document.body.classList.add('modal-open-no-scroll'); }, 10);
    }

    function closeModal(modalElement) { // Generalizada para cualquier modal
        if (!modalElement) return;
        modalElement.classList.remove('visible');
        document.body.classList.remove('modal-open-no-scroll');
        setTimeout(() => {
            if (!modalElement.classList.contains('visible')) modalElement.style.display = 'none';
        }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-speed-normal') || '0.3') * 1000);
    }

    function updateModalTabsUI() {
        if (!tabFollowersButton || !tabFollowingButton) return;
        tabFollowersButton.classList.toggle('active', currentModalTab === 'followers');
        tabFollowingButton.classList.toggle('active', currentModalTab === 'following');
    }

    async function loadUsersForModalList(tabName) {
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
        // ... (misma lógica de renderUserListInModal que tenías, con los botones de acción) ...
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
                else if (tabType === 'following' && userIdForModalList === loggedInUserId) {
                    actionButtonHtml = `<button class="follow-action-btn button-unfollow" data-action="unfollow" data-target-userId="${userInList.userId}">Dejar de seguir</button>`;
                } else if (tabType === 'followers' && userIdForModalList === loggedInUserId) {
                    actionButtonHtml = `<button class="follow-action-btn button-remove-follower" data-action="remove-follower" data-target-userId="${userInList.userId}">Eliminar</button>`;
                } else if (userIdForModalList !== loggedInUserId) {
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
    
    // Event Listeners para el Modal de Lista
    if (userFollowersSpan && userFollowersSpan.parentElement) userFollowersSpan.parentElement.addEventListener('click', () => openFollowListModal('followers'));
    if (userFollowingSpan && userFollowingSpan.parentElement) userFollowingSpan.parentElement.addEventListener('click', () => openFollowListModal('following'));
    if (closeFollowListModalButton) closeFollowListModalButton.addEventListener('click', () => closeModal(followListModal));
    if (followListModal) followListModal.addEventListener('click', (e) => { if (e.target === followListModal) closeModal(followListModal); });
    if (tabFollowersButton) tabFollowersButton.addEventListener('click', () => { if (currentModalTab !== 'followers') { currentModalTab = 'followers'; updateModalTabsUI(); loadUsersForModalList('followers'); }});
    if (tabFollowingButton) tabFollowingButton.addEventListener('click', () => { if (currentModalTab !== 'following') { currentModalTab = 'following'; updateModalTabsUI(); loadUsersForModalList('following'); }});

    if (modalUserListContainer) {
        modalUserListContainer.addEventListener('click', async (event) => {
            // ... (misma lógica para manejar clics en botones de acción y nombres de usuario dentro del modal)
            const actionButton = event.target.closest('.follow-action-btn[data-action]');
            const usernameLink = event.target.closest('.username[data-user-id-link]');

            if (usernameLink) { /* ... ir al perfil ... */ closeModal(followListModal); window.location.href = `profile.html?id=${encodeURIComponent(usernameLink.dataset.userIdLink)}`; return; }

            if (actionButton && loggedInUserId) {
                const targetUserId = actionButton.dataset.targetUserid;
                const action = actionButton.dataset.action;
                if (!targetUserId || !action) return;

                // ... (lógica fetch para la acción, similar a handleFollowToggle pero para el modal) ...
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
                    
                    loadUsersForModalList(currentModalTab); // Recargar lista del modal
                    loadUserProfileData(viewingUserId);   // Recargar datos del perfil principal
                } catch (error) {
                    console.error(`Error en ${action} desde modal:`, error); alert(`Error: ${error.message}`);
                    actionButton.textContent = originalButtonText; actionButton.disabled = false;
                }
            }
        });
    }

    // =========================================================================
    // LÓGICA DEL MODAL DE EDICIÓN DE IMAGEN
    // =========================================================================
    function openImageEditModal(imageType, currentImageUrl) {
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
                imageEditPreview.src = currentUserData[currentImageTypeToEdit === 'profile' ? 'profilePhotoPath' : 'coverPhotoPath'] || (currentImageTypeToEdit === 'profile' ? 'placeholder-profile.jpg' : 'placeholder-cover.jpg');
                saveImageButton.style.display = 'none';
            }
        });
    }

    if (saveImageButton) {
        saveImageButton.addEventListener('click', async () => {
            if (!selectedFile || !currentImageTypeToEdit || !loggedInUserId) {
                console.warn("Condiciones no cumplidas para guardar imagen: archivo, tipo de imagen o usuario no definidos.");
                uploadStatusMessage.textContent = 'Por favor, selecciona un archivo primero.';
                uploadStatusMessage.className = 'message-area error visible';
                return;
            }

            saveImageButton.disabled = true;
            saveImageButton.textContent = 'Subiendo...';
            uploadStatusMessage.textContent = 'Subiendo imagen...';
            uploadStatusMessage.className = 'message-area visible'; // Mostrar mensaje
            uploadStatusMessage.classList.remove('success', 'error'); // Limpiar clases de estado previas

            const formData = new FormData();
            // El nombre del campo ('profileImage' o 'coverImage') debe coincidir con lo que espera multer en el backend
            formData.append(currentImageTypeToEdit === 'profile' ? 'profileImage' : 'coverImage', selectedFile);
            // ¡IMPORTANTE! En producción, el userId debe venir de una sesión/token autenticado en el backend,
            // no enviado desde el cliente de esta manera, ya que es inseguro.
            formData.append('userId', loggedInUserId); 

            const endpointSuffix = currentImageTypeToEdit === 'profile' ? '/upload/profile-photo' : '/upload/cover-photo';

            try {
                const response = await fetch(`${API_BASE_URL}/user${endpointSuffix}`, {
                    method: 'POST',
                    body: formData,
                    // No establecer 'Content-Type': 'multipart/form-data' manualmente. 
                    // El navegador lo hace automáticamente con el boundary correcto para FormData.
                    // headers: { 'Authorization': `Bearer ${getToken()}` } // Si usaras tokens JWT
                });

                const result = await response.json(); // Intentar parsear la respuesta como JSON

                if (!response.ok) {
                    // Si la respuesta no es ok, result.message debería tener el mensaje de error del backend
                    throw new Error(result.message || `Error del servidor: ${response.status}`);
                }

                uploadStatusMessage.textContent = result.message || "Imagen subida con éxito.";
                uploadStatusMessage.classList.add('success');

                // Actualizar la UI con la nueva ruta de la imagen y el localStorage
                if (currentUserData) { // Asegurarse que currentUserData existe
                    const pathFieldToUpdate = currentImageTypeToEdit === 'profile' ? 'profilePhotoPath' : 'coverPhotoPath';
                    currentUserData[pathFieldToUpdate] = result.filePath; // Actualizar el path en nuestro objeto local

                    // Actualizar localStorage solo si estamos editando nuestro propio perfil
                    if (loggedInUserId && viewingUserId === loggedInUserId) {
                        localStorage.setItem('loggedInUser', JSON.stringify(currentUserData));
                         // LLAMAR A LA FUNCIÓN GLOBAL PARA ACTUALIZAR OTRAS PESTAÑAS Y EL SIDEBAR ACTUAL
                         if (window.updateGlobalUserUI) {
                            window.updateGlobalUserUI(currentUserData);
                        }
                    }
                    
                    
                    // Volver a renderizar el perfil principal para que muestre la nueva imagen
                    // Esto también actualizará la imagen del sidebar si displayUserProfileData lo maneja.
                    displayUserProfileData(currentUserData); 
                }
                
                setTimeout(() => { 
                    closeModal(imageEditModal);
                    // Resetear el botón de guardar y el mensaje después de cerrar
                    saveImageButton.textContent = 'Guardar Cambios';
                    saveImageButton.style.display = 'none'; // Ocultar hasta que se seleccione nuevo archivo
                    selectedFile = null;
                    imageUploadInput.value = ''; // Resetear el input de archivo
                }, 2000); // Cerrar modal después de 2 segundos

            } catch (error) {
                console.error("Error subiendo imagen:", error);
                uploadStatusMessage.textContent = `Error: ${error.message}`;
                uploadStatusMessage.classList.add('error');
                saveImageButton.disabled = false; // Re-habilitar para reintentar
                saveImageButton.textContent = 'Guardar Cambios';
            } 
            // No es necesario un finally para re-habilitar el botón si el flujo de éxito/error lo maneja
            // o si el modal se cierra y el botón se resetea.
        });
    }
    
    // --- Funciones Auxiliares ---
    function escapeHtml(unsafe) { if (unsafe === null || typeof unsafe === 'undefined') return ''; return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'"); }
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
    // --- INICIAR LA PÁGINA ---
    initializeProfilePage();
});