import {SOURCES, TRIGGERS} from "../../src/constants";
import {setAriaStrings} from "../../src/helpers/aria";
import {dragHandle, dragHandleZone} from "../../src/wrappers/withDragHandles";
import {alertText, createFrame, createList, failOnListenerErrors, key} from "./helpers/otherWindow";

failOnListenerErrors();

describe("keyboard arrow ownership", () => {
    const cleanups = [];
    afterEach(() =>
        cleanups
            .splice(0)
            .reverse()
            .forEach(cleanup => cleanup())
    );
    afterEach(() => setAriaStrings(null));

    function list(doc, options) {
        const created = createList(doc, options);
        cleanups.push(() => {
            created.action.destroy();
            created.zone.remove();
        });
        return created;
    }
    function grab(created, name) {
        created.element(name).focus();
        key(created.element(name), "Enter");
    }
    function press(target, arrow) {
        const event = new target.ownerDocument.defaultView.KeyboardEvent("keydown", {key: arrow, bubbles: true, cancelable: true});
        target.dispatchEvent(event);
        return event;
    }
    function expectUnclaimed(target, arrow) {
        let bubbledEvent;
        const onKeyDown = event => {
            bubbledEvent = event;
        };
        const body = target.ownerDocument.body;
        body.addEventListener("keydown", onKeyDown);
        let event;
        try {
            event = press(target, arrow);
        } finally {
            body.removeEventListener("keydown", onKeyDown);
        }
        expect(event.defaultPrevented, "the control keeps its default key behaviour").to.equal(false);
        expect(bubbledEvent, "the key can reach consumer handlers outside the item").to.equal(event);
    }

    ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].forEach(arrow => {
        [
            {where: "same list"},
            {where: "other type"},
            {where: "incoming disabled"},
            {where: "other document"},
            {where: "same list", direct: true},
            {where: "other document", direct: true}
        ].forEach(({where, direct = false}) => {
            it(`does not claim ${arrow} from ${direct ? "an ungrabbed item" : "a button in another item"} (${where})`, () => {
                const source = list(document, {label: "Source", names: ["a", "b", "c"], type: "cards"});
                let target = source;
                if (where !== "same list") {
                    let doc = document;
                    if (where === "other document") {
                        const frame = createFrame();
                        cleanups.push(() => frame.frame.remove());
                        doc = frame.doc;
                    }
                    target = list(doc, {
                        label: "Target",
                        names: ["x", "y", "z"],
                        type: where === "other type" ? "other" : "cards",
                        dropFromOthersDisabled: where === "incoming disabled"
                    });
                }
                grab(source, "b");
                const sourceNames = source.names();
                const targetNames = target.names();
                const announcement = alertText(document);
                const targetAnnouncement = alertText(target.doc);
                const sourceEvents = source.events.length;
                const targetEvents = target.events.length;
                const itemName = target === source ? (arrow === "ArrowUp" || arrow === "ArrowLeft" ? "c" : "a") : "y";
                const otherItem = target.element(itemName);
                const eventTarget = direct ? otherItem : target.doc.createElement("button");
                if (!direct) otherItem.appendChild(eventTarget);
                expect(eventTarget.tabIndex, "only native controls remain in the tab order during a grab").to.equal(direct ? -1 : 0);
                eventTarget.focus();
                expectUnclaimed(eventTarget, arrow);
                expect(source.names()).to.deep.equal(sourceNames);
                expect(target.names()).to.deep.equal(targetNames);
                expect(source.events).to.have.length(sourceEvents);
                expect(target.events).to.have.length(targetEvents);
                expect(alertText(document)).to.equal(announcement);
                expect(alertText(target.doc)).to.equal(targetAnnouncement);
            });
        });

        it(`still reorders the grabbed item with ${arrow} after transferring to another list`, () => {
            const source = list(document, {label: "Source", names: ["a", "b", "c"]});
            const target = list(document, {label: "Target", names: ["x", "y"]});
            grab(source, "b");
            target.zone.focus();
            const item = target.element("b");
            expect(document.activeElement).to.equal(item);
            // Put the transferred item in the middle so all four directions can move it.
            if (target.names()[0] === "b") press(item, "ArrowDown");
            else press(item, "ArrowUp");
            const event = press(item, arrow);
            expect(event.defaultPrevented).to.equal(true);
            expect(source.names()).to.deep.equal(["a", "c"]);
            expect(target.names()).to.deep.equal(arrow === "ArrowUp" || arrow === "ArrowLeft" ? ["b", "x", "y"] : ["x", "y", "b"]);
            const last = target.events[target.events.length - 1];
            expect(last.detail.info).to.deep.equal({trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "b", source: SOURCES.KEYBOARD});
        });

        it(`does not continue ${arrow} in the old list when an announcement moves the grab`, () => {
            const source = list(document, {label: "Source", names: ["a", "b", "c"]});
            const target = list(document, {label: "Target", names: ["x", "y"]});
            setAriaStrings({
                movedToPosition: () => {
                    target.zone.focus();
                    return "Moved";
                }
            });
            grab(source, "b");
            press(source.element("b"), arrow);
            expect(source.names()).to.deep.equal(["a", "c"]);
            expect(target.names()).to.include("b");
            expect(source.events.filter(event => event.type === "finalize").map(event => event.detail.info.trigger)).to.deep.equal([
                TRIGGERS.DROPPED_INTO_ANOTHER
            ]);
        });
    });

    ["button", "input", "select", "a", "contenteditable"].forEach(kind => {
        it(`leaves arrow keys to a nested ${kind} inside the grabbed item`, () => {
            const source = list(document, {label: "Source", names: ["a", "b", "c"]});
            const control = document.createElement(kind === "contenteditable" ? "span" : kind);
            if (kind === "a") control.href = "#";
            if (kind === "contenteditable") control.contentEditable = "true";
            source.element("b").appendChild(control);
            grab(source, "b");
            const announcement = alertText(document);
            control.focus();
            expectUnclaimed(control, "ArrowDown");
            expectUnclaimed(control, "ArrowUp");
            expect(source.names()).to.deep.equal(["a", "b", "c"]);
            expect(source.events).to.have.length(1);
            expect(alertText(document)).to.equal(announcement);
        });
    });

    it("reorders the focused item after pickup from a nested drag handle", () => {
        const zone = document.createElement("div");
        const first = document.createElement("div");
        const second = document.createElement("div");
        const handle = document.createElement("div");
        first.appendChild(handle);
        zone.append(first, second);
        document.body.appendChild(zone);
        const zoneAction = dragHandleZone(zone, {items: [{id: "a"}, {id: "b"}]});
        const handleAction = dragHandle(handle);
        cleanups.push(() => {
            zoneAction.destroy();
            handleAction.destroy();
            zone.remove();
        });
        const finalized = [];
        zone.addEventListener("finalize", event => finalized.push(event.detail));
        handle.focus();
        key(handle, "Enter");
        expect(document.activeElement).to.equal(first);
        expect(press(document.activeElement, "ArrowDown").defaultPrevented).to.equal(true);
        expect(finalized).to.have.length(1);
        expect(finalized[0].items.map(item => item.id)).to.deep.equal(["b", "a"]);
        expect(finalized[0].info.id).to.equal("a");
    });
});
