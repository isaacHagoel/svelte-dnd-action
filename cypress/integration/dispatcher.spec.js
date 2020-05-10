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
        dispatchFinalizeEvent(divEl, myItems);
        expect(items).to.deep.equal(myItems);
    });
    it("honors contract - consider", () => {
        divEl.addEventListener('consider', (e) => {items = e.detail.items});
        const myItems = [3,4];
        dispatchFinalizeEvent(divEl, myItems);
        expect(items).to.deep.equal(myItems);
    });
});