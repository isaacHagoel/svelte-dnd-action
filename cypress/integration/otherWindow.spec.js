import {dndzone} from "../../src/pointerAction";
import {dndzone as pointerAndKeyboardDndzone} from "../../src/action";
import {dragHandle, dragHandleZone} from "../../src/wrappers/withDragHandles";
import {setAriaStrings} from "../../src/helpers/aria";
import {DRAGGED_ELEMENT_ID, TRIGGERS} from "../../src/constants";
import {createFrame, createList, openPopup} from "./helpers/otherWindow";

// A same-origin iframe stands in for any other window the zone can live in (for example a popup
// opened with window.open): its own Window and Document, while this module was loaded by the
// test page's window.
function createZoneInFrame(options = {}, makeZone = dndzone) {
    const frame = document.createElement("iframe");
    frame.style.width = "300px";
    frame.style.height = "150px";
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    doc.write("<!DOCTYPE html><body></body>");
    doc.close();
    const zone = doc.createElement("div");
    zone.style.width = "100px";
    zone.style.height = "100px";
    const item = doc.createElement("div");
    item.style.width = "50px";
    item.style.height = "50px";
    item.textContent = "item";
    zone.appendChild(item);
    doc.body.appendChild(zone);
    const triggers = [];
    zone.addEventListener("consider", e => triggers.push(e.detail.info.trigger));
    zone.addEventListener("finalize", e => triggers.push(e.detail.info.trigger));
    const action = makeZone(zone, {items: [{id: 1}], ...options});
    return {action, doc, frame, item, triggers, win, zone};
}

function mouse(win, type, x) {
    return new win.MouseEvent(type, {button: 0, clientX: x, clientY: x, bubbles: true, cancelable: true});
}

function startMouseDrag({item, win}) {
    item.dispatchEvent(mouse(win, "mousedown", 5));
    win.dispatchEvent(mouse(win, "mousemove", 10));
}

const last = list => list.triggers[list.triggers.length - 1];
function listInFrame(options = {}, parent = document) {
    const frame = createFrame({parent});
    return {...frame, list: createList(frame.doc, {label: "Frame", names: ["f1", "f2"], dropAnimationDisabled: true, ...options})};
}
function startDrag({list, win}) {
    list.element("f1").dispatchEvent(mouse(win, "mousedown", 15));
    win.dispatchEvent(mouse(win, "mousemove", 20));
}
// The library allows one drag at a time, so a drag left behind would block this one.
function expectALoadingWindowDragToWork() {
    const list = createList(document, {label: "Loading", names: ["l1"], dropAnimationDisabled: true});
    try {
        list.element("l1").dispatchEvent(mouse(window, "mousedown", 5));
        window.dispatchEvent(mouse(window, "mousemove", 10));
        window.dispatchEvent(mouse(window, "mouseup", 10));
        expect(list.triggers, "a drag in the loading window should work").to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DROPPED_INTO_ZONE]);
    } finally {
        list.action.destroy();
        list.zone.remove();
    }
}

