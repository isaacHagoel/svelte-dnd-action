import {SOURCES, TRIGGERS} from "../constants";
import {dndzone} from "../action";
import {createStore} from "./simpleStore";

const isItemsDragDisabled = createStore(true);

function getAddedOptions(isItemsDragDisabled = true) {
    return {
        dragDisabled: isItemsDragDisabled,
        zoneItemTabIndex: -1
    };
}

/**
 * This is an action that wraps around the dndzone action to make it easy to work with drag handles
 * When using this you must also use the 'dragHandle' action (see below) on an element inside each item within the zone
 * Credit for the idea and initial implementation goes to @gleuch (Greg Leuch) and @geovie (Georg Vienna)
 *
 * @param {HTMLElement} node
 * @param options - will be passed down to the dndzone
 * @return {{update: (newOptions: Object) => {}, destroy: () => {}}}
 */
export function dragHandleZone(node, options) {
    let currentOptions = options;
    const zone = dndzone(node, {
        ...currentOptions,
        ...getAddedOptions()
    });
    function isItemDisabledCB(isItemsDragDisabled) {
        zone.update({
            ...currentOptions,
            ...getAddedOptions(isItemsDragDisabled)
        });
    }
    isItemsDragDisabled.subscribe(isItemDisabledCB);
    function consider(e) {
        const {
            info: {source, trigger}
        } = e.detail;
        // Ensure dragging is stopped on drag finish via keyboard
        if (source === SOURCES.KEYBOARD && trigger === TRIGGERS.DRAG_STOPPED) {
            isItemsDragDisabled.set(true);
        }
    }

    function finalize(e) {
        const {
            info: {source}
        } = e.detail;
        // Ensure dragging is stopped on drag finish via pointer (mouse, touch)
        if (source === SOURCES.POINTER) {
            isItemsDragDisabled.set(true);
        }
    }

    node.addEventListener("consider", consider);
    node.addEventListener("finalize", finalize);

    return {
        update: newOptions => {
            currentOptions = newOptions;
            zone.update({
                ...currentOptions,
                ...getAddedOptions(isItemsDragDisabled.get())
            });
        },
        destroy: () => {
            node.removeEventListener("consider", consider);
            node.removeEventListener("finalize", finalize);
            isItemsDragDisabled.unsubscribe(isItemDisabledCB);
        }
    };
}

/**
 * This should be used to mark drag handles inside items that belong to a 'dragHandleZone' (see above)
 * @param {HTMLElement} handle
 * @return {{update: *, destroy: *}}
 */
export function dragHandle(handle) {
    handle.setAttribute("role", "button");

    function startDrag(e) {
        // preventing default to prevent lag on touch devices (because of the browser checking for screen scrolling)
        e.preventDefault();
        isItemsDragDisabled.set(false);
    }
    function handleKeyDown(e) {
        if (e.key === "Enter" || e.key === " ") isItemsDragDisabled.set(false);
    }

    isItemsDragDisabled.subscribe(disabled => {
        handle.tabIndex = disabled ? 0 : -1;
        handle.style.cursor = disabled ? "grab" : "grabbing";
    });

    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    handle.addEventListener("keydown", handleKeyDown);
    return {
        update: () => {},
        destroy: () => {
            handle.removeEventListener("mousedown", startDrag);
            handle.removeEventListener("touchstart", startDrag);
            handle.removeEventListener("keydown", handleKeyDown);
        }
    };
}
