export interface Rect {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface Point {
    x: number;
    y: number;
}

/**
 * Gets the absolute bounding rect (accounts for the window's scroll position)
 */
export function getAbsoluteRect(el: Element): Rect {
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
 */
export function findCenter(rect: Rect): Point {
    return ({
        x: (rect.left + rect.right) /2,
        y: (rect.top + rect.bottom) /2
    });    
}

function calcDistance(pointA: Point, pointB: Point): number {
    return Math.sqrt(Math.pow(pointA.x - pointB.x, 2) +  Math.pow(pointA.y - pointB.y, 2));
}

function isPointInsideRect(point: Point, rect: Rect): boolean {
    return (
        (point.y <= rect.bottom && point.y >= rect.top)
        &&
        (point.x >= rect.left && point.x <= rect.right)
    );
}

/**
 * find the absolute coordinates of the center of a dom element
 */
export function findCenterOfElement(el: Element): Point {
    return findCenter( getAbsoluteRect(el));
}

export function isCenterOfAInsideB(elA: Element, elB: Element): boolean {
    const centerOfA = findCenterOfElement(elA);
    const rectOfB = getAbsoluteRect(elB);
    return isPointInsideRect(centerOfA, rectOfB);
}

export function calcDistanceBetweenCenters(elA: Element, elB: Element): number {
    const centerOfA = findCenterOfElement(elA);
    const centerOfB = findCenterOfElement(elB);
    return calcDistance(centerOfA, centerOfB);
}

/**
 * returns true if the element in its entirety is off screen including the scrollable area (the normal dom events look at the mouse rather than the element)
 */
export function isElementOffDocument(
    el: HTMLElement // the element to check
): boolean {
    const rect = getAbsoluteRect(el);
    return rect.right < 0 || rect.left > document.documentElement.scrollWidth || rect.bottom < 0 || rect.top > document.documentElement.scrollHeight;
}

/**
 * If the point is inside the element returns its distances from the sides, otherwise returns null
 */
export function calcInnerDistancesBetweenPointAndSidesOfElement(point: Point, el: HTMLElement): Rect | null {
    const rect = getAbsoluteRect(el);
    if (!isPointInsideRect(point, rect)) {
        return null;
    }
    return {
        top: point.y - rect.top,
        bottom: rect.bottom - point.y,
        left: point.x - rect.left,
        // TODO - figure out what is so special about right (why the rect is too big)
        right: Math.min(rect.right, document.documentElement.clientWidth) - point.x
    }
}
