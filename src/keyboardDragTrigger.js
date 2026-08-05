import {DEFAULT_KEYBOARD_DRAG_TRIGGER, KEYBOARD_DRAG_TRIGGER_KEYS} from "./constants";
import {toString} from "./helpers/util";

let activeTrigger = DEFAULT_KEYBOARD_DRAG_TRIGGER;

/**
 * Chooses which key(s) start and stop a keyboard drag on a focused item. Keys outside the trigger are
 * left completely untouched by the library (no preventDefault, no stopPropagation), so the app can use
 * them - ex: "space" keeps Enter free to activate the focused item.
 * This setting is global to the document and applies to every dndzone. It can be called at any time.
 * Pass null to restore the default, "space_or_enter".
 * @param {"space"|"enter"|"space_or_enter"|null} trigger
 * @throws {Error} if given anything other than the documented values or null
 */
export function setKeyboardDragTrigger(trigger) {
    if (trigger === null || trigger === undefined) {
        activeTrigger = DEFAULT_KEYBOARD_DRAG_TRIGGER;
        return;
    }
    if (typeof trigger !== "string" || !Object.prototype.hasOwnProperty.call(KEYBOARD_DRAG_TRIGGER_KEYS, trigger)) {
        throw new Error(
            `setKeyboardDragTrigger expects one of ${Object.keys(KEYBOARD_DRAG_TRIGGER_KEYS)
                .map(key => `"${key}"`)
                .join(", ")} or null but instead got a ${typeof trigger}, ${toString(trigger)}`
        );
    }
    activeTrigger = trigger;
}

/**
 * @return {"space"|"enter"|"space_or_enter"} the active trigger
 */
export function getKeyboardDragTrigger() {
    return activeTrigger;
}

/**
 * @param {string} key - a KeyboardEvent.key value
 * @return {boolean} whether this key starts/stops a drag under the active trigger
 */
export function isKeyboardDragTriggerKey(key) {
    return KEYBOARD_DRAG_TRIGGER_KEYS[activeTrigger].includes(key);
}
