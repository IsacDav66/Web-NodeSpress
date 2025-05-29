// routes/users.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path'); // Asegúrate que 'path' esté importado
const fs = require('fs'); // Para operaciones de archivo (si manejas subida de imágenes aquí)
const multer = require('multer'); // <<< --- AÑADE O ASEGÚRATE QUE ESTA LÍNEA EXISTA Y ESTÉ CORRECTA

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'bot_database.sqlite');

// --- Directorios para subidas ---
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads'); // Carpeta 'uploads' dentro de 'public'
const PROFILE_PICS_DIR = path.join(UPLOADS_DIR, 'profile_pics');
const COVER_PICS_DIR = path.join(UPLOADS_DIR, 'cover_pics');

// Crear directorios si no existen (esto se ejecuta una vez cuando el servidor inicia)
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`Creando directorio de subidas: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true }); // recursive: true para crear subdirectorios si es necesario
}
if (!fs.existsSync(PROFILE_PICS_DIR)) {
    console.log(`Creando directorio de fotos de perfil: ${PROFILE_PICS_DIR}`);
    fs.mkdirSync(PROFILE_PICS_DIR, { recursive: true });
}
if (!fs.existsSync(COVER_PICS_DIR)) {
    console.log(`Creando directorio de fotos de portada: ${COVER_PICS_DIR}`);
    fs.mkdirSync(COVER_PICS_DIR, { recursive: true });
}


// --- Configuración de Multer ---
const storageConfig = (uploadPath) => multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // ¡IMPORTANTE! El userId debe venir del usuario autenticado.
        // Este es un placeholder y es INSEGURO para producción si no tienes autenticación.
        const userId = req.body.userId || req.user?.userId || 'anonymous_upload'; 
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `${userId}-${uniqueSuffix}${extension}`);
    }
});
const fileFilterConfig = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no permitido. Solo se aceptan JPEG, PNG, GIF.'), false);
    }
};

const uploadProfilePic = multer({ 
    storage: storageConfig(PROFILE_PICS_DIR), 
    fileFilter: fileFilterConfig, 
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});
const uploadCoverPic = multer({ 
    storage: storageConfig(COVER_PICS_DIR), 
    fileFilter: fileFilterConfig, 
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});


function escapeForLogging(text) {
    if (text === null || typeof text === 'undefined') return '';
    return String(text).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'");
}

// --- ENDPOINTS DE ACCIÓN SOCIAL (SEGUIR, DEJAR DE SEGUIR, ELIMINAR SEGUIDOR) ---
router.post('/:userId/follow', (req, res) => {
    const userToFollowId = req.params.userId;
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ message: "Falta el ID del seguidor." });
    if (userToFollowId === followerId) return res.status(400).json({ message: "No puedes seguirte a ti mismo." });

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => { if (err) { console.error(err.message); return res.status(500).json({ message: "Error DB." }); }});
    db.run("INSERT OR IGNORE INTO followers (followerId, followingId) VALUES (?, ?)", [followerId, userToFollowId], function(err) {
        db.close();
        if (err) return res.status(500).json({ message: "Error al seguir." });
        if (this.changes > 0) return res.json({ message: "Ahora sigues a este usuario." });
        res.status(409).json({ message: "Ya sigues a este usuario." });
    });
});

router.post('/:userId/unfollow', (req, res) => {
    const userToUnfollowId = req.params.userId;
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ message: "Falta el ID del seguidor." });

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => { if (err) { console.error(err.message); return res.status(500).json({ message: "Error DB." }); }});
    db.run("DELETE FROM followers WHERE followerId = ? AND followingId = ?", [followerId, userToUnfollowId], function(err) {
        db.close();
        if (err) return res.status(500).json({ message: "Error al dejar de seguir." });
        if (this.changes > 0) return res.json({ message: "Has dejado de seguir a este usuario." });
        res.status(200).json({ message: "No seguías a este usuario." }); // O 404
    });
});

router.post('/:userId/remove-follower', (req, res) => {
    const profileOwnerId = req.params.userId; // Dueño del perfil que elimina
    const { followerToRemoveId } = req.body; // Seguidor a ser eliminado
    // ¡AQUÍ DEBERÍA HABER AUTENTICACIÓN PARA ASEGURAR QUE profileOwnerId ES EL USUARIO LOGUEADO!

    if (!followerToRemoveId) return res.status(400).json({ message: "Falta ID del seguidor a eliminar." });

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => { if (err) { console.error(err.message); return res.status(500).json({ message: "Error DB." }); }});
    db.run("DELETE FROM followers WHERE followerId = ? AND followingId = ?", [followerToRemoveId, profileOwnerId], function(err) {
        db.close();
        if (err) return res.status(500).json({ message: "Error al eliminar seguidor." });
        if (this.changes > 0) return res.json({ message: "Seguidor eliminado." });
        res.status(404).json({ message: "Este usuario no te seguía." });
    });
});


// --- Endpoint para SUBIR FOTO DE PERFIL ---
// ¡NECESITA UN MIDDLEWARE DE AUTENTICACIÓN REAL (ej. authMiddleware) para obtener req.user.userId!
router.post('/upload/profile-photo', /* authMiddleware, */ uploadProfilePic.single('profileImage'), (req, res) => {
    // 'profileImage' debe coincidir con el nombre del campo en FormData del frontend
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    }

    // Obtener userId del usuario autenticado (req.user.userId) o del body (INSEGURO sin auth)
    const userId = req.user?.userId || req.body.userId; 
    if (!userId) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo subido sin userId:", err);});
        return res.status(400).json({ message: "Falta el ID del usuario. Se requiere autenticación." });
    }

    const imagePath = `uploads/profile_pics/${req.file.filename}`; // Ruta relativa para la BD y servir

    const db = new sqlite3.Database(DB_PATH);
    // Opcional: Eliminar foto de perfil anterior del sistema de archivos
    db.get("SELECT profilePhotoPath FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) console.error("Error obteniendo foto anterior (perfil):", err.message);
        if (row && row.profilePhotoPath && row.profilePhotoPath !== imagePath) {
            const oldPath = path.join(__dirname, '..', 'public', row.profilePhotoPath);
            fs.unlink(oldPath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') console.error("Error eliminando foto de perfil anterior del FS:", unlinkErr);
            });
        }
    });

    db.run("UPDATE users SET profilePhotoPath = ? WHERE userId = ?", [imagePath, userId], function (errUpdate) {
        db.close();
        if (errUpdate) {
            console.error("Error actualizando BD (foto perfil):", errUpdate.message);
            fs.unlink(req.file.path, (unlinkErrFS) => {if (unlinkErrFS) console.error("Error eliminando archivo subido tras fallo BD:", unlinkErrFS);});
            return res.status(500).json({ message: "Error al actualizar la foto de perfil en la base de datos." });
        }
        res.json({ message: "Foto de perfil actualizada con éxito.", filePath: imagePath });
    });
});

// --- Endpoint para SUBIR FOTO DE PORTADA ---
// ¡NECESITA UN MIDDLEWARE DE AUTENTICACIÓN REAL!
router.post('/upload/cover-photo', /* authMiddleware, */ uploadCoverPic.single('coverImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    }
    const userId = req.user?.userId || req.body.userId; // ¡INSEGURO SIN AUTENTICACIÓN!
    if (!userId) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Falta el ID del usuario. Se requiere autenticación." });
    }
    const imagePath = `uploads/cover_pics/${req.file.filename}`;

    const db = new sqlite3.Database(DB_PATH);
    db.get("SELECT coverPhotoPath FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) console.error("Error obteniendo foto anterior (portada):", err.message);
        if (row && row.coverPhotoPath && row.coverPhotoPath !== imagePath) {
            const oldPath = path.join(__dirname, '..', 'public', row.coverPhotoPath);
            fs.unlink(oldPath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') console.error("Error eliminando foto de portada anterior del FS:", unlinkErr);
            });
        }
    });
    db.run("UPDATE users SET coverPhotoPath = ? WHERE userId = ?", [imagePath, userId], function (errUpdate) {
        db.close();
        if (errUpdate) {
            console.error("Error actualizando BD (foto portada):", errUpdate.message);
            fs.unlink(req.file.path, () => {});
            return res.status(500).json({ message: "Error al actualizar la foto de portada." });
        }
        res.json({ message: "Foto de portada actualizada con éxito.", filePath: imagePath });
    });
});




// --- FUNCIÓN AUXILIAR PARA PROCESAR DATOS DEL USUARIO (INCLUYENDO SEGUIMIENTO Y RANGO) ---
const processUserRowWithFollowData = (db, userRow, viewerId) => {
    return new Promise((resolve, rejectOuter) => { // Renombrado reject para evitar conflicto
        if (!userRow) return resolve(null);

        const userId = userRow.userId;
        let processedUser = { ...userRow, followersCount: 0, followingCount: 0, isFollowing: false, rank: null };

        const countFollowersSql = "SELECT COUNT(*) as count FROM followers WHERE followingId = ?";
        const countFollowingSql = "SELECT COUNT(*) as count FROM followers WHERE followerId = ?";
        const checkIsFollowingSql = "SELECT COUNT(*) as count FROM followers WHERE followerId = ? AND followingId = ?";
        const rankSql = `SELECT COUNT(*) + 1 as rank FROM users WHERE (money + bank) > (SELECT money + bank FROM users WHERE userId = ?)`;

        const getDbData = (sql, params) => new Promise((resP, rejP) => {
            db.get(sql, params, (err, row) => err ? rejP(err) : resP(row));
        });

        Promise.all([
            getDbData(countFollowersSql, [userId]),
            getDbData(countFollowingSql, [userId]),
            viewerId && viewerId !== userId ? getDbData(checkIsFollowingSql, [viewerId, userId]) : Promise.resolve(null), // Solo si hay viewer y no es el mismo perfil
            getDbData(rankSql, [userId])
        ])
        .then(([followersRow, followingRow, isFollowingRow, rankRow]) => {
            processedUser.followersCount = followersRow ? followersRow.count : 0;
            processedUser.followingCount = followingRow ? followingRow.count : 0;
            processedUser.isFollowing = isFollowingRow ? isFollowingRow.count > 0 : false;
            processedUser.rank = rankRow ? rankRow.rank : null;
            resolve(processedUser);
        })
        .catch(err => {
            console.error(`Error procesando datos adicionales para ${userId}:`, err.message);
            resolve(processedUser); // Devolver datos base del usuario incluso si las subconsultas fallan
        });
    });
};


// --- ENDPOINTS DE OBTENCIÓN DE DATOS ---
router.get('/ranking/millonarios', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => { if (err) { console.error(err.message); return res.status(500).json({ error: "Error DB" }); }});
    db.all("SELECT pushname, (money + bank) as totalMoney FROM users ORDER BY totalMoney DESC LIMIT ?", [limit], (err, rows) => {
        db.close();
        if (err) return res.status(500).json({ error: "Error query" });
        res.json(rows);
    });
});

router.get('/:userId/followers', async (req, res) => {
    const profileUserId = req.params.userId;
    const viewerId = req.query.viewerId;
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => { if (err) { console.error(err.message); return res.status(500).json({ error: "Error DB" }); }});
    const sql = `SELECT u.userId, u.pushname, u.profilePhotoPath FROM users u JOIN followers f ON u.userId = f.followerId WHERE f.followingId = ? ORDER BY u.pushname COLLATE NOCASE ASC`;
    try {
        const followerRows = await new Promise((resolve, reject) => db.all(sql, [profileUserId], (err, rows) => err ? reject(err) : resolve(rows)));
        if (!viewerId) {
            return res.json(followerRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }
        const results = await Promise.all(followerRows.map(f => processUserRowWithFollowData(db, f, viewerId).then(pf => ({...pf, isFollowedByViewer: pf.userId === viewerId ? false : pf.isFollowing}))));
        // La línea anterior es un poco compleja. Lo que queremos es que isFollowedByViewer sea si el viewerId sigue a f.userId
        // processUserRowWithFollowData devuelve isFollowing del viewerId hacia el userRow (f).
        // Esto ya debería ser correcto si viewerId se pasa adecuadamente.

        // Simplificado (asumiendo que necesitamos saber si el viewer sigue a cada follower en la lista):
        const finalResults = await Promise.all(followerRows.map(follower => {
            return new Promise(async (resolveItem) => {
                if (follower.userId === viewerId) { // El viewer no se "sigue" a sí mismo en este contexto
                    resolveItem({ ...follower, isFollowedByViewer: false }); return;
                }
                const checkSql = "SELECT COUNT(*) as count FROM followers WHERE followerId = ? AND followingId = ?";
                const row = await new Promise((resP, rejP)=> db.get(checkSql, [viewerId, follower.userId], (e,r)=> e?rejP(e):resP(r)));
                resolveItem({ ...follower, isFollowedByViewer: row ? row.count > 0 : false });
            });
        }));
        res.json(finalResults);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener seguidores." });
    } finally {
        db.close();
    }
});

router.get('/:userId/following', async (req, res) => {
    const profileUserId = req.params.userId;
    const viewerId = req.query.viewerId;
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => { if (err) { console.error(err.message); return res.status(500).json({ error: "Error DB" }); }});
    const sql = `SELECT u.userId, u.pushname, u.profilePhotoPath FROM users u JOIN followers f ON u.userId = f.followingId WHERE f.followerId = ? ORDER BY u.pushname COLLATE NOCASE ASC`;
    try {
        const followingRows = await new Promise((resolve, reject) => db.all(sql, [profileUserId], (err, rows) => err ? reject(err) : resolve(rows)));
        if (!viewerId) {
            return res.json(followingRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }
        // Simplificado:
        const finalResults = await Promise.all(followingRows.map(followedUser => {
            return new Promise(async (resolveItem) => {
                if (followedUser.userId === viewerId) { 
                    // Si estoy viendo mi lista de "siguiendo", y el viewer soy yo,
                    // el botón debería ser "Dejar de seguir" para esta persona.
                    // 'isFollowedByViewer' aquí significaría si YO (viewer) sigo a esta persona (followedUser).
                    // Como estoy en MI lista de "siguiendo", ya sigo a followedUser.
                    resolveItem({ ...followedUser, isFollowedByViewer: true }); return; 
                }
                const checkSql = "SELECT COUNT(*) as count FROM followers WHERE followerId = ? AND followingId = ?";
                const row = await new Promise((resP, rejP)=> db.get(checkSql, [viewerId, followedUser.userId], (e,r)=> e?rejP(e):resP(r)));
                resolveItem({ ...followedUser, isFollowedByViewer: row ? row.count > 0 : false });
            });
        }));
        res.json(finalResults);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener lista de seguidos." });
    } finally {
        db.close();
    }
});


router.get('/:queryParam', async (req, res) => {
    const queryParamInput = req.params.queryParam;
    const viewerId = req.query.viewerId; 
    const queryParam = queryParamInput.trim();
    
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (errDb) => {
        if (errDb) return res.status(500).json({ error: "Error conectando a la BD." });
    });

    // Añadir profilePhotoPath y coverPhotoPath al select
    const fieldsToSelect = "userId, pushname, exp, money, bank, lastwork, laststeal, lastcrime, lastslut, lastroulette, lastslots, lastdaily, dailystreak, profilePhotoPath, coverPhotoPath";

    try {
        let baseData;
        if (queryParam.includes('@')) { // Búsqueda por ID
            const sql = `SELECT ${fieldsToSelect} FROM users WHERE userId = ?`;
            baseData = await new Promise((resolve, reject) => {
                db.get(sql, [queryParam], (err, row) => err ? reject(err) : resolve(row));
            });
            if (!baseData) return res.status(404).json({ message: "Usuario no encontrado." });
            const processedData = await processUserRowWithFollowData(db, baseData, viewerId);
            res.json(processedData);

        } else { // Búsqueda por pushname
            const sql = `SELECT ${fieldsToSelect} FROM users WHERE LOWER(TRIM(pushname)) LIKE LOWER(?) ORDER BY (money + bank) DESC LIMIT 10`;
            baseData = await new Promise((resolve, reject) => {
                db.all(sql, [`%${queryParam}%`], (err, rows) => err ? reject(err) : resolve(rows));
            });
            if (!baseData || baseData.length === 0) return res.status(404).json({ message: "No se encontraron usuarios." });
            
            const processedRows = await Promise.all(
                baseData.map(row => processUserRowWithFollowData(db, row, viewerId))
            );
            res.json(processedRows);
        }
    } catch (error) {
        console.error(`[API GetUser ${queryParam}] Error:`, error.message);
        res.status(500).json({ error: "Error al procesar la solicitud del usuario." });
    } finally {
        db.close((err) => { if (err) console.error("Error cerrando BD en GetUser:", err.message);});
    }
});



// --- Endpoint para ACTUALIZAR NOMBRE DE USUARIO ---
// ¡NECESITA AUTENTICACIÓN! El userId debería venir de req.user.id
router.put('/update-name', (req, res) => {
    // En un sistema con autenticación, obtendrías el userId del usuario autenticado (ej. req.user.userId)
    // y no lo pasarías en el body para mayor seguridad.
    const { userId, newName } = req.body;

    if (!userId || !newName) {
        return res.status(400).json({ message: "Faltan el ID de usuario o el nuevo nombre." });
    }

    const trimmedNewName = newName.trim();
    if (trimmedNewName.length < 3 || trimmedNewName.length > 25) { // Ejemplo de validación
        return res.status(400).json({ message: "El nombre debe tener entre 3 y 25 caracteres." });
    }
    // Podrías añadir más validaciones (ej. caracteres permitidos, unicidad si es requerida)

    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (errDb) => {
        if (errDb) { console.error("[API UpdateName] Error BD:", errDb.message); return res.status(500).json({ message: "Error del servidor." });}
    });

    const sql = "UPDATE users SET pushname = ? WHERE userId = ?";
    db.run(sql, [trimmedNewName, userId], function(err) {
        db.close();
        if (err) {
            console.error("[API UpdateName] Error SQL:", err.message);
            return res.status(500).json({ message: "Error al actualizar el nombre de usuario." });
        }
        if (this.changes > 0) {
            res.json({ message: "Nombre de usuario actualizado con éxito.", newName: trimmedNewName });
        } else {
            // Esto podría pasar si el userId no existe, o si el nombre ya era el mismo (aunque el frontend lo evita)
            res.status(404).json({ message: "No se pudo actualizar el nombre (usuario no encontrado o sin cambios)." });
        }
    });
});

module.exports = router;