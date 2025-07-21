// public/juegos/pacman-game.js
// AHORA ESTE ARCHIVO ES MUCHO MÁS SIMPLE

window.pacmanGameModule = {
    id: 'pacman',
    name: '🟡 Pacman (Godot)', // Puedes cambiar el nombre si quieres
    coverImage: 'juegos/covers/pacman-cover.jpg',
    description: '¡La versión completa! Come todos los puntos y evita los fantasmas en este clásico arcade.',
    // Ya no necesitamos la función init, porque la lógica está en Godot.
    // Añadimos una propiedad para que nuestro launcher sepa que es un juego de Godot.
    type: 'godot' 
};