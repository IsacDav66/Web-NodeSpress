// routes/games.js
const express = require('express');
const db = require('../db'); // Importar el pool de PostgreSQL desde tu archivo db.js
// const path = require('path'); // Ya no es necesario si no usas DB_PATH
// const sqlite3 = require('sqlite3').verbose(); // Ya no es necesario

const router = express.Router();
// const DB_PATH = ...; // Ya no es necesario

// Recompensa de Pacman -> Montado en /api/games
router.post('/pacman-win', async (req, res) => {
    const { userId } = req.body; // Este userId viene del frontend, debería coincidir con el formato de la BD
    if (!userId) {
        return res.status(400).json({ message: "Falta el ID del usuario." });
    }

    const rewardAmount = 1000;

    try {
        // 1. Obtener los datos actuales del usuario
        // CORREGIDO: Usar "userId" en la cláusula WHERE.
        // Asumir que 'money' y 'pushname' son minúsculas en la BD (ajustar si no).
        const userSelectSql = 'SELECT money, pushname FROM users WHERE "userId" = $1';
        const userResult = await db.query(userSelectSql, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }
        const userRow = userResult.rows[0];
        
        // 2. Calcular nuevo saldo y actualizar
        const currentMoney = (typeof userRow.money === 'number' && !isNaN(userRow.money)) ? userRow.money : 0;
        const newMoney = currentMoney + rewardAmount;
        
        // CORREGIDO: Usar "userId" en la cláusula WHERE.
        // Asumir que 'money' es minúscula en la BD.
        const sqlUpdate = 'UPDATE users SET money = $1 WHERE "userId" = $2';
        const updateResult = await db.query(sqlUpdate, [newMoney, userId]);

        if (updateResult.rowCount > 0) {
            res.json({ 
                message: `¡Felicidades, ${userRow.pushname || 'jugador'}! Ganaste ${rewardAmount} de dinero.`, 
                newBalance: newMoney 
            });
        } else {
            // Esto podría ocurrir si el usuario fue eliminado entre el SELECT y el UPDATE, lo cual es raro.
            res.status(404).json({ message: "No se pudo actualizar el saldo del usuario. Usuario no encontrado para la actualización." });
        }

    } catch (error) {
        console.error("[API PacmanWin] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error al otorgar la recompensa." });
    }
    // El pool de pg maneja las conexiones.
});

module.exports = router;