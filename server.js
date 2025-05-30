// server.js
require('dotenv').config(); // Cargar variables de entorno al inicio
const express = require('express');
const path = require('path');
const cors = require('cors');
// const dbPool = require('./db').pool; // Opcional: Importar el pool si quieres interactuar con él aquí

const app = express();
const PORT = process.env.PORT || 3000;

// Ya no necesitamos DB_PATH para SQLite
// const DB_PATH = path.join(__dirname, 'bot_database.sqlite'); 

// Importar los routers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');

// Middleware
app.use(cors());
app.use(express.json()); // Para parsear JSON bodies
app.use(express.urlencoded({ extended: true })); // Para parsear URL-encoded bodies (útil para forms)

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
// Servir la carpeta de subidas para que las imágenes sean accesibles
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); 

// --- Montar los Routers ---
app.use('/api', authRoutes);        // Para /api/login
app.use('/api/user', userRoutes);  // Para /api/user/*
app.use('/api/games', gameRoutes);  // Para /api/games/*

// Ruta raíz para servir el index.html (manejada por express.static)
// Si quieres ser explícito o tener un fallback para SPA:
app.get(['/', '/juegos.html', '/profile.html', '/search-results.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
    // Para una SPA real, todas las rutas del frontend no API deberían servir index.html
    // y dejar que el enrutador del frontend maneje la vista.
    // Si son páginas separadas, la configuración actual de express.static es suficiente.
    // Este app.get('/') es un buen fallback.
    // Para las otras páginas HTML, express.static ya las debería servir.
    // Pero si tienes enrutamiento del lado del cliente, podrías querer que todas sirvan index.html.
    // Por ahora, dejaremos que express.static maneje /juegos.html, etc.
});

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
app.get('/', (req, res) => {
    // Servir tu index.html o simplemente un OK para la raíz si es solo para health check.
    // Si express.static ya sirve index.html en '/', esto podría no ser necesario,
    // pero tener una ruta explícita para '/' que devuelva 200 no hace daño.
    // res.sendFile(path.join(__dirname, 'public', 'index.html'));
    res.status(200).send('Aplicación funcionando!'); // O servir tu index.html
});


// --- Iniciar el Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    // La conexión a PostgreSQL y el log de "Conectado" se manejan en db.js al crear el Pool.
    // No es necesario verificar el archivo SQLite aquí.

    // Opcional: hacer una query simple para verificar que el pool está funcionando al inicio
    /*
    const db = require('./db'); // Importar aquí si solo es para esta prueba
    db.query('SELECT NOW()', (err, resQuery) => {
        if (err) {
            console.error('[API Startup ERROR] No se pudo conectar a PostgreSQL al iniciar:', err);
        } else {
            console.log('[API Startup] Conexión a PostgreSQL verificada al iniciar. Hora del servidor DB:', resQuery.rows[0].now);
        }
    });
    */
});