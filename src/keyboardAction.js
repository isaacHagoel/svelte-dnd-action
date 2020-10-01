import {decrementActiveDropZoneCount, incrementActiveDropZoneCount, ITEM_ID_KEY, TRIGGERS} from "./constants";
import {styleActiveDropZones, styleInactiveDropZones} from "./helpers/styler";
import {dispatchConsiderEvent, dispatchFinalizeEvent} from "./helpers/dispatcher";
import {createInstructions, tellUser} from "./helpers/keyboard/instructions";

const DEFAULT_DROP_ZONE_TYPE = '--any--';
const DEFAULT_DROP_TARGET_STYLE = {
    outline: 'rgba(255, 255, 102, 0.7) solid 2px',
};

let isDragging = false;
let draggedItemType;
let focusedDz;
let focusedDzLabel = "";
let focusedItemId;
let focusedItemLabel = "";
const allDragTargets = new WeakSet();
const elToKeyDownListeners = new WeakMap();
const elToFocusListeners = new WeakMap();
const dzToHandles = new Map();
const dzToConfig = new Map();
// a map from type to a set of drop-zones
const typeToDropZones = new Map();

/* TODO List
* what's the deal with the black border of voice-reader not following focus?
* maybe keep focus on the last dragged item upon drop?
* update readme
* test dropFromOtherDisabled
* test types
 */

const INSTRUCTION_IDs = createInstructions();

/* drop-zones registration management */
function registerDropZone(dropZoneEl, type) {
    console.debug('registering drop-zone if absent')
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    if (!typeToDropZones.get(type).has(dropZoneEl)) {
        typeToDropZones.get(type).add(dropZoneEl);
        incrementActiveDropZoneCount();
    }
}
function unregisterDropZone(dropZoneEl, type) {
    typeToDropZones.get(type).delete(dropZoneEl);
    decrementActiveDropZoneCount();
    if (typeToDropZones.get(type).size === 0) {
        typeToDropZones.delete(type);
    }
}

function handleZoneFocus(e) {
    console.log("zone focus");
    focusedDzLabel = e.currentTarget.getAttribute('aria-label') || '';
    if (!isDragging) return;
    if (e.currentTarget !== focusedDz) {
        const {items:originItems} = dzToConfig.get(focusedDz);
        const originItem = originItems.find(item => item[ITEM_ID_KEY] === focusedItemId);
        const originIdx = originItems.indexOf(originItem);
        const itemToMove = originItems.splice(originIdx, 1)[0];
        const {items:targetItems} = dzToConfig.get(e.currentTarget);
        if (e.currentTarget.getBoundingClientRect().top < focusedDz.getBoundingClientRect().top || e.currentTarget.getBoundingClientRect().left < focusedDz.getBoundingClientRect().left) {
            targetItems.push(itemToMove);
            tellUser(`moved item ${focusedItemLabel} to the end of the list ${focusedDzLabel}`);
        } else {
            targetItems.unshift(itemToMove);
            tellUser(`moved item ${focusedItemLabel} to the beginning of the list ${focusedDzLabel}`);
        }
        const dzFrom = focusedDz;
        dispatchFinalizeEvent(dzFrom, originItems, {trigger: TRIGGERS.DROPPED_INTO_ANOTHER, id: focusedItemId});
        dispatchFinalizeEvent(e.currentTarget, targetItems, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId});
        focusedDz = e.currentTarget;
    }

}
function globalKeyDownHandler(e) {
    if (!isDragging) return;
    switch(e.key) {
        case("Escape"): {
            handleDrop();
            break;
        }
    }
}
window.addEventListener("keydown", globalKeyDownHandler);

function globalClickHandler() {
    if (!isDragging) return ;
    if (!allDragTargets.has(document.activeElement)) {
        console.warn("clicked outside of any draggable");
        handleDrop();
    }
}
window.addEventListener('click', globalClickHandler);

function triggerAllDzsUpdate() {
    console.warn({dzToHandles});
    dzToHandles.forEach(({update}, dz) => update(dzToConfig.get(dz)));
}

