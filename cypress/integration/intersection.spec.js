import {isCenterOfAInsideB, calcDistanceBetweenCenters} from '../../src/helpers/intersection';

function makeDiv(widthPx = 50, heightPx = 50) {
    const el = document.createElement('div');
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    return el;
}

describe("intersection - isCenterOfAInsideB", () => {
    it("center is inside", () => {
        const elA = makeDiv(50,50);
        document.body.style.width = '1000px';
        document.body.style.height = '1000px';
        document.body.appendChild(elA);
        expect(isCenterOfAInsideB(elA, document.body)).to.equal(true);
    });
    it("center is outside", () => {
        const elA = makeDiv();
        const elB = makeDiv();
        document.body.appendChild(elA);
        document.body.appendChild(elB);
        expect(isCenterOfAInsideB(elA, elB)).to.equal(false);
    });
});

describe("intersection - distance", () => {
    it("distance from self is zero", () => {
        const el = makeDiv();
        document.body.appendChild(el);
        expect(calcDistanceBetweenCenters(el, el)).to.equal(0);
    });
    it("calculates distance correctly", () => {
        const elA = makeDiv(80,60);
        const elB = makeDiv(40,30);
        elA.style.position = 'relative';
        elB.style.position = 'absolute';
        elB.top = 0;
        elB.left = 0;
        document.body.appendChild(elA);
        elA.appendChild(elB);
        expect(calcDistanceBetweenCenters(elA, elB)).to.equal(25);
    });
});