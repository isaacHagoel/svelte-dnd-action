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
        // Cypress 15.18.1 does not match RegExp error assertions reliably, so compare substrings.
        expect(() => setAriaStrings({onDrop: () => "nope"})).to.throw("onDrop");
        expect(() => setAriaStrings({onDrop: () => "nope"})).to.throw("movedToPosition");
    });

    it("throws when a message key is given a non-function value", () => {
        // Missing translation entries often produce undefined; reject them before they can be announced.
        expect(() => setAriaStrings({dropped: undefined})).to.throw("dropped");
        expect(() => setAriaStrings({dropped: "Stopped dragging"})).to.throw("dropped");
    });

    it("throws when an instruction key is given a non-string value", () => {
        // Instruction keys are strings; reject formatter functions instead of exposing their source text.
        expect(() => setAriaStrings({zoneActiveInstruction: () => "Tab to an item"})).to.throw("zoneActiveInstruction");
    });

    it("leaves the string table untouched when a value fails validation", () => {
        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} déposé`});

        expect(() =>
            setAriaStrings({
                dropped: ({itemLabel}) => `${itemLabel} abgelegt`,
                zoneActiveInstruction: () => "not a string"
            })
        ).to.throw("zoneActiveInstruction");

        announceToScreenReader("dropped", {itemLabel: "Carte A"});
        expect(alertText(), "the earlier valid override should survive a later failed call untouched").to.equal("Carte A déposé");
    });

    it("throws a clear error for non-object arguments instead of silently no-oping", () => {
        // null and undefined reset the active strings to their defaults.
        expect(() => setAriaStrings(42)).to.throw("42");
        expect(() => setAriaStrings([])).to.throw("setAriaStrings");
        expect(() => setAriaStrings("fr")).to.throw("setAriaStrings");

        setAriaStrings({dropped: ({itemLabel}) => `${itemLabel} déposé`});
        expect(() => setAriaStrings("fr")).to.throw("setAriaStrings");
        announceToScreenReader("dropped", {itemLabel: "Carte A"});
        expect(alertText(), "an invalid call should not touch the existing table").to.equal("Carte A déposé");
    });

    it("treats each call as a whole locale, not a patch on the previous one", () => {
        // Cover keys shared by both locales and keys supplied by only one locale.
        setAriaStrings({
            dropped: ({itemLabel}) => `${itemLabel} déposé`,
            zoneActiveInstruction: "Tabulez jusqu'à un élément et appuyez sur espace"
        });
        setAriaStrings({
            dropped: ({itemLabel}) => `${itemLabel} abgelegt`,
            movedToZoneEnd: ({itemLabel, zoneLabel}) => `${itemLabel} ans Ende der Liste ${zoneLabel} verschoben`
        });

        announceToScreenReader("dropped", {itemLabel: "Karte A"});
        expect(alertText(), "a key both locales name should speak the new one").to.equal("Karte A abgelegt");

        announceToScreenReader("movedToZoneEnd", {itemLabel: "Karte A", zoneLabel: "Fertig", position: 3, count: 3});
        expect(alertText(), "a key only the new locale names should take effect").to.equal("Karte A ans Ende der Liste Fertig verschoben");

        expect(document.getElementById(ZONE_ACTIVE_ID).textContent, "a key only the old locale named should be English again, not French").to.equal(
            "Tab to one the items and press space-bar or enter to start dragging it"
        );
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
