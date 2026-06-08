import { STATE, saveState } from '../state.js';
import { rerenderSidebar } from './runtime.js';

function hasOpenModal() {
    return Boolean(document.querySelector('.gp-modal-overlay'));
}

export function openRenameChatModal(chatId) {
    if (hasOpenModal()) {
        return;
    }

    const chatData = STATE.chatMap[chatId];
    if (!chatData) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'gp-modal-overlay';
    overlay.innerHTML = `
        <div class="gp-modal-content">
            <button class="gp-modal-close">x</button>
            <h3 class="gp-modal-title">Rename conversation</h3>
            <input type="text" id="gp-chat-name" class="gp-input" autofocus>
            <button class="gp-btn-primary" id="gp-save-chat-name">Save</button>
            <div style="clear:both;"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    const chatNameInput = overlay.querySelector('#gp-chat-name');
    chatNameInput.value = chatData.title || '';
    chatNameInput.focus();
    chatNameInput.select();

    overlay.querySelector('.gp-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#gp-save-chat-name').addEventListener('click', async () => {
        const nextTitle = chatNameInput.value.trim();
        if (!nextTitle) {
            return;
        }

        STATE.chatMap[chatId] = {
            ...chatData,
            title: nextTitle
        };

        await saveState();
        rerenderSidebar();
        overlay.remove();
    });
}
