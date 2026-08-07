import {decrementActiveDropZoneCount, DEFAULT_DROP_ZONE_TYPE, incrementActiveDropZoneCount, ITEM_ID_KEY, SOURCES, TRIGGERS} from "./constants";
import {isKeyboardDragTriggerKey} from "./keyboardDragTrigger";
import {isRovingTabindexType, onRovingTabindexTypesChanged} from "./rovingTabindexTypes";
import {styleActiveDropZones, styleInactiveDropZones} from "./helpers/styler";
import {dispatchConsiderEvent, dispatchFinalizeEvent} from "./helpers/dispatcher";
import {initAria, announceToScreenReader, destroyAria} from "./helpers/aria";
import {toString} from "./helpers/util";
import {printDebug} from "./constants";

const DEFAULT_DROP_TARGET_STYLE = {
    outline: "rgba(255, 255, 102, 0.7) solid 2px"
};

// per roving zone type, the {el, id} of the item holding that type's single tab stop - the id lets configure() re-resolve it
const groupToActiveItem = new Map();
let isDragging = false;
let draggedItemType;
let focusedDz;
let focusedDzLabel = "";
let focusedItem;
let focusedItemId;
let focusedItemLabel = "";
const allDragTargets = new WeakSet();
const elToKeyDownListeners = new WeakMap();
const elToFocusListeners = new WeakMap();
const dzToHandles = new Map();
const dzToConfig = new Map();
const typeToDropZones = new Map();

/* TODO (potentially)
 * what's the deal with the black border of voice-reader not following focus?
 * maybe keep focus on the last dragged item upon drop?
 */

let INSTRUCTION_IDs;

/* drop-zones registration management */
function registerDropZone(dropZoneEl, type) {
    printDebug(() => "registering drop-zone if absent");
    if (typeToDropZones.size === 0) {
        printDebug(() => "adding global keydown and click handlers");
        INSTRUCTION_IDs = initAria();
        window.addEventListener("keydown", globalKeyDownHandler);
        window.addEventListener("click", globalClickHandler);
    }
    if (!typeToDropZones.has(type)) {
        typeToDropZones.set(type, new Set());
    }
    if (!typeToDropZones.get(type).has(dropZoneEl)) {
        typeToDropZones.get(type).add(dropZoneEl);
        incrementActiveDropZoneCount();
    }
}
function unregisterDropZone(dropZoneEl, type) {
    printDebug(() => "unregistering drop-zone");
    if (isDragging && focusedDz === dropZoneEl) {
        handleDrop();
    }
    const dropZones = typeToDropZones.get(type);
    if (!dropZones || !dropZones.delete(dropZoneEl)) return;
    decrementActiveDropZoneCount();
    if (dropZones.size === 0) {
        typeToDropZones.delete(type);
    }
    if (typeToDropZones.size === 0) {
        printDebug(() => "removing global keydown and click handlers");
        window.removeEventListener("keydown", globalKeyDownHandler);
        window.removeEventListener("click", globalClickHandler);
        INSTRUCTION_IDs = undefined;
        destroyAria();
    }
}

function globalKeyDownHandler(e) {
    if (!isDragging) return;
    switch (e.key) {
        case "Escape": {
            handleDrop();
            break;
        }
    }
}

function globalClickHandler() {
    if (!isDragging) return;
    if (!allDragTargets.has(document.activeElement)) {
        printDebug(() => "clicked outside of any draggable");
        handleDrop();
    }
}

function getActiveDragTabIndex(dropZoneEl, config) {
    return dropZoneEl === focusedDz || focusedItem.contains(dropZoneEl) || config.dropFromOthersDisabled || config.type !== draggedItemType ? -1 : 0;
}

function refreshActiveDragTabIndices() {
    dzToConfig.forEach((config, dropZoneEl) => {
        dropZoneEl.tabIndex = getActiveDragTabIndex(dropZoneEl, config);
    });
}

/* at-rest navigation + roving tabindex */

// same escape hatch as the space/enter case - arrow keys inside a nested input or link are the
// consumer's, not ours - plus role=textbox, which arrows matter to but which has no disabled property
function isConsumerOwnedControl(target) {
    if (!target || allDragTargets.has(target)) return false;
    if (target.disabled !== undefined || target.href || target.isContentEditable) return true;
    return target.getAttribute?.("role") === "textbox";
}

