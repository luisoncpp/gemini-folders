export const ChatState = {
    lastClickedChat: null
};

export function getCurrentChatId() {
    const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

export function initChatCapture() {
    document.addEventListener('mousedown', (e) => {
        let container = e.target.closest('li, [data-test-id="chat-history-item"], .mdc-list-item');
        
        if (!container && e.target.closest('button')) {
            let parent = e.target.parentElement;
            for(let i=0; i<5; i++) {
                if(parent && parent.querySelector('a[href*="/app/"]')) {
                    container = parent; break;
                }
                if(parent) parent = parent.parentElement;
            }
        }

        if (container) {
            const link = container.querySelector('a[href*="/app/"]');
            if (link) {
                const href = link.getAttribute('href');
                const match = href.match(/\/app\/([a-zA-Z0-9]+)/);
                if (match) {
                    let title = link.getAttribute('aria-label') || link.textContent;
                    title = title.replace(/^(Opciones de chat|Fijar|Dejar de fijar|Cambiar nombre|Eliminar|Chat|Conversación)(\s*para\s*)?/gi, '').trim();
                    title = title.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
                    if (!title || title.length < 2) title = "Chat guardado";

                    ChatState.lastClickedChat = { id: match[1], title: title, url: href };
                    console.log("[Gemini Projects] Chat memorizado con éxito:", ChatState.lastClickedChat);
                }
            }
        }
    }, true);
}
