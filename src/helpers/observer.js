import {findWouldBeIndex} from './listUtil';
import {findCenterOfElement, isElementOffDocument} from "./intersection";
import {dispatchDraggedElementEnteredContainer, 
        dispatchDraggedElementLeftContainer,
        dispatchDraggedLeftDocument,
        dispatchDraggedElementIsOverIndex} 
    from './dispatcher';
import {makeScroller} from "./scroller";

const INTERVAL_MS = 200;
const TOLERANCE_PX = 10;
const {scrollIfNeeded, resetScrolling} = makeScroller();
let next;


/**
 * Tracks the dragged elements and performs the side effects when it is dragged over a drop zone (basically dispatching custom-events scrolling)
 * @param {Set<HTMLElement>} dropZones 
 * @param {HTMLElement} draggedEl 
 * @param {number} [intervalMs = INTERVAL_MS]
 */
export function observe(draggedEl, dropZones, intervalMs = INTERVAL_MS) {
    // initialization
    let lastDropZoneFound;
    let lastIndexFound;
    let lastIsDraggedInADropZone = false;
    let lastCentrePositionOfDragged;

    /**
     * The main function in this module. Tracks where everything is/ should be a take the actions
     */
    function andNow() {
        const currentCenterOfDragged = findCenterOfElement(draggedEl);
        const scrolled = scrollIfNeeded(currentCenterOfDragged, lastDropZoneFound);
        // we only want to make a new decision after the element was moved a bit to prevent flickering
        if (!scrolled && lastCentrePositionOfDragged &&
            Math.abs(lastCentrePositionOfDragged.x - currentCenterOfDragged.x) < TOLERANCE_PX &&
            Math.abs(lastCentrePositionOfDragged.y - currentCenterOfDragged.y) < TOLERANCE_PX ) {
            next = window.setTimeout(andNow, intervalMs);
            return;
        }
        if (isElementOffDocument(draggedEl)) {
            console.debug("off document");
            dispatchDraggedLeftDocument(draggedEl);
            return;
        }

        lastCentrePositionOfDragged = currentCenterOfDragged;
        // this is a simple algorithm, potential improvement: first look at lastDropZoneFound
        let isDraggedInADropZone = false
        for (const dz of dropZones) {
            const indexObj = findWouldBeIndex(draggedEl, dz);
            if (indexObj === null) {
               // it is not inside
               continue;     
            }
            const {index} = indexObj;
            isDraggedInADropZone = true;
            // the element is over a container
            if (dz !== lastDropZoneFound) {
                lastDropZoneFound && dispatchDraggedElementLeftContainer(lastDropZoneFound, draggedEl);
                dispatchDraggedElementEnteredContainer(dz, indexObj, draggedEl);
                lastDropZoneFound = dz;
                lastIndexFound = index;
            }
            else if (index !== lastIndexFound) {
                dispatchDraggedElementIsOverIndex(dz, indexObj, draggedEl);
                lastIndexFound = index;
            }
            // we handle looping with the 'continue' statement above
            break;
        }
        // the first time the dragged element is not in any dropzone we need to notify the last dropzone it was in
        if (!isDraggedInADropZone && lastIsDraggedInADropZone && lastDropZoneFound) {
            dispatchDraggedElementLeftContainer(lastDropZoneFound, draggedEl);
            lastDropZoneFound = undefined;
            lastIndexFound = undefined;
            lastIsDraggedInADropZone = false;
        } else {
            lastIsDraggedInADropZone = true;
        }
        next = window.setTimeout(andNow, intervalMs);
    }
    andNow();
}

// assumption - we can only observe one dragged element at a time, this could be changed in the future
export function unobserve() {
    console.debug("unobserving");
    clearTimeout(next);
    resetScrolling();
}