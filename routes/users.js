// routes/users.js
const express = require('express');
const path = require('path'); // path ya estaba importado
const db = require('../db'); // O la ruta correcta a tu archivo db.js que exporta el pool de pg

const router = express.Router();

// Función para escapar HTML (si la necesitas aquí, aunque es más común en el frontend)
function escapeForLogging(text) {
    if (text === null || typeof text === 'undefined') return '';
    return String(text)
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, ".")
         .replace(/'/g, "'");
}

// --- ENDPOINTS DE ACCIÓN SOCIAL (SEGUIR, DEJAR DE SEGUIR, ELIMINAR SEGUIDOR) ---
router.post('/:userId/follow', async (req, res) => {
    const userToFollowId = req.params.userId;
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ message: "Falta el ID del seguidor." });
    if (userToFollowId === followerId) return res.status(400).json({ message: "No puedes seguirte a ti mismo." });

    // CORREGIDO: Usar comillas dobles para "followerId" y "followingId"
    const sql = "INSERT INTO followers (\"followerId\", \"followingId\") VALUES ($1, $2) ON CONFLICT DO NOTHING";
    try {
        // $1 es followerId (quien sigue), $2 es userToFollowId (a quien se sigue)
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

// --- Endpoint para DEJAR DE SEGUIR a un usuario ---
router.post('/:userId/unfollow', async (req, res) => {
    const userToUnfollowId = req.params.userId; // Esta es la persona a la que se deja de seguir (followingId)
    const { followerId } = req.body;          // Este es el usuario que está dejando de seguir (followerId)

    if (!followerId) {
        return res.status(400).json({ message: "Falta el ID del seguidor." });
    }
    if (userToUnfollowId === followerId) {
        // Aunque esta validación no es estrictamente necesaria para 'unfollow',
        // es buena práctica mantenerla por consistencia si la tienes en 'follow'.
        return res.status(400).json({ message: "Acción no válida." });
    }

    // CORREGIDO: Usar "followerId" y "followingId" con comillas dobles
    const sql = "DELETE FROM followers WHERE \"followerId\" = $1 AND \"followingId\" = $2";
    
    try {
        // El primer parámetro ($1) es el followerId (quien realiza la acción de dejar de seguir)
        // El segundo parámetro ($2) es el followingId (a quien se está dejando de seguir)
        const result = await db.query(sql, [followerId, userToUnfollowId]);
        
        if (result.rowCount > 0) {
            res.json({ message: "Has dejado de seguir a este usuario." });
        } else {
            // Si rowCount es 0, significa que la relación no existía.
            res.status(404).json({ message: "No estabas siguiendo a este usuario." });
        }
    } catch (error) {
        console.error("[API Unfollow] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al dejar de seguir al usuario." });
    }
});

// --- Endpoint para ELIMINAR UN SEGUIDOR (por el dueño del perfil) ---
router.post('/:userId/remove-follower', async (req, res) => { // Asegúrate que sea async
    const profileOwnerId = req.params.userId; // El usuario dueño del perfil que está eliminando un seguidor (este es el 'followingId' en la tabla followers)
    const { followerToRemoveId } = req.body;   // El ID del seguidor que se va a eliminar (este es el 'followerId' en la tabla followers)

    // ¡AUTENTICACIÓN REQUERIDA! Asegurar que profileOwnerId es el usuario logueado.
    // En una app real, const authenticatedUserId = req.user.userId;
    // if (profileOwnerId !== authenticatedUserId) {
    //     return res.status(403).json({ message: "No autorizado para realizar esta acción." });
    // }

    if (!followerToRemoveId) {
        return res.status(400).json({ message: "Falta el ID del seguidor a eliminar (followerToRemoveId)." });
    }
    // No tiene sentido que profileOwnerId y followerToRemoveId sean el mismo en este contexto.
    // Si lo fueran, significaría que estás intentando eliminarte a ti mismo de tu propia lista de seguidores, lo cual es imposible.

    // CORREGIDO: Usar "followerId" y "followingId" con comillas dobles
    // Cuando eliminas un seguidor:
    // - El 'followerId' en la tabla 'followers' es el 'followerToRemoveId'.
    // - El 'followingId' en la tabla 'followers' es el 'profileOwnerId' (el dueño del perfil al que seguían).
    const sql = "DELETE FROM followers WHERE \"followerId\" = $1 AND \"followingId\" = $2";
    
    try {
        const result = await db.query(sql, [followerToRemoveId, profileOwnerId]);
        
        if (result.rowCount > 0) {
            res.json({ message: "Seguidor eliminado correctamente." });
        } else {
            // Si rowCount es 0, significa que la relación no existía (la persona no te seguía).
            res.status(404).json({ message: "Este usuario no te estaba siguiendo o ya fue eliminado." });
        }
    } catch (error) {
        console.error("[API RemoveFollower] Error SQL:", error.message, error.stack);
        res.status(500).json({ message: "Error al eliminar el seguidor." });
    }
});


