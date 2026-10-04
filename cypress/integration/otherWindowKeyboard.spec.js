import {TRIGGERS} from "../../src/constants";
import {alertToScreenReader, destroyAria} from "../../src/helpers/aria";
import {alertText, createFrame, createList, key, openPopup, trackListeners} from "./helpers/otherWindow";

const STARTED_IN_PARENT = "Started dragging item p1. Use the arrow keys to move it within its list Parent";
const MOVE_BETWEEN_LISTS = ", or tab to another list in order to move the item into it";
const ACTIVE_INSTRUCTION_ID = "dnd-zone-active";
const at = top => ({position: "fixed", left: "0", top});
const last = list => list.triggers[list.triggers.length - 1];

// Keyboard destinations are the same-type zones in the same top-level window, which Tab can reach: the
// loading document and its same-origin iframes. A popup is a separate top-level window.
describe("keyboard drags across the documents of one tab", () => {
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
    function popup() {
        const created = openPopup();
        if (created) cleanups.push(() => created.win.close());
        return created;
    }
    function grab(created, name) {
        const el = created.element(name);
        el.focus();
        key(el, "Enter");
    }

    // The iframe sits below the parent list, but the iframe list is near the top of the iframe's own
    // viewport, so comparing raw positions across the two documents would get "above" and "below" wrong.
    function parentAndFrameLists() {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"], style: at("50px")});
        const {doc, win} = frame({style: at("300px")});
        const frameList = list(doc, {label: "Frame", names: ["f1", "f2"], style: {marginTop: "10px"}});
        return {parentList, frameList, doc, win};
    }

    it("moves an item from the parent into an iframe list and continues the drag there", () => {
        const {parentList, frameList, doc} = parentAndFrameLists();
        grab(parentList, "p1");
        expect(alertText(document)).to.equal(STARTED_IN_PARENT + MOVE_BETWEEN_LISTS);
        expect(frameList.zone.tabIndex, "the iframe list should be a destination").to.equal(0);

        frameList.zone.focus();
        expect(parentList.names()).to.deep.equal(["p2"]);
        expect(frameList.names(), "a list below takes the item at its start").to.deep.equal(["p1", "f1", "f2"]);
        expect(doc.activeElement, "should focus the moved item in the iframe").to.equal(frameList.element("p1"));
        expect(alertText(doc)).to.equal("Moved item p1 to the beginning of the list Frame");

        key(frameList.element("p1"), "ArrowDown");
        expect(frameList.names()).to.deep.equal(["f1", "p1", "f2"]);
        expect(alertText(doc)).to.equal("Moved item p1 to position 2 in the list Frame");

        key(window, "Escape");
        expect(last(frameList), "Escape in the parent should end the drag").to.equal(TRIGGERS.DRAG_STOPPED);
        expect(alertText(doc)).to.equal("Stopped dragging item p1");
        expect(frameList.zone.tabIndex).to.equal(0);
        expect(frameList.element("p1").tabIndex).to.equal(0);
    });

    it("moves an item from an iframe list into the parent and continues the drag there", () => {
        const {parentList, frameList, doc, win} = parentAndFrameLists();
        grab(frameList, "f1");
        parentList.zone.focus();
        expect(frameList.names()).to.deep.equal(["f2"]);
        expect(parentList.names(), "a list above takes the item at its end").to.deep.equal(["p1", "p2", "f1"]);
        expect(document.activeElement, "should focus the moved item in the parent").to.equal(parentList.element("f1"));
        expect(alertText(document)).to.equal("Moved item f1 to the end of the list Parent");

        doc.body.dispatchEvent(new win.MouseEvent("click", {bubbles: true}));
        expect(last(parentList), "a click in the iframe should end the drag").to.equal(TRIGGERS.DRAG_STOPPED);
        expect(alertText(document)).to.equal("Stopped dragging item f1");
    });

    it("moves an item between two lists inside an iframe", () => {
        const {doc, win} = frame({style: {height: "300px"}});
        const first = list(doc, {label: "First", names: ["a1", "a2"]});
        const second = list(doc, {label: "Second", names: ["b1"]});
        grab(first, "a1");
        second.zone.focus();
        expect(second.names()).to.deep.equal(["a1", "b1"]);
        expect(doc.activeElement).to.equal(second.element("a1"));
        expect(alertText(doc)).to.equal("Moved item a1 to the beginning of the list Second");
        key(win, "Escape");
        expect(last(second)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("moves an item into a list in a nested iframe", () => {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"], style: at("50px")});
        const outer = frame({style: at("300px")});
        const inner = createFrame({parent: outer.doc, style: {marginTop: "20px"}});
        const nestedList = list(inner.doc, {label: "Nested", names: ["n1"], style: {marginTop: "10px"}});
        grab(parentList, "p1");
        nestedList.zone.focus();
        expect(nestedList.names(), "a list below takes the item at its start").to.deep.equal(["p1", "n1"]);
        expect(inner.doc.activeElement).to.equal(nestedList.element("p1"));
        expect(alertText(inner.doc)).to.equal("Moved item p1 to the beginning of the list Nested");
        key(inner.win, "Escape");
        expect(last(nestedList)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("moves an item between two lists in an iframe each, with separate aria elements", () => {
        const one = frame({style: at("0px")});
        const two = frame({style: at("250px")});
        const listOne = list(one.doc, {label: "One", names: ["o1"]});
        const listTwo = list(two.doc, {label: "Two", names: ["t1"]});
        [listOne, listTwo].forEach(({zone, doc}) => expect(doc.getElementById(zone.getAttribute("aria-describedby"))).not.to.equal(null));

        grab(listOne, "o1");
        listTwo.zone.focus();
        expect(listTwo.names()).to.deep.equal(["o1", "t1"]);
        expect(two.doc.activeElement).to.equal(listTwo.element("o1"));
        key(two.win, "Escape");

        listOne.action.destroy();
        expect(one.doc.getElementById(ACTIVE_INSTRUCTION_ID), "should remove the first iframe's instructions").to.equal(null);
        expect(two.doc.getElementById(ACTIVE_INSTRUCTION_ID), "should keep the second iframe's instructions").not.to.equal(null);
        grab(listTwo, "t1");
        key(two.win, "Escape");
        expect(last(listTwo)).to.equal(TRIGGERS.DRAG_STOPPED);
    });

    it("moves an item between two lists inside a popup", function () {
        const created = popup();
        if (!created) this.skip();
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
        const created = popup();
        if (!created) this.skip();
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

    it("ends a keyboard drag whose iframe is removed, and the loading window keeps working", () => {
        const parentList = list(document, {label: "Parent", names: ["p1", "p2"]});
        const {frame: frameEl, doc} = createFrame();
        const frameList = createList(doc, {label: "Frame", names: ["f1"]});
        grab(frameList, "f1");
        frameEl.remove();
        expect(last(frameList), "the app should get the drag-stopped event").to.equal(TRIGGERS.DRAG_STOPPED);
        expect(parentList.element("p1").tabIndex, "the parent's items should be tab stops again").to.equal(0);

        grab(parentList, "p1");
        expect(parentList.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        key(window, "Escape");
        // The app destroys its zone after the iframe is gone.
        frameList.action.destroy();
    });
});
