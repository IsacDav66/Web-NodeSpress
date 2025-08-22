// public/publicaciones.js

// Crear el namespace global ANTES del DOMContentLoaded
window.PostRenderer = {};

// --- FUNCIONES AUXILIARES GLOBALES (asignadas a window.PostRenderer) ---
window.PostRenderer.escapeHtml = function(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, ".").replace(/'/g, "'");
};

window.PostRenderer.formatPostTimestamp = function(timestamp) {
    if (!timestamp) return 'Hace un momento';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return `Hace ${diffSeconds} seg`;
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffHours < 24) return `Hace ${diffHours} hr`;
    if (diffDays < 7) return `Hace ${diffDays} día(s)`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

// --- FUNCIONES DE CREACIÓN Y MANEJO DE ELEMENTOS DE POST (asignadas a window.PostRenderer) ---
window.PostRenderer.createPostElement = function(post, loggedInUserForContext) {
    const postEl = document.createElement('div');
    postEl.className = 'post-card';
    postEl.dataset.postId = post.post_id;

    let imageHTML = '';
    if (post.image_url) {
        imageHTML = `
            <div class="post-image-container">
                <img src="${window.PostRenderer.escapeHtml(post.image_url)}" alt="Imagen de la publicación" loading="lazy">
            </div>`;
    }

    // Determinar el estado de liked_by_viewer y saved_by_viewer
    // El backend YA los provee si se pasó viewerId correctamente.
    let isLiked = post.liked_by_viewer || false;
    let isSaved = post.saved_by_viewer || false;
// --- BOTÓN DE ELIMINAR (condicional) ---
let deleteButtonHTML = '';
if (loggedInUserForContext && loggedInUserForContext.userId === post.author_user_id) {
    deleteButtonHTML = `
        <button class="post-action-btn delete-post-btn" data-action="delete" title="Eliminar publicación">
            <svg class="post-action-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/><path d="M0 0h24v24H0z" fill="none"/></svg>
        </button>
    `;
}

postEl.innerHTML = `
    <div class="post-header">
        <img src="${window.PostRenderer.escapeHtml(post.author_profile_photo_path || 'placeholder-profile.jpg')}" alt="${window.PostRenderer.escapeHtml(post.author_pushname)}" class="post-author-pic">
        <div class="post-author-info">
            <a href="profile.html?id=${encodeURIComponent(post.author_user_id)}" class="author-name">${window.PostRenderer.escapeHtml(post.author_pushname)}</a>
            <div class="post-timestamp">${window.PostRenderer.formatPostTimestamp(post.created_at)}</div>
        </div>
        ${deleteButtonHTML} 
    </div>
    <div class="post-content">
        <p>${window.PostRenderer.escapeHtml(post.content)}</p>
        ${imageHTML}
    </div>

 
    <div class="post-footer">
        <div class="post-interactions">
            <button class="post-action-btn like-btn ${isLiked ? 'active' : ''}" data-action="like" title="Me gusta">
                <svg class="post-action-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <span class="likes-count">${post.like_count || 0}</span>
            </button>
            <button class="post-action-btn comment-btn" data-action="comment" title="Comentar">
                <svg class="post-action-icon" viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                <span class="comments-count-display">${post.comment_count || 0}</span>
            </button>
        </div>
        <div class="post-save-action">
            <button class="post-action-btn save-btn ${isSaved ? 'active' : ''}" data-action="save" title="${isSaved ? 'Desguardar' : 'Guardar'}">
                <!-- Icono de Guardado (Borde) -->
                <svg class="post-action-icon icon-notsaved" viewBox="0 0 24 24" style="${isSaved ? 'display:none;' : ''}">
                    <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
                </svg>
                <!-- Icono de Guardado (Relleno) -->
                <svg class="post-action-icon icon-saved" viewBox="0 0 24 24" style="${!isSaved ? 'display:none;' : ''}">
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
            </button>
        </div>
    </div>


    <div class="comments-section" style="display: none;">
        <form class="comment-form">
            <textarea placeholder="Escribe un comentario..." rows="1" required></textarea>
            <button type="submit">Enviar</button>
        </form>
        <div class="comment-list"></div>
    </div>
`;
    window.PostRenderer.addPostEventListeners(postEl, post, loggedInUserForContext); 
    return postEl;
};

