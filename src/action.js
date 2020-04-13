import { observe, unobserve } from './helpers/observer';
import { DRAGGED_ENTERED_EVENT_NAME, DRAGGED_LEFT_EVENT_NAME,  DRAGGED_OVER_INDEX_EVENT_NAME, dispatchConsiderEvent, dispatchFinalizeEvent } from './helpers/dispatcher';
const DEFAULT_DROP_ZONE_TYPE = '--any--';

let draggedEl;
let draggedElData;
let shadowElIdx;
let shadowElData;
let shadowElDropZone;
let originalPosition;
let typeToDropZones = new Map();
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

export function dndzone(node, options) {
    const config =  {items: [], type: DEFAULT_DROP_ZONE_TYPE};
    console.log("dndzone good to go", {node, options, config});
    let elToIdx = new Map();;

    function handleMouseMove(e) {
        if (!draggedEl) {
            return;
        }
        // TODO - add another visual queue like a border or increased scale and shadow	
        // TODO - is it better to update its top and left instead?	
        draggedEl.style.transform = `translate3d(${e.clientX - originalPosition.x}px, ${e.clientY-originalPosition.y}px, 0)`;
    }
    function handleDrop(e) {
        console.log('dropped', e.target);
        // cleanup
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleDrop);
        window.removeEventListener('mouseleave', handleDrop);
        unWatchDraggedElement();
        // it might not be dropped over anything we care about - in that case it needs to return to its original place (animate)
        // raise the finalize event
        
        // it was dropped in a drop-zone
        if (!!shadowElDropZone) {
            let {items} = config;
            items = items.map(item => item.hasOwnProperty('isDndShadowItem')? draggedElData : item);
            dispatchFinalizeEvent(shadowElDropZone, items);
            draggedEl.remove();
        }
        else { // it needs to return to its place
            // TODO - HERE
        }

        draggedEl = undefined;
        draggedElData = undefined;
        shadowElData = undefined;
        shadowElIdx = undefined;
        originalPosition = undefined;

    }
    function handleDragStart(e) {
        console.log('drag start', e.target, {config, elToIdx});
        const {items} = config;
        draggedEl = e.target.cloneNode(true);
        const currentIdx = elToIdx.get(e.target);
        draggedElData = items[currentIdx]; 
        originalPosition = {x: e.clientX, y:e.clientY};
        // TODO - should I backup original attributes? probably not
        const rect = e.target.getBoundingClientRect();
        draggedEl.style.position = "fixed";
        draggedEl.style.top = `${rect.top}px`;
        draggedEl.style.left = `${rect.left}px`;
        draggedEl.style.zIndex = 9999;
        // taking the child out
        document.body.appendChild(draggedEl);
        items.splice( currentIdx, 1);
        dispatchConsiderEvent(e.target.parentNode, items);

        // TODO - what will happen to its styles when I do this? will it mess up its css?
        //const indexOfDragged = elToIdx.get(e.target);
       

        ///
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDrop);
        window.addEventListener('mouseleave', handleDrop);
        watchDraggedElement();
    }
    //////////
    function handleDraggedEntered(e) {
        console.log('dragged entered', e.target, e.detail);
        shadowElData = {...draggedElData, id: Math.round(Math.random() * 1000000), isDndShadowItem: true};
        // TODO - it should sometimes added to the beginning and sometimes to the end. add
        const {items} = config;
        console.warn("dragged entered items", items);
        shadowElIdx = event.detail.index;
        shadowElDropZone = e.target;
        items.splice( shadowElIdx, 0, shadowElData);
        dispatchConsiderEvent(e.target, items);
    }
    function handleDraggedLeft(e) {
        console.log('dragged left', e.target, e.detail);
        const {items} = config;
        // TODO - do we want it to leave or jump to its original position instead?
        items.splice(shadowElIdx, 1);
        shadowElIdx = undefined;
        shadowElDropZone = undefined;
        dispatchConsiderEvent(e.target, items); 
    }
    function handleDraggedIsOverIndex(e) {
        console.log('dragged is over index', e.target, e.detail);
        const {items} = config;
        const {index} = e.detail;
        items.splice(shadowElIdx, 1);
        items.splice( index, 0, shadowElData);
        shadowElIdx = index;
        dispatchConsiderEvent(e.target, items);
    }
    function watchDraggedElement() {
        const {type} = config;
        console.log('type', type);
        const dropZones = typeToDropZones.get(type);
        for (const dz of dropZones) {
            dz.addEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
            dz.addEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
            dz.addEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
        }
        observe(draggedEl, dropZones);
    }
    function unWatchDraggedElement() {
        const {type} = config;
        const dropZones = typeToDropZones.get(type);
        for (const dz of dropZones) {
           
            dz.removeEventListener(DRAGGED_ENTERED_EVENT_NAME, handleDraggedEntered);
            dz.removeEventListener(DRAGGED_LEFT_EVENT_NAME, handleDraggedLeft);
            dz.removeEventListener(DRAGGED_OVER_INDEX_EVENT_NAME, handleDraggedIsOverIndex);
        }
        unobserve(draggedEl, dropZones);
    }

    /////
    // Main :)
    function configure(opts) {
        const newType  = opts.type|| DEFAULT_DROP_ZONE_TYPE;
        if (config.type && newType !== config.type) {
            unregisterDropZone(node, config.type);
        }
        registerDropZone(node, newType);

        config.items = opts.items || []; 
        for (let idx=0; idx< node.childNodes.length; idx++) {
            const draggableEl = node.childNodes[idx];
            // making it the placeholder element
            if (config.items[idx].hasOwnProperty('isDndShadowItem')) {
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
            // TODO - this needs to rewire all of the listeners and everything
            console.log("dndzone will update", newOptions);
            if (newOptions.type !== options.type) {
                throw new Error("a dynamic change of type is not supported yet (but shouldn't be hard to add");
            }
            configure(newOptions);
        },
        destroy: () => {
            console.log("dndzone will destroy");
            unregisterDropZone(node, config.type);
            // TODO - do we need to call unobserve?
        }
    });
}