// a dragDisabled zone is excluded even when its type is a roving one: it gets no keydown handler, so a
// single tab stop inside it would be a keyboard trap - it keeps the per-item tab stops instead
function isRovingCandidate(dz) {
    const config = dzToConfig.get(dz);
    return !!config && isRovingTabindexType(config.type) && !config.dragDisabled;
}
// the group is keyed on the type, and dragging between nested lists is the ordinary reason for a nested zone to
// share its parent's type - so containment, not just the type, decides membership. A nested zone owns its own
// items' tabindex, and the tab stop could not reach into it anyway (a zone inside the source lies in no
// direction from it), so it keeps upstream's per-item tab stops and stays reachable by Tab
function hasGroupedAncestor(dz) {
    const type = dzToConfig.get(dz)?.type;
    for (let cur = dz.parentElement; cur; cur = cur.parentElement) {
        if (dzToConfig.get(cur)?.type === type && isRovingCandidate(cur)) return true;
    }
    return false;
}
function isGroupedZone(dz) {
    return isRovingCandidate(dz) && !hasGroupedAncestor(dz);
}
// the zones a roving type's single tab stop is shared between, in whatever order they currently sit in that
// type's Set. That order is stable between renders but is not the order the zones first mounted in - a zone that
// changes type is re-added at the end of the new type's Set, and a type whose last zone leaves loses its Set
// altogether - so nothing may depend on it beyond being deterministic within a single pass
function zonesInRovingGroup(type) {
    if (!isRovingTabindexType(type)) return [];
    const dropZones = typeToDropZones.get(type);
    if (!dropZones) return [];
    return Array.from(dropZones).filter(isGroupedZone);
}

const DIRECTION_TOLERANCE = 1; // absorbs sub-pixel layout
const DIRECTION_STEP = {right: 1, down: 1, left: -1, up: -1};

// the group's zone lying in `direction` from fromZone, or null. A candidate must start past fromZone's far edge and also
// extend further that way - without the second test a zone shrink-wrapped to no width sits at the same left as its
// neighbours, and one stacked below it would read as being to the right. Zones with no area (display:none reports an
// all-zero rect at the viewport origin) and zones with no rendered children are skipped during selection rather than
// after it, so a further zone in the same direction still wins. Overlap on the perpendicular axis beats a diagonal, then
// the smallest gap wins; ties keep the incumbent, so the pick is deterministic in `zones` order.
// allowEmpty is for callers carrying an item rather than the tab stop: a childless zone is nowhere to put focus, but it
// is somewhere to put an item
function zoneInDirection(fromZone, direction, zones, {allowEmpty = false} = {}) {
    const from = fromZone.getBoundingClientRect();
    const isHorizontal = direction === "left" || direction === "right";
    let best = null;
    let bestScore = Infinity;
    let bestOverlaps = false;
    for (const zone of zones) {
        if (zone === fromZone || (!allowEmpty && !zone.children.length)) continue;
        const rect = zone.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        let gap;
        let extendsFurther;
        if (direction === "right") {
            gap = rect.left - from.right;
            extendsFurther = rect.right > from.right + DIRECTION_TOLERANCE;
        } else if (direction === "left") {
            gap = from.left - rect.right;
            extendsFurther = rect.left < from.left - DIRECTION_TOLERANCE;
        } else if (direction === "down") {
            gap = rect.top - from.bottom;
            extendsFurther = rect.bottom > from.bottom + DIRECTION_TOLERANCE;
        } else {
            gap = from.top - rect.bottom;
            extendsFurther = rect.top < from.top - DIRECTION_TOLERANCE;
        }
        if (gap < -DIRECTION_TOLERANCE || !extendsFurther) continue;
        const overlaps = isHorizontal ? rect.top < from.bottom && rect.bottom > from.top : rect.left < from.right && rect.right > from.left;
        const perpendicularOffset = isHorizontal
            ? Math.abs((rect.top + rect.bottom) / 2 - (from.top + from.bottom) / 2)
            : Math.abs((rect.left + rect.right) / 2 - (from.left + from.right) / 2);
        const score = Math.max(gap, 0) + (overlaps ? 0 : perpendicularOffset);
        const isBetter = best === null || (overlaps && !bestOverlaps) || (overlaps === bestOverlaps && score < bestScore);
        if (!isBetter) continue;
        best = zone;
        bestScore = score;
        bestOverlaps = overlaps;
    }
    return best;
}

// APG's rule for a composite that contains widgets: the single tab stop only holds if the widgets inside the
// inactive items leave the tab order too, or a card with a button in it is still a tab stop of its own
const FOCUSABLE_DESCENDANT_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[tabindex]",
    '[contenteditable=""]',
    '[contenteditable="true"]',
    "audio[controls]",
    "video[controls]",
    "iframe",
    "embed",
    "object",
    "area[href]",
    "summary"
].join(",");
// per suppressed element, the string its tabindex attribute held, or null when it had none - the distinction is
// what lets a restore leave no trace on an element the consumer never gave the attribute to
const elToOriginalTabIndex = new WeakMap();
// per item element, the descendants suppressed on its behalf - a restore walks this record rather than
// re-querying, so an element that has since moved (under a nested zone, say, which a fresh query skips)
// still gets its tabindex handed back instead of being stranded at -1
const itemToSuppressedDescendants = new WeakMap();
// the zones that currently hold suppressed descendants, so a zone leaving the group can undo its own work.
// weak, or an unmounted zone would be retained by this module for the life of the page
const dzsWithSuppressedDescendants = new WeakSet();

