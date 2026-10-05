import {decrementActiveDropZoneCount, incrementActiveDropZoneCount, ITEM_ID_KEY, SOURCES, TRIGGERS} from "./constants";
import {isKeyboardDragTriggerKey} from "./keyboardDragTrigger";
import {styleActiveDropZones, styleInactiveDropZones} from "./helpers/styler";
import {dispatchConsiderEvent, dispatchFinalizeEvent} from "./helpers/dispatcher";
import {initAria, announceToScreenReader, destroyAria} from "./helpers/aria";
import {getWindowOf, toString} from "./helpers/util";
import {printDebug} from "./constants";

const DEFAULT_DROP_ZONE_TYPE = "--any--";
const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px"
};

let isDragging = false;
let draggedItemType;
let focusedDz;
let focusedDzLabel = "";
let focusedItem;
let focusedItemId;
let focusedItemLabel = "";
// Like pointer dragging, a keyboard drag only has destinations in the document it started in.
let dragDocument;
const allDragTargets = new WeakSet();
const elToKeyDownListeners = new WeakMap();
const elToFocusListeners = new WeakMap();
const dzToHandles = new Map();
const dzToConfig = new Map();
const typeToDropZones = new Map();
// Each document with zones gets its own aria elements, because a zone can live in another window than the one that loaded
// this module. That document and the same-origin documents around it, up to the loading document, get keydown, click and
// pagehide handlers, so that Escape and a click outside end a drag from any of them. A zone is released from the documents
// it registered with, even if it has moved to another document since.
const dzToDocuments = new Map();
const documentToRegistration = new Map();

/* TODO (potentially)
 * what's the deal with the black border of voice-reader not following focus?
 * maybe keep focus on the last dragged item upon drop?
 */

let INSTRUCTION_IDs;

/* drop-zones registration management */
function getDocumentsAround(doc) {
    const docs = [doc];
    // eslint-disable-next-line no-restricted-globals -- the documents above the loading one belong to whatever hosts the app
    for (let frame = doc.defaultView?.frameElement; frame && docs[docs.length - 1] !== document; frame = getWindowOf(frame).frameElement) {
        docs.push(frame.ownerDocument);
    }
    return docs;
}
function retainDocuments(dropZoneEl) {
    const docs = getDocumentsAround(dropZoneEl.ownerDocument);
    docs.forEach((doc, idx) => {
        let registration = documentToRegistration.get(doc);
        if (!registration) {
            printDebug(() => "adding global keydown and click handlers");
            // Handlers of its own, so that removing them through a window that has since navigated to another document
            // leaves the handlers of that document alone
            const handlers = {keydown: globalKeyDownHandler, click: globalClickHandler, pagehide: handleWindowHidden};
            registration = {win: doc.defaultView, zoneCount: 0, documentCount: 0, handlers: {}};
            Object.entries(handlers).forEach(([type, handler]) => {
                registration.handlers[type] = e => handler(e);
                registration.win?.addEventListener(type, registration.handlers[type]);
            });
            documentToRegistration.set(doc, registration);
        }
        registration.documentCount++;
        if (idx === 0 && registration.zoneCount++ === 0) {
            INSTRUCTION_IDs = initAria(doc);
        }
    });
    dzToDocuments.set(dropZoneEl, docs);
}
function releaseDocuments(dropZoneEl) {
    const docs = dzToDocuments.get(dropZoneEl);
    if (!docs) return;
    dzToDocuments.delete(dropZoneEl);
    docs.forEach((doc, idx) => {
        const registration = documentToRegistration.get(doc);
        if (idx === 0 && --registration.zoneCount === 0) {
            destroyAria(doc);
        }
        if (--registration.documentCount > 0) return;
        printDebug(() => "removing global keydown and click handlers");
        documentToRegistration.delete(doc);
        Object.entries(registration.handlers).forEach(([type, handler]) => registration.win?.removeEventListener(type, handler));
    });
}
function registerDropZone(dropZoneEl, type) {
    printDebug(() => "registering drop-zone if absent");
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    if (!typeToDropZones.get(type).has(dropZoneEl)) {
        typeToDropZones.get(type).add(dropZoneEl);
        incrementActiveDropZoneCount();
    }
    // a zone that moved to another document since it registered takes its registration along
    if (dzToDocuments.get(dropZoneEl)?.[0] !== dropZoneEl.ownerDocument) {
        releaseDocuments(dropZoneEl);
        retainDocuments(dropZoneEl);
    }
}
function unregisterDropZone(dropZoneEl, type) {
    printDebug(() => "unregistering drop-zone");
    if (isDragging && focusedDz === dropZoneEl) {
        handleDrop();
    }
    const dropZones = typeToDropZones.get(type);
    if (!dropZones || !dropZones.delete(dropZoneEl)) return;
    decrementActiveDropZoneCount();
    if (dropZones.size === 0) {
        typeToDropZones.delete(type);
    }
    releaseDocuments(dropZoneEl);
}

