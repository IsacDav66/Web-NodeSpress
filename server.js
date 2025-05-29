// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
// const sqlite3 = require('sqlite3').verbose(); // Ya no es necesario aquí directamente si las rutas lo manejan
// const bcrypt = require('bcryptjs'); // Ya no es necesario aquí directamente

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'bot_database.sqlite'); // Definir aquí para la verificación de inicio

// Importar los routers
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// --- Montar los Routers ---
// Todas las rutas en authRoutes comenzarán con /api
app.use('/api', authRoutes);        // Para /api/login
app.use('/api/user', userRoutes);  // Para /api/users, /api/users/:id, /api/users/ranking/millonarios
app.use('/api/games', gameRoutes);  // Para /api/games/pacman-win

// Ruta raíz para servir el index.html (ya manejada por express.static si existe public/index.html)
// Si quieres ser explícito:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar el Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    require('fs').access(DB_PATH, require('fs').constants.F_OK, (err) => {
        if (err) {
            console.error(`[API Startup ERROR] No se puede acceder al archivo de base de datos en: ${DB_PATH}`);
        } else {
            console.log(`[API Startup] Acceso verificado al archivo de base de datos: ${DB_PATH}`);
        }
    });
});