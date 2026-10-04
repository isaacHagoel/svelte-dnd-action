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