describe("a drop zone in another window", () => {
    it("starts and finishes a pointer drag from that window's events", () => {
        let created;
        cy.then(() => {
            created = createZoneInFrame({dropAnimationDisabled: true});
            startMouseDrag(created);

            expect(created.doc.getElementById(DRAGGED_ELEMENT_ID)).not.to.equal(null);
            expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);

            created.win.dispatchEvent(mouse(created.win, "mouseup", 10));
        });
        cy.window().should(() => {
            expect(created.doc.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
            expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DROPPED_INTO_ZONE]);
        });
        cy.then(() => {
            created.action.destroy();
            created.frame.remove();
        });
    });

    it("keeps the drag going while the loading window's animation frames are paused", () => {
        // A hidden or fully covered window gets no animation frames, while the window the zone
        // is in (a popup on top of it) keeps getting them.
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        let created;
        cy.then(() => {
            window.requestAnimationFrame = () => 0;
            created = createZoneInFrame({dropAnimationDisabled: true});
            // What a framework does on the drag-started consider event: re-render the list,
            // which takes the original element out of the zone.
            created.zone.addEventListener("consider", () => created.item.remove(), {once: true});
            startMouseDrag(created);
        });
        // The library keeps the original element in the document once the framework removed it;
        // that runs on an animation frame.
        cy.window().should(() => {
            expect(created.item.parentElement).to.equal(created.doc.body);
        });
        cy.then(() => {
            window.requestAnimationFrame = originalRequestAnimationFrame;
            created.win.dispatchEvent(mouse(created.win, "mouseup", 10));
        });
        cy.window().should(() => {
            expect(created.doc.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
        });
        cy.then(() => {
            created.action.destroy();
            created.frame.remove();
        });
    });

    it("only considers the zones in the drag's window", () => {
        // A same-type zone in the loading document that covers the iframe zone's coordinates. It is
        // nested one level deeper, so it would be checked first if it were a candidate.
        const wrapper = document.createElement("div");
        const loadingZone = document.createElement("div");
        Object.assign(loadingZone.style, {position: "absolute", top: "0", left: "0", width: "400px", height: "400px"});
        loadingZone.appendChild(document.createElement("div"));
        wrapper.appendChild(loadingZone);
        document.body.appendChild(wrapper);
        const loadingTriggers = [];
        loadingZone.addEventListener("consider", e => loadingTriggers.push(e.detail.info.trigger));
        const loadingAction = dndzone(loadingZone, {items: [{id: 2}], dropAnimationDisabled: true});
        let created;
        cy.then(() => {
            created = createZoneInFrame({dropAnimationDisabled: true});
            // Model the framework re-rendering the list on drag start, which starts the observation.
            created.zone.addEventListener("consider", () => created.item.remove(), {once: true});
            startMouseDrag(created);
        });
        cy.window().should(() => {
            expect(loadingTriggers).to.deep.equal([]);
            expect(created.triggers).to.include(TRIGGERS.DRAGGED_ENTERED);
            expect(loadingZone.style.outline, "should not style the other window's zone as a drop target").to.equal("");
        });
        cy.then(() => {
            created.win.dispatchEvent(mouse(created.win, "mouseup", 10));
        });
        cy.window().should(() => {
            expect(created.doc.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
        });
        cy.then(() => {
            created.action.destroy();
            created.frame.remove();
            loadingAction.destroy();
            wrapper.remove();
        });
    });

    it("does not style a zone in another window when its options change during a drag", () => {
        const loadingList = createList(document, {label: "Loading", names: ["l1"]});
        const created = listInFrame();
        const updateLoadingList = options => loadingList.action.update({items: [{id: "l1", name: "l1"}], ...options});
        try {
            startDrag(created);
            updateLoadingList({dropTargetStyle: {outline: "rgb(255, 0, 0) solid 1px"}, dropTargetClasses: ["target"]});
            updateLoadingList({dropFromOthersDisabled: true});
            updateLoadingList({dropFromOthersDisabled: false});
            expect(loadingList.zone.style.outline).to.equal("");
            expect(loadingList.zone.classList.contains("target")).to.equal(false);
            created.win.dispatchEvent(mouse(created.win, "mouseup", 20));
            expect(loadingList.zone.style.outline).to.equal("");
        } finally {
            created.list.action.destroy();
            created.frame.remove();
            loadingList.action.destroy();
            loadingList.zone.remove();
        }
    });
});

