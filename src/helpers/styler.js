const TRANSITION_DURATION_SECONDS = 0.2;

/**
 * private helper function - creates a transition string for a property
 * @param {string} property
 * @return {string} - the transition string
 */
function trs(property) {
    return `${property} ${TRANSITION_DURATION_SECONDS}s ease`;
}
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
    draggedEl.style.transition = `${trs('width')}, ${trs('height')}, ${trs('background-color')}, ${trs('opacity')}, ${trs('color')} `;
    // this is a workaround for a strange browser bug that causes the right border to disappear when all the transitions are added at the same time
    window.setTimeout(() => draggedEl.style.transition +=`, ${trs('top')}, ${trs('left')}`,0);
    draggedEl.style.zIndex = 9999;
    draggedEl.style.cursor = 'grabbing';
    return draggedEl;
}

/**
 * styles the dragged element to a 'dropped' state
 * @param {HTMLElement} draggedEl
 */
export function moveDraggedElementToWasDroppedState(draggedEl) {
    draggedEl.style.cursor = 'grab';
}

/**
 * Morphs the dragged element style, maintains the mouse pointer within the element
 * @param {HTMLElement} draggedEl
 * @param {HTMLElement} copyFromEl - the element the dragged element should look like, typically the shadow element
 * @param {number} currentMouseX
 * @param {number} currentMouseY
 */
export function morphDraggedElementToBeLike(draggedEl, copyFromEl, currentMouseX, currentMouseY) {
    const newRect = copyFromEl.getBoundingClientRect();
    const draggedElRect = draggedEl.getBoundingClientRect();
    const widthChange = newRect.width - draggedElRect.width;
    const heightChange = newRect.height - draggedElRect.height;
    if (widthChange || heightChange) {
        const relativeDistanceOfMousePointerFromDraggedSides = {
            left: (currentMouseX - draggedElRect.left) / draggedElRect.width,
            top: (currentMouseY - draggedElRect.top) / draggedElRect.height
        };
        draggedEl.style.height = `${newRect.height}px`;
        draggedEl.style.width = `${newRect.width}px`;
        draggedEl.style.left = `${parseFloat(draggedEl.style.left) - relativeDistanceOfMousePointerFromDraggedSides.left * widthChange}px`;
        draggedEl.style.top = `${parseFloat(draggedEl.style.top) - relativeDistanceOfMousePointerFromDraggedSides.top * heightChange}px`;
    }

    /// other properties
    const computedStyle = window.getComputedStyle(copyFromEl);
    Array.from(computedStyle)
        .filter(s => s.startsWith('background') || s.startsWith('padding') || s.startsWith('font') || s.startsWith('text') || s.startsWith('align') ||
        s.startsWith('justify') || s.startsWith('display') || s.startsWith('flex') || s.startsWith('border') || s === 'opacity' || s === 'color')
        .forEach(s =>
            draggedEl.style.setProperty(s, computedStyle.getPropertyValue(s), computedStyle.getPropertyPriority(s))
        );
}

/**
 * makes the element compatible with being draggable
 * @param {HTMLElement} draggableEl
 */
export function styleDraggable(draggableEl) {
    draggableEl.draggable = false;
    draggableEl.ondragstart = () => false;
    draggableEl.style.userSelect = 'none';
    draggableEl.style.cursor = 'grab';
}

/**
 * styles the shadow element
 * @param {HTMLElement} shadowEl
 */
export function styleShadowEl(shadowEl) {
    shadowEl.style.visibility = "hidden";
}

/**
 * will mark the given dropzones as visually active
 * @param {Array<HTMLElement>} dropZones
 */
export function styleActiveDropZones(dropZones) {
    dropZones.forEach(dz => {
        dz.style.outline = 'rgba(255, 255, 102, 0.7) solid 2px';
    });
}

/**
 * will remove the 'active' styling from given dropzones
 * @param {Array<HTMLElement>} dropZones
 */
export function styleInActiveDropZones(dropZones) {
    dropZones.forEach(dz => {
        dz.style.outline = '';
    });
}