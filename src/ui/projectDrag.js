import { STATE, saveState } from '../state.js';
import {
    PROJECT_DRAG_START_DISTANCE_PX,
    PROJECT_TOGGLE_SUPPRESSION_MS
} from './constants.js';
import { rerenderSidebar } from './runtime.js';

let activeProjectDragId = null;
let activeProjectPointerDrag = null;
let suppressProjectToggleUntil = 0;

function clearProjectDropIndicators() {
    document.querySelectorAll('.gp-project-drop-before, .gp-project-drop-after').forEach(projectBlock => {
        projectBlock.classList.remove('gp-project-drop-before', 'gp-project-drop-after');
    });
}

function getProjectLink(projectId) {
    return document.querySelector(`.gp-proj-link[data-id="${projectId}"]`);
}

function getProjectInsertAfter(projectBlock, clientY) {
    const projectRow = projectBlock.querySelector('.gp-proj-link');
    if (!projectRow) {
        return false;
    }

    const rowRect = projectRow.getBoundingClientRect();
    return clientY >= rowRect.top + (rowRect.height / 2);
}

function updateProjectDropIndicator(projectBlock, insertAfter) {
    clearProjectDropIndicators();
    projectBlock.classList.add(insertAfter ? 'gp-project-drop-after' : 'gp-project-drop-before');
}

function moveProject(projectId, targetProjectId, insertAfter) {
    if (projectId === targetProjectId) {
        return false;
    }

    const originalOrder = STATE.projects.map(project => project.id).join('|');
    const sourceIndex = STATE.projects.findIndex(project => project.id === projectId);
    const targetIndex = STATE.projects.findIndex(project => project.id === targetProjectId);
    if (sourceIndex === -1 || targetIndex === -1) {
        return false;
    }

    const [movedProject] = STATE.projects.splice(sourceIndex, 1);
    const nextTargetIndex = STATE.projects.findIndex(project => project.id === targetProjectId);
    const insertionIndex = insertAfter ? nextTargetIndex + 1 : nextTargetIndex;
    STATE.projects.splice(insertionIndex, 0, movedProject);

    const nextOrder = STATE.projects.map(project => project.id).join('|');
    return originalOrder !== nextOrder;
}

function cleanupProjectPointerDrag() {
    document.removeEventListener('mousemove', handleProjectPointerMove);
    document.removeEventListener('mouseup', handleProjectPointerUp);

    if (activeProjectDragId) {
        getProjectLink(activeProjectDragId)?.classList.remove('gp-project-dragging');
    }

    document.body.style.userSelect = '';
    activeProjectDragId = null;
    activeProjectPointerDrag = null;
    clearProjectDropIndicators();
}

function handleProjectPointerDown(event) {
    if (event.button !== 0) {
        return;
    }

    if (event.target.closest('button')) {
        return;
    }

    const { id } = event.currentTarget.dataset;
    if (!id) {
        return;
    }

    activeProjectPointerDrag = {
        projectId: id,
        startX: event.clientX,
        startY: event.clientY,
        isDragging: false,
        dropProjectId: null,
        dropInsertAfter: false
    };

    document.addEventListener('mousemove', handleProjectPointerMove);
    document.addEventListener('mouseup', handleProjectPointerUp);
}

function handleProjectPointerMove(event) {
    if (!activeProjectPointerDrag) {
        return;
    }

    const deltaX = Math.abs(event.clientX - activeProjectPointerDrag.startX);
    const deltaY = Math.abs(event.clientY - activeProjectPointerDrag.startY);
    if (!activeProjectPointerDrag.isDragging) {
        if (Math.max(deltaX, deltaY) < PROJECT_DRAG_START_DISTANCE_PX) {
            return;
        }

        activeProjectPointerDrag.isDragging = true;
        activeProjectDragId = activeProjectPointerDrag.projectId;
        getProjectLink(activeProjectDragId)?.classList.add('gp-project-dragging');
        document.body.style.userSelect = 'none';
    }

    event.preventDefault();

    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
    const projectBlock = hoveredElement?.closest('.gp-project-block');
    const targetProjectId = projectBlock?.dataset.projectId || null;
    if (!projectBlock || !targetProjectId || targetProjectId === activeProjectDragId) {
        activeProjectPointerDrag.dropProjectId = null;
        clearProjectDropIndicators();
        return;
    }

    const insertAfter = getProjectInsertAfter(projectBlock, event.clientY);
    activeProjectPointerDrag.dropProjectId = targetProjectId;
    activeProjectPointerDrag.dropInsertAfter = insertAfter;
    updateProjectDropIndicator(projectBlock, insertAfter);
}

async function handleProjectPointerUp() {
    if (!activeProjectPointerDrag) {
        return;
    }

    const dragState = activeProjectPointerDrag;
    cleanupProjectPointerDrag();

    if (!dragState.isDragging || !dragState.dropProjectId) {
        return;
    }

    const didMoveProject = moveProject(dragState.projectId, dragState.dropProjectId, dragState.dropInsertAfter);
    if (!didMoveProject) {
        return;
    }

    suppressProjectToggleUntil = Date.now() + PROJECT_TOGGLE_SUPPRESSION_MS;
    await saveState();
    rerenderSidebar();
}

export function bindProjectPointerDrag(container) {
    container.querySelectorAll('.gp-proj-link').forEach(projectLink => {
        projectLink.addEventListener('mousedown', handleProjectPointerDown);
    });
}

export function shouldSuppressProjectToggle() {
    return Date.now() < suppressProjectToggleUntil;
}
