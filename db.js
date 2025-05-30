// db.js (o config/db.js)
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  // --- AÑADIR CONFIGURACIÓN SSL ---
  ssl: {
    rejectUnauthorized: false // ¡IMPORTANTE para Render y otros hostings con SSL gestionado!
                              // En un entorno de producción donde gestionas tus propios certificados CA,
                              // podrías necesitar configuraciones más estrictas aquí, como proporcionar tu CA.
                              // Pero para Render, esto suele ser lo necesario.
  }
  // ----------------------------------
});

pool.on('connect', (client) => { // El evento 'connect' del pool emite el cliente conectado
  console.log('Conectado a la base de datos PostgreSQL en Render (SSL habilitado)!');
  // Opcional: client.query('SET DATESTYLE = "ISO, DMY";'); // Ejemplo de query al conectar
});

pool.on('error', (err, client) => {
  console.error('Error inesperado en el cliente inactivo del pool de PostgreSQL', err);
  // process.exit(-1); // Considera si quieres que la app se cierre en errores críticos del pool
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool: pool
};