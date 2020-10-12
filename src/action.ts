import {dndzone as pointerDndZone} from "./pointerAction";
import {dndzone as keyboardDndZone} from "./keyboardAction";
import {ITEM_ID_KEY} from "./constants";
import {toString} from "./helpers/util";

export type Item = Record<string, any>;

export type TransformDraggedElementFunction = (
    element?: Element, // the dragged element.
    data?: Item, // the data of the item from the items array
    index?: number, // the index the dragged element will become in the new dnd-zone.
) => void;

export interface Options {
    items: Item[]; // the list of items that was used to generate the children of the given node (the list used in the #each block)
    type?: string; // the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, default to a base type
    flipDurationMs?: number; // if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict, defaults to zero
    dragDisabled?: boolean;
    dropFromOthersDisabled?: boolean;
    dropTargetStyle?: Record<string, any>;
    transformDraggedElement?: TransformDraggedElementFunction;
    autoAriaDisabled?: boolean;
}

/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 */
export function dndzone(
    node: HTMLElement, // the element to enhance
    options: Options,
): { update: (options: Options) => void; destroy: () => void } {
    validateOptions(options);
    const pointerZone = pointerDndZone(node, options);
    const keyboardZone = keyboardDndZone(node, options);
    return {
        update: (newOptions: Options) => {
            validateOptions(newOptions);
            pointerZone.update(newOptions);
            keyboardZone.update(newOptions);
        },
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        }
    }
}

function validateOptions(options: Options) {
    const {
        items,
        flipDurationMs,
        type,
        dragDisabled,
        dropFromOthersDisabled,
        dropTargetStyle,
        transformDraggedElement,
        autoAriaDisabled,
        ...rest
    } = options;
    if (Object.keys(rest).length > 0) {
        console.warn(`dndzone will ignore unknown options`, rest);
    }
    if (!items) {
        throw new Error("no 'items' key provided to dndzone");
    }
    const itemWithMissingId = items.find(item => !item.hasOwnProperty(ITEM_ID_KEY));
    if (itemWithMissingId) {
        throw new Error(`missing '${ITEM_ID_KEY}' property for item ${toString(itemWithMissingId)}`);
    }
}
