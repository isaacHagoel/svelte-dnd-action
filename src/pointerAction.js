import {
    decrementActiveDropZoneCount,
    incrementActiveDropZoneCount,
    ITEM_ID_KEY,
    printDebug,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    SOURCES,
    TRIGGERS
} from "./constants";
import {observe, unobserve} from "./helpers/observer";
import {createMultiScroller} from "./helpers/multiScroller";
import {
    createDraggedElementFrom,
    decorateShadowEl,
    hideElement,
    morphDraggedElementToBeLike,
    moveDraggedElementToWasDroppedState,
    preventShrinking,
    styleActiveDropZones,
    styleDraggable,
    styleInactiveDropZones,
    unDecorateShadowElement
} from "./helpers/styler";
import {
    dispatchConsiderEvent,
    dispatchFinalizeEvent,
    DRAGGED_ENTERED_EVENT_NAME,
    DRAGGED_LEFT_DOCUMENT_EVENT_NAME,
    DRAGGED_LEFT_EVENT_NAME,
    DRAGGED_LEFT_TYPES,
    DRAGGED_OVER_INDEX_EVENT_NAME
} from "./helpers/dispatcher";
import {areArraysShallowEqualSameOrder, areObjectsShallowEqual, toString} from "./helpers/util";
import {getBoundingRectNoTransforms} from "./helpers/intersection";

