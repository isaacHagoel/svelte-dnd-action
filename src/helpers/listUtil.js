import { isCenterOfAInsideB, calcDistanceBetweenCenters } from "./intersection";
import { SHADOW_ELEMENT_ATTRIBUTE_NAME } from "../constants";

/**
 * Find the index for the dragged element in the list it is dragged over
 * @param {HTMLElement} floatingAboveEl
 * @param {HTMLElement} collectionBelowEl
 * @returns {Index|null} -  if the element is over the container the Index object otherwise null
 */
export function findWouldBeIndex(floatingAboveEl, collectionBelowEl, directionChanged) {
    if (!isCenterOfAInsideB(floatingAboveEl, collectionBelowEl)) {
        return null;
    }
    const children = collectionBelowEl.children;
    // the container is empty, floating element should be the first
    if (children.length === 0) {
        return { index: 0, isProximityBased: true };
    }
    const shadowElIndex = getShadowIdx(collectionBelowEl);
    // the search could be more efficient but keeping it simple for now
    // a possible improvement: pass in the lastIndex it was found in and check there first, then expand from there
    for (let i = 0; i < children.length; i++) {
        if (isCenterOfAInsideB(floatingAboveEl, children[i])) {
            // if last dragged

            let bellowEl = children[i];
            let lastBellowEl = getLastBellowEl(collectionBelowEl);
            memLastBellowEl(collectionBelowEl, bellowEl);
            let bellowElChanged = lastBellowEl !== bellowEl;

            if (directionChanged || (lastBellowEl !== undefined && bellowElChanged)) {
                return { index: i, isProximityBased: false };
            } else {
                return { index: shadowElIndex, isProximityBased: false };
            }
        }
    }
    // this can happen if there is space around the children so the floating element has
    //entered the container but not any of the children, in this case we will find the nearest child
    let minDistanceSoFar = Number.MAX_VALUE;
    let indexOfMin = undefined;
    // we are checking all of them because we don't know whether we are dealing with a horizontal or vertical container and where the floating element entered from
    for (let i = 0; i < children.length; i++) {
        const distance = calcDistanceBetweenCenters(floatingAboveEl, children[i]);
        if (distance < minDistanceSoFar) {
            minDistanceSoFar = distance;
            indexOfMin = i;
        }
    }
    return { index: indexOfMin, isProximityBased: true };
}

let cache = new Map();
export function resetCache() {
    cache = new Map();
}

function getShadowIdx(dz) {
    const shadowElIndex = Array.from(dz.children).findIndex(child => child.getAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME));
    return shadowElIndex;
}
function memLastBellowEl(dz, bellowEl) {
    if (!cache.has(dz)) {
        cache.set(dz, new Map());
    }
    cache.get(dz).set('lastBellowEl', bellowEl);
}
function getLastBellowEl(dz) {
    if (!cache.has(dz)) {
        cache.set(dz, new Map());
    }
    return cache.get(dz).get('lastBellowEl');
}