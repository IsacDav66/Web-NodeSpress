// routes/auth.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'bot_database.sqlite'); // Ajustar ruta para salir de 'routes' y luego a la raíz

router.post('/login', async (req, res) => {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
        return res.status(400).json({ message: "Número de teléfono y contraseña son requeridos." });
    }
    const phoneNumberClean = String(phoneNumber).startsWith('+') ? String(phoneNumber).substring(1) : String(phoneNumber);

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (errDb) => {
        if (errDb) {
            console.error("[API Auth Login] Error al conectar a la BD:", errDb.message);
            return res.status(500).json({ message: "Error interno del servidor." }); // Cambiado 'error' a 'message' por consistencia
        }
    });

     // MODIFICADO: Seleccionar todos los campos necesarios, incluyendo las rutas de las imágenes
     const sql = `
     SELECT 
         userId, 
         pushname, 
         password as hashedPassword, 
         exp, 
         money, 
         bank, 
         profilePhotoPath,  -- Añadido
         coverPhotoPath     -- Añadido
     FROM users 
     WHERE phoneNumber = ?
 `;
    db.get(sql, [phoneNumberClean], async (errQuery, userRow) => {
        //db.close();
        if (errQuery) {
            db.close(); // Asegurarse de cerrar en caso de error
            console.error("[API Auth Login] Error en query:", errQuery.message);
            return res.status(500).json({ error: "Error consultando la base de datos." });
        }
        if (!userRow) {
            return res.status(401).json({ message: "Número de teléfono o contraseña incorrectos." });
        }
        try {
            const isMatch = await bcrypt.compare(password, userRow.hashedPassword);
            if (isMatch) {
                const { hashedPassword, ...userDataToSend } = userRow;
                db.close(); // Cerrar BD después de la operación exitosa
                res.json({ message: "Inicio de sesión exitoso", user: userDataToSend });
            } else {
                db.close();
                res.status(401).json({ message: "Número de teléfono o contraseña incorrectos." });
            }
        } catch (bcryptError) {
            db.close();
            console.error("[API Auth Login] Error en bcrypt:", bcryptError);
            res.status(500).json({ error: "Error interno del servidor durante la autenticación." });
        }
    });
});

module.exports = router; // Exportar el router