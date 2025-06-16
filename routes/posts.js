// routes/posts.js
const express = require('express');
const db = require('../db');
const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');

const router = express.Router();

// --- Configuración de Multer y S3 (similar a users.js) ---
const memoryStorage = multer.memoryStorage();
const fileFilterConfig = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no permitido para publicación. Solo JPEG, PNG, GIF.'), false);
    }
};
const uploadToMemory = multer({
    storage: memoryStorage,
    fileFilter: fileFilterConfig,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB para imágenes de posts
});
const s3 = new AWS.S3();

// --- ENDPOINTS PARA PUBLICACIONES ---

// GET /api/posts - Obtener todas las publicaciones (con paginación opcional)
router.get('/', async (req, res) => {
    const viewerId = req.query.viewerId; // ID del usuario que está viendo, para saber si ha reaccionado/guardado
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const postsQuery = `
            SELECT 
                p.post_id, p.content, p.image_url, p.created_at, p.updated_at,
                u."userId" AS author_user_id, u.pushname AS author_pushname, u."profilePhotoPath" AS author_profile_photo_path,
                (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.reaction_type = 'like') AS like_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
                ${viewerId ? `EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.post_id AND pr.user_id = $3 AND pr.reaction_type = 'like') AS liked_by_viewer,` : 'FALSE AS liked_by_viewer,'}
                ${viewerId ? `EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.post_id AND sp.user_id = $3) AS saved_by_viewer` : 'FALSE AS saved_by_viewer'}
            FROM posts p
            JOIN users u ON p.user_id = u."userId"
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2;
        `;
        const queryParams = viewerId ? [limit, offset, viewerId] : [limit, offset];
        const result = await db.query(postsQuery, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error("[API GET /posts] Error:", error.message, error.stack);
        res.status(500).json({ message: "Error al obtener las publicaciones." });
    }
});

// POST /api/posts - Crear una nueva publicación
router.post('/', uploadToMemory.single('postImage'), async (req, res) => {
    const { userId, content } = req.body; // userId del autor de la publicación

    if (!userId || !content) {
        return res.status(400).json({ message: "El ID de usuario y el contenido son requeridos." });
    }

    let imageUrl = null;
    if (req.file) {
        const fileExtension = path.extname(req.file.originalname);
        const s3FileKey = `post_images/${userId}-${Date.now()}${fileExtension}`;
        const s3UploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: s3FileKey, Body: req.file.buffer,
            ContentType: req.file.mimetype, ACL: 'public-read'
        };
        try {
            const s3UploadResult = await s3.upload(s3UploadParams).promise();
            imageUrl = s3UploadResult.Location;
        } catch (s3Error) {
            console.error("[API POST /posts] Error subiendo imagen a S3:", s3Error);
            return res.status(500).json({ message: "Error al subir la imagen de la publicación." });
        }
    }

    try {
        const sql = 'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING *';
        const result = await db.query(sql, [userId, content, imageUrl]);
        const newPost = result.rows[0];

        // Para devolver el post con la info del autor inmediatamente
        const authorQuery = 'SELECT "userId", pushname, "profilePhotoPath" FROM users WHERE "userId" = $1';
        const authorResult = await db.query(authorQuery, [newPost.user_id]);

        res.status(201).json({
            ...newPost,
            author_user_id: authorResult.rows[0].userId,
            author_pushname: authorResult.rows[0].pushname,
            author_profile_photo_path: authorResult.rows[0].profilePhotoPath,
            like_count: 0,
            comment_count: 0,
            liked_by_viewer: false, // El autor no se auto-likea al crear
            saved_by_viewer: false
        });
    } catch (error) {
        console.error("[API POST /posts] Error creando publicación:", error.message, error.stack);
        res.status(500).json({ message: "Error al crear la publicación." });
    }
});


