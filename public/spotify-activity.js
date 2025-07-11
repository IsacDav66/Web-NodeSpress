// public/spotify-activity.js
document.addEventListener('DOMContentLoaded', () => {
    const activityContainer = document.getElementById('spotifyActivityContainer');
    const loadingMessageP = document.getElementById('loadingMessage');
    const refreshButton = document.getElementById('refreshActivityButton');
    const lyricsLanguageSelector = document.getElementById('lyricsLanguageSelector');

    let webSocket = null;
    let lastKnownActivityData = [];
    const progressIntervals = {};
    const activeLyricTrackers = {}; // { userId: { originalLyricsData, translatedLyricsData, isShowingTranslated, currentTranslationLang, ...etc } }

    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'");
    }

    function formatTime(ms) {
        if (isNaN(ms) || ms < 0) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    function connectWebSocket() {
        // DESPUÉS (CORREGIDO Y SIMPLIFICADO)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // La conexión WebSocket se hace a la misma ruta base desde donde se sirve la página
        const wsUrl = `${wsProtocol}//${window.location.host}/socianark/`;
        console.log(`[WebSocket] Intentando conectar a: ${wsUrl}`);
        webSocket = new WebSocket(wsUrl);
        webSocket.onopen = () => {
            console.log('[WebSocket] Conectado al servidor.');
            if (loadingMessageP) loadingMessageP.textContent = 'Conectado. Esperando actividad...';
        };
        webSocket.onmessage = (event) => {
            try {
                const messageData = JSON.parse(event.data);
                if (messageData.type === 'spotify_activity_update' && messageData.payload) {
                    lastKnownActivityData = messageData.payload;
                    displaySpotifyActivity(lastKnownActivityData);
                }
            } catch (e) { console.error('Error procesando mensaje del WebSocket:', e, "Data:", event.data); }
        };
        webSocket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            if (loadingMessageP) loadingMessageP.textContent = 'Error de conexión WebSocket.';
        };
        webSocket.onclose = (event) => {
            console.log('[WebSocket] Desconectado. Razón:', event.reason, 'Código:', event.code);
            Object.values(progressIntervals).forEach(clearInterval);
            for (const key in progressIntervals) delete progressIntervals[key];
            for (const key in activeLyricTrackers) delete activeLyricTrackers[key];
            if (!event.wasClean && event.code !== 1000 && event.code !== 1005) {
                if (loadingMessageP) loadingMessageP.textContent = 'Desconectado. Reintentando en 5s...';
                setTimeout(connectWebSocket, 5000);
            } else {
                if (loadingMessageP) loadingMessageP.textContent = 'Conexión cerrada.';
            }
        };
    }

    // Función para aplicar sombra dinámica usando fast-average-color
    function applyDynamicAlbumShadowWithLibrary(imgElement, containerElement) {
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            // ... (lógica de onload y onerror sin cambios) ...
            const loadHandler = () => { /* ... */ };
            const errorHandler = () => { /* ... */ };
            imgElement.addEventListener('load', loadHandler);
            imgElement.addEventListener('error', errorHandler);
            return;
        }

        if (typeof FastAverageColor === 'undefined') {
            console.warn("FastAverageColor no está definido. Usando sombra por defecto.");
            if (containerElement) containerElement.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)'; // Sombra uniforme por defecto
            return;
        }

        const fac = new FastAverageColor();
        fac.getColorAsync(imgElement, { algorithm: 'dominant' })
            .then(color => {
                if (color && !color.error) {
                    // Usaremos el color directamente o una versión ligeramente desaturada/oscurecida
                    // para la sombra, dependiendo de qué se vea mejor.
                    
                    // Opción A: Usar el color casi directamente con opacidad
                    // const shadowR = color.value[0];
                    // const shadowG = color.value[1];
                    // const shadowB = color.value[2];
                    // const shadowOpacity = 0.45; // Ajusta esta opacidad

                    // Opción B: Hacer el color de la sombra un poco más oscuro y/o desaturado
                    // Esto a menudo se ve mejor para las sombras.
                    const desaturateAmount = 0.2; // 0 = sin cambios, 1 = gris
                    const darkenAmount = 30;    // Cuánto oscurecer (0-255)

                    let r = color.value[0];
                    let g = color.value[1];
                    let b = color.value[2];

                    // Desaturar ligeramente (mover hacia el promedio de los componentes)
                    const avg = (r + g + b) / 3;
                    r = Math.floor(r * (1 - desaturateAmount) + avg * desaturateAmount);
                    g = Math.floor(g * (1 - desaturateAmount) + avg * desaturateAmount);
                    b = Math.floor(b * (1 - desaturateAmount) + avg * desaturateAmount);

                    // Oscurecer
                    const shadowR = Math.max(0, r - darkenAmount);
                    const shadowG = Math.max(0, g - darkenAmount);
                    const shadowB = Math.max(0, b - darkenAmount);
                    const shadowOpacity = 0.6; // Opacidad de la sombra

                    // Aplicar la sombra: offsetX=0, offsetY=0
                    // Ajusta el blur-radius (tercer valor) y el spread-radius (cuarto valor, opcional)
                    // Un spread positivo expande la sombra.
                    const blurRadius = "20px";  // Cuán difusa es la sombra
                    const spreadRadius = "0px"; // Cuánto se expande la sombra antes del blur (puede ser negativo)
                                                // Un spread pequeño (ej. 2px o 3px) puede hacerla más notable
                                                // sin necesidad de un blur muy grande.

                    containerElement.style.boxShadow = `0 0 ${blurRadius} ${spreadRadius} rgba(${shadowR},${shadowG},${shadowB}, ${shadowOpacity})`;
                    
                    // Si quieres un efecto de "halo" más sutil, puedes reducir el blur y quitar el spread
                    // containerElement.style.boxShadow = `0 0 15px rgba(${shadowR},${shadowG},${shadowB}, 0.5)`;

                } else {
                    console.warn("FAC no pudo obtener color:", color ? color.error : 'Error desconocido', imgElement.src);
                    containerElement.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.15)'; // Sombra gris uniforme por defecto
                }
            })
            .catch(e => {
                console.error("FAC Error procesando imagen:", e, imgElement.src);
                containerElement.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.15)'; // Sombra gris uniforme por defecto
            });
    }

    function createOrUpdateCard(activity) {
        if (!activityContainer || !activity || !activity.userId || !activity.track) return null;

        const userId = activity.userId;
        const track = activity.track;
        let card = activityContainer.querySelector(`.spotify-user-card[data-user-id="${userId}"]`);
        
        let tracker = activeLyricTrackers[userId];
        const isNewSong = !tracker || tracker.trackUrl !== track.url;
        let oldOverlayVisibilityState = false; 

        // --- INICIO LÓGICA DE ACTUALIZACIÓN DEL TRACKER (PARA PROGRESO Y ESTADO) ---
        if (isNewSong) {
            if(tracker) oldOverlayVisibilityState = tracker.isLyricsOverlayVisible; 
            activeLyricTrackers[userId] = {
                originalLyricsData: null, 
                translatedLyricsData: null,
                currentLineText: '...',
                serverProgressMs: track.progress_ms,
                clientTimestamp: Date.now(),
                durationMs: track.duration_ms,
                serverEventTimestamp: track.timestamp,
                trackUrl: track.url,
                isLyricsOverlayVisible: isNewSong ? false : oldOverlayVisibilityState, 
                isShowingTranslated: false,
                currentTranslationLang: null
            };
            tracker = activeLyricTrackers[userId]; 
        } else if (tracker) { 
            tracker.serverProgressMs = track.progress_ms;
            tracker.clientTimestamp = Date.now();
            tracker.durationMs = track.duration_ms; 
            tracker.serverEventTimestamp = track.timestamp;
        } else { // Caso de seguridad: no había tracker y no es canción nueva (raro, pero crear tracker)
             activeLyricTrackers[userId] = {
                originalLyricsData: null, translatedLyricsData: null, currentLineText: '...',
                serverProgressMs: track.progress_ms, clientTimestamp: Date.now(), durationMs: track.duration_ms,
                serverEventTimestamp: track.timestamp, trackUrl: track.url, isLyricsOverlayVisible: false,
                isShowingTranslated: false, currentTranslationLang: null
            };
            tracker = activeLyricTrackers[userId];
        }
        // --- FIN LÓGICA DE ACTUALIZACIÓN DEL TRACKER ---

        // Reconstruir el innerHTML de la tarjeta solo si es una nueva canción o la tarjeta es nueva
        if (isNewSong || !card) {
            if (!card) { 
                card = document.createElement('div');
                card.className = 'spotify-user-card';
                card.dataset.userId = userId;
                activityContainer.appendChild(card);
                requestAnimationFrame(() => { card.classList.add('visible'); });
            }

            let lyricsOverlayDivInnerHTML = '';
            let hasLyrics = track.syncedLyrics && track.syncedLyrics.length > 0;

            if (hasLyrics) {
                tracker.originalLyricsData = track.syncedLyrics;
                if(isNewSong) { // Si es nueva canción, las traducciones anteriores no aplican
                    tracker.translatedLyricsData = null;
                    tracker.isShowingTranslated = false;
                    tracker.currentTranslationLang = null;
                }
                lyricsOverlayDivInnerHTML = `<div class="spotify-lyrics-display-area"><p class="lyric-line-context lyric-current"></p></div>`;
            } else {
                if (tracker) { // Si no hay letras, asegurar que el tracker lo refleje
                    tracker.originalLyricsData = null;
                    tracker.translatedLyricsData = null;
                    tracker.isShowingTranslated = false;
                }
            }

            card.innerHTML = `
                <img src="${escapeHtml(activity.profilePhotoPath || 'placeholder-profile.jpg')}" alt="Perfil de ${escapeHtml(activity.pushname)}" class="user-profile-pic">
                <p class="user-name">${escapeHtml(activity.pushname)}</p>
                <div class="spotify-track-info">
                    <div class="album-art-container">
                        <a class="spotify-album-link-image-only" href="${escapeHtml(track.url || '#')}" target="_blank" rel="noopener noreferrer" title="Abrir en Spotify: ${escapeHtml(track.name)}">
                            <img src="${escapeHtml(track.albumArtUrl || 'placeholder-cover.jpg')}" alt="Carátula de ${escapeHtml(track.album)}" class="album-art">
                        </a>
                        ${lyricsOverlayDivInnerHTML ? `<div class="lyrics-overlay">${lyricsOverlayDivInnerHTML}</div>` : ''}
                    </div>
                    <p class="track-name"><a href="${escapeHtml(track.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(track.name)}</a></p>
                    <p class="track-artist">${escapeHtml(track.artist)}</p>
                    <p class="track-album">Álbum: ${escapeHtml(track.album)}</p>
                    <div class="spotify-progress-bar-container"><div class="spotify-progress-bar-fill"></div></div>
                    <div class="spotify-progress-time">
                        <span class="spotify-progress-time-current">${formatTime(track.progress_ms)}</span>
                        <span class="spotify-progress-time-total">${formatTime(track.duration_ms)}</span>
                    </div>
                    ${hasLyrics ? '<button class="translate-lyrics-btn">Traducir Letras</button>' : ''}
                </div>`;

            // Obtener elementos después de que el innerHTML se haya establecido
            const albumArtImageEl = card.querySelector('.album-art');
            const albumArtContainerEl = card.querySelector('.album-art-container');
            const lyricsOverlayEl = albumArtContainerEl?.querySelector('.lyrics-overlay');
            const translateBtn = card.querySelector('.translate-lyrics-btn');

            // Aplicar sombra dinámica
            if (albumArtImageEl && albumArtContainerEl) {
                albumArtImageEl.crossOrigin = "Anonymous";
                if (albumArtImageEl.complete && albumArtImageEl.naturalWidth !== 0) {
                    applyDynamicAlbumShadowWithLibrary(albumArtImageEl, albumArtContainerEl);
                } else {
                     const shadowLoadHandler = () => {
                        applyDynamicAlbumShadowWithLibrary(albumArtImageEl, albumArtContainerEl);
                        albumArtImageEl.removeEventListener('load', shadowLoadHandler);
                        albumArtImageEl.removeEventListener('error', shadowErrorHandler);
                    };
                    const shadowErrorHandler = () => {
                        console.warn("Error al cargar imagen (en reconstruction), usando sombra por defecto:", albumArtImageEl.src);
                        if (albumArtContainerEl) albumArtContainerEl.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                        albumArtImageEl.removeEventListener('load', shadowLoadHandler);
                        albumArtImageEl.removeEventListener('error', shadowErrorHandler);
                    };
                    albumArtImageEl.addEventListener('load', shadowLoadHandler);
                    albumArtImageEl.addEventListener('error', shadowErrorHandler);
                }
            }

            // Listeners para overlay de letras
            if (albumArtContainerEl && albumArtImageEl && lyricsOverlayEl && hasLyrics) {
                 if (tracker?.isLyricsOverlayVisible) {
                    albumArtImageEl.style.filter = 'brightness(30%)';
                    lyricsOverlayEl.style.opacity = '1';
                    lyricsOverlayEl.style.visibility = 'visible';
                }
                albumArtContainerEl.addEventListener('mouseenter', () => {
                    if (activeLyricTrackers[userId]?.originalLyricsData) {
                        activeLyricTrackers[userId].isLyricsOverlayVisible = true;
                        albumArtImageEl.style.filter = 'brightness(30%)';
                        lyricsOverlayEl.style.opacity = '1';
                        lyricsOverlayEl.style.visibility = 'visible';
                        lyricsOverlayEl.style.transitionDelay = '0s';
                    }
                });
                albumArtContainerEl.addEventListener('mouseleave', () => {
                    if (activeLyricTrackers[userId]?.originalLyricsData) {
                        activeLyricTrackers[userId].isLyricsOverlayVisible = false;
                        albumArtImageEl.style.filter = 'brightness(100%)';
                        lyricsOverlayEl.style.opacity = '0';
                        lyricsOverlayEl.style.visibility = 'hidden';
                        lyricsOverlayEl.style.transitionDelay = '0.3s';
                    }
                });
            }
            
            // Listener para botón de traducción
            if (translateBtn && tracker && hasLyrics) {
                updateTranslateButtonText(translateBtn, tracker);
                translateBtn.addEventListener('click', () => handleTranslateClick(userId, translateBtn));
            }

        } else if (tracker) { // Misma canción, la tarjeta ya existe, solo actualizar dinámicamente si es necesario
            // El progreso ya se actualizó en el tracker al inicio de esta función.
            
            // Verificar si la URL de la carátula cambió
            const currentAlbumArtImg = card.querySelector('.album-art');
            const albumArtContainerEl = card.querySelector('.album-art-container'); // Necesario para la sombra
            const newAlbumArtUrl = track.albumArtUrl || 'placeholder-cover.jpg';
            if (currentAlbumArtImg && albumArtContainerEl && currentAlbumArtImg.src !== newAlbumArtUrl) {
                currentAlbumArtImg.src = newAlbumArtUrl;
                currentAlbumArtImg.crossOrigin = "Anonymous";
                // Recalcular sombra si la imagen cambia
                if (currentAlbumArtImg.complete && currentAlbumArtImg.naturalWidth !== 0) {
                    applyDynamicAlbumShadowWithLibrary(currentAlbumArtImg, albumArtContainerEl);
                } else {
                    const shadowLoadHandler = () => {
                        applyDynamicAlbumShadowWithLibrary(currentAlbumArtImg, albumArtContainerEl);
                        currentAlbumArtImg.removeEventListener('load', shadowLoadHandler);
                        currentAlbumArtImg.removeEventListener('error', shadowErrorHandler);
                    };
                    const shadowErrorHandler = () => {
                         console.warn("Error al cargar imagen (en update), usando sombra por defecto:", currentAlbumArtImg.src);
                        if (albumArtContainerEl) albumArtContainerEl.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                        currentAlbumArtImg.removeEventListener('load', shadowLoadHandler);
                        currentAlbumArtImg.removeEventListener('error', shadowErrorHandler);
                    };
                    currentAlbumArtImg.addEventListener('load', shadowLoadHandler);
                    currentAlbumArtImg.addEventListener('error', shadowErrorHandler);
                }
            }

            // Verificar si las letras originales cambiaron
            let hasLyricsNow = track.syncedLyrics && track.syncedLyrics.length > 0;
            if (JSON.stringify(tracker.originalLyricsData) !== JSON.stringify(track.syncedLyrics)) {
                tracker.originalLyricsData = hasLyricsNow ? track.syncedLyrics : null;
                tracker.translatedLyricsData = null; 
                tracker.isShowingTranslated = false;
                tracker.currentTranslationLang = null;
                
                const translateBtn = card.querySelector('.translate-lyrics-btn');
                const lyricsOverlayEl = card.querySelector('.lyrics-overlay');
                const albumArtCont = card.querySelector('.album-art-container');


                if (hasLyricsNow) {
                    if (!lyricsOverlayEl && albumArtCont) { // Si no había overlay, crearlo
                        const newOverlay = document.createElement('div');
                        newOverlay.className = 'lyrics-overlay';
                        newOverlay.innerHTML = `<div class="spotify-lyrics-display-area"><p class="lyric-line-context lyric-current"></p></div>`;
                        albumArtCont.appendChild(newOverlay);
                        // Re-adjuntar listeners de mouseenter/leave al albumArtCont si es necesario
                        // (ya están en el else if de arriba, pero podría ser más granular)
                    } else if (lyricsOverlayEl && !lyricsOverlayEl.querySelector('.spotify-lyrics-display-area')) {
                         lyricsOverlayEl.innerHTML = `<div class="spotify-lyrics-display-area"><p class="lyric-line-context lyric-current"></p></div>`;
                    }

                    if (!translateBtn) {
                        const trackInfoDiv = card.querySelector('.spotify-track-info');
                        if (trackInfoDiv) {
                             const newTranslateBtn = document.createElement('button');
                             newTranslateBtn.className = 'translate-lyrics-btn';
                             updateTranslateButtonText(newTranslateBtn, tracker);
                             newTranslateBtn.addEventListener('click', () => handleTranslateClick(userId, newTranslateBtn));
                             trackInfoDiv.appendChild(newTranslateBtn);
                        }
                    } else {
                        updateTranslateButtonText(translateBtn, tracker);
                    }
                } else { // Ya no hay letras
                    if (lyricsOverlayEl) lyricsOverlayEl.innerHTML = ''; 
                    if (translateBtn) translateBtn.remove();
                    if (tracker.isLyricsOverlayVisible) {
                        const albumArtImageEl = card.querySelector('.album-art');
                        if(albumArtImageEl) albumArtImageEl.style.filter = 'brightness(100%)';
                        if(lyricsOverlayEl) {
                             lyricsOverlayEl.style.opacity = '0';
                             lyricsOverlayEl.style.visibility = 'hidden';
                        }
                        tracker.isLyricsOverlayVisible = false;
                    }
                }
            }
            // Actualizar el tiempo total en la UI si cambió, aunque sea la misma canción
            const totalTimeEl = card.querySelector('.spotify-progress-time-total');
            if (totalTimeEl && totalTimeEl.textContent !== formatTime(track.duration_ms)) {
                 totalTimeEl.textContent = formatTime(track.duration_ms);
            }
        }
        
        if (track.duration_ms > 0 && tracker) { // Asegurarse que el tracker existe para el progreso
            setupUpdateInterval(card, userId, tracker.durationMs, tracker.serverProgressMs);
        } else if (progressIntervals[userId]) { 
            clearInterval(progressIntervals[userId]);
            delete progressIntervals[userId];
            const progressBarFill = card.querySelector('.spotify-progress-bar-fill');
            const currentTimeEl = card.querySelector('.spotify-progress-time-current');
            if (progressBarFill && progressBarFill.style.width !== '0%') progressBarFill.style.width = '0%';
            if (currentTimeEl && currentTimeEl.textContent !== formatTime(0)) currentTimeEl.textContent = formatTime(0);
        }
        
        return card;
    }

    async function handleTranslateClick(userId, buttonElement) {
        const tracker = activeLyricTrackers[userId];
        const targetLang = lyricsLanguageSelector.value;

        if (!tracker || !tracker.originalLyricsData || tracker.originalLyricsData.length === 0) {
            alert("No hay letras disponibles para traducir.");
            return;
        }

        buttonElement.disabled = true;
        const originalButtonText = buttonElement.textContent;

        if (tracker.isShowingTranslated && tracker.currentTranslationLang === targetLang) {
            tracker.isShowingTranslated = false;
            updateTranslateButtonText(buttonElement, tracker);
            buttonElement.disabled = false;
            const card = buttonElement.closest('.spotify-user-card');
            if (card) setupUpdateInterval(card, userId);
            return;
        }
        
        if (tracker.translatedLyricsData && tracker.currentTranslationLang === targetLang) {
            tracker.isShowingTranslated = true;
            updateTranslateButtonText(buttonElement, tracker);
            buttonElement.disabled = false;
            const card = buttonElement.closest('.spotify-user-card');
            if (card) setupUpdateInterval(card, userId);
            return;
        }

        buttonElement.textContent = 'Traduciendo...';

        try {
            const translatedLinesPromises = tracker.originalLyricsData.map(async (line) => {
                if (!line.text.trim()) return { time: line.time, text: '' }; 

                const response = await fetch('/api/translate/text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: line.text, 
                        targetLang: targetLang 
                        // ASEGÚRATE DE QUE NO HAY NINGUNA LÍNEA sourceLang AQUÍ
                    }) 
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({ message: 'Error desconocido del servidor de traducción.' }));
                    console.error(`Error traduciendo línea "${line.text.substring(0,20)}...":`, errData.message);
                    return { time: line.time, text: `(Error: ${errData.message})` }; // Devuelve el error en la línea
                    // throw new Error(errData.message || `Error del servidor al traducir línea: ${line.text.substring(0,20)}`);
                }
                const result = await response.json();
                return { time: line.time, text: result.translatedText };
            });

            const translatedLyrics = await Promise.all(translatedLinesPromises);
            tracker.translatedLyricsData = translatedLyrics;
            tracker.isShowingTranslated = true;
            tracker.currentTranslationLang = targetLang;
            updateTranslateButtonText(buttonElement, tracker);

        } catch (error) { // Este catch podría no activarse si los errores son por línea
            console.error("Error traduciendo letras (bloque principal):", error);
            alert(`No se pudieron traducir completamente las letras: ${error.message}`);
            buttonElement.textContent = originalButtonText;
            // No reseteamos isShowingTranslated aquí, dejamos que el usuario lo intente de nuevo o cambie de vista
        } finally {
            buttonElement.disabled = false;
            const card = buttonElement.closest('.spotify-user-card');
            if (card) setupUpdateInterval(card, userId);
        }
    }
    
    function updateTranslateButtonText(buttonElement, tracker) {
        if (!buttonElement || !tracker) return;
        const targetLangDisplay = lyricsLanguageSelector.options[lyricsLanguageSelector.selectedIndex]?.text || tracker.currentTranslationLang || "idioma";
        if (tracker.isShowingTranslated) {
            buttonElement.textContent = `Mostrar Original (Trad. a ${targetLangDisplay})`;
            buttonElement.classList.add('showing-translated');
        } else {
            buttonElement.textContent = `Traducir a ${targetLangDisplay}`;
            buttonElement.classList.remove('showing-translated');
        }
    }
    
    function setupUpdateInterval(cardElement, userId, initialDurationMs, initialServerProgressMs) {
        if (progressIntervals[userId]) {
            clearInterval(progressIntervals[userId]);
            // delete progressIntervals[userId]; // No lo borramos aquí todavía, solo limpiamos
        }

        // Elementos del DOM para la barra de progreso y tiempo
        const progressBarFill = cardElement.querySelector('.spotify-progress-bar-fill');
        const currentTimeEl = cardElement.querySelector('.spotify-progress-time-current');
        
        // Si los elementos básicos para la barra de progreso no existen, no podemos continuar.
        if (!progressBarFill || !currentTimeEl) {
            console.warn(`[SetupInterval ${userId}] No se encontraron elementos de progreso en la tarjeta. Abortando intervalo.`);
            if (progressIntervals[userId]) delete progressIntervals[userId]; // Ahora sí borrar si abortamos
            return;
        }

        const performUpdate = () => {
            const currentTracker = activeLyricTrackers[userId]; // Obtener el tracker actual

            // Necesitamos la información de progreso. Si el tracker no existe o no tiene los datos,
            // no podemos calcular el progreso estimado de forma fiable.
            if (!currentTracker || currentTracker.durationMs === undefined || currentTracker.serverProgressMs === undefined || currentTracker.clientTimestamp === undefined) {
                // console.warn(`[PerformUpdate ${userId}] Tracker no disponible o incompleto. La barra de progreso no se actualizará. Tracker:`, currentTracker);
                
                // Intentar un reseteo visual a 0 si los elementos existen
                if (progressBarFill.style.width !== '0%') progressBarFill.style.width = '0%';
                if (currentTimeEl.textContent !== formatTime(0)) currentTimeEl.textContent = formatTime(0);
                
                // Limpiar el texto de la letra si el elemento existe
                const lyricCurrentElFromPerform = cardElement.querySelector('.lyric-current');
                if (lyricCurrentElFromPerform && lyricCurrentElFromPerform.textContent !== '') {
                    lyricCurrentElFromPerform.textContent = '';
                }

                // Si el intervalo sigue existiendo para este usuario, limpiarlo.
                if (progressIntervals[userId]) {
                    clearInterval(progressIntervals[userId]);
                    delete progressIntervals[userId];
                }
                return; // Salir de performUpdate si no hay datos de tracker válidos
            }

            // Lógica para actualizar el texto del botón de traducción si es necesario
            const translateBtnInsidePerformUpdate = cardElement.querySelector('.translate-lyrics-btn');
            if (translateBtnInsidePerformUpdate && currentTracker.originalLyricsData) {
                const currentSelectedLang = lyricsLanguageSelector.value;
                const buttonText = translateBtnInsidePerformUpdate.textContent;
                const selectedLangText = lyricsLanguageSelector.options[lyricsLanguageSelector.selectedIndex]?.text;
                let needsButtonUpdate = false;

                if (currentTracker.isShowingTranslated) {
                    if (currentTracker.currentTranslationLang !== currentSelectedLang || 
                        (selectedLangText && !buttonText.includes(selectedLangText)) ||
                        !buttonText.startsWith("Mostrar Original")) {
                        needsButtonUpdate = true;
                    }
                } else { // Mostrando original
                    if ((selectedLangText && !buttonText.includes(selectedLangText)) || 
                        !buttonText.startsWith("Traducir a")) {
                        needsButtonUpdate = true;
                    }
                }
                if (needsButtonUpdate) {
                     updateTranslateButtonText(translateBtnInsidePerformUpdate, currentTracker);
                }
            }

            // Desestructurar datos del tracker actual para la actualización
            const { serverProgressMs, clientTimestamp, durationMs, originalLyricsData, translatedLyricsData, isShowingTranslated, isLyricsOverlayVisible } = currentTracker;
            
            let currentEstimatedProgressMs = serverProgressMs + (Date.now() - clientTimestamp);
            currentEstimatedProgressMs = Math.max(0, Math.min(currentEstimatedProgressMs, durationMs));

            // Actualizar barra de progreso
            const percentage = (currentEstimatedProgressMs / durationMs) * 100;
            if (progressBarFill.style.width !== `${percentage}%`) { // Solo actualizar si hay cambio real
                 progressBarFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            }
            // Actualizar tiempo actual
            const newTimeText = formatTime(currentEstimatedProgressMs);
            if (currentTimeEl.textContent !== newTimeText) {
                currentTimeEl.textContent = newTimeText;
            }


            // Lógica de letras (solo si hay tracker con letras y el overlay está visible)
            const lyricsOverlay = cardElement.querySelector('.lyrics-overlay');
            const lyricCurrentEl = lyricsOverlay?.querySelector('.lyric-current');

            if (lyricCurrentEl && isLyricsOverlayVisible && (originalLyricsData || translatedLyricsData)) {
                const lyricsToUse = (isShowingTranslated && translatedLyricsData) ? translatedLyricsData : originalLyricsData;
                let currentDisplayableLineText = '...'; // Default si no se encuentra línea
                
                if (lyricsToUse && lyricsToUse.length > 0) {
                    let lastPassedLineIndex = -1;
                    for (let i = 0; i < lyricsToUse.length; i++) {
                        if (currentEstimatedProgressMs >= lyricsToUse[i].time) {
                            lastPassedLineIndex = i;
                        } else {
                            break; 
                        }
                    }
                    if (lastPassedLineIndex !== -1) {
                        currentDisplayableLineText = lyricsToUse[lastPassedLineIndex].text;
                    }
                } else if (isShowingTranslated && !translatedLyricsData) { // Intentando mostrar traducida pero no hay
                    currentDisplayableLineText = '(Traducción no disponible o pendiente)';
                } else if (!originalLyricsData) { // No hay letras originales en absoluto
                     currentDisplayableLineText = '(Letra no disponible)';
                }

                if (lyricCurrentEl.textContent !== currentDisplayableLineText) {
                    lyricCurrentEl.textContent = currentDisplayableLineText;
                }
                // Actualizar el texto actual en el tracker si es necesario
                if (currentTracker.currentLineText !== currentDisplayableLineText) {
                    currentTracker.currentLineText = currentDisplayableLineText; 
                }
            } else if (lyricCurrentEl && currentTracker.currentLineText !== '') { // Si el overlay no está visible pero había texto
                // No limpiamos el DOM, pero sí el tracker si la línea lógica cambiaría
                // Esto es para que cuando se muestre, tenga el texto correcto o '...'
                let logicalLineTextIfVisible = '...';
                const lyricsToUse = (currentTracker.isShowingTranslated && currentTracker.translatedLyricsData) ? currentTracker.translatedLyricsData : currentTracker.originalLyricsData;
                 if (lyricsToUse && lyricsToUse.length > 0) {
                    let lastPassedLineIndexWhileHidden = -1;
                    for (let i = 0; i < lyricsToUse.length; i++) {
                        if (currentEstimatedProgressMs >= lyricsToUse[i].time) { lastPassedLineIndexWhileHidden = i;} else {break;}
                    }
                    if (lastPassedLineIndexWhileHidden !== -1) logicalLineTextIfVisible = lyricsToUse[lastPassedLineIndexWhileHidden].text;
                 }
                if(currentTracker.currentLineText !== logicalLineTextIfVisible) currentTracker.currentLineText = logicalLineTextIfVisible;
            }


            // Detener intervalo si la canción ha terminado
            if (currentEstimatedProgressMs >= durationMs) {
                clearInterval(progressIntervals[userId]);
                delete progressIntervals[userId]; // Ahora sí lo borramos del objeto
                // Asegurar que la barra esté al 100%
                if (progressBarFill.style.width !== '100%') {
                    progressBarFill.style.width = '100%';
                }
            }
        }; // Fin de performUpdate
        
        // Iniciar el intervalo si la duración inicial es válida
        if (initialDurationMs > 0) {
            performUpdate(); // Llamada inicial para establecer el estado visual correcto
            // Solo iniciar el intervalo si la canción no ha terminado ya
            if (initialServerProgressMs < initialDurationMs) {
                progressIntervals[userId] = setInterval(performUpdate, 250); 
            } else { // Canción ya terminó según los datos iniciales
                 if (progressBarFill.style.width !== '100%') progressBarFill.style.width = '100%';
                 if (progressIntervals[userId]) delete progressIntervals[userId]; // Asegurar limpieza
            }
        } else {
            // Si la duración no es válida (ej. 0 o undefined), al menos llamar a performUpdate una vez
            // para intentar limpiar/resetear la UI de progreso a un estado por defecto (0%).
            performUpdate();
            if (progressIntervals[userId]) delete progressIntervals[userId]; // Asegurar limpieza
        }
    }
    
    if (lyricsLanguageSelector) {
        lyricsLanguageSelector.addEventListener('change', () => {
            activityContainer.querySelectorAll('.spotify-user-card').forEach(card => {
                const userId = card.dataset.userId;
                const tracker = activeLyricTrackers[userId];
                const translateBtn = card.querySelector('.translate-lyrics-btn');
                if (tracker && translateBtn) {
                    if (tracker.isShowingTranslated && tracker.currentTranslationLang !== lyricsLanguageSelector.value) {
                        // Si el idioma global cambia y se estaba mostrando una traducción a OTRO idioma,
                        // volvemos a mostrar el original y actualizamos el texto del botón.
                        // El usuario tendrá que hacer clic de nuevo para traducir al nuevo idioma seleccionado.
                        tracker.isShowingTranslated = false; 
                    }
                    updateTranslateButtonText(translateBtn, tracker);
                     // Si queremos forzar la actualización de la línea actual en el overlay inmediatamente:
                    if (tracker.isLyricsOverlayVisible) {
                        const lyricsOverlay = card.querySelector('.lyrics-overlay');
                        const lyricCurrentEl = lyricsOverlay?.querySelector('.lyric-current');
                        if (lyricCurrentEl) { // Forzar una actualización de la línea de letra
                            const lyricsToUse = (tracker.isShowingTranslated && tracker.translatedLyricsData) ? tracker.translatedLyricsData : tracker.originalLyricsData;
                            let currentDisplayableLineText = '...';
                             if (lyricsToUse && lyricsToUse.length > 0) {
                                let lastPassedLineIndex = -1;
                                const currentProgress = tracker.serverProgressMs + (Date.now() - tracker.clientTimestamp);
                                for (let i = 0; i < lyricsToUse.length; i++) {
                                    if (currentProgress >= lyricsToUse[i].time) { lastPassedLineIndex = i; } else { break; }
                                }
                                if (lastPassedLineIndex !== -1) currentDisplayableLineText = lyricsToUse[lastPassedLineIndex].text;
                            }
                            lyricCurrentEl.textContent = currentDisplayableLineText;
                        }
                    }
                }
            });
        });
    }

    function displaySpotifyActivity(usersActivity) { 
        if (!activityContainer || !loadingMessageP) return;
        if (loadingMessageP.style.display !== 'none') loadingMessageP.style.display = 'none';
        if (refreshButton && refreshButton.style.display !== 'block') refreshButton.style.display = 'block';

        const activePlayingUsers = usersActivity.filter(act =>
            act?.userId && act.isPlaying && act.track &&
            act.track.duration_ms > 0 && act.track.progress_ms !== undefined &&
            act.track.timestamp !== undefined
        );
        const currentActiveUserIds = new Set(activePlayingUsers.map(u => u.userId));
        const cardsToRemove = [];

        activityContainer.querySelectorAll('.spotify-user-card').forEach(cardNode => {
            const cardUserId = cardNode.dataset.userId;
            if (!currentActiveUserIds.has(cardUserId)) {
                cardsToRemove.push(cardNode);
                if (progressIntervals[cardUserId]) { clearInterval(progressIntervals[cardUserId]); delete progressIntervals[cardUserId]; }
                if (activeLyricTrackers[cardUserId]) delete activeLyricTrackers[cardUserId];
            }
        });
        cardsToRemove.forEach(cardNode => {
            cardNode.classList.remove('visible');
            cardNode.addEventListener('transitionend', () => cardNode.remove(), { once: true });
            setTimeout(() => { if (cardNode.parentElement) cardNode.remove(); }, 500);
        });

        activePlayingUsers.forEach(activity => { createOrUpdateCard(activity); });

        const noUsersMessageElement = activityContainer.querySelector('p.no-activity-message');
        if (activePlayingUsers.length === 0 && activityContainer.querySelectorAll('.spotify-user-card').length === 0) { // Condición extra
            if (!noUsersMessageElement) {
                // const delay = activityContainer.querySelector('.spotify-user-card') ? 550 : 0;
                // setTimeout(() => { // Eliminado el timeout aquí para mostrar el mensaje antes si no hay tarjetas
                    if (activityContainer.querySelectorAll('.spotify-user-card').length === 0 && !activityContainer.querySelector('p.no-activity-message')) {
                        const p = document.createElement('p');
                        p.className = 'no-activity-message';
                        p.textContent = 'Ningún usuario está escuchando música en Spotify en este momento.';
                        activityContainer.innerHTML = '';
                        activityContainer.appendChild(p);
                    }
                // }, delay);
            }
        } else {
            if (noUsersMessageElement) noUsersMessageElement.remove();
        }
    }

    if (refreshButton) { 
        refreshButton.addEventListener('click', () => {
            displaySpotifyActivity(lastKnownActivityData);
            console.log("Actualización manual de UI solicitada con los últimos datos conocidos.");
        });
    }
    connectWebSocket();
});