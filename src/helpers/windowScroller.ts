import { Point } from "./intersection";
import {makeScroller} from "./scroller";

const INTERVAL_MS = 300;
let mousePosition: Point;

/**
 * Do not use this! it is visible for testing only until we get over the issue Cypress not triggering the mousemove listeners
 * // TODO - make private (remove export)
 */
export function updateMousePosition(e: MouseEvent | TouchEvent): void {
    // @ts-expect-error TODO: {'touches' in e} instead of {e.touches}
    const c = e.touches? e.touches[0] : e;
    mousePosition = {x: c.clientX, y: c.clientY};
}
const {scrollIfNeeded, resetScrolling} = makeScroller();
let next: number;

function loop() {
    if (mousePosition) {
        scrollIfNeeded(mousePosition, document.documentElement);
    }
    next = window.setTimeout(loop, INTERVAL_MS);
}

/**
 * will start watching the mouse pointer and scroll the window if it goes next to the edges
 */
export function armWindowScroller() {
    console.debug('arming window scroller');
    window.addEventListener('mousemove', updateMousePosition);
    window.addEventListener('touchmove', updateMousePosition);
    loop();
}

/**
 * will stop watching the mouse pointer and won't scroll the window anymore
 */
export function disarmWindowScroller() {
    console.debug('disarming window scroller');
    window.removeEventListener('mousemove', updateMousePosition);
    window.removeEventListener('touchmove', updateMousePosition);
    mousePosition = undefined;
    window.clearTimeout(next);
    resetScrolling();
}
