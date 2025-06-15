// routes/users.js
const express = require('express');
const path = require('path');
const db = require('../db'); // Tu módulo de conexión a la base de datos
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// --- Configuración de Multer (movida más arriba para mejor organización) ---
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const PROFILE_PICS_DIR = path.join(UPLOADS_DIR, 'profile_pics');
const COVER_PICS_DIR = path.join(UPLOADS_DIR, 'cover_pics');

// Crear directorios si no existen
if (!fs.existsSync(UPLOADS_DIR)) { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); }
if (!fs.existsSync(PROFILE_PICS_DIR)) { fs.mkdirSync(PROFILE_PICS_DIR, { recursive: true }); }
if (!fs.existsSync(COVER_PICS_DIR)) { fs.mkdirSync(COVER_PICS_DIR, { recursive: true }); }

const storageConfig = (uploadPath) => multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // En un sistema real, userId vendría de req.user.userId (autenticación)
        const userId = req.body.userId || 'anonymous_upload';
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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadCoverPic = multer({
    storage: storageConfig(COVER_PICS_DIR),
    fileFilter: fileFilterConfig,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});


// --- ENDPOINTS DE ACCIÓN SOCIAL ---
router.post('/:userId/follow', async (req, res) => {
    const userToFollowId = req.params.userId;
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ message: "Falta el ID del seguidor." });
    if (userToFollowId === followerId) return res.status(400).json({ message: "No puedes seguirte a ti mismo." });

    const sql = 'INSERT INTO followers ("followerId", "followingId") VALUES ($1, $2) ON CONFLICT DO NOTHING';
    try {
        const result = await db.query(sql, [followerId, userToFollowId]);
        if (result.rowCount > 0) {
            res.json({ message: "Ahora estás siguiendo a este usuario." });
        } else {
            res.status(409).json({ message: "Ya estás siguiendo a este usuario o uno de los usuarios no existe." });
        }
    } catch (error) {
        console.error("[API Follow] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al intentar seguir al usuario." });
    }
});

router.post('/:userId/unfollow', async (req, res) => {
    const userToUnfollowId = req.params.userId;
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ message: "Falta el ID del seguidor." });
    if (userToUnfollowId === followerId) return res.status(400).json({ message: "Acción no válida." });

    const sql = 'DELETE FROM followers WHERE "followerId" = $1 AND "followingId" = $2';
    try {
        const result = await db.query(sql, [followerId, userToUnfollowId]);
        if (result.rowCount > 0) {
            res.json({ message: "Has dejado de seguir a este usuario." });
        } else {
            res.status(404).json({ message: "No estabas siguiendo a este usuario." });
        }
    } catch (error) {
        console.error("[API Unfollow] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al dejar de seguir al usuario." });
    }
});

router.post('/:userId/remove-follower', async (req, res) => {
    const profileOwnerId = req.params.userId;
    const { followerToRemoveId } = req.body;
    // Aquí iría la lógica de autenticación para asegurar que profileOwnerId es el usuario logueado
    if (!followerToRemoveId) return res.status(400).json({ message: "Falta el ID del seguidor a eliminar." });

    const sql = 'DELETE FROM followers WHERE "followerId" = $1 AND "followingId" = $2';
    try {
        const result = await db.query(sql, [followerToRemoveId, profileOwnerId]);
        if (result.rowCount > 0) {
            res.json({ message: "Seguidor eliminado correctamente." });
        } else {
            res.status(404).json({ message: "Este usuario no te estaba siguiendo o ya fue eliminado." });
        }
    } catch (error) {
        console.error("[API RemoveFollower] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al eliminar el seguidor." });
    }
});

// --- ENDPOINTS DE SUBIDA DE IMÁGENES ---
router.post('/upload/profile-photo', uploadProfilePic.single('profileImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    const userId = req.body.userId; // En un sistema real, esto vendría de req.user.userId
    if (!userId) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (perfil) sin userId:", err);});
        return res.status(400).json({ message: "Falta el ID del usuario." });
    }
    const imagePath = `uploads/profile_pics/${req.file.filename}`;
    try {
        const oldPicResult = await db.query('SELECT "profilePhotoPath" FROM users WHERE "userId" = $1', [userId]);
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].profilePhotoPath && oldPicResult.rows[0].profilePhotoPath !== imagePath) {
            const oldFsPath = path.join(__dirname, '..', 'public', oldPicResult.rows[0].profilePhotoPath);
            if (fs.existsSync(oldFsPath)) {
                fs.unlink(oldFsPath, (unlinkErr) => { if (unlinkErr) console.error("Error eliminando foto de perfil anterior:", unlinkErr.message);});
            }
        }
        const updateResult = await db.query('UPDATE users SET "profilePhotoPath" = $1 WHERE "userId" = $2', [imagePath, userId]);
        if (updateResult.rowCount > 0) {
            res.json({ message: "Foto de perfil actualizada.", filePath: imagePath });
        } else {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (perfil) tras fallo de BD:", err);});
            res.status(404).json({ message: "Usuario no encontrado para actualizar foto." });
        }
    } catch (error) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (perfil) tras error general:", err);});
        console.error("[API UploadProfilePhoto] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error interno al actualizar foto de perfil." });
    }
});

