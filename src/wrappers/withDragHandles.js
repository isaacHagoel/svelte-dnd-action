import {DEFAULT_KEYBOARD_DRAG_TRIGGER, KEYBOARD_DRAG_TRIGGER_KEYS, SOURCES, TRIGGERS} from "../constants";
import {dndzone} from "../action";
import {createStore} from "./simpleStore";

const isItemsDragDisabled = createStore(true);
const userDragDisabled = createStore(false);

// mirrors the zone's keyboardDragTrigger option so dragHandle, which has no access to the
// zone's options, doesn't unlock dragging on a key the zone will not grab with.
// Module-level like the stores above, so it shares their known one-zone-at-a-time limitation.
let currentKeyboardDragTrigger = DEFAULT_KEYBOARD_DRAG_TRIGGER;

function getAddedOptions() {
    return {
        dragDisabled: userDragDisabled.get() || isItemsDragDisabled.get(),
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
    // Initialise stores from initial options
    userDragDisabled.set(options?.dragDisabled ?? false);

    let currentOptions = options;

    const zone = dndzone(node, {
        ...currentOptions,
        ...getAddedOptions()
    });

    // Only update the mirror after dndzone validates the keyboardDragTrigger option
    currentKeyboardDragTrigger = options?.keyboardDragTrigger ?? DEFAULT_KEYBOARD_DRAG_TRIGGER;

    function updateZone() {
        zone.update({
            ...currentOptions,
            ...getAddedOptions()
        });
    }

    // Subscribe to internal store so finishing a drag updates the zone
    isItemsDragDisabled.subscribe(updateZone);

    // We don't need to subscribe to userDragDisabled here because updates to
    // it always come through the `update` lifecycle and will call `updateZone`
    // anyway.

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
            // keep store in sync with external prop
            userDragDisabled.set(currentOptions?.dragDisabled ?? false);
            updateZone();
            // Only update the mirror after updateZone validates the keyboardDragTrigger option
            currentKeyboardDragTrigger = currentOptions?.keyboardDragTrigger ?? DEFAULT_KEYBOARD_DRAG_TRIGGER;
        },
        destroy: () => {
            zone.destroy();
            node.removeEventListener("consider", consider);
            node.removeEventListener("finalize", finalize);
            isItemsDragDisabled.unsubscribe(updateZone);
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

        // Reset the startDrag/isItemsDragDisabled if the user releases the mouse/touch without initiating a drag
        window.addEventListener("mouseup", resetStartDrag);
        window.addEventListener("touchend", resetStartDrag);
    }

    function handleKeyDown(e) {
        if (KEYBOARD_DRAG_TRIGGER_KEYS[currentKeyboardDragTrigger].includes(e.key)) isItemsDragDisabled.set(false);
    }

    function resetStartDrag() {
        isItemsDragDisabled.set(true);
        window.removeEventListener("mouseup", resetStartDrag);
        window.removeEventListener("touchend", resetStartDrag);
    }

    const recomputeHandleState = () => {
        const userDisabled = userDragDisabled.get();
        const internalDisabled = isItemsDragDisabled.get();

        if (userDisabled) {
            handle.tabIndex = -1;
            handle.style.cursor = ""; // default cursor
        } else {
            handle.tabIndex = internalDisabled ? 0 : -1;
            handle.style.cursor = internalDisabled ? "grab" : "grabbing";
        }
    };

    // Subscribe to both stores
    userDragDisabled.subscribe(recomputeHandleState);
    isItemsDragDisabled.subscribe(recomputeHandleState);

    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    handle.addEventListener("keydown", handleKeyDown);
    return {
        update: () => {},
        destroy: () => {
            handle.removeEventListener("mousedown", startDrag);
            handle.removeEventListener("touchstart", startDrag);
            handle.removeEventListener("keydown", handleKeyDown);
            userDragDisabled.unsubscribe(recomputeHandleState);
            isItemsDragDisabled.unsubscribe(recomputeHandleState);
        }
    };
}