window.PostRenderer.addPostEventListeners = function(postEl, postData, loggedInUserForContext) {
    const API_BASE_URL_LOCAL = '/socianark/api'; // Para evitar problemas de scope si se llama desde otro JS
    const likeBtn = postEl.querySelector('.like-btn');
    const commentBtn = postEl.querySelector('.comment-btn');
    const saveBtn = postEl.querySelector('.save-btn');
    const commentsSection = postEl.querySelector('.comments-section');
    const commentForm = postEl.querySelector('.comment-form');

    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!loggedInUserForContext) return alert("Inicia sesión para reaccionar.");
            const postId = postEl.dataset.postId;
            try {
                const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}/react`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: loggedInUserForContext.userId })
                });
                const result = await response.json();
                if (response.ok) {
                    likeBtn.classList.toggle('active', result.reacted);
                    const likesCountEl = postEl.querySelector('.likes-count');
                    if (likesCountEl) {
                         let currentLikes = parseInt(likesCountEl.textContent.match(/\d+/)[0]) || 0;
                         likesCountEl.textContent = `${currentLikes + (result.reacted ? 1 : -1)}`;
                    }
                } else { throw new Error(result.message); }
            } catch (err) { console.error(err); alert(`Error: ${err.message}`); }
        });
    }

    if (commentBtn) {
         commentBtn.addEventListener('click', () => {
            if (!loggedInUserForContext) return alert("Inicia sesión para comentar.");
            commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
            if (commentsSection.style.display === 'block' && !commentsSection.dataset.commentsLoaded) {
                window.PostRenderer.fetchCommentsForPost(postEl.dataset.postId, postEl.querySelector('.comment-list'), loggedInUserForContext);
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
           if (!loggedInUserForContext) return alert("Inicia sesión para guardar publicaciones.");
           const postId = postEl.dataset.postId;
            try {
               const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}/save`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ userId: loggedInUserForContext.userId })
               });
               const result = await response.json();
               if (response.ok) {
                   saveBtn.classList.toggle('active', result.saved);
                   saveBtn.setAttribute('title', result.saved ? 'Desguardar' : 'Guardar'); // Actualizar title

                   // Alternar visibilidad de los iconos SVG
                   const iconNotSaved = saveBtn.querySelector('.icon-notsaved');
                   const iconSaved = saveBtn.querySelector('.icon-saved');
                   if (iconNotSaved && iconSaved) {
                       iconNotSaved.style.display = result.saved ? 'none' : 'inline-block'; // o 'block' si es necesario
                       iconSaved.style.display = result.saved ? 'inline-block' : 'none';
                   }

               } else { throw new Error(result.message); }
           } catch (err) { console.error(err); alert(`Error: ${err.message}`); }
       });
   }

     if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!loggedInUserForContext) return alert("Inicia sesión para comentar.");
            const textarea = commentForm.querySelector('textarea');
            const content = textarea.value.trim();
            if (!content) return;
            const postId = postEl.dataset.postId;
            const parentCommentId = commentForm.dataset.parentCommentId || null;

            try {
                const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: loggedInUserForContext.userId, content, parentCommentId })
                });
                const newComment = await response.json();
                if (response.ok) {
                    const commentListEl = parentCommentId ? 
                        postEl.querySelector(`.comment-item[data-comment-id="${parentCommentId}"] .replies-list`) : 
                        postEl.querySelector('.comment-list');
                    
                    if (commentListEl) {
                         commentListEl.appendChild(window.PostRenderer.createCommentElement(newComment, postId, loggedInUserForContext));
                    } else {
                        window.PostRenderer.fetchCommentsForPost(postId, postEl.querySelector('.comment-list'), loggedInUserForContext);
                    }
                    textarea.value = '';
                    if (commentForm.dataset.parentCommentId) { 
                        commentForm.remove();
                    }
                    const commentsCountDisplay = postEl.querySelector('.comments-count-display');
                    if (commentsCountDisplay) {
                        let currentComments = parseInt(commentsCountDisplay.textContent.match(/\d+/)[0]) || 0;
                        commentsCountDisplay.textContent = `${currentComments + 1} Comentarios`;
                    }
                } else { throw new Error(newComment.message); }
            } catch (err) { console.error(err); alert(`Error: ${err.message}`); }
        });
    }

    const deleteBtn = postEl.querySelector('.delete-post-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!loggedInUserForContext || loggedInUserForContext.userId !== postData.author_user_id) {
                // Esta comprobación es una segunda capa, el botón no debería renderizarse si no es el autor.
                alert("No tienes permiso para eliminar esta publicación.");
                return;
            }

            if (!confirm("¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.")) {
                return;
            }

            const postId = postEl.dataset.postId;
            deleteBtn.disabled = true; // Deshabilitar mientras se procesa

            try {
                const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    // Enviar el userId para la autorización en el backend
                    body: JSON.stringify({ userId: loggedInUserForContext.userId })
                });

                const result = await response.json();

                if (response.ok) {
                    alert(result.message || "Publicación eliminada.");
                    // Eliminar el elemento del post del DOM
                    postEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    postEl.style.opacity = '0';
                    postEl.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        postEl.remove();
                        // Podrías necesitar actualizar contadores de posts en el perfil si esta función se llama desde ahí
                    }, 300);
                } else {
                    throw new Error(result.message || "Error al eliminar la publicación.");
                }
            } catch (err) {
                console.error("Error eliminando post:", err);
                alert(`Error: ${err.message}`);
                deleteBtn.disabled = false; // Rehabilitar si falla
            }
        });
    }
};

