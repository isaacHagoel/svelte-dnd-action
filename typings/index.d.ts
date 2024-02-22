import type {ActionReturn} from "svelte/action";

/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 */
export declare function dndzone<T extends Item>(node: HTMLElement, options: Options<T>): ActionReturn<Options<T>, DndZoneAttributes<T>>;

export declare function dndzone<T extends Item>(
    node: HTMLElement,
    options: Options<T>
): {
    update: (newOptions: Options<T>) => void;
    destroy: () => void;
};

export type TransformDraggedElementFunction = (
    element?: HTMLElement, // the dragged element.
    draggedElementData?: Item, // the data of the item from the items array
    index?: number // the index the dragged element would get if dropped into the new dnd-zone
) => void;

export declare type Item = Record<string, any>;
export interface Options<T extends Item = Item> {
    items: T[]; // the list of items that was used to generate the children of the given node
    type?: string; // the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, defaults to a base type
    flipDurationMs?: number; // if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict
    dragDisabled?: boolean;
    morphDisabled?: boolean;
    dropFromOthersDisabled?: boolean;
    zoneTabIndex?: number; // set the tabindex of the list container when not dragging
    zoneItemTabIndex?: number; // set the tabindex of the list container items when not dragging
    dropTargetClasses?: string[];
    dropTargetStyle?: Record<string, string>;
    transformDraggedElement?: TransformDraggedElementFunction;
    autoAriaDisabled?: boolean;
    centreDraggedOnCursor?: boolean;
}

export interface DndZoneAttributes<T> {
    "on:consider"?: (e: CustomEvent<DndEvent<T>>) => void;
    "on:finalize"?: (e: CustomEvent<DndEvent<T>>) => void;
    onconsider?: (e: CustomEvent<DndEvent<T>>) => void;
    onfinalize?: (e: CustomEvent<DndEvent<T>>) => void;
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
export declare const SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME = "data-is-dnd-shadow-item-hint";

/**
 * Allows the user to show/hide console debug output
 */
export declare function setDebugMode(isDebug: boolean): void;

export enum FEATURE_FLAG_NAMES {
    // Default value: false, This flag exists as a workaround for issue 454 (basically a browser bug) - seems like these rect values take time to update when in grid layout. Setting it to true can cause strange behaviour in the REPL for non-grid zones, see issue 470
    USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT = "FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT"
}
export declare function setFeatureFlag(flagName: FEATURE_FLAG_NAMES, flagValue: boolean);
