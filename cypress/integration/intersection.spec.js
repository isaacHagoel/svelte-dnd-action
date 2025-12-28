import {isElementOffDocument} from "../../src/helpers/intersection";

function makeDiv(widthPx = 50, heightPx = 50) {
    const el = document.createElement("div");
    el.style.width = `${widthPx}px`;
    el.style.height = `${heightPx}px`;
    return el;
}

describe("intersection", () => {
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
