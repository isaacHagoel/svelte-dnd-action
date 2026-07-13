import {dndzone} from "../../src/pointerAction";
import {DRAGGED_ELEMENT_ID} from "../../src/constants";

function createZone(options = {}) {
    const zone = document.createElement("div");
    zone.style.width = "100px";
    zone.style.height = "100px";
    const item = document.createElement("div");
    item.style.width = "50px";
    item.style.height = "50px";
    item.textContent = options.label || "item";
    zone.appendChild(item);
    document.body.appendChild(zone);
    const items = [{id: options.id || 1}];
    const actionOptions = {...options, items};
    delete actionOptions.id;
    delete actionOptions.label;
    const action = dndzone(zone, actionOptions);
    return {action, actionOptions, item, items, zone};
}

function startMouseDrag(item) {
    item.dispatchEvent(new MouseEvent("mousedown", {button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true}));
    window.dispatchEvent(new MouseEvent("mousemove", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));
}

function createTouchEvent(type, x = 5, y = 5) {
    const event = new Event(type, {bubbles: true, cancelable: true});
    Object.defineProperty(event, "touches", {value: type === "touchend" ? [] : [{clientX: x, clientY: y}]});
    return event;
}

function stubTimeouts() {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const pending = new Map();
    let nextId = 1;
    let now = 0;

    window.setTimeout = (callback, delay = 0) => {
        const id = nextId++;
        pending.set(id, {callback, dueAt: now + delay});
        return id;
    };
    window.clearTimeout = id => pending.delete(id);

    return {
        runAll: () => {
            let remainingIterations = 100;
            while (pending.size > 0 && remainingIterations-- > 0) {
                const [id, timer] = Array.from(pending).sort(([, timerA], [, timerB]) => timerA.dueAt - timerB.dueAt)[0];
                pending.delete(id);
                now = timer.dueAt;
                timer.callback();
            }
            if (pending.size > 0) throw new Error("timer queue did not settle");
        },
        restore: () => {
            window.setTimeout = originalSetTimeout;
            window.clearTimeout = originalClearTimeout;
        }
    };
}

describe("pointerAction", () => {
    it("does not restart observation when the original element is removed while a drop is finalizing", () => {
        cy.then(() => {
            const timeouts = stubTimeouts();
            const animationFrameCallbacks = [];
            const originalRequestAnimationFrame = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => {
                animationFrameCallbacks.push(callback);
                return animationFrameCallbacks.length;
            };

            const created = createZone({flipDurationMs: 100});
            startMouseDrag(created.item);
            window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));

            created.item.remove();
            animationFrameCallbacks.shift()();

            // The pending keepOriginalElementInDom frame must stop rather than re-append the item
            // and restart observation during the asynchronous drop-settle window.
            expect(created.item.parentElement).to.equal(null);

            timeouts.runAll();
            created.action.destroy();
            created.zone.remove();
            timeouts.restore();
            window.requestAnimationFrame = originalRequestAnimationFrame;
        });
    });

    it("unwatches the exact zones when their type changes during an active drag", () => {
        cy.then(() => {
            const timeouts = stubTimeouts();
            const animationFrameCallbacks = [];
            const originalRequestAnimationFrame = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => {
                animationFrameCallbacks.push(callback);
                return animationFrameCallbacks.length;
            };

            const created = createZone({dropAnimationDisabled: true, type: "before"});
            startMouseDrag(created.item);
            created.item.remove();
            animationFrameCallbacks.shift()();
            created.action.update({...created.actionOptions, type: "after"});
            window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
            created.action.destroy();
            created.zone.remove();
            timeouts.restore();
            window.requestAnimationFrame = originalRequestAnimationFrame;
        });
    });

    it("finishes an animated drop when zones change type during the settle window", () => {
        cy.then(() => {
            const timeouts = stubTimeouts();
            const created = createZone({flipDurationMs: 100, type: "before"});
            startMouseDrag(created.item);
            window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));
            created.action.update({...created.actionOptions, type: "after"});

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
            created.action.destroy();
            created.zone.remove();
            timeouts.restore();
        });
    });

    it("cancels a delayed touch gesture when its zone is destroyed", () => {
        cy.then(() => {
            const timeouts = stubTimeouts();
            const created = createZone({delayTouchStart: 50});
            created.item.dispatchEvent(createTouchEvent("touchstart"));
            created.action.destroy();
            created.zone.remove();

            timeouts.runAll();
            expect(document.getElementById(DRAGGED_ELEMENT_ID)).to.equal(null);
            timeouts.restore();
        });
    });

    it("allows only one pending touch gesture to become a drag", () => {
        cy.then(() => {
            const timeouts = stubTimeouts();
            const first = createZone({delayTouchStart: 50, dropAnimationDisabled: true, id: "first", label: "first"});
            const second = createZone({delayTouchStart: 50, dropAnimationDisabled: true, id: "second", label: "second"});
            first.item.dispatchEvent(createTouchEvent("touchstart"));
            second.item.dispatchEvent(createTouchEvent("touchstart"));

            timeouts.runAll();
            const draggedElements = document.querySelectorAll(`#${DRAGGED_ELEMENT_ID}`);
            expect(draggedElements).to.have.length(1);
            expect(draggedElements[0].textContent).to.equal("first");
            window.dispatchEvent(createTouchEvent("touchend"));
            first.action.destroy();
            second.action.destroy();
            first.zone.remove();
            second.zone.remove();
            timeouts.restore();
        });
    });

    it("does not reattach a zone after its scheduled removal was completed during drop cleanup", () => {
        let originalRequestAnimationFrame;

        cy.then(() => {
            const animationFrameCallbacks = [];
            originalRequestAnimationFrame = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => {
                animationFrameCallbacks.push(callback);
                return animationFrameCallbacks.length;
            };

            const created = createZone({dropAnimationDisabled: true});
            startMouseDrag(created.item);
            created.action.destroy();
            window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));

            animationFrameCallbacks.forEach(callback => callback());
            expect(created.zone.parentElement).to.equal(null);
            window.requestAnimationFrame = originalRequestAnimationFrame;
        });
    });
});