// a nested dndzone owns its items' tabindex, and its own action runs before this one - reaching inside would fight
// that owner and save a value it had not finished writing, so anything at or below a nested zone is left to it
function focusableDescendants(itemEl) {
    return Array.from(itemEl.querySelectorAll(FOCUSABLE_DESCENDANT_SELECTOR)).filter(el => {
        for (let cur = el; cur && cur !== itemEl; cur = cur.parentElement) {
            if (dzToConfig.has(cur) || allDragTargets.has(cur)) return false;
        }
        return true;
    });
}
function suppressFocusableDescendants(dropZoneEl, itemEl) {
    let suppressed = itemToSuppressedDescendants.get(itemEl);
    for (const el of focusableDescendants(itemEl)) {
        // configure() re-runs on every render, so re-read the consumer's value on every pass - unless it is the
        // "-1" we wrote ourselves, which must never become the value we restore to. That way a tabindex the
        // consumer changes while the item is inactive is picked up rather than being reverted on restore. The one
        // ambiguity left: a consumer that sets exactly "-1" itself while suppressed reads as our own write.
        const current = el.getAttribute("tabindex");
        if (current !== "-1") elToOriginalTabIndex.set(el, current);
        if (!suppressed) {
            suppressed = [];
            itemToSuppressedDescendants.set(itemEl, suppressed);
        }
        // a re-render suppresses the same elements again, and the record is a set of them, not a log
        if (!suppressed.includes(el)) suppressed.push(el);
        el.setAttribute("tabindex", "-1");
    }
    if (suppressed?.length) dzsWithSuppressedDescendants.add(dropZoneEl);
}
// Known limit: the record is per item, so an element the consumer moves OUT of its item while suppressed - a keyed
// re-render that reuses a node across items, a portal, a bare appendChild elsewhere - is only ever restored if that
// original item is restored, and never at all once the item unmounts. Detecting the move would take a
// MutationObserver over every item, which is not worth the cost; the element can be un-stranded by removing the
// tabindex the consumer never set, or by re-rendering it.
function restoreFocusableDescendants(itemEl) {
    const suppressed = itemToSuppressedDescendants.get(itemEl);
    if (!suppressed) return;
    itemToSuppressedDescendants.delete(itemEl);
    for (const el of suppressed) {
        if (!elToOriginalTabIndex.has(el)) continue;
        const original = elToOriginalTabIndex.get(el);
        if (original === null) el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", original);
        elToOriginalTabIndex.delete(el);
    }
}
// for the paths that take a whole zone out of the group - an update that changes the zone's type or sets
// dragDisabled, a setRovingTabindexTypes call that drops its type, and destroy
function restoreZoneDescendants(dropZoneEl) {
    if (!dzsWithSuppressedDescendants.delete(dropZoneEl)) return;
    for (const child of dropZoneEl.children) {
        restoreFocusableDescendants(child);
    }
}

function setRovingTabindex(type, activeEl) {
    for (const dz of zonesInRovingGroup(type)) {
        const cfg = dzToConfig.get(dz);
        const activeTabIndex = cfg ? cfg.zoneItemTabIndex : 0;
        for (const child of dz.children) {
            const isActive = child === activeEl;
            child.tabIndex = isActive ? activeTabIndex : -1;
            if (isActive) restoreFocusableDescendants(child);
            else suppressFocusableDescendants(dz, child);
        }
    }
}

// a nested zone's action is configured before its parent's, so on the very first render it cannot yet see the
// ancestor that keeps it out of the group, and it collapses its own items to one tab stop. The parent's pass is
// the first one able to see the nesting, so it is the one that hands those items back
function restoreNestedZonesOfType(type) {
    const dropZones = typeToDropZones.get(type);
    if (!dropZones) return;
    for (const dz of dropZones) {
        const config = dzToConfig.get(dz);
        if (!config || config.dragDisabled || !hasGroupedAncestor(dz)) continue;
        restoreZoneDescendants(dz);
        // the nested zone described itself as roving on that first pass too, for the same reason
        if (!config.autoAriaDisabled && INSTRUCTION_IDs) {
            dz.setAttribute("aria-describedby", INSTRUCTION_IDs.DND_ZONE_ACTIVE);
        }
        for (const child of dz.children) {
            child.tabIndex = config.zoneItemTabIndex;
        }
    }
}

