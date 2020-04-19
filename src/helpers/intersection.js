export function calcAbsolutePosition(el) {
    const rect = el.getBoundingClientRect();
    return ({
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollX
    });
}

export function findCenter(position) {
    return ({
        x: (position.left + position.right) /2,
        y: (position.top + position.bottom) /2
    });    
}

function calcDistance(pointA, pointB) {
    return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) +  Math.pow(pointA.y - pointB.y, 2));
}

/**
 * find the absolute coordinates of the centre of a dom element
 * @param el {HTMLElement}
 * @returns {{x: number, y: number}}
 */
export function findCenterOfElement(el) {
    return findCenter( calcAbsolutePosition(el));
}

export function isCentreOfAInsideB(elA, elB) {
    const centerOfA = findCenterOfElement(elA);
    const positionB = calcAbsolutePosition(elB);
    return (
        (centerOfA.y <= positionB.bottom && centerOfA.y >= positionB.top)
       &&
        (centerOfA.x >= positionB.left && centerOfA.x <= positionB.right) 
    );
}

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
    const position = calcAbsolutePosition(el);
    return position.right < 0 || position.left > document.documentElement.scrollWidth || position.bottom < 0 || position.top > document.documentElement.scrollHeight;
}