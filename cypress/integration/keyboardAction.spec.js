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

    it("follows the grabbed item when a re-render moves it to another zone", () => {
        const zoneA = document.createElement("div");
        const itemA = document.createElement("div");
        const itemB = document.createElement("div");
        zoneA.appendChild(itemA);
        zoneA.appendChild(itemB);
        const zoneB = document.createElement("div");
        document.body.appendChild(zoneA);
        document.body.appendChild(zoneB);

        const actionA = dndzone(zoneA, {items: [{id: "a"}, {id: "b"}]});
        const actionB = dndzone(zoneB, {items: []});

        const triggers = [];
        const dragStoppedOn = [];
        [zoneA, zoneB].forEach(zone =>
            zone.addEventListener("consider", e => {
                triggers.push(e.detail.info.trigger);
                if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) dragStoppedOn.push(zone);
            })
        );

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

        // a consumer re-render lands mid-grab and moves the grabbed item to the other zone
        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}]});
        zoneB.appendChild(itemA);
        actionB.update({items: [{id: "a"}]});

        expect(triggers.filter(t => t === TRIGGERS.DRAG_STOPPED).length, "should keep the drag alive").to.equal(0);
        expect(document.activeElement, "should keep the item focused").to.equal(itemA);

        // the grab now belongs to the other zone, so dropping it reports there
        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        expect(dragStoppedOn, "should stop the drag in the zone that holds the item").to.deep.equal([zoneB]);

        actionA.destroy();
        actionB.destroy();
        zoneA.remove();
        zoneB.remove();
    });

    it("ends the grab when a re-render removes the grabbed item from every zone", () => {
        const zoneA = document.createElement("div");
        const itemA = document.createElement("div");
        const itemB = document.createElement("div");
        zoneA.appendChild(itemA);
        zoneA.appendChild(itemB);
        const zoneB = document.createElement("div");
        document.body.appendChild(zoneA);
        document.body.appendChild(zoneB);

        const actionA = dndzone(zoneA, {items: [{id: "a"}, {id: "b"}], zoneTabIndex: 3});
        const actionB = dndzone(zoneB, {items: []});
        const triggers = [];
        zoneA.addEventListener("consider", e => triggers.push(e.detail.info.trigger));

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

        // a consumer re-render lands mid-grab and drops the grabbed item
        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}], zoneTabIndex: 3});

        // tab into the other zone
        zoneB.dispatchEvent(new FocusEvent("focus"));

        expect(triggers.filter(t => t === TRIGGERS.DRAG_STOPPED).length, "should stop the drag").to.equal(1);
        expect(zoneA.tabIndex, "should restore the zone tab index").to.equal(3);
        expect(itemB.tabIndex, "should restore the item tab index").to.equal(0);

        actionA.destroy();
        actionB.destroy();
        zoneA.remove();
        zoneB.remove();
    });

    it("does not move a different item when the grabbed item is missing from its origin zone", () => {
        const zoneA = document.createElement("div");
        const itemA = document.createElement("div");
        const itemB = document.createElement("div");
        zoneA.appendChild(itemA);
        zoneA.appendChild(itemB);
        const zoneB = document.createElement("div");
        document.body.appendChild(zoneA);
        document.body.appendChild(zoneB);

        const actionA = dndzone(zoneA, {items: [{id: "a"}, {id: "b"}]});
        const actionB = dndzone(zoneB, {items: []});

        const finalizeOnA = [];
        const finalizeOnB = [];
        zoneA.addEventListener("finalize", e => finalizeOnA.push(e.detail));
        zoneB.addEventListener("finalize", e => finalizeOnB.push(e.detail));

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

        // a consumer re-render lands mid-grab and drops the grabbed item
        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}]});

        zoneB.dispatchEvent(new FocusEvent("focus"));

        expect(finalizeOnB.length, "should not move an unrelated item into the target zone").to.equal(0);
        expect(finalizeOnA.length, "should not remove an unrelated item from the origin zone").to.equal(0);

        actionA.destroy();
        actionB.destroy();
        zoneA.remove();
        zoneB.remove();
    });
});