router.post('/upload/cover-photo', uploadCoverPic.single('coverImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    const userId = req.body.userId; // En un sistema real, esto vendría de req.user.userId
    if (!userId) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (portada) sin userId:", err);});
        return res.status(400).json({ message: "Falta el ID del usuario." });
    }
    const imagePath = `uploads/cover_pics/${req.file.filename}`;
    try {
        const oldPicResult = await db.query('SELECT "coverPhotoPath" FROM users WHERE "userId" = $1', [userId]);
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].coverPhotoPath && oldPicResult.rows[0].coverPhotoPath !== imagePath) {
            const oldFsPath = path.join(__dirname, '..', 'public', oldPicResult.rows[0].coverPhotoPath);
            if (fs.existsSync(oldFsPath)) {
                fs.unlink(oldFsPath, (unlinkErr) => { if (unlinkErr) console.error("Error eliminando foto de portada anterior:", unlinkErr.message);});
            }
        }
        const updateResult = await db.query('UPDATE users SET "coverPhotoPath" = $1 WHERE "userId" = $2', [imagePath, userId]);
        if (updateResult.rowCount > 0) {
            res.json({ message: "Foto de portada actualizada.", filePath: imagePath });
        } else {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (portada) tras fallo de BD:", err);});
            res.status(404).json({ message: "Usuario no encontrado para actualizar foto." });
        }
    } catch (error) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo (portada) tras error general:", err);});
        console.error("[API UploadCoverPhoto] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error interno al actualizar foto de portada." });
    }
});

// --- ENDPOINT PARA ACTUALIZAR NOMBRE ---
router.put('/update-name', async (req, res) => {
    // En un sistema real, userId vendría de req.user.userId (autenticación)
    const { userId, newName } = req.body;
    if (!userId || newName === undefined) {
        return res.status(400).json({ message: "Faltan el ID de usuario o el nuevo nombre." });
    }
    const trimmedNewName = newName.trim();
    if (trimmedNewName.length < 3 || trimmedNewName.length > 25) {
        return res.status(400).json({ message: "El nombre debe tener entre 3 y 25 caracteres." });
    }
    try {
        const sql = 'UPDATE users SET pushname = $1 WHERE "userId" = $2';
        const result = await db.query(sql, [trimmedNewName, userId]);
        if (result.rowCount > 0) {
            res.json({ message: "Nombre de usuario actualizado con éxito.", newName: trimmedNewName });
        } else {
            res.status(404).json({ message: "No se pudo actualizar el nombre (usuario no encontrado)." });
        }
    } catch (error) {
        console.error("[API UpdateName] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al actualizar el nombre de usuario." });
    }
});


