import {overrideItemIdKeyNameBeforeInitialisingDndZones} from "../../src/constants";
import {dragHandleZone} from "../../src/wrappers/withDragHandles";

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
});
