import {TRIGGERS} from "../../src/constants";
import {alertText, createFrame, createList, failOnListenerErrors, key, mouse} from "./helpers/otherWindow";

failOnListenerErrors();

describe("drop-target eligibility", () => {
    const cleanups = [];
    afterEach(() =>
        cleanups
            .splice(0)
            .reverse()
            .forEach(cleanup => cleanup())
    );

    function list(doc, options) {
        const created = createList(doc, options);
        cleanups.push(() => {
            created.action.destroy();
            created.zone.remove();
        });
        return created;
    }
    function frame() {
        const created = createFrame();
        cleanups.push(() => created.frame.remove());
        return created;
    }
    function grab(created, name) {
        created.element(name).focus();
        key(created.element(name), "Enter");
    }

    [false, true].forEach(inFrame => {
        const where = inFrame ? "in an iframe" : "in the same document";
        [{type: "other"}, {dropFromOthersDisabled: true}].forEach(restriction => {
            it(`does not move a keyboard-dragged item into ${JSON.stringify(restriction)} ${where}`, () => {
                const targetDoc = inFrame ? frame().doc : document;
                const source = list(document, {label: "Source", names: ["a"], type: "cards"});
                const target = list(targetDoc, {label: "Target", names: ["b"], type: "cards", ...restriction});
                grab(source, "a");
                const announcement = alertText(document);
                expect(target.zone.tabIndex).to.equal(-1);
                // A click or application focus can reach a zone even with tabindex=-1.
                target.zone.focus();
                expect(source.names()).to.deep.equal(["a"]);
                expect(target.names()).to.deep.equal(["b"]);
                expect(target.events, "no rejected transfer events").to.deep.equal([]);
                expect(alertText(document)).to.equal(announcement);
                key(source.win, "Escape");
                expect(source.triggers[source.triggers.length - 1]).to.equal(TRIGGERS.DRAG_STOPPED);
            });
        });
    });

    it("still receives a keyboard item when only pickup is disabled", () => {
        const source = list(document, {label: "Source", names: ["a"]});
        const target = list(document, {label: "Target", names: ["b"], dragDisabled: true});
        grab(source, "a");
        target.zone.focus();
        expect(target.names()).to.include("a");
        key(window, "Escape");
    });

    it("rejects an incoming return to a dropFromOthersDisabled list after moving out", () => {
        const source = list(document, {label: "Source", names: ["a"], dropFromOthersDisabled: true});
        const target = list(document, {label: "Target", names: ["b"]});
        grab(source, "a");
        target.zone.focus();
        // Once the grab has moved out, the old list is an incoming destination and is disabled.
        expect(source.zone.tabIndex).to.equal(-1);
        source.zone.focus();
        expect(source.names()).to.deep.equal([]);
        expect(target.names()).to.include("a");
        key(window, "Escape");
    });

    [false, true].forEach(hasOtherDestination => {
        it(`does not count or style a zone inside the grabbed item (${hasOtherDestination ? "another valid list" : "no other list"})`, () => {
            const source = list(document, {label: "Source", names: ["a"]});
            const nested = list(document, {label: "Nested", names: ["n"]});
            source.element("a").appendChild(nested.zone);
            if (hasOtherDestination) list(document, {label: "Target", names: ["b"]});
            grab(source, "a");
            expect(nested.zone.tabIndex).to.equal(-1);
            expect(nested.zone.style.outline).to.equal("");
            expect(alertText(document).includes("or tab to another list")).to.equal(hasOtherDestination);
            nested.zone.focus();
            expect(source.names()).to.deep.equal(["a"]);
            expect(nested.names()).to.deep.equal(["n"]);
            key(window, "Escape");
        });
    });

    function startPointer(source) {
        source.element("a").dispatchEvent(mouse(source.win, "mousedown", 50, 15));
        source.win.dispatchEvent(mouse(source.win, "mousemove", 50, 20));
        cleanups.push(() => source.win.dispatchEvent(mouse(source.win, "mouseup", 50, 20)));
    }
    function update(created, options) {
        created.action.update({items: created.names().map(name => ({id: name, name})), dropAnimationDisabled: true, ...options});
    }

    ["style", "classes", "enable incoming"].forEach(change => {
        it(`does not style an other-type zone on a mid-drag ${change} change`, () => {
            const source = list(document, {label: "Source", names: ["a"], type: "cards", dropAnimationDisabled: true});
            const target = list(document, {label: "Target", names: ["b"], type: "other", dropFromOthersDisabled: true});
            startPointer(source);
            update(target, {
                type: "other",
                dropFromOthersDisabled: change !== "enable incoming",
                dropTargetStyle: change === "classes" ? {} : {outline: "solid 4px red"},
                dropTargetClasses: change === "classes" ? ["active-target"] : []
            });
            expect(target.zone.style.outline).to.equal("");
            expect(target.zone.classList.contains("active-target")).to.equal(false);
            source.win.dispatchEvent(mouse(source.win, "mouseup", 50, 20));
            expect(target.zone.style.outline).to.equal("");
        });
    });

    it("replaces old target styles and classes and clears the replacements on drop", () => {
        const source = list(document, {label: "Source", names: ["a"], dropAnimationDisabled: true});
        const target = list(document, {label: "Target", names: ["b"], dropTargetStyle: {outline: "solid 2px blue"}, dropTargetClasses: ["old"]});
        startPointer(source);
        expect(target.zone.classList.contains("old")).to.equal(true);
        update(target, {dropTargetStyle: {border: "solid 3px red"}, dropTargetClasses: ["new"]});
        expect(target.zone.style.outline).to.equal("");
        expect(target.zone.style.border).not.to.equal("");
        expect(target.zone.classList.contains("old")).to.equal(false);
        expect(target.zone.classList.contains("new")).to.equal(true);
        source.win.dispatchEvent(mouse(source.win, "mouseup", 50, 20));
        expect(target.zone.style.border).to.equal("");
        expect(target.zone.classList.contains("new")).to.equal(false);
    });

    it("removes old target styling when disabling incoming drops and changing styles together", () => {
        const source = list(document, {label: "Source", names: ["a"], dropAnimationDisabled: true});
        const target = list(document, {label: "Target", names: ["b"], dropTargetClasses: ["old"]});
        startPointer(source);
        update(target, {dropFromOthersDisabled: true, dropTargetStyle: {border: "solid 3px red"}, dropTargetClasses: ["new"]});
        expect(target.zone.style.outline).to.equal("");
        expect(target.zone.style.border).to.equal("");
        expect(target.zone.classList.contains("old")).to.equal(false);
        expect(target.zone.classList.contains("new")).to.equal(false);
    });

    it("styles an enabled same-type destination but not a disabled one", () => {
        const source = list(document, {label: "Source", names: ["a"], dropAnimationDisabled: true});
        const target = list(document, {label: "Target", names: ["b"], dropFromOthersDisabled: true});
        startPointer(source);
        update(target, {dropFromOthersDisabled: true, dropTargetStyle: {border: "solid 3px red"}});
        expect(target.zone.style.border).to.equal("");
        update(target, {dropFromOthersDisabled: false, dropTargetStyle: {border: "solid 3px red"}});
        expect(target.zone.style.border).not.to.equal("");
        update(target, {dropFromOthersDisabled: true, dropTargetStyle: {border: "solid 3px red"}});
        expect(target.zone.style.border).to.equal("");
    });

    it("keeps the pointer origin styled when incoming drops are disabled", () => {
        const source = list(document, {label: "Source", names: ["a"], dropAnimationDisabled: true});
        startPointer(source);
        update(source, {dropFromOthersDisabled: true});
        expect(source.zone.style.outline).not.to.equal("");
        source.win.dispatchEvent(mouse(source.win, "mouseup", 50, 20));
        expect(source.zone.style.outline).to.equal("");
    });
});
