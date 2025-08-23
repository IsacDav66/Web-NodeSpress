// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http'); // Módulo HTTP de Node.js
const WebSocket = require('ws'); // Importar la librería ws
const axios = require('axios'); // <--- ¡AÑADIR ESTA LÍNEA!

const app = express();
// Crear un servidor HTTP explícito para poder adjuntarle el servidor WebSocket
const server = http.createServer(app); // <--- CAMBIO
const PORT = process.env.PORT || 3000;

// Importar los routers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const logRoutes = require('./routes/logs');
const spotifyRoutes = require('./routes/spotify'); // Este router seguirá existiendo
                                                // por si quieres un endpoint HTTP para obtener la actividad una vez.
                                                // O podemos mover la lógica de fetch de Spotify a una función reutilizable.
const postsRoutes = require('./routes/posts'); // <--- AÑADIR

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir archivos estáticos DESDE EL SUBDIRECTORIO /socianark
// Esto le dice a Express: "Cuando una URL pida /socianark/style.css, busca en la carpeta /public/style.css"
// --- INICIO DE LA SOLUCIÓN UNIFICADA ---

// 1. Crear un router principal para toda la aplicación en el subdirectorio
const socianarkRouter = express.Router();

// 2. Servir archivos estáticos desde el router
// Ahora, una petición a "/socianark/style.css" será manejada por este router.
socianarkRouter.use(express.static(path.join(__dirname, 'public')));

socianarkRouter.use('/uploads', express.static('/var/www/socianark/uploads'));

socianarkRouter.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); // <-- ¡AÑADE ESTA LÍNEA!

// 3. Montar TODAS las rutas de la API DENTRO del router
socianarkRouter.use('/api', authRoutes);
socianarkRouter.use('/api/user', userRoutes);
socianarkRouter.use('/api/games', gameRoutes);
socianarkRouter.use('/api/logs', logRoutes);
socianarkRouter.use('/api/spotify', spotifyRoutes);
socianarkRouter.use('/api/posts', postsRoutes);


// --- ENDPOINT DE TRADUCCIÓN (MODIFICADO CON FORZADO) ---
socianarkRouter.post('/api/translate/text', async (req, res) => {
    const { text, targetLang } = req.body; // Quitamos sourceLang de la desestructuración aquí por ahora

    // FORZAMOS sourceLang a 'en'
    const effectiveSourceLang = 'en'; 

    if (!text || !targetLang) {
        return res.status(400).json({ message: 'El texto y el idioma de destino son requeridos.' });
    }

    try {
        // Usamos effectiveSourceLang
        const langPair = `${effectiveSourceLang}|${targetLang}`; 
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
        
        console.log(`[Translate API] Preparando llamada a MyMemory. Texto: "${text.substring(0,30)}...", langPair: ${langPair} (Source Forzado: ${effectiveSourceLang})`); 
        
        const response = await axios.get(apiUrl);

        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = translated.replace(/"/g, '"').replace(/'/g, "'").replace(/&/g, '&');
            
            console.log(`[Translate API] Original: "${text.substring(0,50)}...", Traducido a ${targetLang}: "${translated.substring(0,50)}..."`);
            res.json({ translatedText: translated });
        } else {
            console.error('[Translate API] Error de MyMemory, respuesta inesperada:', response.data);
            const errorMsg = response.data && response.data.responseDetails ? response.data.responseDetails : 'Formato de respuesta inesperado de la API de traducción.';
            if (response.data && response.data.responseStatus === 403) { 
                 res.status(400).json({ message: `Error de traducción: ${errorMsg}. Verifica los códigos de idioma.` });
            } else {
                 res.status(502).json({ message: `Error al traducir: ${errorMsg}` });
            }
        }
    } catch (error) {
        console.error('[Translate API] Error llamando a la API de traducción:', error.response ? error.response.data : error.message, error.stack);
        res.status(500).json({ message: 'Error interno del servidor al traducir el texto.' });
    }
});
// --- FIN ENDPOINT DE TRADUCCIÓN ---

// --- Configuración del Servidor WebSocket ---
const wss = new WebSocket.Server({ server }); // Adjuntar WebSocket al servidor HTTP

// Guardaremos los clientes conectados. En una app más grande, esto podría ser más robusto (ej. Map con IDs).
const clients = new Set();

