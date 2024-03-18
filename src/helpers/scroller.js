import {isPointInsideRect} from "./intersection";
const SCROLL_ZONE_PX = 30;

/**
 * Will make a scroller that can scroll any element given to it in any direction
 * @returns {{scrollIfNeeded: function(Point, HTMLElement): boolean, resetScrolling: function(void):void}}
 */
export function makeScroller() {
    let scrollingInfo;
    function resetScrolling() {
        scrollingInfo = {directionObj: undefined, stepPx: 0};
    }
    resetScrolling();
    // directionObj {x: 0|1|-1, y:0|1|-1} - 1 means down in y and right in x
    function scrollContainer(containerEl) {
        const {directionObj, stepPx} = scrollingInfo;
        if (directionObj) {
            containerEl.scrollBy(directionObj.x * stepPx, directionObj.y * stepPx);
            window.requestAnimationFrame(() => scrollContainer(containerEl));
        }
    }
    function calcScrollStepPx(distancePx) {
        return SCROLL_ZONE_PX - distancePx;
    }

    /**
     * @param {Point} pointer - the pointer will be used to decide in which direction to scroll
     * @param {HTMLElement} elementToScroll - the scroll container
     * If the pointer is next to the sides of the element to scroll, will trigger scrolling
     * Can be called repeatedly with updated pointer and elementToScroll values without issues
     * @return {boolean} - true if scrolling was needed
     */
    function scrollIfNeeded(pointer, elementToScroll) {
        if (!elementToScroll) {
            return false;
        }
        const distances = calcInnerDistancesBetweenPointAndSidesOfElement(pointer, elementToScroll);
        if (distances === null) {
            resetScrolling();
            return false;
        }
        const isAlreadyScrolling = !!scrollingInfo.directionObj;
        let [scrollingVertically, scrollingHorizontally] = [false, false];
        // vertical
        if (elementToScroll.scrollHeight > elementToScroll.clientHeight) {
            if (distances.bottom < SCROLL_ZONE_PX) {
                scrollingVertically = true;
                scrollingInfo.directionObj = {x: 0, y: 1};
                scrollingInfo.stepPx = calcScrollStepPx(distances.bottom);
            } else if (distances.top < SCROLL_ZONE_PX) {
                scrollingVertically = true;
                scrollingInfo.directionObj = {x: 0, y: -1};
                scrollingInfo.stepPx = calcScrollStepPx(distances.top);
            }
            if (!isAlreadyScrolling && scrollingVertically) {
                scrollContainer(elementToScroll);
                return true;
            }
        }
        // horizontal
        if (elementToScroll.scrollWidth > elementToScroll.clientWidth) {
            if (distances.right < SCROLL_ZONE_PX) {
                scrollingHorizontally = true;
                scrollingInfo.directionObj = {x: 1, y: 0};
                scrollingInfo.stepPx = calcScrollStepPx(distances.right);
            } else if (distances.left < SCROLL_ZONE_PX) {
                scrollingHorizontally = true;
                scrollingInfo.directionObj = {x: -1, y: 0};
                scrollingInfo.stepPx = calcScrollStepPx(distances.left);
            }
            if (!isAlreadyScrolling && scrollingHorizontally) {
                scrollContainer(elementToScroll);
                return true;
            }
        }
        resetScrolling();
        return false;
    }

    return {
        scrollIfNeeded,
        resetScrolling
    };
}

/**
 * If the point is inside the element returns its distances from the sides, otherwise returns null
 * @param {Point} point
 * @param {HTMLElement} el
 * @return {null|{top: number, left: number, bottom: number, right: number}}
 */
function calcInnerDistancesBetweenPointAndSidesOfElement(point, el) {
    // Even if the scrolling element is small it acts as a scroller for the viewport
    const rect =
        el === document.scrollingElement
            ? {
                  top: 0,
                  bottom: window.innerHeight,
                  left: 0,
                  right: window.innerWidth
              }
            : el.getBoundingClientRect();
    if (!isPointInsideRect(point, rect)) {
        return null;
    }
    return {
        top: point.y - rect.top,
        bottom: rect.bottom - point.y,
        left: point.x - rect.left,
        right: rect.right - point.x
    };
}
