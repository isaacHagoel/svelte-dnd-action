import {DEFAULT_DROP_ZONE_TYPE} from "./constants";
import {toString} from "./helpers/util";
import {ensureRovingInstruction} from "./helpers/aria";

let rovingTypes = new Set();
// keyboardAction owns the zones, so it hands us the re-render to run when the list changes.
// A callback rather than an import, so this module stays a leaf and there is no cycle between the two
let notifyChanged = () => {};

function isSameAsCurrent(types) {
    if (types.size !== rovingTypes.size) return false;
    for (const type of types) {
        if (!rovingTypes.has(type)) return false;
    }
    return true;
}

/**
 * Chooses which dnd-zone types behave as roving-tabindex composites. All the zones sharing a listed type get a
 * single item tab stop between them instead of one per item, with the arrow keys moving that tab stop at rest
 * and the grabbed item during a keyboard drag.
 * A zone that names no type has one all the same, so `null` (or `undefined`) as an *element* of the array means
 * "the zones that set no type", and those form a group of their own like any other.
 * This setting is global to the document and applies to every dndzone. It can be called at any time, including
 * after the zones have rendered: the types added collapse to a single tab stop on the spot, and the types removed
 * get their per-item tab stops back. A call that names the types already in effect is inert - it triggers no
 * re-render - so the idiomatic reactive call site can fire as often as it likes. A type that no zone uses is
 * silently inert rather than an error, since types only come into existence as zones mount - the list may
 * legitimately name a type nothing has rendered yet.
 * Pass null or undefined *instead of* the array (or call with no argument) to turn the feature off everywhere,
 * which is the default.
 * @param {Array<string|null|undefined>|null|undefined} [types] - the zone types to treat as roving composites
 * @throws {Error} if given anything other than an array of non-empty strings and nulls, null, or undefined
 */
export function setRovingTabindexTypes(types) {
    let next;
    if (types === null || types === undefined) {
        next = new Set();
    } else if (!Array.isArray(types)) {
        throw new Error(
            `setRovingTabindexTypes expects an array of non-empty strings (null for zones with no type) or null but instead got a ${typeof types}, ${toString(
                types
            )}`
        );
    } else {
        const badIdx = types.findIndex(type => type !== null && type !== undefined && (typeof type !== "string" || type.length === 0));
        if (badIdx > -1) {
            throw new Error(
                `setRovingTabindexTypes expects an array of non-empty strings (null for zones with no type) but instead got a ${typeof types[
                    badIdx
                ]}, ${toString(types[badIdx])} at index ${badIdx}`
            );
        }
        next = new Set(types.map(type => (type === null || type === undefined ? DEFAULT_DROP_ZONE_TYPE : type)));
    }
    // the roving zones point at their own screen-reader instruction, which is only added to the document once the
    // feature is turned on, so that a consumer who never calls this sees no change to their DOM. It is deliberately
    // not removed when the list is emptied again: it is inert once nothing references it, whereas removing it could
    // leave a dangling aria-describedby on a zone that hasn't re-configured itself yet.
    // Done before the no-op check below so that a repeat call still guarantees the element (ex: after destroyAria).
    if (next.size > 0) ensureRovingInstruction();
    // re-rendering every zone on a call that changes nothing would be felt: mid keyboard drag it re-focuses the
    // grabbed item and scrolls it into view, and `$: setRovingTabindexTypes(types)` re-fires on any reactive tick
    if (isSameAsCurrent(next)) return;
    rovingTypes = next;
    notifyChanged();
}

/**
 * @param {string} type - a dnd-zone type
 * @return {boolean} whether zones of this type form a roving composite
 */
export function isRovingTabindexType(type) {
    return rovingTypes.has(type);
}

/**
 * Registers the single callback run after every change to the list, so the already rendered zones can pick it up
 * @param {function} callback
 */
export function onRovingTabindexTypesChanged(callback) {
    notifyChanged = callback;
}