// picks the item that holds a group's tab stop out of the zones currently in it, and applies it across them.
// Every path that changes the group's membership comes here, including the ones that take a zone *out* of a
// group - the tab stop may have been inside the departing zone, and the zones left behind would otherwise be
// stranded with every item at -1 and no keyboard-reachable item at all
function reassertRovingGroup(type) {
    const zones = zonesInRovingGroup(type);
    if (!zones.length) {
        // nothing is left to hold the stop, so drop the pointer rather than leave it aimed at a departed zone
        groupToActiveItem.delete(type);
        restoreNestedZonesOfType(type);
        return;
    }
    const previous = groupToActiveItem.get(type);
    // an item is a direct child of its zone, so this is also what rules out an item of a nested zone that is
    // inside a group member but not in the group itself
    const stillPresent = previous?.el && zones.includes(previous.el.parentElement);
    let active = stillPresent ? previous.el : null;
    if (!active && previous?.id != null) {
        // the node is gone (a keyed re-render replaced it, or its zone left) but the item may still be there
        for (const dz of zones) {
            const dzConfig = dzToConfig.get(dz);
            const idx = dzConfig?.items.findIndex(item => item[ITEM_ID_KEY] === previous.id);
            if (idx > -1 && dz.children[idx]) {
                active = dz.children[idx];
                break;
            }
        }
    }
    if (!active) {
        const firstZoneWithItems = zones.find(dz => dz.children.length > 0);
        active = firstZoneWithItems ? firstZoneWithItems.children[0] : null;
    }
    groupToActiveItem.set(type, {el: active, id: idForItem(active)});
    setRovingTabindex(type, active);
    restoreNestedZonesOfType(type);
}

function idForItem(el) {
    if (!el) return null;
    const zone = el.parentElement;
    const zoneConfig = dzToConfig.get(zone);
    if (!zoneConfig) return null;
    const idx = Array.from(zone.children).indexOf(el);
    return zoneConfig.items[idx]?.[ITEM_ID_KEY] ?? null;
}

// without this a detached node stays reachable from module scope and a later mount into the group inherits a stale id
function releaseActiveItem(dropZoneEl, type) {
    const active = groupToActiveItem.get(type);
    if (!active || (active.el && !dropZoneEl.contains(active.el))) return;
    groupToActiveItem.delete(type);
}

function focusItem(type, el) {
    if (!el) return;
    groupToActiveItem.set(type, {el, id: idForItem(el)});
    setRovingTabindex(type, el);
    el.focus();
}

function grabIsAlive() {
    const focusedConfig = dzToConfig.get(focusedDz);
    if (focusedConfig?.items.some(item => item[ITEM_ID_KEY] === focusedItemId)) return true;
    printDebug(() => "dragged item is gone, dropping");
    handleDrop();
    return false;
}

// tabbing to a zone and pressing an arrow at one are the same gesture from the item's point of view, so
// both arrive here rather than each growing its own notion of where the item lands
function relocateGrabbedItemTo(newlyFocusedDz) {
    if (!grabIsAlive()) return;

    focusedDzLabel = newlyFocusedDz.getAttribute("aria-label") || "";
    const {items: originItems} = dzToConfig.get(focusedDz);
    const originItem = originItems.find(item => item[ITEM_ID_KEY] === focusedItemId);
    const originIdx = originItems.indexOf(originItem);
    const itemToMove = originItems.splice(originIdx, 1)[0];
    const {items: targetItems, autoAriaDisabled} = dzToConfig.get(newlyFocusedDz);
    if (
        newlyFocusedDz.getBoundingClientRect().top < focusedDz.getBoundingClientRect().top ||
        newlyFocusedDz.getBoundingClientRect().left < focusedDz.getBoundingClientRect().left
    ) {
        targetItems.push(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader("movedToZoneEnd", {
                itemLabel: focusedItemLabel,
                zoneLabel: focusedDzLabel,
                position: targetItems.length,
                count: targetItems.length
            });
        }
    } else {
        targetItems.unshift(itemToMove);
        if (!autoAriaDisabled) {
            announceToScreenReader("movedToZoneStart", {
                itemLabel: focusedItemLabel,
                zoneLabel: focusedDzLabel,
                position: 1,
                count: targetItems.length
            });
        }
    }
    const dzFrom = focusedDz;
    const movedItemId = focusedItemId;
    focusedDz = newlyFocusedDz;
    dispatchFinalizeEvent(dzFrom, originItems, {trigger: TRIGGERS.DROPPED_INTO_ANOTHER, id: movedItemId, source: SOURCES.KEYBOARD});
    if (dzToConfig.has(newlyFocusedDz)) {
        dispatchFinalizeEvent(newlyFocusedDz, targetItems, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: movedItemId, source: SOURCES.KEYBOARD});
    }
}