describe("keyboard and aria support for a drop zone in another window", () => {
    let created;
    beforeEach(() => {
        created = createZoneInFrame({}, pointerAndKeyboardDndzone);
        created.zone.setAttribute("aria-label", "To do");
        created.item.setAttribute("aria-label", "Card A");
    });
    afterEach(() => {
        created.action.destroy();
        created.frame.remove();
    });

    function key(k) {
        return new created.win.KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true});
    }
    function click(el) {
        el.dispatchEvent(new created.win.MouseEvent("click", {bubbles: true, cancelable: true}));
    }

    it("describes the zone with instructions in the zone's document", () => {
        const instruction = created.doc.getElementById(created.zone.getAttribute("aria-describedby"));
        expect(instruction.textContent).to.equal("Tab to one the items and press space-bar or enter to start dragging it");

        try {
            setAriaStrings({zoneActiveInstruction: "Appuyez sur espace"});
            expect(instruction.textContent).to.equal("Appuyez sur espace");
        } finally {
            setAriaStrings(null);
        }
    });

    it("announces in the zone's document", () => {
        created.item.dispatchEvent(key("Enter"));
        expect(created.doc.getElementById("dnd-action-aria-alert").textContent).to.equal(
            "Started dragging item Card A. Use the arrow keys to move it within its list To do"
        );
    });

    it("ends a keyboard drag on Escape", () => {
        created.item.dispatchEvent(key("Enter"));
        created.item.dispatchEvent(key("Escape"));
        expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
    });

    it("ends a keyboard drag on a click outside of the dragged item", () => {
        created.item.dispatchEvent(key("Enter"));
        expect(created.doc.activeElement).to.equal(created.item);
        click(created.item);
        expect(created.triggers, "a click on the focused dragged item should keep the drag").to.deep.equal([TRIGGERS.DRAG_STARTED]);

        // A real click elsewhere moves the focus before the click event fires.
        created.item.blur();
        click(created.doc.body);
        expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
    });

    it("keeps ending keyboard drags on Escape in the loading window after the other window is gone", () => {
        const loadingZone = document.createElement("div");
        const loadingItem = document.createElement("div");
        loadingZone.appendChild(loadingItem);
        document.body.appendChild(loadingZone);
        const triggers = [];
        loadingZone.addEventListener("consider", e => triggers.push(e.detail.info.trigger));
        const loadingAction = pointerAndKeyboardDndzone(loadingZone, {items: [{id: 2}]});
        try {
            // A popup can close before the app destroys the zones that were in it.
            created.frame.remove();
            created.action.destroy();
            loadingItem.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));
            loadingItem.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
            expect(triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
        } finally {
            loadingAction.destroy();
            loadingZone.remove();
        }
    });
});

describe("a drag handle in another window", () => {
    it("is released when the mouse is released without dragging", () => {
        const created = createZoneInFrame({}, dragHandleZone);
        const handle = created.doc.createElement("div");
        created.item.appendChild(handle);
        const handleAction = dragHandle(handle);
        try {
            handle.dispatchEvent(mouse(created.win, "mousedown", 5));
            expect(handle.style.cursor).to.equal("grabbing");
            created.win.dispatchEvent(mouse(created.win, "mouseup", 5));
            expect(handle.style.cursor).to.equal("grab");
        } finally {
            handleAction.destroy();
            created.action.destroy();
            created.frame.remove();
        }
    });
});

describe("a keyboard drag from a drag handle in another window", () => {
    it("starts from the handle, announces in that window and ends on Escape", () => {
        const created = createZoneInFrame({}, dragHandleZone);
        created.zone.setAttribute("aria-label", "To do");
        created.item.setAttribute("aria-label", "Card A");
        const handle = created.doc.createElement("div");
        created.item.appendChild(handle);
        const handleAction = dragHandle(handle);
        try {
            handle.focus();
            handle.dispatchEvent(new created.win.KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));
            expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
            expect(created.doc.getElementById("dnd-action-aria-alert").textContent).to.contain("Started dragging item Card A");
            created.win.dispatchEvent(new created.win.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
            expect(created.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DRAG_STOPPED]);
            expect(handle.style.cursor, "the handle should be released").to.equal("grab");
        } finally {
            handleAction.destroy();
            created.action.destroy();
            created.frame.remove();
        }
    });
});