window.PostRenderer.fetchCommentsForPost = async function(postId, commentListContainer, loggedInUserForContext) {
    const API_BASE_URL_LOCAL = '/socianark/api';
    commentListContainer.innerHTML = '<p>Cargando comentarios...</p>';
    commentListContainer.closest('.comments-section').dataset.commentsLoaded = "true";
    try {
        const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}/comments`);
        if (!response.ok) throw new Error('Error al cargar comentarios.');
        const comments = await response.json();
        commentListContainer.innerHTML = '';
        if (comments.length === 0) {
            commentListContainer.innerHTML = '<p>No hay comentarios aún.</p>';
        } else {
            comments.forEach(comment => commentListContainer.appendChild(window.PostRenderer.createCommentElement(comment, postId, loggedInUserForContext)));
        }
    } catch (error) {
        console.error(error);
        commentListContainer.innerHTML = `<p class="error">${error.message}</p>`;
    }
};

window.PostRenderer.createCommentElement = function(comment, postId, loggedInUserForContext) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    commentEl.dataset.commentId = comment.comment_id;
    commentEl.innerHTML = `
        <div class="comment-header">
            <img src="${window.PostRenderer.escapeHtml(comment.author_profile_photo_path || 'placeholder-profile.jpg')}" alt="${window.PostRenderer.escapeHtml(comment.author_pushname)}" class="comment-author-pic">
            <a href="profile.html?id=${encodeURIComponent(comment.author_user_id)}" class="comment-author-name">${window.PostRenderer.escapeHtml(comment.author_pushname)}</a>
            <span class="comment-timestamp">${window.PostRenderer.formatPostTimestamp(comment.created_at)}</span>
        </div>
        <p class="comment-content">${window.PostRenderer.escapeHtml(comment.content)}</p>
        <div class="comment-actions">
            <button class="reply-to-comment-btn" data-comment-id="${comment.comment_id}">Responder</button>
        </div>
        <div class="replies-list"></div>
    `;
    if (comment.replies && comment.replies.length > 0) {
        const repliesListEl = commentEl.querySelector('.replies-list');
        comment.replies.forEach(reply => repliesListEl.appendChild(window.PostRenderer.createCommentElement(reply, postId, loggedInUserForContext)));
    }
    const replyBtn = commentEl.querySelector('.reply-to-comment-btn');
    replyBtn.addEventListener('click', () => {
        if (!loggedInUserForContext) return alert("Inicia sesión para responder.");
        window.PostRenderer.showReplyForm(commentEl, postId, comment.comment_id, loggedInUserForContext);
    });
    return commentEl;
};

window.PostRenderer.showReplyForm = function(parentCommentEl, postId, parentCommentId, loggedInUserForContext) {
    const API_BASE_URL_LOCAL = '/socianark/api';
    parentCommentEl.querySelectorAll('.reply-form').forEach(form => form.remove());
    const replyFormEl = document.createElement('form');
    replyFormEl.className = 'comment-form reply-form';
    replyFormEl.dataset.parentCommentId = parentCommentId;
    replyFormEl.innerHTML = `
        <textarea placeholder="Escribe una respuesta..." rows="1" required></textarea>
        <button type="submit">Responder</button>
    `;
    replyFormEl.addEventListener('submit', async (e) => {
         e.preventDefault();
        if (!loggedInUserForContext) return alert("Inicia sesión para comentar.");
        const textarea = replyFormEl.querySelector('textarea');
        const content = textarea.value.trim();
        if (!content) return;
        try {
            const response = await fetch(`${API_BASE_URL_LOCAL}/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUserForContext.userId, content, parentCommentId })
            });
            const newReply = await response.json();
            if (response.ok) {
                const repliesListEl = parentCommentEl.querySelector('.replies-list');
                repliesListEl.appendChild(window.PostRenderer.createCommentElement(newReply, postId, loggedInUserForContext));
                textarea.value = '';
                replyFormEl.remove(); 
                const postCard = parentCommentEl.closest('.post-card');
                if (postCard) {
                    const commentsCountDisplay = postCard.querySelector('.comments-count-display');
                    if (commentsCountDisplay) {
                        let currentComments = parseInt(commentsCountDisplay.textContent.match(/\d+/)[0]) || 0;
                        commentsCountDisplay.textContent = `${currentComments + 1} Comentarios`;
                    }
                }
            } else { throw new Error(newReply.message); }
        } catch (err) { console.error(err); alert(`Error: ${err.message}`); }
    });
    parentCommentEl.appendChild(replyFormEl);
    replyFormEl.querySelector('textarea').focus();
};