function handleZoneFocus(e) {
    printDebug(() => "zone focus");
    if (!isDragging) return;
    const newlyFocusedDz = e.currentTarget;
    if (newlyFocusedDz === focusedDz) return;
    relocateGrabbedItemTo(newlyFocusedDz);
}

function triggerAllDzsUpdate() {
    dzToHandles.forEach(({update}, dz) => update(dzToConfig.get(dz)));
}
// a change to the roving types has to reach the zones that are already on the page: the newly roving ones collapse
// to a single tab stop, and the ones that just stopped being roving take the restore branch in configure()
onRovingTabindexTypesChanged(triggerAllDzsUpdate);

function handleDrop(dispatchConsider = true) {
    if (!isDragging || !focusedDz) return;
    printDebug(() => "drop");
    const droppedDz = focusedDz;
    const droppedConfig = dzToConfig.get(droppedDz);
    const droppedItemId = focusedItemId;
    const droppedItemType = draggedItemType;
    if (!droppedConfig) return;

    if (!droppedConfig.autoAriaDisabled) {
        // Include the destination and final position so localized messages can describe the completed drop.
        const droppedItems = droppedConfig.items;
        const droppedIdx = droppedItems.findIndex(item => item[ITEM_ID_KEY] === droppedItemId);
        announceToScreenReader("dropped", {
            itemLabel: focusedItemLabel,
            zoneLabel: focusedDzLabel,
            position: (droppedIdx < 0 ? 0 : droppedIdx) + 1,
            count: droppedItems.length
        });
    }
    if (allDragTargets.has(document.activeElement)) {
        document.activeElement.blur();
    }
    // Clear global drag state before dispatching. A synchronous handler may destroy the
    // focused zone, and unregisterDropZone must not recursively enter handleDrop.
    focusedItem = null;
    focusedItemId = null;
    focusedItemLabel = "";
    draggedItemType = null;
    focusedDz = null;
    focusedDzLabel = "";
    isDragging = false;

    if (dispatchConsider) {
        dispatchConsiderEvent(droppedDz, droppedConfig.items, {
            trigger: TRIGGERS.DRAG_STOPPED,
            id: droppedItemId,
            source: SOURCES.KEYBOARD
        });
    }
    const dropZones = typeToDropZones.get(droppedItemType);
    if (dropZones) {
        styleInactiveDropZones(
            dropZones,
            dz => dzToConfig.get(dz).dropTargetStyle,
            dz => dzToConfig.get(dz).dropTargetClasses
        );
    }
    triggerAllDzsUpdate();
}
//////
export function dndzone(node, options) {
    let destroyed = false;
    // the type the zone is currently filed under in typeToDropZones and groupToActiveItem. Kept apart from
    // config.type so that unregistering and releasing always name the type the entries were actually made under
    let registeredType;
    const config = {
        items: undefined,
        type: undefined,
        dragDisabled: false,
        zoneTabIndex: 0,
        zoneItemTabIndex: 0,
        dropFromOthersDisabled: false,
        dropTargetStyle: DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses: [],
        autoAriaDisabled: false
    };

    function swap(arr, i, j) {
        if (arr.length <= 1) return;
        arr.splice(j, 1, arr.splice(i, 1, arr[j])[0]);
    }

    function focusWithinZone(currentItem, dir) {
        const children = Array.from(node.children);
        const next = children.indexOf(currentItem) + dir;
        if (next >= 0 && next < children.length) focusItem(config.type, children[next]);
    }

    // these move the tab stop, not the item - carrying the grabbed item across is relocateInDirection's job.
    // the target always has items, since zoneInDirection skips zones with none to focus
    function focusInZone(currentItem, target) {
        const targetChildren = Array.from(target.children);
        const position = Array.from(node.children).indexOf(currentItem);
        focusItem(config.type, targetChildren[Math.min(position, targetChildren.length - 1)]);
    }

    function navigateAtRest(currentItem, direction) {
        const target = zoneInDirection(node, direction, zonesInRovingGroup(config.type));
        if (target) {
            focusInZone(currentItem, target);
            return;
        }
        focusWithinZone(currentItem, DIRECTION_STEP[direction]);
    }

    // the mirror of navigateAtRest for a live grab: an arrow means "go that way" whether it is carrying the
    // tab stop or the item, so a zone in that direction takes the item exactly as tabbing to it would. What
    // counts as a zone here is the drop rule Tab is already held to - the group is type-keyed, so what the
    // filter still rules out is a zone that refuses foreign items, the zone the item is already in, and a
    // nested zone inside the grabbed item. Any of those and the arrow falls back to reordering inside this one
    function relocateInDirection(direction) {
        if (!isGroupedZone(node)) return false;
        const candidates = zonesInRovingGroup(config.type).filter(dz => getActiveDragTabIndex(dz, dzToConfig.get(dz)) === 0);
        // the item is in focusedDz - the same zone as node in practice, but it is focusedDz that
        // relocateGrabbedItemTo splices the item out of, so measure the geometry from there
        const target = zoneInDirection(focusedDz || node, direction, candidates, {allowEmpty: true});
        if (!target) return false;
        relocateGrabbedItemTo(target);
        // true even when relocateGrabbedItemTo bailed on a grab whose item is gone (grabIsAlive() dropped it
        // instead): nothing was relocated, but the caller's fallback reorder is exactly what must not run now -
        // it would dispatch a finalize carrying a null item id
        return true;
    }

    function handleKeyDown(e) {
        printDebug(() => ["handling key down", e.key]);
        switch (e.key) {
            case "Enter":
            case " ": {
                // keys outside the configured trigger belong to the consumer - don't claim them in any way
                if (!isKeyboardDragTriggerKey(e.key)) {
                    return;
                }
                // we don't want to affect nested input elements or clickable elements
                if ((e.target.disabled !== undefined || e.target.href || e.target.isContentEditable) && !allDragTargets.has(e.target)) {
                    return;
                }
                e.preventDefault(); // preventing scrolling on spacebar
                e.stopPropagation();
                if (isDragging) {
                    // TODO - should this trigger a drop? only here or in general (as in when hitting space or enter outside of any zone)?
                    handleDrop();
                } else {
                    // drag start
                    handleDragStart(e);
                }
                break;
            }
            case "ArrowDown": {
                if (!isDragging) {
                    if (!isGroupedZone(node)) return;
                    if (isConsumerOwnedControl(e.target)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAtRest(e.currentTarget, "down");
                    return;
                }
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                if (relocateInDirection("down")) break;
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow down", idx]);
                if (idx < children.length - 1) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader("movedToPosition", {
                            itemLabel: focusedItemLabel,
                            zoneLabel: focusedDzLabel,
                            position: idx + 2,
                            count: items.length
                        });
                    }
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
            // this case's body is verbatim from when ArrowRight shared one with ArrowDown, hence "arrow down" in its printDebug
            case "ArrowRight": {
                if (!isDragging) {
                    if (!isGroupedZone(node)) return;
                    if (isConsumerOwnedControl(e.target)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAtRest(e.currentTarget, "right");
                    return;
                }
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                if (relocateInDirection("right")) break;
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow down", idx]);
                if (idx < children.length - 1) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader("movedToPosition", {
                            itemLabel: focusedItemLabel,
                            zoneLabel: focusedDzLabel,
                            position: idx + 2,
                            count: items.length
                        });
                    }
                    swap(items, idx, idx + 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
            case "ArrowUp": {
                if (!isDragging) {
                    if (!isGroupedZone(node)) return;
                    if (isConsumerOwnedControl(e.target)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAtRest(e.currentTarget, "up");
                    return;
                }
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                if (relocateInDirection("up")) break;
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow up", idx]);
                if (idx > 0) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader("movedToPosition", {
                            itemLabel: focusedItemLabel,
                            zoneLabel: focusedDzLabel,
                            position: idx,
                            count: items.length
                        });
                    }
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
            // this case's body is verbatim from when ArrowLeft shared one with ArrowUp, hence "arrow up" in its printDebug
            case "ArrowLeft": {
                if (!isDragging) {
                    if (!isGroupedZone(node)) return;
                    if (isConsumerOwnedControl(e.target)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    navigateAtRest(e.currentTarget, "left");
                    return;
                }
                e.preventDefault(); // prevent scrolling
                e.stopPropagation();
                if (relocateInDirection("left")) break;
                const {items} = dzToConfig.get(node);
                const children = Array.from(node.children);
                const idx = children.indexOf(e.currentTarget);
                printDebug(() => ["arrow up", idx]);
                if (idx > 0) {
                    if (!config.autoAriaDisabled) {
                        announceToScreenReader("movedToPosition", {
                            itemLabel: focusedItemLabel,
                            zoneLabel: focusedDzLabel,
                            position: idx,
                            count: items.length
                        });
                    }
                    swap(items, idx, idx - 1);
                    dispatchFinalizeEvent(node, items, {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: focusedItemId, source: SOURCES.KEYBOARD});
                }
                break;
            }
        }
    }
    function handleDragStart(e) {
        printDebug(() => "drag start");
        setCurrentFocusedItem(e.currentTarget);
        focusedDz = node;
        focusedDzLabel = node.getAttribute("aria-label") || "";
        draggedItemType = config.type;
        isDragging = true;
        const dropTargets = Array.from(typeToDropZones.get(config.type)).filter(dz => dz === focusedDz || !dzToConfig.get(dz).dropFromOthersDisabled);
        styleActiveDropZones(
            dropTargets,
            dz => dzToConfig.get(dz).dropTargetStyle,
            dz => dzToConfig.get(dz).dropTargetClasses
        );
        if (!config.autoAriaDisabled) {
            // Include the starting position so localized messages can describe where the item was picked up.
            const startItems = dzToConfig.get(node).items;
            const startIdx = startItems.findIndex(item => item[ITEM_ID_KEY] === focusedItemId);
            announceToScreenReader("dragStarted", {
                itemLabel: focusedItemLabel,
                zoneLabel: focusedDzLabel,
                position: (startIdx < 0 ? 0 : startIdx) + 1,
                count: startItems.length,
                canMoveBetweenZones: dropTargets.length > 1,
                // in a roving group the arrows carry the item into the zone in their direction, so the default
                // wording promises more than "within its list" - but only where there is another zone to move to
                canMoveBetweenZonesWithArrows: dropTargets.length > 1 && isGroupedZone(node)
            });
        }
        dispatchConsiderEvent(node, dzToConfig.get(node).items, {trigger: TRIGGERS.DRAG_STARTED, id: focusedItemId, source: SOURCES.KEYBOARD});
        triggerAllDzsUpdate();
    }

    function handleClick(e) {
        if (!isDragging) return;
        if (e.currentTarget === focusedItem) return;
        e.stopPropagation();
        handleDrop(false);
        handleDragStart(e);
    }
    function setCurrentFocusedItem(draggableEl) {
        const {items} = dzToConfig.get(node);
        const children = Array.from(node.children);
        const focusedItemIdx = children.indexOf(draggableEl);
        focusedItem = draggableEl;
        focusedItem.tabIndex = config.zoneItemTabIndex;
        focusedItemId = items[focusedItemIdx][ITEM_ID_KEY];
        focusedItemLabel = children[focusedItemIdx].getAttribute("aria-label") || "";
    }

    function configure({
        items = [],
        type: newType = DEFAULT_DROP_ZONE_TYPE,
        dragDisabled = false,
        zoneTabIndex = 0,
        zoneItemTabIndex = 0,
        dropFromOthersDisabled = false,
        dropTargetStyle = DEFAULT_DROP_TARGET_STYLE,
        dropTargetClasses = [],
        autoAriaDisabled = false
    }) {
        config.items = [...items];
        config.dragDisabled = dragDisabled;
        config.dropFromOthersDisabled = dropFromOthersDisabled;
        config.zoneTabIndex = zoneTabIndex;
        config.zoneItemTabIndex = zoneItemTabIndex;
        config.dropTargetStyle = dropTargetStyle;
        config.dropTargetClasses = dropTargetClasses;
        config.autoAriaDisabled = autoAriaDisabled;
        // the entry is filed under the type the zone was registered under, so it has to be released against that
        // one - releasing against the new type later would leave the old group holding a node that is now
        // somewhere else, or detached, and a stale id able to resurrect the stop onto an unrelated zone
        const leftType = config.type && newType !== config.type ? config.type : null;
        if (leftType) {
            unregisterDropZone(node, leftType);
            releaseActiveItem(node, leftType);
        }
        config.type = newType;
        registeredType = newType;
        registerDropZone(node, newType);
        dzToConfig.set(node, config);
        if (!autoAriaDisabled) {
            node.setAttribute("role", "list");
            // isGroupedZone reads this zone's config, so this has to come after the set above. A grouped zone is
            // navigated by the arrows rather than by tabbing to each item, so it points at its own instruction -
            // and a setRovingTabindexTypes call re-runs configure() for every zone, which is what flips it back
            node.setAttribute(
                "aria-describedby",
                dragDisabled
                    ? INSTRUCTION_IDs.DND_ZONE_DRAG_DISABLED
                    : isGroupedZone(node)
                    ? INSTRUCTION_IDs.DND_ZONE_ACTIVE_ROVING
                    : INSTRUCTION_IDs.DND_ZONE_ACTIVE
            );
        }

        let itemMovedToThisZone = false;
        if (isDragging) {
            itemMovedToThisZone =
                config.type === draggedItemType && config.items.some(item => item[ITEM_ID_KEY] === focusedItemId) && node !== focusedDz;
            if (itemMovedToThisZone) {
                focusedDz = node;
                focusedDzLabel = node.getAttribute("aria-label") || "";
            }
            node.tabIndex = getActiveDragTabIndex(node, config);
        } else {
            node.tabIndex = config.zoneTabIndex;
        }

        node.addEventListener("focus", handleZoneFocus);

        for (let i = 0; i < node.children.length; i++) {
            const draggableEl = node.children[i];
            allDragTargets.add(draggableEl);
            // in a roving group the tab stop is assigned group-wide after this loop, so default to -1 here
            draggableEl.tabIndex = isDragging || isGroupedZone(node) ? -1 : config.zoneItemTabIndex;
            if (!autoAriaDisabled) {
                draggableEl.setAttribute("role", "listitem");
            }
            draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl));
            draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl));
            if (!dragDisabled) {
                draggableEl.addEventListener("keydown", handleKeyDown);
                elToKeyDownListeners.set(draggableEl, handleKeyDown);
                draggableEl.addEventListener("click", handleClick);
                elToFocusListeners.set(draggableEl, handleClick);
            }
            const isGrabbedItem = isDragging && config.type === draggedItemType && config.items[i]?.[ITEM_ID_KEY] === focusedItemId;
            if (isDragging && isGroupedZone(node)) {
                // mid-grab the grabbed item is the group's active one, and Tab is meant to walk zones from here - so the
                // other items' widgets stay out of the way exactly as they are at rest, rather than catching that Tab
                if (isGrabbedItem) restoreFocusableDescendants(draggableEl);
                else suppressFocusableDescendants(node, draggableEl);
            }
            if (isGrabbedItem) {
                printDebug(() => ["focusing on", {i, focusedItemId}]);
                // if it is a nested dropzone, it was re-rendered and we need to refresh our pointer
                focusedItem = draggableEl;
                // the grabbed item is also the group's tab stop, so keep the pointer on its node while the grab is live
                if (isGroupedZone(node)) {
                    groupToActiveItem.set(config.type, {el: draggableEl, id: focusedItemId});
                }
                focusedItem.tabIndex = config.zoneItemTabIndex;
                // without this the element loses focus if it moves backwards in the list
                draggableEl.focus();
            }
        }
        if (!isDragging && isGroupedZone(node)) {
            reassertRovingGroup(config.type);
        } else if (!isGroupedZone(node)) {
            // the zone is not in a group - either it never was, or it just left one: its type stopped being roving,
            // its type changed, dragDisabled was turned on, or a zone of the same type now encloses it. Nothing else
            // will ever come back for the descendants it suppressed, so they would stay untabbable for good
            restoreZoneDescendants(node);
            // and if it just left, the group it left still needs an item tab stop among whatever is left of it
            if (!isDragging) reassertRovingGroup(config.type);
        }
        // a type change moves the zone between two groups, so the one it left has to be re-asserted as well
        if (leftType && !isDragging) reassertRovingGroup(leftType);
        if (itemMovedToThisZone) {
            // Nested actions are configured before their parent action. Refresh only
            // after focusedItem points at the replacement so nested zones stay untabbable.
            refreshActiveDragTabIndices();
        }
    }
    configure(options);

    const handles = {
        update: newOptions => {
            printDebug(() => `keyboard dndzone will update newOptions: ${toString(newOptions)}`);
            configure(newOptions);
        },
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            printDebug(() => "keyboard dndzone will destroy");
            node.removeEventListener("focus", handleZoneFocus);
            for (const draggableEl of node.children) {
                draggableEl.removeEventListener("keydown", elToKeyDownListeners.get(draggableEl));
                draggableEl.removeEventListener("click", elToFocusListeners.get(draggableEl));
            }
            const departingType = registeredType;
            unregisterDropZone(node, departingType);
            releaseActiveItem(node, departingType);
            dzToConfig.delete(node);
            dzToHandles.delete(node);
            // the zone is going away, so nothing is left to hand the tab order back later. This has to come last:
            // unmounting mid-grab makes unregisterDropZone end the grab, and the re-render that follows re-enters
            // configure() on this dying zone and would suppress everything again behind an earlier restore.
            // Safe here because the restore only walks what was recorded at suppression time - it needs neither
            // this zone's config nor its registration
            restoreZoneDescendants(node);
            // the tab stop may have been inside this zone, and nothing else re-asserts the group it has left -
            // the zones still in it would keep every item at -1 until some unrelated re-render happened to fix it
            if (!isDragging) reassertRovingGroup(departingType);
        }
    };
    dzToHandles.set(node, handles);
    return handles;
}