// --- FUNCIÓN AUXILIAR PARA PROCESAR DATOS DEL USUARIO (SEGUIMIENTO Y RANGO) ---
// Esta función se usa en el GET /:queryParam
const processUserRowWithFollowData = async (dbPool, userRow, viewerId) => {
    if (!userRow) return null;
    const userIdFromRow = userRow.userId; // Asumiendo que "userId" ya es el nombre correcto de la columna en userRow

    if (!userIdFromRow) {
        console.error("processUserRowWithFollowData: userId no encontrado en userRow:", userRow);
        // Devolver userRow tal cual pero con valores por defecto para los contadores
        return { ...userRow, followersCount: 0, followingCount: 0, isFollowing: false, rank: null };
    }

    let processedUser = { ...userRow, followersCount: 0, followingCount: 0, isFollowing: false, rank: null };

    try {
        const promises = [
            dbPool.query('SELECT COUNT(*) as count FROM followers WHERE "followingId" = $1', [userIdFromRow]),
            dbPool.query('SELECT COUNT(*) as count FROM followers WHERE "followerId" = $1', [userIdFromRow]),
            dbPool.query('SELECT COUNT(*) + 1 as rank FROM users WHERE (money + bank) > (SELECT money + bank FROM users WHERE "userId" = $1)', [userIdFromRow])
        ];

        if (viewerId && viewerId !== userIdFromRow) {
            promises.push(dbPool.query('SELECT COUNT(*) as count FROM followers WHERE "followerId" = $1 AND "followingId" = $2', [viewerId, userIdFromRow]));
        } else {
            promises.push(Promise.resolve({ rows: [{ count: 0 }] })); // Placeholder para isFollowing si no hay viewerId o es el mismo usuario
        }

        const [followersRes, followingRes, rankRes, isFollowingResOrPlaceholder] = await Promise.all(promises);

        processedUser.followersCount = parseInt(followersRes.rows[0]?.count, 10) || 0;
        processedUser.followingCount = parseInt(followingRes.rows[0]?.count, 10) || 0;
        processedUser.rank = rankRes.rows[0] ? parseInt(rankRes.rows[0].rank, 10) : null;
        processedUser.isFollowing = (parseInt(isFollowingResOrPlaceholder.rows[0]?.count, 10) || 0) > 0;

    } catch (error) {
        console.error(`Error procesando datos adicionales para usuario ${userIdFromRow}:`, error.message);
        // No re-lanzar el error, simplemente devolver el usuario con los datos base
    }
    return processedUser;
};


// --- ENDPOINTS DE OBTENCIÓN DE DATOS ---
router.get('/ranking/millonarios', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    try {
        // Asegúrate que los nombres de columna "totalMoney" y "pushname" sean correctos
        // Si "pushname" fue creado con mayúsculas, usa "pushname". Si no, pushname.
        const result = await db.query('SELECT pushname, (money + bank) as "totalMoney" FROM users ORDER BY "totalMoney" DESC LIMIT $1', [limit]);
        res.json(result.rows);
    } catch (error) {
        console.error("[API Millonarios] Error:", error.message, error.stack);
        res.status(500).json({ error: "Error al consultar ranking." });
    }
});