// POST /api/posts/:postId/react - Reaccionar a una publicación
router.post('/:postId/react', async (req, res) => {
    const { postId } = req.params;
    const { userId, reactionType = 'like' } = req.body; // userId del que reacciona

    if (!userId) return res.status(400).json({ message: "Falta el ID del usuario." });

    try {
        // Verificar si ya existe la reacción
        const checkSql = 'SELECT reaction_id FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3';
        const checkResult = await db.query(checkSql, [postId, userId, reactionType]);

        if (checkResult.rows.length > 0) { // Si existe, la eliminamos (toggle off)
            const deleteSql = 'DELETE FROM post_reactions WHERE reaction_id = $1';
            await db.query(deleteSql, [checkResult.rows[0].reaction_id]);
            res.json({ message: "Reacción eliminada.", reacted: false });
        } else { // Si no existe, la añadimos (toggle on)
            const insertSql = 'INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)';
            await db.query(insertSql, [postId, userId, reactionType]);
            res.json({ message: "Reacción añadida.", reacted: true });
        }
    } catch (error) {
        console.error(`[API POST /posts/${postId}/react] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al procesar la reacción." });
    }
});

// POST /api/posts/:postId/save - Guardar/Desguardar una publicación
router.post('/:postId/save', async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body; // userId del que guarda

    if (!userId) return res.status(400).json({ message: "Falta el ID del usuario." });

    try {
        const checkSql = 'SELECT saved_post_id FROM saved_posts WHERE post_id = $1 AND user_id = $2';
        const checkResult = await db.query(checkSql, [postId, userId]);

        if (checkResult.rows.length > 0) {
            const deleteSql = 'DELETE FROM saved_posts WHERE saved_post_id = $1';
            await db.query(deleteSql, [checkResult.rows[0].saved_post_id]);
            res.json({ message: "Publicación desguardada.", saved: false });
        } else {
            const insertSql = 'INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2)';
            await db.query(insertSql, [postId, userId]);
            res.json({ message: "Publicación guardada.", saved: true });
        }
    } catch (error) {
        console.error(`[API POST /posts/${postId}/save] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al guardar/desguardar la publicación." });
    }
});


// GET /api/posts/:postId/comments - Obtener comentarios de una publicación
router.get('/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    try {
        const sql = `
            SELECT 
                c.comment_id, c.parent_comment_id, c.content, c.created_at,
                u."userId" AS author_user_id, u.pushname AS author_pushname, u."profilePhotoPath" AS author_profile_photo_path
            FROM comments c
            JOIN users u ON c.user_id = u."userId"
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC; -- Importante para construir el árbol correctamente
        `;
        const result = await db.query(sql, [postId]);

        // Lógica simple para anidar respuestas (se puede mejorar para multinivel profundo)
        const commentsMap = {};
        const rootComments = [];
        result.rows.forEach(comment => {
            comment.replies = [];
            commentsMap[comment.comment_id] = comment;
            if (comment.parent_comment_id) {
                if (commentsMap[comment.parent_comment_id]) {
                    commentsMap[comment.parent_comment_id].replies.push(comment);
                } else {
                    // Comentario padre aún no procesado o no existe (huérfano), añadir a raíz temporalmente
                    rootComments.push(comment);
                }
            } else {
                rootComments.push(comment);
            }
        });
        res.json(rootComments);
    } catch (error) {
        console.error(`[API GET /posts/${postId}/comments] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al obtener los comentarios." });
    }
});

// POST /api/posts/:postId/comments - Añadir un comentario
router.post('/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    const { userId, content, parentCommentId } = req.body;

    if (!userId || !content) {
        return res.status(400).json({ message: "Faltan datos para el comentario." });
    }
    try {
        const sql = 'INSERT INTO comments (post_id, user_id, content, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await db.query(sql, [postId, userId, content, parentCommentId || null]);
        const newComment = result.rows[0];

        const authorQuery = 'SELECT "userId", pushname, "profilePhotoPath" FROM users WHERE "userId" = $1';
        const authorResult = await db.query(authorQuery, [newComment.user_id]);
        
        res.status(201).json({
            ...newComment,
            author_user_id: authorResult.rows[0].userId,
            author_pushname: authorResult.rows[0].pushname,
            author_profile_photo_path: authorResult.rows[0].profilePhotoPath,
            replies: [] // Un nuevo comentario no tiene respuestas aún
        });
    } catch (error) {
        console.error(`[API POST /posts/${postId}/comments] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al añadir el comentario." });
    }
});


