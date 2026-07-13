import {dndzone} from "../../src/keyboardAction";
import {TRIGGERS} from "../../src/constants";

describe("keyboardAction", () => {
    it("can synchronously destroy the focused zone from the drag-stopped handler", () => {
        const zone = document.createElement("div");
        const item = document.createElement("div");
        zone.appendChild(item);
        document.body.appendChild(zone);

        const action = dndzone(zone, {items: [{id: 1}]});
        let dragStoppedEvents = 0;
        zone.addEventListener("consider", e => {
            if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) {
                dragStoppedEvents++;
                action.destroy();
            }
        });

        item.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        item.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

        expect(dragStoppedEvents).to.equal(1);
        zone.remove();
    });
});
