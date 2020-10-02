// external events
const FINALIZE_EVENT_NAME = 'finalize';
const CONSIDER_EVENT_NAME = 'consider';

/**
 * @typedef {Object} Info
 * @property {string} trigger
 * @property {string} id
 * @property {string} source
 * @param {Node} el
 * @param {Array} items
 * @param {Info} info
 */
export function dispatchFinalizeEvent(el, items, info) {
    el.dispatchEvent(new CustomEvent(FINALIZE_EVENT_NAME, {
        detail: {items, info}
    }));
}

/**
 * Dispatches a consider event
 * @param {Node} el
 * @param {Array} items
 * @param {Info} info
 */
export function dispatchConsiderEvent(el, items, info) {
    el.dispatchEvent(new CustomEvent(CONSIDER_EVENT_NAME, {
        detail: {items, info}
    }));
}

// internal events
export const DRAGGED_ENTERED_EVENT_NAME = 'draggedEntered';
export const DRAGGED_LEFT_EVENT_NAME = 'draggedLeft';
export const DRAGGED_OVER_INDEX_EVENT_NAME = 'draggedOverIndex';
export const DRAGGED_LEFT_DOCUMENT_EVENT_NAME = 'draggedLeftDocument';
export function dispatchDraggedElementEnteredContainer(containerEl, indexObj, draggedEl) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_ENTERED_EVENT_NAME, {
        detail: {indexObj, draggedEl}
    }));
}
export function dispatchDraggedElementLeftContainer(containerEl, draggedEl) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_LEFT_EVENT_NAME, {
        detail: {draggedEl}
    }));
}
export function dispatchDraggedElementIsOverIndex(containerEl, indexObj, draggedEl) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_OVER_INDEX_EVENT_NAME, {
        detail: {indexObj, draggedEl}
    }));
}
export function dispatchDraggedLeftDocument(draggedEl) {
    window.dispatchEvent(new CustomEvent(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, {
        detail: { draggedEl}
    }));
}