// --- ENDPOINTS DE SUBIDA DE IMÁGENES (Stubs - ¡NECESITAN AUTENTICACIÓN REAL Y MULTER CONFIGURADO!) ---

const fs = require('fs');
const multer = require('multer');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const PROFILE_PICS_DIR = path.join(UPLOADS_DIR, 'profile_pics');
const COVER_PICS_DIR = path.join(UPLOADS_DIR, 'cover_pics');
// ... (configuración de Multer: storageConfig, fileFilterConfig, uploadProfilePic, uploadCoverPic) ...

// Crear directorios si no existen (esto se ejecuta una vez cuando el servidor inicia)
if (!fs.existsSync(UPLOADS_DIR)) { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); }
if (!fs.existsSync(PROFILE_PICS_DIR)) { fs.mkdirSync(PROFILE_PICS_DIR, { recursive: true }); }
if (!fs.existsSync(COVER_PICS_DIR)) { fs.mkdirSync(COVER_PICS_DIR, { recursive: true }); }

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

// ESTAS LÍNEAS DEBEN ESTAR DESCOMENTADAS Y PRESENTES
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

// --- Endpoint para SUBIR FOTO DE PERFIL ---
// --- Endpoint para SUBIR FOTO DE PERFIL ---
router.post('/upload/profile-photo', /* authMiddleware, */ uploadProfilePic.single('profileImage'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    }

    const userId = req.user?.userId || req.body.userId; // ¡INSEGURO sin auth real!
    if (!userId) {
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error eliminando archivo subido sin userId (perfil):", err);});
        return res.status(400).json({ message: "Falta el ID del usuario. Se requiere autenticación." });
    }

    const imagePath = `uploads/profile_pics/${req.file.filename}`;

    try {
        // Opcional: Eliminar foto de perfil anterior del sistema de archivos
        // CORREGIDO: Usar "userId"
        const oldPicResult = await db.query('SELECT "profilePhotoPath" FROM users WHERE "userId" = $1', [userId]);
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].profilePhotoPath && oldPicResult.rows[0].profilePhotoPath !== imagePath) {
            const oldFsPath = path.join(__dirname, '..', 'public', oldPicResult.rows[0].profilePhotoPath);
            if (fs.existsSync(oldFsPath)) {
                fs.unlink(oldFsPath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error eliminando foto de perfil anterior del FS:", unlinkErr.message);
                });
            }
        }

        // Actualizar la base de datos
        // CORREGIDO: Usar "userId"
        const updateResult = await db.query('UPDATE users SET "profilePhotoPath" = $1 WHERE "userId" = $2', [imagePath, userId]);
        
        if (updateResult.rowCount > 0) {
            res.json({ message: "Foto de perfil actualizada con éxito.", filePath: imagePath });
        } else {
            fs.unlink(req.file.path, (unlinkErrFS) => {if (unlinkErrFS) console.error("Error eliminando archivo subido tras fallo de actualización BD (perfil):", unlinkErrFS);});
            res.status(404).json({ message: "Usuario no encontrado para actualizar la foto de perfil." });
        }
    } catch (error) {
        fs.unlink(req.file.path, (unlinkErrFS) => {if (unlinkErrFS) console.error("Error eliminando archivo subido tras error general (perfil):", unlinkErrFS);});
        console.error("[API UploadProfilePhoto] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error interno al actualizar la foto de perfil." });
    }
});

