import {initAria, destroyAria} from "../../src/helpers/aria";
import {setRovingTabindexTypes} from "../../src/rovingTabindexTypes";
import {setKeyboardDragTrigger} from "../../src/keyboardDragTrigger";

// The instruction element is created once and never removed, and the "has it been asked for" flag is module state
// that no public api resets, so the tests that need it *unset* have to come first in this file. That is also why this
// lives in its own spec: the other aria tests turn the feature on, and each spec file gets its own module instances.
describe("the roving instruction is only added once the feature is on", () => {
    const ZONE_ACTIVE_ID = "dnd-zone-active";
    const ZONE_ACTIVE_ROVING_ID = "dnd-zone-active-roving";
    const ZONE_DRAG_DISABLED_ID = "dnd-zone-drag-disabled";
    const DEFAULT_ROVING_TEXT =
        "Use the arrow keys to move between the items and the lists, and press space-bar or enter to start dragging the focused item";

    afterEach(() => {
        setRovingTabindexTypes(null);
        setKeyboardDragTrigger(null);
        destroyAria();
    });

    it("leaves the document exactly as it was for a consumer that never opts in", () => {
        // must stay the first test in this file - see the note above
        initAria();

        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID), "an opt-in feature should add nothing until it is opted into").to.equal(null);
        expect(document.getElementById(ZONE_ACTIVE_ID), "the ordinary instructions are unconditional").to.not.equal(null);
        expect(document.getElementById(ZONE_DRAG_DISABLED_ID), "the ordinary instructions are unconditional").to.not.equal(null);

        // the re-render that setKeyboardDragTrigger triggers walks every instruction, including the missing one
        expect(() => setKeyboardDragTrigger("space")).to.not.throw();
        expect(document.getElementById(ZONE_ACTIVE_ID).textContent).to.equal("Tab to one the items and press space-bar to start dragging it");
        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID), "a re-render should not conjure it up either").to.equal(null);
    });

    it("creates it at init time when the types were registered before initAria ran", () => {
        // must stay ahead of the tests below, which would leave it already asked for.
        // Covers the consumer who calls the setter at module scope, or otherwise before DOMContentLoaded.
        setKeyboardDragTrigger("enter");
        setRovingTabindexTypes(["list"]);
        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID), "there is nowhere to put it yet").to.equal(null);

        initAria();
        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID).textContent, "and it is created with the trigger already in effect").to.equal(
            "Use the arrow keys to move between the items and the lists, and press enter to start dragging the focused item"
        );
    });

    it("creates it when a non-empty list is registered after init", () => {
        initAria();
        setRovingTabindexTypes(["list"]);

        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID).textContent).to.equal(DEFAULT_ROVING_TEXT);
    });

    it("adds it only once however many times the setter is called", () => {
        initAria();
        setRovingTabindexTypes(["list"]);
        setRovingTabindexTypes(["list", "other"]);
        setRovingTabindexTypes(["list", "other"]);

        expect(document.querySelectorAll(`#${ZONE_ACTIVE_ROVING_ID}`).length).to.equal(1);
    });

    it("keeps it when the list is reset, since a zone may still describe itself by it", () => {
        initAria();
        setRovingTabindexTypes(["list"]);
        setRovingTabindexTypes(null);

        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID), "removing it risks a dangling aria-describedby").to.not.equal(null);
        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID).textContent).to.equal(DEFAULT_ROVING_TEXT);
    });

    it("re-renders it on a trigger change like the eagerly created instructions", () => {
        initAria();
        setRovingTabindexTypes(["list"]);

        setKeyboardDragTrigger("enter");
        expect(document.getElementById(ZONE_ACTIVE_ROVING_ID).textContent).to.equal(
            "Use the arrow keys to move between the items and the lists, and press enter to start dragging the focused item"
        );
        expect(document.getElementById(ZONE_ACTIVE_ID).textContent).to.equal("Tab to one the items and press enter to start dragging it");
    });
});
