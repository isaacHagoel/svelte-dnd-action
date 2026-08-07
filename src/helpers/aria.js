import {DEFAULT_KEYBOARD_DRAG_TRIGGER, KEYBOARD_DRAG_TRIGGER_PHRASES, isOnServer, printDebug} from "../constants";
import {toString} from "./util";

const INSTRUCTION_IDs = {
    DND_ZONE_ACTIVE: "dnd-zone-active",
    DND_ZONE_ACTIVE_ROVING: "dnd-zone-active-roving",
    DND_ZONE_DRAG_DISABLED: "dnd-zone-drag-disabled"
};
const INSTRUCTION_ID_TO_STRING_KEY = {
    [INSTRUCTION_IDs.DND_ZONE_ACTIVE]: "zoneActiveInstruction",
    [INSTRUCTION_IDs.DND_ZONE_ACTIVE_ROVING]: "zoneActiveRovingInstruction",
    [INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED]: "zoneDragDisabledInstruction"
};

const DEFAULT_ARIA_STRINGS = {
    dragStarted: ({itemLabel, zoneLabel, canMoveBetweenZones, canMoveBetweenZonesWithArrows}) =>
        `Started dragging item ${itemLabel}. Use the arrow keys to move it within its list ${zoneLabel}` +
        (canMoveBetweenZonesWithArrows
            ? ", or into another list in that direction"
            : canMoveBetweenZones
            ? ", or tab to another list in order to move the item into it"
            : ""),
    movedToPosition: ({itemLabel, zoneLabel, position}) => `Moved item ${itemLabel} to position ${position} in the list ${zoneLabel}`,
    movedToZoneEnd: ({itemLabel, zoneLabel}) => `Moved item ${itemLabel} to the end of the list ${zoneLabel}`,
    movedToZoneStart: ({itemLabel, zoneLabel}) => `Moved item ${itemLabel} to the beginning of the list ${zoneLabel}`,
    dropped: ({itemLabel}) => `Stopped dragging item ${itemLabel}`,
    zoneActiveInstruction: ({keyboardDragTrigger}) =>
        `Tab to one the items and press ${KEYBOARD_DRAG_TRIGGER_PHRASES[keyboardDragTrigger]} to start dragging it`,
    zoneActiveRovingInstruction: ({keyboardDragTrigger}) =>
        `Use the arrow keys to move between the items and the lists, and press ${KEYBOARD_DRAG_TRIGGER_PHRASES[keyboardDragTrigger]} to start dragging the focused item`,
    zoneDragDisabledInstruction: "This is a disabled drag and drop list"
};

const FUNCTION_ARIA_STRING_KEYS = ["dragStarted", "movedToPosition", "movedToZoneEnd", "movedToZoneStart", "dropped"];
// both active-zone instructions name the key that starts a drag, so a translation may need to vary it with the trigger.
const STRING_OR_FUNCTION_ARIA_STRING_KEYS = ["zoneActiveInstruction", "zoneActiveRovingInstruction"];
// zoneDragDisabledInstruction has no drag to start and thus no key to name, so it stays string-only.
const STRING_ONLY_ARIA_STRING_KEYS = ["zoneDragDisabledInstruction"];

let ariaStrings = {...DEFAULT_ARIA_STRINGS};
let instructionCtx = {keyboardDragTrigger: DEFAULT_KEYBOARD_DRAG_TRIGGER};

// the ordinary instructions every consumer needs. The roving one is created on demand instead (see
// ensureRovingInstruction), so a consumer who never calls setRovingTabindexTypes gets exactly the DOM they got before
const EAGER_INSTRUCTION_IDs = [INSTRUCTION_IDs.DND_ZONE_ACTIVE, INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED];

const ALERT_DIV_ID = "dnd-action-aria-alert";
let alertsDiv;
let isRovingInstructionNeeded = false;

