
/**
 * Gemini Projects - Content Script (Title Extraction & Remove Feature)
 */

console.log("[Gemini Projects] Cargando inyección visual y lógica mejorada...");

const STATE = { projects: [], chatMap: {}, prompts: [], isCollapsed: false };
const ICONS = ['📁', '💻', '📱', '🎓', '📝', '✏️', '</>', '>_', '🎵', '🎬', '🗺️', '🎨'];

let lastClickedChat = null;
let sidebarAnchorNode = null;

// --- 1. CARGA Y ESTADO ---
async function loadState() {
    const data = await chrome.storage.local.get(['projects', 'chatMap', 'prompts', 'isCollapsed']);
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

    startSidebarObserver();
    setInterval(hideMappedChats, 500);
}

async function saveState() {
    await chrome.storage.local.set({ projects: STATE.projects, chatMap: STATE.chatMap, prompts: STATE.prompts, isCollapsed: STATE.isCollapsed });
}

function getCurrentChatId() {
    const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// --- 2. CAPTURA INTELIGENTE DEL TÍTULO ---
document.addEventListener('mousedown', (e) => {
    // Si hacemos clic en cualquier parte de una fila de chat (incluyendo el botón de menú)
    let container = e.target.closest('li, [data-test-id="chat-history-item"], .mdc-list-item');
    
    // Fallback: Si el botón de 3 puntos no está envuelto en lo anterior, subimos por el árbol DOM
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
                // Truco maestro: Gemini guarda el nombre real y limpio en la etiqueta aria-label
                let title = link.getAttribute('aria-label') || link.textContent;
                
                // Limpiamos la basura de accesibilidad que Google le mete al texto ("Opciones de chat para...", "Fijar...")
                title = title.replace(/^(Opciones de chat|Fijar|Dejar de fijar|Cambiar nombre|Eliminar|Chat|Conversación)(\s*para\s*)?/gi, '').trim();
                
                // Limpieza de espacios extra
                title = title.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
                
                if (!title || title.length < 2) title = "Chat guardado";

                lastClickedChat = { id: match[1], title: title, url: href };
                console.log("[Gemini Projects] Chat memorizado con éxito:", lastClickedChat);
            }
        }
    }
}, true);

// --- 3. INYECCIÓN Y RENDERIZADO VISUAL ---
function startSidebarObserver() {
    setInterval(attemptRenderSidebar, 1000);
}

function attemptRenderSidebar() {
    if (document.getElementById('gp-sidebar-projects')) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node, chatsTextNode = null;
    while ((node = walker.nextNode())) {
        if (node.nodeValue.trim() === 'Chats') { chatsTextNode = node.parentElement; break; }
    }
    if (!chatsTextNode) return;

    let targetBlock = chatsTextNode;
    let foundContainer = false;
    for (let i = 0; i < 4; i++) {
        if (targetBlock.parentElement && targetBlock.parentElement.tagName !== 'BODY') {
            targetBlock = targetBlock.parentElement;
            if (targetBlock.parentNode && targetBlock.parentNode.children.length > 2) {
                foundContainer = true;
                break;
            }
        }
    }

    if (foundContainer && targetBlock) {
        sidebarAnchorNode = targetBlock;
        renderSidebarDOM();
    }
}

