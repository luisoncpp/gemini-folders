import { STATE, saveState } from './state.js';
import { ChatState, getCurrentChatId } from './chatCapture.js';
import { renderSidebarDOM, openNewProjectModal } from './ui.js';

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

export const contextMenuObserver = new MutationObserver((mutations) => {
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

            const chatToMove = ChatState.lastClickedChat || { id: getCurrentChatId(), title: document.title.replace(' - Gemini', ''), url: window.location.pathname };

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
