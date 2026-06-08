
export const STATE = { projects: [], chatMap: {}, prompts: [], isCollapsed: false };
export const ICONS = ['📁', '💻', '📱', '🎓', '📝', '✏️', '[]', '>_', '🎵', '🎬', '🗺️', '🎨', '🗑️', '🤖', '💰', '🎮', '📚', '⌨️', '🧙', '🌐', '🩺', '🌕'];

let extChrome = null;
let fileHandle = null;

const JSON_INDENT_SPACES = 2;
const CLEANUP_TIMEOUT_MS = 100;

export function setChromeAPI(api) {
    extChrome = api;
}

// --------------------------------------------------------
// FILE SYSTEM SYNC & INDEXEDDB LOGIC
// --------------------------------------------------------

async function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GeminiProjectsDB', 1);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore('handles');
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => reject('Failed to open IndexedDB');
    });
}

async function restoreFileHandle() {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const tx = db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get('syncFile');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function verifyPermission(handle, withActivation = false, mode = 'readwrite') {
    if (!handle) return false;
    // simulating named parameters using comments
    if ((await handle.queryPermission({ mode: mode /* mode */ })) === 'granted') {
        return true;
    }
    if (withActivation) {
        try {
            if ((await handle.requestPermission({ mode: mode /* mode */ })) === 'granted') {
                return true;
            }
        } catch (e) {
            console.warn("[Gemini Projects] Permission request denied or failed", e);
        }
    }
    return false;
}

export async function exportLocalData() {
    const hasProjects = STATE.projects && STATE.projects.length > 0;
    const hasChats = STATE.chatMap && Object.keys(STATE.chatMap).length > 0;

    if (!hasProjects && !hasChats) {
        return /* exported */ false; 
    }

    const blob = new Blob([JSON.stringify(STATE, null, JSON_INDENT_SPACES)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'gemini_projects_local_backup.json';
    document.body.appendChild(downloadLink);
    
    downloadLink.click();
    
    setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }, CLEANUP_TIMEOUT_MS);

    return /* exported */ true;
}

export async function createNewSyncFile() {
    if (!window.showSaveFilePicker) {
        alert("File System Access API is not supported by your browser or is blocked by your settings (e.g. Brave Shields). Please enable it or use a supported browser.");
        return;
    }
    try {
        fileHandle = await window.showSaveFilePicker({
            suggestedName: 'gemini_projects_sync.json',
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
        });
        
        const db = await getDB();
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(fileHandle, 'syncFile');
        
        await saveState(); 
        alert("Sync file created successfully! Your current projects are now synced.");
    } catch (err) {
        console.error("[Gemini Projects] Error:", err);
    }
}

export async function openExistingSyncFile() {
    if (!window.showOpenFilePicker) {
        alert("File System Access API is not supported by your browser or is blocked by your settings (e.g. Brave Shields). Please enable it or use a supported browser.");
        return;
    }
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
            multiple: false /* multiple */ 
        });
        
        const db = await getDB();
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(fileHandle, 'syncFile');
        
        let backupSaved = false;
        const hasProjects = STATE.projects && STATE.projects.length > 0;
        const hasChats = STATE.chatMap && Object.keys(STATE.chatMap).length > 0;
        if ((hasProjects || hasChats) && window.confirm("Would you like to save a backup of the current projects before linking the sync file?")) {
            backupSaved = await exportLocalData();
        }
        
        await loadState(true /* isUserAction */); 
        if (backupSaved) {
            alert("Sync file linked! Backup saved to downloads.");
        } else {
            alert("Sync file linked successfully!");
        }
    } catch (err) {
        console.error("[Gemini Projects] Error:", err);
    }
}

export async function importBackupData() {
    try {
        let text = '';
        if (window.showOpenFilePicker) {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
                multiple: false /* multiple */
            });
            const file = await handle.getFile();
            text = await file.text();
        } else {
            text = await new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) {
                        reject(new Error("No file selected"));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error("Error reading file"));
                    reader.readAsText(file);
                };
                input.click();
            });
        }
        
        const data = JSON.parse(text);
        
        STATE.projects = data.projects || [];
        STATE.chatMap = data.chatMap || {};
        STATE.prompts = data.prompts || [];
        STATE.isCollapsed = data.isCollapsed || false;
        
        await saveState();
        alert("Backup imported successfully!");
    } catch (err) {
        console.error("[Gemini Projects] Import failed", err);
    }
}

// --------------------------------------------------------
// STATE MANAGEMENT
// --------------------------------------------------------

export async function loadState(isUserAction = false) {
    try {
        if (!fileHandle) {
            fileHandle = await restoreFileHandle();
        }

        let data = {};
        let loadedFromFile = false;
        
        if (fileHandle) {
            const hasPermission = await verifyPermission(fileHandle, isUserAction, 'read');
            if (hasPermission) {
                const file = await fileHandle.getFile();
                const text = await file.text();
                data = text ? JSON.parse(text) : {};
                loadedFromFile = true;
            }
        }
        
        if (!loadedFromFile) {
            data = await extChrome.storage.local.get(['projects', 'chatMap', 'prompts', 'isCollapsed']);
        }

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
    const payload = { projects: STATE.projects, chatMap: STATE.chatMap, prompts: STATE.prompts, isCollapsed: STATE.isCollapsed };
    
    const hasPermission = await verifyPermission(fileHandle, true /* isUserAction */, 'readwrite');
    if (hasPermission) {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(payload, null, JSON_INDENT_SPACES));
        await writable.close();
    } else {
        await extChrome.storage.local.set(payload);
    }
}
