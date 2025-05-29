// public/juegos/pacman-game.js

// 1. DEFINIR LA INFORMACIÓN DEL JUEGO Y SU FUNCIÓN DE INICIALIZACIÓN
// Esta variable global será leída por juegos.js
window.pacmanGameModule = {
    id: 'pacman', // ID único para el juego
    name: '🟡 Pacman Clásico',
    coverImage: 'juegos/covers/pacman-cover.jpg', // Ruta a la imagen de portada
    description: '¡Come todos los puntos y evita los fantasmas en este clásico arcade!', // Descripción corta
    init: function() {
        console.log("Inicializando Pacman Clásico...");
        // --- TODO EL CÓDIGO DE LÓGICA DE PACMAN VA AQUÍ DENTRO ---
        // Mueve todo tu código existente de pacman-game.js (obtener canvas, ctx, level,
        // funciones draw, update, winGame, gameLoop, listeners de teclado, etc.)
        // DENTRO de esta función init.

        const pacmanCanvas = document.getElementById('pacmanCanvas'); // Asegúrate que el ID coincida con pacman-content.html
        const pacmanDotsLeftSpan = document.getElementById('pacmanDotsLeft');
        const startPacmanButton = document.getElementById('startPacmanButton');
        const pacmanGameMessageSpan = document.getElementById('pacmanGameMessage');

        if (!pacmanCanvas || !startPacmanButton || !pacmanDotsLeftSpan || !pacmanGameMessageSpan) {
            console.error("Elementos del DOM para Pacman no encontrados en pacman-content.html. No se puede inicializar.");
            // Opcionalmente, mostrar un error en la UI si gameContentArea está visible
            const gameContentArea = document.getElementById('game-content-area');
            if (gameContentArea) {
                gameContentArea.innerHTML = '<p class="error">Error: No se pudieron encontrar los elementos necesarios para iniciar Pacman.</p>';
            }
            return;
        }

        const ctx = pacmanCanvas.getContext('2d');
        const gridSize = 28;
        const pacmanSize = gridSize / 2 * 0.8;
        const dotSize = 3;

        let pacman = { x: 1, y: 1, dx: 0, dy: 0, nextDx: 0, nextDy: 0, openMouth: true };
        let dots = [];
        let totalDots = 0;
        let gameRunning = false;
        let animationFrameId;

        const level = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,2,2,2,1,2,2,2,2,2,2,1,2,2,2,1],
            [1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1],
            [1,2,2,2,2,2,2,1,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,1,2,2,2,1,1,1,1,1,2,1],
            [1,2,2,2,2,1,1,0,1,1,2,2,2,2,2,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ];
        pacmanCanvas.height = level.length * gridSize;
        pacmanCanvas.width = level[0].length * gridSize;

        function initializeGameInternal() { // Renombrada para evitar conflicto si init ya existe
            pacmanGameMessageSpan.textContent = "Usa las flechas para moverte. ¡Come todos los puntos!";
            dots = [];
            totalDots = 0;
            for (let r = 0; r < level.length; r++) {
                for (let c = 0; c < level[r].length; c++) {
                    if (level[r][c] === 2) {
                        dots.push({ x: c, y: r, eaten: false });
                        totalDots++;
                    } else if (level[r][c] === 0) {
                        pacman.x = c;
                        pacman.y = r;
                    }
                }
            }
            pacman.dx = 0; pacman.dy = 0; pacman.nextDx = 0; pacman.nextDy = 0;
            pacmanDotsLeftSpan.textContent = totalDots;
            gameRunning = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            gameLoop();
        }

        function draw() {
            // ... tu función draw ...
            ctx.clearRect(0, 0, pacmanCanvas.width, pacmanCanvas.height);
            ctx.fillStyle = '#0000AA'; 
            for (let r = 0; r < level.length; r++) {
                for (let c = 0; c < level[r].length; c++) {
                    if (level[r][c] === 1) {
                        ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
                    }
                }
            }
            ctx.fillStyle = 'yellow';
            dots.forEach(dot => {
                if (!dot.eaten) {
                    ctx.beginPath();
                    ctx.arc(dot.x * gridSize + gridSize / 2, dot.y * gridSize + gridSize / 2, dotSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            const pacmanX = pacman.x * gridSize + gridSize / 2;
            const pacmanY = pacman.y * gridSize + gridSize / 2;
            if (pacman.openMouth && (pacman.dx !==0 || pacman.dy !==0) ) {
                 let startAngle = 0.2 * Math.PI;
                 let endAngle = 1.8 * Math.PI;
                 if (pacman.dx === 1) { /* Derecha */ }
                 else if (pacman.dx === -1) { startAngle += Math.PI; endAngle += Math.PI; }
                 else if (pacman.dy === 1) { startAngle += 0.5 * Math.PI; endAngle += 0.5 * Math.PI; }
                 else if (pacman.dy === -1) { startAngle -= 0.5 * Math.PI; endAngle -= 0.5 * Math.PI;}
                ctx.arc(pacmanX, pacmanY, pacmanSize, startAngle, endAngle);
                ctx.lineTo(pacmanX, pacmanY);
            } else {
                ctx.arc(pacmanX, pacmanY, pacmanSize, 0, Math.PI * 2);
            }
            ctx.fill();
            pacman.openMouth = !pacman.openMouth;
        }

        function canMove(x, y, dx, dy) {
            // ... tu función canMove ...
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= level[0].length || nextY < 0 || nextY >= level.length) {
                return false;
            }
            return level[nextY][nextX] !== 1;
        }

        function update() {
            // ... tu función update ...
            if (!gameRunning) return;
            if (pacman.nextDx !== 0 || pacman.nextDy !== 0) {
                if (canMove(pacman.x, pacman.y, pacman.nextDx, pacman.nextDy)) {
                    pacman.dx = pacman.nextDx;
                    pacman.dy = pacman.nextDy;
                    pacman.nextDx = 0;
                    pacman.nextDy = 0;
                }
            }
            if (canMove(pacman.x, pacman.y, pacman.dx, pacman.dy)) {
                pacman.x += pacman.dx;
                pacman.y += pacman.dy;
            } else {
                pacman.dx = 0;
                pacman.dy = 0;
            }
            dots.forEach(dot => {
                if (!dot.eaten && dot.x === pacman.x && dot.y === pacman.y) {
                    dot.eaten = true;
                    totalDots--;
                    pacmanDotsLeftSpan.textContent = totalDots;
                }
            });
            if (totalDots === 0) {
                winGame();
            }
        }

        async function winGame() {
            // ... tu función winGame (asegúrate que use /api/games/pacman-win) ...
            gameRunning = false;
            cancelAnimationFrame(animationFrameId);
            pacmanGameMessageSpan.textContent = "¡GANASTE! 🎉 Otorgando recompensa...";
            const storedUser = localStorage.getItem('loggedInUser');
            if (!storedUser) {
                pacmanGameMessageSpan.textContent = "Error: Debes iniciar sesión para reclamar la recompensa.";
                return;
            }
            const loggedInUser = JSON.parse(storedUser);
            try {
                const responseAPI = await fetch('/api/games/pacman-win', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: loggedInUser.userId })
                });
                const result = await responseAPI.json();
                if (responseAPI.ok) {
                    pacmanGameMessageSpan.textContent = `${result.message} Nuevo saldo: $${result.newBalance.toLocaleString()}`;
                } else {
                    pacmanGameMessageSpan.textContent = `Error al otorgar recompensa: ${result.message || 'Error desconocido'}`;
                }
            } catch (error) {
                console.error("Error al llamar a la API de recompensa de Pacman:", error);
                pacmanGameMessageSpan.textContent = "Error de conexión al intentar reclamar la recompensa.";
            }
        }

        function gameLoop() {
            if (!gameRunning) return;
            update();
            draw();
            animationFrameId = requestAnimationFrame(gameLoop);
        }

        document.addEventListener('keydown', (e) => {
            if (!gameRunning || !document.getElementById('pacmanCanvas')) return; // Solo si el canvas de pacman está presente
            switch (e.key) {
                case 'ArrowUp':    pacman.nextDx = 0; pacman.nextDy = -1; break;
                case 'ArrowDown':  pacman.nextDx = 0; pacman.nextDy = 1;  break;
                case 'ArrowLeft':  pacman.nextDx = -1; pacman.nextDy = 0; break;
                case 'ArrowRight': pacman.nextDx = 1; pacman.nextDy = 0;  break;
                default: return; // No prevenir default para otras teclas
            }
            e.preventDefault(); 
        });

        startPacmanButton.addEventListener('click', initializeGameInternal);
        // Opcional: Iniciar automáticamente si es preferible
        // initializeGameInternal(); 
    }
};
// 2. Indicar a juegos.js que este módulo está listo (opcional, pero puede ser útil)
if (window.onGameModuleReady) {
    window.onGameModuleReady(window.pacmanGameModule);
}