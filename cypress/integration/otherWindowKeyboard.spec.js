import {dndzone} from "../../src/action";
import {TRIGGERS} from "../../src/constants";
import {alertToScreenReader, destroyAria, setAriaStrings} from "../../src/helpers/aria";
import {alertText, createFrame, createList, failOnListenerErrors, key, openPopup, trackListeners} from "./helpers/otherWindow";

failOnListenerErrors();

const STARTED_IN_PARENT = "Started dragging item p1. Use the arrow keys to move it within its list Parent";
const MOVE_BETWEEN_LISTS = ", or tab to another list in order to move the item into it";
const ACTIVE_INSTRUCTION_ID = "dnd-zone-active";
const at = top => ({position: "fixed", left: "0", top});
const last = list => list.triggers[list.triggers.length - 1];

// A parent-loaded library can serve several documents, but each keyboard drag has document-local destinations,
// just like pointer dragging. Focus crossing an iframe or popup boundary must not transfer the item.
describe("keyboard drags stay within their document", () => {
    const cleanups = [];
    afterEach(() =>
        cleanups
            .splice(0)
            .reverse()
            .forEach(cleanup => cleanup())
    );

    function list(doc, options) {
        const created = createList(doc, options);
        cleanups.push(() => created.action.destroy());
        return created;
    }
    function frame(options) {
        const created = createFrame(options);
        cleanups.push(() => created.frame.remove());
        return created;
    }
    function popup(test) {
        const created = openPopup(test);
        cleanups.push(() => created.win.close());
        return created;
    }
    function grab(created, name) {
        const el = created.element(name);
        el.focus();
        key(el, "Enter");
    }

    function parentAndFrameLists() {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"], style: at("50px")});
        const {doc, win} = frame({style: at("300px")});
        const frameList = list(doc, {label: "Frame", names: ["f1", "f2"], style: {marginTop: "10px"}});
        return {parentList, frameList, doc, win};
    }

    it("does not transfer a parent item into an iframe, and can still reorder in the parent", () => {
        const {parentList, frameList, doc} = parentAndFrameLists();
        grab(parentList, "p1");
        expect(alertText(document), "should not promise a destination in another document").to.equal(STARTED_IN_PARENT);
        expect(frameList.zone.tabIndex, "the iframe list is not a destination").to.equal(-1);
        expect(frameList.zone.style.outline).to.equal("");

        frameList.zone.focus();
        expect(parentList.names()).to.deep.equal(["p1", "p2"]);
        expect(frameList.names()).to.deep.equal(["f1", "f2"]);
        expect(frameList.events, "no transfer events").to.deep.equal([]);
        expect(alertText(doc)).to.equal("");

        parentList.element("p1").focus();
        key(parentList.element("p1"), "ArrowDown");
        expect(parentList.names()).to.deep.equal(["p2", "p1"]);
        expect(alertText(document)).to.equal("Moved item p1 to position 2 in the list Parent");

        key(window, "Escape");
        expect(last(parentList)).to.equal(TRIGGERS.DRAG_STOPPED);
        expect(alertText(document)).to.equal("Stopped dragging item p1");
        expect(frameList.zone.tabIndex).to.equal(0);
        expect(frameList.element("f1").tabIndex).to.equal(0);
    });

    it("does not transfer an iframe item into the parent, and can still reorder in the iframe", () => {
        const {parentList, frameList, doc, win} = parentAndFrameLists();
        grab(frameList, "f1");
        expect(alertText(doc)).to.equal("Started dragging item f1. Use the arrow keys to move it within its list Frame");
        expect(parentList.zone.tabIndex).to.equal(-1);
        expect(parentList.zone.style.outline).to.equal("");
        parentList.zone.focus();
        expect(frameList.names()).to.deep.equal(["f1", "f2"]);
        expect(parentList.names()).to.deep.equal(["p1", "p2"]);
        expect(parentList.events).to.deep.equal([]);

        frameList.element("f1").focus();
        key(frameList.element("f1"), "ArrowDown");
        expect(frameList.names()).to.deep.equal(["f2", "f1"]);
        expect(alertText(doc)).to.equal("Moved item f1 to position 2 in the list Frame");

        key(win, "Escape");
        expect(last(frameList), "Escape in the iframe should end the drag").to.equal(TRIGGERS.DRAG_STOPPED);
        expect(alertText(doc)).to.equal("Stopped dragging item f1");
    });

    it("moves an item between two lists inside an iframe", () => {
        const {doc, win} = frame({style: {height: "300px"}});
        const first = list(doc, {label: "First", names: ["a1", "a2"]});
        const second = list(doc, {label: "Second", names: ["b1"]});
        grab(first, "a1");
        expect(alertText(doc)).to.contain(MOVE_BETWEEN_LISTS);
        expect(second.zone.tabIndex).to.equal(0);
        expect(second.zone.style.outline).not.to.equal("");
        second.zone.focus();
        expect(second.names()).to.deep.equal(["a1", "b1"]);
        expect(doc.activeElement).to.equal(second.element("a1"));
        expect(alertText(doc)).to.equal("Moved item a1 to the beginning of the list Second");
        key(win, "Escape");
        expect(last(second)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("does not transfer items between a parent and a nested iframe", () => {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"], style: at("50px")});
        const outer = frame({style: at("300px")});
        const inner = frame({parent: outer.doc, style: {marginTop: "20px"}});
        const nestedList = list(inner.doc, {label: "Nested", names: ["n1"], style: {marginTop: "10px"}});
        grab(parentList, "p1");
        expect(alertText(document)).to.equal(STARTED_IN_PARENT);
        expect(nestedList.zone.tabIndex).to.equal(-1);
        expect(nestedList.zone.style.outline).to.equal("");
        nestedList.zone.focus();
        expect(parentList.names()).to.deep.equal(["p1", "p2"]);
        expect(nestedList.names()).to.deep.equal(["n1"]);
        key(window, "Escape");

        grab(nestedList, "n1");
        parentList.zone.focus();
        expect(parentList.names()).to.deep.equal(["p1", "p2"]);
        expect(nestedList.names()).to.deep.equal(["n1"]);
        key(inner.win, "Escape");
        expect(last(nestedList)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("keeps sibling iframe lists separate, with independent aria elements and cleanup", () => {
        const one = frame({style: at("0px")});
        const two = frame({style: at("250px")});
        const listOne = list(one.doc, {label: "One", names: ["o1"]});
        const listTwo = list(two.doc, {label: "Two", names: ["t1"]});
        [listOne, listTwo].forEach(({zone, doc}) => expect(doc.getElementById(zone.getAttribute("aria-describedby"))).not.to.equal(null));

        grab(listOne, "o1");
        expect(alertText(one.doc)).not.to.contain(MOVE_BETWEEN_LISTS);
        expect(listTwo.zone.tabIndex).to.equal(-1);
        expect(listTwo.zone.style.outline).to.equal("");
        listTwo.zone.focus();
        expect(listOne.names()).to.deep.equal(["o1"]);
        expect(listTwo.names()).to.deep.equal(["t1"]);
        expect(listTwo.events).to.deep.equal([]);
        key(one.win, "Escape");

        listOne.action.destroy();
        expect(one.doc.getElementById(ACTIVE_INSTRUCTION_ID), "should remove the first iframe's instructions").to.equal(null);
        expect(two.doc.getElementById(ACTIVE_INSTRUCTION_ID), "should keep the second iframe's instructions").not.to.equal(null);
        grab(listTwo, "t1");
        expect(alertText(two.doc)).not.to.contain(MOVE_BETWEEN_LISTS);
        key(two.win, "Escape");
        expect(last(listTwo)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("moves an item between two lists inside a popup", function () {
        const created = popup(this);
        const first = list(created.doc, {label: "First", names: ["a1", "a2"]});
        const second = list(created.doc, {label: "Second", names: ["b1"]});
        grab(first, "a1");
        expect(alertText(created.doc)).to.contain(MOVE_BETWEEN_LISTS);
        second.zone.focus();
        expect(second.names()).to.deep.equal(["a1", "b1"]);
        expect(created.doc.activeElement).to.equal(second.element("a1"));
        expect(alertText(created.doc)).to.equal("Moved item a1 to the beginning of the list Second");
        key(created.win, "Escape");
        expect(last(second)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("does not offer a popup list as a destination for a drag in the parent, or the other way round", function () {
        const created = popup(this);
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"]});
        const popupList = list(created.doc, {label: "Popup", names: ["q1"]});

        grab(parentList, "p1");
        expect(alertText(document), "should not promise another list").to.equal(STARTED_IN_PARENT);
        expect(parentList.zone.style.outline, "should style the origin list").not.to.equal("");
        expect(popupList.zone.style.outline, "should not style the popup list").to.equal("");
        expect(popupList.zone.tabIndex, "should not make the popup list a tab stop").to.equal(-1);
        popupList.zone.focus();
        expect(parentList.names(), "focusing the popup list should not move the item").to.deep.equal(["p1", "p2"]);
        expect(popupList.names()).to.deep.equal(["q1"]);
        key(window, "Escape");
        expect(popupList.zone.tabIndex).to.equal(0);

        grab(popupList, "q1");
        expect(alertText(created.doc)).to.equal("Started dragging item q1. Use the arrow keys to move it within its list Popup");
        expect(parentList.zone.style.outline).to.equal("");
        expect(parentList.zone.tabIndex).to.equal(-1);
        parentList.zone.focus();
        expect(popupList.names()).to.deep.equal(["q1"]);
        expect(parentList.names()).to.deep.equal(["p1", "p2"]);
        key(created.win, "Escape");
        expect(last(popupList)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("leaves no listeners or aria elements behind once the zones are destroyed", () => {
        const loadingListeners = trackListeners(window, ["keydown", "click", "pagehide"]);
        const {doc, win} = frame({style: at("300px")});
        const frameListeners = trackListeners(win, ["keydown", "click", "pagehide"]);
        cleanups.push(() => {
            loadingListeners.restore();
            frameListeners.restore();
        });
        const parentList = createList(document, {label: "Parent", names: ["p1"], style: at("50px")});
        const frameList = createList(doc, {label: "Frame", names: ["f1"]});
        expect(frameListeners.active()).not.to.deep.equal([]);

        grab(parentList, "p1");
        frameList.zone.focus();
        key(win, "Escape");
        parentList.action.destroy();
        frameList.action.destroy();

        expect(loadingListeners.active()).to.deep.equal([]);
        expect(frameListeners.active()).to.deep.equal([]);
        [document, doc].forEach(d => {
            expect(d.getElementById(ACTIVE_INSTRUCTION_ID)).to.equal(null);
            expect(d.getElementById("dnd-action-aria-alert")).to.equal(null);
        });
    });

    it("cleans up by the document a zone was registered in, even after the zone moved to another document", () => {
        const parentList = list(document, {label: "Parent", names: ["p1"]});
        const {doc, win} = frame();
        const frameListeners = trackListeners(win, ["keydown", "click", "pagehide"]);
        cleanups.push(() => frameListeners.restore());
        const frameList = createList(doc, {label: "Frame", names: ["f1"]});

        document.body.appendChild(frameList.zone);
        frameList.action.destroy();
        frameList.zone.remove();

        expect(doc.getElementById(ACTIVE_INSTRUCTION_ID), "should remove the iframe's instructions").to.equal(null);
        expect(frameListeners.active(), "should remove the iframe's listeners").to.deep.equal([]);
        expect(
            document.getElementById(parentList.zone.getAttribute("aria-describedby")),
            "should keep the parent's instructions for its own zone"
        ).not.to.equal(null);
    });

    it("ends a keyboard drag in an iframe on Escape or on a click in the page around the iframe", () => {
        const {doc} = frame();
        const frameList = list(doc, {label: "Frame", names: ["f1"]});
        const button = document.createElement("button");
        document.body.appendChild(button);
        cleanups.push(() => button.remove());

        grab(frameList, "f1");
        button.focus();
        button.click();
        expect(last(frameList), "a click in the page should end the drag").to.equal(TRIGGERS.DRAG_STOPPED);

        grab(frameList, "f1");
        key(window, "Escape");
        expect(
            frameList.triggers.filter(trigger => trigger === TRIGGERS.DRAG_STOPPED),
            "Escape in the page should end the drag"
        ).to.have.length(2);
    });

    it("keeps the keyboard handlers of an iframe's next document when the app destroys the previous document's zone late", () => {
        const {frame: frameEl} = frame();
        const previousList = createList(frameEl.contentDocument, {label: "Previous", names: ["p1"]});
        cy.then(
            () =>
                new Cypress.Promise(resolve => {
                    frameEl.addEventListener("load", resolve, {once: true});
                    frameEl.srcdoc = "<!DOCTYPE html><body style='margin:0'></body>";
                })
        );
        cy.then(() => {
            const nextList = list(frameEl.contentDocument, {label: "Next", names: ["n1"]});
            previousList.action.destroy();
            grab(nextList, "n1");
            key(frameEl.contentWindow, "Escape");
            expect(last(nextList)).to.equal(TRIGGERS.DRAG_STOPPED);
        });
    });

    it("ends a keyboard drag whose iframe is removed, and the loading window keeps working", () => {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"]});
        const {frame: frameEl, doc} = createFrame();
        const frameList = createList(doc, {label: "Frame", names: ["f1"]});
        cleanups.push(() => frameList.action.destroy());
        grab(frameList, "f1");
        frameEl.remove();
        expect(last(frameList), "the app should get the drag-stopped event").to.equal(TRIGGERS.DRAG_STOPPED);
        expect(parentList.element("p1").tabIndex, "the parent's items should be tab stops again").to.equal(0);

        grab(parentList, "p1");
        expect(parentList.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        key(window, "Escape");
    });

    // An announcement formatter or a handler of the app can remove the iframe in the middle of a keyboard operation, which
    // ends the drag right there. The operation must not carry on with the drag that has ended.
    describe("when the iframe is removed in the middle of an operation", () => {
        afterEach(() => setAriaStrings(null));

        // A detached document's elements lose their listeners, so watch what the library dispatches on the zone itself.
        function recordDispatchedTriggers(zone) {
            const triggers = [];
            const {dispatchEvent} = zone;
            zone.dispatchEvent = event => {
                triggers.push(event.detail.info.trigger);
                return dispatchEvent.call(zone, event);
            };
            return triggers;
        }
        function removingFrameFormatter(frameEl) {
            return ({itemLabel}) => {
                frameEl.remove();
                return itemLabel;
            };
        }
        function expectAParentDragToWork(parentList) {
            grab(parentList, "p1");
            expect(parentList.triggers[parentList.triggers.length - 1]).to.equal(TRIGGERS.DRAG_STARTED);
            key(window, "Escape");
        }

        it("stops the drag once when it ends while announcing the drop", () => {
            const parentList = list(document, {label: "Parent", names: ["p1"]});
            const {frame: frameEl, doc, win} = createFrame();
            const frameList = createList(doc, {label: "Frame", names: ["f1"]});
            cleanups.push(() => frameList.action.destroy());
            const dispatched = recordDispatchedTriggers(frameList.zone);
            setAriaStrings({dropped: removingFrameFormatter(frameEl)});
            grab(frameList, "f1");
            key(win, "Escape");
            expect(dispatched).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
            expectAParentDragToWork(parentList);
        });

        it("does not start the drag when it ends while announcing the start", () => {
            const parentList = list(document, {label: "Parent", names: ["p1"]});
            const {frame: frameEl, doc} = createFrame();
            const frameList = createList(doc, {label: "Frame", names: ["f1"]});
            cleanups.push(() => frameList.action.destroy());
            const dispatched = recordDispatchedTriggers(frameList.zone);
            setAriaStrings({dragStarted: removingFrameFormatter(frameEl)});
            grab(frameList, "f1");
            expect(dispatched).to.deep.equal([TRIGGERS.DRAG_STOPPED]);
            expectAParentDragToWork(parentList);
        });

        it("still moves the item within its iframe when the drag ends while announcing the move", () => {
            const {parentList, frameList, doc} = parentAndFrameLists();
            const target = list(doc, {label: "Target", names: ["t1"], style: at("100px")});
            const dispatched = recordDispatchedTriggers(frameList.zone);
            // Removing the iframe drops DOM listeners before the transfer event. Record its payload directly,
            // rather than expecting the removed app's listener to re-render the destination.
            const transferredItems = [];
            const {dispatchEvent} = target.zone;
            target.zone.dispatchEvent = event => {
                transferredItems.push(event.detail.items.map(item => item.id));
                return dispatchEvent.call(target.zone, event);
            };
            setAriaStrings({movedToZoneStart: removingFrameFormatter(frameList.win.frameElement)});
            grab(frameList, "f1");
            target.zone.focus();
            expect(transferredItems).to.deep.equal([["f1", "t1"]]);
            expect(parentList.names()).to.deep.equal(["p1", "p2"]);
            expect(dispatched).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED, TRIGGERS.DROPPED_INTO_ANOTHER]);
            expect(parentList.element("p1").tabIndex, "the drag should have ended").to.equal(0);
            expectAParentDragToWork(parentList);
        });

        it("ends the drag when the focus handler of an item the app moved within the iframe removes it", () => {
            const parentList = list(document, {label: "Parent", names: ["p1", "p2"]});
            const {frame: frameEl, doc} = createFrame();
            const source = list(doc, {label: "Source", names: ["s1"]});
            const frameZone = doc.createElement("div");
            doc.body.appendChild(frameZone);
            const frameAction = dndzone(frameZone, {items: []});
            cleanups.push(() => frameAction.destroy());
            grab(source, "s1");

            // The app moves the grabbed item into another zone in its own document.
            const movedItem = doc.createElement("div");
            movedItem.addEventListener("focus", () => frameEl.remove());
            frameZone.appendChild(movedItem);
            frameAction.update({items: [{id: "s1", name: "s1"}]});

            expect(parentList.element("p2").tabIndex, "the drag should have ended").to.equal(0);
        });
    });

    it("announces a custom alert in the given document", () => {
        const {doc} = frame();
        const frameList = list(doc, {label: "Frame", names: ["f1"], autoAriaDisabled: true});
        cleanups.push(() => destroyAria(document));
        expect(frameList.zone.hasAttribute("aria-describedby")).to.equal(false);

        alertToScreenReader("Picked up f1", doc);
        expect(alertText(doc)).to.equal("Picked up f1");
        expect(alertText(document), "should not write to the loading document").to.equal(null);

        alertToScreenReader("Loading document alert");
        expect(alertText(document), "a call without a document should keep using the loading document").to.equal("Loading document alert");
        expect(alertText(doc)).to.equal("Picked up f1");
    });
});
