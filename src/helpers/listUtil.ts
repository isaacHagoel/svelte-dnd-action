import { isCenterOfAInsideB, calcDistanceBetweenCenters } from './intersection';

interface Index {
    index: number; // the would be index
    isProximityBased: boolean; // false if the element is actually over the index, true if it is not over it but this index is the closest
}
/**
 * Find the index for the dragged element in the list it is dragged over
 * if the element is over the container, returns an Index object otherwise null
 */
export function findWouldBeIndex(floatingAboveEl: HTMLElement, collectionBelowEl: HTMLElement): Index | null {
    if (!isCenterOfAInsideB(floatingAboveEl, collectionBelowEl)) {
        return null;
    }
    const children = collectionBelowEl.children;
    // the container is empty, floating element should be the first 
    if (children.length === 0) {
        return {index: 0, isProximityBased: true};
    }
    // the search could be more efficient but keeping it simple for now
    // a possible improvement: pass in the lastIndex it was found in and check there first, then expand from there
    for (let i=0; i< children.length; i++) {
        if (isCenterOfAInsideB(floatingAboveEl, children[i])) {
            return {index: i, isProximityBased: false};
        }
    }
    // this can happen if there is space around the children so the floating element has 
    //entered the container but not any of the children, in this case we will find the nearest child
    let minDistanceSoFar = Number.MAX_VALUE;
    let indexOfMin: number | undefined = undefined;
    // we are checking all of them because we don't know whether we are dealing with a horizontal or vertical container and where the floating element entered from
    for (let i=0; i< children.length; i++) {
        const distance = calcDistanceBetweenCenters(floatingAboveEl, children[i]);
        if (distance < minDistanceSoFar) {
            minDistanceSoFar = distance;
            indexOfMin = i;
        }
    }
    return {
        // @ts-expect-error (can be undefined)
        index: indexOfMin,
        isProximityBased: true
    };
}
