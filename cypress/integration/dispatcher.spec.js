import {TRIGGERS} from "../../src";
import {dispatchFinalizeEvent, dispatchConsiderEvent} from "../../src/helpers/dispatcher";

describe("dispatcher", () => {
    let divEl = document.createElement('div');
    let items;
    beforeEach(() => {
        items = [];
    });
    it("honors contract - finalize", () => {
        divEl.addEventListener('finalize', (e) => {items = e.detail.items});
        const myItems = [1,2];
        const myInfo = {trigger: TRIGGERS.DROPPED_INTO_ZONE, id: "someId"}
        dispatchFinalizeEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
    });
    it("honors contract - consider", () => {
        divEl.addEventListener('consider', (e) => {items = e.detail.items});
        const myItems = [3,4];
        const myInfo = {trigger: TRIGGERS.DRAGGED_ENTERED, id: "someId"};
        dispatchConsiderEvent(divEl, myItems, myInfo);
        expect(items).to.deep.equal(myItems);
    });
});