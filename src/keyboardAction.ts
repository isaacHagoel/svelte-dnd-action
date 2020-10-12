import {decrementActiveDropZoneCount, incrementActiveDropZoneCount, ITEM_ID_KEY, SOURCES, TRIGGERS} from "./constants";
import {styleActiveDropZones, styleInactiveDropZones} from "./helpers/styler";
import {dispatchConsiderEvent, dispatchFinalizeEvent} from "./helpers/dispatcher";
import {createInstructions, alertToScreenReader} from "./helpers/aria";
import {toString} from "./helpers/util";
import type { Options, Item } from "./action";

const DEFAULT_DROP_ZONE_TYPE = '--any--';
const DEFAULT_DROP_TARGET_STYLE = {
    outline: 'rgba(255, 255, 102, 0.7) solid 2px',
};

interface Handles {
    update: (newOptions: Partial<Options>) => void;
    destroy: () => void;
}

let isDragging = false;
let draggedItemType: string | undefined;
let focusedDz: Element | undefined;
let focusedDzLabel = "";
let focusedItem: Item | undefined;
let focusedItemId: string | undefined;
let focusedItemLabel = "";
const allDragTargets = new WeakSet<Element | null>();
const elToKeyDownListeners = new WeakMap<Element, (e: KeyboardEvent) => void>();
const elToFocusListeners = new WeakMap<Element, (e: MouseEvent) => void>();
const dzToHandles = new Map<Element, Handles>();
const dzToConfig = new Map<Element | undefined, Config>();
const typeToDropZones = new Map<string, Set<HTMLElement>>();

/* TODO (potentially)
* what's the deal with the black border of voice-reader not following focus?
* maybe keep focus on the last dragged item upon drop?
 */

const INSTRUCTION_IDs = createInstructions();

/* drop-zones registration management */
function registerDropZone(dropZoneEl: HTMLElement, type: string) {
    console.debug('registering drop-zone if absent')
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    if (!typeToDropZones.get(type).has(dropZoneEl)) {
        typeToDropZones.get(type).add(dropZoneEl);
        incrementActiveDropZoneCount();
    }
}
function unregisterDropZone(dropZoneEl: HTMLElement, type: string) {
    typeToDropZones.get(type).delete(dropZoneEl);
    decrementActiveDropZoneCount();
    if (typeToDropZones.get(type).size === 0) {
        typeToDropZones.delete(type);
    }
}

function handleZoneFocus(e: FocusEvent) {
    console.debug("zone focus");
    focusedDzLabel = (e.currentTarget as Element).getAttribute('aria-label') || '';
    if (!isDragging) return;
    if (e.currentTarget !== focusedDz) {
        const {items:originItems} = dzToConfig.get(focusedDz);
        const originItem = originItems.find(item => item[ITEM_ID_KEY] === focusedItemId);
        const originIdx = originItems.indexOf(originItem);
        const itemToMove = originItems.splice(originIdx, 1)[0];
        const {items:targetItems, autoAriaDisabled} = dzToConfig.get(e.currentTarget as Element);
        if ((e.currentTarget as Element).getBoundingClientRect().top < focusedDz.getBoundingClientRect().top || (e.currentTarget as Element).getBoundingClientRect().left < focusedDz.getBoundingClientRect().left) {
            targetItems.push(itemToMove);
            if (!autoAriaDisabled) {
                alertToScreenReader(`Moved item ${focusedItemLabel} to the end of the list ${focusedDzLabel}`);
            }
        } else {
            targetItems.unshift(itemToMove);
            if (!autoAriaDisabled) {
                alertToScreenReader(`Moved item ${focusedItemLabel} to the beginning of the list ${focusedDzLabel}`);
            }
        }
        const dzFrom = focusedDz;
        dispatchFinalizeEvent(dzFrom, originItems, {trigger: TRIGGERS.DROPPED_INTO_ANOTHER, id: focusedItemId, source: SOURCES.KEYBOARD});
        dispatchFinalizeEvent(e.currentTarget as Node, targetItems, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
        focusedDz = e.currentTarget as Element;
    }

}
function globalKeyDownHandler(e: KeyboardEvent) {
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
        console.debug("clicked outside of any draggable");
        handleDrop();
    }
}
window.addEventListener('click', globalClickHandler);

function triggerAllDzsUpdate() {
    dzToHandles.forEach(({update}, dz) => update(dzToConfig.get(dz)));
}

