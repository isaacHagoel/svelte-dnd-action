import {areObjectsShallowEqual, getDepth} from "../../src/helpers/util";
import {printDebug, setDebugMode} from "../../src/constants"

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
    describe("areObjectsShallowEqual", () => {
        it("equal when both empty", () => {
            expect(areObjectsShallowEqual({}, {})).to.equal(true);
        });
        it ("simple objects equal ", () => {
            expect(areObjectsShallowEqual({a:1, b:2, c: "lala"}, {b:2, c: "lala", a:1})).to.equal(true);
        });
        it("not equal with additional entries", () => {
            expect(areObjectsShallowEqual({a:1, b:2, c:3}, {b:2, a:1})).to.equal(false);
            expect(areObjectsShallowEqual({a:1, b:2}, {b:2, a:1, c:3})).to.equal(false);
        });
        it("not equal same key different value", () => {
            expect(areObjectsShallowEqual({a:1}, {a:9})).to.equal(false);
        });
        it("not equal at all", () => {
            expect(areObjectsShallowEqual({a:1, z:"lala"}, {b:9, h:7})).to.equal(false);
        });

    });
    describe("debug output can be configured", () => {
        let consoleStub = null;
        const logStub = (message) => consoleStub = message;
        const logMessage = () => "some debug message";

        it("does not log anything by default", () => {
            printDebug(logMessage, logStub);
            expect(consoleStub).to.equal(null);
        });
        it("does log if debugMode is set", () => {
            setDebugMode(true);
            printDebug(logMessage, logStub)
            expect(consoleStub).to.equal(logMessage());
        })
    });
});