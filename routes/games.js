// routes/games.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'bot_database.sqlite');

// Recompensa de Pacman -> Montado en /api/games
router.post('/pacman-win', async (req, res) => { // Ruta sería /api/games/pacman-win
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "Falta el ID del usuario." });

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, /* ... */); // READWRITE para actualizar
    const rewardAmount = 1000;

    db.get("SELECT money, pushname FROM users WHERE userId = ?", [userId], (errGet, userRow) => {
        // ... (lógica para obtener usuario como antes) ...
        if (!userRow) { /* ... */ return res.status(404).json({ message: "Usuario no encontrado." }); }
        
        const currentMoney = (typeof userRow.money === 'number' && !isNaN(userRow.money)) ? userRow.money : 0;
        const newMoney = currentMoney + rewardAmount;
        const sqlUpdate = "UPDATE users SET money = ? WHERE userId = ?";
        db.run(sqlUpdate, [newMoney, userId], function(errUpdate) {
            // ... (lógica para manejar errUpdate y enviar respuesta como antes) ...
            db.close();
            if (errUpdate) { /* ... */ return res.status(500).json({ error: "Error al otorgar recompensa." });}
            if (this.changes > 0) {
                res.json({ message: `¡Felicidades, ${userRow.pushname || 'jugador'}! Ganaste ${rewardAmount} de dinero.`, newBalance: newMoney });
            } else {
                res.status(404).json({ message: "No se pudo actualizar el usuario." });
            }
        });
    });
});

module.exports = router;