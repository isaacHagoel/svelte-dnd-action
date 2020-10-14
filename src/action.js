import {dndzone as pointerDndZone} from "./pointerAction";
import {dndzone as keyboardDndZone} from "./keyboardAction";
import {ITEM_ID_KEY} from "./constants";
import {toString} from "./helpers/util";

/**
 * @callback TransformDraggedElementFunc
 * @param {HTMLElement} draggedElement
 * @param {object} [draggedElementData] - the relevant entry from the provided items array
 * @param {number} [index] - the would be index of the dragged element if it is dropped
 * @return {void}
 */

/**
 * @typedef {Object} Options
 * @property {Array<object>} items - the list of items that was used to generate the children of the given node (the list used in the #each block
 * @property {string} [type] - the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, default to a base type
 * @property {number} [flipDurationMs] - if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict, defaults to zero
 * @property {boolean} [dragDisabled]
 * @property {boolean} [dropFromOthersDisabled]
 * @property {Record<string, string>} [dragTargetStyle]
 * @property {TransformDraggedElementFunc} [transformDraggedElement]
 */

/**
 * @callback UpdateFunc
 * @param {Options} newOptions
 * @return {void}
 */
/**
 * @callback DestroyFunc
 * @return {void}
 */

// TODO - improve Info and check whether this needs 'detail', check how to make typescript export it
/**
 * @event DndEvent
 * @type {object}
 * @property {Array<object>} items
 * @property {Info} info
 */
/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 *
 * @param {HTMLElement} node - the element to enhance
 * @param {Options} options
 * @fires {DndEvent}
 * @return {{update: UpdateFunc, destroy: DestroyFunc}}
 */
export function dndzone(node, options) {
    validateOptions(options);
    const pointerZone = pointerDndZone(node, options);
    const keyboardZone = keyboardDndZone(node, options);
    return {
        /** @type {UpdateFunc} update */
        update: newOptions => {
            validateOptions(newOptions);
            pointerZone.update(newOptions);
            keyboardZone.update(newOptions);
        },
        /** @type {DestroyFunc} destroy */
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        }
    }
}

function validateOptions(options) {
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