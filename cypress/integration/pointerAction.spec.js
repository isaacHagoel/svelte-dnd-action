import {dndzone} from "../../src/pointerAction";

describe("pointerAction", () => {
    it("does not restart observation when the original element is removed while a drop is finalizing", () => {
        let action;
        let zone;
        let originalRequestAnimationFrame;

        cy.clock();
        cy.then(() => {
            const animationFrameCallbacks = [];
            originalRequestAnimationFrame = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => {
                animationFrameCallbacks.push(callback);
                return animationFrameCallbacks.length;
            };

            zone = document.createElement("div");
            zone.style.width = "100px";
            zone.style.height = "100px";
            const item = document.createElement("div");
            item.style.width = "50px";
            item.style.height = "50px";
            zone.appendChild(item);
            document.body.appendChild(zone);

            action = dndzone(zone, {items: [{id: 1}], flipDurationMs: 100});

            item.dispatchEvent(new MouseEvent("mousedown", {button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true}));
            window.dispatchEvent(new MouseEvent("mousemove", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));
            window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));

            item.remove();
            animationFrameCallbacks.shift()();

            // The pending keepOriginalElementInDom frame must stop rather than re-append the item
            // and restart observation during the asynchronous drop-settle window.
            expect(item.parentElement).to.equal(null);
        });

        cy.tick(107);
        cy.then(() => {
            action.destroy();
            zone.remove();
            window.requestAnimationFrame = originalRequestAnimationFrame;
        });
    });
});
