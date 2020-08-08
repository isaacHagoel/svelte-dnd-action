import { getDepth } from "../../src/helpers/util";

describe("util", () => {
    describe("getDepth", () => {
        it("get correct depth", () => {
           const div = document.createElement('div');
           const p = document.createElement('p');
           const section = document.createElement('section');
           const div2 = document.createElement('div');
           document.body.appendChild(div);
           div.appendChild(p);
           div.appendChild(section);
           section.appendChild(div2);
           expect(getDepth(div)).to.equal(1);
           expect(getDepth(p)).to.equal(2);
           expect(getDepth(section)).to.equal(2);
           expect(getDepth(div2)).to.equal(3);
        });
    });
});