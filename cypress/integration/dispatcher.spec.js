import {SOURCES, TRIGGERS} from "../../src";
import {dispatchFinalizeEvent, dispatchConsiderEvent} from "../../src/helpers/dispatcher";

describe("dispatcher", () => {
    let divEl = document.createElement('div');
    let items;
    let info;
    beforeEach(() => {
        items = [];
        info = {};
    });
    it("honors contract - finalize", () => {
        divEl.addEventListener('finalize', (e) => {items = e.detail.items; info = e.detail.info});
        const myItems = [1,2];
        const myInfo = {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "someId", source: SOURCES.POINTER}
        dispatchFinalizeEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
        expect(info).to.deep.equal(myInfo);
    });
    it("honors contract - consider", () => {
        divEl.addEventListener('consider', (e) => {items = e.detail.items; info = e.detail.info});
        const myItems = [3,4];
        const myInfo = {trigger: TRIGGERS.DRAGGED_ENTERED, id: "someId", source: SOURCES.KEYBOARD};
        dispatchConsiderEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
        expect(info).to.deep.equal(myInfo);
    });
});