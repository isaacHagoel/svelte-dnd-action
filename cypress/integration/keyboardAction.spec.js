import {dndzone} from "../../src/keyboardAction";
import {TRIGGERS} from "../../src/constants";

describe("keyboardAction", () => {
    const actions = [];
    const zones = [];

    function createZone(items, options = {}) {
        const zone = document.createElement("div");
        items.forEach(() => zone.appendChild(document.createElement("div")));
        document.body.appendChild(zone);
        zones.push(zone);
        const action = dndzone(zone, {items, ...options});
        actions.push(action);
        return {zone, action, children: Array.from(zone.children)};
    }

    afterEach(() => {
        actions
            .splice(0)
            .reverse()
            .forEach(action => action.destroy());
        zones.splice(0).forEach(zone => zone.remove());
    });

    it("can synchronously destroy the focused zone from the drag-stopped handler", () => {
        const {
            zone,
            action,
            children: [item]
        } = createZone([{id: 1}]);
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
    });

    ["source first", "destination first"].forEach(updateOrder => {
        it(`follows the grabbed item when a consumer moves it to another zone (${updateOrder})`, () => {
            const {
                zone: zoneA,
                action: actionA,
                children: [itemA]
            } = createZone([{id: "a"}, {id: "b"}]);
            const {zone: zoneB, action: actionB} = createZone([]);
            const dragStoppedOn = [];
            [zoneA, zoneB].forEach(zone =>
                zone.addEventListener("consider", e => {
                    if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) dragStoppedOn.push(zone);
                })
            );

            itemA.focus();
            itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

            zoneA.removeChild(itemA);
            const movedItem = updateOrder === "source first" ? itemA : document.createElement("div");
            zoneB.appendChild(movedItem);
            if (updateOrder === "source first") {
                actionA.update({items: [{id: "b"}]});
                actionB.update({items: [{id: "a"}]});
            } else {
                actionB.update({items: [{id: "a"}]});
                actionA.update({items: [{id: "b"}]});
            }

            expect(document.activeElement, "should keep the moved item focused").to.equal(movedItem);
            expect(zoneA.tabIndex, "should make the previous zone reachable again").to.equal(0);
            expect(zoneB.tabIndex, "should remove the current zone from the tab order").to.equal(-1);

            movedItem.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
            expect(dragStoppedOn, "should stop the drag in the zone that now holds the item").to.deep.equal([zoneB]);
        });
    });

    it("keeps a same-type nested zone untabbable when the moved item is recreated", () => {
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA]
        } = createZone([{id: "a"}, {id: "b"}]);
        const {zone: zoneB, action: actionB} = createZone([]);

        itemA.focus();
        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));

        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}]});

        const replacementItem = document.createElement("div");
        const nestedZone = document.createElement("div");
        nestedZone.appendChild(document.createElement("div"));
        replacementItem.appendChild(nestedZone);
        zoneB.appendChild(replacementItem);

        // Svelte configures a nested action before the action on its parent.
        const nestedAction = dndzone(nestedZone, {items: [{id: "nested"}]});
        actions.push(nestedAction);
        expect(nestedZone.tabIndex, "should initially reflect the old focused item").to.equal(0);

        actionB.update({items: [{id: "a"}]});

        expect(document.activeElement, "should focus the replacement item").to.equal(replacementItem);
        expect(zoneA.tabIndex, "should make the old zone reachable").to.equal(0);
        expect(zoneB.tabIndex, "should remove the new current zone from the tab order").to.equal(-1);
        expect(nestedZone.tabIndex, "should keep a nested zone inside the dragged item unreachable").to.equal(-1);
    });

    it("does not let another zone type with the same item id steal the grab", () => {
        const {
            zone: zoneA,
            children: [itemA]
        } = createZone([{id: "same"}], {type: "type-a"});
        const {
            zone: zoneB,
            action: actionB,
            children: [itemB]
        } = createZone([{id: "same"}], {type: "type-b"});
        const dragStoppedOn = [];
        [zoneA, zoneB].forEach(zone =>
            zone.addEventListener("consider", e => {
                if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) dragStoppedOn.push(zone);
            })
        );

        itemA.focus();
        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        actionB.update({items: [{id: "same"}], type: "type-b"});

        expect(document.activeElement, "should keep focus on the grabbed item").to.equal(itemA);
        expect(itemB.tabIndex, "should not make the unrelated item active").to.equal(-1);

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        expect(dragStoppedOn, "should stop the drag in its original zone").to.deep.equal([zoneA]);
    });

    it("ends the grab when a consumer removes the grabbed item from every zone", () => {
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA, itemB]
        } = createZone([{id: "a"}, {id: "b"}], {zoneTabIndex: 3});
        const {zone: zoneB} = createZone([]);
        const triggers = [];
        zoneA.addEventListener("consider", e => triggers.push(e.detail.info.trigger));

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}], zoneTabIndex: 3});

        zoneB.dispatchEvent(new FocusEvent("focus"));

        expect(triggers.filter(trigger => trigger === TRIGGERS.DRAG_STOPPED)).to.have.length(1);
        expect(zoneA.tabIndex, "should restore the configured zone tab index").to.equal(3);
        expect(itemB.tabIndex, "should restore the item tab index").to.equal(0);
    });

    it("does not move another item when the grabbed item is missing", () => {
        const {
            zone: zoneA,
            action: actionA,
            children: [itemA]
        } = createZone([{id: "a"}, {id: "b"}]);
        const {zone: zoneB} = createZone([]);
        const finalized = [];
        [zoneA, zoneB].forEach(zone => zone.addEventListener("finalize", e => finalized.push(e.detail)));

        itemA.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        zoneA.removeChild(itemA);
        actionA.update({items: [{id: "b"}]});

        zoneB.dispatchEvent(new FocusEvent("focus"));

        expect(finalized, "should not finalize a move for an unrelated item").to.be.empty;
    });

    describe("announcements", () => {
        function alertText() {
            return document.getElementById("dnd-action-aria-alert").textContent;
        }

        function createLabelledZone(items, zoneLabel, options = {}) {
            const {zone, action, children} = createZone(items, options);
            zone.setAttribute("aria-label", zoneLabel);
            children.forEach((child, i) => child.setAttribute("aria-label", `Card ${i}`));
            return {zone, action, children};
        }

        function grab(item) {
            item.focus();
            item.dispatchEvent(new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true}));
        }

        it("names the zone when the drag starts", () => {
            const {
                children: [item]
            } = createLabelledZone([{id: "a"}, {id: "b"}], "To do");

            grab(item);

            expect(alertText()).to.equal("Started dragging item Card 0. Use the arrow keys to move it within its list To do");
        });

        it("names the zone when arrowing within the list", () => {
            const {
                children: [item]
            } = createLabelledZone([{id: "a"}, {id: "b"}], "To do");

            grab(item);
            item.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, cancelable: true}));

            expect(alertText()).to.equal("Moved item Card 0 to position 2 in the list To do");
        });
    });
});