// --- Endpoint para SUBIR FOTO DE PORTADA ---
router.post('/upload/cover-photo', /* authMiddleware, */ uploadCoverPic.single('coverImage'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    }
    const userId = req.user?.userId || req.body.userId; // ¡INSEGURO sin auth real!
    if (!userId) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Falta el ID del usuario. Se requiere autenticación." });
    }
    const imagePath = `uploads/cover_pics/${req.file.filename}`;

    try {
        // Opcional: Eliminar foto de portada anterior
        // CORREGIDO: Usar "userId"
        const oldPicResult = await db.query('SELECT "coverPhotoPath" FROM users WHERE "userId" = $1', [userId]);
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].coverPhotoPath && oldPicResult.rows[0].coverPhotoPath !== imagePath) {
            const oldFsPath = path.join(__dirname, '..', 'public', oldPicResult.rows[0].coverPhotoPath);
            if (fs.existsSync(oldFsPath)) {
                fs.unlink(oldFsPath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error eliminando foto de portada anterior del FS:", unlinkErr.message);
                });
            }
        }
        
        // Actualizar la base de datos
        // CORREGIDO: Usar "userId"
        const updateResult = await db.query('UPDATE users SET "coverPhotoPath" = $1 WHERE "userId" = $2', [imagePath, userId]);

        if (updateResult.rowCount > 0) {
            res.json({ message: "Foto de portada actualizada con éxito.", filePath: imagePath });
        } else {
            fs.unlink(req.file.path, (unlinkErrFS) => {if (unlinkErrFS) console.error("Error eliminando archivo subido tras fallo de actualización BD (portada):", unlinkErrFS);});
            res.status(404).json({ message: "Usuario no encontrado para actualizar la foto de portada." });
        }
    } catch (error) {
        fs.unlink(req.file.path, (unlinkErrFS) => {if (unlinkErrFS) console.error("Error eliminando archivo subido tras error general (portada):", unlinkErrFS);});
        console.error("[API UploadCoverPhoto] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error interno al actualizar la foto de portada." });
    }
});



// --- FUNCIÓN AUXILIAR PARA PROCESAR DATOS DEL USUARIO (SEGUIMIENTO Y RANGO) ---
const processUserRowWithFollowData = async (db, userRow, viewerId) => {
    if (!userRow) return null;
    
    // Aquí es donde obtienes el ID del objeto userRow que viene de la consulta principal.
    // Si la consulta principal hizo SELECT "userId" AS "userId", entonces userRow.userId debería funcionar.
    // Si la consulta principal hizo SELECT "userId" (sin AS), pg podría devolver userRow.userid (minúsculas).
    // ¡HAZ UN console.log(userRow) ANTES DE ESTA LÍNEA PARA VERIFICAR LA PROPIEDAD EXACTA!
    const userIdFromRow = userRow.userId || userRow.userid; // Intenta con ambas por si acaso

    if (!userIdFromRow) {
        console.error("processUserRowWithFollowData: userId no encontrado en userRow:", userRow);
        return { ...userRow, followersCount: 0, followingCount: 0, isFollowing: false, rank: null };
    }

    let processedUser = { ...userRow, followersCount: 0, followingCount: 0, isFollowing: false, rank: null };

    try {
        const promises = [
            // En estas subconsultas, 'userIdFromRow' ya tiene el valor correcto.
            // La columna en la tabla 'users' es "userId".
            db.query("SELECT COUNT(*) as count FROM followers WHERE \"followingId\" = $1", [userIdFromRow]),
            // CORREGIDO: "followerId"
            db.query("SELECT COUNT(*) as count FROM followers WHERE \"followerId\" = $1", [userIdFromRow]),
            // AQUÍ ESTÁ LA REFERENCIA A "userId" DENTRO DE LA SUBCONSULTA DE RANKING
            db.query(`SELECT COUNT(*) + 1 as rank FROM users WHERE (money + bank) > (SELECT money + bank FROM users WHERE "userId" = $1)`, [userIdFromRow])
        ];

        if (viewerId && viewerId !== userIdFromRow) {
             // AQUÍ TAMBIÉN, "followingId" y "followerId" deben coincidir con tu tabla 'followers'
            promises.push(db.query("SELECT COUNT(*) as count FROM followers WHERE \"followerId\" = $1 AND \"followingId\" = $2", [viewerId, userIdFromRow]));
        } else {
            promises.push(Promise.resolve({ rows: [{ count: 0 }] }));
        }

        const [followersRes, followingRes, rankRes, isFollowingResOrPlaceholder] = await Promise.all(promises);

        processedUser.followersCount = parseInt(followersRes.rows[0]?.count) || 0;
        processedUser.followingCount = parseInt(followingRes.rows[0]?.count) || 0;
        processedUser.rank = rankRes.rows[0] ? parseInt(rankRes.rows[0].rank) : null;
        processedUser.isFollowing = (parseInt(isFollowingResOrPlaceholder.rows[0]?.count) || 0) > 0;

    } catch (error) {
        console.error(`Error procesando datos adicionales para ${userId}:`, error.message, error.stack);
        // Devolver datos base del usuario incluso si las subconsultas fallan
    }
    return processedUser;
};

