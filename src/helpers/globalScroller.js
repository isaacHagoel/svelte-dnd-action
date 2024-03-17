import {makeScroller} from "./scroller";
import {printDebug} from "../constants";
import {resetIndexesCache} from "./listUtil";
import {getDepth} from "./util";
import {isPointInsideRect} from "./intersection";

const DEFAULT_INTERVAL_MS = 150;
let mousePosition;
let scrollingContainersSet;
let scrollingContainersDeepToShallow;
let didScrollDuringLastInterval = false;

/**
 * Will start watching the mouse pointer and scroll the elements if it goes next to the edges
 * @param {HTMLElement[]} dropZonesForScrolling
 * @param {number} intervalMs
 */
export function armGlobalScroller(dropZonesForScrolling = [], intervalMs = DEFAULT_INTERVAL_MS) {
    printDebug(() => "arming super scroller");
    scrollingContainersSet = findRelevantScrollContainers(dropZonesForScrolling);
    if (scrollingContainersSet.size === 0) {
        return;
    }
    scrollingContainersDeepToShallow = Array.from(scrollingContainersSet).sort((dz1, dz2) => getDepth(dz2) - getDepth(dz1));
    window.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("touchmove", updateMousePosition);
    loop(intervalMs);
}

/**
 * will stop watching the mouse pointer and won't scroll the window anymore
 */
export function disarmGlobalScroller() {
    printDebug(() => "disarming window scroller");
    window.removeEventListener("mousemove", updateMousePosition);
    window.removeEventListener("touchmove", updateMousePosition);
    mousePosition = undefined;
    scrollingContainersSet = undefined;
    scrollingContainersDeepToShallow = undefined;
    didScrollDuringLastInterval = false;
    window.clearTimeout(next);
    resetScrolling();
}

export function didAnyContainerScrollDuringLastInterval() {
    return didScrollDuringLastInterval;
}

/**
 * @param {{clientX: number, clientY: number}} e
 */
function updateMousePosition(e) {
    const c = e.touches ? e.touches[0] : e;
    mousePosition = {x: c.clientX, y: c.clientY};
}
const {scrollIfNeeded, resetScrolling} = makeScroller();
let next;

function loop(intervalMs) {
    if (mousePosition && scrollingContainersDeepToShallow) {
        const scrollContainersUnderCursor = scrollingContainersDeepToShallow.filter(
            el => isPointInsideRect(mousePosition, el.getBoundingClientRect()) || el === document.scrollingElement
        );
        for (let i = 0; i < scrollContainersUnderCursor.length; i++) {
            const scrolled = scrollIfNeeded(mousePosition, scrollContainersUnderCursor[i]);
            if (scrolled) {
                didScrollDuringLastInterval = true;
                resetIndexesCache();
                break;
            }
        }
        didScrollDuringLastInterval = false;
    }
    next = window.setTimeout(loop, intervalMs);
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
