import { findWouldBeIndex, resetCache } from "./listUtil";
import { findCenterOfElement, isElementOffDocument } from "./intersection";
import {
    dispatchDraggedElementEnteredContainer,
    dispatchDraggedElementLeftContainerForAnother,
    dispatchDraggedElementLeftContainerForNone,
    dispatchDraggedLeftDocument,
    dispatchDraggedElementIsOverIndex
} from "./dispatcher";
import { makeScroller } from "./scroller";
import { getDepth } from "./util";
import { printDebug } from "../constants";

const INTERVAL_MS = 200;
const TOLERANCE_PX = 10;
const { scrollIfNeeded, resetScrolling } = makeScroller();
let next;

/**
 * Tracks the dragged elements and performs the side effects when it is dragged over a drop zone (basically dispatching custom-events scrolling)
 * @param {Set<HTMLElement>} dropZones
 * @param {HTMLElement} draggedEl
 * @param {number} [intervalMs = INTERVAL_MS]
 */
export function observe(draggedEl, dropZones, intervalMs = INTERVAL_MS) {
    // initialization
    resetCache();
    let lastDropZoneFound;
    let lastIndexFound;
    let lastIsDraggedInADropZone = false;
    let lastCentrePositionOfDragged;
    // We are sorting to make sure that in case of nested zones of the same type the one "on top" is considered first
    const dropZonesFromDeepToShallow = Array.from(dropZones).sort((dz1, dz2) => getDepth(dz2) - getDepth(dz1));

    let lastDirection = {
        y: undefined,
        x: undefined
    };
    function directionInversed(direction) {
        let result = false;

        if (lastDirection.y === 0 || lastDirection.y === undefined ) {
            result = false;
        } else if (lastDirection.y !== direction.y) {
            result = true;
        }

        lastDirection = direction;
        return result;
    }

    /**
     * The main function in this module. Tracks where everything is/ should be a take the actions
     */
    function andNow() {
        const currentCenterOfDragged = findCenterOfElement(draggedEl);
        const scrolled = scrollIfNeeded(currentCenterOfDragged, lastDropZoneFound);
        // we only want to make a new decision after the element was moved a bit to prevent flickering
        if (
            !scrolled &&
            lastCentrePositionOfDragged &&
            Math.abs(lastCentrePositionOfDragged.x - currentCenterOfDragged.x) < TOLERANCE_PX &&
            Math.abs(lastCentrePositionOfDragged.y - currentCenterOfDragged.y) < TOLERANCE_PX
        ) {
            next = window.setTimeout(andNow, intervalMs);
            return;
        }
        
        const dragDirection = resolveDirection(currentCenterOfDragged, lastCentrePositionOfDragged ?? currentCenterOfDragged);
        
        const isDirectionInversed = directionInversed(dragDirection);
        const hasDirectionChanged = dragDirection.y === 0 || isDirectionInversed;


        if (isElementOffDocument(draggedEl)) {
            printDebug(() => "off document");
            dispatchDraggedLeftDocument(draggedEl);
            return;
        }

        lastCentrePositionOfDragged = currentCenterOfDragged;
        // this is a simple algorithm, potential improvement: first look at lastDropZoneFound
        let isDraggedInADropZone = false;
        for (const dz of dropZonesFromDeepToShallow) {
            const indexObj = findWouldBeIndex(draggedEl, dz, hasDirectionChanged);
            if (indexObj === null) {
                // it is not inside
                continue;
            }
            const { index } = indexObj;
            isDraggedInADropZone = true;
            // the element is over a container
            if (dz !== lastDropZoneFound) {
                lastDropZoneFound && dispatchDraggedElementLeftContainerForAnother(lastDropZoneFound, draggedEl, dz);
                dispatchDraggedElementEnteredContainer(dz, indexObj, draggedEl);
                lastDropZoneFound = dz;
            } else if (index !== lastIndexFound) {
                dispatchDraggedElementIsOverIndex(dz, indexObj, draggedEl);
                lastIndexFound = index;
            }
            // we handle looping with the 'continue' statement above
            break;
        }
        // the first time the dragged element is not in any dropzone we need to notify the last dropzone it was in
        if (!isDraggedInADropZone && lastIsDraggedInADropZone && lastDropZoneFound) {
            dispatchDraggedElementLeftContainerForNone(lastDropZoneFound, draggedEl);
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

function resolveDirection(currentCenterOfDragged, lastCentrePositionOfDragged) {
    let result = {
        x: undefined,
        y: undefined
    };

    for (const axis of ['x', 'y']) {
        if (currentCenterOfDragged[axis] === lastCentrePositionOfDragged[axis]) {
            result[axis] = 0;
        } else {
            result[axis] = currentCenterOfDragged[axis] > lastCentrePositionOfDragged[axis]
                ? 1
                : -1;
        }
    }

    return result;
}

// assumption - we can only observe one dragged element at a time, this could be changed in the future
export function unobserve() {
    printDebug(() => "unobserving");
    clearTimeout(next);
    resetScrolling();
    resetCache();
}
