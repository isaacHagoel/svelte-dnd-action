/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 */
export declare function dndzone(
    node: HTMLElement,
    options: Options
): {
    update: (newOptions: Options) => void;
    destroy: () => void;
};

export type TransformDraggedElementFunction = (
    element?: HTMLElement, // the dragged element.
    draggedElementData?: Item, // the data of the item from the items array
    index?: number // the index the dragged element would get if dropped into the new dnd-zone
) => void;

export declare type Item = Record<string, any>;
export interface Options {
    items: Item[]; // the list of items that was used to generate the children of the given node
    type?: string; // the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, defaults to a base type
    cursorStartDrag?: string; //
    cursorDragging?: string; //
    cursorDrop?: string; //
    cursorHover?: string; //
    flipDurationMs?: number; // if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict
    constrainAxisX?: boolean; // Constrain dragging by X axis. Drag will be allowed only by Y axis.
    constrainAxisY?: boolean; // Constrain dragging by Y axis. Drag will be allowed only by X axis.
    dragDisabled?: boolean;
    morphDisabled?: boolean;
    dropFromOthersDisabled?: boolean;
    zoneTabIndex?: number; // set the tabindex of the list container when not dragging
    dropTargetClasses?: string[];
    dropTargetStyle?: Record<string, string>;
    transformDraggedElement?: TransformDraggedElementFunction;
    autoAriaDisabled?: boolean;
    centreDraggedOnCursor?: boolean;
}

/**
 * Will make the screen reader alert the provided text to the user
 */
export declare function alertToScreenReader(txt: string): void;

/**
 * Allows using another key instead of "id" in the items data. This is global and applies to all dndzones.
 * Has to be called when there are no rendered dndzones whatsoever.
 * @throws {Error} if it was called when there are rendered dndzones or if it is given the wrong type (not a string)
 */
export declare function overrideItemIdKeyNameBeforeInitialisingDndZones(newKeyName: string): void;

export enum TRIGGERS {
    DRAG_STARTED = "dragStarted",
    DRAGGED_ENTERED = "draggedEntered", //only relevant for pointer interactions
    DRAGGED_ENTERED_ANOTHER = "dragEnteredAnother", //only relevant for pointer interactions
    DRAGGED_OVER_INDEX = "draggedOverIndex", //only relevant for pointer interactions
    DRAGGED_LEFT = "draggedLeft", //only relevant for pointer interactions
    DRAGGED_LEFT_ALL = "draggedLeftAll", //only relevant for pointer interactions
    DROPPED_INTO_ZONE = "droppedIntoZone",
    DROPPED_INTO_ANOTHER = "droppedIntoAnother",
    DROPPED_OUTSIDE_OF_ANY = "droppedOutsideOfAny",
    DRAG_STOPPED = "dragStopped" //only relevant for keyboard interactions - when the use exists dragging mode
}

export enum SOURCES {
    POINTER = "pointer", // mouse or touch
    KEYBOARD = "keyboard"
}

export interface DndEventInfo {
    trigger: TRIGGERS; // the type of dnd event that took place
    id: string;
    source: SOURCES; // the type of interaction that the user used to perform the dnd operation
}

export type DndEvent<T = Item> = {
    items: T[];
    info: DndEventInfo;
};

export declare const SHADOW_ITEM_MARKER_PROPERTY_NAME: "isDndShadowItem";
export declare const SHADOW_PLACEHOLDER_ITEM_ID: "id:dnd-shadow-placeholder-0000";
export declare const DRAGGED_ELEMENT_ID: "dnd-action-dragged-el";

/**
 * Allows the user to show/hide console debug output
 */
export declare function setDebugMode(isDebug: boolean): void;
