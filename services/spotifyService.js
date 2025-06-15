// services/spotifyService.js
const https = require('https'); // Añade esto al inicio de spotifyService.js

const axios = require('axios');
const db = require('../db'); // Asegúrate que la ruta a tu db.js sea correcta
const querystring = require('querystring'); // Necesario para el cuerpo de la petición de token

// Estas constantes se toman de las variables de entorno
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

/**
 * Refresca un access token de Spotify usando un refresh token.
 * @param {string} appUserId - El ID del usuario en tu aplicación (users."userId").
 * @param {string} currentRefreshToken - El refresh token actual del usuario.
 * @returns {Promise<string>} - El nuevo access token.
 * @throws {Error} - Si el refresco falla.
 */
async function refreshAccessToken(appUserId, currentRefreshToken) {
    console.log(`[SpotifyService] Attempting to refresh Spotify token for app user: ${appUserId}`);
    // console.log("[SpotifyService][RefreshDebug] CLIENT_ID:", CLIENT_ID); 
    // console.log("[SpotifyService][RefreshDebug] CLIENT_SECRET:", CLIENT_SECRET ? CLIENT_SECRET.substring(0, 5) + '...' : 'NOT SET'); 

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("[SpotifyService][RefreshDebug] FATAL: CLIENT_ID o CLIENT_SECRET no están definidos en las variables de entorno.");
        throw new Error("Configuración de cliente de Spotify incompleta en el servidor.");
    }
    if (!currentRefreshToken) {
        console.error(`[SpotifyService][RefreshDebug] FATAL: currentRefreshToken es nulo o undefined para appUserId: ${appUserId}`);
        throw new Error("No se proporcionó un refresh token válido para el usuario.");
    }


    try {
        const authHeader = 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'));
        
        const response = await axios({
            method: 'post',
            url: `${SPOTIFY_ACCOUNTS_URL}/api/token`,
            data: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: currentRefreshToken
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader
            }
        });

        const { access_token, expires_in, scope, refresh_token: new_refresh_token_from_spotify } = response.data;
        const newExpiresAt = new Date(Date.now() + expires_in * 1000);
        const effectiveRefreshToken = new_refresh_token_from_spotify || currentRefreshToken; // Spotify puede devolver un nuevo refresh token

        await db.query(
            `UPDATE user_spotify_details SET 
                spotify_access_token = $1, 
                spotify_token_expires_at = $2, 
                spotify_scopes = $3, 
                spotify_refresh_token = $4, 
                updated_at = CURRENT_TIMESTAMP
             WHERE user_app_id = $5`,
            [access_token, newExpiresAt, scope, effectiveRefreshToken, appUserId]
        );
        console.log(`[SpotifyService] Spotify token refreshed successfully for app user: ${appUserId}. New expiry: ${newExpiresAt.toISOString()}`);
        return access_token;
    } catch (error) {
        console.error(`[SpotifyService] Error refreshing token for app user ${appUserId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        
        if (error.response && error.response.data && error.response.data.error === 'invalid_client') {
            console.error(`[SpotifyService] FATAL: 'invalid_client' error during token refresh. Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.`);
        }
        else if (error.response && (error.response.status === 400 || error.response.status === 401) && error.response.data.error === 'invalid_grant') {
            console.warn(`[SpotifyService] Invalid grant for app user ${appUserId} (refresh token likely revoked or invalid). Clearing Spotify details from DB.`);
            // Limpiar todos los detalles de Spotify para este usuario, ya que el refresh token es inválido.
            // Esto permitirá al usuario re-autenticarse si lo desea.
            await db.query(
                `UPDATE user_spotify_details SET 
                    spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL, 
                    spotify_user_id = NULL, spotify_scopes = NULL, spotify_display_name = NULL, 
                    spotify_profile_image_url = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE user_app_id = $1`,
                [appUserId]
            );
        }
        throw error; // Re-lanzar el error para que el llamador lo maneje
    }
}

async function fetchSyncedLyricsFromTextyl(trackName, artistName) {
    console.log(`[SpotifyService] Buscando letras sincronizadas en Textyl para: ${trackName} - ${artistName}`);
    try {
        const query = encodeURIComponent(`${artistName} ${trackName}`);
        const agent = new https.Agent({  
            rejectUnauthorized: false // ¡PELIGROSO EN PRODUCCIÓN!
        });
        const response = await axios.get(`https://api.textyl.co/api/lyrics?q=${query}`, { 
            timeout: 7000,
            httpsAgent: agent // Aplicar el agente
        });

        if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
            const syncedLyrics = response.data.map(line => ({
                time: line.seconds * 1000, 
                text: line.lyrics.replace(/\r/g, '').trim() 
            }));
            const validLines = syncedLyrics.filter(l => l.text).sort((a, b) => a.time - b.time);
            if (validLines.length > 0) {
                 console.log(`[SpotifyService] Letras sincronizadas obtenidas de Textyl para ${trackName} (${validLines.length} líneas).`);
                 return validLines;
            } else {
                console.log(`[SpotifyService] Textyl devolvió datos pero sin líneas de letra válidas para ${trackName}.`);
            }
        } else {
            console.log(`[SpotifyService] Textyl no devolvió datos de letra válidos o array vacío para ${trackName}. Status: ${response.status}, Data:`, response.data ? JSON.stringify(response.data).substring(0,100) : 'No data');
        }
    } catch (error) {
        if (error.response) {
            console.warn(`[SpotifyService] Error obteniendo letras de Textyl para ${trackName} - ${artistName}: Status ${error.response.status}`, error.response.data ? JSON.stringify(error.response.data).substring(0,100) : 'No data');
        } else {
            console.warn(`[SpotifyService] Error de red u otro obteniendo letras de Textyl para ${trackName} - ${artistName}:`, error.message);
        }
    }
    return null; 
}