wss.on('connection', (ws) => {
    console.log('[WebSocket] Nuevo cliente conectado');
    clients.add(ws);

    // Enviar la actividad actual inmediatamente al nuevo cliente conectado
    // (Llamaremos a una función que obtenga la actividad)
    fetchSpotifyActivityAndBroadcast();


    ws.on('message', (message) => {
        // Podrías manejar mensajes del cliente si fuera necesario (ej. "quiero actualizaciones para X usuario")
        // Por ahora, nuestro cliente solo escucha.
        console.log('[WebSocket] Mensaje recibido del cliente:', message.toString());
    });

    ws.on('close', () => {
        console.log('[WebSocket] Cliente desconectado');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('[WebSocket] Error en conexión de cliente:', error);
        clients.delete(ws); // Asegurarse de limpiar en caso de error
    });
});

// Función para transmitir datos a todos los clientes WebSocket conectados
function broadcast(data) {
    const jsonData = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonData);
        }
    });
}

// Lógica para obtener la actividad de Spotify y transmitirla
// Esta función es similar a la lógica de tu endpoint /api/spotify/users-activity
// Sería ideal refactorizar la lógica de obtención de actividad de spotify.js
// para que pueda ser llamada tanto por el endpoint HTTP como por esta función.
// Por ahora, la duplicaremos simplificadamente.
const { fetchSpotifyActivityForBackend } = require('./services/spotifyService'); // Crearemos este archivo

async function fetchSpotifyActivityAndBroadcast() {
    console.log('[WebSocket] Obteniendo actividad de Spotify para transmitir...');
    try {
        const activityData = await fetchSpotifyActivityForBackend(); // Usar la función refactorizada
        if (activityData) {
            broadcast({ type: 'spotify_activity_update', payload: activityData });
        }
    } catch (error) {
        console.error('[WebSocket] Error obteniendo o transmitiendo actividad de Spotify:', error.message);
    }
}

// Iniciar el polling desde el servidor para buscar actualizaciones de Spotify
const SPOTIFY_POLL_INTERVAL_MS = 5000; // Ej: cada 15 segundos (ajusta según necesidad y rate limits)
setInterval(fetchSpotifyActivityAndBroadcast, SPOTIFY_POLL_INTERVAL_MS);


// --- Rutas HTTP restantes (healthz, /, etc.) ---
// Ruta raíz para servir el index.html (manejada por express.static)
// Si quieres ser explícito o tener un fallback para SPA:
// --- Rutas HTTP restantes (healthz, /, etc.) ---
// ...
socianarkRouter.get(['/', '/juegos.html', '/profile.html', '/search-results.html', '/registros.html', '/login.html', '/estadisticas.html', '/spotify-activity.html', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

// 6. Finalmente, montar el router principal en la app de Express
app.use('/socianark', socianarkRouter);

// --- FIN DE LA SOLUCIÓN UNIFICADA --


// Health Check Endpoint para Render
app.get('/healthz', (req, res) => {
    // Puedes añadir lógica aquí para verificar dependencias críticas si es necesario
    // (ej. una query simple a la base de datos para asegurar que la conexión está viva)
    // Por ahora, una respuesta simple 200 OK es suficiente para que Render sepa que la app está corriendo.
    console.log("Health check /healthz endpoint hit"); // Log para ver si se llama
    res.status(200).send('OK');
});

// Ruta raíz (si no la tienes ya o si express.static no es suficiente para el health check inicial)
// A veces Render intenta '/' para el health check si '/healthz' no está configurado explícitamente o falla.


// --- Iniciar el Servidor HTTP (que ahora incluye el servidor WebSocket) ---
server.listen(PORT, () => { // <--- CAMBIO: usar server.listen en lugar de app.listen
    console.log(`Servidor HTTP y WebSocket escuchando en http://localhost:${PORT}/socianark/`);
    const db = require('./db');
    db.query('SELECT NOW()', (err, resQuery) => {
        if (err) console.error('[API Startup ERROR] No se pudo conectar a PostgreSQL:', err.message);
        else console.log('[API Startup] Conexión a PostgreSQL verificada. Hora DB:', resQuery.rows[0].now);
    });
    // Llamada inicial para que los clientes que se conecten al inicio reciban datos
    fetchSpotifyActivityAndBroadcast();
});