function initAriaOnBrowser() {
    if (alertsDiv) {
        // it is already initialized
        return;
    }
    // setting the dynamic alerts
    alertsDiv = document.createElement("div");
    (function initAlertsDiv() {
        alertsDiv.id = ALERT_DIV_ID;
        // tab index -1 makes the alert be read twice on chrome for some reason
        //alertsDiv.tabIndex = -1;
        alertsDiv.style.position = "fixed";
        alertsDiv.style.bottom = "0";
        alertsDiv.style.left = "0";
        alertsDiv.style.zIndex = "-5";
        alertsDiv.style.opacity = "0";
        alertsDiv.style.height = "0";
        alertsDiv.style.width = "0";
        alertsDiv.setAttribute("role", "alert");
    })();
    document.body.prepend(alertsDiv);

    // setting the instructions
    EAGER_INSTRUCTION_IDs.forEach(prependInstruction);
    // the types may have been registered before this ran - ex: a consumer calling the setter at module scope
    if (isRovingInstructionNeeded) prependInstruction(INSTRUCTION_IDs.DND_ZONE_ACTIVE_ROVING);
}

function prependInstruction(id) {
    document.body.prepend(instructionToHiddenDiv(id, formatWithFallback(INSTRUCTION_ID_TO_STRING_KEY[id], instructionCtx)));
}

/**
 * Creates the roving-tabindex instruction element, which only exists once the feature is turned on.
 * Called by setRovingTabindexTypes, so it has to work in both orders: after the aria init has run it creates the
 * element on the spot, and before it (a consumer calling the setter at module scope, or before DOMContentLoaded)
 * it records the intent for initAriaOnBrowser to act on.
 * The element is never removed when the type list is emptied again: it is inert once no zone references it, whereas
 * removing it could leave a dangling aria-describedby on a zone that hasn't re-configured itself yet.
 */
export function ensureRovingInstruction() {
    if (isOnServer) return;
    isRovingInstructionNeeded = true;
    // the init hasn't run yet - the flag above will make it create the element
    if (!alertsDiv) return;
    if (document.getElementById(INSTRUCTION_IDs.DND_ZONE_ACTIVE_ROVING)) return;
    prependInstruction(INSTRUCTION_IDs.DND_ZONE_ACTIVE_ROVING);
}

/**
 * Initializes the static aria instructions so they can be attached to zones
 * @return {{DND_ZONE_ACTIVE: string, DND_ZONE_ACTIVE_ROVING: string, DND_ZONE_DRAG_DISABLED: string} | null} - the IDs for static aria instruction (to be used via aria-describedby) or null on the server
 */
export function initAria() {
    if (isOnServer) return null;
    if (document.readyState === "complete") {
        initAriaOnBrowser();
    } else {
        window.addEventListener("DOMContentLoaded", initAriaOnBrowser);
    }
    return {...INSTRUCTION_IDs};
}

/**
 * Removes all the artifacts (dom elements) added by this module
 */
export function destroyAria() {
    if (isOnServer || !alertsDiv) return;
    Object.keys(INSTRUCTION_ID_TO_STRING_KEY).forEach(id => document.getElementById(id)?.remove());
    alertsDiv.remove();
    alertsDiv = undefined;
}

function instructionToHiddenDiv(id, txt) {
    const div = document.createElement("div");
    div.id = id;
    renderInstruction(div, txt);
    div.style.display = "none";
    div.style.position = "fixed";
    div.style.zIndex = "-5";
    return div;
}

function renderInstruction(div, txt) {
    div.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = txt;
    div.appendChild(paragraph);
}

/**
 * Will make the screen reader alert the provided text to the user
 * @param {string} txt
 */
export function alertToScreenReader(txt) {
    if (isOnServer) return;
    if (!alertsDiv) {
        initAriaOnBrowser();
    }
    alertsDiv.innerHTML = "";
    const alertText = document.createTextNode(txt);
    alertsDiv.appendChild(alertText);
    // this is needed for Safari
    alertsDiv.style.display = "none";
    alertsDiv.style.display = "inline";
}