/**
 * Obtiene la actividad de reproducción actual o reciente de todos los usuarios vinculados a Spotify.
 * @returns {Promise<Array<Object>>} - Un array de objetos de actividad de usuario.
 * @throws {Error} - Si hay un error de base deatos al obtener usuarios.
 */
async function fetchSpotifyActivityForBackend() {
    console.log("[SpotifyService] Iniciando fetchSpotifyActivityForBackend...");
    try {
        const usersWithSpotifyQuery = `
            SELECT 
                u."userId", u.pushname, u."profilePhotoPath", 
                spd.spotify_user_id, spd.spotify_access_token, spd.spotify_refresh_token, spd.spotify_token_expires_at
            FROM users u
            JOIN user_spotify_details spd ON u."userId" = spd.user_app_id
            WHERE spd.spotify_user_id IS NOT NULL AND spd.spotify_refresh_token IS NOT NULL; 
            -- Aseguramos que tengamos refresh_token para poder seguir funcionando
        `;
        const usersResult = await db.query(usersWithSpotifyQuery);
        const usersWithSpotify = usersResult.rows;

        if (usersWithSpotify.length === 0) {
            console.log("[SpotifyService] No users with linked Spotify accounts (and refresh tokens) found.");
            return [];
        }
        // console.log(`[SpotifyService] ${usersWithSpotify.length} users con Spotify para verificar actividad.`);

        const activityPromises = usersWithSpotify.map(async (user) => {
            let accessToken = user.spotify_access_token;
            const appUserId = user.userId; // Este es el users."userId"

            // Verificar si el token está expirado o ausente
            const isTokenExpired = !accessToken || (user.spotify_token_expires_at ? new Date(user.spotify_token_expires_at) < new Date() : true);

            if (isTokenExpired) {
                if (user.spotify_refresh_token) {
                    try {
                        // console.log(`[SpotifyService] Token para ${appUserId} expirado o ausente. Intentando refresh...`);
                        accessToken = await refreshAccessToken(appUserId, user.spotify_refresh_token);
                    } catch (refreshError) {
                        // refreshAccessToken ya maneja el log y la limpieza de tokens si 'invalid_grant'
                        // console.error(`[SpotifyService] Fallo al refrescar token para ${appUserId}. Se omite este usuario para esta ronda.`, refreshError.message);
                        return null; // No se pudo obtener un token válido
                    }
                } else {
                    // Esto no debería pasar si la query inicial filtra por spotify_refresh_token IS NOT NULL
                    // console.warn(`[SpotifyService] Token expirado o ausente, y NO HAY refresh token para ${appUserId}, aunque la query debería haberlo filtrado. Limpiando tokens como precaución.`);
                    await db.query('UPDATE user_spotify_details SET spotify_access_token=NULL, spotify_token_expires_at=NULL WHERE user_app_id=$1', [appUserId]);
                    return null; 
                }
            }

            if (!accessToken) { // Si después del intento de refresh, aún no hay token
                //  console.warn(`[SpotifyService] No hay access token válido para ${appUserId} después de intento de refresh (o inicial). Se omite este usuario para esta ronda.`);
                 return null;
            }

            // Intento 1: Obtener el estado completo del reproductor con GET /me/player
            try {
                const playbackStateResponse = await axios.get(`${SPOTIFY_API_URL}/me/player`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    timeout: 7000 // Timeout de 7 segundos para esta petición
                });

                if (playbackStateResponse.status === 200 && playbackStateResponse.data && playbackStateResponse.data.item && playbackStateResponse.data.is_playing) {
                    const currentItem = playbackStateResponse.data.item;
                    const progressMs = playbackStateResponse.data.progress_ms;
                    const durationMs = currentItem.duration_ms;
                    const trackName = currentItem.name;
                    const artistName = currentItem.artists.map(a => a.name).join(', ');
                    
                    // console.log(`[SpotifyService] User ${appUserId}: Reproduciendo activamente - ${trackName} (${progressMs !== undefined ? progressMs : 'N/A'}/${durationMs !== undefined ? durationMs : 'N/A'})`);
                    
                    const syncedLrcData = await fetchSyncedLyricsFromTextyl(trackName, artistName);

                    return {
                        userId: appUserId,
                        pushname: user.pushname,
                        profilePhotoPath: user.profilePhotoPath,
                        isPlaying: true,
                        track: {
                            name: trackName,
                            artist: artistName,
                            album: currentItem.album.name,
                            albumArtUrl: currentItem.album.images?.[0]?.url,
                            url: currentItem.external_urls?.spotify,
                            progress_ms: progressMs,
                            duration_ms: durationMs,
                            timestamp: Date.now(), // Timestamp de cuando el servidor obtuvo estos datos
                            syncedLyrics: syncedLrcData
                        },
                        status: 'currently_playing'
                    };
                } else if (playbackStateResponse.status === 200 || playbackStateResponse.status === 204) {
                    //  console.log(`[SpotifyService] User ${appUserId}: No hay pista activa desde /me/player (status: ${playbackStateResponse.status}). Se intentará fallback a recently-played.`);
                }
            } catch (playerError) {
                if (playerError.response) {
                    if (playerError.response.status === 403 && playerError.response.data?.error?.reason === 'PREMIUM_REQUIRED') {
                        // console.warn(`[SpotifyService] User ${appUserId}: Premium requerido para /me/player. Se intentará fallback a recently-played.`);
                    } else if (playerError.response.status === 401) {
                        // console.warn(`[SpotifyService] Spotify API (/me/player) devolvió 401 para ${appUserId}. Limpiando tokens y omitiendo.`);
                        await db.query('UPDATE user_spotify_details SET spotify_access_token=NULL, spotify_token_expires_at=NULL WHERE user_app_id=$1', [appUserId]);
                        return null; 
                    } else {
                        // console.error(`[SpotifyService] Error obteniendo /me/player para ${appUserId}: Status ${playerError.response.status}`, JSON.stringify(playerError.response.data));
                    }
                } else { 
                    // console.error(`[SpotifyService] Error de red u otro al obtener /me/player para ${appUserId}:`, playerError.message);
                }
            }

            // Intento 2 (Fallback): Obtener "recently-played"
            // console.log(`[SpotifyService] User ${appUserId}: Ejecutando fallback a recently-played.`);
            try {
                const recentlyPlayedResponse = await axios.get(`${SPOTIFY_API_URL}/me/player/recently-played?limit=1`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }, 
                    timeout: 5000 
                });

                if (recentlyPlayedResponse.status === 200 && recentlyPlayedResponse.data.items && recentlyPlayedResponse.data.items.length > 0) {
                    const lastPlayedTrackItem = recentlyPlayedResponse.data.items[0];
                    const track = lastPlayedTrackItem.track;
                    // console.log(`[SpotifyService] User ${appUserId}: Encontrada pista reciente - ${track.name}`);
                    return {
                        userId: appUserId,
                        pushname: user.pushname,
                        profilePhotoPath: user.profilePhotoPath,
                        isPlaying: false, 
                        track: {
                            name: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            album: track.album.name,
                            albumArtUrl: track.album.images?.[0]?.url,
                            url: track.external_urls?.spotify
                        },
                        played_at: lastPlayedTrackItem.played_at, 
                        status: 'recently_played' 
                    };
                } else {
                    // console.log(`[SpotifyService] User ${appUserId}: No se encontraron pistas recientes.`);
                    return { userId: appUserId, pushname: user.pushname, profilePhotoPath: user.profilePhotoPath, isPlaying: false, track: null, status: 'no_activity' };
                }
            } catch (recentlyPlayedError) {
                 if (recentlyPlayedError.response && recentlyPlayedError.response.status === 401) {
                    //  console.warn(`[SpotifyService] Spotify API (recently-played) devolvió 401 para ${appUserId}. Limpiando tokens y omitiendo.`);
                     await db.query('UPDATE user_spotify_details SET spotify_access_token=NULL, spotify_token_expires_at=NULL WHERE user_app_id=$1', [appUserId]);
                     return null; 
                 }
                // console.error(`[SpotifyService] Error obteniendo recently-played para ${appUserId}:`, recentlyPlayedError.response ? JSON.stringify(recentlyPlayedError.response.data) : recentlyPlayedError.message);
                return { userId: appUserId, pushname: user.pushname, profilePhotoPath: user.profilePhotoPath, isPlaying: false, track: null, status: 'error_fetching_recent' };
            }
        });

        const results = (await Promise.all(activityPromises)).filter(activity => activity !== null); 
        // console.log(`[SpotifyService] Actividades procesadas para ${results.length} de ${usersWithSpotify.length} usuarios vinculados.`);
        return results;

    } catch (dbError) {
        console.error('[SpotifyService] Error de base de datos obteniendo usuarios para actividad de Spotify:', dbError.message, dbError.stack);
        throw dbError; 
    }
}

module.exports = {
    fetchSpotifyActivityForBackend
};