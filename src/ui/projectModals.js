import { ICONS, STATE, saveState } from '../state.js';
import { rerenderSidebar } from './runtime.js';

const DEFAULT_PROJECT_ICON_INDEX = 0;

function hasOpenModal() {
    return Boolean(document.querySelector('.gp-modal-overlay'));
}

function buildProjectIconsHTML(selectedIcon) {
    return ICONS.map(icon => `
        <div class="gp-icon-btn ${icon === selectedIcon ? 'selected' : ''}" data-icon="${icon}">${icon}</div>
    `).join('');
}

function buildProjectModalHTML(title, submitLabel, projectName, selectedIcon) {
    return `
        <div class="gp-modal-content">
            <button class="gp-modal-close">x</button>
            <h3 class="gp-modal-title">${title}</h3>
            <input type="text" id="gp-proj-name" class="gp-input" value="${projectName}" placeholder="Project name" autofocus>
            <div class="gp-icon-grid">
                ${buildProjectIconsHTML(selectedIcon)}
            </div>
            <button class="gp-btn-primary" id="gp-save-project">${submitLabel}</button>
            <div style="clear:both;"></div>
        </div>
    `;
}

function bindProjectIconSelection(overlay, onSelect) {
    overlay.querySelectorAll('.gp-icon-btn').forEach(button => {
        button.addEventListener('click', event => {
            overlay.querySelectorAll('.gp-icon-btn').forEach(iconButton => iconButton.classList.remove('selected'));
            event.currentTarget.classList.add('selected');
            onSelect(event.currentTarget.dataset.icon);
        });
    });
}

export function openNewProjectModal(chatDataToMove = null) {
    if (hasOpenModal()) {
        return;
    }

    const overlay = document.createElement('div');
    const defaultIcon = ICONS[DEFAULT_PROJECT_ICON_INDEX];
    overlay.className = 'gp-modal-overlay';
    overlay.innerHTML = buildProjectModalHTML('Create Project', 'Create Project', '', defaultIcon);
    document.body.appendChild(overlay);

    let selectedIcon = defaultIcon;
    bindProjectIconSelection(overlay, icon => {
        selectedIcon = icon;
    });

    const projectNameInput = overlay.querySelector('#gp-proj-name');
    overlay.querySelector('.gp-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#gp-save-project').addEventListener('click', async () => {
        const name = projectNameInput.value.trim();
        if (!name) {
            return;
        }

        const newProject = {
            id: `proj_${Date.now()}`,
            name,
            icon: selectedIcon
        };
        STATE.projects.push(newProject);

        if (chatDataToMove?.id) {
            STATE.chatMap[chatDataToMove.id] = {
                projectId: newProject.id,
                title: chatDataToMove.title,
                url: chatDataToMove.url
            };
        }

        await saveState();
        rerenderSidebar();
        overlay.remove();
    });
}

export function openEditProjectModal(projectId) {
    if (hasOpenModal()) {
        return;
    }

    const project = STATE.projects.find(item => item.id === projectId);
    if (!project) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'gp-modal-overlay';
    overlay.innerHTML = buildProjectModalHTML('Edit Project', 'Save Changes', project.name, project.icon);
    document.body.appendChild(overlay);

    let selectedIcon = project.icon;
    bindProjectIconSelection(overlay, icon => {
        selectedIcon = icon;
    });

    const projectNameInput = overlay.querySelector('#gp-proj-name');
    overlay.querySelector('.gp-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#gp-save-project').addEventListener('click', async () => {
        const name = projectNameInput.value.trim();
        if (!name) {
            return;
        }

        project.name = name;
        project.icon = selectedIcon;

        await saveState();
        rerenderSidebar();
        overlay.remove();
    });
}
