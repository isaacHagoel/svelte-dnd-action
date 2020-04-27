import {findWouldBeIndex} from './listUtil';
import {findCenterOfElement, isElementOffDocument, calcInnerDistancesBetweenCenterOfAAndSidesOfB} from "./intersection";
import {dispatchDraggedElementEnteredContainer, 
        dispatchDraggedElementLeftContainer,
        dispatchDraggedLeftDocument,
        dispatchDraggedElementIsOverIndex} 
    from './dispatcher';

// TODO - 13 - NEEDS TO BEHAVE CORRECTLY WHEN THE ELEMENT IS DROPPED INTO THE LAST POSITION
const INTERVAL_MS = 200;
const TOLERANCE_PX = 10;
const SCROLL_ZONE_PX = 20;
let next;
let shouldTryScrollingDZ;
function resetScrolling() {
    shouldTryScrollingDZ = {directionObj: undefined, stepPx: 0};
}

/**
 * 
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
    resetScrolling();

    // directionObj {x: 0|1|-1, y:0|1|-1} - 1 means down in y and right in x
    function scrollContainer(containerEl){
        const {directionObj, stepPx} = shouldTryScrollingDZ;
        if(directionObj) {
            containerEl.scrollBy(directionObj.x * stepPx, directionObj.y * stepPx);
            window.requestAnimationFrame(() => scrollContainer(containerEl));
        }
    }
    function calcScrollStepPx(distancePx) {
        return SCROLL_ZONE_PX - distancePx;
    }

    /**
     * Manipulated the global `shouldTryScrollingDZ` to decide whether to scroll `lastDropZoneFound` in which direction and in which speed
     * Kicks off `scrollContainer` that handles the actual scrolling based on the modified global
     * @return {boolean} - true if scrolling was needed
     */
    function scrollIfNeeded() {
        if (lastDropZoneFound) {
            const distances = calcInnerDistancesBetweenCenterOfAAndSidesOfB(draggedEl, lastDropZoneFound);
            if (distances === null) {
                resetScrolling();
                return false;
            }
            const isAlreadyScrolling = !!shouldTryScrollingDZ.directionObj;
            // vertical
            if (lastDropZoneFound.scrollHeight > lastDropZoneFound.clientHeight) {
                if(distances.bottom < SCROLL_ZONE_PX) {
                    shouldTryScrollingDZ.directionObj = {x:0, y:1};
                    shouldTryScrollingDZ.stepPx = calcScrollStepPx(distances.bottom);
                } else if (distances.top < SCROLL_ZONE_PX) {
                    shouldTryScrollingDZ.directionObj = {x:0, y:-1};
                    shouldTryScrollingDZ.stepPx = calcScrollStepPx(distances.top);
                }
                else {
                    resetScrolling();
                    return false;
                }
                !isAlreadyScrolling && scrollContainer(lastDropZoneFound);
                return true;
            }
            // horizontal
            else if (lastDropZoneFound.scrollWidth > lastDropZoneFound.clientWidth) {
                if (distances.right < SCROLL_ZONE_PX) {
                    shouldTryScrollingDZ.directionObj = {x:1, y:0};
                    shouldTryScrollingDZ.stepPx = calcScrollStepPx(distances.right);
                } else if (distances.left < SCROLL_ZONE_PX) {
                    shouldTryScrollingDZ.directionObj = {x:-1, y:0};
                    shouldTryScrollingDZ.stepPx = calcScrollStepPx(distances.left);
                }
                else {
                    resetScrolling();
                    return false;
                }
                !isAlreadyScrolling && scrollContainer(lastDropZoneFound);
                return true;
            }
            else {
                resetScrolling();
                return false;
            }
        }
    }

    function andNow() {
        const scrolled = scrollIfNeeded();
        // we only want to make a new decision after the element was moved a bit to prevent flickering
        const currentCenterOfDragged = findCenterOfElement(draggedEl);
        if (!scrolled && lastCentrePositionOfDragged &&
            Math.abs(lastCentrePositionOfDragged.x - currentCenterOfDragged.x) < TOLERANCE_PX &&
            Math.abs(lastCentrePositionOfDragged.y - currentCenterOfDragged.y) < TOLERANCE_PX ) {
            next = window.setTimeout(andNow, intervalMs);
            return;
        }
        if (isElementOffDocument(draggedEl)) {
            console.warn("off document");
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
    console.warn("unobserving");
    resetScrolling();
    clearTimeout(next);
}