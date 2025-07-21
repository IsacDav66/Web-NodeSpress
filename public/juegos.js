// public/juegos/juegos.js
document.addEventListener('DOMContentLoaded', () => {
    const gameMenuUl = document.getElementById('game-menu');
    const gameShowcaseArea = document.getElementById('game-showcase-area');
    const gameContentArea = document.getElementById('game-content-area');
    const juegosInstructionsP = document.getElementById('juegos-instructions');

    const AVAILABLE_GAME_IDS = ['pacman', 'slots', 'roulette']; 
    
    const loadedGameModules = {};

    async function initializeGamesPage() {
        if (!gameShowcaseArea || !gameMenuUl || !juegosInstructionsP) {
            console.error("Elementos base de la página de juegos no encontrados.");
            if (juegosInstructionsP) juegosInstructionsP.textContent = "Error al cargar la página de juegos.";
            return;
        }
        juegosInstructionsP.textContent = 'Cargando información de juegos...';
        gameShowcaseArea.innerHTML = '';
        gameMenuUl.innerHTML = '';

        for (const gameId of AVAILABLE_GAME_IDS) {
            try {
                await loadGameScript(gameId);
                const gameModule = window[`${gameId}GameModule`];

                // MODIFICADO: Aceptamos módulos que tengan init O que sean de tipo godot
                if (gameModule && (typeof gameModule.init === 'function' || gameModule.type === 'godot')) {
                    loadedGameModules[gameId] = gameModule;
                    addGameToMenu(gameModule);
                    addGameToShowcase(gameModule);
                } else {
                    console.warn(`Módulo para el juego ${gameId} no encontrado o mal configurado.`);
                }
            } catch (error) {
                console.error(`Error al procesar el juego ${gameId}:`, error);
            }
        }
        
        if (Object.keys(loadedGameModules).length === 0) {
            juegosInstructionsP.textContent = 'No hay juegos disponibles en este momento.';
            gameShowcaseArea.appendChild(juegosInstructionsP);
        } else {
             juegosInstructionsP.style.display = 'none';
        }

        setupEventListeners();
    }

    function loadGameScript(gameId) {
        return new Promise((resolve, reject) => {
            const oldScript = document.getElementById(`game-script-${gameId}`);
            if (oldScript) oldScript.remove();

            const script = document.createElement('script');
            script.src = `juegos/${gameId}-game.js`;
            script.id = `game-script-${gameId}`;
            script.onload = () => {
                console.log(`Script para ${gameId} cargado.`);
                resolve();
            };
            script.onerror = () => {
                console.error(`Error cargando script para ${gameId}`);
                reject(new Error(`No se pudo cargar el script para ${gameId}`));
            };
            document.body.appendChild(script);
        });
    }
    
    function addGameToMenu(gameModule) {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.dataset.gameId = gameModule.id;
        link.innerHTML = gameModule.name;
        listItem.appendChild(link);
        gameMenuUl.appendChild(listItem);
    }

    function addGameToShowcase(gameModule) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = gameModule.id;

        card.innerHTML = `
            <img src="${gameModule.coverImage || 'placeholder-cover.png'}" alt="Portada de ${gameModule.name}" class="game-card-cover">
            <h3 class="game-card-name">${gameModule.name}</h3>
            <p class="game-card-description">${gameModule.description || ''}</p>
            <button class="game-card-play-btn" data-game-id="${gameModule.id}">Jugar</button>
        `;
        gameShowcaseArea.appendChild(card);
    }

    function setupEventListeners() {
        gameMenuUl.addEventListener('click', (event) => {
            event.preventDefault();
            const targetLink = event.target.closest('a[data-game-id]');
            if (targetLink) {
                const gameId = targetLink.dataset.gameId;
                setActiveMenuItem(gameId);
                launchGame(gameId);
            }
        });

        gameShowcaseArea.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button.game-card-play-btn[data-game-id]');
            if (targetButton) {
                const gameId = targetButton.dataset.gameId;
                setActiveMenuItem(gameId);
                launchGame(gameId);
            }
        });
    }
    
    function setActiveMenuItem(gameIdToActivate) {
        gameMenuUl.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        const activeLink = gameMenuUl.querySelector(`a[data-game-id="${gameIdToActivate}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // --- INICIO: Lógica de Pantalla Completa ---
// Ponemos esto fuera de launchGame para poder quitar el listener después.
let fullscreenChangeHandler = null; 

function setupFullscreenButton() {
    const fullscreenBtn = document.getElementById('godot-fullscreen-btn');
    const gameViewport = document.getElementById('godot-game-viewport'); // Necesitamos un ID para el contenedor

    if (!fullscreenBtn || !gameViewport) return;

    // Función para actualizar el texto del botón
    const updateButtonState = () => {
        if (document.fullscreenElement === gameViewport) {
            fullscreenBtn.textContent = 'Salir de Pantalla Completa';
        } else {
            fullscreenBtn.textContent = 'Pantalla Completa';
        }
    };

    // Listener para el clic en el botón
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            // Entrar a pantalla completa
            gameViewport.requestFullscreen().catch(err => {
                alert(`Error al intentar entrar en pantalla completa: ${err.message} (${err.name})`);
            });
        } else {
            // Salir de pantalla completa
            document.exitFullscreen();
        }
    });

    // Listener para cuando el estado cambia (ej. el usuario presiona ESC)
    fullscreenChangeHandler = updateButtonState; // Guardamos la referencia
    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    
    // Estado inicial del botón
    updateButtonState();
}
// --- FIN: Lógica de Pantalla Completa ---

    // --- ESTA ES LA FUNCIÓN CLAVE QUE NECESITAS ACTUALIZAR ---
    async function launchGame(gameId) {
    const gameModule = loadedGameModules[gameId];
    if (!gameModule) {
        console.error(`Módulo para ${gameId} no está cargado.`);
        gameContentArea.innerHTML = `<p class="error">Error: No se pudo iniciar el juego ${gameId}.</p>`;
        showGameContentArea(true);
        return;
    }

    showGameContentArea(true);
    gameContentArea.innerHTML = `<p>Cargando ${gameModule.name}...</p>`;

    if (window.godotGameWon) delete window.godotGameWon;
    if (fullscreenChangeHandler) {
        document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
        fullscreenChangeHandler = null;
    }

    if (gameModule.type === 'godot') {
            
            window.godotGameWon = async function(score) {
                console.log(`[GODOT BRIDGE] ¡Juego ganado con una puntuación de ${score}!`);
                
            // 1. Selecciona el lugar donde quieres poner el mensaje (la barra de controles)
            const controlsBar = document.querySelector('.game-controls-bar');
            if (controlsBar) {
                // Evitar añadir múltiples mensajes si el evento se dispara varias veces
                let winMessageEl = document.getElementById('godot-win-message');
                if (!winMessageEl) {
                    winMessageEl = document.createElement('p');
                    winMessageEl.id = 'godot-win-message';
                    winMessageEl.style.color = 'var(--success-color)';
                    winMessageEl.style.textAlign = 'center';
                    winMessageEl.style.fontWeight = 'bold';
                    winMessageEl.style.marginTop = '15px';
                    // Inserta el mensaje ANTES de la barra de botones.
                    controlsBar.parentNode.insertBefore(winMessageEl, controlsBar);
                }
                winMessageEl.textContent = `¡GANASTE! Puntuación: ${score}. Otorgando recompensa...`;
            }
            
            // 2. La lógica de la recompensa sigue igual y funcionará perfectamente.
                const storedUser = localStorage.getItem('loggedInUser');
                if (!storedUser) {
                    // --- ANTES ---
                    // alert("Error: Debes iniciar sesión para reclamar la recompensa.");
                    // --- DESPUÉS ---
                    showRewardModal('Error de Sesión', 'Debes iniciar sesión para poder reclamar la recompensa del juego.', 'error');
                    return;
                }
                const loggedInUser = JSON.parse(storedUser);

                try {
                    const responseAPI = await fetch('/socianark/api/games/pacman-win', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: loggedInUser.userId })
                    });
                    const result = await responseAPI.json();
                    if (responseAPI.ok) {
                        // --- ANTES ---
                        // alert(`${result.message}`);
                        // --- DESPUÉS ---
                        showRewardModal('¡Recompensa Obtenida!', result.message, 'success');
                    } else {
                        // --- ANTES ---
                        // alert(`Error al otorgar recompensa: ${result.message}`);
                        // --- DESPUÉS ---
                        showRewardModal('Error de Recompensa', result.message, 'error');
                    }
                } catch (error) {
                    console.error("Error al llamar a la API de recompensa:", error);
                    // --- ANTES ---
                    // alert("Error de conexión al intentar reclamar la recompensa.");
                    // --- DESPUÉS ---
                    showRewardModal('Error de Conexión', 'No se pudo contactar al servidor para reclamar tu recompensa. Inténtalo de nuevo más tarde.', 'error');
                }
            };
        // --- FIN DE LA CORRECCIÓN ---

        const iframeSrc = `juegos/godot/pacman/index.html`; 
            gameContentArea.innerHTML = `
                <div id="godot-game-viewport" class="game-viewport-container">
                    <iframe 
                        class="godot-game-iframe-horizontal"
                        src="${iframeSrc}" 
                        allowfullscreen>
                    </iframe>
                </div>
                <div class="game-controls-bar">
                    <div class="controls-key-group">
                        <div class="control-key" title="Mover Arriba (Flecha Arriba)">
                            <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"></path></svg>
                        </div>
                        <div class="control-key" title="Mover Izquierda (Flecha Izquierda)">
                            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>
                        </div>
                        <div class="control-key" title="Mover Abajo (Flecha Abajo)">
                            <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"></path></svg>
                        </div>
                        <div class="control-key" title="Mover Derecha (Flecha Derecha)">
                            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>
                        </div>
                    </div>

                    <button id="godot-fullscreen-btn" class="button-secondary">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px; vertical-align: -2px;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"></path></svg>
                        Pantalla Completa
                    </button>
                </div>
            `;
            // --- FIN DE LA ACTUALIZACIÓN HTML ---

            setupFullscreenButton();


        } else {
            // Lógica para tus otros juegos de JavaScript (slots, roulette, etc.)
            try {
                const response = await fetch(`juegos/${gameId}-content.html`);
                if (!response.ok) {
                    throw new Error(`No se pudo cargar el contenido HTML de ${gameId}.`);
                }
                gameContentArea.innerHTML = await response.text();
                
                if (typeof gameModule.init === 'function') {
                    gameModule.init();
                } else {
                    throw new Error(`La función init no está definida para el juego ${gameId}.`);
                }
            } catch (error) {
                console.error(`Error al lanzar el juego ${gameId}:`, error);
                gameContentArea.innerHTML = `<p class="error">No se pudo cargar el juego: ${error.message}</p>`;
            }
        }
    }
    
    function showGameContentArea(show) {
        if (show) {
            gameShowcaseArea.style.display = 'none';
            gameContentArea.style.display = 'block';
        } else {
            gameShowcaseArea.style.display = 'block';
            gameContentArea.style.display = 'none';
        }
    }

    initializeGamesPage();
});