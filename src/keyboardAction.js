import {decrementActiveDropZoneCount, incrementActiveDropZoneCount, ITEM_ID_KEY, TRIGGERS} from "./constants";
import {styleActiveDropZones, styleInactiveDropZones} from "./helpers/styler";
import {dispatchConsiderEvent, dispatchFinalizeEvent} from "./helpers/dispatcher";

const DEFAULT_DROP_ZONE_TYPE = '--any--';
const DEFAULT_DROP_TARGET_STYLE = {
    outline: 'rgba(255, 255, 102, 0.7) solid 2px',
};

let isDragging = false;
let draggedItemType;
let originDz;
let focusedItemId;
const allDragTargets = new WeakSet();
const elToKeyDownListeners = new WeakMap();
const elToFocusListeners = new WeakMap();
const dzToConfig = new Map();
// a map from type to a set of drop-zones
const typeToDropZones = new Map();

/* TODO List
* check the effect of using a ul and li instead of section and div (on reader)
* when it is a ul maybe i can detect it and not listen on arrow keys (plus change instructions)
 */

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
    if (!isDragging) return;
    if (e.target !== originDz) {
        const {items:originItems} = dzToConfig.get(originDz);
        const originItem = originItems.find(item => item[ITEM_ID_KEY] === focusedItemId);
        const originIdx = originItems.indexOf(originItem);
        const itemToMove = originItems.splice(originIdx, 1)[0];
        const {items:targetItems} = dzToConfig.get(e.target);
        if (e.target.getBoundingClientRect().top < originDz.getBoundingClientRect().top || e.target.getBoundingClientRect().left < originDz.getBoundingClientRect().left) {
            targetItems.push(itemToMove);
        } else {
            targetItems.unshift(itemToMove);
        }
        const dzFrom = originDz;
        dispatchFinalizeEvent(dzFrom, originItems, {trigger: TRIGGERS.DROPPED_INTO_ANOTHER, id: focusedItemId});
        dispatchFinalizeEvent(e.target, targetItems, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId});
        originDz = e.target;
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

//////
function handleDrop() {
    console.log("drop");
    if (allDragTargets.has(document.activeElement)) {
        console.log('blur');
        document.activeElement.blur();
    }
    styleInactiveDropZones(typeToDropZones.get(draggedItemType), dz => dzToConfig.get(dz).dropTargetStyle);
    Array.from(dzToConfig.keys()).filter(dz => dzToConfig.get(dz).dragDisabled).flatMap(dz => Array.from(dz.children)).forEach(draggableEl => draggableEl.tabIndex = 0);
    focusedItemId = null;
    draggedItemType = null;
    originDz = null;
    isDragging = false;
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
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId});
                }
                break;
            }
        }
    }
    function handleDragStart(e) {
        console.log("drag start");
        setCurrentFocusedItemId(e.currentTarget);
        console.log({focusedItemId});
        originDz = node;
        draggedItemType = config.type;
        isDragging = true;
        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type))
                .filter(dz => dz === originDz || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle,
        );
        Array.from(dzToConfig.keys()).flatMap(dz => Array.from(dz.children)).forEach(draggableEl => draggableEl.tabIndex = -1);
        dispatchConsiderEvent(node, dzToConfig.get(node).items, {trigger: TRIGGERS.DRAG_STARTED, id: focusedItemId});
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

        node.tabIndex = (node === originDz || config.dragDisabled || config.dropFromOthersDisabled || (originDz && config.type!==dzToConfig.get(originDz).type)) ? -1 : 0;
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
            draggableEl.tabIndex = (isDragging || config.dragDisabled) ? -1 : 0;
            if (isDragging && config.items[i][ITEM_ID_KEY] === focusedItemId) {
                console.log("focusing on", {i, focusedItemId})
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
            }
            draggableEl.removeEventListener("keyDown", elToKeyDownListeners.get(draggableEl));
            draggableEl.removeEventListener("focus", elToFocusListeners.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("focus", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
        }
    }
    configure(options);

    return {
        update: (newOptions) => {
            console.log("updating", newOptions);
            configure(newOptions);
        },
        destroy: () => {
            console.log("this is so sad");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
        }
    };
}