// --- ENDPOINTS DE OBTENCIÓN DE DATOS ---
router.get('/ranking/millonarios', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    try {
        const result = await db.query("SELECT pushname, (money + bank) as \"totalMoney\" FROM users ORDER BY \"totalMoney\" DESC LIMIT $1", [limit]);
        res.json(result.rows);
    } catch (error) {
        console.error("[API Millonarios] Error:", error.message, error.stack);
        res.status(500).json({ error: "Error al consultar ranking." });
    }
});

// --- Endpoint para OBTENER SEGUIDORES de un usuario ---
router.get('/:userId/followers', async (req, res) => {
    const profileUserId = req.params.userId;
    const viewerId = req.query.viewerId;
    const dbToUse = db;

    const followersSql = `
        SELECT u."userId", u.pushname, u."profilePhotoPath" 
        FROM users u
        JOIN followers f ON u."userId" = f."followerId" -- CORREGIDO: "followerId"
        WHERE f."followingId" = $1                     -- CORREGIDO: "followingId"
        ORDER BY LOWER(u.pushname) ASC 
    `;

    try {
        const followerRowsResult = await dbToUse.query(followersSql, [profileUserId]);
        const followerRows = followerRowsResult.rows;

        if (!viewerId) {
            return res.json(followerRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }

        const results = await Promise.all(followerRows.map(async (follower) => {
            let isFollowedByViewer = false;
            const currentFollowerId = follower.userId || follower.userid; // Verifica cómo pg devuelve esto

            if (currentFollowerId && currentFollowerId !== viewerId) {
                const checkRes = await dbToUse.query(
                    // CORREGIDO: "followerId" y "followingId"
                    "SELECT COUNT(*) as count FROM followers WHERE \"followerId\" = $1 AND \"followingId\" = $2", 
                    [viewerId, currentFollowerId]
                );
                isFollowedByViewer = (parseInt(checkRes.rows[0]?.count) || 0) > 0;
            }
            return { ...follower, isFollowedByViewer };
        }));
        res.json(results);
    } catch (error) {
        console.error(`[API GetFollowers ${profileUserId}] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener la lista de seguidores." });
    }
});


// --- Endpoint para OBTENER a QUIÉNES SIGUE un usuario ---
router.get('/:userId/following', async (req, res) => {
    const profileUserId = req.params.userId;
    const viewerId = req.query.viewerId;
    const dbToUse = db;

    const followingSql = `
        SELECT u."userId", u.pushname, u."profilePhotoPath"
        FROM users u
        JOIN followers f ON u."userId" = f."followingId" -- CORREGIDO: "followingId"
        WHERE f."followerId" = $1                      -- CORREGIDO: "followerId"
        ORDER BY LOWER(u.pushname) ASC
    `;

    try {
        const followingRowsResult = await dbToUse.query(followingSql, [profileUserId]);
        const followingRows = followingRowsResult.rows;

        if (!viewerId) {
            return res.json(followingRows.map(f => ({ ...f, isFollowedByViewer: false })));
        }
        
        const results = await Promise.all(followingRows.map(async (followedUser) => {
            let isFollowedByViewer = false;
            const currentFollowedUserId = followedUser.userId || followedUser.userid; // Verifica cómo pg devuelve esto

            if (currentFollowedUserId && currentFollowedUserId !== viewerId) {
                const checkRes = await dbToUse.query(
                    // CORREGIDO: "followerId" y "followingId"
                    "SELECT COUNT(*) as count FROM followers WHERE \"followerId\" = $1 AND \"followingId\" = $2", 
                    [viewerId, currentFollowedUserId]
                );
                isFollowedByViewer = (parseInt(checkRes.rows[0]?.count) || 0) > 0;
            } else if (currentFollowedUserId && currentFollowedUserId === viewerId && profileUserId === viewerId) {
                isFollowedByViewer = true; 
            }
            return { ...followedUser, isFollowedByViewer };
        }));
        res.json(results);
    } catch (error) {
        console.error(`[API GetFollowing ${profileUserId}] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener la lista de usuarios seguidos." });
    }
});




router.get('/:queryParam', async (req, res) => {
    const queryParamInput = req.params.queryParam;
    const viewerId = req.query.viewerId; 
    const queryParam = queryParamInput.trim();
    const dbToUse = db; // Usar el pool importado 'db'
    const fieldsToSelect = `
            "userId", pushname, exp, money, bank, 
            lastwork, laststeal, lastcrime, lastslut, 
            lastroulette, lastslots, lastdaily, dailystreak, 
            "profilePhotoPath", "coverPhotoPath" 
            `; 
            try {
                let baseDataResult;
                if (queryParam.includes('@')) { // Búsqueda por ID
                    // AQUÍ ESTÁ LA CONSULTA PRINCIPAL - ASEGÚRATE QUE "userId" ESTÉ CORRECTO
                    const sql = `SELECT ${fieldsToSelect} FROM users WHERE "userId" = $1`;
                    baseDataResult = await dbToUse.query(sql, [queryParam]);
        
                    if (!baseDataResult.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
                    
                    const processedRow = await processUserRowWithFollowData(dbToUse, baseDataResult.rows[0], viewerId);
                    res.json(processedRow);
        
                } else { // Búsqueda por pushname
                    // Asumiendo que 'pushname' es todo minúsculas en la BD y se creó sin comillas
                    const sql = `SELECT ${fieldsToSelect} FROM users WHERE LOWER(TRIM(pushname)) LIKE LOWER($1) ORDER BY (money + bank) DESC LIMIT 10`;
                    baseDataResult = await dbToUse.query(sql, [`%${queryParam}%`]);
        
                    if (!baseDataResult.rows.length) return res.status(404).json({ message: "No se encontraron usuarios." });
                    
                    const processedRows = await Promise.all(
                        baseDataResult.rows.map(row => processUserRowWithFollowData(dbToUse, row, viewerId))
                    );
                    res.json(processedRows);
                }
            } catch (error) {
                // La línea 333 (o cerca) que te da el error está DENTRO de este bloque catch
                // o en una de las funciones llamadas (probablemente processUserRowWithFollowData o la query principal).
                console.error(`[API GetUser ${queryParam}] Error:`, error.message, error.stack); // El stack te dirá exactamente dónde
                res.status(500).json({ error: "Error al procesar la solicitud del usuario." });
            } 
        });




        // ¡NECESITA AUTENTICACIÓN! El userId real para la actualización debería venir de req.user.id
// establecido por un middleware de autenticación, no ciegamente del body.
router.put('/update-name', async (req, res) => {
    // En un sistema autenticado, harías: const userId = req.user.userId;
    // Por ahora, y como lo envías desde el frontend, lo tomamos del body.
    const { userId, newName } = req.body;

    if (!userId || newName === undefined) { // newName puede ser una cadena vacía, pero no undefined
        return res.status(400).json({ message: "Faltan el ID de usuario o el nuevo nombre." });
    }

    const trimmedNewName = newName.trim();
    // Validación de longitud (la misma que en el frontend)
    if (trimmedNewName.length < 3 || trimmedNewName.length > 25) {
        return res.status(400).json({ message: "El nombre debe tener entre 3 y 25 caracteres." });
    }
    // Podrías añadir más validaciones aquí (ej. caracteres permitidos, unicidad si es requerida)

    try {
        // Asegúrate que 'pushname' y 'userId' coincidan con los nombres de columna en tu BD PG
        // (con comillas dobles si tienen mayúsculas: "pushname", "userId")
        const sql = 'UPDATE users SET pushname = $1 WHERE "userId" = $2';
        const result = await db.query(sql, [trimmedNewName, userId]);

        if (result.rowCount > 0) {
            res.json({ message: "Nombre de usuario actualizado con éxito.", newName: trimmedNewName });
        } else {
            // Esto podría pasar si el userId no existe
            res.status(404).json({ message: "No se pudo actualizar el nombre (usuario no encontrado)." });
        }
    } catch (error) {
        console.error("[API UpdateName] Error SQL o del servidor:", error.message, error.stack);
        res.status(500).json({ message: "Error al actualizar el nombre de usuario." });
    }
});


module.exports = router;