function globalKeyDownHandler(e) {
    if (!isDragging) return;
    switch (e.key) {
        case "Escape": {
            handleDrop();
            break;
        }
    }
}

function globalClickHandler(e) {
    if (!isDragging) return;
    if (!allDragTargets.has(e.currentTarget.document.activeElement)) {
        printDebug(() => "clicked outside of any draggable");
        handleDrop();
    }
}

// The focused zone's window is going away: it was closed or navigated, or its iframe was removed. End the drag so the
// zones in the other windows become tab stops again.
function handleWindowHidden(e) {
    if (isDragging && focusedDz && getWindowOf(focusedDz) === e.currentTarget) {
        printDebug(() => "the focused zone's window is going away");
        handleDrop();
    }
}

// Tab can cross iframe boundaries, but a destination must still belong to the drag's own document.
function isInDragDocument(dropZoneEl, doc = dragDocument) {
    return dropZoneEl.ownerDocument === doc;
}

function isAboveOrLeftOf(el, otherEl) {
    const position = el.getBoundingClientRect();
    const otherPosition = otherEl.getBoundingClientRect();
    return position.top < otherPosition.top || position.left < otherPosition.left;
}

// Tab order, focus-driven transfers, styling and announcements must agree about which zones can receive the item.
// tabindex=-1 alone is not a restriction: a click or consumer code can still focus a zone.
function isKeyboardDropTarget(dropZoneEl) {
    const config = dzToConfig.get(dropZoneEl);
    return config.type === draggedItemType && !config.dropFromOthersDisabled && !focusedItem.contains(dropZoneEl) && isInDragDocument(dropZoneEl);
}

function getActiveDragTabIndex(dropZoneEl) {
    return dropZoneEl !== focusedDz && isKeyboardDropTarget(dropZoneEl) ? 0 : -1;
}

function refreshActiveDragTabIndices() {
    dzToConfig.forEach((_, dropZoneEl) => {
        dropZoneEl.tabIndex = getActiveDragTabIndex(dropZoneEl);
    });
}

function grabIsAlive() {
    const focusedConfig = dzToConfig.get(focusedDz);
    if (focusedConfig?.items.some(item => item[ITEM_ID_KEY] === focusedItemId)) return true;
    printDebug(() => "dragged item is gone, dropping");
    handleDrop();
    return false;
}

