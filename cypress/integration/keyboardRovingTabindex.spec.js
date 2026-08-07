import {dndzone} from "../../src/keyboardAction";
import {setKeyboardDragTrigger} from "../../src/keyboardDragTrigger";
import {setRovingTabindexTypes} from "../../src/rovingTabindexTypes";
import {TRIGGERS} from "../../src/constants";

describe("roving tabindex types", () => {
    const actions = [];
    const zones = [];

    function createZone(items, options = {}, zoneStyle) {
        const zone = document.createElement("div");
        if (zoneStyle) Object.assign(zone.style, zoneStyle);
        items.forEach(() => {
            const item = document.createElement("div");
            item.style.height = "20px";
            zone.appendChild(item);
        });
        document.body.appendChild(zone);
        zones.push(zone);
        const action = dndzone(zone, {items, ...options});
        actions.push(action);
        return {zone, action, children: Array.from(zone.children)};
    }

    const sideBySideStyle = left => ({position: "absolute", top: "0px", left, width: "100px"});
    const cellStyle = (top, left) => ({position: "absolute", top, left, width: "100px", height: "100px"});
    // the type every test's zones use, made roving by the beforeEach below
    const grouped = {type: "list"};
    // a type that is never passed to setRovingTabindexTypes, so its zones keep upstream's per-item tab stops
    const plain = {type: "plain"};

    // Two zones side by side: one lies to the right of the other, nothing lies below either.
    function createSideBySideZones(itemsA, itemsB, options = {}) {
        const a = createZone(itemsA, options, sideBySideStyle("0px"));
        const b = createZone(itemsB, options, sideBySideStyle("200px"));
        return {a, b};
    }

    // Two zones stacked: one lies below the other, nothing lies to the right of either.
    function createStackedZones(itemsA, itemsB, options = {}) {
        const stackedStyle = top => ({position: "absolute", left: "0px", top, width: "100px", height: "50px"});
        const a = createZone(itemsA, options, stackedStyle("0px"));
        const b = createZone(itemsB, options, stackedStyle("200px"));
        return {a, b};
    }

    // n x n absolutely positioned zones, row-major: the zone at row r, column c is at index r * n + c
    function createGridZones(n, items, options = {}) {
        const CELL = 100;
        const GAP = 20;
        const grid = [];
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                grid.push(
                    createZone(
                        items.map(id => ({id: `${id}-${row}${col}`})),
                        options,
                        {
                            position: "absolute",
                            top: `${row * (CELL + GAP)}px`,
                            left: `${col * (CELL + GAP)}px`,
                            width: `${CELL}px`,
                            height: `${CELL}px`
                        }
                    )
                );
            }
        }
        return grid;
    }

    function tabIndices() {
        return zones.map(zone => Array.from(zone.children).map(child => child.tabIndex));
    }

    function key(el, k) {
        const event = new KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true});
        el.dispatchEvent(event);
        return event;
    }

    beforeEach(() => {
        setRovingTabindexTypes(["list"]);
    });

    afterEach(() => {
        actions
            .splice(0)
            .reverse()
            .forEach(action => action.destroy());
        zones.splice(0).forEach(zone => zone.remove());
        setKeyboardDragTrigger(null);
        // the setter is global to the document, so a test that widened the list must not leak into the next one
        setRovingTabindexTypes(null);
        // the whole suite shares one scrolling document and focus() scrolls the item into view, so
        // reset - every geometry assertion here assumes the same frame of reference
        window.scrollTo(0, 0);
    });

    describe("roving tabindex", () => {
        it("keeps exactly one tab stop across every zone sharing a roving type", () => {
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            createZone([{id: "b1"}, {id: "b2"}, {id: "b3"}], grouped);
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [-1, -1, -1]
            ]);
        });

        it("leaves a zone of another roving type alone", () => {
            setRovingTabindexTypes(["list", "other"]);
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            createZone([{id: "o1"}, {id: "o2"}], {type: "other"});
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [0, -1]
            ]);
        });

        it("does not touch a zone whose type is not roving", () => {
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            createZone([{id: "b1"}, {id: "b2"}], plain);
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [0, 0]
            ]);
        });

        it("gives the active item the configured zoneItemTabIndex, not a hardcoded 0", () => {
            createZone([{id: "a1"}, {id: "a2"}], {...grouped, zoneItemTabIndex: 3});
            expect(tabIndices()).to.deep.equal([[3, -1]]);
        });

        it("re-asserts the existing tab stop on every update", () => {
            const {action} = createZone([{id: "a1"}, {id: "a2"}], grouped);
            zones[0].children[0].tabIndex = 0;
            zones[0].children[1].tabIndex = 0;
            action.update({items: [{id: "a1"}, {id: "a2"}], ...grouped});
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });

        it("falls back to the first item when the active item is removed", () => {
            const {action} = createZone([{id: "a1"}, {id: "a2"}], grouped);
            zones[0].removeChild(zones[0].children[0]);
            action.update({items: [{id: "a2"}], ...grouped});
            expect(tabIndices()).to.deep.equal([[0]]);
        });

        it("leaves tabindex exactly as upstream does when the type is not roving", () => {
            createZone([{id: "a1"}, {id: "a2"}, {id: "a3"}], plain);
            expect(tabIndices()).to.deep.equal([[0, 0, 0]]);
        });
    });

    describe("at-rest arrow navigation within a zone", () => {
        it("moves the tab stop down the zone and clamps at the last item", () => {
            const {children} = createZone([{id: "a"}, {id: "b"}], grouped);
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(document.activeElement).to.equal(children[1]);
            expect(tabIndices()).to.deep.equal([[-1, 0]]);
            key(children[1], "ArrowDown");
            expect(document.activeElement).to.equal(children[1]);
        });

        it("moves the tab stop up the zone and clamps at the first item", () => {
            const {children} = createZone([{id: "a"}, {id: "b"}], grouped);
            children[1].focus();
            key(children[1], "ArrowUp");
            expect(document.activeElement).to.equal(children[0]);
            key(children[0], "ArrowUp");
            expect(document.activeElement).to.equal(children[0]);
        });

        it("moves within the zone on left/right when there is no second zone", () => {
            const {children} = createZone([{id: "a"}, {id: "b"}], grouped);
            children[0].focus();
            key(children[0], "ArrowRight");
            expect(document.activeElement).to.equal(children[1]);
            key(children[1], "ArrowLeft");
            expect(document.activeElement).to.equal(children[0]);
        });

        it("moves within the zone on up/down when the zones are stacked", () => {
            const {a} = createStackedZones([{id: "a"}, {id: "b"}], [{id: "c"}], grouped);
            a.children[0].focus();
            // The zones are stacked, so nothing lies to the right and ArrowRight steps the zone.
            key(a.children[0], "ArrowRight");
            expect(document.activeElement).to.equal(a.children[1]);
        });

        it("does not navigate at rest when the type is not roving", () => {
            const {children} = createZone([{id: "a"}, {id: "b"}], plain);
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(document.activeElement).to.equal(children[0]);
        });

        it("fires no consider events while navigating at rest", () => {
            const {zone, children} = createZone([{id: "a"}, {id: "b"}], grouped);
            const considers = [];
            zone.addEventListener("consider", e => considers.push(e.detail.info.trigger));
            children[0].focus();
            key(children[0], "ArrowDown");
            key(children[1], "ArrowUp");
            expect(considers).to.be.empty;
        });
    });

    describe("at-rest arrow navigation across zones", () => {
        it("moves to the adjacent zone at the same position with left/right", () => {
            const {a, b} = createSideBySideZones([{id: "a1"}, {id: "a2"}], [{id: "b1"}, {id: "b2"}], grouped);
            a.children[1].focus();
            key(a.children[1], "ArrowRight");
            expect(document.activeElement).to.equal(b.children[1]);
            key(b.children[1], "ArrowLeft");
            expect(document.activeElement).to.equal(a.children[1]);
        });

        it("moves within the zone on down when the zones are side by side", () => {
            const {a} = createSideBySideZones([{id: "a1"}, {id: "a2"}], [{id: "b1"}, {id: "b2"}], grouped);
            a.children[0].focus();
            key(a.children[0], "ArrowDown");
            expect(document.activeElement).to.equal(a.children[1]);
        });

        it("moves to the adjacent zone below with up/down when the zones are stacked", () => {
            const {a, b} = createStackedZones([{id: "a1"}, {id: "a2"}], [{id: "b1"}, {id: "b2"}], grouped);
            a.children[1].focus();
            key(a.children[1], "ArrowDown");
            expect(document.activeElement).to.equal(b.children[1]);
            key(b.children[1], "ArrowUp");
            expect(document.activeElement).to.equal(a.children[1]);
        });

        it("clamps the position to the target zone's item count", () => {
            const {a, b} = createSideBySideZones([{id: "a1"}, {id: "a2"}, {id: "a3"}], [{id: "b1"}], grouped);
            a.children[2].focus();
            key(a.children[2], "ArrowRight");
            expect(document.activeElement).to.equal(b.children[0]);
        });

        it("falls back to within-zone movement past the outermost zone", () => {
            const {a, b} = createSideBySideZones([{id: "a1"}, {id: "a2"}], [{id: "b1"}, {id: "b2"}], grouped);
            b.children[0].focus();
            key(b.children[0], "ArrowRight");
            expect(document.activeElement, "nothing to the right, so the next item").to.equal(b.children[1]);
            a.children[1].focus();
            key(a.children[1], "ArrowLeft");
            expect(document.activeElement, "nothing to the left, so the previous item").to.equal(a.children[0]);
        });

        it("does not cross into a zone whose type is not roving", () => {
            const a = createZone([{id: "a1"}], grouped, sideBySideStyle("0px"));
            createZone([{id: "b1"}], plain, sideBySideStyle("200px"));
            a.children[0].focus();
            key(a.children[0], "ArrowRight");
            expect(document.activeElement).to.equal(a.children[0]);
        });

        it("prefers a zone whose extent overlaps the source's over a nearer diagonal one", () => {
            // The diagonal zone starts closer along the direction of travel, but it shares none of
            // the source's vertical extent, so the aligned one further right wins.
            const source = createZone([{id: "s1"}], grouped, cellStyle("0px", "0px"));
            const diagonal = createZone([{id: "d1"}], grouped, cellStyle("300px", "110px"));
            const aligned = createZone([{id: "g1"}], grouped, cellStyle("0px", "400px"));
            source.children[0].focus();
            key(source.children[0], "ArrowRight");
            expect(document.activeElement).to.equal(aligned.children[0]);
            expect(document.activeElement).not.to.equal(diagonal.children[0]);
        });

        it("takes the least off-axis of two zones that both miss the source's extent", () => {
            // neither candidate overlaps the source's vertical extent, so only the perpendicular
            // offset in the score separates them - otherwise the far off-axis one would win on gap
            const source = createZone([{id: "s1"}], grouped, cellStyle("0px", "0px"));
            const farOffAxis = createZone([{id: "f1"}], grouped, cellStyle("1000px", "110px"));
            const nearlyAligned = createZone([{id: "n1"}], grouped, cellStyle("120px", "300px"));
            source.children[0].focus();
            key(source.children[0], "ArrowRight");
            expect(document.activeElement).to.equal(nearlyAligned.children[0]);
            expect(document.activeElement).not.to.equal(farOffAxis.children[0]);
        });
    });

    describe("zones that offer nowhere to land", () => {
        it("looks past an empty zone to the next zone in that direction", () => {
            const source = createZone([{id: "s1"}, {id: "s2"}], grouped, cellStyle("0px", "0px"));
            createZone([], grouped, cellStyle("0px", "200px"));
            const beyond = createZone([{id: "b1"}, {id: "b2"}], grouped, cellStyle("0px", "400px"));
            source.children[1].focus();
            key(source.children[1], "ArrowRight");
            expect(document.activeElement).to.equal(beyond.children[1]);
        });

        it("moves within the zone when the only zone in that direction is empty", () => {
            const source = createZone([{id: "s1"}, {id: "s2"}], grouped, cellStyle("0px", "0px"));
            createZone([], grouped, cellStyle("0px", "200px"));
            source.children[0].focus();
            key(source.children[0], "ArrowRight");
            expect(document.activeElement, "an arrow always does something").to.equal(source.children[1]);
        });

        it("does not treat a zone stacked below as being to the right when both have no width", () => {
            // two width-less zones share a left edge, so a candidate test that only required
            // starting past the source's right edge would match the one below
            const widthless = top => ({position: "absolute", left: "0px", top, height: "50px"});
            const source = createZone([{id: "s1"}, {id: "s2"}], grouped, widthless("0px"));
            const below = createZone([{id: "b1"}, {id: "b2"}], grouped, widthless("200px"));
            source.children[0].focus();
            key(source.children[0], "ArrowRight");
            expect(document.activeElement, "nothing lies to the right, so the next item").to.equal(source.children[1]);
            key(source.children[1], "ArrowDown");
            expect(document.activeElement, "the zone below is still reachable downwards").to.equal(below.children[1]);
        });

        it("ignores a display:none zone, whose rect sits at the viewport origin", () => {
            // An all-zero rect is up and to the left of any zone laid out away from that origin,
            // so without the zero-area guard it would answer ArrowLeft and ArrowUp from here.
            const source = createZone([{id: "s1"}, {id: "s2"}], grouped, cellStyle("200px", "200px"));
            createZone([{id: "h1"}, {id: "h2"}], grouped, {display: "none"});
            const pressFromSecondItem = k => {
                source.children[1].focus();
                window.scrollTo(0, 0); // focus() may scroll; the guard is about viewport geometry
                key(source.children[1], k);
            };
            pressFromSecondItem("ArrowLeft");
            expect(document.activeElement, "left").to.equal(source.children[0]);
            pressFromSecondItem("ArrowUp");
            expect(document.activeElement, "up").to.equal(source.children[0]);
        });
    });

    describe("at-rest arrow navigation in a 2-D arrangement", () => {
        const at = (grid, row, col) => grid[row * 4 + col];

        it("moves to the adjacent zone in each direction from a middle zone", () => {
            const grid = createGridZones(4, ["s"], grouped);
            const from = at(grid, 1, 1);
            from.children[0].focus();

            key(from.children[0], "ArrowRight");
            expect(document.activeElement, "right").to.equal(at(grid, 1, 2).children[0]);
            key(document.activeElement, "ArrowLeft");
            expect(document.activeElement, "left").to.equal(from.children[0]);
            key(from.children[0], "ArrowDown");
            expect(document.activeElement, "down").to.equal(at(grid, 2, 1).children[0]);
            key(document.activeElement, "ArrowUp");
            expect(document.activeElement, "up").to.equal(from.children[0]);
        });

        it("falls back to within-zone movement at a corner's outward directions", () => {
            const grid = createGridZones(4, ["s", "t"], grouped);
            // nothing lies left of or above the top-left zone, so both arrows step its own items.
            // Starting from the second item so a step back cannot be confused with nothing moving
            const topLeft = at(grid, 0, 0);
            topLeft.children[1].focus();
            key(topLeft.children[1], "ArrowLeft");
            expect(document.activeElement, "no zone to the left, so the previous item").to.equal(topLeft.children[0]);
            topLeft.children[1].focus();
            key(topLeft.children[1], "ArrowUp");
            expect(document.activeElement, "no zone above, so the previous item").to.equal(topLeft.children[0]);

            const bottomRight = at(grid, 3, 3);
            bottomRight.children[0].focus();
            key(bottomRight.children[0], "ArrowRight");
            expect(document.activeElement, "no zone to the right, so within the zone").to.equal(bottomRight.children[1]);
            key(bottomRight.children[1], "ArrowUp");
            expect(document.activeElement, "a zone above wins over the within-zone step").to.equal(at(grid, 2, 3).children[1]);
        });

        it("never crosses into a non-roving or dragDisabled zone sitting in the direction of travel", () => {
            const source = createZone([{id: "s1"}, {id: "s2"}], grouped, cellStyle("200px", "200px"));
            createZone([{id: "u1"}, {id: "u2"}], plain, cellStyle("200px", "400px"));
            createZone([{id: "d1"}, {id: "d2"}], {...grouped, dragDisabled: true}, cellStyle("400px", "200px"));

            source.children[0].focus();
            key(source.children[0], "ArrowRight");
            expect(document.activeElement, "the non-roving zone to the right is not a candidate").to.equal(source.children[1]);
            key(source.children[1], "ArrowUp");
            expect(document.activeElement).to.equal(source.children[0]);
            key(source.children[0], "ArrowDown");
            expect(document.activeElement, "the dragDisabled zone below is not a candidate").to.equal(source.children[1]);
        });
    });

    describe("focus after a drop", () => {
        it("leaves the tab stop on the dropped item, not the first item", () => {
            const items = [{id: "a"}, {id: "b"}, {id: "c"}];
            const {zone, action, children} = createZone(items, grouped);
            children[2].focus();
            key(children[2], " "); // grab
            key(children[2], " "); // drop in place
            // The consumer re-renders with the same order; the elements are the same nodes here,
            // but configure() runs on the drop and must not reassign the tab stop.
            action.update({items, ...grouped});
            expect(Array.from(zone.children).map(c => c.tabIndex)).to.deep.equal([-1, -1, 0]);
        });

        it("re-resolves the tab stop by id when a re-render replaces the dropped item's node", () => {
            const items = [{id: "a"}, {id: "b"}, {id: "c"}];
            const {zone, action, children} = createZone(items, grouped);
            children[2].focus();
            key(children[2], " "); // grab
            key(children[2], " "); // drop in place
            // Simulate a keyed consumer re-render: the framework produces fresh DOM nodes for
            // every item, in the same order, so the old activeItemEl reference is now stale.
            zone.innerHTML = "";
            items.forEach(() => {
                const item = document.createElement("div");
                item.style.height = "20px";
                zone.appendChild(item);
            });
            action.update({items, ...grouped});
            expect(Array.from(zone.children).map(c => c.tabIndex)).to.deep.equal([-1, -1, 0]);
        });
    });

    describe("dragDisabled zones", () => {
        // a dragDisabled zone gets no key handler, so a single tab stop inside it would be a trap

        it("keeps upstream's per-item tab stops rather than a single unusable one", () => {
            createZone([{id: "a1"}, {id: "a2"}, {id: "a3"}], {...grouped, dragDisabled: true});
            expect(tabIndices()).to.deep.equal([[0, 0, 0]]);
        });

        it("honours zoneItemTabIndex like a zone of a non-roving type", () => {
            createZone([{id: "a1"}, {id: "a2"}], {...grouped, dragDisabled: true, zoneItemTabIndex: 2});
            expect(tabIndices()).to.deep.equal([[2, 2]]);
        });

        it("is never crossed into, so the tab stop cannot be stranded there", () => {
            const a = createZone([{id: "a1"}], grouped, sideBySideStyle("0px"));
            createZone([{id: "b1"}, {id: "b2"}], {...grouped, dragDisabled: true}, sideBySideStyle("200px"));
            a.children[0].focus();
            key(a.children[0], "ArrowRight");
            expect(document.activeElement, "the enabled zone keeps the tab stop").to.equal(a.children[0]);
            expect(tabIndices()).to.deep.equal([[0], [0, 0]]);
        });

        it("leaves the enabled zones of the group with a single tab stop between them", () => {
            createZone([{id: "a1"}, {id: "a2"}], grouped, sideBySideStyle("0px"));
            createZone([{id: "d1"}], {...grouped, dragDisabled: true}, sideBySideStyle("200px"));
            createZone([{id: "c1"}, {id: "c2"}], grouped, sideBySideStyle("400px"));
            expect(tabIndices()).to.deep.equal([[0, -1], [0], [-1, -1]]);
        });

        it("rejoins the group when dragDisabled is turned back off", () => {
            const items = [{id: "a1"}, {id: "a2"}];
            const {action} = createZone(items, {...grouped, dragDisabled: true});
            expect(tabIndices()).to.deep.equal([[0, 0]]);
            action.update({items, ...grouped, dragDisabled: false});
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });
    });

    describe("two roving types on one page", () => {
        const rovingX = {type: "x"};
        const rovingY = {type: "y"};

        beforeEach(() => {
            setRovingTabindexTypes(["x", "y"]);
        });

        it("keeps each type's tab stop independent of the other's re-renders", () => {
            const itemsX = [{id: "x1"}, {id: "x2"}, {id: "x3"}];
            const itemsY = [{id: "y1"}, {id: "y2"}];
            const x = createZone(itemsX, rovingX);
            const y = createZone(itemsY, rovingY);
            x.children[0].focus();
            key(x.children[0], "ArrowDown");
            expect(tabIndices()[0], "x's stop moved to its second item").to.deep.equal([-1, 0, -1]);

            y.action.update({items: itemsY, ...rovingY});
            x.action.update({items: itemsX, ...rovingX});

            expect(tabIndices()).to.deep.equal([
                [-1, 0, -1],
                [0, -1]
            ]);
        });

        it("moves each type's stop without disturbing the other's", () => {
            const x = createZone([{id: "x1"}, {id: "x2"}], rovingX);
            const y = createZone([{id: "y1"}, {id: "y2"}], rovingY);
            x.children[0].focus();
            key(x.children[0], "ArrowDown");
            y.children[0].focus();
            key(y.children[0], "ArrowDown");
            expect(tabIndices()).to.deep.equal([
                [-1, 0],
                [-1, 0]
            ]);
        });
    });

    describe("nested interactive descendants", () => {
        function itemWithControl(tagName, attributes = {}) {
            const {children} = createZone([{id: "a"}, {id: "b"}], grouped);
            const control = document.createElement(tagName);
            Object.entries(attributes).forEach(([name, value]) => control.setAttribute(name, value));
            children[0].appendChild(control);
            control.focus();
            return {children, control};
        }

        it("leaves the arrow keys to a nested input", () => {
            const {children, control} = itemWithControl("input", {type: "text"});
            const event = key(control, "ArrowLeft");
            expect(event.defaultPrevented, "the input must keep its own caret movement").to.be.false;
            expect(document.activeElement).to.equal(control);
            expect(tabIndices()).to.deep.equal([[0, -1]]);
            expect(key(control, "ArrowDown").defaultPrevented).to.be.false;
            expect(tabIndices()).to.deep.equal([[0, -1]]);
            expect(children[1].tabIndex).to.equal(-1);
        });

        it("leaves the arrow keys to a nested textarea", () => {
            const {control} = itemWithControl("textarea");
            const event = key(control, "ArrowDown");
            expect(event.defaultPrevented).to.be.false;
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });

        it("leaves the arrow keys to a nested select", () => {
            const {control} = itemWithControl("select");
            const event = key(control, "ArrowDown");
            expect(event.defaultPrevented).to.be.false;
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });

        it("leaves the arrow keys to a nested role=textbox", () => {
            const {control} = itemWithControl("div", {role: "textbox", tabindex: "0"});
            const event = key(control, "ArrowRight");
            expect(event.defaultPrevented).to.be.false;
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });

        it("still navigates when the item itself is the event target", () => {
            const {children} = createZone([{id: "a"}, {id: "b"}], grouped);
            children[0].appendChild(document.createElement("input"));
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(document.activeElement).to.equal(children[1]);
        });
    });

    // a group is only one tab stop if the widgets inside its inactive items leave the tab order too -
    // otherwise every card holding a button is still a stop of its own
    function createZoneWithControls(items, options, makeControl = () => document.createElement("button")) {
        const {zone, action, children} = createZone(items, options);
        const controls = children.map(child => {
            const control = makeControl();
            child.appendChild(control);
            return control;
        });
        // the controls were appended after the action mounted, so re-run configure the way a consumer render would
        action.update({items, ...options});
        return {zone, action, children, controls};
    }

    function attrs(controls) {
        return controls.map(control => control.getAttribute("tabindex"));
    }

    describe("focusable descendants of inactive items", () => {
        it("takes a button inside an inactive item out of the tab order and leaves the active item's alone", () => {
            const {controls} = createZoneWithControls([{id: "a"}, {id: "b"}], grouped);
            expect(attrs(controls)).to.deep.equal([null, "-1"]);
        });

        it("suppresses every kind of focusable descendant", () => {
            const {children, action} = createZone([{id: "a"}, {id: "b"}], grouped);
            const specs = [
                ["a", {href: "#x"}],
                ["button", {}],
                ["input", {}],
                ["select", {}],
                ["textarea", {}],
                ["div", {contenteditable: ""}],
                ["div", {contenteditable: "true"}],
                ["audio", {controls: ""}],
                ["video", {controls: ""}],
                ["iframe", {}],
                ["embed", {}],
                ["object", {}],
                ["area", {href: "#x"}],
                ["summary", {}]
            ];
            const controls = specs.map(([tagName, attributes]) => {
                const control = document.createElement(tagName);
                Object.entries(attributes).forEach(([name, value]) => control.setAttribute(name, value));
                children[1].appendChild(control);
                return control;
            });
            action.update({items: [{id: "a"}, {id: "b"}], ...grouped});
            expect(attrs(controls)).to.deep.equal(controls.map(() => "-1"));
        });

        it("restores the previously inactive item's button when arrowing onto it", () => {
            const {children, controls} = createZoneWithControls([{id: "a"}, {id: "b"}], grouped);
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(attrs(controls), "the attribute is gone again, not left at 0").to.deep.equal(["-1", null]);
        });

        it("preserves and restores a consumer-set tabindex verbatim", () => {
            const {children, action, controls} = createZoneWithControls([{id: "a"}, {id: "b"}], grouped, () => {
                const control = document.createElement("button");
                control.setAttribute("tabindex", "5");
                return control;
            });
            expect(attrs(controls)).to.deep.equal(["5", "-1"]);
            // configure() runs again on every render, and must not save the -1 it wrote itself as the original
            action.update({items: [{id: "a"}, {id: "b"}], ...grouped});
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(attrs(controls)).to.deep.equal(["-1", "5"]);
        });

        it("does not touch the descendants of a zone whose type is not roving", () => {
            const {controls} = createZoneWithControls([{id: "a"}, {id: "b"}], plain);
            expect(attrs(controls)).to.deep.equal([null, null]);
        });

        it("restores every suppressed descendant on destroy", () => {
            const {action, controls} = createZoneWithControls([{id: "a"}, {id: "b"}, {id: "c"}], grouped);
            expect(attrs(controls)).to.deep.equal([null, "-1", "-1"]);
            action.destroy();
            expect(attrs(controls)).to.deep.equal([null, null, null]);
        });

        it("restores every suppressed descendant when the zone's type changes to a non-roving one", () => {
            const items = [{id: "a"}, {id: "b"}];
            const {action, controls} = createZoneWithControls(items, grouped);
            // without this the test passes on a build that never suppressed anything in the first place
            expect(attrs(controls), "suppressed to begin with").to.deep.equal([null, "-1"]);
            action.update({items, ...plain});
            expect(attrs(controls)).to.deep.equal([null, null]);
        });

        it("restores every suppressed descendant when the zone is destroyed mid-grab", () => {
            // unmounting mid-grab ends the grab, and that re-renders every zone - including this dying one.
            // Nothing restores after that pass, so it must not be able to suppress anything again.
            const items = [{id: "a"}, {id: "b"}];
            const {children, action, controls} = createZoneWithControls(items, grouped);
            children[0].focus();
            key(children[0], " "); // grab the first item
            // without this the test passes on a build that never suppressed anything in the first place
            expect(attrs(controls), "the non-grabbed item is suppressed mid-grab").to.deep.equal([null, "-1"]);
            action.destroy();
            expect(attrs(controls), "the zone is gone, so nothing is left to hand the tab order back later").to.deep.equal([null, null]);
        });

        it("restores a descendant the consumer has since moved into a nested zone", () => {
            // restore has to undo what suppression actually did, not what a fresh query would find now -
            // otherwise an element that has moved under a nested zone is stranded at -1 for good
            const items = [{id: "a"}, {id: "b"}];
            const {children, controls} = createZoneWithControls(items, grouped);
            expect(attrs(controls)).to.deep.equal([null, "-1"]);
            const nested = document.createElement("div");
            const nestedItem = document.createElement("div");
            nested.appendChild(nestedItem);
            children[1].appendChild(nested);
            nestedItem.appendChild(controls[1]);
            actions.push(dndzone(nested, {items: [{id: "n1"}], type: "nested"}));
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(attrs(controls), "suppressed by us, so restored by us wherever it now sits").to.deep.equal(["-1", null]);
        });

        it("picks up a tabindex the consumer changes while the item is inactive", () => {
            const items = [{id: "a"}, {id: "b"}];
            const {children, action, controls} = createZoneWithControls(items, grouped, () => {
                const control = document.createElement("button");
                control.setAttribute("tabindex", "0");
                return control;
            });
            expect(attrs(controls)).to.deep.equal(["0", "-1"]);
            // the consumer's binding moves from 0 to 3 while the item is inactive
            controls[1].setAttribute("tabindex", "3");
            action.update({items, ...grouped});
            expect(controls[1].getAttribute("tabindex"), "still inactive, so still suppressed").to.equal("-1");
            children[0].focus();
            key(children[0], "ArrowDown");
            expect(attrs(controls), "restored to the consumer's newest value, not the one it had on the first pass").to.deep.equal(["-1", "3"]);
        });

        it("keeps the non-grabbed items' descendants suppressed during a drag", () => {
            const items = [{id: "a"}, {id: "b"}];
            const {children, action, controls} = createZoneWithControls(items, grouped);
            children[0].focus();
            key(children[0], " "); // grab the first item
            action.update({items, ...grouped});
            expect(attrs(controls), "the grabbed item keeps its widgets; Tab must move between zones").to.deep.equal([null, "-1"]);
            key(children[0], " "); // drop, so the zone is not left mid-drag
        });

        it("leaves the items of a nested dndzone to that zone", () => {
            const items = [{id: "a"}, {id: "b"}];
            const {children, action} = createZone(items, grouped);
            const nested = document.createElement("div");
            const nestedItem = document.createElement("div");
            nested.appendChild(nestedItem);
            children[1].appendChild(nested);
            const nestedAction = dndzone(nested, {items: [{id: "n1"}], type: "nested"});
            actions.push(nestedAction);
            const nestedButton = document.createElement("button");
            nestedItem.appendChild(nestedButton);
            action.update({items, ...grouped});
            expect(nestedButton.hasAttribute("tabindex"), "inside a nested zone's item, so not ours to suppress").to.be.false;
        });
    });

    describe("reordering during a live drag", () => {
        // each arrow is followed by the re-render a real consumer performs on finalize, which is
        // what lets a second arrow keep moving the same item
        function grabAndPress(zoneOptions, keys) {
            const {zone, action, children} = createZone([{id: "a"}, {id: "b"}, {id: "c"}], zoneOptions);
            const nodeById = {a: children[0], b: children[1], c: children[2]};
            const finalizes = [];
            zone.addEventListener("finalize", e => finalizes.push(e.detail.items.map(item => item.id)));
            const grabbed = children[0];
            grabbed.focus();
            key(grabbed, " "); // grab
            keys.forEach(k => {
                key(grabbed, k);
                const order = finalizes[finalizes.length - 1] || ["a", "b", "c"];
                order.forEach(id => zone.appendChild(nodeById[id]));
                action.update({items: order.map(id => ({id})), ...zoneOptions});
            });
            key(grabbed, " "); // drop, so the zone is not left mid-drag
            return finalizes;
        }

        it("moves the grabbed item down the zone inside a roving type", () => {
            expect(grabAndPress(grouped, ["ArrowDown", "ArrowDown"])).to.deep.equal([
                ["b", "a", "c"],
                ["b", "c", "a"]
            ]);
        });

        it("moves the grabbed item down the zone identically when the type is not roving", () => {
            expect(grabAndPress(plain, ["ArrowDown", "ArrowDown"])).to.deep.equal([
                ["b", "a", "c"],
                ["b", "c", "a"]
            ]);
        });

        it("reorders on right/left too, inside a roving type", () => {
            expect(grabAndPress(grouped, ["ArrowRight", "ArrowLeft"])).to.deep.equal([
                ["b", "a", "c"],
                ["a", "b", "c"]
            ]);
        });

        it("reorders on right/left too, when the type is not roving", () => {
            expect(grabAndPress(plain, ["ArrowRight", "ArrowLeft"])).to.deep.equal([
                ["b", "a", "c"],
                ["a", "b", "c"]
            ]);
        });

        it("does not move the grabbed item past the start of the zone", () => {
            expect(grabAndPress(grouped, ["ArrowUp"]), "already first - nothing to swap with").to.be.empty;
        });
    });

    describe("relocating the grabbed item across zones", () => {
        // Tab already carries the grabbed item into the zone it lands on. An arrow pointing at a zone
        // the item could legally be dropped into has to mean the same thing, or the key would say one
        // thing at rest and another mid-grab.
        function setup(itemsA, itemsB, optionsA = grouped, optionsB = grouped) {
            const a = createZone(itemsA, optionsA, sideBySideStyle("0px"));
            const b = createZone(itemsB, optionsB, sideBySideStyle("200px"));
            const finalizes = [];
            a.zone.addEventListener("finalize", e => finalizes.push(["a", e.detail.items.map(item => item.id)]));
            b.zone.addEventListener("finalize", e => finalizes.push(["b", e.detail.items.map(item => item.id)]));
            return {a, b, finalizes};
        }

        it("moves the grabbed item into the zone lying in the pressed direction", () => {
            const {a, finalizes} = setup([{id: "a1"}, {id: "a2"}], [{id: "b1"}]);
            a.children[0].focus();
            key(a.children[0], " "); // grab
            key(a.children[0], "ArrowRight");
            expect(finalizes).to.deep.equal([
                ["a", ["a2"]],
                ["b", ["a1", "b1"]]
            ]);
            key(a.children[0], " "); // drop, so the zone is not left mid-drag
        });

        it("reorders within the zone when nothing lies in the pressed direction", () => {
            const {a, finalizes} = setup([{id: "a1"}, {id: "a2"}], [{id: "b1"}]);
            a.children[0].focus();
            key(a.children[0], " ");
            key(a.children[0], "ArrowDown");
            expect(finalizes, "the zones are side by side, so nothing is below").to.deep.equal([["a", ["a2", "a1"]]]);
            key(a.children[0], " ");
        });

        it("does not relocate into a zone that refuses items from elsewhere", () => {
            const {a, finalizes} = setup([{id: "a1"}, {id: "a2"}], [{id: "b1"}], grouped, {...grouped, dropFromOthersDisabled: true});
            a.children[0].focus();
            key(a.children[0], " ");
            key(a.children[0], "ArrowRight");
            expect(finalizes, "not a legal destination, so the within-zone reorder").to.deep.equal([["a", ["a2", "a1"]]]);
            key(a.children[0], " ");
        });

        it("neither focuses nor relocates into a zone of another roving type", () => {
            // the group is the type now, so a zone of a different type is out of it in both modes -
            // it is not an at-rest focus target either, which is what the two arrows below assert
            setRovingTabindexTypes(["list", "other"]);
            const {a, b, finalizes} = setup([{id: "a1"}, {id: "a2"}], [{id: "b1"}], grouped, {type: "other"});
            a.children[0].focus();
            key(a.children[0], "ArrowRight");
            expect(document.activeElement, "another type is another group, so the within-zone step").to.equal(a.children[1]);
            expect(b.zone.contains(document.activeElement)).to.be.false;

            a.children[0].focus();
            key(a.children[0], " ");
            key(a.children[0], "ArrowRight");
            expect(finalizes, "the item cannot be dropped there, so the within-zone reorder").to.deep.equal([["a", ["a2", "a1"]]]);
            key(a.children[0], " ");
        });

        it("relocates into an empty zone, which at rest offers nowhere to land", () => {
            const {a, finalizes} = setup([{id: "a1"}, {id: "a2"}], []);
            a.children[0].focus();
            key(a.children[0], "ArrowRight");
            expect(document.activeElement, "at rest an empty zone is skipped").to.equal(a.children[1]);

            a.children[0].focus();
            key(a.children[0], " ");
            key(a.children[0], "ArrowRight");
            expect(finalizes).to.deep.equal([
                ["a", ["a2"]],
                ["b", ["a1"]]
            ]);
            key(a.children[0], " ");
        });

        it("measures the direction from the zone that currently holds the item", () => {
            // three zones left to right: b, a, c. Grab in the middle one, send the item left into b, then
            // press right - the item is in b now, so the zone to its right is a, not the one right of a.
            const b = createZone([{id: "b1"}], grouped, sideBySideStyle("0px"));
            const a = createZone([{id: "a1"}, {id: "a2"}], grouped, sideBySideStyle("200px"));
            const c = createZone([{id: "c1"}], grouped, sideBySideStyle("400px"));
            const finalizes = [];
            [
                ["a", a],
                ["b", b],
                ["c", c]
            ].forEach(([name, zone]) => zone.zone.addEventListener("finalize", e => finalizes.push([name, e.detail.items.map(item => item.id)])));

            a.children[0].focus();
            key(a.children[0], " "); // grab a1
            key(a.children[0], "ArrowLeft"); // into b
            key(a.children[0], "ArrowRight"); // back out of b, into the zone to b's right
            expect(finalizes).to.deep.equal([
                ["a", ["a2"]],
                ["b", ["b1", "a1"]],
                ["b", ["b1"]],
                ["a", ["a1", "a2"]]
            ]);
            key(a.children[0], " ");
        });

        it("leaves a zone of a non-roving type with upstream's within-zone reorder", () => {
            const {a, finalizes} = setup([{id: "a1"}, {id: "a2"}], [{id: "b1"}], plain, plain);
            a.children[0].focus();
            key(a.children[0], " ");
            key(a.children[0], "ArrowRight");
            expect(finalizes, "not a roving type, so no directional rule at all").to.deep.equal([["a", ["a2", "a1"]]]);
            key(a.children[0], " ");
        });
    });

    describe("unmounting the zone that holds the tab stop", () => {
        it("does not carry a stale item id into a later mount", () => {
            const first = createZone([{id: "a"}, {id: "b"}, {id: "c"}], grouped);
            first.children[0].focus();
            key(first.children[0], "ArrowDown");
            expect(tabIndices()).to.deep.equal([[-1, 0, -1]]);

            first.action.destroy();
            first.zone.remove();
            zones.splice(zones.indexOf(first.zone), 1);

            createZone([{id: "a"}, {id: "b"}, {id: "c"}], grouped);
            expect(tabIndices(), "a fresh mount starts on its first item").to.deep.equal([[0, -1, -1]]);
        });
    });

    describe("a zone leaving the group with the tab stop", () => {
        // nothing else comes back for the group afterwards, so a survivor would be left with every item at -1 -
        // no keyboard-reachable item at all. A surviving sibling is the point of each of these: a freshly mounted
        // zone would re-assert the group on its own render and hide the bug

        it("hands the tab stop to a surviving sibling when the holder's type changes", () => {
            const items = [{id: "a1"}, {id: "a2"}];
            const {action} = createZone(items, grouped);
            const survivor = createZoneWithControls([{id: "b1"}, {id: "b2"}], grouped);
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [-1, -1]
            ]);
            expect(attrs(survivor.controls)).to.deep.equal(["-1", "-1"]);

            action.update({items, ...plain});
            expect(tabIndices(), "the survivor must not be left without a tab stop").to.deep.equal([
                [0, 0],
                [0, -1]
            ]);
            expect(attrs(survivor.controls), "and the new active item's widgets come back with it").to.deep.equal([null, "-1"]);
        });

        it("hands the tab stop to a surviving sibling when the holder becomes dragDisabled", () => {
            const items = [{id: "a1"}, {id: "a2"}];
            const {action} = createZone(items, grouped);
            createZone([{id: "b1"}, {id: "b2"}], grouped);
            action.update({items, ...grouped, dragDisabled: true});
            expect(tabIndices()).to.deep.equal([
                [0, 0],
                [0, -1]
            ]);
        });

        it("hands the tab stop to a surviving sibling when the holder is destroyed", () => {
            const a = createZone([{id: "a1"}, {id: "a2"}], grouped);
            const b = createZone([{id: "b1"}, {id: "b2"}], grouped);
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [-1, -1]
            ]);

            a.action.destroy();
            expect(
                Array.from(b.zone.children).map(child => child.tabIndex),
                "the survivor keeps the group usable"
            ).to.deep.equal([0, -1]);
        });

        it("clears the group cleanly when no zone of the type is left", () => {
            const {action, zone} = createZone([{id: "a1"}, {id: "a2"}], grouped);
            action.destroy();
            zone.remove();
            zones.splice(zones.indexOf(zone), 1);

            createZone([{id: "a1"}, {id: "a2"}], grouped);
            expect(tabIndices(), "a fresh group starts on its first item").to.deep.equal([[0, -1]]);
        });

        it("does not resurrect the stop by id after the holder changed type and was then destroyed", () => {
            // the entry was filed under "list", so releasing it against the zone's new type would leave the id
            // behind - and with it the detached node, in a strong Map
            const items = [{id: "a"}, {id: "b"}];
            const first = createZone(items, grouped);
            first.children[0].focus();
            key(first.children[0], "ArrowDown"); // the stop is on "b" now
            expect(tabIndices()).to.deep.equal([[-1, 0]]);

            first.action.update({items, ...plain});
            first.action.destroy();
            first.zone.remove();
            zones.splice(zones.indexOf(first.zone), 1);

            createZone([{id: "x"}, {id: "b"}], grouped);
            expect(tabIndices(), "the departed zone's id must not pick the new zone's second item").to.deep.equal([[0, -1]]);
        });
    });

    describe("a nested zone sharing its parent's type", () => {
        // dragging between nested lists is the ordinary reason to share a type, so a nested zone must not be
        // swept into its parent's group: one tab stop for the whole tree would leave its items reachable by
        // neither Tab nor arrow, since a zone inside the source lies in no direction from it
        function createParentWithNested(parentItems, nestedItems, options = grouped) {
            const zone = document.createElement("div");
            parentItems.forEach(() => {
                const item = document.createElement("div");
                item.style.height = "20px";
                zone.appendChild(item);
            });
            const nested = document.createElement("div");
            nestedItems.forEach(() => nested.appendChild(document.createElement("div")));
            zone.children[1].appendChild(nested);
            document.body.appendChild(zone);
            zones.push(zone);
            // a nested action is configured before its parent's, exactly as Svelte orders them - which is the
            // one pass that cannot yet see the ancestor keeping it out of the group
            actions.push(dndzone(nested, {items: nestedItems, ...options}));
            actions.push(dndzone(zone, {items: parentItems, ...options}));
            return {zone, nested};
        }

        it("keeps its own per-item tab stops instead of joining the group", () => {
            const {nested} = createParentWithNested([{id: "a"}, {id: "b"}], [{id: "n1"}, {id: "n2"}]);
            expect(
                Array.from(nested.children).map(child => child.tabIndex),
                "a nested zone owns its items' tabindex"
            ).to.deep.equal([0, 0]);
        });

        it("honours its own zoneItemTabIndex, like any zone outside a group", () => {
            const {nested} = createParentWithNested([{id: "a"}, {id: "b"}], [{id: "n1"}, {id: "n2"}], {...grouped, zoneItemTabIndex: 4});
            expect(Array.from(nested.children).map(child => child.tabIndex)).to.deep.equal([4, 4]);
        });

        it("leaves the outer group with its single tab stop, shared with its siblings", () => {
            const sibling = createZone([{id: "s1"}, {id: "s2"}], grouped);
            const {zone, nested} = createParentWithNested([{id: "a"}, {id: "b"}], [{id: "n1"}]);
            // the sibling mounted first, so it is the one holding the group's stop
            expect(
                Array.from(sibling.zone.children).map(child => child.tabIndex),
                "the sibling holds the group's stop"
            ).to.deep.equal([0, -1]);
            expect(
                Array.from(zone.children).map(child => child.tabIndex),
                "so the outer zone has none of its own"
            ).to.deep.equal([-1, -1]);
            expect(
                Array.from(nested.children).map(child => child.tabIndex),
                "the nested zone is outside all of that"
            ).to.deep.equal([0]);
        });

        it("is not an arrow-key destination for the outer group's tab stop", () => {
            const {zone, nested} = createParentWithNested([{id: "a"}, {id: "b"}], [{id: "n1"}]);
            zone.children[0].focus();
            key(zone.children[0], "ArrowDown");
            expect(document.activeElement, "the step stays in the outer zone").to.equal(zone.children[1]);
            expect(nested.contains(document.activeElement)).to.be.false;
        });
    });

    describe("type boundaries", () => {
        it("keeps zones of two roving types apart", () => {
            setRovingTabindexTypes(["x", "y"]);
            const a = createZone([{id: "a1"}, {id: "a2"}], {type: "x"}, sideBySideStyle("0px"));
            const b = createZone([{id: "b1"}, {id: "b2"}], {type: "y"}, sideBySideStyle("200px"));
            expect(tabIndices(), "each type keeps its own tab stop").to.deep.equal([
                [0, -1],
                [0, -1]
            ]);
            a.children[0].focus();
            key(a.children[0], "ArrowRight");
            expect(b.zone.contains(document.activeElement), "arrows must not cross type boundaries").to.be.false;
        });

        it("leaves a zone of a non-roving type with one tab stop per item", () => {
            createZone([{id: "a1"}, {id: "a2"}], grouped, sideBySideStyle("0px"));
            createZone([{id: "b1"}, {id: "b2"}, {id: "b3"}], plain, sideBySideStyle("200px"));
            expect(tabIndices()).to.deep.equal([
                [0, -1],
                [0, 0, 0]
            ]);
        });
    });

    describe("changing the roving types after the zones have mounted", () => {
        it("collapses a type to a single tab stop when it is added", () => {
            setRovingTabindexTypes(null);
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            createZone([{id: "b1"}, {id: "b2"}, {id: "b3"}], grouped);
            expect(tabIndices(), "not roving yet, so upstream's per-item tab stops").to.deep.equal([
                [0, 0],
                [0, 0, 0]
            ]);

            setRovingTabindexTypes(["list"]);
            expect(tabIndices(), "one tab stop across both zones, with no re-render from the consumer").to.deep.equal([
                [0, -1],
                [-1, -1, -1]
            ]);
        });

        it("restores every item's tabindex and every suppressed descendant when the type is removed", () => {
            const items = [{id: "a"}, {id: "b"}, {id: "c"}];
            const options = {...grouped, zoneItemTabIndex: 2};
            const {controls} = createZoneWithControls(items, options, () => {
                const control = document.createElement("button");
                control.setAttribute("tabindex", "5");
                return control;
            });
            const untouched = createZoneWithControls([{id: "u1"}, {id: "u2"}], plain);
            expect(tabIndices()).to.deep.equal([
                [2, -1, -1],
                [0, 0]
            ]);
            expect(attrs(controls)).to.deep.equal(["5", "-1", "-1"]);

            setRovingTabindexTypes(null);
            expect(tabIndices(), "every item back to its zone's zoneItemTabIndex").to.deep.equal([
                [2, 2, 2],
                [0, 0]
            ]);
            expect(attrs(controls), "the consumer's own value back, verbatim").to.deep.equal(["5", "5", "5"]);
            expect(attrs(untouched.controls), "never suppressed, so still no attribute at all").to.deep.equal([null, null]);
        });

        it("leaves no tabindex attribute behind on a descendant that never had one", () => {
            const items = [{id: "a"}, {id: "b"}];
            const {controls} = createZoneWithControls(items, grouped);
            expect(attrs(controls)).to.deep.equal([null, "-1"]);
            setRovingTabindexTypes(null);
            expect(attrs(controls), "no trace of the suppression is left in the DOM").to.deep.equal([null, null]);
        });

        it("is inert for a type no zone uses", () => {
            setRovingTabindexTypes(["no-such-type"]);
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            expect(tabIndices(), "the listed type matches nothing, so nothing changes").to.deep.equal([[0, 0]]);
        });

        it("takes effect for zones that mount after the call", () => {
            setRovingTabindexTypes(["late"]);
            createZone([{id: "a1"}, {id: "a2"}], {type: "late"});
            createZone([{id: "b1"}], {type: "late"});
            expect(tabIndices()).to.deep.equal([[0, -1], [-1]]);
        });

        it("rejects anything that is not an array of non-empty strings", () => {
            expect(() => setRovingTabindexTypes("list")).to.throw("setRovingTabindexTypes");
            expect(() => setRovingTabindexTypes("list")).to.throw("array of non-empty strings");
            expect(() => setRovingTabindexTypes(3)).to.throw("array of non-empty strings");
            expect(() => setRovingTabindexTypes({})).to.throw("array of non-empty strings");
            expect(() => setRovingTabindexTypes(["list", 3])).to.throw("index 1");
            expect(() => setRovingTabindexTypes(["list", ""])).to.throw("index 1");
            expect(() => setRovingTabindexTypes([{}])).to.throw("index 0");
        });

        it("turns the feature off when called with no argument at all", () => {
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            expect(tabIndices()).to.deep.equal([[0, -1]]);
            setRovingTabindexTypes();
            expect(tabIndices()).to.deep.equal([[0, 0]]);
        });

        it("is inert when called with the types already in effect", () => {
            // the idiomatic `$: setRovingTabindexTypes(types)` re-fires on any reactive tick, and a re-render mid-grab
            // re-focuses the grabbed item, which scrolls it back into view under the user
            const items = [{id: "a"}, {id: "b"}];
            const {children} = createZone(items, grouped);
            children[0].focus();
            key(children[0], " "); // grab
            const realFocus = children[0].focus;
            let focusCalls = 0;
            children[0].focus = function countedFocus(...args) {
                focusCalls++;
                return realFocus.apply(this, args);
            };
            setRovingTabindexTypes(["list"]);
            expect(focusCalls, "an unchanged call must not re-render the zones").to.equal(0);
            setRovingTabindexTypes(["list", "other"]);
            expect(focusCalls, "a call that does change the types still does").to.equal(1);
            children[0].focus = realFocus;
            key(children[0], " "); // drop, so the zone is not left mid-drag
        });
    });

    describe("zones that name no type", () => {
        // a zone with no type still has one internally, so null names it - the sentinel itself is private
        it("makes untyped zones roving when the list contains null", () => {
            setRovingTabindexTypes([null]);
            createZone([{id: "a1"}, {id: "a2"}]);
            createZone([{id: "b1"}]);
            expect(tabIndices(), "one tab stop across both untyped zones").to.deep.equal([[0, -1], [-1]]);
        });

        it("accepts undefined in the array as the same thing", () => {
            setRovingTabindexTypes([undefined]);
            createZone([{id: "a1"}, {id: "a2"}]);
            expect(tabIndices()).to.deep.equal([[0, -1]]);
        });

        it("leaves untyped zones alone when the list does not name them", () => {
            createZone([{id: "a1"}, {id: "a2"}]);
            expect(tabIndices(), "only 'list' is roving, so an untyped zone keeps its per-item stops").to.deep.equal([[0, 0]]);
        });

        it("keeps untyped zones apart from a named roving type", () => {
            setRovingTabindexTypes([null, "list"]);
            createZone([{id: "a1"}, {id: "a2"}], grouped);
            createZone([{id: "u1"}, {id: "u2"}]);
            expect(tabIndices(), "two types, so a tab stop each").to.deep.equal([
                [0, -1],
                [0, -1]
            ]);
        });
    });

    describe("interaction with keyboardDragTrigger", () => {
        it("leaves Enter untouched under the roving layer when the trigger is 'space'", () => {
            setKeyboardDragTrigger("space");
            const {zone, children} = createZone([{id: "a"}, {id: "b"}], grouped);
            const considers = [];
            zone.addEventListener("consider", e => considers.push(e.detail.info.trigger));
            children[0].focus();
            const event = key(children[0], "Enter");
            expect(considers, "Enter must not start a grab").to.be.empty;
            expect(event.defaultPrevented, "Enter must not be preventDefault-ed").to.be.false;
        });

        it("still grabs on Space under the roving layer when the trigger is 'space'", () => {
            setKeyboardDragTrigger("space");
            const {zone, children} = createZone([{id: "a"}, {id: "b"}], grouped);
            const considers = [];
            zone.addEventListener("consider", e => considers.push(e.detail.info.trigger));
            children[0].focus();
            key(children[0], " ");
            expect(considers).to.deep.equal([TRIGGERS.DRAG_STARTED]);
        });
    });

    describe("screen-reader wording", () => {
        // the instruction divs are rendered once for the whole document, so the only thing a zone can do is
        // point at the one that describes it
        const ZONE_ACTIVE_ID = "dnd-zone-active";
        const ZONE_ACTIVE_ROVING_ID = "dnd-zone-active-roving";
        const ZONE_DRAG_DISABLED_ID = "dnd-zone-drag-disabled";

        function alertText() {
            return document.getElementById("dnd-action-aria-alert").textContent;
        }

        function describedBy(zone) {
            return zone.getAttribute("aria-describedby");
        }

        function labelled(created, zoneLabel, itemLabels) {
            created.zone.setAttribute("aria-label", zoneLabel);
            created.children.forEach((child, i) => child.setAttribute("aria-label", itemLabels[i]));
            return created;
        }

        it("describes a zone in the group with the roving instruction and its neighbours with the ordinary one", () => {
            const {zone: rovingZone} = createZone([{id: "a1"}, {id: "a2"}], grouped);
            const {zone: plainZone} = createZone([{id: "p1"}, {id: "p2"}], plain);
            expect(describedBy(rovingZone)).to.equal(ZONE_ACTIVE_ROVING_ID);
            expect(describedBy(plainZone), "a zone of a non-roving type still tabs to its items").to.equal(ZONE_ACTIVE_ID);
        });

        it("keeps a dragDisabled zone on the disabled instruction even when its type is roving", () => {
            const {zone} = createZone([{id: "a1"}], {...grouped, dragDisabled: true});
            expect(describedBy(zone)).to.equal(ZONE_DRAG_DISABLED_ID);
        });

        it("leaves a nested zone on the ordinary instruction, since it keeps its per-item tab stops", () => {
            const outer = document.createElement("div");
            const item = document.createElement("div");
            const inner = document.createElement("div");
            inner.appendChild(document.createElement("div"));
            item.appendChild(inner);
            outer.appendChild(item);
            document.body.appendChild(outer);
            zones.push(outer);
            // nested actions are configured before their parent's, exactly as Svelte does it
            actions.push(dndzone(inner, {items: [{id: "n1"}], ...grouped}));
            actions.push(dndzone(outer, {items: [{id: "a1"}], ...grouped}));
            expect(describedBy(outer)).to.equal(ZONE_ACTIVE_ROVING_ID);
            expect(describedBy(inner)).to.equal(ZONE_ACTIVE_ID);
        });

        it("flips a mounted zone's instruction in both directions when the roving types change", () => {
            setRovingTabindexTypes(null);
            const {zone} = createZone([{id: "a1"}, {id: "a2"}], grouped);
            expect(describedBy(zone), "not roving yet").to.equal(ZONE_ACTIVE_ID);

            setRovingTabindexTypes(["list"]);
            expect(describedBy(zone), "the setter re-runs configure for every zone").to.equal(ZONE_ACTIVE_ROVING_ID);

            setRovingTabindexTypes(null);
            expect(describedBy(zone), "and back again with no re-render from the consumer").to.equal(ZONE_ACTIVE_ID);
        });

        it("tells the user the arrows move the item between the lists when the grab is in a group", () => {
            const {a} = createSideBySideZones([{id: "a1"}], [{id: "b1"}], grouped);
            labelled(a, "To do", ["Card A"]);
            key(a.children[0], " ");
            expect(alertText()).to.equal(
                "Started dragging item Card A. Use the arrow keys to move it within its list To do, or into another list in that direction"
            );
        });

        it("keeps the tab-to-another-list wording for a zone that is not in a group", () => {
            const {a} = createSideBySideZones([{id: "a1"}], [{id: "b1"}], plain);
            labelled(a, "To do", ["Card A"]);
            key(a.children[0], " ");
            expect(alertText()).to.equal(
                "Started dragging item Card A. Use the arrow keys to move it within its list To do, or tab to another list in order to move the item into it"
            );
        });

        it("promises no other list when the group has only the one zone", () => {
            const a = labelled(createZone([{id: "a1"}, {id: "a2"}], grouped), "To do", ["Card A", "Card B"]);
            key(a.children[0], " ");
            expect(alertText()).to.equal("Started dragging item Card A. Use the arrow keys to move it within its list To do");
        });
    });
});
