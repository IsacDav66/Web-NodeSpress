        (function () {
            try {
                // Intenta obtener el tema guardado
                let theme = localStorage.getItem('theme');
                const htmlElement = document.documentElement; // Aplicar al <html>

                // Si no hay tema guardado, detectar preferencia del sistema
                if (!theme) {
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                        theme = 'light';
                    } else {
                        theme = 'dark'; // Tu tema por defecto si no hay preferencia o es oscura
                    }
                    // Opcional: guardar el tema detectado/default si no había nada
                    // localStorage.setItem('theme', theme); 
                    // Considera si quieres hacer esto aquí o solo cuando el usuario cambie explícitamente
                }

                // Aplicar el atributo data-theme.
                // themes.css debe tener reglas para body[data-theme="..."]
                // o :root[data-theme="..."] si aplicas al htmlElement
                // Si tu tema oscuro es el default sin data-theme, solo necesitas actuar para 'light'
                if (theme) { // Asegurarse que 'theme' tiene un valor
                    htmlElement.setAttribute('data-theme', theme);
                    // Si tu tema oscuro es el default (body sin data-theme), y solo alternas 'light':
                    // if (theme === 'light') {
                    //    htmlElement.setAttribute('data-theme', 'light');
                    // } else {
                    //    htmlElement.removeAttribute('data-theme'); // Para volver al default
                    // }
                }
                console.log('[Pre-Render Theme Script] Tema aplicado al <html>:', theme);
            } catch (e) {
                // En caso de error (ej. localStorage no disponible), no hacer nada o aplicar un default seguro
                console.error("Error aplicando tema pre-render:", e);
                document.documentElement.setAttribute('data-theme', 'dark'); // Fallback seguro
            }
        })();
