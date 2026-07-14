import {overrideItemIdKeyNameBeforeInitialisingDndZones, SHADOW_ELEMENT_ATTRIBUTE_NAME, SHADOW_ITEM_MARKER_PROPERTY_NAME} from "../../src/constants";
import {dragHandle, dragHandleZone} from "../../src/wrappers/withDragHandles";

describe("dragHandleZone", () => {
    it("destroys its wrapped dndzone", () => {
        const zone = document.createElement("div");
        zone.appendChild(document.createElement("div"));
        document.body.appendChild(zone);

        const action = dragHandleZone(zone, {items: [{id: 1}]});
        action.destroy();

        expect(() => overrideItemIdKeyNameBeforeInitialisingDndZones("id")).not.to.throw();
        zone.remove();
    });

    it("does not apply a stale shadow index when a nested zone is destroyed during a drag", () => {
        cy.then(() => {
            const rootZone = document.createElement("div");
            const draggedItem = document.createElement("div");
            const dragHandleEl = document.createElement("div");
            const nextItem = document.createElement("div");
            const lastItem = document.createElement("div");
            draggedItem.appendChild(dragHandleEl);
            rootZone.appendChild(draggedItem);
            rootZone.appendChild(nextItem);
            rootZone.appendChild(lastItem);
            document.body.appendChild(rootZone);

            const nestedZone = document.createElement("div");
            nestedZone.appendChild(document.createElement("div"));
            document.body.appendChild(nestedZone);

            const items = [{id: "dragged"}, {id: "next"}, {id: "last"}];
            let shadowItems;
            rootZone.addEventListener("consider", e => {
                shadowItems = e.detail.items;
            });

            const rootAction = dragHandleZone(rootZone, {items, dropAnimationDisabled: true});
            const handleAction = dragHandle(dragHandleEl);
            const nestedAction = dragHandleZone(nestedZone, {items: [{id: "nested"}], dropAnimationDisabled: true});

            try {
                dragHandleEl.dispatchEvent(new MouseEvent("mousedown", {button: 0, clientX: 5, clientY: 5, bubbles: true, cancelable: true}));
                window.dispatchEvent(new MouseEvent("mousemove", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));

                expect(shadowItems.find(item => item[SHADOW_ITEM_MARKER_PROPERTY_NAME])).not.to.equal(undefined);

                // Model Svelte having removed the shadow DOM node while the action wrapper
                // still holds the previous options. Destroying an unrelated nested wrapper
                // must not broadcast a stale update to the root zone.
                const shadowItem = document.createElement("div");
                rootZone.replaceChild(shadowItem, draggedItem);
                rootAction.update({items: shadowItems, dropAnimationDisabled: true});
                shadowItem.remove();
                nestedAction.destroy();

                expect(nextItem.hasAttribute(SHADOW_ELEMENT_ATTRIBUTE_NAME)).to.equal(false);
                expect(nextItem.style.visibility).to.equal("");
            } finally {
                window.dispatchEvent(new MouseEvent("mouseup", {clientX: 10, clientY: 10, bubbles: true, cancelable: true}));
                nestedAction.destroy();
                rootAction.destroy();
                handleAction.destroy();
                rootZone.remove();
                nestedZone.remove();
            }
        });
    });
});
