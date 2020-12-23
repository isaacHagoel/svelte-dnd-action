import {
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    ITEM_ID_KEY,
    TRIGGERS,
    incrementActiveDropZoneCount,
    decrementActiveDropZoneCount,
    SOURCES
} from "./constants";
import {observe, unobserve} from "./helpers/observer";
import {armWindowScroller, disarmWindowScroller} from "./helpers/windowScroller";
import {
    createDraggedElementFrom,
    moveDraggedElementToWasDroppedState,
    morphDraggedElementToBeLike,
    styleDraggable,
    decorateShadowEl,
    styleActiveDropZones,
    styleInactiveDropZones,
    hideOriginalDragTarget,
    unDecorateShadowElement
} from "./helpers/styler";
import {
    DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_LEFT_DOCUMENT_EVENT_NAME,
    DRAGGED_OVER_INDEX_EVENT_NAME,
    dispatchConsiderEvent,
    dispatchFinalizeEvent,
    DRAGGED_LEFT_TYPES
} from "./helpers/dispatcher";
import {areObjectsShallowEqual, toString} from "./helpers/util";
import {printDebug} from "./constants";

const DEFAULT_DROP_ZONE_TYPE = "--any--";
const MIN_OBSERVATION_INTERVAL_MS = 100;
const MIN_MOVEMENT_BEFORE_DRAG_START_PX = 3;
const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px"
};

let originalDragTarget;
let draggedEl;
let draggedElData;
let draggedElType;
let originDropZone;
let originIndex;
let shadowElData;
let shadowElDropZone;
let dragStartMousePosition;
let currentMousePosition;
let isWorkingOnPreviousDrag = false;
let finalizingPreviousDrag = false;

// a map from type to a set of drop-zones
const typeToDropZones = new Map();
// important - this is needed because otherwise the config that would be used for everyone is the config of the element that created the event listeners
const dzToConfig = new Map();
// this is needed in order to be able to cleanup old listeners and avoid stale closures issues (as the listener is defined within each zone)
const elToMouseDownListener = new WeakMap();

