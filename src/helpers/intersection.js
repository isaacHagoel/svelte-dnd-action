/**
 * Gets the absolute bounding rect (accounts for the window's scroll position)
 * @param {HTMLElement }el
 * @return {{top: number, left: number, bottom: number, right: number}}
 */
export function getAbsoluteRect(el) {
    const rect = el.getBoundingClientRect();
    return ({
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX
    });
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
    return ({
        x: (rect.left + rect.right) /2,
        y: (rect.top + rect.bottom) /2
    });    
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
    return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) +  Math.pow(pointA.y - pointB.y, 2));
}

/**
 * @param {Point} point
 * @param {Rect} rect
 * @return {boolean|boolean}
 */
function isPointInsideRect(point, rect) {
    return (
        (point.y <= rect.bottom && point.y >= rect.top)
        &&
        (point.x >= rect.left && point.x <= rect.right)
    );
}

/**
 * find the absolute coordinates of the centre of a dom element
 * @param el {HTMLElement}
 * @returns {{x: number, y: number}}
 */
export function findCenterOfElement(el) {
    return findCenter( getAbsoluteRect(el));
}

/**
 * @param {HTMLElement} elA
 * @param {HTMLElement} elB
 * @return {boolean}
 */
export function isCentreOfAInsideB(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const rectOfB = getAbsoluteRect(elB);
    return isPointInsideRect(centerOfA, rectOfB);
}

/**
 * @param {HTMLElement} elA
 * @param {HTMLElement} elB
 * @return {number}
 */
export function calcDistanceBetweenCenters(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const centerOfB = findCenterOfElement(elB);
    return calcDistance(centerOfA, centerOfB);
}

/**
 * @param {HTMLElement} el - the element to check
 * @returns {boolean} - true if the element in its entirety is off screen including the scrollable area (the normal dom events look at the mouse rather than the element)
 */
export function isElementOffDocument(el) {
    const rect = getAbsoluteRect(el);
    return rect.right < 0 || rect.left > document.documentElement.scrollWidth || rect.bottom < 0 || rect.top > document.documentElement.scrollHeight;
}

/**
 * @param {HTMLElement} elA
 * @param {HTMLElement} elB
 * @return {null|{top: number, left: number, bottom: number, right: number}} - null if the center of elA is not inside elB
 */
export function calcInnerDistancesBetweenCenterOfAAndSidesOfB(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const rectB = getAbsoluteRect(elB);
    if (!isPointInsideRect(centerOfA, rectB)) {
        return null;
    }
    return {
        top: centerOfA.y - rectB.top,
        bottom: rectB.bottom - centerOfA.y,
        left: centerOfA.x - rectB.left,
        right: rectB.right - centerOfA.x
    }
}