function handleDrop(dispatchConsider = true) {
    console.debug("drop");
    if (!dzToConfig.get(focusedDz).autoAriaDisabled) {
        alertToScreenReader(`Stopped dragging item ${focusedItemLabel}`);
    }
    if (allDragTargets.has(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
    }
    if (dispatchConsider) {
        dispatchConsiderEvent(focusedDz, dzToConfig.get(focusedDz).items, {trigger: TRIGGERS.DRAG_STOPPED, id: focusedItemId, source: SOURCES.KEYBOARD});
    }
    styleInactiveDropZones(typeToDropZones.get(draggedItemType), dz => dzToConfig.get(dz).dropTargetStyle);
    focusedItem = null;
    focusedItemId = null;
    focusedItemLabel = '';
    draggedItemType = null;
    focusedDz = null;
    focusedDzLabel = '';
    isDragging = false;
    triggerAllDzsUpdate();
}

type Config = Partial<Options>;

//////
export function dndzone(node: HTMLElement, options: Options) {
    const config: Config = {
        items: undefined,
        type: undefined,
        dragDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        autoAriaDisabled: false
    };

    function swap (arr: Item[], i: number, j: number) {
        if (arr.length <= 1) return;
        arr.splice(j, 1, arr.splice(i, 1, arr[j])[0]);
    }

    function handleKeyDown(e: KeyboardEvent) {
        console.debug("handling key down", e.key);
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
                const idx = children.indexOf(e.currentTarget as Element);
                console.debug("arrow down", idx);
                if (idx < children.length - 1) {
                    if (!config.autoAriaDisabled) {
                        alertToScreenReader(`Moved item ${focusedItemLabel} to position ${idx + 2} in the list ${focusedDzLabel}`);
                    }
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
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
                const idx = children.indexOf(e.currentTarget as Element);
                console.debug("arrow up", idx);
                if (idx > 0) {
                    if (!config.autoAriaDisabled) {
                        alertToScreenReader(`Moved item ${focusedItemLabel} to position ${idx} in the list ${focusedDzLabel}`);
                    }
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
        }
    }
    function handleDragStart(e: MouseEvent | KeyboardEvent) {
        console.debug("drag start");
        if (!config.autoAriaDisabled) {
            alertToScreenReader(`Started dragging item ${focusedItemLabel}. Use the arrow keys to move it within its list ${focusedDzLabel}, or tab to another list in order to move the item into it`);
        }
        setCurrentFocusedItem(e.currentTarget as Element);
        focusedDz = node;
        draggedItemType = config.type;
        isDragging = true;
        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type))
                .filter((dz: Element) => dz === focusedDz || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle,
        );
        dispatchConsiderEvent(node, dzToConfig.get(node).items, {trigger: TRIGGERS.DRAG_STARTED, id: focusedItemId, source: SOURCES.KEYBOARD});
        triggerAllDzsUpdate();
    }

    function handleClick(e: MouseEvent) {
        if(!isDragging) return;
        if (e.currentTarget === focusedItem) return;
        handleDrop(false);
        handleDragStart(e);
    }
    function setCurrentFocusedItem(draggableEl: Element) {
        const {items} = dzToConfig.get(node);
        const children = Array.from(node.children);
        const focusedItemIdx = children.indexOf(draggableEl);
        focusedItem = draggableEl;
        focusedItemId = items[focusedItemIdx][ITEM_ID_KEY];
        focusedItemLabel = children[focusedItemIdx].getAttribute('aria-label') || '';
    }

    function configure({
                        items = [],
                        type: newType = DEFAULT_DROP_ZONE_TYPE,
                        dragDisabled = false,
                        dropFromOthersDisabled = false,
                        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
                        autoAriaDisabled = false
                    }: Partial<Options>) {
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        config.dropTargetStyle = dropTargetStyle;
        config.autoAriaDisabled = autoAriaDisabled;
        if (!autoAriaDisabled) {
            // @ts-expect-error
            node.setAttribute("aria-disabled", dragDisabled);
            node.setAttribute("role", "list");
            node.setAttribute("aria-describedby", dragDisabled? INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED : INSTRUCTION_IDs.DND_ZONE_ACTIVE);
        }
        node.tabIndex = isDragging && (node === focusedDz || config.dropFromOthersDisabled || (focusedDz && config.type!==dzToConfig.get(focusedDz).type)) ? -1 : 0;
        node.addEventListener('focus', handleZoneFocus);

        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);
        dzToConfig.set(node, config);

        for(let i=0; i < node.children.length ; i++) {
            const draggableEl = node.children[i] as HTMLElement;
            allDragTargets.add(draggableEl);
            draggableEl.tabIndex = (isDragging) ? -1 : 0;
            if (!autoAriaDisabled) {
                draggableEl.setAttribute("role", "listitem");
            }
            // @ts-expect-error keyDown should be keydown
            draggableEl.removeEventListener("keyDown", elToKeyDownListeners.get(draggableEl));
            draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("click", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
            if (isDragging && config.items[i][ITEM_ID_KEY] === focusedItemId) {
                console.debug("focusing on", {i, focusedItemId})
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
            }
        }
    }
    configure(options);

    const handles: Handles = {
        update: (newOptions: Partial<Options>) => {
            console.debug(`keyboard dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            console.debug("keyboard dndzone will destroy");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
            dzToHandles.delete(node);
        }
    };
    dzToHandles.set(node, handles);
    return handles;
}
