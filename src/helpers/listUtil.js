import { isCentreOfAInsideB, calcDistanceBetweenCenters } from './intersection';
/**
 * 
 * @param {HTMLElement} floatingAboveEl 
 * @param {HTMLElement} collectionBelowEl 
 */
export function findWouldBeIndex(floatingAboveEl, collectionBelowEl) {
    if (!isCentreOfAInsideB(floatingAboveEl, collectionBelowEl)) {
        return null;
    }
    const children = collectionBelowEl.childNodes;
    // the container is empty, floating element should be the first 
    if (children.length === 0) {
        return 0;
    }
    // the search could be more efficient but keeping it simple for now
    // a possible improvement: pass in the lastIndex it was found in and check there first, then expand from there
    for (let i=0; i< children.length; i++) {
        if (isCentreOfAInsideB(floatingAboveEl, children[i])) {
            return i;
        }
    }
    // this can happen if there is space around the children so the floating element has 
    //entered the container but not any of the children, in this case we will find the nearest child
    let minDistanceSoFar = Number.MAX_VALUE;
    let indexOfMin = undefined;
    // we are checking all of them because we don't know whether we are dealing with a horizontal or vertical container and where the floating element entered from
    for (let i=0; i< children.length; i++) {
        const distance = calcDistanceBetweenCenters(floatingAboveEl, children[i]);
        if (distance < minDistanceSoFar) {
            minDistanceSoFar = distance;
            indexOfMin = i;
        }
    }
    return indexOfMin;
}