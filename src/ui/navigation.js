import { STATE } from '../state.js';
import { CHAT_ID_PATTERN, CHAT_LINK_SELECTOR } from './constants.js';

function findNativeChatLink(chatId) {
    return Array.from(document.querySelectorAll(`${CHAT_LINK_SELECTOR}:not(.gp-chat-item)`)).find(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(CHAT_ID_PATTERN);
        return match && match[1] === chatId;
    }) || null;
}

export function triggerNativeChatNavigation(chatId) {
    const nativeLink = findNativeChatLink(chatId);
    if (!nativeLink) {
        return;
    }

    nativeLink.click();
}

export function hideMappedChats() {
    const links = document.querySelectorAll(CHAT_LINK_SELECTOR);
    links.forEach(link => {
        if (link.closest('#gp-sidebar-projects')) {
            return;
        }

        const href = link.getAttribute('href') || '';
        const match = href.match(CHAT_ID_PATTERN);
        if (!match) {
            return;
        }

        const chatId = match[1];
        const wrapper = link.closest('li') || link.parentElement;
        if (!wrapper) {
            return;
        }

        wrapper.style.display = STATE.chatMap[chatId] ? 'none' : '';
    });
}
