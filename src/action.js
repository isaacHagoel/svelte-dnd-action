import {dndzone as pointerDndZone} from "./pointerAction";
import {dndzone as keyboardDndZone} from "./keyboardAction";
import {ITEM_ID_KEY, SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME} from "./constants";
import {toString} from "./helpers/util";

/**
 * A custom action to turn any container to a dnd zone and all of its direct children to draggables
 * Supports mouse, touch and keyboard interactions.
 * Dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 *
 * @typedef {object} Options
 * @property {array} items - the list of items that was used to generate the children of the given node (the list used in the #each block
 * @property {string} [type] - the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, default to a base type
 * @property {number} [flipDurationMs] - if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict, defaults to zero
 * @property {boolean} [dragDisabled]
 * @property {boolean} [morphDisabled] - whether dragged element should morph to zone dimensions
 * @property {boolean} [dropFromOthersDisabled]
 * @property {number} [zoneTabIndex] - set the tabindex of the list container when not dragging
 * @property {number} [zoneItemTabIndex] - set the tabindex of the list container items when not dragging
 * @property {object} [dropTargetStyle]
 * @property {string[]} [dropTargetClasses]
 * @property {function} [transformDraggedElement]
 * @param {HTMLElement} node - the element to enhance
 * @param {Options} options
 * @return {{update: function, destroy: function}}
 */
export function dndzone(node, options) {
    if (shouldIgnoreZone(node)) {
        return {
            update: () => {},
            destroy: () => {}
        };
    }
    validateOptions(options);
    const pointerZone = pointerDndZone(node, options);
    const keyboardZone = keyboardDndZone(node, options);
    return {
        update: newOptions => {
            validateOptions(newOptions);
            pointerZone.update(newOptions);
            keyboardZone.update(newOptions);
        },
        destroy: () => {
            pointerZone.destroy();
            keyboardZone.destroy();
        }
    };
}

/**
 * If the user marked something in the ancestry of our node as shadow element, we can ignore it
 * We need the user to mark it for us because svelte updates the action from deep to shallow (but renders top down)
 * @param {HTMLElement} node
 * @return {boolean}
 */
function shouldIgnoreZone(node) {
    return !!node.closest(`[${SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME}="true"]`);
}

function validateOptions(options) {
    /*eslint-disable*/
    const {
        items,
        flipDurationMs,
        type,
        dragDisabled,
        morphDisabled,
        dropFromOthersDisabled,
        zoneTabIndex,
        zoneItemTabIndex,
        dropTargetStyle,
        dropTargetClasses,
        transformDraggedElement,
        autoAriaDisabled,
        centreDraggedOnCursor,
        ...rest
    } = options;
    /*eslint-enable*/
    if (Object.keys(rest).length > 0) {
        console.warn(`dndzone will ignore unknown options`, rest);
    }
    if (!items) {
        throw new Error("no 'items' key provided to dndzone");
    }
    const itemWithMissingId = items.find(item => !{}.hasOwnProperty.call(item, ITEM_ID_KEY));
    if (itemWithMissingId) {
        throw new Error(`missing '${ITEM_ID_KEY}' property for item ${toString(itemWithMissingId)}`);
    }
    if (dropTargetClasses && !Array.isArray(dropTargetClasses)) {
        throw new Error(`dropTargetClasses should be an array but instead it is a ${typeof dropTargetClasses}, ${toString(dropTargetClasses)}`);
    }
    if (zoneTabIndex && !isInt(zoneTabIndex)) {
        throw new Error(`zoneTabIndex should be a number but instead it is a ${typeof zoneTabIndex}, ${toString(zoneTabIndex)}`);
    }
    if (zoneItemTabIndex && !isInt(zoneItemTabIndex)) {
        throw new Error(`zoneItemTabIndex should be a number but instead it is a ${typeof zoneItemTabIndex}, ${toString(zoneItemTabIndex)}`);
    }
}

function isInt(value) {
    return (
        !isNaN(value) &&
        (function (x) {
            return (x | 0) === x;
        })(parseFloat(value))
    );
}
