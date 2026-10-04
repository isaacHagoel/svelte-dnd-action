/**
 * The window an element lives in. A drop zone can live in another window than the one that
 * loaded this module, for example a same-origin iframe or a popup opened with window.open.
 * @param {Node} el
 * @return {Window}
 */
export function getWindowOf(el) {
    return el.ownerDocument.defaultView || window;
}

/**
 * Schedules a timeout on the given window. Work for a zone runs on the zone's window: the browser throttles
 * or stops the timers of a hidden window, and the loading window can be hidden while the zone's is not.
 * @param {Window} win
 * @param {function} callback
 * @param {number} ms
 * @return {{win: Window, id: number}} - pass it to clearTimeoutIn
 */
export function setTimeoutIn(win, callback, ms) {
    return {win, id: win.setTimeout(callback, ms)};
}

/**
 * Cancels a timeout through the window that scheduled it
 * @param {{win: Window, id: number}} [timeout] - from setTimeoutIn
 */
export function clearTimeoutIn(timeout) {
    if (timeout) timeout.win.clearTimeout(timeout.id);
}

/**
 * @param {Object} object
 * @return {string}
 */
export function toString(object) {
    return JSON.stringify(object, null, 2);
}

/**
 * Finds the depth of the given node in the DOM tree
 * @param {HTMLElement} node
 * @return {number} - the depth of the node
 */
export function getDepth(node) {
    if (!node) {
        throw new Error("cannot get depth of a falsy node");
    }
    return _getDepth(node, 0);
}
function _getDepth(node, countSoFar = 0) {
    if (!node.parentElement) {
        return countSoFar - 1;
    }
    return _getDepth(node.parentElement, countSoFar + 1);
}

/**
 * A simple util to shallow compare objects quickly, it doesn't validate the arguments so pass objects in
 * @param {Object} objA
 * @param {Object} objB
 * @return {boolean} - true if objA and objB are shallow equal
 */
export function areObjectsShallowEqual(objA, objB) {
    if (Object.keys(objA).length !== Object.keys(objB).length) {
        return false;
    }
    for (const keyA in objA) {
        if (!{}.hasOwnProperty.call(objB, keyA) || objB[keyA] !== objA[keyA]) {
            return false;
        }
    }
    return true;
}

/**
 * Shallow compares two arrays
 * @param arrA
 * @param arrB
 * @return {boolean} - whether the arrays are shallow equal
 */
export function areArraysShallowEqualSameOrder(arrA, arrB) {
    if (arrA.length !== arrB.length) {
        return false;
    }
    for (let i = 0; i < arrA.length; i++) {
        if (arrA[i] !== arrB[i]) {
            return false;
        }
    }
    return true;
}