function handleZoneFocus(e) {
    printDebug(() => "zone focus");
    if (!isDragging) return;
    const newlyFocusedDz = e.currentTarget;
    if (newlyFocusedDz === focusedDz || !isKeyboardDropTarget(newlyFocusedDz)) return;

    if (!grabIsAlive()) return;

    const dzFrom = focusedDz;
    const movedItemId = focusedItemId;
    focusedDzLabel = newlyFocusedDz.getAttribute("aria-label") || "";
    const {items: originItems} = dzToConfig.get(focusedDz);
    const originItem = originItems.find(item => item[ITEM_ID_KEY] === focusedItemId);
    const originIdx = originItems.indexOf(originItem);
    const itemToMove = originItems.splice(originIdx, 1)[0];
    const {items: targetItems, autoAriaDisabled} = dzToConfig.get(newlyFocusedDz);
    if (isAboveOrLeftOf(newlyFocusedDz, focusedDz)) {
        targetItems.push(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader(
                "movedToZoneEnd",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: targetItems.length,
                    count: targetItems.length
                },
                newlyFocusedDz.ownerDocument
            );
        }
    } else {
        targetItems.unshift(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader(
                "movedToZoneStart",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: 1,
                    count: targetItems.length
                },
                newlyFocusedDz.ownerDocument
            );
        }
    }
    // An announcement formatter can end the drag, for example by removing its window. The item still moves.
    if (isDragging) focusedDz = newlyFocusedDz;
    dispatchFinalizeEvent(dzFrom, originItems, {trigger: TRIGGERS.DROPPED_INTO_ANOTHER, id: movedItemId, source: SOURCES.KEYBOARD});
    if (dzToConfig.has(newlyFocusedDz)) {
        dispatchFinalizeEvent(newlyFocusedDz, targetItems, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: movedItemId, source: SOURCES.KEYBOARD});
    }
}

function triggerAllDzsUpdate() {
    dzToHandles.forEach(({update}, dz) => update(dzToConfig.get(dz)));
}

