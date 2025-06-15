// routes/spotify.js
const express = require('express');
const querystring = require('querystring');
const axios = require('axios');
const db = require('../db');
// Importa SOLO la función que necesitas del servicio
const { fetchSpotifyActivityForBackend } = require('../services/spotifyService'); // Ajusta la ruta si es diferente

const router = express.Router();

// Estas constantes son usadas por las rutas /login y /callback
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

const requiredScopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-read-recently-played'
].join(' ');

const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const stateKey = 'spotify_auth_state';
const appUserIdKey = 'spotify_app_user_id';

// 1. Ruta para Iniciar el proceso de autenticación de Spotify
router.get('/login', (req, res) => {
    const { app_user_id } = req.query;
    if (!app_user_id) {
        return res.status(400).send('User ID de la aplicación es requerido. <a href="/profile.html">Volver al perfil</a>');
    }
    const state = generateRandomString(16);
    res.cookie(stateKey, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.cookie(appUserIdKey, app_user_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });

    const authUrl = `${SPOTIFY_ACCOUNTS_URL}/authorize?` +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID, // Usado aquí
            scope: requiredScopes,
            redirect_uri: REDIRECT_URI, // Usado aquí
            state: state,
            show_dialog: true
        });
    res.redirect(authUrl);
});

// 2. Ruta de Callback de Spotify después de la autorización
router.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;
    const appUserId = req.cookies ? req.cookies[appUserIdKey] : null;

    res.clearCookie(stateKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.clearCookie(appUserIdKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });

    if (state === null || state !== storedState) {
        console.error("[SpotifyRouter] Callback Error: State mismatch.");
        return res.redirect('/profile.html?spotify_error=state_mismatch');
    }
    if (!appUserId) {
        console.error("[SpotifyRouter] Callback Error: App User ID missing from cookie.");
        return res.redirect('/profile.html?spotify_error=app_user_id_missing');
    }
    if (!code) {
        const errorDescription = req.query.error || 'Authorization denied or code missing.';
        console.error(`[SpotifyRouter] Callback Error: Code missing or explicit error: ${errorDescription}`);
        return res.redirect(`/profile.html?spotify_error=${encodeURIComponent(errorDescription)}`);
    }

    try {
        // Intercambiar el código por tokens
        const tokenResponse = await axios({
            method: 'post',
            url: `${SPOTIFY_ACCOUNTS_URL}/api/token`,
            data: querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI // Usado aquí
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')) // Usado aquí
            }
        });

        const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        // Obtener información del perfil de Spotify del usuario
        const userProfileResponse = await axios.get(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const spotifyUserData = userProfileResponse.data;

        // Comprobar si el spotify_user_id ya está vinculado a OTRO user_app_id
        const checkSpotifyIdSql = `SELECT user_app_id FROM user_spotify_details WHERE spotify_user_id = $1 AND user_app_id != $2`;
        const checkResult = await db.query(checkSpotifyIdSql, [spotifyUserData.id, appUserId]);
        if (checkResult.rows.length > 0) {
            console.warn(`[SpotifyRouter] Spotify account ${spotifyUserData.id} already linked to app user ${checkResult.rows[0].user_app_id}. Current attempt by ${appUserId}.`);
            return res.redirect(`/profile.html?spotify_error=spotify_account_already_linked_to_another_app_user`);
        }

        // Guardar/Actualizar tokens y datos de Spotify en user_spotify_details
        const upsertSpotifyDetailsSql = `
            INSERT INTO user_spotify_details (
                user_app_id, spotify_user_id, spotify_access_token, spotify_refresh_token,
                spotify_token_expires_at, spotify_scopes, spotify_display_name,
                spotify_profile_image_url, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (user_app_id) DO UPDATE SET
                spotify_user_id = EXCLUDED.spotify_user_id,
                spotify_access_token = EXCLUDED.spotify_access_token,
                spotify_refresh_token = EXCLUDED.spotify_refresh_token,
                spotify_token_expires_at = EXCLUDED.spotify_token_expires_at,
                spotify_scopes = EXCLUDED.spotify_scopes,
                spotify_display_name = EXCLUDED.spotify_display_name,
                spotify_profile_image_url = EXCLUDED.spotify_profile_image_url,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await db.query(upsertSpotifyDetailsSql, [
            appUserId, spotifyUserData.id, access_token, refresh_token, expiresAt,
            scope, spotifyUserData.display_name, spotifyUserData.images?.[0]?.url
        ]);
        console.log(`[SpotifyRouter] Spotify details for app user ${appUserId} (Spotify ID: ${spotifyUserData.id}) upserted.`);
        res.redirect('/profile.html?spotify_linked=true');

    } catch (error) {
        console.error('[SpotifyRouter] Error in Spotify callback:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message, error.stack ? error.stack.substring(0, 500) : '');
        const errorMessage = error.response?.data?.error_description || error.response?.data?.error || error.message || 'callback_failed';
        res.redirect(`/profile.html?spotify_error=${encodeURIComponent(errorMessage)}`);
    }
});

// La función refreshAccessToken ahora reside en spotifyService.js y es llamada desde allí.

// 3. Ruta para obtener actividad musical de usuarios vinculados (ahora usa el servicio)
router.get('/users-activity', async (req, res) => {
    try {
        const activityData = await fetchSpotifyActivityForBackend();
        res.json(activityData);
    } catch (error) {
        // El error ya debería estar logueado por la función del servicio si ocurrió allí
        console.error('[SpotifyRouter /users-activity] Error al obtener actividad de Spotify:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener actividad de Spotify.' });
    }
});

// 4. Ruta para desvincular Spotify
router.post('/unlink', async (req, res) => {
    const { app_user_id } = req.body; // En una app real, esto vendría de req.user.userId (sesión/token)
    if (!app_user_id) {
        return res.status(400).json({ message: "User ID de la aplicación es requerido." });
    }
    try {
        const result = await db.query(
            `DELETE FROM user_spotify_details WHERE user_app_id = $1`,
            [app_user_id]
        );
        if (result.rowCount > 0) {
            console.log(`[SpotifyRouter] Spotify account unlinked for app user: ${app_user_id}`);
            res.json({ message: "Cuenta de Spotify desvinculada exitosamente." });
        } else {
            console.log(`[SpotifyRouter] No Spotify account found to unlink for app user: ${app_user_id}`);
            res.status(404).json({ message: "No se encontró una cuenta de Spotify vinculada para este usuario." });
        }
    } catch (error) {
        console.error(`[SpotifyRouter] Error unlinking Spotify for app user ${app_user_id}:`, error.message, error.stack);
        res.status(500).json({ message: "Error al desvincular la cuenta de Spotify." });
    }
});

module.exports = router;