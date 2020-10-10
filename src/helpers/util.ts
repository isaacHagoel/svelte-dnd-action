export function toString(object: object): string {
    return JSON.stringify(object, null, 2);
}

/**
 * Finds the depth of the given node in the DOM tree
 * returns the depth of the node
 */
export function getDepth(node: HTMLElement): number {
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
 */
export function areObjectsShallowEqual(objA: object, objB: object): boolean {
    if (Object.keys(objA).length !== Object.keys(objB).length) {
        return false;
    }
    for (const keyA in objA) {
        if(!objB.hasOwnProperty(keyA) || objB[keyA] !== objA[keyA]) {
            return false;
        }
    }
    return true;
}