function renderSidebarDOM() {
    if (!sidebarAnchorNode) return;

    let container = document.getElementById('gp-sidebar-projects');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gp-sidebar-projects';
        container.className = 'gp-sidebar-section';
        sidebarAnchorNode.insertAdjacentElement('beforebegin', container);
    }

    let html = `
        <div class="gp-sidebar-header" id="gp-sidebar-toggle">
            <span>Projects</span>
            <span style="font-size:11px; opacity:0.8; transform: ${STATE.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s; display: inline-block;">▼</span>
        </div>
        <div class="gp-project-list" style="display: ${STATE.isCollapsed ? 'none' : 'flex'};">
            <div class="gp-project-item" id="gp-new-project-btn">
                <span class="gp-project-icon" style="font-size:18px;">+</span> 
                <span>New Project</span>
            </div>
    `;

    STATE.projects.forEach(p => {
        const isProjCollapsed = p.isCollapsed || false;
        html += `
            <div class="gp-project-item gp-proj-link" data-id="${p.id}" style="justify-content: space-between;">
                <div style="display:flex; align-items:center;">
                    <span class="gp-project-icon">${p.icon}</span> 
                    <span>${p.name}</span>
                </div>
                <span style="font-size:10px; opacity:0.6; transform: ${isProjCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s;">▼</span>
            </div>
        `;
        
        const projectChats = Object.entries(STATE.chatMap).filter(([id, data]) => data.projectId === p.id);
        if (projectChats.length > 0) {
            html += `<div class="gp-project-chats" style="display: ${isProjCollapsed ? 'none' : 'flex'};">`;
            projectChats.forEach(([id, data]) => {
                // Nuevo diseño: Enlace del chat + botón "X" para desvincular
                html += `
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <a href="${data.url}" class="gp-chat-item" title="${data.title}" style="flex-grow:1; overflow:hidden; text-overflow:ellipsis;">
                            📄 ${data.title}
                        </a>
                        <button class="gp-remove-chat-btn" data-chat-id="${id}" title="Remove from project" 
                                style="background:none; border:none; color:var(--gp-text-secondary); cursor:pointer; padding:4px 8px; font-size:16px; opacity:0.5;">
                            ×
                        </button>
                    </div>
                `;
            });
            html += `</div>`;
        }
    });

    html += `</div>`;
    container.innerHTML = html;

    // Evento: Colapsar/Expandir menú
    document.getElementById('gp-sidebar-toggle')?.addEventListener('click', async () => {
        STATE.isCollapsed = !STATE.isCollapsed;
        await saveState();
        renderSidebarDOM();
    });

    // Evento: Nuevo Proyecto
    document.getElementById('gp-new-project-btn')?.addEventListener('click', () => openNewProjectModal());
    
    // Evento: Navegación SPA para evitar recargas completas
    container.querySelectorAll('.gp-chat-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Detiene la recarga por defecto
            const url = e.currentTarget.getAttribute('href');
            
            // Busca el enlace nativo oculto y le hace clic
            const nativeLink = document.querySelector(`a[href="${url}"]:not(.gp-chat-item)`);
            if (nativeLink) {
                nativeLink.click();
            } else {
                window.location.href = url;
            }
        });
    });

    // Evento: Colapsar/Expandir proyectos individuales
    container.querySelectorAll('.gp-proj-link').forEach(el => {
        el.addEventListener('click', async (e) => {
            const projId = e.currentTarget.dataset.id;
            const proj = STATE.projects.find(p => p.id === projId);
            if (proj) {
                proj.isCollapsed = !proj.isCollapsed;
                await saveState();
                renderSidebarDOM();
            }
        });
    });

    // Evento: Desvincular Chat (Quitarlo del proyecto)
    container.querySelectorAll('.gp-remove-chat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = e.currentTarget.dataset.chatId;
            delete STATE.chatMap[id];
            await saveState();
            renderSidebarDOM(); // Recargar visualmente
        });
    });

    hideMappedChats();
}

function hideMappedChats() {
    const links = document.querySelectorAll('a[href*="/app/"]');
    links.forEach(link => {
        if (link.closest('#gp-sidebar-projects')) return; // Ignorar nuestros chats inyectados
        
        const match = link.getAttribute('href').match(/\/app\/([a-zA-Z0-9]+)/);
        if (match) {
            const id = match[1];
            const wrapper = link.closest('li') || link.parentElement;
            if (STATE.chatMap[id] && wrapper) {
                wrapper.style.display = 'none'; // Ocultar si está en un proyecto
            } else if (wrapper) {
                wrapper.style.display = ''; // Mostrar si fue desvinculado
            }
        }
    });
}

