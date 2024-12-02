// This is based off https://stackoverflow.com/questions/27745438/how-to-compute-getboundingclientrect-without-considering-transforms/57876601#57876601
// It removes the transforms that are potentially applied by the flip animations
/**
 * Gets the bounding rect but removes transforms (ex: flip animation)
 * @param {HTMLElement} el
 * @param {boolean} [onlyVisible] - use the visible rect defaults to true
 * @return {{top: number, left: number, bottom: number, right: number}}
 */
export function getBoundingRectNoTransforms(el, onlyVisible = true) {
    let ta;
    const rect = onlyVisible ? getVisibleRectRecursive(el) : el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const tx = style.transform;

    if (tx) {
        let sx, sy, dx, dy;
        if (tx.startsWith("matrix3d(")) {
            ta = tx.slice(9, -1).split(/, /);
            sx = +ta[0];
            sy = +ta[5];
            dx = +ta[12];
            dy = +ta[13];
        } else if (tx.startsWith("matrix(")) {
            ta = tx.slice(7, -1).split(/, /);
            sx = +ta[0];
            sy = +ta[3];
            dx = +ta[4];
            dy = +ta[5];
        } else {
            return rect;
        }

        const to = style.transformOrigin;
        const x = rect.x - dx - (1 - sx) * parseFloat(to);
        const y = rect.y - dy - (1 - sy) * parseFloat(to.slice(to.indexOf(" ") + 1));
        const w = sx ? rect.width / sx : el.offsetWidth;
        const h = sy ? rect.height / sy : el.offsetHeight;
        return {
            x: x,
            y: y,
            width: w,
            height: h,
            top: y,
            right: x + w,
            bottom: y + h,
            left: x
        };
    } else {
        return rect;
    }
}

/**
 * Gets the absolute bounding rect (accounts for the window's scroll position and removes transforms)
 * @param {HTMLElement} el
 * @return {{top: number, left: number, bottom: number, right: number}}
 */
export function getAbsoluteRectNoTransforms(el) {
    const rect = getBoundingRectNoTransforms(el);
    return {
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX
    };
}

/**
 * Gets the absolute bounding rect (accounts for the window's scroll position)
 * @param {HTMLElement} el
 * @return {{top: number, left: number, bottom: number, right: number}}
 */
export function getAbsoluteRect(el) {
    const rect = el.getBoundingClientRect();
    return {
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX
    };
}

/**
 * finds the center :)
 * @typedef {Object} Rect
 * @property {number} top
 * @property {number} bottom
 * @property {number} left
 * @property {number} right
 * @param {Rect} rect
 * @return {{x: number, y: number}}
 */
export function findCenter(rect) {
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2
    };
}

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 * @param {Point} pointA
 * @param {Point} pointB
 * @return {number}
 */
function calcDistance(pointA, pointB) {
    return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2));
}

/**
 * @param {Point} point
 * @param {Rect} rect
 * @return {boolean|boolean}
 */
export function isPointInsideRect(point, rect) {
    return point.y <= rect.bottom && point.y >= rect.top && point.x >= rect.left && point.x <= rect.right;
}

/**
 * find the absolute coordinates of the center of a dom element
 * @param el {HTMLElement}
 * @returns {{x: number, y: number}}
 */
export function findCenterOfElement(el) {
    return findCenter(getAbsoluteRect(el));
}

/**
 * @param {HTMLElement} elA
 * @param {HTMLElement} elB
 * @return {boolean}
 */
export function isCenterOfAInsideB(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const rectOfB = getAbsoluteRectNoTransforms(elB);
    return isPointInsideRect(centerOfA, rectOfB);
}

/**
 * @param {HTMLElement|ChildNode} elA
 * @param {HTMLElement|ChildNode} elB
 * @return {number}
 */
export function calcDistanceBetweenCenters(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const centerOfB = findCenterOfElement(elB);
    return calcDistance(centerOfA, centerOfB);
}

/**
 * @param {HTMLElement} el - the element to check
 * @returns {boolean} - true if the element in its entirety is off-screen including the scrollable area (the normal dom events look at the mouse rather than the element)
 */
export function isElementOffDocument(el) {
    const rect = getAbsoluteRect(el);
    return rect.right < 0 || rect.left > document.documentElement.scrollWidth || rect.bottom < 0 || rect.top > document.documentElement.scrollHeight;
}

function getVisibleRectRecursive(element) {
    let rect = element.getBoundingClientRect();
    let visibleRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
    };

    // Traverse up the DOM hierarchy, checking for scrollable ancestors
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
        let parentRect = parent.getBoundingClientRect();

        // Check if the parent has a scrollable overflow
        const overflowY = window.getComputedStyle(parent).overflowY;
        const overflowX = window.getComputedStyle(parent).overflowX;
        const isScrollableY = overflowY === "scroll" || overflowY === "auto";
        const isScrollableX = overflowX === "scroll" || overflowX === "auto";

        // Constrain the visible area to the parent's visible area
        if (isScrollableY) {
            visibleRect.top = Math.max(visibleRect.top, parentRect.top);
            visibleRect.bottom = Math.min(visibleRect.bottom, parentRect.bottom);
        }
        if (isScrollableX) {
            visibleRect.left = Math.max(visibleRect.left, parentRect.left);
            visibleRect.right = Math.min(visibleRect.right, parentRect.right);
        }

        parent = parent.parentElement;
    }

    // Finally, constrain the visible rect to the viewport
    visibleRect.top = Math.max(visibleRect.top, 0);
    visibleRect.bottom = Math.min(visibleRect.bottom, window.innerHeight);
    visibleRect.left = Math.max(visibleRect.left, 0);
    visibleRect.right = Math.min(visibleRect.right, window.innerWidth);

    // Return the visible rectangle, ensuring that all values are valid
    return {
        top: visibleRect.top,
        bottom: visibleRect.bottom,
        left: visibleRect.left,
        right: visibleRect.right,
        width: Math.max(0, visibleRect.right - visibleRect.left),
        height: Math.max(0, visibleRect.bottom - visibleRect.top)
    };
}
