import { STATE, saveState } from '../state.js';
import {
    CHAT_ACTIONS_MENU_ID,
    CHAT_ACTIONS_MENU_OFFSET_PX,
    MENU_VIEWPORT_PADDING_PX
} from './constants.js';
import { openRenameChatModal } from './chatModals.js';
import { rerenderSidebar } from './runtime.js';

let activeChatMenu = null;

document.addEventListener('mousedown', handleDocumentPointerDown);
document.addEventListener('keydown', handleDocumentKeyDown);
window.addEventListener('resize', hideChatActionsMenu);
document.addEventListener('scroll', hideChatActionsMenu, true /* useCapture */);

function handleDocumentPointerDown(event) {
    if (!activeChatMenu) {
        return;
    }

    const menu = document.getElementById(CHAT_ACTIONS_MENU_ID);
    if (!menu) {
        activeChatMenu = null;
        return;
    }

    if (menu.contains(event.target)) {
        return;
    }

    if (activeChatMenu.triggerButton?.contains(event.target)) {
        return;
    }

    hideChatActionsMenu();
}

function handleDocumentKeyDown(event) {
    if (event.key !== 'Escape') {
        return;
    }

    hideChatActionsMenu();
}

function getOrCreateChatActionsMenu() {
    let menu = document.getElementById(CHAT_ACTIONS_MENU_ID);
    if (menu) {
        return menu;
    }

    menu = document.createElement('div');
    menu.id = CHAT_ACTIONS_MENU_ID;
    menu.className = 'gp-submenu gp-chat-actions-menu';
    menu.addEventListener('click', handleChatActionsMenuClick);
    document.body.appendChild(menu);
    return menu;
}

function hideChatActionsMenu() {
    const menu = document.getElementById(CHAT_ACTIONS_MENU_ID);
    if (menu) {
        menu.style.display = 'none';
        menu.innerHTML = '';
    }

    activeChatMenu = null;
}

function positionFloatingMenu(menu, triggerButton) {
    const rect = triggerButton.getBoundingClientRect();

    menu.style.visibility = 'hidden';
    menu.style.display = 'block';

    const maxLeft = window.innerWidth - menu.offsetWidth - MENU_VIEWPORT_PADDING_PX;
    const preferredLeft = rect.right - menu.offsetWidth;
    const left = Math.max(MENU_VIEWPORT_PADDING_PX, Math.min(preferredLeft, maxLeft));

    let top = rect.bottom + CHAT_ACTIONS_MENU_OFFSET_PX;
    const maxTop = window.innerHeight - menu.offsetHeight - MENU_VIEWPORT_PADDING_PX;
    if (top > maxTop) {
        top = rect.top - menu.offsetHeight - CHAT_ACTIONS_MENU_OFFSET_PX;
    }

    menu.style.left = `${Math.max(MENU_VIEWPORT_PADDING_PX, left)}px`;
    menu.style.top = `${Math.max(MENU_VIEWPORT_PADDING_PX, top)}px`;
    menu.style.visibility = 'visible';
}

function buildChatActionsMenuHTML(chatId, showProjectOptions) {
    const chatData = STATE.chatMap[chatId];
    if (!chatData) {
        return '';
    }

    let html = `
        <button class="gp-submenu-item gp-chat-menu-item" data-chat-menu-action="rename" data-chat-id="${chatId}">
            <span>Rename</span>
        </button>
        <button class="gp-submenu-item gp-chat-menu-item" data-chat-menu-action="move" data-chat-id="${chatId}">
            <span>Move to project</span>
            <span style="margin-left:auto; opacity:0.7;">></span>
        </button>
    `;

    if (showProjectOptions) {
        html += '<div class="gp-chat-menu-divider"></div>';

        if (STATE.projects.length === 0) {
            html += `
                <div class="gp-submenu-item gp-chat-menu-empty">
                    <span>No projects available</span>
                </div>
            `;
        } else {
            STATE.projects.forEach(project => {
                const isCurrentProject = project.id === chatData.projectId;
                html += `
                    <button class="gp-submenu-item gp-chat-menu-item" data-chat-menu-action="move-project" data-chat-id="${chatId}" data-project-id="${project.id}">
                        <span>${isCurrentProject ? '✓' : project.icon}</span>
                        <span>${project.name}</span>
                    </button>
                `;
            });
        }
    }

    html += `
        <div class="gp-chat-menu-divider"></div>
        <button class="gp-submenu-item gp-chat-menu-item" data-chat-menu-action="remove" data-chat-id="${chatId}">
            <span>Remove from projects</span>
        </button>
    `;

    return html;
}

export function toggleChatActionsMenu(triggerButton, chatId) {
    const menu = getOrCreateChatActionsMenu();
    const isSameChat = activeChatMenu?.chatId === chatId;
    const isVisible = menu.style.display === 'block';

    if (isSameChat && isVisible && !activeChatMenu.showProjectOptions) {
        hideChatActionsMenu();
        return;
    }

    activeChatMenu = {
        chatId,
        triggerButton,
        showProjectOptions: false
    };

    menu.innerHTML = buildChatActionsMenuHTML(chatId, false /* showProjectOptions */);
    positionFloatingMenu(menu, triggerButton);
}

function showMoveToProjectOptions() {
    if (!activeChatMenu) {
        return;
    }

    const menu = getOrCreateChatActionsMenu();
    activeChatMenu = {
        ...activeChatMenu,
        showProjectOptions: true
    };

    menu.innerHTML = buildChatActionsMenuHTML(activeChatMenu.chatId, true /* showProjectOptions */);
    positionFloatingMenu(menu, activeChatMenu.triggerButton);
}

async function moveChatToProject(chatId, projectId) {
    const chatData = STATE.chatMap[chatId];
    if (!chatData) {
        hideChatActionsMenu();
        return;
    }

    if (chatData.projectId === projectId) {
        hideChatActionsMenu();
        return;
    }

    const targetProject = STATE.projects.find(project => project.id === projectId);
    if (!targetProject) {
        hideChatActionsMenu();
        return;
    }

    STATE.chatMap[chatId] = {
        ...chatData,
        projectId
    };

    await saveState();
    hideChatActionsMenu();
    rerenderSidebar();
}

async function removeChatFromProjects(chatId) {
    if (!STATE.chatMap[chatId]) {
        hideChatActionsMenu();
        return;
    }

    delete STATE.chatMap[chatId];
    await saveState();
    hideChatActionsMenu();
    rerenderSidebar();
}

async function handleChatActionsMenuClick(event) {
    event.stopPropagation();

    const actionButton = event.target.closest('[data-chat-menu-action]');
    if (!actionButton) {
        return;
    }

    const { chatId, chatMenuAction, projectId } = actionButton.dataset;

    if (chatMenuAction === 'rename') {
        hideChatActionsMenu();
        openRenameChatModal(chatId);
        return;
    }

    if (chatMenuAction === 'move') {
        showMoveToProjectOptions();
        return;
    }

    if (chatMenuAction === 'move-project') {
        await moveChatToProject(chatId, projectId);
        return;
    }

    if (chatMenuAction === 'remove') {
        await removeChatFromProjects(chatId);
    }
}
