import {dndzone} from "../../src/keyboardAction";
import {dndzone as fullDndzone} from "../../src/action";
import {TRIGGERS} from "../../src/constants";
import {dragHandle, dragHandleZone} from "../../src/wrappers/withDragHandles";
import {getKeyboardDragTrigger, isKeyboardDragTriggerKey, setKeyboardDragTrigger} from "../../src/keyboardDragTrigger";
import * as publicApi from "../../src/index";
import {destroyAria, initAria} from "../../src/helpers/aria";

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

    afterEach(() => {
        setKeyboardDragTrigger(null);
    });

    describe("zone behaviour", () => {
        it("starts and stops a drag with both Enter and Space by default", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const triggers = recordTriggers(zone);
            item.focus();
            press(item, "Enter");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        });

        it("leaves Enter completely untouched at rest when the trigger is 'space'", () => {
            setKeyboardDragTrigger("space");
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
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
            setKeyboardDragTrigger("space");
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const triggers = recordTriggers(zone);
            item.focus();
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            press(item, " ");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        });

        it("does not let Enter stop a drag when the trigger is 'space'", () => {
            setKeyboardDragTrigger("space");
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
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
            setKeyboardDragTrigger("enter");
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
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

        it("ends a drag on Escape under every trigger", () => {
            ["space", "enter", "space_or_enter"].forEach(trigger => {
                setKeyboardDragTrigger(trigger);
                const {
                    zone,
                    children: [item]
                } = createZone([{id: "a"}, {id: "b"}]);
                const triggers = recordTriggers(zone);
                item.focus();
                press(item, trigger === "enter" ? "Enter" : " ");
                expect(triggers, `${trigger}: should have started`).to.deep.equal([TRIGGERS.DRAG_STARTED]);
                press(item, "Escape");
                expect(triggers, `${trigger}: Escape should still drop`).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
            });
        });

        it("applies a trigger change made after the zones have mounted", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const triggers = recordTriggers(zone);
            setKeyboardDragTrigger("space");
            item.focus();
            press(item, "Enter");
            expect(triggers, "a live zone should follow the new trigger without an update() call").to.deep.equal([]);
            setKeyboardDragTrigger(null);
            press(item, "Enter");
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        });

        it("keeps the configured trigger for an item a consumer moves into another zone", () => {
            setKeyboardDragTrigger("space");
            const {
                zone: zoneA,
                action: actionA,
                children: [itemA]
            } = createZone([{id: "a"}, {id: "b"}]);
            const {zone: zoneB, action: actionB} = createZone([]);
            const triggersB = recordTriggers(zoneB);

            itemA.focus();
            press(itemA, " ");

            // simulate a consumer's finalize handler moving the grabbed item into zoneB
            zoneA.removeChild(itemA);
            zoneB.appendChild(itemA);
            actionA.update({items: [{id: "b"}]});
            actionB.update({items: [{id: "a"}]});

            expect(document.activeElement, "should keep the moved item focused").to.equal(itemA);

            let bubbledEvent;
            const bodyListener = e => (bubbledEvent = e);
            document.body.addEventListener("keydown", bodyListener);
            const enterEvent = press(itemA, "Enter");
            document.body.removeEventListener("keydown", bodyListener);
            expect(triggersB, "Enter should still be left untouched in the new zone").to.deep.equal([]);
            expect(enterEvent.defaultPrevented).to.equal(false);
            expect(bubbledEvent, "the event should propagate past the new zone").to.equal(enterEvent);

            press(itemA, " ");
            expect(triggersB, "Space should still drop the item in the new zone").to.deep.equal([TRIGGERS.DRAG_STOPPED]);
        });

        it("no longer accepts keyboardDragTrigger as a zone option", () => {
            // validateOptions warns as `console.warn("dndzone will ignore unknown options", rest)`,
            // so the option name is a key of the second argument, not part of the message string.
            const originalWarn = console.warn;
            const warnings = [];
            console.warn = (...args) => warnings.push(args);
            try {
                createZone([], {keyboardDragTrigger: "space"}, fullDndzone);
            } finally {
                console.warn = originalWarn;
            }
            const ignoredOptions = warnings.flatMap(args => Object.keys(args[1] || {}));
            expect(ignoredOptions, "the option should be gone, not silently honoured").to.contain("keyboardDragTrigger");
        });
    });

    describe("setKeyboardDragTrigger", () => {
        it("defaults to space_or_enter", () => {
            expect(getKeyboardDragTrigger()).to.equal("space_or_enter");
            expect(isKeyboardDragTriggerKey(" ")).to.equal(true);
            expect(isKeyboardDragTriggerKey("Enter")).to.equal(true);
        });

        it("narrows the keys it claims to the configured trigger", () => {
            setKeyboardDragTrigger("space");
            expect(getKeyboardDragTrigger()).to.equal("space");
            expect(isKeyboardDragTriggerKey(" ")).to.equal(true);
            expect(isKeyboardDragTriggerKey("Enter")).to.equal(false);

            setKeyboardDragTrigger("enter");
            expect(isKeyboardDragTriggerKey(" ")).to.equal(false);
            expect(isKeyboardDragTriggerKey("Enter")).to.equal(true);
        });

        it("never claims a key outside the trigger vocabulary", () => {
            setKeyboardDragTrigger("space_or_enter");
            expect(isKeyboardDragTriggerKey("Escape")).to.equal(false);
            expect(isKeyboardDragTriggerKey("ArrowDown")).to.equal(false);
        });

        it("restores the default when passed null or undefined", () => {
            setKeyboardDragTrigger("enter");
            setKeyboardDragTrigger(null);
            expect(getKeyboardDragTrigger()).to.equal("space_or_enter");

            setKeyboardDragTrigger("enter");
            setKeyboardDragTrigger(undefined);
            expect(getKeyboardDragTrigger()).to.equal("space_or_enter");
        });

        it("rejects values that are not one of the documented strings", () => {
            // Cypress 15.18.1 does not match RegExp error assertions reliably, so compare substrings.
            expect(() => setKeyboardDragTrigger("shift")).to.throw("setKeyboardDragTrigger");
            expect(() => setKeyboardDragTrigger("shift")).to.throw("space_or_enter");
            expect(() => setKeyboardDragTrigger("SPACE")).to.throw("setKeyboardDragTrigger");
            expect(() => setKeyboardDragTrigger(0)).to.throw("setKeyboardDragTrigger");
            expect(() => setKeyboardDragTrigger({})).to.throw("setKeyboardDragTrigger");
        });

        it("rejects prototype key names rather than treating them as valid triggers", () => {
            expect(() => setKeyboardDragTrigger("constructor")).to.throw("setKeyboardDragTrigger");
            expect(() => setKeyboardDragTrigger("toString")).to.throw("setKeyboardDragTrigger");
        });

        it("leaves the active trigger untouched when a call fails validation", () => {
            setKeyboardDragTrigger("space");
            expect(() => setKeyboardDragTrigger("shift")).to.throw("setKeyboardDragTrigger");
            expect(getKeyboardDragTrigger()).to.equal("space");
        });

        it("is exported from the package entry point", () => {
            // guards against the module existing but never being re-exported
            expect(publicApi.setKeyboardDragTrigger).to.equal(setKeyboardDragTrigger);
        });

        it("updates the rendered screen-reader instruction", () => {
            initAria();
            try {
                setKeyboardDragTrigger("space");
                expect(document.getElementById("dnd-zone-active").textContent).to.equal(
                    "Tab to one the items and press space-bar to start dragging it"
                );
            } finally {
                destroyAria();
            }
        });

        it("renders the instruction for a trigger set before initAria", () => {
            // initAriaOnBrowser is a distinct formatting path from the setKeyboardDragTrigger re-render -
            // make sure the trigger already in effect at init time is picked up too.
            setKeyboardDragTrigger("space");
            initAria();
            try {
                expect(document.getElementById("dnd-zone-active").textContent).to.equal(
                    "Tab to one the items and press space-bar to start dragging it"
                );
            } finally {
                destroyAria();
            }
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

        it("unlocks dragging from Enter on the handle by default", () => {
            const {handle} = createHandleZone();
            press(handle, "Enter");
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, "Enter");
            expect(handle.style.cursor).to.equal("grab");
        });

        it("ignores Enter on the handle when the trigger is 'space'", () => {
            setKeyboardDragTrigger("space");
            const {handle} = createHandleZone();
            expect(handle.style.cursor).to.equal("grab");
            press(handle, "Enter");
            expect(handle.style.cursor, "Enter should not unlock dragging").to.equal("grab");
            press(handle, " "); // unlocks and, as it bubbles to the item, starts the drag
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, " "); // drops; the zone's consider handler re-locks
            expect(handle.style.cursor).to.equal("grab");
        });

        it("applies the same trigger to every handle zone on the page", () => {
            // the per-zone version got this wrong: the last configured zone won for all handles
            setKeyboardDragTrigger("space");
            const first = createHandleZone();
            const second = createHandleZone();
            [first, second].forEach(({handle}, i) => {
                press(handle, "Enter");
                expect(handle.style.cursor, `handle ${i} should ignore Enter`).to.equal("grab");
                press(handle, " ");
                expect(handle.style.cursor, `handle ${i} should unlock on Space`).to.equal("grabbing");
                press(handle, " ");
                expect(handle.style.cursor).to.equal("grab");
            });
        });

        it("follows a trigger change made after the handles have mounted", () => {
            const {handle} = createHandleZone();
            setKeyboardDragTrigger("space");
            press(handle, "Enter");
            expect(handle.style.cursor, "Enter should no longer unlock dragging").to.equal("grab");
            press(handle, " ");
            expect(handle.style.cursor).to.equal("grabbing");
            press(handle, " ");
            expect(handle.style.cursor).to.equal("grab");
        });
    });
});
