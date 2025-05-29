// public/juegos.js
document.addEventListener('DOMContentLoaded', () => {
    const gameMenuUl = document.getElementById('game-menu');
    const gameShowcaseArea = document.getElementById('game-showcase-area');
    const gameContentArea = document.getElementById('game-content-area');
    const juegosInstructionsP = document.getElementById('juegos-instructions'); // El <p> dentro de showcase

    // Lista de IDs de juegos que quieres cargar.
    // Podrías tener esto en un archivo de configuración JSON y cargarlo.
    const AVAILABLE_GAME_IDS = ['pacman', 'slots', 'roulette']; // Asegúrate que estos IDs existan como archivos
    
    const loadedGameModules = {}; // Para almacenar los módulos de juego cargados { id: module }

    async function initializeGamesPage() {
        if (!gameShowcaseArea || !gameMenuUl || !juegosInstructionsP) {
            console.error("Elementos base de la página de juegos no encontrados.");
            if (juegosInstructionsP) juegosInstructionsP.textContent = "Error al cargar la página de juegos.";
            return;
        }
        juegosInstructionsP.textContent = 'Cargando información de juegos...';
        gameShowcaseArea.innerHTML = ''; // Limpiar showcase antes de añadir tarjetas
        gameMenuUl.innerHTML = ''; // Limpiar menú antes de añadir items

        for (const gameId of AVAILABLE_GAME_IDS) {
            try {
                // 1. Cargar el script del juego para obtener su información
                // No lo ejecutamos todavía, solo queremos la variable global (ej. window.pacmanGameModule)
                await loadGameScript(gameId);
                
                const gameModule = window[`${gameId}GameModule`]; // Ej: window.pacmanGameModule

                if (gameModule && typeof gameModule.init === 'function') {
                    loadedGameModules[gameId] = gameModule;
                    addGameToMenu(gameModule);
                    addGameToShowcase(gameModule);
                } else {
                    console.warn(`Módulo para el juego ${gameId} no encontrado o no tiene función init.`);
                }
            } catch (error) {
                console.error(`Error al procesar el juego ${gameId}:`, error);
                 // Podrías añadir una tarjeta de error en el showcase aquí
            }
        }
        
        if (Object.keys(loadedGameModules).length === 0) {
            juegosInstructionsP.textContent = 'No hay juegos disponibles en este momento.';
            gameShowcaseArea.appendChild(juegosInstructionsP); // Mostrar mensaje si no hay juegos
        } else {
             juegosInstructionsP.style.display = 'none'; // Ocultar si hay juegos
        }

        setupEventListeners();
    }

    function loadGameScript(gameId) {
        return new Promise((resolve, reject) => {
            // Primero, eliminar cualquier script de juego antiguo si es que el ID ya existe
            // (aunque aquí cargamos todos al inicio, podría ser útil si se recargara)
            const oldScript = document.getElementById(`game-script-${gameId}`);
            if (oldScript) oldScript.remove();

            const script = document.createElement('script');
            script.src = `juegos/${gameId}-game.js`;
            script.id = `game-script-${gameId}`; // ID único para el script del juego
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
        link.dataset.gameId = gameModule.id; // Usar gameModule.id
        link.innerHTML = gameModule.name; // gameModule.name (ej. "🟡 Pacman Clásico")
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
        // Listener para el menú del sidebar
        gameMenuUl.addEventListener('click', (event) => {
            event.preventDefault();
            const targetLink = event.target.closest('a[data-game-id]');
            if (targetLink) {
                const gameId = targetLink.dataset.gameId;
                setActiveMenuItem(gameId);
                launchGame(gameId);
            }
        });

        // Listener para los botones "Jugar" en las tarjetas del showcase
        gameShowcaseArea.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button.game-card-play-btn[data-game-id]');
            if (targetButton) {
                const gameId = targetButton.dataset.gameId;
                setActiveMenuItem(gameId); // También marcar activo en el menú
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

    async function launchGame(gameId) {
        const gameModule = loadedGameModules[gameId];
        if (!gameModule) {
            console.error(`Módulo para ${gameId} no está cargado.`);
            gameContentArea.innerHTML = `<p class="error">Error: No se pudo iniciar el juego ${gameId}.</p>`;
            showGameContentArea(true); // Mostrar área de contenido con error
            return;
        }

        // 1. Mostrar área de contenido del juego y mensaje de carga
        showGameContentArea(true); // true para mostrar #game-content-area
        gameContentArea.innerHTML = `<p>Cargando ${gameModule.name}...</p>`;

        try {
            // 2. Cargar el HTML específico del juego (ej. pacman-content.html)
            const response = await fetch(`juegos/${gameId}-content.html`);
            if (!response.ok) {
                throw new Error(`No se pudo cargar el contenido HTML de ${gameId}. Estado: ${response.status}`);
            }
            const gameHtml = await response.text();
            gameContentArea.innerHTML = gameHtml;

            // 3. Eliminar cualquier script de juego anterior (si es diferente) para evitar conflictos
            //    (Aunque en este modelo cargamos el JS una vez, esto es una buena práctica si se recargan)
            removeOldGameSpecificScripts(); 
            
            // 4. El script JS del juego ya debería estar cargado. Ahora llamamos a su función init.
            //    No necesitamos volver a crear el <script> tag para el *-game.js
            if (typeof gameModule.init === 'function') {
                gameModule.init(); // Llama a la función init definida en, por ej., pacmanGameModule.init()
            } else {
                throw new Error(`La función init no está definida para el juego ${gameId}.`);
            }

        } catch (error) {
            console.error(`Error al lanzar el juego ${gameId}:`, error);
            gameContentArea.innerHTML = `<p class="error">No se pudo cargar el juego ${gameModule.name}: ${error.message}</p>`;
        }
    }
    
    function showGameContentArea(show) {
        if (show) {
            gameShowcaseArea.style.display = 'none';
            gameContentArea.style.display = 'block';
        } else {
            gameShowcaseArea.style.display = 'block'; // o 'flex' si usas flexbox para .game-showcase
            gameContentArea.style.display = 'none';
        }
    }

    function removeOldGameSpecificScripts() {
        // Si los scripts de juego tienen un ID común o clase, se pueden buscar y eliminar.
        // Por ahora, como el script se carga una vez y se reutiliza el módulo,
        // esta función podría no ser estrictamente necesaria a menos que cambies
        // la estrategia de carga de scripts.
        // Ejemplo: document.querySelectorAll('script[id^="game-script-"]').forEach(s => s.remove());
    }

    // Iniciar la carga y renderizado de la página de juegos
    initializeGamesPage();
});