import {isCenterOfAInsideB, calcDistanceBetweenCenters, isElementOffDocument} from '../../src/helpers/intersection';

function makeDiv(widthPx = 50, heightPx = 50) {
    const el = document.createElement('div');
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    return el;
}

// TODO - add missing functions
describe("intersection", () => {
    describe("isCenterOfAInsideB", () => {
        it("center is inside", () => {
            const el = makeDiv(50,50);
            document.body.style.width = '1000px';
            document.body.style.height = '1000px';
            document.body.appendChild(el);
            expect(isCenterOfAInsideB(el, document.body)).to.equal(true);
        });
        it("center is outside", () => {
            const elA = makeDiv();
            const elB = makeDiv();
            document.body.appendChild(elA);
            document.body.appendChild(elB);
            expect(isCenterOfAInsideB(elA, elB)).to.equal(false);
        });
    });

    describe("calcDistanceBetweenCenters", () => {
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
            expect(calcDistanceBetweenCenters(elB, elA)).to.equal(25);
        });
    });

    describe("isElementOffDocument", () => {
        before(() => {
            document.body.style.width = '100vw';
            document.body.style.height = '100vh';
        });
        it("returns false when element is inside", () => {
            const el = makeDiv(50,50);
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(false);
        });
        it("returns false when partially outside to the left", () => {
            const el = makeDiv(50,50);
            el.style.position = "fixed";
            el.style.top = '-30px';
            el.style.left = '-45px';
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(false);
        });
        it("returns true when fully outside to the right", () => {
            const el = makeDiv(50,50);
            el.style.position = "fixed";
            el.style.top = '0';
            el.style.right = '51px';
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });
        it("returns true when fully outside to the top", () => {
            const el = makeDiv(50,50);
            el.style.position = "fixed";
            el.style.top = '-51px';
            el.style.right = '0';
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });
        it("returns true when fully outside to the bottom", () => {
            const el = makeDiv(50,50);
            el.style.position = "fixed";
            el.style.bottom = '51px';
            el.style.left = '80px';
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });

    });
});