//////
function handleDrop() {
    console.log("drop");
    tellUser(`stopped dragging item ${focusedItemLabel}`);
    if (allDragTargets.has(document.activeElement)) {
        console.log('blur');
        document.activeElement.blur();
    }
    styleInactiveDropZones(typeToDropZones.get(draggedItemType), dz => dzToConfig.get(dz).dropTargetStyle);
    focusedItemId = null;
    focusedItemLabel = '';
    draggedItemType = null;
    focusedDz = null;
    focusedDzLabel = '';
    isDragging = false;
    triggerAllDzsUpdate();
}
//////
export function dndzone(node, options) {
    const config =  {
        items: undefined,
        type: DEFAULT_DROP_ZONE_TYPE,
        dragDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE
    };

    function swap (arr, i, j) {
        if (arr.length <= 1) return;
        arr.splice(j, 1, arr.splice(i, 1, arr[j])[0]);
    }

    function handleKeyDown(e) {
        console.log("handling key down", e.key);
        switch(e.key) {
            case("Enter"):
            case(" "): {
                e.preventDefault(); // preventing scrolling on spacebar
                e.stopPropagation();
                if (isDragging) {
                    // TODO - should this trigger a drop? only here or in general (as in when hitting space or enter outside of any zone)?
                    handleDrop();
                } else {
                    // drag start
                    handleDragStart(e)
                }
                break;
            }
            case("ArrowDown"):
            case("ArrowRight"):{
                if (!isDragging) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                console.log("arrow down", idx);
                if (idx < children.length - 1) {
                    console.log("swapping");
                    tellUser(`moved item ${focusedItemLabel} to position ${idx + 2} in the list ${focusedDzLabel}`);
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId});
                }
                break;
            }
            case("ArrowUp"):
            case("ArrowLeft"):{
                if (!isDragging) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                console.log("arrow up", idx);
                if (idx > 0) {
                    console.log("swapping");
                    tellUser(`moved item ${focusedItemLabel} to position ${idx} in the list ${focusedDzLabel}`);
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId});
                }
                break;
            }
        }
    }
    function handleDragStart(e) {
        console.log("drag start");
        // TODO - move this message to instructions?
        tellUser(`Started dragging item ${focusedItemLabel}. Use the arrow keys to move it within its list ${focusedDzLabel}, or tab to another list in order to move it into it`);
        setCurrentFocusedItemId(e.currentTarget);
        console.log({focusedItemId});
        focusedDz = node;
        draggedItemType = config.type;
        isDragging = true;
        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type))
                .filter(dz => dz === focusedDz || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle,
        );
        dispatchConsiderEvent(node, dzToConfig.get(node).items, {trigger: TRIGGERS.DRAG_STARTED, id: focusedItemId});
        triggerAllDzsUpdate();
    }

    function handleClick(e) {
        if(!isDragging) return;
        setCurrentFocusedItemId(e.currentTarget);
    }
    function setCurrentFocusedItemId(draggableEl) {
        const {items} = dzToConfig.get(node);
        const children = Array.from(node.children);
        const focusedItemIdx = children.indexOf(draggableEl);
        focusedItemId = items[focusedItemIdx][ITEM_ID_KEY];
        focusedItemLabel = children[focusedItemIdx].getAttribute('aria-label') || '';
    }
    function configure({
                        items = [],
                        type: newType = DEFAULT_DROP_ZONE_TYPE,
                        dragDisabled = false,
                        dropFromOthersDisabled = false,
                        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE
                    }) {
        // TODO - examine the line below
        if(!node.children) return;
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        config.dropTargetStyle = dropTargetStyle;

        ////// TODO - move to a util - only set these if they are not already defined?
        //node.setAttribute("aria-label", "A drag and drop container");
        // TODO - add to README - user is expected to set aria-label on the node and children if they want it announced
        node.setAttribute("aria-disabled", dragDisabled);
        node.setAttribute("role", "list");
        node.setAttribute("aria-describedby", dragDisabled? INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED : INSTRUCTION_IDs.DND_ZONE_ACTIVE);
        ////
        node.tabIndex = isDragging && (node === focusedDz || config.dragDisabled || config.dropFromOthersDisabled || (focusedDz && config.type!==dzToConfig.get(focusedDz).type)) ? -1 : 0;
        node.addEventListener('focus', handleZoneFocus);

        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);
        dzToConfig.set(node, config);

        for(let i=0; i < node.children.length ; i++) {
            const draggableEl = node.children[i];
            allDragTargets.add(draggableEl);
            draggableEl.tabIndex = (isDragging) ? -1 : 0;
            // TODO - move to a util
            draggableEl.setAttribute("role", "listitem");
            draggableEl.removeEventListener("keyDown", elToKeyDownListeners.get(draggableEl));
            draggableEl.removeEventListener("focus", elToFocusListeners.get(draggableEl));
            if (!dragDisabled) {
                //draggableEl.setAttribute("aria-grabbed", false);
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("focus", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
            if (isDragging && config.items[i][ITEM_ID_KEY] === focusedItemId) {
                console.log("focusing on", {i, focusedItemId})
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
                // TODO - examine aria grabbed and aria droptarget (is it deprecated?)
                //draggableEl.setAttribute("aria-grabbed", true);
            }
        }
    }
    configure(options);

    const handles = {
        update: (newOptions) => {
            console.log("updating", newOptions);
            configure(newOptions);
        },
        destroy: () => {
            console.log("this is so sad");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
            dzToHandles.delete(node);
        }
    };
    dzToHandles.set(node, handles);
    return handles;
}