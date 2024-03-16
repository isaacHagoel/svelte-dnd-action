import {makeScroller} from "./scroller";
import {printDebug} from "../constants";
import {resetIndexesCache} from "./listUtil";
import {getDepth} from "./util";
import {isPointInsideRect} from "./intersection";

const INTERVAL_MS = 250;
let mousePosition;
let scrollingContainersSet;
let scrollingContainersDeepToShallow;

/**
 * Do not use this! it is visible for testing only until we get over the issue Cypress not triggering the mousemove listeners
 * // TODO - make private (remove export)
 * @param {{clientX: number, clientY: number}} e
 */
export function updateMousePosition(e) {
    const c = e.touches ? e.touches[0] : e;
    mousePosition = {x: c.clientX, y: c.clientY};
}
const {scrollIfNeeded, resetScrolling} = makeScroller();
let next;

function loop() {
    if (mousePosition && scrollingContainersDeepToShallow) {
        const scrollContainersUnderCursor = scrollingContainersDeepToShallow.filter(
            el => isPointInsideRect(mousePosition, el.getBoundingClientRect()) || el === document.scrollingElement
        );
        console.error({scrollContainersUnderCursor});
        for (let i = 0; i < scrollContainersUnderCursor.length; i++) {
            const scrolled = scrollIfNeeded(mousePosition, scrollContainersUnderCursor[i]);
            console.error({container: scrollContainersUnderCursor[i], scrolled});
            if (scrolled) {
                resetIndexesCache();
                break;
            }
        }
    }
    next = window.setTimeout(loop, INTERVAL_MS);
}

function findScrollableParents(element) {
    if (!element) {
        return [];
    }
    const scrollableContainers = [];
    let parent = element;
    while (parent) {
        const {overflow} = window.getComputedStyle(parent);
        if (overflow.split(" ").some(o => o.includes("auto") || o.includes("scroll"))) {
            scrollableContainers.push(parent);
        }
        parent = parent.parentElement;
    }
    return scrollableContainers;
}
function findRelevantScrollContainers(dropZones) {
    const scrollingContainers = new Set();
    for (let dz of dropZones) {
        findScrollableParents(dz).forEach(container => scrollingContainers.add(container));
    }
    // The scrolling element might have overflow visible and still be scrollable
    if (
        document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight ||
        document.scrollingElement.scrollWidth > document.scrollingElement.clientHeight
    ) {
        scrollingContainers.add(document.scrollingElement);
    }
    return scrollingContainers;
}

/**
 * will start watching the mouse pointer and scroll the window if it goes next to the edges
 */
export function armGlobalScroller(dropZonesForScrolling) {
    printDebug(() => "arming super scroller");
    window.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("touchmove", updateMousePosition);
    scrollingContainersSet = findRelevantScrollContainers(dropZonesForScrolling);
    if (scrollingContainersSet.size === 0) {
        return;
    }
    scrollingContainersDeepToShallow = Array.from(scrollingContainersSet).sort((dz1, dz2) => getDepth(dz2) - getDepth(dz1));
    loop();
}

/**
 * will stop watching the mouse pointer and won't scroll the window anymore
 */
export function disarmGlobalScroller() {
    // TODO - consider returning this function from armSuperScroller
    printDebug(() => "disarming window scroller");
    window.removeEventListener("mousemove", updateMousePosition);
    window.removeEventListener("touchmove", updateMousePosition);
    mousePosition = undefined;
    scrollingContainersSet = undefined;
    scrollingContainersDeepToShallow = undefined;
    window.clearTimeout(next);
    resetScrolling();
}
