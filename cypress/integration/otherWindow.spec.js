import {dndzone} from "../../src/pointerAction";
import {DRAGGED_ELEMENT_ID, TRIGGERS} from "../../src/constants";

// A same-origin iframe stands in for any other window the zone can live in (for example a popup
// opened with window.open): its own Window and Document, while this module was loaded by the
// test page's window.
function createZoneInFrame(options = {}) {
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
    const action = dndzone(zone, {items: [{id: 1}], ...options});
    return {action, doc, frame, item, triggers, win, zone};
}

function mouse(win, type, x) {
    return new win.MouseEvent(type, {button: 0, clientX: x, clientY: x, bubbles: true, cancelable: true});
}

function startMouseDrag({item, win}) {
    item.dispatchEvent(mouse(win, "mousedown", 5));
    win.dispatchEvent(mouse(win, "mousemove", 10));
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
});
