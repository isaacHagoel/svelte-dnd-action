import {getBoundingRectNoTransforms, isElementOffDocument} from "../../src/helpers/intersection";

function makeDiv(widthPx = 50, heightPx = 50) {
    const el = document.createElement("div");
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    return el;
}

describe("intersection", () => {
    describe("getBoundingRectNoTransforms", () => {
        it("returns finite coordinates for an element with a flip transform", () => {
            const el = makeDiv(80, 40);
            el.style.position = "fixed";
            el.style.left = "120px";
            el.style.top = "160px";
            el.style.transform = "translate(25px, 35px)";
            el.style.transformOrigin = "0 0";
            document.body.appendChild(el);

            try {
                const rect = getBoundingRectNoTransforms(el);

                expect(rect.left).to.be.closeTo(120, 0.01);
                expect(rect.top).to.be.closeTo(160, 0.01);
                expect(rect.right).to.be.closeTo(200, 0.01);
                expect(rect.bottom).to.be.closeTo(200, 0.01);
            } finally {
                el.remove();
            }
        });
    });

    describe("isElementOffDocument", () => {
        before(() => {
            document.body.style.width = "100vw";
            document.body.style.height = "100vh";
        });
        it("returns false when element is inside", () => {
            const el = makeDiv(50, 50);
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(false);
        });
        it("returns false when partially outside to the left", () => {
            const el = makeDiv(50, 50);
            el.style.position = "fixed";
            el.style.top = "-30px";
            el.style.left = "-45px";
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(false);
        });
        it("returns true when fully outside to the right", () => {
            const el = makeDiv(50, 50);
            el.style.position = "fixed";
            el.style.top = "0";
            el.style.right = "51px";
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });
        it("returns true when fully outside to the top", () => {
            const el = makeDiv(50, 50);
            el.style.position = "fixed";
            el.style.top = "-51px";
            el.style.right = "0";
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });
        it("returns true when fully outside to the bottom", () => {
            const el = makeDiv(50, 50);
            el.style.position = "fixed";
            el.style.bottom = "51px";
            el.style.left = "80px";
            document.body.appendChild(el);
            expect(isElementOffDocument(el)).to.equal(true);
        });
    });
});
