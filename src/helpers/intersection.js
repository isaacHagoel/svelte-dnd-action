function calcAbsolutePosition(el) {
    const rect = el.getBoundingClientRect();
    return ({
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        right: rect.right + window.scrollY
    });
}

function findCenter(position) {
    return ({
        x: (position.left + position.right) /2,
        y: (position.top + position.bottom) /2
    });    
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
    return Math.sqrt(Math.pow(centerOfA.x - centerOfB.x, 2) +  Math.pow(centerOfA.y - centerOfB.y, 2));
}