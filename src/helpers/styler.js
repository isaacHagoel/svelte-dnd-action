/**
 * clones the given element and applies proper styles and transitions to the dragged element
 * @param {HTMLElement} originalElement
 * @return {Node} - the cloned, styled element
 */
export function createDraggedElementFrom(originalElement) {
    const rect = originalElement.getBoundingClientRect();
    const draggedEl = originalElement.cloneNode(true);
    draggedEl.style.position = "fixed";
    draggedEl.style.top = `${rect.top}px`;
    draggedEl.style.left = `${rect.left}px`;
    draggedEl.style.margin = 0;
    // we can't have relative or automatic height and width or it will break the illusion
    draggedEl.style.height = `${rect.height}px`;
    draggedEl.style.width = `${rect.width}px`;
    draggedEl.style.transition = 'width 0.2s ease, height 0.2s ease';
    // this is a workaround for a strange browser bug that causes the right border to disappear when all the transitions are added at the same time
    window.setTimeout(() => draggedEl.style.transition +=', top 0.2s ease, left 0.2s ease',0);
    draggedEl.style.zIndex = 9999;
    return draggedEl;
}