const DEFAULT_DROP_ZONE_TYPE = "--any--";
const MIN_OBSERVATION_INTERVAL_MS = 100;
const DISABLED_OBSERVATION_INTERVAL_MS = 20;
const MIN_MOVEMENT_BEFORE_DRAG_START_PX = 3;
const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px"
};
const ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE = "data-is-dnd-original-dragged-item";

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
let unlockOriginDzMinDimensions;
let isDraggedOutsideOfAnyDz = false;
let scheduledForRemovalAfterDrop = [];
let multiScroller;

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
    const dropZones = typeToDropZones.get(draggedElType);

    for (const dz of dropZones) {
        dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.addEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);

    // it is important that we don't have an interval that is faster than the flip duration because it can cause elements to jump bach and forth
    const setIntervalMs = Math.max(...Array.from(dropZones.keys()).map(dz => dzToConfig.get(dz).dropAnimationDurationMs));
    const observationIntervalMs = setIntervalMs === 0 ? DISABLED_OBSERVATION_INTERVAL_MS : Math.max(setIntervalMs, MIN_OBSERVATION_INTERVAL_MS); // if setIntervalMs is 0 it goes to 20, otherwise it is max between it and min observation.
    multiScroller = createMultiScroller(dropZones, () => currentMousePosition);
    observe(draggedEl, dropZones, observationIntervalMs * 1.07, multiScroller);
}
function unWatchDraggedElement() {
    printDebug(() => "unwatching dragged element");
    const dropZones = typeToDropZones.get(draggedElType);
    for (const dz of dropZones) {
        dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.removeEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    multiScroller.destroy();
    multiScroller = undefined;
    unobserve();
}

function findShadowElementIdx(items) {
    return items.findIndex(item => !!item[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
}
function createShadowElData(draggedElData) {
    return {...draggedElData, [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true, [ITEM_ID_KEY]: SHADOW_PLACEHOLDER_ITEM_ID};
}

/* custom drag-events handlers */
function handleDraggedEntered(e) {
    printDebug(() => ["dragged entered", e.currentTarget, e.detail]);
    let {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "ignoring dragged entered because drop is currently disabled");
        return;
    }
    isDraggedOutsideOfAnyDz = false;
    // this deals with another race condition. in rare occasions (super rapid operations) the list hasn't updated yet
    items = items.filter(item => item[ITEM_ID_KEY] !== shadowElData[ITEM_ID_KEY]);
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
    // dealing with a rare race condition on extremely rapid clicking and dropping
    if (!isWorkingOnPreviousDrag) return;
    printDebug(() => ["dragged left", e.currentTarget, e.detail]);
    const {items: originalItems, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone && e.currentTarget !== shadowElDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const items = [...originalItems];
    const shadowElIdx = findShadowElementIdx(items);
    if (shadowElIdx !== -1) {
        items.splice(shadowElIdx, 1);
    }
    const origShadowDz = shadowElDropZone;
    shadowElDropZone = undefined;
    const {type, theOtherDz} = e.detail;
    if (
        type === DRAGGED_LEFT_TYPES.OUTSIDE_OF_ANY ||
        (type === DRAGGED_LEFT_TYPES.LEFT_FOR_ANOTHER && theOtherDz !== originDropZone && dzToConfig.get(theOtherDz).dropFromOthersDisabled)
    ) {
        printDebug(() => "dragged left all, putting shadow element back in the origin dz");
        isDraggedOutsideOfAnyDz = true;
        shadowElDropZone = originDropZone;
        // if the last zone it left is the origin dz, we will put it back into items (which we just removed it from)
        const originZoneItems = origShadowDz === originDropZone ? items : [...dzToConfig.get(originDropZone).items];
        originZoneItems.splice(originIndex, 0, shadowElData);
        dispatchConsiderEvent(originDropZone, originZoneItems, {
            trigger: TRIGGERS.DRAGGED_LEFT_ALL,
            id: draggedElData[ITEM_ID_KEY],
            source: SOURCES.POINTER
        });
    }
    // for the origin dz, when the dragged is outside of any, this will be fired in addition to the previous. this is for simplicity
    dispatchConsiderEvent(e.currentTarget, items, {
        trigger: TRIGGERS.DRAGGED_LEFT,
        id: draggedElData[ITEM_ID_KEY],
        source: SOURCES.POINTER
    });
}
function handleDraggedIsOverIndex(e) {
    printDebug(() => ["dragged is over index", e.currentTarget, e.detail]);
    const {items: originalItems, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        printDebug(() => "drop is currently disabled");
        return;
    }
    const items = [...originalItems];
    isDraggedOutsideOfAnyDz = false;
    const {index} = e.detail.indexObj;
    const shadowElIdx = findShadowElementIdx(items);
    if (shadowElIdx !== -1) {
        items.splice(shadowElIdx, 1);
    }
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

    if (!shadowElDropZone) {
        printDebug(() => "element was dropped right after it left origin but before entering somewhere else");
        shadowElDropZone = originDropZone;
    }
    printDebug(() => ["dropped in dz", shadowElDropZone]);
    let {items, type} = dzToConfig.get(shadowElDropZone);
    styleInactiveDropZones(
        typeToDropZones.get(type),
        dz => dzToConfig.get(dz).dropTargetStyle,
        dz => dzToConfig.get(dz).dropTargetClasses
    );
    let shadowElIdx = findShadowElementIdx(items);
    // the handler might remove the shadow element, ex: dragula like copy on drag
    if (shadowElIdx === -1) {
        if (shadowElDropZone === originDropZone) {
            shadowElIdx = originIndex;
        }
    }

    items = items.map(item => (item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? draggedElData : item));
    function finalizeWithinZone() {
        unlockOriginDzMinDimensions();
        dispatchFinalizeEvent(shadowElDropZone, items, {
            trigger: isDraggedOutsideOfAnyDz ? TRIGGERS.DROPPED_OUTSIDE_OF_ANY : TRIGGERS.DROPPED_INTO_ZONE,
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
        if (shadowElIdx !== -1) unDecorateShadowElement(shadowElDropZone.children[shadowElIdx]);
        cleanupPostDrop();
    }
    animateDraggedToFinalPosition(shadowElIdx, finalizeWithinZone);
}

// helper function for handleDrop
function animateDraggedToFinalPosition(shadowElIdx, callback) {
    const shadowElRect =
        shadowElIdx > -1 ? getBoundingRectNoTransforms(shadowElDropZone.children[shadowElIdx]) : getBoundingRectNoTransforms(shadowElDropZone);
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

function scheduleDZForRemovalAfterDrop(dz, destroy) {
    scheduledForRemovalAfterDrop.push({dz, destroy});
    window.requestAnimationFrame(() => {
        hideElement(dz);
        document.body.appendChild(dz);
    });
}
/* cleanup */
function cleanupPostDrop() {
    draggedEl.remove();
    originalDragTarget.remove();
    if (scheduledForRemovalAfterDrop.length) {
        printDebug(() => ["will destroy zones that were removed during drag", scheduledForRemovalAfterDrop]);
        scheduledForRemovalAfterDrop.forEach(({dz, destroy}) => {
            destroy();
            dz.remove();
        });
        scheduledForRemovalAfterDrop = [];
    }
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
    unlockOriginDzMinDimensions = undefined;
    isDraggedOutsideOfAnyDz = false;
}

export function dndzone(node, options) {
    let initialized = false;
    const config = {
        items: undefined,
        type: undefined,
        flipDurationMs: 0,
        dragDisabled: false,
        morphDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses: [],
        transformDraggedElement: () => {},
        centreDraggedOnCursor: false
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
    function handleFalseAlarm(e) {
        removeMaybeListeners();
        originalDragTarget = undefined;
        dragStartMousePosition = undefined;
        currentMousePosition = undefined;

        // dragging initiated by touch events prevents onclick from initially firing
        if (e.type === "touchend") {
            e.target.click();
        }
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
        // on safari clicking on a select element doesn't fire mouseup at the end of the click and in general this makes more sense
        if (e.target !== e.currentTarget && (e.target.value !== undefined || e.target.isContentEditable)) {
            printDebug(() => "won't initiate drag on a nested input element");
            return;
        }
        // prevents responding to any button but left click which equals 0 (which is falsy)
        if (e.button) {
            printDebug(() => `ignoring none left click button: ${e.button}`);
            return;
        }
        if (isWorkingOnPreviousDrag) {
            printDebug(() => "cannot start a new drag before finalizing previous one");
            return;
        }
        e.preventDefault();
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
        /** @type {ShadowRoot | HTMLDocument | Element } */
        const rootNode = originDropZone.closest("dialog") || originDropZone.getRootNode();
        const originDropZoneRoot = rootNode.body || rootNode;
        const {items: originalItems, type, centreDraggedOnCursor} = config;
        const items = [...originalItems];
        draggedElData = items[currentIdx];
        draggedElType = type;
        shadowElData = createShadowElData(draggedElData);

        // creating the draggable element
        draggedEl = createDraggedElementFrom(originalDragTarget, centreDraggedOnCursor && currentMousePosition);
        originalDragTarget.setAttribute(ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE, true);

        // We will keep the original dom node in the dom because touch events keep firing on it, we want to re-add it after the framework removes it
        function keepOriginalElementInDom() {
            if (!draggedEl.parentElement) {
                originDropZoneRoot.appendChild(draggedEl);
                // to prevent the outline from disappearing
                draggedEl.focus();
                watchDraggedElement();
                hideElement(originalDragTarget);
                originDropZoneRoot.appendChild(originalDragTarget);
                // after the removal of the original element we can give the shadow element the original item id so that the host zone can find it and render it correctly if it does lookups by id
                shadowElData[ITEM_ID_KEY] = draggedElData[ITEM_ID_KEY];
            } else {
                window.requestAnimationFrame(keepOriginalElementInDom);
            }
        }
        window.requestAnimationFrame(keepOriginalElementInDom);

        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type)).filter(dz => dz === originDropZone || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle,
            dz => dzToConfig.get(dz).dropTargetClasses
        );

        // removing the original element by removing its data entry
        items.splice(currentIdx, 1, shadowElData);
        unlockOriginDzMinDimensions = preventShrinking(originDropZone);

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
        morphDisabled = false,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses = [],
        transformDraggedElement = () => {},
        centreDraggedOnCursor = false
    }) {
        config.dropAnimationDurationMs = dropAnimationDurationMs;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.morphDisabled = morphDisabled;
        config.transformDraggedElement = transformDraggedElement;
        config.centreDraggedOnCursor = centreDraggedOnCursor;

        // realtime update for dropTargetStyle
        if (
            initialized &&
            isWorkingOnPreviousDrag &&
            !finalizingPreviousDrag &&
            (!areObjectsShallowEqual(dropTargetStyle, config.dropTargetStyle) ||
                !areArraysShallowEqualSameOrder(dropTargetClasses, config.dropTargetClasses))
        ) {
            styleInactiveDropZones(
                [node],
                () => config.dropTargetStyle,
                () => dropTargetClasses
            );
            styleActiveDropZones(
                [node],
                () => dropTargetStyle,
                () => dropTargetClasses
            );
        }
        config.dropTargetStyle = dropTargetStyle;
        config.dropTargetClasses = [...dropTargetClasses];

        // realtime update for dropFromOthersDisabled
        function getConfigProp(dz, propName) {
            return dzToConfig.get(dz) ? dzToConfig.get(dz)[propName] : config[propName];
        }
        if (initialized && isWorkingOnPreviousDrag && config.dropFromOthersDisabled !== dropFromOthersDisabled) {
            if (dropFromOthersDisabled) {
                styleInactiveDropZones(
                    [node],
                    dz => getConfigProp(dz, "dropTargetStyle"),
                    dz => getConfigProp(dz, "dropTargetClasses")
                );
            } else {
                styleActiveDropZones(
                    [node],
                    dz => getConfigProp(dz, "dropTargetStyle"),
                    dz => getConfigProp(dz, "dropTargetClasses")
                );
            }
        }
        config.dropFromOthersDisabled = dropFromOthersDisabled;

        dzToConfig.set(node, config);
        registerDropZone(node, newType);
        const shadowElIdx = isWorkingOnPreviousDrag ? findShadowElementIdx(config.items) : -1;
        for (let idx = 0; idx < node.children.length; idx++) {
            const draggableEl = node.children[idx];
            styleDraggable(draggableEl, dragDisabled);
            if (idx === shadowElIdx) {
                if (!morphDisabled) {
                    morphDraggedElementToBeLike(draggedEl, draggableEl, currentMousePosition.x, currentMousePosition.y);
                }
                config.transformDraggedElement(draggedEl, draggedElData, idx);
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

            if (!initialized) {
                initialized = true;
            }
        }
    }
    configure(options);

    return {
        update: newOptions => {
            printDebug(() => `pointer dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            function destroyDz() {
                printDebug(() => "pointer dndzone will destroy");
                unregisterDropZone(node, dzToConfig.get(node).type);
                dzToConfig.delete(node);
            }
            if (isWorkingOnPreviousDrag && !node.closest(`[${ORIGINAL_DRAGGED_ITEM_MARKER_ATTRIBUTE}]`)) {
                printDebug(() => "pointer dndzone will be scheduled for destruction");
                scheduleDZForRemovalAfterDrop(node, destroyDz);
            } else {
                destroyDz();
            }
        }
    };
}
