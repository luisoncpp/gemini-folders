export const STATE = { projects: [], chatMap: {}, prompts: [], isCollapsed: false };
export const ICONS = ['📁', '💻', '📱', '🎓', '📝', '✏️', '</>', '>_', '🎵', '🎬', '🗺️', '🎨'];

let extChrome = null;

export function setChromeAPI(api) {
    extChrome = api;
}

export async function loadState() {
    try {
        const data = await extChrome.storage.local.get(['projects', 'chatMap', 'prompts', 'isCollapsed']);
        STATE.projects = data.projects || [];
        STATE.chatMap = data.chatMap || {};
        STATE.prompts = data.prompts || [];
        STATE.isCollapsed = data.isCollapsed || false;

        // Migración de datos heredados
        for (let key in STATE.chatMap) {
            if (typeof STATE.chatMap[key] === 'string') {
                STATE.chatMap[key] = { projectId: STATE.chatMap[key], title: "Chat", url: `/app/${key}` };
            }
        }
    } catch (e) {
        console.error("[Gemini Projects] Error in loadState:", e);
        throw e;
    }
}

export async function saveState() {
    await extChrome.storage.local.set({ projects: STATE.projects, chatMap: STATE.chatMap, prompts: STATE.prompts, isCollapsed: STATE.isCollapsed });
}
