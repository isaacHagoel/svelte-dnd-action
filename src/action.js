import { observe, unobserve } from './helpers/observer';
import { DRAGGED_ENTERED_EVENT_NAME, DRAGGED_LEFT_EVENT_NAME, DRAGGED_LEFT_DOCUMENT_EVENT_NAME, DRAGGED_OVER_INDEX_EVENT_NAME, dispatchConsiderEvent, dispatchFinalizeEvent } from './helpers/dispatcher';
const DEFAULT_DROP_ZONE_TYPE = '--any--';
const MIN_OBSERVATION_INTERVAL_MS = 100;

let draggedEl;
let draggedElData;
let originDropZone;
let originIndex;
let shadowElIdx;
let shadowElData;
let shadowElDropZone;
let dragStartMousePosition;
let isFinalizingPreviousOperation = false;

// a map from type to a set of dropzones
let typeToDropZones = new Map();
// important - this is needed because otherwise the config that would be used for everyone is the config of the element that created the event listeners
let dzToConfig = new Map();

function registerDropZone(dropZoneEl, type) {
    console.log('registering dropzone if absent')
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

function handleDraggedEntered(e) {
    console.log('dragged entered', e.currentTarget, e.detail);
    const {items} = dzToConfig.get(e.currentTarget);
    console.warn("dragged entered items", items);
    const {index, isProximityBased} = e.detail.indexObj;
    shadowElIdx = isProximityBased && index === e.currentTarget.childNodes.length - 1? index + 1 : index;
    shadowElDropZone = e.currentTarget;
    items.splice( shadowElIdx, 0, shadowElData);
    dispatchConsiderEvent(e.currentTarget, items);
}
function handleDraggedLeft(e) {
    console.log('dragged left', e.currentTarget, e.detail);
    const {items} = dzToConfig.get(e.currentTarget);
    // TODO - do we want it to leave or jump to its original position instead?
    items.splice(shadowElIdx, 1);
    shadowElIdx = undefined;
    shadowElDropZone = undefined;
    dispatchConsiderEvent(e.currentTarget, items);
}
function handleDraggedIsOverIndex(e) {
    console.log('dragged is over index', e.currentTarget, e.detail);
    const {items} = dzToConfig.get(e.currentTarget);
    const {index} = e.detail.indexObj;
    items.splice(shadowElIdx, 1);
    items.splice( index, 0, shadowElData);
    shadowElIdx = index;
    dispatchConsiderEvent(e.currentTarget, items);///
}

export function dndzone(node, options) {
    const config =  {items: [], type: undefined};
    console.log("dndzone good to go", {node, options, config});
    let elToIdx = new Map();

    function handleMouseMove(e) {
        e.stopPropagation();
        if (!draggedEl) {
            return;
        }
        // TODO - add another visual queue like a border or increased scale and shadow
        draggedEl.style.transform = `translate3d(${e.clientX - dragStartMousePosition.x}px, ${e.clientY-dragStartMousePosition.y}px, 0)`;
    }
    function handleDrop(e) {
        console.log('dropped', e.currentTarget);
        e.stopPropagation();
        isFinalizingPreviousOperation = true;
        // cleanup
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleDrop);
        //document.body.removeEventListener('mouseleave', handleDrop);
        unWatchDraggedElement();
        // it might not be dropped over anything we care about - in that case it needs to return to its original place (animate)
        // raise the finalize event
        
        // it was dropped in a drop-zone
        if (!!shadowElDropZone) {
            console.log('dropped in dz', shadowElDropZone);
            let {items} = dzToConfig.get(shadowElDropZone);
            items = items.map(item => item.hasOwnProperty('isDndShadowItem')? draggedElData : item);
            function finalizeWithinZone() {
                dispatchFinalizeEvent(shadowElDropZone, items);
                cleanupPostDrop();
                isFinalizingPreviousOperation = false;
            }
            animateDraggedToFinalPosition(finalizeWithinZone);
        }
        else { // it needs to return to its place
            console.log('no dz available');
            let {items} = dzToConfig.get(originDropZone);
            items.splice(originIndex, 0, shadowElData);
            shadowElDropZone = originDropZone;
            shadowElIdx = originIndex;
            dispatchConsiderEvent(originDropZone, items);
            function finalizeBackToOrigin() {
                items.splice(originIndex, 1, draggedElData);
                dispatchFinalizeEvent(originDropZone, items);
                cleanupPostDrop();
                isFinalizingPreviousOperation = false;
            }
            window.setTimeout(() => animateDraggedToFinalPosition(finalizeBackToOrigin), 0);
         }
    }
    function animateDraggedToFinalPosition(callback) {
        const shadowElRect = shadowElDropZone.childNodes[shadowElIdx].getBoundingClientRect();
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
    function cleanupPostDrop() {
        draggedEl.remove();
        draggedEl = undefined;
        draggedElData = undefined;
        originDropZone = undefined;
        originIndex = undefined;
        shadowElData = undefined;
        shadowElIdx = undefined;
        dragStartMousePosition = undefined;
    }

    function handleDragStart(e) {
        console.log('drag start', e.currentTarget, {config, elToIdx});
        e.stopPropagation();
        if (isFinalizingPreviousOperation) {
            console.warn('cannot start a new drag before finalizing previous one');
            return;
        }
        const {items} = config;
        draggedEl = e.currentTarget.cloneNode(true);
        const currentIdx = elToIdx.get(e.currentTarget);
        originIndex = currentIdx;
        originDropZone = e.currentTarget.parentNode;
        draggedElData = {...items[currentIdx]};
        shadowElData = {...draggedElData, id: Math.round(Math.random() * 1000000), isDndShadowItem: true};
        dragStartMousePosition = {x: e.clientX, y:e.clientY};
        const rect = e.currentTarget.getBoundingClientRect();
        draggedEl.style.position = "fixed";
        draggedEl.style.top = `${rect.top}px`;
        draggedEl.style.left = `${rect.left}px`;
        draggedEl.style.margin = 0;
        // we can't have relative or automatic height and width or it will break the illusion
        draggedEl.style.height = `${rect.height}px`;
        draggedEl.style.width = `${rect.width}px`;
        draggedEl.style.transition = 'width 0.2s ease, height 0.2s ease';
        // this is a workaround for a strange browser bug that causes the right border to disappear when all the transitions are added at the same time
        window.setTimeout(() => draggedEl.style.transition +=', top 0.2s ease, left 0.2s ease',0);
        draggedEl.style.zIndex = 9999;
        // taking the child out
        document.body.appendChild(draggedEl);
        items.splice( currentIdx, 1);
        dispatchConsiderEvent(e.currentTarget.parentNode, items);
        // TODO - what will happen to its styles when I do this? will it mess up its css?   
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDrop);
        //document.body.addEventListener('mouseleave', handleDrop);
        watchDraggedElement();
    }
    //////////
    function watchDraggedElement() {
        const {type} = config;
        console.log('type', type);
        const dropZones = typeToDropZones.get(type);
        for (const dz of dropZones) {
            dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
            dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
            dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
        }
        window.addEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
        // TODO - even better if we can encapsulate the flip somehow and control its speed
        // it is important that we don't have an interval that is faster than the flip duration because it can cause elements to jump bach and forth
        const observationIntervalMs = Math.max(MIN_OBSERVATION_INTERVAL_MS, ...Array.from(dropZones.keys()).map(dz => dzToConfig.get(dz).dropAnimationDurationMs));
        observe(draggedEl, dropZones, observationIntervalMs);
    }
    function unWatchDraggedElement() {
        const {type} = config;
        const dropZones = typeToDropZones.get(type);
        for (const dz of dropZones) {
            dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
            dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
            dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
        }
        window.removeEventListener(DRAGGED_LEFT_DOCUMENT_EVENT_NAME, handleDrop);
        unobserve(draggedEl, dropZones);
    }

    /////
    // Main :)
    function configure(opts) {
        console.log(`configuring ${JSON.stringify(opts)}`);
        config.dropAnimationDurationMs = opts.flipDurationMs || 0;
        const newType  = opts.type|| DEFAULT_DROP_ZONE_TYPE;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        config.type = newType;
        registerDropZone(node, newType);

        config.items = opts.items || []; 
        dzToConfig.set(node, config);
        for (let idx=0; idx< node.childNodes.length; idx++) {
            const draggableEl = node.childNodes[idx];
            // TODO - attempt to disable the browser's built-in dnd - it might be solving issue #29, keep an eye for this error
            draggableEl.draggable = false;
            draggableEl.ondragstart = () => false;
            //draggableEl.ondragstart = () => false;
            // making it the placeholder element
            if (config.items[idx].hasOwnProperty('isDndShadowItem')) {
                // maybe there is a better place for resizing the dragged
                //draggedEl.style = draggableEl.style; // should i clone?
                const rect = draggableEl.getBoundingClientRect();
                const heightChange = parseFloat(draggedEl.style.height) - rect.height;
                const widthChange = parseFloat(draggedEl.style.width) - rect.width;
                draggedEl.style.height = `${rect.height}px`;
                draggedEl.style.width = `${rect.width}px`;
                draggedEl.style.top = `${parseFloat(draggedEl.style.top) + heightChange}px`;
                draggedEl.style.left = `${parseFloat(draggedEl.style.left) + widthChange}px`;
                // TODO - set more css properties to complete the illusion
                //////
                draggableEl.style.visibility = "hidden";
                continue;
            }
            if (!elToIdx.has(draggableEl)) {
                draggableEl.addEventListener('mousedown', handleDragStart);
            }
            // updating the idx
            elToIdx.set(draggableEl, idx);
            // TODO - consider removing the mouse down listeners from removed items (although probably no need cause they were destroyed)
        }
    }
    configure(options);

    return ({
        update: (newOptions) => {
            console.log("dndzone will update", newOptions);
            configure(newOptions);
        },
        destroy: () => {
            console.log("dndzone will destroy");
            unregisterDropZone(node, config.type);
            dzToConfig.delete(node);
            // TODO - do we need to call unobserve?
        }
    });
}