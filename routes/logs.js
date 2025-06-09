// routes/logs.js
const express = require('express');
const db = require('../db'); // Asegúrate que la ruta a tu archivo db.js sea correcta

const router = express.Router();

// Endpoint para obtener todos los registros del script
// Cuando se monta en server.js con app.use('/api/logs', logRoutes);
// este endpoint será accesible en: GET /api/logs/script-executions
router.get('/script-executions', async (req, res) => {
    try {
        // Consultar la base de datos para obtener los logs,
        // ordenados por ID descendente (más reciente primero).
        // Los alias (AS "...") son para que el frontend reciba propiedades en camelCase,
        // lo cual es una convención común en JavaScript.
        // Asegúrate de que los nombres de columna originales (start_time, start_status, etc.)
        // coincidan EXACTAMENTE con los de tu tabla 'script_logs' en PostgreSQL.
        const query = `
            SELECT 
                id, 
                start_time AS "startTime",
                start_status AS "startStatus",
                end_time AS "endTime",
                end_status AS "endStatus",
                error_details AS "errorDetails"
            FROM script_logs 
            ORDER BY id DESC;
        `;
        const result = await db.query(query);

        // (Opcional) Loguear en el servidor lo que se va a enviar al frontend para depuración.
         console.log("Datos de logs enviados al frontend:", JSON.stringify(result.rows, null, 2));

        // Enviar los resultados de la consulta como una respuesta JSON al frontend.
        // El driver pg de Node.js generalmente convierte los tipos TIMESTAMP WITH TIME ZONE
        // de PostgreSQL a objetos Date de JavaScript. Cuando Express los serializa con res.json(),
        // estos objetos Date se convierten a cadenas en formato ISO 8601 UTC (con 'Z').
        res.json(result.rows);

    } catch (error) {
        console.error("[API /api/logs/script-executions] Error al obtener los registros del script:", error.message, error.stack);
        res.status(500).json({ message: "Error interno del servidor al obtener los registros del script." });
    }
});

module.exports = router;