/* drop-zones registration management */
function registerDropZone(dropZoneEl, type) {
    printDebug(() => "registering drop-zone if absent");
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

/* functions to manage observing the dragged element and trigger custom drag-events */
function watchDraggedElement() {
    printDebug(() => "watching dragged element");
    armWindowScroller();
    const dropZones = typeToDropZones.get(draggedElType);
    for (const dz of dropZones) {
        dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.addEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    // it is important that we don't have an interval that is faster than the flip duration because it can cause elements to jump bach and forth
    const observationIntervalMs = Math.max(
        MIN_OBSERVATION_INTERVAL_MS,
        ...Array.from(dropZones.keys()).map(dz => dzToConfig.get(dz).dropAnimationDurationMs)
    );
    observe(draggedEl, dropZones, observationIntervalMs * 1.07);
}
function unWatchDraggedElement() {
    printDebug(() => "unwatching dragged element");
    disarmWindowScroller();
    const dropZones = typeToDropZones.get(draggedElType);
    for (const dz of dropZones) {
        dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.removeEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    unobserve();
}

/* custom drag-events handlers */
function handleDraggedEntered(e) {
    printDebug(() => ["dragged entered", e.currentTarget, e.detail]);
    let {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    // this deals with another race condition. in rare occasions (super rapid operations) the list hasn't updated yet
    items = items.filter(i => i[ITEM_ID_KEY] !== shadowElData[ITEM_ID_KEY]);
    printDebug(() => `dragged entered items ${toString(items)}`);

    if (originDropZone !== e.currentTarget) {
        const originZoneItems = dzToConfig.get(originDropZone).items;
        const newOriginZoneItems = originZoneItems.filter(item => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
        dispatchConsiderEvent(originDropZone, newOriginZoneItems, {
            trigger: TRIGGERS.DRAGGED_ENTERED_ANOTHER,
            id: draggedElData[ITEM_ID_KEY],
            source: SOURCES.POINTER
        });
    }

    const {index, isProximityBased} = e.detail.indexObj;
    const shadowElIdx = isProximityBased && index === e.currentTarget.children.length - 1 ? index + 1 : index;
    shadowElDropZone = e.currentTarget;
    items.splice(shadowElIdx, 0, shadowElData);
    dispatchConsiderEvent(e.currentTarget, items, {trigger: TRIGGERS.DRAGGED_ENTERED, id: draggedElData[ITEM_ID_KEY], source: SOURCES.POINTER});
}
function handleDraggedLeft(e) {
    printDebug(() => ["dragged left", e.currentTarget, e.detail]);
    const {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const shadowElIdx = items.findIndex(item => !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
    const shadowItem = items.splice(shadowElIdx, 1)[0];
    shadowElDropZone = undefined;
    if (e.detail.type === DRAGGED_LEFT_TYPES.OUTSIDE_OF_ANY) {
        const originZoneItems = dzToConfig.get(originDropZone).items;
        originZoneItems.splice(originIndex, 0, shadowItem);
        dispatchConsiderEvent(originDropZone, originZoneItems, {
            trigger: TRIGGERS.DRAGGED_LEFT_ALL,
            id: draggedElData[ITEM_ID_KEY],
            source: SOURCES.POINTER
        });
    }
    dispatchConsiderEvent(e.currentTarget, items, {trigger: TRIGGERS.DRAGGED_LEFT, id: draggedElData[ITEM_ID_KEY], source: SOURCES.POINTER});
}
function handleDraggedIsOverIndex(e) {
    printDebug(() => ["dragged is over index", e.currentTarget, e.detail]);
    const {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const {index} = e.detail.indexObj;
    const shadowElIdx = items.findIndex(item => !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
    items.splice(shadowElIdx, 1);
    items.splice(index, 0, shadowElData);
    dispatchConsiderEvent(e.currentTarget, items, {trigger: TRIGGERS.DRAGGED_OVER_INDEX, id: draggedElData[ITEM_ID_KEY], source: SOURCES.POINTER});
}

// Global mouse/touch-events handlers
function handleMouseMove(e) {
    e.preventDefault();
    const c = e.touches ? e.touches[0] : e;
    currentMousePosition = {x: c.clientX, y: c.clientY};
    draggedEl.style.transform = `translate3d(${currentMousePosition.x - dragStartMousePosition.x}px, ${
        currentMousePosition.y - dragStartMousePosition.y
    }px, 0)`;
}

function handleDrop() {
    printDebug(() => "dropped");
    finalizingPreviousDrag = true;
    // cleanup
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("touchmove", handleMouseMove);
    window.removeEventListener("mouseup", handleDrop);
    window.removeEventListener("touchend", handleDrop);
    unWatchDraggedElement();
    moveDraggedElementToWasDroppedState(draggedEl);
    let finalizeFunction;
    if (shadowElDropZone) {
        // it was dropped in a drop-zone
        printDebug(() => ["dropped in dz", shadowElDropZone]);
        let {items, type} = dzToConfig.get(shadowElDropZone);
        styleInactiveDropZones(typeToDropZones.get(type), dz => dzToConfig.get(dz).dropTargetStyle);
        let shadowElIdx = items.findIndex(item => !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
        // the handler might remove the shadow element, ex: dragula like copy on drag
        if (shadowElIdx === -1) shadowElIdx = originIndex;
        items = items.map(item => (item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? draggedElData : item));
        finalizeFunction = function finalizeWithinZone() {
            dispatchFinalizeEvent(shadowElDropZone, items, {
                trigger: TRIGGERS.DROPPED_INTO_ZONE,
                id: draggedElData[ITEM_ID_KEY],
                source: SOURCES.POINTER
            });
            if (shadowElDropZone !== originDropZone) {
                // letting the origin drop zone know the element was permanently taken away
                dispatchFinalizeEvent(originDropZone, dzToConfig.get(originDropZone).items, {
                    trigger: TRIGGERS.DROPPED_INTO_ANOTHER,
                    id: draggedElData[ITEM_ID_KEY],
                    source: SOURCES.POINTER
                });
            }
            unDecorateShadowElement(shadowElDropZone.children[shadowElIdx]);
            cleanupPostDrop();
        };
        animateDraggedToFinalPosition(shadowElIdx, finalizeFunction);
    } else {
        // it needs to return to its place
        printDebug(() => "no dz available");
        let {items, type} = dzToConfig.get(originDropZone);
        styleInactiveDropZones(typeToDropZones.get(type), dz => dzToConfig.get(dz).dropTargetStyle);
        shadowElDropZone = originDropZone;
        // if the shadow item is not already there (the original behaviour of the library) we need to add it
        if (!items[originIndex][SHADOW_ITEM_MARKER_PROPERTY_NAME]) {
            items.splice(originIndex, 0, shadowElData);
            dispatchConsiderEvent(originDropZone, items, {
                trigger: TRIGGERS.DROPPED_OUTSIDE_OF_ANY,
                id: draggedElData[ITEM_ID_KEY],
                source: SOURCES.POINTER
            });
        }
        finalizeFunction = function finalizeBackToOrigin() {
            const finalItems = [...items];
            finalItems.splice(originIndex, 1, draggedElData);
            dispatchFinalizeEvent(originDropZone, finalItems, {
                trigger: TRIGGERS.DROPPED_OUTSIDE_OF_ANY,
                id: draggedElData[ITEM_ID_KEY],
                source: SOURCES.POINTER
            });
            unDecorateShadowElement(shadowElDropZone.children[originIndex]);
            cleanupPostDrop();
        };
        window.setTimeout(() => animateDraggedToFinalPosition(originIndex, finalizeFunction), 0);
    }
}

// helper function for handleDrop
function animateDraggedToFinalPosition(shadowElIdx, callback) {
    const shadowElRect = shadowElDropZone.children[shadowElIdx].getBoundingClientRect();
    const newTransform = {
        x: shadowElRect.left - parseFloat(draggedEl.style.left),
        y: shadowElRect.top - parseFloat(draggedEl.style.top)
    };
    const {dropAnimationDurationMs} = dzToConfig.get(shadowElDropZone);
    const transition = `transform ${dropAnimationDurationMs}ms ease`;
    draggedEl.style.transition = draggedEl.style.transition ? draggedEl.style.transition + "," + transition : transition;
    draggedEl.style.transform = `translate3d(${newTransform.x}px, ${newTransform.y}px, 0)`;
    window.setTimeout(callback, dropAnimationDurationMs);
}

/* cleanup */
function cleanupPostDrop() {
    draggedEl.remove();
    originalDragTarget.remove();
    draggedEl = undefined;
    originalDragTarget = undefined;
    draggedElData = undefined;
    draggedElType = undefined;
    originDropZone = undefined;
    originIndex = undefined;
    shadowElData = undefined;
    shadowElDropZone = undefined;
    dragStartMousePosition = undefined;
    currentMousePosition = undefined;
    isWorkingOnPreviousDrag = false;
    finalizingPreviousDrag = false;
}

export function dndzone(node, options) {
    const config = {
        items: undefined,
        type: undefined,
        flipDurationMs: 0,
        dragDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        transformDraggedElement: () => {}
    };
    printDebug(() => [`dndzone good to go options: ${toString(options)}, config: ${toString(config)}`, {node}]);
    let elToIdx = new Map();

    function addMaybeListeners() {
        window.addEventListener("mousemove", handleMouseMoveMaybeDragStart, {passive: false});
        window.addEventListener("touchmove", handleMouseMoveMaybeDragStart, {passive: false, capture: false});
        window.addEventListener("mouseup", handleFalseAlarm, {passive: false});
        window.addEventListener("touchend", handleFalseAlarm, {passive: false});
    }
    function removeMaybeListeners() {
        window.removeEventListener("mousemove", handleMouseMoveMaybeDragStart);
        window.removeEventListener("touchmove", handleMouseMoveMaybeDragStart);
        window.removeEventListener("mouseup", handleFalseAlarm);
        window.removeEventListener("touchend", handleFalseAlarm);
    }
    function handleFalseAlarm() {
        removeMaybeListeners();
        originalDragTarget = undefined;
        dragStartMousePosition = undefined;
        currentMousePosition = undefined;
    }

    function handleMouseMoveMaybeDragStart(e) {
        e.preventDefault();
        const c = e.touches ? e.touches[0] : e;
        currentMousePosition = {x: c.clientX, y: c.clientY};
        if (
            Math.abs(currentMousePosition.x - dragStartMousePosition.x) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX ||
            Math.abs(currentMousePosition.y - dragStartMousePosition.y) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX
        ) {
            removeMaybeListeners();
            handleDragStart();
        }
    }
    function handleMouseDown(e) {
        // prevents responding to any button but left click which equals 0 (which is falsy)
        if (e.button) {
            printDebug(() => `ignoring none left click button: ${e.button}`);
            return;
        }
        if (isWorkingOnPreviousDrag) {
            printDebug(() => "cannot start a new drag before finalizing previous one");
            return;
        }
        e.stopPropagation();
        const c = e.touches ? e.touches[0] : e;
        dragStartMousePosition = {x: c.clientX, y: c.clientY};
        currentMousePosition = {...dragStartMousePosition};
        originalDragTarget = e.currentTarget;
        addMaybeListeners();
    }

    function handleDragStart() {
        printDebug(() => [`drag start config: ${toString(config)}`, originalDragTarget]);
        isWorkingOnPreviousDrag = true;

        // initialising globals
        const currentIdx = elToIdx.get(originalDragTarget);
        originIndex = currentIdx;
        originDropZone = originalDragTarget.parentElement;
        const {items, type} = config;
        draggedElData = {...items[currentIdx]};
        draggedElType = type;
        shadowElData = {...draggedElData, [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true};

        // creating the draggable element
        draggedEl = createDraggedElementFrom(originalDragTarget);
        // We will keep the original dom node in the dom because touch events keep firing on it, we want to re-add it after the framework removes it
        function keepOriginalElementInDom() {
            const {items: itemsNow} = config;
            if (!draggedEl.parentElement && (!itemsNow[originIndex] || draggedElData[ITEM_ID_KEY] !== itemsNow[originIndex][ITEM_ID_KEY])) {
                document.body.appendChild(draggedEl);
                // to prevent the outline from disappearing
                draggedEl.focus();
                watchDraggedElement();
                hideOriginalDragTarget(originalDragTarget);
                document.body.appendChild(originalDragTarget);
            } else {
                window.requestAnimationFrame(keepOriginalElementInDom);
            }
        }
        window.requestAnimationFrame(keepOriginalElementInDom);

        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type)).filter(dz => dz === originDropZone || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle
        );

        // removing the original element by removing its data entry
        items.splice(currentIdx, 1);
        dispatchConsiderEvent(originDropZone, items, {trigger: TRIGGERS.DRAG_STARTED, id: draggedElData[ITEM_ID_KEY], source: SOURCES.POINTER});

        // handing over to global handlers - starting to watch the element
        window.addEventListener("mousemove", handleMouseMove, {passive: false});
        window.addEventListener("touchmove", handleMouseMove, {passive: false, capture: false});
        window.addEventListener("mouseup", handleDrop, {passive: false});
        window.addEventListener("touchend", handleDrop, {passive: false});
    }

    function configure({
        items = undefined,
        flipDurationMs: dropAnimationDurationMs = 0,
        type: newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        transformDraggedElement = () => {}
    }) {
        config.dropAnimationDurationMs = dropAnimationDurationMs;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);

        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.transformDraggedElement = transformDraggedElement;

        // realtime update for dropTargetStyle
        if (isWorkingOnPreviousDrag && !finalizingPreviousDrag && !areObjectsShallowEqual(dropTargetStyle, config.dropTargetStyle)) {
            styleInactiveDropZones([node], () => config.dropTargetStyle);
            styleActiveDropZones([node], () => dropTargetStyle);
        }
        config.dropTargetStyle = dropTargetStyle;

        // realtime update for dropFromOthersDisabled
        if (isWorkingOnPreviousDrag && config.dropFromOthersDisabled !== dropFromOthersDisabled) {
            if (dropFromOthersDisabled) {
                styleInactiveDropZones([node], dz => dzToConfig.get(dz).dropTargetStyle);
            } else {
                styleActiveDropZones([node], dz => dzToConfig.get(dz).dropTargetStyle);
            }
        }
        config.dropFromOthersDisabled = dropFromOthersDisabled;

        dzToConfig.set(node, config);
        for (let idx = 0; idx < node.children.length; idx++) {
            const draggableEl = node.children[idx];
            styleDraggable(draggableEl, dragDisabled);
            if (config.items[idx][SHADOW_ITEM_MARKER_PROPERTY_NAME]) {
                morphDraggedElementToBeLike(draggedEl, draggableEl, currentMousePosition.x, currentMousePosition.y, () =>
                    config.transformDraggedElement(draggedEl, draggedElData, idx)
                );
                decorateShadowEl(draggableEl);
                continue;
            }
            draggableEl.removeEventListener("mousedown", elToMouseDownListener.get(draggableEl));
            draggableEl.removeEventListener("touchstart", elToMouseDownListener.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener("mousedown", handleMouseDown);
                draggableEl.addEventListener("touchstart", handleMouseDown);
                elToMouseDownListener.set(draggableEl, handleMouseDown);
            }
            // updating the idx
            elToIdx.set(draggableEl, idx);
        }
    }
    configure(options);

    return {
        update: newOptions => {
            printDebug(() => `pointer dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            printDebug(() => "pointer dndzone will destroy");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
        }
    };
}
