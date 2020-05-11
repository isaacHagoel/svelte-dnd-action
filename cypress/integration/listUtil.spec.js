import {findWouldBeIndex} from "../../src/helpers/listUtil";

describe("listUtil", () => {
    describe("findWouldBeIndex", () => {
        let containerEl, draggedEl;
        before(() => {
            document.body.style.height = '2000px';
            document.body.style.width = '2000px';

            containerEl = document.createElement('section');
            containerEl.style.height = '500px';
            containerEl.style.width = '100px';
            containerEl.style.position = 'fixed';
            containerEl.style.top = '0';
            containerEl.style.left = '0';
            document.body.appendChild(containerEl);
            function addListItem() {
                const divEl = document.createElement('div');
                divEl.style.height = '100px';
                divEl.style.width = '50px';
                containerEl.appendChild(divEl);
            }
            addListItem();
            addListItem();
            addListItem();

            draggedEl = document.createElement('div');
            draggedEl.style.height = '100px';
            draggedEl.style.width = '50px';
            draggedEl.style.position = 'fixed';
            document.body.appendChild(draggedEl);

        });
        beforeEach(() => {
            draggedEl.style.top =  '0';
            draggedEl.style.left = '0';
        });
        it("returns null when element is outside of containers", () => {
            draggedEl.style.top =  '600px';
            draggedEl.style.left = '0';
            expect(findWouldBeIndex(draggedEl, containerEl)).to.equal(null);
        });
        it("works correctly, not proximity based", () => {
            draggedEl.style.top =  '150px';
            draggedEl.style.left = '5px';
            expect(findWouldBeIndex(draggedEl, containerEl)).to.deep.equal({index: 1, isProximityBased: false});
        });
        it("works correctly, proximity based", () => {
            draggedEl.style.top =  '450px';
            draggedEl.style.left = '5px';
            expect(findWouldBeIndex(draggedEl, containerEl)).to.deep.equal({index: 2, isProximityBased: true});
        });
    });
});