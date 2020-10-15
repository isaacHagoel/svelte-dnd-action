
export enum TRIGGERS {
    DRAG_STARTED = "dragStarted",
    DRAGGED_ENTERED = "draggedEntered",
    DRAGGED_OVER_INDEX = "draggedOverIndex",
    DRAGGED_LEFT = "draggedLeft",
    DROPPED_INTO_ZONE = "droppedIntoZone",
    DROPPED_INTO_ANOTHER = "droppedIntoAnother",
    DROPPED_OUTSIDE_OF_ANY = "droppedOutsideOfAny",
    DRAG_STOPPED = "dragStopped",
};
export enum SOURCES {
    POINTER = "pointer",
    KEYBOARD = "keyboard"
};

export const SHADOW_ITEM_MARKER_PROPERTY_NAME = 'isDndShadowItem';
export let ITEM_ID_KEY = "id";
let activeDndZoneCount = 0;
export function incrementActiveDropZoneCount() {activeDndZoneCount++;}
export function decrementActiveDropZoneCount() {
    if (activeDndZoneCount === 0) {
        throw new Error("Bug! trying to decrement when there are no dropzones")
    }
    activeDndZoneCount--;
}

/**
 * Allows using another key instead of "id" in the items data. This is global and applies to all dndzones.
 * Has to be called when there are no rendered dndzones whatsoever.
 * @throws {Error} if it was called when there are rendered dndzones or if it is given the wrong type (not a string)
 */
export function overrideItemIdKeyNameBeforeInitialisingDndZones(newKeyName: string) {
    if (activeDndZoneCount > 0) {
        throw new Error("can only override the id key before initialising any dndzone");
    }
    if (typeof newKeyName !== "string") {
        throw new Error("item id key has to be a string");
    }
    console.debug("overriding item id key name", newKeyName)
    ITEM_ID_KEY = newKeyName;
}
