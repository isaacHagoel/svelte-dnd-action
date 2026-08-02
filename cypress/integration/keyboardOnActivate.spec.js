import {dndzone} from "../../src/keyboardAction";
import {TRIGGERS} from "../../src/constants";

describe("keyboardAction onActivate", () => {
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

    // A grab is observable as a DRAG_STARTED consider; that is what onActivate must suppress.
    function grabsRecordedOn(zone) {
        const grabs = [];
        zone.addEventListener("consider", e => {
            if (e.detail.info.trigger === TRIGGERS.DRAG_STARTED) grabs.push(e.detail.info.id);
        });
        return grabs;
    }

    function press(el, key) {
        el.dispatchEvent(new KeyboardEvent("keydown", {key, bubbles: true, cancelable: true}));
    }

    afterEach(() => {
        actions
            .splice(0)
            .reverse()
            .forEach(action => action.destroy());
        zones.splice(0).forEach(zone => zone.remove());
    });

    describe("when the consumer opts in", () => {
        it("calls onActivate with the item id instead of grabbing", () => {
            const activated = [];
            const {
                zone,
                children: [, second]
            } = createZone([{id: "a"}, {id: "b"}], {onActivate: id => activated.push(id)});
            const grabs = grabsRecordedOn(zone);

            press(second, "Enter");

            expect(activated, "Enter should activate the focused item").to.deep.equal(["b"]);
            expect(grabs, "Enter must not start a drag when onActivate is provided").to.deep.equal([]);
        });

        it("leaves Space grabbing, so a drag is still reachable from the keyboard", () => {
            const activated = [];
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {onActivate: id => activated.push(id)});
            const grabs = grabsRecordedOn(zone);

            press(item, " ");

            expect(grabs, "Space should still grab").to.deep.equal(["a"]);
            expect(activated, "Space must not activate").to.deep.equal([]);
        });

        it("drops on Enter while a drag is in progress rather than activating", () => {
            const activated = [];
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {onActivate: id => activated.push(id)});
            const stops = [];
            zone.addEventListener("consider", e => {
                if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) stops.push(e.detail.info.id);
            });

            press(item, " ");
            press(item, "Enter");

            expect(stops, "Enter should end an in-progress drag").to.deep.equal(["a"]);
            expect(activated, "Enter must not activate while dragging").to.deep.equal([]);
        });

        it("is picked up when supplied by a later update rather than at init", () => {
            const activated = [];
            const {
                zone,
                action,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const grabs = grabsRecordedOn(zone);

            action.update({items: [{id: "a"}, {id: "b"}], onActivate: id => activated.push(id)});
            press(item, "Enter");

            expect(activated).to.deep.equal(["a"]);
            expect(grabs).to.deep.equal([]);
        });

        it("stops activating again once a later update removes it", () => {
            const activated = [];
            const {
                zone,
                action,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}], {onActivate: id => activated.push(id)});
            const grabs = grabsRecordedOn(zone);

            action.update({items: [{id: "a"}, {id: "b"}]});
            press(item, "Enter");

            expect(activated, "the removed handler must not be called").to.deep.equal([]);
            expect(grabs, "Enter should go back to grabbing").to.deep.equal(["a"]);
        });

        it("does not activate from a nested interactive element", () => {
            const activated = [];
            const {
                children: [item]
            } = createZone([{id: "a"}], {onActivate: id => activated.push(id)});
            const button = document.createElement("button");
            item.appendChild(button);

            press(button, "Enter");

            expect(activated, "the button's own Enter must reach the button, not the zone").to.deep.equal([]);
        });

        it("does not activate when dragDisabled is set", () => {
            const activated = [];
            const {
                children: [item]
            } = createZone([{id: "a"}], {onActivate: id => activated.push(id), dragDisabled: true});

            press(item, "Enter");

            expect(activated, "dragDisabled removes the keydown listener entirely").to.deep.equal([]);
        });
    });

    describe("when the consumer does not opt in", () => {
        it("keeps Enter grabbing", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const grabs = grabsRecordedOn(zone);

            press(item, "Enter");

            expect(grabs, "stock behaviour must be unchanged when onActivate is absent").to.deep.equal(["a"]);
        });

        it("keeps Enter dropping an in-progress drag", () => {
            const {
                zone,
                children: [item]
            } = createZone([{id: "a"}, {id: "b"}]);
            const stops = [];
            zone.addEventListener("consider", e => {
                if (e.detail.info.trigger === TRIGGERS.DRAG_STOPPED) stops.push(e.detail.info.id);
            });

            press(item, " ");
            press(item, "Enter");

            expect(stops).to.deep.equal(["a"]);
        });
    });
});
