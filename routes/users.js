// routes/users.js
const express = require('express');
const sharp = require('sharp'); // <--- AÑADE ESTA LÍNEA
const path = require('path');
const db = require('../db');
// fs ya no es necesario para guardar archivos, pero podría usarse si necesitaras
// leer archivos locales por alguna otra razón, o para funciones de limpieza muy específicas.
// Por ahora, lo comentaremos o eliminaremos si no se usa en otras partes de este archivo.
// const fs = require('fs'); 
const multer = require('multer');
const AWS = require('aws-sdk'); // SDK de AWS para S3

const router = express.Router();

// --- Configuración de AWS S3 ---
// El SDK tomará las credenciales y la región de las variables de entorno:
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION
// Si AWS_S3_REGION no está en las variables de entorno, puedes configurarlo aquí:
// AWS.config.update({ region: 'tu-region-s3' }); 
// Configuración final para tu caso específico:
const s3 = new AWS.S3({
    endpoint: `https://6a89aca97a00cbb0cb5581f6997a05c9.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'auto',
});

// --- Configuración de Multer para guardar en memoria ---
const memoryStorage = multer.memoryStorage(); // Los archivos se guardan en req.file.buffer

const fileFilterConfig = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true); // Aceptar archivo
    } else {
        cb(new Error('Formato de archivo no permitido. Solo se aceptan JPEG, PNG, GIF.'), false); // Rechazar archivo
    }
};

// Middleware de Multer para procesar la subida del archivo en memoria
const uploadToMemory = multer({
    storage: memoryStorage,
    fileFilter: fileFilterConfig,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});


// --- FUNCIÓN AUXILIAR PARA ELIMINAR OBJETOS DE S3 ---
// --- FUNCIÓN AUXILIAR PARA ELIMINAR OBJETOS DE S3 (REFINADA) ---
async function deleteFromS3(fileUrlOrKey) {
    if (!fileUrlOrKey || typeof fileUrlOrKey !== 'string' || !fileUrlOrKey.trim()) {
        console.warn("[S3 Delete] Se proporcionó una URL o clave inválida/vacía para eliminar:", fileUrlOrKey);
        return; // No intentar eliminar si no hay una URL/clave válida
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        console.error("[S3 Delete] Error: AWS_S3_BUCKET_NAME no está definido en las variables de entorno.");
        return;
    }

    let keyToDelete = fileUrlOrKey;
    let isLikelyUrl = fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://');
    
    if (isLikelyUrl) {
        try {
            const urlObject = new URL(fileUrlOrKey);
            let hostname = urlObject.hostname; // ej. "mi-bucket.s3.us-east-1.amazonaws.com" o "s3.us-east-1.amazonaws.com"
            let pathname = urlObject.pathname;   // ej. "/mi-bucket/profile_pics/img.jpg" o "/profile_pics/img.jpg"

            // Remover el '/' inicial del pathname si existe
            if (pathname.startsWith('/')) {
                pathname = pathname.substring(1);
            }

            // Comprobar si el bucket name está en el hostname (estilo virtual-hosted)
            // o si está al inicio del pathname (estilo path-style, menos común para nuevas URLs)
            if (hostname.startsWith(bucketName + '.')) { // Virtual-hosted style
                keyToDelete = decodeURIComponent(pathname);
            } else if (pathname.startsWith(bucketName + '/')) { // Path-style
                keyToDelete = decodeURIComponent(pathname.substring(bucketName.length + 1));
            } else {
                // Si no coincide con los patrones comunes para ESTE bucket,
                // podría ser una URL a otro recurso o una clave que se parece a una URL.
                // Asumimos que si es una URL pero no de nuestro bucket, no la procesamos
                // o si es una clave que casualmente empieza con http (muy raro).
                // Por seguridad, si no podemos identificarla claramente como una URL de nuestro bucket,
                // y NO es la clave literal que esperamos, no la modificamos.
                // Si la URL no contiene el nombre de nuestro bucket en host o path, es sospechoso.
                // En este punto, keyToDelete sigue siendo fileUrlOrKey. Si no es una URL de S3
                // reconocida para este bucket, y tampoco es directamente una clave,
                // la operación podría fallar o actuar sobre una clave incorrecta.
                // Una heurística adicional: si después de quitar el protocolo, no queda un path
                // que pueda ser una clave, o si no contiene amazonaws.com, etc.
                // Aquí, una aproximación conservadora es no modificarla si no estamos seguros.
                // La lógica original que tenías para extraer de patrones podría ser más específica.
                // Por ahora, si es una URL, `new URL().pathname` decodificado es un buen punto de partida.
                keyToDelete = decodeURIComponent(pathname); // La parte del path decodificada
                console.log(`[S3 Delete] La URL "${fileUrlOrKey}" no coincidió con patrones de bucket específicos, usando pathname decodificado: "${keyToDelete}"`);
            }
        } catch (e) {
            console.warn("[S3 Delete] No se pudo parsear como URL, se asumirá que es una clave de objeto:", fileUrlOrKey, e.message);
            // keyToDelete ya es fileUrlOrKey, lo cual es correcto si no es una URL
        }
    }
    // En este punto, keyToDelete debería ser la clave del objeto, ya sea porque se extrajo
    // de una URL o porque fileUrlOrKey era la clave directamente.

    if (!keyToDelete.trim()) {
        console.warn("[S3 Delete] Clave vacía después del procesamiento, no se eliminará. Original:", fileUrlOrKey);
        return;
    }

    const params = {
        Bucket: bucketName,
        Key: keyToDelete // Usar la clave procesada
    };

    console.log(`[S3 Delete] Intentando eliminar objeto de S3 con Key: "${params.Key}" en Bucket: "${params.Bucket}"`);

    try {
        await s3.deleteObject(params).promise();
        console.log(`[S3 Delete] Operación de eliminación para el archivo "${keyToDelete}" enviada exitosamente a S3.`);
        // Nota: El éxito aquí significa que la API aceptó la solicitud.
        // S3 tiene consistencia eventual para las eliminaciones.
    } catch (error) {
        console.error(`[S3 Delete] Error al enviar la operación de eliminación para "${keyToDelete}" a S3:`, error.code, error.message, error.stack);
        // Aquí podrías querer relanzar el error o manejarlo de otra forma si es crítico
        // que la eliminación falle. Por ahora, solo lo logueamos.
    }
}


// --- ENDPOINTS DE SUBIDA DE IMÁGENES (AJUSTES MENORES EN LA LLAMADA A DELETE) ---
router.post('/upload/profile-photo', uploadToMemory.single('profileImage'), async (req, res) => {
    // ... (código de validación y preparación de s3UploadParams como antes) ...
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ message: "Falta el ID del usuario." });

    // 1. Crear el nombre del archivo final con extensión .webp
    const s3FileKey = `profile_pics/${userId}-${Date.now()}.webp`;

    try { // <-- El try/catch debe empezar aquí
        // 2. Procesar la imagen con Sharp
        const processedImageBuffer = await sharp(req.file.buffer)
            .resize({ width: 250, height: 250, fit: 'cover' }) // Un buen tamaño para fotos de perfil
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Definir los parámetros de subida con la imagen procesada
        const s3UploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: s3FileKey,
            Body: processedImageBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        };
        
        // 4. Subir el archivo y continuar con la lógica...
        await s3.upload(s3UploadParams).promise();
    
        // Construimos la URL pública nosotros mismos (esta es la corrección)
        const imageUrl = `${process.env.PUBLIC_R2_URL}/${s3FileKey}`

        const oldPicResult = await db.query('SELECT "profilePhotoPath" FROM users WHERE "userId" = $1', [userId]);
        
        // Lógica de eliminación de la imagen antigua
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].profilePhotoPath) {
            const oldImageUrl = oldPicResult.rows[0].profilePhotoPath;
            // Solo eliminar si la URL antigua es diferente de la nueva y no es un placeholder
            if (oldImageUrl && oldImageUrl !== imageUrl && !oldImageUrl.endsWith('placeholder-profile.jpg') && !oldImageUrl.endsWith('placeholder-cover.jpg')) {
                console.log(`[UploadProfilePhoto] Se reemplazará la imagen antigua: ${oldImageUrl}`);
                await deleteFromS3(oldImageUrl); // Pasar la URL completa o la clave
            }
        }

        const updateDbResult = await db.query('UPDATE users SET "profilePhotoPath" = $1 WHERE "userId" = $2', [imageUrl, userId]);
        
        if (updateDbResult.rowCount > 0) {
            res.json({ message: "Foto de perfil actualizada.", filePath: imageUrl });
        } else {
            console.warn(`[API UploadProfilePhoto S3] La BD no se actualizó para ${userId}. Archivo ${s3FileKey} subido. Intentando eliminar de S3.`);
            await deleteFromS3(s3FileKey); // Usar s3FileKey aquí porque es la clave del objeto recién subido
            res.status(404).json({ message: "Usuario no encontrado para actualizar foto." });
        }
    } catch (error) {
        console.error("[API UploadProfilePhoto S3] Error:", error);
        res.status(500).json({ message: "Error interno al actualizar la foto de perfil." });
    }
});

router.post('/upload/cover-photo', uploadToMemory.single('coverImage'), async (req, res) => {
    // ... (código de validación y preparación de s3UploadParams como antes) ...
    if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo o el tipo no es válido.' });
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ message: "Falta el ID del usuario." });

    // 1. Crear el nombre del archivo final con extensión .webp
    const s3FileKey = `cover_pics/${userId}-${Date.now()}.webp`;

    try { // <-- El try/catch debe empezar aquí
        // 2. Procesar la imagen con Sharp
        const processedImageBuffer = await sharp(req.file.buffer)
            .resize({ width: 1200, withoutEnlargement: true }) // Ancho máximo de 1200px para portadas
            .webp({ quality: 75 })
            .toBuffer();

        // 3. Definir los parámetros de subida con la imagen procesada
        const s3UploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: s3FileKey,
            Body: processedImageBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        };
        
        // 4. Subir el archivo y continuar...
        await s3.upload(s3UploadParams).promise();
        const imageUrl = `${process.env.PUBLIC_R2_URL}/${s3FileKey}`;

        const oldPicResult = await db.query('SELECT "coverPhotoPath" FROM users WHERE "userId" = $1', [userId]);
        if (oldPicResult.rows.length > 0 && oldPicResult.rows[0].coverPhotoPath) {
            const oldImageUrl = oldPicResult.rows[0].coverPhotoPath;
            if (oldImageUrl && oldImageUrl !== imageUrl && !oldImageUrl.endsWith('placeholder-cover.jpg') && !oldImageUrl.endsWith('placeholder-profile.jpg')) {
                console.log(`[UploadCoverPhoto] Se reemplazará la imagen antigua: ${oldImageUrl}`);
                await deleteFromS3(oldImageUrl);
            }
        }

        const updateDbResult = await db.query('UPDATE users SET "coverPhotoPath" = $1 WHERE "userId" = $2', [imageUrl, userId]);
        
        if (updateDbResult.rowCount > 0) {
            res.json({ message: "Foto de portada actualizada.", filePath: imageUrl });
        } else {
            console.warn(`[API UploadCoverPhoto S3] La BD no se actualizó para ${userId}. Archivo ${s3FileKey} subido. Intentando eliminar de S3.`);
            await deleteFromS3(s3FileKey); // Usar s3FileKey aquí
            res.status(404).json({ message: "Usuario no encontrado para actualizar foto." });
        }
    } catch (error) {
        console.error("[API UploadCoverPhoto S3] Error:", error);
        res.status(500).json({ message: "Error interno al actualizar la foto de portada." });
    }
});

// --- ENDPOINTS DE ACCIÓN SOCIAL --- (Sin cambios, se mantienen como estaban)
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

// --- ENDPOINT PARA ACTUALIZAR NOMBRE --- (Sin cambios)
router.put('/update-name', async (req, res) => {
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

// --- FUNCIÓN AUXILIAR PARA PROCESAR DATOS DEL USUARIO (SEGUIMIENTO Y RANGO) --- (Sin cambios)
const processUserRowWithFollowData = async (dbPool, userRow, viewerId) => {
    // ... (código de esta función sin cambios) ...
    if (!userRow) return null;
    const userIdFromRow = userRow.userId; 

    if (!userIdFromRow) {
        console.error("processUserRowWithFollowData: userId no encontrado en userRow:", userRow);
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
            promises.push(Promise.resolve({ rows: [{ count: 0 }] }));
        }
        const [followersRes, followingRes, rankRes, isFollowingResOrPlaceholder] = await Promise.all(promises);
        processedUser.followersCount = parseInt(followersRes.rows[0]?.count, 10) || 0;
        processedUser.followingCount = parseInt(followingRes.rows[0]?.count, 10) || 0;
        processedUser.rank = rankRes.rows[0] ? parseInt(rankRes.rows[0].rank, 10) : null;
        processedUser.isFollowing = (parseInt(isFollowingResOrPlaceholder.rows[0]?.count, 10) || 0) > 0;
    } catch (error) {
        console.error(`Error procesando datos adicionales para usuario ${userIdFromRow}:`, error.message);
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


// GET /api/user/:userId/posts - Obtener las publicaciones de un usuario específico
router.get('/:userId/posts', async (req, res) => {
    const profileUserId = req.params.userId; // El ID del perfil cuyas publicaciones queremos
    const viewerId = req.query.viewerId;     // El ID del usuario que está viendo (opcional, para estado de like/save)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // Un límite más pequeño para perfiles
    const offset = (page - 1) * limit;

    try {
        // Reutilizamos una consulta similar a la de /api/posts pero filtrada por user_id
        const postsQuery = `
            SELECT 
                p.post_id, p.content, p.image_url, p.created_at, p.updated_at,
                u."userId" AS author_user_id, u.pushname AS author_pushname, u."profilePhotoPath" AS author_profile_photo_path,
                (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.reaction_type = 'like') AS like_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
                ${viewerId ? `EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.user_id = $4 AND pr.reaction_type = 'like') AS liked_by_viewer,` : 'FALSE AS liked_by_viewer,'}
                ${viewerId ? `EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.post_id AND sp.user_id = $4) AS saved_by_viewer` : 'FALSE AS saved_by_viewer'}
            FROM posts p
            JOIN users u ON p.user_id = u."userId"
            WHERE p.user_id = $1 -- Filtro clave aquí
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3;
        `;
        const queryParams = viewerId ? [profileUserId, limit, offset, viewerId] : [profileUserId, limit, offset];
        const result = await db.query(postsQuery, queryParams);
        
        res.json(result.rows);

    } catch (error) {
        console.error(`[API GET /user/${profileUserId}/posts] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener las publicaciones del usuario." });
    }
});