// DELETE /api/posts/:postId - Eliminar una publicación
router.delete('/:postId', async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body; // ID del usuario que intenta eliminar (debería venir del frontend)

    // En una aplicación real, obtendrías el userId de la sesión/token JWT
    // y no confiarías en el que envía el cliente en el body para la autorización.
    // Por ahora, lo usaremos para la demostración.

    if (!userId) {
        return res.status(400).json({ message: "Falta el ID del usuario para la autorización." });
    }

    try {
        // 1. Verificar que el post existe y que el usuario es el autor
        const postCheckSql = 'SELECT user_id, image_url FROM posts WHERE post_id = $1';
        const postCheckResult = await db.query(postCheckSql, [postId]);

        if (postCheckResult.rows.length === 0) {
            return res.status(404).json({ message: "Publicación no encontrada." });
        }

        const postData = postCheckResult.rows[0];
        if (postData.user_id !== userId) {
            return res.status(403).json({ message: "No tienes permiso para eliminar esta publicación." });
        }

        // (Opcional pero recomendado) Si la publicación tiene una imagen en S3, eliminarla
        if (postData.image_url) {
            // Asumiendo que tienes una función deleteFromS3 similar a la de users.js
            // Si no, necesitarías importarla o recrearla aquí.
            // Por simplicidad, la lógica de extracción de clave de S3 se omite aquí,
            // asumiendo que deleteFromS3 puede manejar la URL completa.
            try {
                // Necesitas una función para extraer la clave de S3 de la URL
                const s3Key = extractS3KeyFromUrl(postData.image_url); // Implementa esta función
                if (s3Key) {
                    const s3 = new AWS.S3();
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key
                    }).promise();
                    console.log(`[API DELETE /posts/${postId}] Imagen ${s3Key} eliminada de S3.`);
                }
            } catch (s3Error) {
                console.error(`[API DELETE /posts/${postId}] Error eliminando imagen de S3 ${postData.image_url}:`, s3Error);
                // Continuar con la eliminación del post de la BD incluso si falla la de S3,
                // pero loguear el error es importante.
            }
        }

        // 2. Eliminar el post de la base de datos
        // La eliminación en cascada configurada en la BD debería encargarse de
        // comentarios, reacciones y guardados asociados.
        const deleteSql = 'DELETE FROM posts WHERE post_id = $1';
        await db.query(deleteSql, [postId]);

        res.json({ message: "Publicación eliminada exitosamente." });

    } catch (error) {
        console.error(`[API DELETE /posts/${postId}] Error:`, error.message, error.stack);
        res.status(500).json({ message: "Error al eliminar la publicación." });
    }
});


// Función auxiliar para extraer la clave S3 de una URL (simplificada)
// Necesitarás adaptarla a la estructura de tus URLs de S3
function extractS3KeyFromUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
        const url = new URL(imageUrl);
        // Ejemplo: https://mi-bucket.s3.region.amazonaws.com/post_images/image.jpg -> post_images/image.jpg
        // Esto es una simplificación, ajusta según tu estructura de bucket y path
        if (url.hostname.includes('s3') && url.hostname.includes('amazonaws.com')) {
            // Quita el primer '/' del pathname
            return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        }
    } catch (e) {
        console.warn("No se pudo parsear la URL de S3 para extraer la clave:", imageUrl, e);
    }
    return null; // O devuelve la URL original si no es un patrón S3 conocido
}


module.exports = router;