import { observe, unobserve } from './helpers/observer';
import { armWindowScroller, disarmWindowScroller} from "./helpers/windowScroller";
import {
    createDraggedElementFrom,
    moveDraggedElementToWasDroppedState,
    morphDraggedElementToBeLike,
    styleDraggable,
    styleShadowEl,
    styleActiveDropZones,
    styleInActiveDropZones,
    hideOriginalDragTarget
} from "./helpers/styler";
import { DRAGGED_ENTERED_EVENT_NAME, DRAGGED_LEFT_EVENT_NAME, DRAGGED_LEFT_DOCUMENT_EVENT_NAME, DRAGGED_OVER_INDEX_EVENT_NAME, dispatchConsiderEvent, dispatchFinalizeEvent } from './helpers/dispatcher';
import { toString } from "./helpers/util";

const ITEM_ID_KEY = "id";
const DEFAULT_DROP_ZONE_TYPE = '--any--';
const MIN_OBSERVATION_INTERVAL_MS = 100;
const MIN_MOVEMENT_BEFORE_DRAG_START_PX = 3;
const DEFAULT_DROP_TARGET_STYLE = {
    outline: 'rgba(255, 255, 102, 0.7) solid 2px',
};

let originalDragTarget;
let draggedEl;
let draggedElData;
let draggedElType;
let originDropZone;
let originIndex;
let shadowElIdx;
let shadowElData;
let shadowElDropZone;
let dragStartMousePosition;
let currentMousePosition;
let isWorkingOnPreviousDrag = false;

// a map from type to a set of drop-zones
const typeToDropZones = new Map();
// important - this is needed because otherwise the config that would be used for everyone is the config of the element that created the event listeners
const dzToConfig = new Map();
// this is needed in order to be able to cleanup old listeners and avoid stale closures issues (as the listener is defined within each zone)
const elToMouseDownListener = new WeakMap();

/* drop-zones registration management */
function registerDropZone(dropZoneEl, type) {
    console.debug('registering drop-zone if absent')
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    if (!typeToDropZones.get(type).has(dropZoneEl)) {
        typeToDropZones.get(type).add(dropZoneEl); 
    }
}
function unregisterDropZone(dropZoneEl, type) {
    typeToDropZones.get(type).delete(dropZoneEl);
    if (typeToDropZones.get(type).size === 0) {
        typeToDropZones.delete(type);
    }
}

