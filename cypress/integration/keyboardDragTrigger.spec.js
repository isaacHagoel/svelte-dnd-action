import {dndzone} from "../../src/keyboardAction";
import {dndzone as fullDndzone} from "../../src/action";
import {TRIGGERS} from "../../src/constants";
import {dragHandle, dragHandleZone} from "../../src/wrappers/withDragHandles";

describe("keyboardDragTrigger", () => {
    const actions = [];
    const zones = [];

    function createZone(items, options = {}, dndzoneFn = dndzone) {
        const zone = document.createElement("div");
        items.forEach(() => zone.appendChild(document.createElement("div")));
        document.body.appendChild(zone);
        zones.push(zone);
        const action = dndzoneFn(zone, {items, ...options});
        actions.push(action);
        return {zone, action, children: Array.from(zone.children)};
    }

    function press(el, key) {
        const event = new KeyboardEvent("keydown", {key, bubbles: true, cancelable: true});
        el.dispatchEvent(event);
        return event;
    }

    function recordTriggers(zone) {
        const triggers = [];
        zone.addEventListener("consider", e => triggers.push(e.detail.info.trigger));
        return triggers;
    }

    afterEach(() => {
        actions
            .splice(0)
            .reverse()
            .forEach(action => action.destroy());
        zones.splice(0).forEach(zone => zone.remove());
    });

    describe("zone behaviour", () => {
        [undefined, "space_or_enter"].forEach(trigger => {
            it(`starts and stops a drag with both Enter and Space (trigger: ${trigger})`, () => {
                const options = trigger === undefined ? {} : {keyboardDragTrigger: trigger};
                const {
                    zone,
                    children: [item]
                } = createZone([{id: "a"}, {id: "b"}], options);
                const triggers = recordTriggers(zone);
                item.focus();
                press(item, "Enter");
                expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
                press(item, " ");
                expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
            });
        });

        it("leaves Enter completely untouched at rest when the trigger is 'space'", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {keyboardDragTrigger: "space"});
            const triggers = recordTriggers(zone);
            let bubbledEvent;
            const bodyListener = e => (bubbledEvent = e);
            document.body.addEventListener("keydown", bodyListener);
            item.focus();
            const event = press(item, "Enter");
            document.body.removeEventListener("keydown", bodyListener);
            expect(triggers).to.deep.equal([]);
            expect(event.defaultPrevented).to.equal(false);
            expect(bubbledEvent, "the event should propagate past the zone").to.equal(event);
        });

        it("still starts and stops a drag with Space when the trigger is 'space'", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {keyboardDragTrigger: "space"});
            const triggers = recordTriggers(zone);
            item.focus();
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        });

        it("does not let Enter stop a drag when the trigger is 'space'", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {keyboardDragTrigger: "space"});
            const triggers = recordTriggers(zone);
            item.focus();
            press(item, " ");
            let bubbledEvent;
            const bodyListener = e => (bubbledEvent = e);
            document.body.addEventListener("keydown", bodyListener);
            const enterEvent = press(item, "Enter");
            document.body.removeEventListener("keydown", bodyListener);
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            expect(enterEvent.defaultPrevented).to.equal(false);
            expect(bubbledEvent, "the event should propagate past the zone").to.equal(enterEvent);
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        });

        it("leaves Space untouched and lets Enter drive the drag when the trigger is 'enter'", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {keyboardDragTrigger: "enter"});
            const triggers = recordTriggers(zone);
            item.focus();
            const spaceEvent = press(item, " ");
            expect(triggers).to.deep.equal([]);
            expect(spaceEvent.defaultPrevented).to.equal(false);
            press(item, "Enter");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            press(item, "Enter");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        });

        it("applies keyboardDragTrigger changes made through update", () => {
            const {
                zone,
                action,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const triggers = recordTriggers(zone);
            action.update({items: [{id: "a"}, {id: "b"}], keyboardDragTrigger: "space"});
            item.focus();
            press(item, "Enter");
            expect(triggers).to.deep.equal([]);
            action.update({items: [{id: "a"}, {id: "b"}]});
            press(item, "Enter");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        });
    });

    describe("option validation", () => {
        it("rejects a value that is not one of the documented strings", () => {
            const zone = document.createElement("div");
            document.body.appendChild(zone);
            zones.push(zone);
            expect(() => fullDndzone(zone, {items: [], keyboardDragTrigger: "shift"})).to.throw("keyboardDragTrigger");
            expect(() => fullDndzone(zone, {items: [], keyboardDragTrigger: "constructor"})).to.throw("keyboardDragTrigger");
        });

        it("accepts every documented value without warning about unknown options", () => {
            const originalWarn = console.warn;
            const warnings = [];
            console.warn = (...args) => warnings.push(args);
            try {
                ["space", "enter", "space_or_enter", undefined].forEach(keyboardDragTrigger => {
                    createZone([], {keyboardDragTrigger}, fullDndzone);
                });
            } finally {
                console.warn = originalWarn;
            }
            expect(warnings).to.deep.equal([]);
        });
    });

    describe("dragHandle unlock", () => {
        function createHandleZone(options = {}) {
            const zone = document.createElement("div");
            const item = document.createElement("div");
            const handle = document.createElement("div");
            item.appendChild(handle);
            zone.appendChild(item);
            document.body.appendChild(zone);
            zones.push(zone);
            const zoneAction = dragHandleZone(zone, {items: [{id: "a"}], ...options});
            const handleAction = dragHandle(handle);
            actions.push(handleAction, zoneAction);
            return {zone, item, handle, zoneAction};
        }

        it("ignores Enter on the handle when the zone's trigger is 'space'", () => {
            const {handle} = createHandleZone({keyboardDragTrigger: "space"});
            expect(handle.style.cursor).to.equal("grab");
            press(handle, "Enter");
            expect(handle.style.cursor, "Enter should not unlock dragging").to.equal("grab");
            press(handle, " "); // unlocks and, as it bubbles to the item, starts the drag
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, " "); // drops; the zone's consider handler re-locks
            expect(handle.style.cursor).to.equal("grab");
        });

        it("unlocks dragging from Enter on the handle by default", () => {
            const {handle} = createHandleZone();
            press(handle, "Enter");
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, "Enter");
            expect(handle.style.cursor).to.equal("grab");
        });

        it("does not corrupt the shared trigger when a zone with an invalid trigger throws", () => {
            const {handle} = createHandleZone({keyboardDragTrigger: "space"});
            const badZone = document.createElement("div");
            document.body.appendChild(badZone);
            zones.push(badZone);
            expect(() => dragHandleZone(badZone, {items: [], keyboardDragTrigger: "shift"})).to.throw("keyboardDragTrigger");
            press(handle, " "); // the valid zone's handle must still work, not TypeError
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, " ");
            expect(handle.style.cursor).to.equal("grab");
        });

        it("applies a trigger change made through update to the handle unlock", () => {
            const {handle, zoneAction} = createHandleZone();
            zoneAction.update({items: [{id: "a"}], keyboardDragTrigger: "space"});
            press(handle, "Enter");
            expect(handle.style.cursor, "Enter should no longer unlock dragging").to.equal("grab");
            press(handle, " ");
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, " ");
            expect(handle.style.cursor).to.equal("grab");
        });
    });
});