/**
 * Overrides the strings the library announces to screen readers. Each call starts with the built-in
 * English defaults and applies the supplied overrides, so omitted keys return to English when the locale
 * changes. Existing instruction elements update immediately. This setting is global to all dndzones.
 * Pass null to restore the built-in English strings.
 * @param {Object | null} overrides - any subset of: dragStarted, movedToPosition, movedToZoneEnd,
 * movedToZoneStart, dropped (functions taking a context object and returning a string);
 * zoneActiveInstruction and zoneActiveRovingInstruction (a string, or a function taking
 * {keyboardDragTrigger} and returning a string - useful because a hard-coded translation can't name the
 * right key if the app varies the trigger; the roving one describes a zone whose type was passed to
 * setRovingTabindexTypes, where the arrow keys rather than Tab move between the items);
 * zoneDragDisabledInstruction (a string only - a disabled zone has no drag to start, so there is no key
 * for a formatter to name)
 * @throws {Error} if overrides is not an object or null, contains an unknown key, or contains a value of
 * the wrong type. Validation completes before the active strings change.
 */
export function setAriaStrings(overrides) {
    if (overrides === null || overrides === undefined) {
        ariaStrings = {...DEFAULT_ARIA_STRINGS};
    } else {
        if (typeof overrides !== "object" || Array.isArray(overrides)) {
            throw new Error(`setAriaStrings expects an object or null but instead got a ${typeof overrides}, ${toString(overrides)}`);
        }
        Object.keys(overrides).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_ARIA_STRINGS, key)) {
                throw new Error(`Can't set non existing aria string ${key}! Supported strings: ${Object.keys(DEFAULT_ARIA_STRINGS)}`);
            }
            const value = overrides[key];
            if (FUNCTION_ARIA_STRING_KEYS.includes(key) && typeof value !== "function") {
                throw new Error(`${key} should be a function but instead it is a ${typeof value}, ${toString(value)}`);
            }
            if (STRING_OR_FUNCTION_ARIA_STRING_KEYS.includes(key) && typeof value !== "string" && typeof value !== "function") {
                throw new Error(`${key} should be a string or a function but instead it is a ${typeof value}, ${toString(value)}`);
            }
            if (STRING_ONLY_ARIA_STRING_KEYS.includes(key) && typeof value !== "string") {
                throw new Error(`${key} should be a string but instead it is a ${typeof value}, ${toString(value)}`);
            }
        });
        ariaStrings = {...DEFAULT_ARIA_STRINGS, ...overrides};
    }
    refreshInstructions();
}

function formatAriaString(strings, key, ctx) {
    const ariaString = strings[key];
    return typeof ariaString === "function" ? ariaString(ctx) : ariaString;
}

function formatWithFallback(key, ctx) {
    try {
        return formatAriaString(ariaStrings, key, ctx);
    } catch (err) {
        printDebug(() => [`aria string formatter for "${key}" threw, falling back to the default`, err]);
        try {
            return formatAriaString(DEFAULT_ARIA_STRINGS, key, ctx);
        } catch (defaultErr) {
            printDebug(() => [`default aria string formatter for "${key}" also threw`, defaultErr]);
            return "";
        }
    }
}

function refreshInstructions() {
    if (isOnServer) return;
    Object.entries(INSTRUCTION_ID_TO_STRING_KEY).forEach(([id, key]) => {
        const div = document.getElementById(id);
        if (div) renderInstruction(div, formatWithFallback(key, instructionCtx));
    });
}

/**
 * Sets the context the static instruction formatters receive, and re-renders them. Internal - the
 * public entry point is setKeyboardDragTrigger.
 * @param {{keyboardDragTrigger: "space"|"enter"|"space_or_enter"}} ctx
 */
export function setInstructionContext(ctx) {
    instructionCtx = {...ctx};
    refreshInstructions();
}

/**
 * Formats and announces one configured ARIA message. If a consumer formatter throws, the built-in
 * English formatter is used and the error is reported through printDebug. Formatter errors must not
 * escape because this function runs during the drag lifecycle.
 * @param {string} key - one of the keys accepted by setAriaStrings
 * @param {Object} [ctx] - the interpolation context for that key
 */
export function announceToScreenReader(key, ctx) {
    alertToScreenReader(formatWithFallback(key, ctx));
}
