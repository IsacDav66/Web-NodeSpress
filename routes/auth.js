// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db'); 

const router = express.Router();

router.post('/login', async (req, res) => {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
        return res.status(400).json({ message: "Número de teléfono y contraseña son requeridos." });
    }
    const phoneNumberClean = String(phoneNumber).startsWith('+') ? String(phoneNumber).substring(1) : String(phoneNumber);

    const sql = `
        SELECT 
            "userId",           -- Asumiendo que 'userId' fue creado con 'I' mayúscula (o entre comillas)
            pushname,           -- Asumiendo que 'pushname' es todo minúsculas en la BD
            password AS "hashedPassword", -- 'password' es palabra clave, AS es bueno. O usa "password" si es el nombre exacto.
            exp,
            money,
            bank,
            "profilePhotoPath", -- Asumiendo que tiene mayúsculas en la BD
            "coverPhotoPath"    -- Asumiendo que tiene mayúsculas en la BD
        FROM users 
        WHERE "phoneNumber" = $1 -- Asumiendo que 'phoneNumber' tiene mayúsculas en la BD
    `;

    try {
        const result = await db.query(sql, [phoneNumberClean]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Número de teléfono o contraseña incorrectos." });
        }

        const userRow = result.rows[0];

        // userRow.hashedPassword debe coincidir con el alias usado en el SELECT
        const isMatch = await bcrypt.compare(password, userRow.hashedPassword); 
        
        if (isMatch) {
            const { hashedPassword, ...userDataToSend } = userRow; 
            res.json({ message: "Inicio de sesión exitoso", user: userDataToSend });
        } else {
            res.status(401).json({ message: "Número de teléfono o contraseña incorrectos." });
        }
    } catch (error) {
        console.error("[API Auth Login] Error durante el proceso de login:", error.message, error.stack);
        res.status(500).json({ message: "Error interno del servidor durante el login." });
    }
});

module.exports = router;