// GET /api/user/:userId/saved-posts - Obtener las publicaciones guardadas por un usuario
router.get('/:userId/saved-posts', async (req, res) => {
    const profileUserId = req.params.userId; // El ID del usuario cuyas publicaciones guardadas queremos
    const viewerId = req.query.viewerId;     // El ID del usuario que está viendo (para like/save en estas guardadas)
                                            // Importante: El viewerId aquí es crucial para saber si el viewer
                                            // también ha likeado/guardado estos posts individualmente.
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Solo el propio usuario puede ver sus posts guardados
    if (!viewerId || viewerId !== profileUserId) {
        // Si no hay viewerId o no coincide con profileUserId, no permitir ver.
        // O, si es el perfil de otro, simplemente no mostrar la pestaña de "Guardado" en el frontend.
        // Aquí, si se intenta acceder directamente al endpoint y no es el dueño, retornar error.
        return res.status(403).json({ message: "No tienes permiso para ver esta sección." });
    }

    try {
        const savedPostsQuery = `
            SELECT 
                p.post_id, p.content, p.image_url, p.created_at AS post_created_at, p.updated_at AS post_updated_at,
                u."userId" AS author_user_id, u.pushname AS author_pushname, u."profilePhotoPath" AS author_profile_photo_path,
                (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.reaction_type = 'like') AS like_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
                EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.user_id = $1 AND pr.reaction_type = 'like') AS liked_by_viewer,
                TRUE AS saved_by_viewer -- Si está en esta lista, es porque el viewer (que es el profileUserId) la guardó
            FROM posts p
            JOIN users u ON p.user_id = u."userId"
            JOIN saved_posts sp ON p.post_id = sp.post_id
            WHERE sp.user_id = $1 -- Publicaciones guardadas por profileUserId (que es el viewerId en este caso)
            ORDER BY sp.created_at DESC -- Ordenar por cuándo se guardaron
            LIMIT $2 OFFSET $3;
        `;
        // Pasamos profileUserId (que es igual a viewerId en este caso) dos veces
        const result = await db.query(savedPostsQuery, [profileUserId, limit, offset]);
        
        res.json(result.rows);

    } catch (error) {
        console.error(`[API GET /user/${profileUserId}/saved-posts] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener las publicaciones guardadas." });
    }
});
module.exports = router;