function handleDrop(dispatchConsider = true) {
    if (!isDragging || !focusedDz) return;
    printDebug(() => "drop");
    const droppedDz = focusedDz;
    const droppedConfig = dzToConfig.get(droppedDz);
    const droppedItemId = focusedItemId;
    const droppedItemType = draggedItemType;
    if (!droppedConfig) return;
    const droppedItemLabel = focusedItemLabel;
    const droppedDzLabel = focusedDzLabel;
    const droppedDocument = dragDocument;
    // Clear global drag state before running any consumer code: an announcement formatter, a blur handler or a consider
    // handler. A synchronous handler may destroy the focused zone or remove its window, and neither must recursively
    // enter handleDrop.
    focusedItem = null;
    focusedItemId = null;
    focusedItemLabel = "";
    draggedItemType = null;
    focusedDz = null;
    focusedDzLabel = "";
    dragDocument = undefined;
    isDragging = false;

    if (!droppedConfig.autoAriaDisabled) {
        // Include the destination and final position so localized messages can describe the completed drop.
        const droppedItems = droppedConfig.items;
        const droppedIdx = droppedItems.findIndex(item => item[ITEM_ID_KEY] === droppedItemId);
        announceToScreenReader(
            "dropped",
            {
                itemLabel: droppedItemLabel,
                zoneLabel: droppedDzLabel,
                position: (droppedIdx < 0 ? 0 : droppedIdx) + 1,
                count: droppedItems.length
            },
            droppedDz.ownerDocument
        );
    }
    const {activeElement} = droppedDz.ownerDocument;
    if (allDragTargets.has(activeElement)) {
        activeElement.blur();
    }
    if (dispatchConsider) {
        dispatchConsiderEvent(droppedDz, droppedConfig.items, {
            trigger: TRIGGERS.DRAG_STOPPED,
            id: droppedItemId,
            source: SOURCES.KEYBOARD
        });
    }
    const dropZones = typeToDropZones.get(droppedItemType);
    if (dropZones) {
        styleInactiveDropZones(
            Array.from(dropZones).filter(dz => isInDragDocument(dz, droppedDocument)),
            dz => dzToConfig.get(dz).dropTargetStyle,
            dz => dzToConfig.get(dz).dropTargetClasses
        );
    }
    triggerAllDzsUpdate();
}
//////
export function dndzone(node, options) {
    let destroyed = false;
    const config = {
        items: undefined,
        type: undefined,
        dragDisabled: false,
        zoneTabIndex: 0,
        zoneItemTabIndex: 0,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses: [],
        autoAriaDisabled: false
    };

    function swap(arr, i, j) {
        if (arr.length <= 1) return;
        arr.splice(j, 1, arr.splice(i, 1, arr[j])[0]);
    }

    function ownsArrowKey(e) {
        // Only the grabbed item owns reorder keys. Nested controls and other items keep their own key behaviour.
        return isDragging && node === focusedDz && isInDragDocument(node) && e.currentTarget === focusedItem && e.target === focusedItem;
    }

    function handleKeyDown(e) {
        printDebug(() => ["handling key down", e.key]);
        switch (e.key) {
            case "Enter":
            case " ": {
                // keys outside the configured trigger belong to the consumer - don't claim them in any way
                if (!isKeyboardDragTriggerKey(e.key)) {
                    return;
                }
                // we don't want to affect nested input elements or clickable elements
                if ((e.target.disabled !== undefined || e.target.href || e.target.isContentEditable) && !allDragTargets.has(e.target)) {
                    return;
                }
                e.preventDefault(); // preventing scrolling on spacebar
                e.stopPropagation();
                if (isDragging) {
                    // TODO - should this trigger a drop? only here or in general (as in when hitting space or enter outside of any zone)?
                    handleDrop();
                } else {
                    // drag start
                    handleDragStart(e);
                }
                break;
            }
            case "ArrowDown":
            case "ArrowRight": {
                if (!ownsArrowKey(e)) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow down", idx]);
                if (idx < children.length - 1) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader(
                            "movedToPosition",
                            {
                                itemLabel: focusedItemLabel,
                                zoneLabel: focusedDzLabel,
                                position: idx + 2,
                                count: items.length
                            },
                            node.ownerDocument
                        );
                    }
                    // An announcement formatter can end or move the drag, for example by removing its window.
                    if (!ownsArrowKey(e)) break;
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
            case "ArrowUp":
            case "ArrowLeft": {
                if (!ownsArrowKey(e)) return;
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow up", idx]);
                if (idx > 0) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader(
                            "movedToPosition",
                            {
                                itemLabel: focusedItemLabel,
                                zoneLabel: focusedDzLabel,
                                position: idx,
                                count: items.length
                            },
                            node.ownerDocument
                        );
                    }
                    // An announcement formatter can end or move the drag, for example by removing its window.
                    if (!ownsArrowKey(e)) break;
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
        }
    }
    function handleDragStart(e) {
        printDebug(() => "drag start");
        setCurrentFocusedItem(e.currentTarget);
        focusedDz = node;
        focusedDzLabel = node.getAttribute("aria-label") || "";
        draggedItemType = config.type;
        isDragging = true;
        dragDocument = node.ownerDocument;
        const dropTargets = Array.from(typeToDropZones.get(config.type)).filter(dz => dz === focusedDz || isKeyboardDropTarget(dz));
        styleActiveDropZones(
            dropTargets,
            dz => dzToConfig.get(dz).dropTargetStyle,
            dz => dzToConfig.get(dz).dropTargetClasses
        );
        if (!config.autoAriaDisabled) {
            // Include the starting position so localized messages can describe where the item was picked up.
            const startItems = dzToConfig.get(node).items;
            const startIdx = startItems.findIndex(item => item[ITEM_ID_KEY] === focusedItemId);
            announceToScreenReader(
                "dragStarted",
                {
                    itemLabel: focusedItemLabel,
                    zoneLabel: focusedDzLabel,
                    position: (startIdx < 0 ? 0 : startIdx) + 1,
                    count: startItems.length,
                    canMoveBetweenZones: dropTargets.length > 1
                },
                node.ownerDocument
            );
        }
        // an announcement formatter can end the drag, for example by removing its window
        if (!isDragging) return;
        dispatchConsiderEvent(node, dzToConfig.get(node).items, {trigger: TRIGGERS.DRAG_STARTED, id: focusedItemId, source: SOURCES.KEYBOARD});
        triggerAllDzsUpdate();
    }

    function handleClick(e) {
        if (!isDragging) return;
        if (e.currentTarget === focusedItem) return;
        e.stopPropagation();
        handleDrop(false);
        handleDragStart(e);
    }
    function setCurrentFocusedItem(draggableEl) {
        const {items} = dzToConfig.get(node);
        const children = Array.from(node.children);
        const focusedItemIdx = children.indexOf(draggableEl);
        focusedItem = draggableEl;
        focusedItem.tabIndex = config.zoneItemTabIndex;
        focusedItemId = items[focusedItemIdx][ITEM_ID_KEY];
        focusedItemLabel = children[focusedItemIdx].getAttribute("aria-label") || "";
    }

    function configure({
        items = [],
        type: newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        zoneTabIndex = 0,
        zoneItemTabIndex = 0,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses = [],
        autoAriaDisabled = false
    }) {
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        config.zoneTabIndex = zoneTabIndex;
        config.zoneItemTabIndex = zoneItemTabIndex;
        config.dropTargetStyle = dropTargetStyle;
        config.dropTargetClasses = dropTargetClasses;
        config.autoAriaDisabled = autoAriaDisabled;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);
        if (!autoAriaDisabled) {
            node.setAttribute("role", "list");
            node.setAttribute("aria-describedby", dragDisabled ? INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED : INSTRUCTION_IDs.DND_ZONE_ACTIVE);
        }
        dzToConfig.set(node, config);

        let itemMovedToThisZone = false;
        if (isDragging) {
            itemMovedToThisZone =
                isInDragDocument(node) &&
                config.type === draggedItemType &&
                config.items.some(item => item[ITEM_ID_KEY] === focusedItemId) &&
                node !== focusedDz;
            if (itemMovedToThisZone) {
                focusedDz = node;
                focusedDzLabel = node.getAttribute("aria-label") || "";
            }
            node.tabIndex = getActiveDragTabIndex(node);
        } else {
            node.tabIndex = config.zoneTabIndex;
        }

        node.addEventListener("focus", handleZoneFocus);

        for (let i = 0; i < node.children.length; i++) {
            const draggableEl = node.children[i];
            allDragTargets.add(draggableEl);
            draggableEl.tabIndex = isDragging ? -1 : config.zoneItemTabIndex;
            if (!autoAriaDisabled) {
                draggableEl.setAttribute("role", "listitem");
            }
            draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl));
            draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("click", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
            if (isDragging && isInDragDocument(node) && config.type === draggedItemType && config.items[i]?.[ITEM_ID_KEY] === focusedItemId) {
                printDebug(() => ["focusing on", {i, focusedItemId}]);
                // if it is a nested dropzone, it was re-rendered and we need to refresh our pointer
                focusedItem = draggableEl;
                focusedItem.tabIndex = config.zoneItemTabIndex;
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
            }
        }
        // Focusing the replacement item runs its focus handler, which can end the drag, for example by removing its window
        if (itemMovedToThisZone && isDragging) {
            // Nested actions are configured before their parent action. Refresh only
            // after focusedItem points at the replacement so nested zones stay untabbable.
            refreshActiveDragTabIndices();
        }
    }
    configure(options);

    const handles = {
        update: newOptions => {
            printDebug(() => `keyboard dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            printDebug(() => "keyboard dndzone will destroy");
            node.removeEventListener("focus", handleZoneFocus);
            for (const draggableEl of node.children) {
                draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl));
                draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl));
            }
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
            dzToHandles.delete(node);
        }
    };
    dzToHandles.set(node, handles);
    return handles;
}