router.get('/:userId/followers', async (req, res) => {
    const profileUserId = req.params.userId; // Este es el "followingId" en la tabla followers
    const viewerId = req.query.viewerId;

    // Usuarios que siguen a profileUserId
    const followersSql = `
        SELECT u."userId", u.pushname, u."profilePhotoPath"
        FROM users u
        JOIN followers f ON u."userId" = f."followerId"
        WHERE f."followingId" = $1
        ORDER BY LOWER(u.pushname) ASC
    `;
    try {
        const followerRowsResult = await db.query(followersSql, [profileUserId]);
        const followerRows = followerRowsResult.rows;

        if (!viewerId) { // Si no hay viewer, no podemos saber si el viewer sigue a estos usuarios
            return res.json(followerRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }

        const results = await Promise.all(followerRows.map(async (follower) => {
            let isFollowedByViewer = false;
            const currentListedUserId = follower.userId;
            if (currentListedUserId && currentListedUserId !== viewerId) {
                const checkRes = await db.query(
                    'SELECT COUNT(*) as count FROM followers WHERE "followerId" = $1 AND "followingId" = $2',
                    [viewerId, currentListedUserId]
                );
                isFollowedByViewer = (parseInt(checkRes.rows[0]?.count, 10) || 0) > 0;
            }
            return { ...follower, isFollowedByViewer };
        }));
        res.json(results);
    } catch (error) {
        console.error(`[API GetFollowers ${profileUserId}] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener la lista de seguidores." });
    }
});

router.get('/:userId/following', async (req, res) => {
    const profileUserId = req.params.userId; // Este es el "followerId" en la tabla followers
    const viewerId = req.query.viewerId;

    // Usuarios a los que profileUserId sigue
    const followingSql = `
        SELECT u."userId", u.pushname, u."profilePhotoPath"
        FROM users u
        JOIN followers f ON u."userId" = f."followingId"
        WHERE f."followerId" = $1
        ORDER BY LOWER(u.pushname) ASC
    `;
    try {
        const followingRowsResult = await db.query(followingSql, [profileUserId]);
        const followingRows = followingRowsResult.rows;

        if (!viewerId) { // Si no hay viewer, no podemos saber si el viewer sigue a estos usuarios
            return res.json(followingRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }

        const results = await Promise.all(followingRows.map(async (followedUser) => {
            let isFollowedByViewer = false;
            const currentListedUserId = followedUser.userId;
            if (currentListedUserId && currentListedUserId !== viewerId) {
                const checkRes = await db.query(
                    'SELECT COUNT(*) as count FROM followers WHERE "followerId" = $1 AND "followingId" = $2',
                    [viewerId, currentListedUserId]
                );
                isFollowedByViewer = (parseInt(checkRes.rows[0]?.count, 10) || 0) > 0;
            } else if (currentListedUserId && currentListedUserId === viewerId) {
                // Si el usuario que se está listando es el mismo viewer, entonces el viewer se "sigue" a sí mismo
                // en el contexto de esta lista (es decir, está en la lista de la persona que está viendo)
                // PERO la pregunta es si el viewer SIGUE a esta persona.
                // La lógica isFollowedByViewer se refiere a si el *viewer* sigue al *currentListedUserId*.
                // Si currentListedUserId es viewerId, la pregunta es si el viewer se sigue a sí mismo, lo cual no permitimos.
                // Así que aquí, isFollowedByViewer debería ser false a menos que permitas auto-seguimiento.
                // Sin embargo, si estamos viendo NUESTRA PROPIA lista de "siguiendo", y aparece nuestro propio perfil
                // (lo cual no debería pasar si no permitimos auto-seguimiento),
                // la pregunta es si "seguimos" a esa persona.
                // Para simplificar: si el currentListedUserId es el viewer, no mostramos botón de seguir/dejar de seguir.
            }
            return { ...followedUser, isFollowedByViewer };
        }));
        res.json(results);
    } catch (error) {
        console.error(`[API GetFollowing ${profileUserId}] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener la lista de usuarios seguidos." });
    }
});


// Ruta principal para obtener datos de usuario (perfil o resultados de búsqueda)
router.get('/:queryParam', async (req, res) => {
    const queryParamInput = req.params.queryParam;
    const viewerId = req.query.viewerId;
    const queryParam = queryParamInput.trim();
    const dbToUse = db;

    // Campos base de la tabla users (alias 'u')
    const userFields = `
        u."userId", u.pushname, u.exp, u.money, u.bank, 
        u.lastwork, u.laststeal, u.lastcrime, u.lastslut, 
        u.lastroulette, u.lastslots, u.lastdaily, u.dailystreak, 
        u."profilePhotoPath", u."coverPhotoPath"
    `;
    // Campos de la tabla user_spotify_details (alias 'spd')
    const spotifyFields = `
        spd.spotify_user_id, spd.spotify_display_name, spd.spotify_profile_image_url
    `;

    const fieldsToSelect = `${userFields}, ${spotifyFields}`;

    try {
        let baseDataResult;
        if (queryParam.includes('@')) { // Búsqueda por ID (asumiendo que el ID contiene '@')
            const sql = `
                SELECT ${fieldsToSelect}
                FROM users u
                LEFT JOIN user_spotify_details spd ON u."userId" = spd.user_app_id
                WHERE u."userId" = $1
            `;
            baseDataResult = await dbToUse.query(sql, [queryParam]);

            if (!baseDataResult.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
            
            // Procesar la fila única para añadir contadores de seguidores/siguiendo y estado de seguimiento
            const processedRow = await processUserRowWithFollowData(dbToUse, baseDataResult.rows[0], viewerId);
            res.json(processedRow);

        } else { // Búsqueda por pushname
            const sql = `
                SELECT ${fieldsToSelect}
                FROM users u
                LEFT JOIN user_spotify_details spd ON u."userId" = spd.user_app_id
                WHERE LOWER(TRIM(u.pushname)) LIKE LOWER($1)
                ORDER BY (u.money + u.bank) DESC LIMIT 10
            `;
            baseDataResult = await dbToUse.query(sql, [`%${queryParam}%`]);

            if (!baseDataResult.rows.length) return res.status(404).json({ message: "No se encontraron usuarios." });
            
            // Procesar cada fila para añadir contadores y estado de seguimiento
            const processedRows = await Promise.all(
                baseDataResult.rows.map(row => processUserRowWithFollowData(dbToUse, row, viewerId))
            );
            res.json(processedRows);
        }
    } catch (error) {
        console.error(`[API GetUser ${queryParam}] Error:`, error.message, error.stack);
        res.status(500).json({ error: "Error al procesar la solicitud del usuario." });
    }
});

module.exports = router;