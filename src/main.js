import { loadState, setChromeAPI } from './state.js';
import { initChatCapture } from './chatCapture.js';
import { startSidebarObserver, hideMappedChats } from './ui.js';
import { contextMenuObserver } from './contextMenu.js';

console.log("[Gemini Projects] Cargando módulo principal");

export async function init(chromeAPI) {
    setChromeAPI(chromeAPI);
    initChatCapture();
    contextMenuObserver.observe(document.body, { childList: true, subtree: true });
    
    try {
        await loadState();
    } catch (err) {
        console.error("[Gemini Projects] loadState() failed!", err);
    }
    
    startSidebarObserver();
    setInterval(hideMappedChats, 500);
}