// --- 4. MODALES ---
function openNewProjectModal(chatDataToMove = null) {
    if (document.querySelector('.gp-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'gp-modal-overlay';
    
    let iconsHtml = ICONS.map((icon, i) => 
        `<div class="gp-icon-btn ${i===0 ? 'selected' : ''}" data-icon="${icon}">${icon}</div>`
    ).join('');

    overlay.innerHTML = `
        <div class="gp-modal-content">
            <button class="gp-modal-close">×</button>
            <h3 class="gp-modal-title">Create Project</h3>
            <input type="text" id="gp-proj-name" class="gp-input" placeholder="Project name" autofocus>
            <div class="gp-icon-grid">
                ${iconsHtml}
            </div>
            <button class="gp-btn-primary" id="gp-save-project">Create Project</button>
            <div style="clear:both;"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    let selectedIcon = ICONS[0];
    overlay.querySelectorAll('.gp-icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            overlay.querySelectorAll('.gp-icon-btn').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            selectedIcon = e.currentTarget.dataset.icon;
        });
    });

    overlay.querySelector('.gp-modal-close').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#gp-save-project').addEventListener('click', async () => {
        const name = document.getElementById('gp-proj-name').value.trim();
        if (name) {
            const newProj = { id: 'proj_' + Date.now().toString(), name: name, icon: selectedIcon };
            STATE.projects.push(newProj);
            
            if (chatDataToMove && chatDataToMove.id) {
                STATE.chatMap[chatDataToMove.id] = {
                    projectId: newProj.id,
                    title: chatDataToMove.title,
                    url: chatDataToMove.url
                };
            }
            
            await saveState();
            renderSidebarDOM(); 
            overlay.remove();
        }
    });
}

// --- 5. MENÚ CONTEXTUAL ---
let globalSubmenu = null;
let submenuTimeout = null;

function getOrCreateGlobalSubmenu() {
    if (globalSubmenu) return globalSubmenu;
    globalSubmenu = document.createElement('div');
    globalSubmenu.className = 'gp-submenu';
    document.body.appendChild(globalSubmenu);

    globalSubmenu.addEventListener('mouseenter', () => clearTimeout(submenuTimeout));
    globalSubmenu.addEventListener('mouseleave', () => {
        submenuTimeout = setTimeout(() => globalSubmenu.style.display = 'none', 200);
    });
    return globalSubmenu;
}

const observer = new MutationObserver((mutations) => {
    const menus = document.querySelectorAll('div[role="menu"], div.mat-mdc-menu-panel');
    menus.forEach(menu => {
        if (!menu.hasAttribute('data-gp-injected') && menu.innerHTML.includes('menuitem')) {
            injectContextMenu(menu);
        }
    });
});

function injectContextMenu(menuElement) {
    menuElement.setAttribute('data-gp-injected', 'true');
    
    const moveItem = document.createElement('div');
    moveItem.className = 'gp-context-menu-item';
    moveItem.innerHTML = `<span style="margin-right:12px; font-size:16px; opacity:0.8;">📁</span> Move to Project <span style="margin-left:auto">></span>`;
    
    moveItem.addEventListener('mouseenter', (e) => {
        clearTimeout(submenuTimeout);
        const subMenu = getOrCreateGlobalSubmenu();
        
        let subHtml = `<div class="gp-submenu-item" id="gp-ctx-new">📁 New Project</div>`;
        if (STATE.projects.length > 0) {
            subHtml += `<div style="border-top: 1px solid var(--gp-border-color); margin: 4px 0;"></div>`;
            STATE.projects.forEach(p => {
                subHtml += `<div class="gp-submenu-item gp-ctx-proj" data-proj-id="${p.id}">${p.icon} ${p.name}</div>`;
            });
        }
        subMenu.innerHTML = subHtml;

        subMenu.onclick = async (ev) => {
            ev.stopPropagation(); 
            const target = ev.target.closest('.gp-submenu-item');
            if (!target) return;

            // Chat capturado o chat en pantalla actual
            const chatToMove = lastClickedChat || { id: getCurrentChatId(), title: document.title.replace(' - Gemini', ''), url: window.location.pathname };

            if (!chatToMove.id) {
                alert("Por favor, abre el chat primero para poder moverlo.");
                document.body.click(); 
                subMenu.style.display = 'none';
                return;
            }

            if (target.id === 'gp-ctx-new') {
                openNewProjectModal(chatToMove);
            } else if (target.classList.contains('gp-ctx-proj')) {
                const projId = target.dataset.projId;
                STATE.chatMap[chatToMove.id] = {
                    projectId: projId,
                    title: chatToMove.title,
                    url: chatToMove.url
                };
                
                await saveState();
                renderSidebarDOM(); 
            }
            
            document.body.click(); 
            subMenu.style.display = 'none';
        };

        const rect = moveItem.getBoundingClientRect();
        subMenu.style.display = 'block';
        let topPos = rect.top;
        if (topPos + subMenu.offsetHeight > window.innerHeight) topPos = window.innerHeight - subMenu.offsetHeight - 10;
        subMenu.style.top = topPos + 'px';
        subMenu.style.left = (rect.right + 2) + 'px';
    });

    moveItem.addEventListener('mouseleave', () => {
        submenuTimeout = setTimeout(() => {
            if (globalSubmenu) globalSubmenu.style.display = 'none';
        }, 200);
    });

    menuElement.appendChild(moveItem);
}

observer.observe(document.body, { childList: true, subtree: true });
loadState();
