import {initAria, destroyAria, setAriaStrings, announceToScreenReader} from "../../src/helpers/aria";

describe("aria strings", () => {
    const ALERT_DIV_ID = "dnd-action-aria-alert";
    const ZONE_ACTIVE_ID = "dnd-zone-active";
    const ZONE_DRAG_DISABLED_ID = "dnd-zone-drag-disabled";

    function alertText() {
        return document.getElementById(ALERT_DIV_ID).textContent;
    }

    beforeEach(() => {
        initAria();
    });

    afterEach(() => {
        setAriaStrings(null);
        destroyAria();
    });

    it("uses the stock English strings by default", () => {
        announceToScreenReader("dragStarted", {itemLabel: "Card A", zoneLabel: "To do", canMoveBetweenZones: false});
        expect(alertText()).to.equal("Started dragging item Card A. Use the arrow keys to move it within its list To do");

        announceToScreenReader("dragStarted", {itemLabel: "Card A", zoneLabel: "To do", canMoveBetweenZones: true});
        expect(alertText()).to.equal(
            "Started dragging item Card A. Use the arrow keys to move it within its list To do, or tab to another list in order to move the item into it"
        );

        announceToScreenReader("movedToPosition", {itemLabel: "Card A", zoneLabel: "To do", position: 2, count: 3});
        expect(alertText()).to.equal("Moved item Card A to position 2 in the list To do");

        announceToScreenReader("movedToZoneEnd", {itemLabel: "Card A", zoneLabel: "Done", position: 3, count: 3});
        expect(alertText()).to.equal("Moved item Card A to the end of the list Done");

        announceToScreenReader("movedToZoneStart", {itemLabel: "Card A", zoneLabel: "Done", position: 1, count: 3});
        expect(alertText()).to.equal("Moved item Card A to the beginning of the list Done");

        announceToScreenReader("dropped", {itemLabel: "Card A"});
        expect(alertText()).to.equal("Stopped dragging item Card A");

        expect(document.getElementById(ZONE_ACTIVE_ID).textContent).to.equal(
            "Tab to one the items and press space-bar or enter to start dragging it"
        );
        expect(document.getElementById(ZONE_DRAG_DISABLED_ID).textContent).to.equal("This is a disabled drag and drop list");
    });

    it("overrides only the keys it is given", () => {
        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} déposé`});

        announceToScreenReader("dropped", {itemLabel: "Carte A"});
        expect(alertText()).to.equal("Carte A déposé");

        announceToScreenReader("movedToPosition", {itemLabel: "Card A", zoneLabel: "To do", position: 2, count: 3});
        expect(alertText(), "should leave un-overridden keys at their defaults").to.equal("Moved item Card A to position 2 in the list To do");
    });

    it("throws on an unknown key and names the supported ones", () => {
        // Note: matched via substring rather than `.to.throw(/regex/)` - the Cypress version pinned in this
        // repo (15.18.1) has a bug where chai's throw assertion never matches a RegExp errMsgMatcher, even
        // for a bare `throw new Error(...)` with no involvement of this library's code.
        expect(() => setAriaStrings({onDrop: () => "nope"})).to.throw("onDrop");
        expect(() => setAriaStrings({onDrop: () => "nope"})).to.throw("movedToPosition");
    });

    it("can be called again to switch locale", () => {
        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} déposé`});
        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} abgelegt`});

        announceToScreenReader("dropped", {itemLabel: "Karte A"});
        expect(alertText()).to.equal("Karte A abgelegt");
    });

    it("resets to the defaults when passed null", () => {
        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} déposé`});
        setAriaStrings(null);

        announceToScreenReader("dropped", {itemLabel: "Card A"});
        expect(alertText()).to.equal("Stopped dragging item Card A");
    });

    it("rewrites the live instruction divs when the locale changes mid-session", () => {
        setAriaStrings({
            zoneActiveInstruction: "Tabulez jusqu'à un élément et appuyez sur espace",
            zoneDragDisabledInstruction: "Cette liste est désactivée"
        });

        expect(document.getElementById(ZONE_ACTIVE_ID).textContent).to.equal("Tabulez jusqu'à un élément et appuyez sur espace");
        expect(document.getElementById(ZONE_DRAG_DISABLED_ID).textContent).to.equal("Cette liste est désactivée");
    });

    it("renders instruction strings as text, not markup", () => {
        setAriaStrings({zoneActiveInstruction: "<img src=x onerror=alert(1)> press space"});

        const div = document.getElementById(ZONE_ACTIVE_ID);
        expect(div.querySelectorAll("img").length, "should not build elements from the string").to.equal(0);
        expect(div.textContent).to.equal("<img src=x onerror=alert(1)> press space");
    });
});
