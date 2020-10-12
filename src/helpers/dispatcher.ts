import { Item } from "../action";
import { TRIGGERS } from "../constants";
import type { Index } from "./listUtil";

// external events
const FINALIZE_EVENT_NAME = 'finalize';
const CONSIDER_EVENT_NAME = 'consider';

export interface Info {
    trigger: TRIGGERS;
    id: string;
    source: string;
}

export function dispatchFinalizeEvent(el: Node, items: Item[], info: Info) {
    el.dispatchEvent(new CustomEvent(FINALIZE_EVENT_NAME, {
        detail: {items, info}
    }));
}

/**
 * Dispatches a consider event
 */
export function dispatchConsiderEvent(el: Node, items: Item[], info: Info) {
    el.dispatchEvent(new CustomEvent(CONSIDER_EVENT_NAME, {
        detail: {items, info}
    }));
}

// internal events
export const DRAGGED_ENTERED_EVENT_NAME = TRIGGERS.DRAGGED_ENTERED;
export const DRAGGED_LEFT_EVENT_NAME = TRIGGERS.DRAGGED_LEFT;
export const DRAGGED_OVER_INDEX_EVENT_NAME = TRIGGERS.DRAGGED_OVER_INDEX;
export const DRAGGED_LEFT_DOCUMENT_EVENT_NAME = 'draggedLeftDocument';
export function dispatchDraggedElementEnteredContainer(containerEl: Element, indexObj: Index, draggedEl: Element) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_ENTERED_EVENT_NAME, {
        detail: {indexObj, draggedEl}
    }));
}
export function dispatchDraggedElementLeftContainer(containerEl: Element, draggedEl: Element) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_LEFT_EVENT_NAME, {
        detail: {draggedEl}
    }));
}
export function dispatchDraggedElementIsOverIndex(containerEl: Element, indexObj: Index, draggedEl: Element) {
    containerEl.dispatchEvent(new CustomEvent(DRAGGED_OVER_INDEX_EVENT_NAME, {
        detail: {indexObj, draggedEl}
    }));
}
export function dispatchDraggedLeftDocument(draggedEl: Element) {
    window.dispatchEvent(new CustomEvent(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, {
        detail: { draggedEl}
    }));
}