/* functions to manage observing the dragged element and trigger custom drag-events */
function watchDraggedElement() {
    console.debug('watching dragged element');
    armWindowScroller();
    const dropZones = typeToDropZones.get(draggedElType);
    for (const dz of dropZones) {
        dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.addEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    // it is important that we don't have an interval that is faster than the flip duration because it can cause elements to jump bach and forth
    const observationIntervalMs = Math.max(MIN_OBSERVATION_INTERVAL_MS, ...Array.from(dropZones.keys()).map(dz => dzToConfig.get(dz).dropAnimationDurationMs));
    observe(draggedEl, dropZones, observationIntervalMs * 1.07);
}
function unWatchDraggedElement() {
    console.debug('unwatching dragged element');
    disarmWindowScroller();
    const dropZones = typeToDropZones.get(draggedElType);
    for (const dz of dropZones) {
        dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
        dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
        dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
    }
    window.removeEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
    unobserve(draggedEl, dropZones);
}

/* custom drag-events handlers */
function handleDraggedEntered(e) {
    console.debug('dragged entered', e.currentTarget, e.detail);
    let {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        console.debug('drop is currently disabled');
        return;
    }
    // this deals with another svelte related race condition. in rare occasions (super rapid operations) the list hasn't updated yet
    items = items.filter(i => i.id !== shadowElData.id)
    console.debug(`dragged entered items ${toString(items)}`);
    const {index, isProximityBased} = e.detail.indexObj;
    shadowElIdx = (isProximityBased && index === e.currentTarget.children.length - 1)? index + 1 : index;
    shadowElDropZone = e.currentTarget;
    items.splice( shadowElIdx, 0, shadowElData);
    dispatchConsiderEvent(e.currentTarget, items);
}
function handleDraggedLeft(e) {
    console.debug('dragged left', e.currentTarget, e.detail);
    const {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        console.debug('drop is currently disabled');
        return;
    }
    items.splice(shadowElIdx, 1);
    shadowElIdx = undefined;
    shadowElDropZone = undefined;
    dispatchConsiderEvent(e.currentTarget, items);
}
function handleDraggedIsOverIndex(e) {
    console.debug('dragged is over index', e.currentTarget, e.detail);
    const {items, dropFromOthersDisabled} = dzToConfig.get(e.currentTarget);
    if (dropFromOthersDisabled && e.currentTarget !== originDropZone) {
        console.debug('drop is currently disabled');
        return;
    }
    const {index} = e.detail.indexObj;
    items.splice(shadowElIdx, 1);
    items.splice( index, 0, shadowElData);
    shadowElIdx = index;
    dispatchConsiderEvent(e.currentTarget, items);
}

/* global mouse/touch-events handlers */
function handleMouseMove(e) {
    e.preventDefault();
    const c = e.touches? e.touches[0] : e;
    currentMousePosition = {x: c.clientX, y: c.clientY};
    draggedEl.style.transform = `translate3d(${currentMousePosition.x - dragStartMousePosition.x}px, ${currentMousePosition.y - dragStartMousePosition.y}px, 0)`;
}

function handleDrop() {
    console.debug('dropped');
    // cleanup
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('touchmove', handleMouseMove);
    window.removeEventListener('mouseup', handleDrop);
    window.removeEventListener('touchend', handleDrop);
    unWatchDraggedElement();
    moveDraggedElementToWasDroppedState(draggedEl);
    if (!!shadowElDropZone) { // it was dropped in a drop-zone
        console.debug('dropped in dz', shadowElDropZone);
        let {items, type} = dzToConfig.get(shadowElDropZone);
        styleInActiveDropZones(typeToDropZones.get(type), dz => dzToConfig.get(dz).dropTargetStyle);
        items = items.map(item => item.hasOwnProperty('isDndShadowItem')? draggedElData : item);
        function finalizeWithinZone() {
            dispatchFinalizeEvent(shadowElDropZone, items);
            if (shadowElDropZone !== originDropZone) {
                // letting the origin drop zone know the element was permanently taken away
                dispatchFinalizeEvent(originDropZone, dzToConfig.get(originDropZone).items);
            }
            shadowElDropZone.children[shadowElIdx].style.visibility = '';
            cleanupPostDrop();
        }
        animateDraggedToFinalPosition(finalizeWithinZone);
    }
    else { // it needs to return to its place
        console.debug('no dz available');
        let {items, type} = dzToConfig.get(originDropZone);
        styleInActiveDropZones(typeToDropZones.get(type), dz => dzToConfig.get(dz).dropTargetStyle);
        items.splice(originIndex, 0, shadowElData);
        shadowElDropZone = originDropZone;
        shadowElIdx = originIndex;
        dispatchConsiderEvent(originDropZone, items);
        function finalizeBackToOrigin() {
            items.splice(originIndex, 1, draggedElData);
            dispatchFinalizeEvent(originDropZone, items);
            shadowElDropZone.children[shadowElIdx].style.visibility = '';
            cleanupPostDrop();
        }
        window.setTimeout(() => animateDraggedToFinalPosition(finalizeBackToOrigin), 0);
    }
}

// helper function for handleDrop
function animateDraggedToFinalPosition(callback) {
    const shadowElRect = shadowElDropZone.children[shadowElIdx].getBoundingClientRect();
    const newTransform = {
        x: shadowElRect.left - parseFloat(draggedEl.style.left),
        y: shadowElRect.top - parseFloat(draggedEl.style.top)
    };
    const {dropAnimationDurationMs} = dzToConfig.get(shadowElDropZone);
    const transition = `transform ${dropAnimationDurationMs}ms ease`
    draggedEl.style.transition = draggedEl.style.transition? draggedEl.style.transition + "," + transition : transition;
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
    shadowElIdx = undefined;
    shadowElDropZone = undefined;
    dragStartMousePosition = undefined;
    currentMousePosition = undefined;
    isWorkingOnPreviousDrag = false;
}

/**
 * A Svelte custom action to turn any container to a dnd zone and all of its direct children to draggables
 * dispatches two events that the container is expected to react to by modifying its list of items,
 * which will then feed back in to this action via the update function
 *
 * @typedef {Object} Options
 * @property {Array} items - the list of items that was used to generate the children of the given node (the list used in the #each block
 * @property {string} [type] - the type of the dnd zone. children dragged from here can only be dropped in other zones of the same type, default to a base type
 * @property {number} [flipDurationMs] - if the list animated using flip (recommended), specifies the flip duration such that everything syncs with it without conflict, defaults to zero
 * @param {HTMLElement} node - the element to enhance
 * @param {Options} options
 * @return {{update: function, destroy: function}}
 */
export function dndzone(node, options) {
    const config =  {
        items: [],
        type: undefined,
        flipDurationMs: 0,
        dragDisabled: false,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
    };
    console.debug(`dndzone good to go options: ${toString(options)}, config: ${toString(config)}`, {node});
    let elToIdx = new Map();

    function addMaybeListeners() {
        window.addEventListener('mousemove', handleMouseMoveMaybeDragStart, {passive: false});
        window.addEventListener('touchmove', handleMouseMoveMaybeDragStart, {passive: false, capture: false});
        window.addEventListener('mouseup', handleFalseAlarm, {passive: false});
        window.addEventListener('touchend', handleFalseAlarm, {passive: false});
    }
    function removeMaybeListeners() {
        window.removeEventListener('mousemove', handleMouseMoveMaybeDragStart);
        window.removeEventListener('touchmove', handleMouseMoveMaybeDragStart);
        window.removeEventListener('mouseup', handleFalseAlarm);
        window.removeEventListener('touchend', handleFalseAlarm);
    }
    function handleFalseAlarm() {
        removeMaybeListeners();
        originalDragTarget = undefined;
        dragStartMousePosition = undefined;
        currentMousePosition = undefined;
    }

    function handleMouseMoveMaybeDragStart(e) {
        e.preventDefault();
        const c = e.touches? e.touches[0] : e;
        currentMousePosition = {x: c.clientX, y: c.clientY};
        if (Math.abs(currentMousePosition.x - dragStartMousePosition.x) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX || Math.abs(currentMousePosition.y - dragStartMousePosition.y) >= MIN_MOVEMENT_BEFORE_DRAG_START_PX) {
            removeMaybeListeners();
            handleDragStart(originalDragTarget);
        }
    }
    function handleMouseDown(e) {
        if (isWorkingOnPreviousDrag) {
            console.debug('cannot start a new drag before finalizing previous one');
            return;
        }
        e.stopPropagation();
        const c = e.touches? e.touches[0] : e;
        dragStartMousePosition = {x: c.clientX, y:c.clientY};
        currentMousePosition = {...dragStartMousePosition};
        originalDragTarget = e.currentTarget;
        addMaybeListeners();
    }

    function handleDragStart() {
        console.debug(`drag start config: ${toString(config)}`, originalDragTarget);
        isWorkingOnPreviousDrag = true;

        // initialising globals
        const currentIdx = elToIdx.get(originalDragTarget);
        originIndex = currentIdx;
        originDropZone = originalDragTarget.parentElement;
        const {items, type} = config;
        draggedElData = {...items[currentIdx]};
        draggedElType = type;
        shadowElData = {...draggedElData, isDndShadowItem: true};

        // creating the draggable element
        draggedEl = createDraggedElementFrom(originalDragTarget);
        // We will keep the original dom node in the dom because touch events keep firing on it, we want to re-add it after Svelte removes it
        function keepOriginalElementInDom() {
            const {items: itemsNow} = config;
            if (!draggedEl.parentElement && (!itemsNow[originIndex] || draggedElData[ITEM_ID_KEY] !== itemsNow[originIndex][ITEM_ID_KEY])) {
                document.body.appendChild(draggedEl);
                watchDraggedElement();
                hideOriginalDragTarget(originalDragTarget);
                document.body.appendChild(originalDragTarget);
            } else {
                window.requestAnimationFrame(keepOriginalElementInDom);
            }
        }
        window.requestAnimationFrame(keepOriginalElementInDom);

        styleActiveDropZones(
            Array.from(typeToDropZones.get(config.type))
            .filter(dz => dz === originDropZone || !dzToConfig.get(dz).dropFromOthersDisabled),
            dz => dzToConfig.get(dz).dropTargetStyle,
        );

        // removing the original element by removing its data entry
        items.splice(currentIdx, 1);
        dispatchConsiderEvent(originDropZone, items);

        // handing over to global handlers - starting to watch the element
        window.addEventListener('mousemove', handleMouseMove, {passive: false});
        window.addEventListener('touchmove', handleMouseMove, {passive: false, capture: false});
        window.addEventListener('mouseup', handleDrop, {passive: false});
        window.addEventListener('touchend', handleDrop, {passive: false});
    }

    function configure({
        items = [],
        flipDurationMs:dropAnimationDurationMs = 0,
        type:newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        transformDraggedElement,
         ...rest
     }) {
        if (Object.keys(rest).length > 0) {
            console.warn(`dndzone will ignore unknown options`, rest);
        }
        config.dropAnimationDurationMs = dropAnimationDurationMs;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);

        config.items = [...items];

        config.dragDisabled = dragDisabled;

        config.dropTargetStyle = dropTargetStyle;

        config.transformDraggedElement = transformDraggedElement;

        if (isWorkingOnPreviousDrag && config.dropFromOthersDisabled !== dropFromOthersDisabled) {
            if (dropFromOthersDisabled) {
                styleInActiveDropZones([node], dz => dzToConfig.get(dz).dropTargetStyle);
            } else {
                styleActiveDropZones([node], dz => dzToConfig.get(dz).dropTargetStyle);
            }
        }
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        dzToConfig.set(node, config);
        for (let idx = 0; idx < node.children.length; idx++) {
            const draggableEl = node.children[idx];
            styleDraggable(draggableEl, dragDisabled);
            if (config.items[idx].hasOwnProperty('isDndShadowItem')) {
                morphDraggedElementToBeLike(draggedEl, draggableEl, currentMousePosition.x, currentMousePosition.y, config.transformDraggedElement);
                styleShadowEl(draggableEl);
                continue;
            }
            draggableEl.removeEventListener('mousedown', elToMouseDownListener.get(draggableEl));
            draggableEl.removeEventListener('touchstart', elToMouseDownListener.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener('mousedown', handleMouseDown);
                draggableEl.addEventListener('touchstart', handleMouseDown);
                elToMouseDownListener.set(draggableEl, handleMouseDown);
            }
            // updating the idx
            elToIdx.set(draggableEl, idx);
        }
    }
    configure(options);

    return ({
        update: (newOptions) => {
            console.debug(`dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            console.debug("dndzone will destroy");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
        }
    });
}