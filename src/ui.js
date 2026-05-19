import { STATE, ICONS, saveState } from './state.js';

let sidebarAnchorNode = null;

export function startSidebarObserver() {
    setInterval(attemptRenderSidebar, 1000);
}

function attemptRenderSidebar() {
    if (document.getElementById('gp-sidebar-projects')) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node, chatsTextNode = null;
    while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (['Chats', 'Conversaciones', 'Recent', 'Recientes', 'Conversations'].includes(text)) { 
            chatsTextNode = node.parentElement; 
            break; 
        }
    }
    if (!chatsTextNode) {
        return;
    }

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
        console.log("[Gemini Projects] attemptRenderSidebar: Found container and target block. Injecting...");
        sidebarAnchorNode = targetBlock;
        renderSidebarDOM();
    } else {
        console.log("[Gemini Projects] attemptRenderSidebar: Found 'Chats' but failed to resolve container. foundContainer:", foundContainer, "targetBlock:", targetBlock);
    }
}

export function renderSidebarDOM() {
    if (!sidebarAnchorNode) {
        console.error("[Gemini Projects] renderSidebarDOM called but sidebarAnchorNode is null!");
        return;
    }

    try {
        let container = document.getElementById('gp-sidebar-projects');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gp-sidebar-projects';
            container.className = 'gp-sidebar-section';
            sidebarAnchorNode.insertAdjacentElement('beforebegin', container);
            console.log("[Gemini Projects] Injected new container into DOM.");
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

    document.getElementById('gp-sidebar-toggle')?.addEventListener('click', async () => {
        STATE.isCollapsed = !STATE.isCollapsed;
        await saveState();
        renderSidebarDOM();
    });

    document.getElementById('gp-new-project-btn')?.addEventListener('click', () => openNewProjectModal());
    
    container.querySelectorAll('.gp-chat-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.currentTarget.getAttribute('href');
            const nativeLink = document.querySelector(`a[href="${url}"]:not(.gp-chat-item)`);
            if (nativeLink) {
                nativeLink.click();
            } else {
                window.location.href = url;
            }
        });
    });

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

    container.querySelectorAll('.gp-remove-chat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = e.currentTarget.dataset.chatId;
            delete STATE.chatMap[id];
            await saveState();
            renderSidebarDOM();
        });
    });

    hideMappedChats();
    console.log("[Gemini Projects] renderSidebarDOM finished successfully.");
    } catch (e) {
        console.error("[Gemini Projects] Error during renderSidebarDOM:", e);
    }
}

export function hideMappedChats() {
    const links = document.querySelectorAll('a[href*="/app/"]');
    links.forEach(link => {
        if (link.closest('#gp-sidebar-projects')) return;
        
        const match = link.getAttribute('href').match(/\/app\/([a-zA-Z0-9]+)/);
        if (match) {
            const id = match[1];
            const wrapper = link.closest('li') || link.parentElement;
            if (STATE.chatMap[id] && wrapper) {
                wrapper.style.display = 'none';
            } else if (wrapper) {
                wrapper.style.display = '';
            }
        }
    });
}

export function openNewProjectModal(chatDataToMove = null) {
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