// Lógica específica de la página publicaciones.html (dentro de DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/socianark/api'; // Re-declarar para este scope si es necesario
    const postsContainer = document.getElementById('postsContainer');
    const openCreatePostModalBtn = document.getElementById('openCreatePostModalBtn');
    const createPostModal = document.getElementById('createPostModal');
    const closeCreatePostModalBtn = document.getElementById('closeCreatePostModalBtn');
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContentInput');
    const postImageInput = document.getElementById('postImageInput');
    const postImagePreviewContainer = document.getElementById('postImagePreviewContainer');
    const postImagePreview = document.getElementById('postImagePreview');
    const removePostImageBtn = document.getElementById('removePostImageBtn');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const createPostStatus = document.getElementById('createPostStatus');
    const loadMorePostsBtn = document.getElementById('loadMorePostsBtn');

    let loggedInUserPageContext = null; // Específico para esta página
    let currentPageFeed = 1;
    const postsPerPageFeed = 10;

    function initPublicacionesPage() {
        // Solo ejecutar si estamos en publicaciones.html
        if (!postsContainer || !openCreatePostModalBtn) return; 

        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            loggedInUserPageContext = JSON.parse(storedUser);
            fetchPostsFeed(true); 
            if (openCreatePostModalBtn) openCreatePostModalBtn.style.display = 'inline-flex';
        } else {
            postsContainer.innerHTML = '<p class="error">Debes iniciar sesión para ver y crear publicaciones.</p>';
            if (openCreatePostModalBtn) openCreatePostModalBtn.style.display = 'none';
        }
    }

    async function fetchPostsFeed(replace = false) {
        // Solo ejecutar si estamos en publicaciones.html
        if (!postsContainer) return;
        
        if (!loggedInUserPageContext && !replace) {
            if (loadMorePostsBtn) loadMorePostsBtn.style.display = 'none';
            return;
        }
        if (replace) {
            currentPageFeed = 1;
            postsContainer.innerHTML = '<p>Cargando...</p>';
        }
        const viewerIdParam = loggedInUserPageContext ? `&viewerId=${encodeURIComponent(loggedInUserPageContext.userId)}` : '';
        try {
            const response = await fetch(`${API_BASE_URL}/posts?page=${currentPageFeed}&limit=${postsPerPageFeed}${viewerIdParam}`);
            if (!response.ok) throw new Error('Error al cargar publicaciones.');
            const posts = await response.json();

            if (replace) postsContainer.innerHTML = '';

            if (posts.length === 0 && currentPageFeed === 1) {
                postsContainer.innerHTML = '<p>No hay publicaciones para mostrar. ¡Sé el primero en publicar!</p>';
            } else {
                // Usar la función global, pasando el contexto de usuario de ESTA PÁGINA
                posts.forEach(post => postsContainer.appendChild(window.PostRenderer.createPostElement(post, loggedInUserPageContext)));
            }

            if (loadMorePostsBtn) {
                loadMorePostsBtn.style.display = posts.length < postsPerPageFeed ? 'none' : 'block';
            }
            currentPageFeed++;

        } catch (error) {
            console.error(error);
            if (replace) postsContainer.innerHTML = `<p class="error">${error.message}</p>`;
            if (loadMorePostsBtn) loadMorePostsBtn.style.display = 'none';
        }
    }
    
    // Modal de Crear Publicación (Listeners específicos para publicaciones.html)
    if (openCreatePostModalBtn && createPostModal && closeCreatePostModalBtn && createPostForm) {
        openCreatePostModalBtn.addEventListener('click', () => {
            if (!loggedInUserPageContext) return alert("Inicia sesión para crear una publicación.");
            createPostModal.style.display = 'flex';
            setTimeout(() => createPostModal.classList.add('visible'), 10);
            document.body.classList.add('modal-open-no-scroll');
        });
        const closeModalHandler = () => {
            createPostModal.classList.remove('visible');
            document.body.classList.remove('modal-open-no-scroll');
            setTimeout(() => {
                if (!createPostModal.classList.contains('visible')) createPostModal.style.display = 'none';
                createPostForm.reset();
                postImagePreview.src = '#';
                postImagePreviewContainer.style.display = 'none';
                postImageInput.value = ''; 
                createPostStatus.style.display = 'none';
                createPostStatus.textContent = '';
                submitPostBtn.disabled = false;
                submitPostBtn.textContent = 'Publicar';
            }, 300); 
        };
        closeCreatePostModalBtn.addEventListener('click', closeModalHandler);
        createPostModal.addEventListener('click', (e) => {
            if (e.target === createPostModal) closeModalHandler();
        });
        postImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    postImagePreview.src = event.target.result;
                    postImagePreviewContainer.style.display = 'flex';
                }
                reader.readAsDataURL(file);
            } else {
                postImagePreview.src = '#';
                postImagePreviewContainer.style.display = 'none';
            }
        });
        removePostImageBtn.addEventListener('click', () => {
            postImageInput.value = ''; 
            postImagePreview.src = '#';
            postImagePreviewContainer.style.display = 'none';
        });
        createPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!loggedInUserPageContext) return;

            const content = postContentInput.value.trim();
            const imageFile = postImageInput.files[0];

            if (!content && !imageFile) {
                createPostStatus.textContent = "Escribe algo o selecciona una imagen.";
                createPostStatus.className = 'message-area error visible';
                return;
            }
            submitPostBtn.disabled = true;
            submitPostBtn.textContent = 'Publicando...';
            createPostStatus.textContent = 'Publicando...';
            createPostStatus.className = 'message-area visible';

            const formData = new FormData();
            formData.append('userId', loggedInUserPageContext.userId);
            formData.append('content', content);
            if (imageFile) {
                formData.append('postImage', imageFile);
            }

            try {
                const response = await fetch(`${API_BASE_URL}/posts`, {
                    method: 'POST',
                    body: formData 
                });
                const newPost = await response.json(); // Asume que el backend devuelve el post completo con datos del autor
                if (response.ok) {
                    createPostStatus.textContent = "¡Publicación creada!";
                    createPostStatus.className = 'message-area success visible';
                    // Usar la función global para crear el elemento del post
                    postsContainer.prepend(window.PostRenderer.createPostElement(newPost, loggedInUserPageContext));
                    const noPostsMsg = postsContainer.querySelector('p');
                    if (noPostsMsg && noPostsMsg.textContent.startsWith('No hay publicaciones')) {
                        noPostsMsg.remove();
                    }
                    setTimeout(closeModalHandler, 1500);
                } else {
                    throw new Error(newPost.message || "Error del servidor");
                }
            } catch (error) {
                console.error(error);
                createPostStatus.textContent = `Error: ${error.message}`;
                createPostStatus.className = 'message-area error visible';
                submitPostBtn.disabled = false;
                submitPostBtn.textContent = 'Publicar';
            }
        });
    }

    if(loadMorePostsBtn){ // Específico para el feed de publicaciones.html
        loadMorePostsBtn.addEventListener('click', () => fetchPostsFeed(false));
    }

    // Solo llama a initPublicacionesPage si estamos realmente en publicaciones.html
    // Esto se puede verificar por la presencia de elementos clave de esa página.
    if (document.getElementById('postsContainer') && document.getElementById('openCreatePostModalBtn')) {
        initPublicacionesPage();
    }
});