describe("a drag in another window that goes away", () => {
    it("finalizes a pointer drag whose iframe is removed", () => {
        const created = listInFrame();
        startDrag(created);
        expect(created.list.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        created.frame.remove();
        expect(last(created.list), "the app should get the finalize event").to.equal(TRIGGERS.DROPPED_INTO_ZONE);
        // The app destroys its zone after the iframe is gone.
        created.list.action.destroy();
        expectALoadingWindowDragToWork();
    });

    it("cancels a pending pointer drag whose iframe is removed", () => {
        const created = listInFrame();
        created.list.element("f1").dispatchEvent(mouse(created.win, "mousedown", 15));
        created.frame.remove();
        try {
            // before the app destroys its zone, which cancels a pending drag too
            expectALoadingWindowDragToWork();
        } finally {
            created.list.action.destroy();
        }
    });

    it("finalizes a pointer drag whose iframe the app removes when the drag starts", () => {
        const created = listInFrame();
        created.list.zone.addEventListener("consider", () => created.frame.remove(), {once: true});
        startDrag(created);
        expect(created.list.triggers).to.deep.equal([TRIGGERS.DRAG_STARTED, TRIGGERS.DROPPED_INTO_ZONE]);
        created.list.action.destroy();
        expectALoadingWindowDragToWork();
    });

    it("finalizes once when the app removes the iframe while handling the finalize event", () => {
        cy.then({timeout: 10000}, () => {
            const created = listInFrame({dropAnimationDisabled: false, flipDurationMs: 50});
            created.list.zone.addEventListener("finalize", () => created.frame.remove());
            startDrag(created);
            created.win.dispatchEvent(mouse(created.win, "mouseup", 20));
            return new Promise(resolve => window.setTimeout(resolve, 200)).then(() => {
                expect(created.list.triggers.filter(trigger => trigger === TRIGGERS.DROPPED_INTO_ZONE)).to.have.length(1);
                created.list.action.destroy();
                expectALoadingWindowDragToWork();
            });
        });
    });

    it("finishes the drop animation at once when the iframe is removed during it", () => {
        const created = listInFrame({dropAnimationDisabled: false, flipDurationMs: 300});
        startDrag(created);
        created.win.dispatchEvent(mouse(created.win, "mouseup", 20));
        expect(created.list.triggers, "the drop animation should be running").to.deep.equal([TRIGGERS.DRAG_STARTED]);
        created.frame.remove();
        expect(last(created.list)).to.equal(TRIGGERS.DROPPED_INTO_ZONE);
        created.list.action.destroy();
        expectALoadingWindowDragToWork();
    });

    it("finalizes a pointer drag in a nested iframe when the outer iframe is removed", () => {
        const outer = createFrame();
        const created = listInFrame({}, outer.doc);
        startDrag(created);
        outer.frame.remove();
        expect(last(created.list)).to.equal(TRIGGERS.DROPPED_INTO_ZONE);
        created.list.action.destroy();
        expectALoadingWindowDragToWork();
    });

    it("finalizes a pointer drag whose popup is closed", function () {
        const popup = openPopup();
        if (!popup) this.skip();
        const list = createList(popup.doc, {label: "Popup", names: ["f1", "f2"], dropAnimationDisabled: true});
        startDrag({list, win: popup.win});
        popup.win.close();
        cy.wrap(list).should(() => expect(last(list)).to.equal(TRIGGERS.DROPPED_INTO_ZONE));
        cy.then(() => {
            list.action.destroy();
            expectALoadingWindowDragToWork();
        });
    });

    it("leaves a zone whose iframe is gone out of a pointer drag in the loading window", () => {
        const created = listInFrame();
        created.frame.remove();
        const list = createList(document, {label: "Loading", names: ["l1"], dropAnimationDisabled: true});
        try {
            list.element("l1").dispatchEvent(mouse(window, "mousedown", 5));
            window.dispatchEvent(mouse(window, "mousemove", 10));
            expect(list.zone.style.outline, "should style the loading window's zone").not.to.equal("");
            expect(created.list.zone.style.outline, "should not style the removed iframe's zone").to.equal("");
            window.dispatchEvent(mouse(window, "mouseup", 10));
        } finally {
            list.action.destroy();
            list.zone.remove();
            created.list.action.destroy();
        }
    });

    it("releases a drag handle whose iframe is removed before the mouse is released", () => {
        const loadingZone = document.createElement("div");
        const loadingItem = document.createElement("div");
        const loadingHandle = document.createElement("div");
        loadingItem.appendChild(loadingHandle);
        loadingZone.appendChild(loadingItem);
        document.body.appendChild(loadingZone);
        const loadingZoneAction = dragHandleZone(loadingZone, {items: [{id: "loading"}]});
        const loadingHandleAction = dragHandle(loadingHandle);
        const created = createZoneInFrame({}, dragHandleZone);
        const handle = created.doc.createElement("div");
        created.item.appendChild(handle);
        const handleAction = dragHandle(handle);
        try {
            handle.dispatchEvent(mouse(created.win, "mousedown", 5));
            expect(loadingHandle.style.cursor, "the handles share their grabbed state").to.equal("grabbing");
            created.frame.remove();
            expect(loadingHandle.style.cursor).to.equal("grab");
        } finally {
            handleAction.destroy();
            created.action.destroy();
            loadingHandleAction.destroy();
            loadingZoneAction.destroy();
            loadingZone.remove();
        }
    });
});
