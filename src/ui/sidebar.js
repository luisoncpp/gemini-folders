import {
    createNewSyncFile,
    importBackupData,
    openExistingSyncFile,
    saveState,
    STATE
} from '../state.js';
import {
    CHATS_SECTION_LABELS,
    SIDEBAR_ANCHOR_SEARCH_DEPTH,
    SIDEBAR_RENDER_INTERVAL_MS
} from './constants.js';
import { bindProjectPointerDrag, shouldSuppressProjectToggle } from './projectDrag.js';
import { openEditProjectModal, openNewProjectModal } from './projectModals.js';
import { hideMappedChats, triggerNativeChatNavigation } from './navigation.js';
import { setSidebarRerenderHandler } from './runtime.js';
import { toggleChatActionsMenu } from './chatActionsMenu.js';

let sidebarAnchorNode = null;

function buildProjectChatsHTML(projectId, isProjectCollapsed) {
    const projectChats = Object.entries(STATE.chatMap).filter(([, data]) => data.projectId === projectId);
    if (projectChats.length === 0) {
        return '';
    }

    let html = `<div class="gp-project-chats" style="display: ${isProjectCollapsed ? 'none' : 'flex'};">`;
    projectChats.forEach(([chatId, data]) => {
        html += `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <a href="${data.url}" class="gp-chat-item" data-chat-id="${chatId}" title="${data.title}" style="flex-grow:1; overflow:hidden; text-overflow:ellipsis;">
                    📄 ${data.title}
                </a>
                <button class="gp-chat-actions-btn" data-chat-id="${chatId}" title="Conversation actions"
                        style="background:none; border:none; color:var(--gp-text-secondary); cursor:pointer; padding:4px 8px; font-size:16px; opacity:0.7; line-height:1;">
                    ⋮
                </button>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function buildSidebarHTML() {
    let html = `
        <div class="gp-sidebar-header">
            <div id="gp-sidebar-toggle" style="display: flex; align-items: center; gap: 8px; flex-grow: 1;">
                <span>Projects</span>
                <span style="font-size:11px; opacity:0.8; transform: ${STATE.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s; display: inline-block;">▼</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span id="gp-sync-new-btn" title="Create a new sync file in Google Drive" style="cursor:pointer; font-size:16px; opacity:0.8;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">☁️</span>
                <span id="gp-sync-open-btn" title="Link an existing sync file" style="cursor:pointer; font-size:16px; opacity:0.8;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">🔗</span>
                <span id="gp-import-btn" title="Import data from a backup JSON" style="cursor:pointer; font-size:16px; opacity:0.8;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">📥</span>
            </div>
        </div>
        <div class="gp-project-list" style="display: ${STATE.isCollapsed ? 'none' : 'flex'};">
            <div class="gp-project-item" id="gp-new-project-btn">
                <span class="gp-project-icon" style="font-size:18px;">+</span>
                <span>New Project</span>
            </div>
    `;

    STATE.projects.forEach(project => {
        const isProjectCollapsed = project.isCollapsed || false;
        html += `
            <div class="gp-project-block" data-project-id="${project.id}">
                <div class="gp-project-item gp-proj-link" data-id="${project.id}" style="justify-content: space-between;">
                    <div style="display:flex; align-items:center; flex-grow:1; overflow:hidden;">
                        <span class="gp-project-drag-handle" title="Drag to reorder">⋮⋮</span>
                        <span class="gp-project-icon">${project.icon}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${project.name}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap: 4px;">
                        <button class="gp-edit-project-btn" data-id="${project.id}" title="Edit Project" style="background:none; border:none; color:var(--gp-text-secondary); cursor:pointer; padding:2px; font-size:12px; opacity:0.5;">✏️</button>
                        <button class="gp-delete-project-btn" data-id="${project.id}" title="Delete Project" style="background:none; border:none; color:var(--gp-text-secondary); cursor:pointer; padding:2px; font-size:12px; opacity:0.5;">🗑️</button>
                        <span style="font-size:10px; opacity:0.6; transform: ${isProjectCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s; padding-left: 4px;">▼</span>
                    </div>
                </div>
                ${buildProjectChatsHTML(project.id, isProjectCollapsed)}
            </div>
        `;
    });

    html += '</div>';
    return html;
}

async function handleProjectDelete(projectId) {
    if (!window.confirm('Are you sure you want to delete this project? Its chats will be unassigned.')) {
        return;
    }

    STATE.projects = STATE.projects.filter(project => project.id !== projectId);
    Object.keys(STATE.chatMap).forEach(chatId => {
        if (STATE.chatMap[chatId].projectId === projectId) {
            delete STATE.chatMap[chatId];
        }
    });

    await saveState();
    renderSidebarDOM();
}

function bindSidebarEvents(container) {
    document.getElementById('gp-sidebar-toggle')?.addEventListener('click', async () => {
        STATE.isCollapsed = !STATE.isCollapsed;
        await saveState();
        renderSidebarDOM();
    });

    document.getElementById('gp-new-project-btn')?.addEventListener('click', () => openNewProjectModal());

    document.getElementById('gp-sync-new-btn')?.addEventListener('click', async () => {
        await createNewSyncFile();
        renderSidebarDOM();
    });

    document.getElementById('gp-sync-open-btn')?.addEventListener('click', async () => {
        await openExistingSyncFile();
        renderSidebarDOM();
    });

    document.getElementById('gp-import-btn')?.addEventListener('click', async () => {
        await importBackupData();
        renderSidebarDOM();
    });

    container.querySelectorAll('.gp-chat-item').forEach(link => {
        link.addEventListener('click', event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            event.preventDefault();
            triggerNativeChatNavigation(event.currentTarget.dataset.chatId);
        });
    });

    container.querySelectorAll('.gp-proj-link').forEach(projectLink => {
        projectLink.addEventListener('click', async event => {
            if (shouldSuppressProjectToggle()) {
                return;
            }

            const projectId = event.currentTarget.dataset.id;
            const project = STATE.projects.find(item => item.id === projectId);
            if (!project) {
                return;
            }

            project.isCollapsed = !project.isCollapsed;
            await saveState();
            renderSidebarDOM();
        });
    });

    bindProjectPointerDrag(container);

    container.querySelectorAll('.gp-edit-project-btn').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            openEditProjectModal(event.currentTarget.dataset.id);
        });
    });

    container.querySelectorAll('.gp-delete-project-btn').forEach(button => {
        button.addEventListener('click', async event => {
            event.stopPropagation();
            await handleProjectDelete(event.currentTarget.dataset.id);
        });
    });

    container.querySelectorAll('.gp-chat-actions-btn').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            toggleChatActionsMenu(event.currentTarget, event.currentTarget.dataset.chatId);
        });
    });
}

export function startSidebarObserver() {
    setInterval(attemptRenderSidebar, SIDEBAR_RENDER_INTERVAL_MS);
}

function attemptRenderSidebar() {
    if (document.getElementById('gp-sidebar-projects')) {
        return;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false /* entityReferenceExpansion */);
    let node = null;
    let chatsTextNode = null;
    while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (CHATS_SECTION_LABELS.includes(text)) {
            chatsTextNode = node.parentElement;
            break;
        }
    }

    if (!chatsTextNode) {
        return;
    }

    let targetBlock = chatsTextNode;
    let foundContainer = false;
    for (let index = 0; index < SIDEBAR_ANCHOR_SEARCH_DEPTH; index += 1) {
        if (!targetBlock.parentElement || targetBlock.parentElement.tagName === 'BODY') {
            break;
        }

        targetBlock = targetBlock.parentElement;
        if (targetBlock.parentNode && targetBlock.parentNode.children.length > 2) {
            foundContainer = true;
            break;
        }
    }

    if (!foundContainer || !targetBlock) {
        console.log('[Gemini Projects] attemptRenderSidebar: Found section label but failed to resolve container.', {
            foundContainer,
            targetBlock
        });
        return;
    }

    console.log('[Gemini Projects] attemptRenderSidebar: Found container and target block. Injecting...');
    sidebarAnchorNode = targetBlock;
    renderSidebarDOM();
}

export function renderSidebarDOM() {
    if (!sidebarAnchorNode) {
        console.error('[Gemini Projects] renderSidebarDOM called but sidebarAnchorNode is null!');
        return;
    }

    try {
        let container = document.getElementById('gp-sidebar-projects');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gp-sidebar-projects';
            container.className = 'gp-sidebar-section';
            sidebarAnchorNode.insertAdjacentElement('beforebegin', container);
            console.log('[Gemini Projects] Injected new container into DOM.');
        }

        container.innerHTML = buildSidebarHTML();
        bindSidebarEvents(container);
        hideMappedChats();
        console.log('[Gemini Projects] renderSidebarDOM finished successfully.');
    } catch (error) {
        console.error('[Gemini Projects] Error during renderSidebarDOM:', error);
    }
}

setSidebarRerenderHandler(renderSidebarDOM);
