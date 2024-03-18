import {makeScroller} from "./scroller";
import {printDebug} from "../constants";
import {getDepth} from "./util";
import {isPointInsideRect} from "./intersection";

/**
 @typedef {Object} MultiScroller
 @property {function():boolean} multiScrollIfNeeded - call this on every "tick" to scroll containers if needed, returns true if anything was scrolled
/**
 * Creates a scroller than can scroll any of the provided containers or any of their scrollable parents (including the document's scrolling element)
 * @param {HTMLElement[]} baseElementsForScrolling
 * @param {function():Point} getPointerPosition
 * @return {MultiScroller}
 */
export function createMultiScroller(baseElementsForScrolling = [], getPointerPosition) {
    printDebug(() => "creating multi-scroller");
    const scrollingContainersSet = findRelevantScrollContainers(baseElementsForScrolling);
    const scrollingContainersDeepToShallow = Array.from(scrollingContainersSet).sort((dz1, dz2) => getDepth(dz2) - getDepth(dz1));
    const {scrollIfNeeded} = makeScroller();

    /**
     * @return {boolean} - was any container scrolled
     */
    function tick() {
        const mousePosition = getPointerPosition();
        if (!mousePosition || !scrollingContainersDeepToShallow) {
            return false;
        }
        const scrollContainersUnderCursor = scrollingContainersDeepToShallow.filter(
            el => isPointInsideRect(mousePosition, el.getBoundingClientRect()) || el === document.scrollingElement
        );
        for (let i = 0; i < scrollContainersUnderCursor.length; i++) {
            const scrolled = scrollIfNeeded(mousePosition, scrollContainersUnderCursor[i]);
            if (scrolled) {
                return true;
            }
        }
        return false;
    }
    return {
        multiScrollIfNeeded: scrollingContainersSet.size > 0 ? tick : () => false
    };
}

// internal utils
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
