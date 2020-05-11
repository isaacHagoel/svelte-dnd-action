import {armWindowScroller, disarmWindowScroller, updateMousePosition} from "../../src/helpers/windowScroller";
// TODO - consider adding more test cases. Ex: mouse in the bottom right corner (activating two scroll potentially), right and the back left etc.
describe("windowScroller", () => {
    before(() => {
        cy.viewport(1000, 1000);
        document.documentElement.style.overflow = 'scroll';
        document.documentElement.style.height = '1000px';
        document.documentElement.style.width = '1000px';
        document.body.style.height = '2000px';
        document.body.style.width = '2000px';
    });
    beforeEach(() => {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
    });
    it("scrolls down", () => {
        armWindowScroller();
        expect(document.documentElement.scrollLeft === 0).to.equal(true);
        expect(document.documentElement.scrollTop === 0).to.equal(true);
        // TODO - I couldn't make the mousemove event trigger :(, revisit, when it works remove the call to updateMousePosition and make it private
        // cy.window().trigger('mousemove', {clientX: 500, clientY: 999});
        updateMousePosition({clientX: 500, clientY: 999});
        cy.wait(400).then(()=> {
            expect(document.documentElement.scrollLeft === 0).to.equal(true);
            expect(document.documentElement.scrollTop === 0).to.equal(false);
            disarmWindowScroller();
        });
    });
    it("scrolls right", () => {
        armWindowScroller();
        expect(document.documentElement.scrollTop === 0).to.equal(true);
        expect(document.documentElement.scrollLeft === 0).to.equal(true);
        // TODO - I couldn't make the mousemove event trigger :(, revisit, when it works remove the call to updateMousePosition and make it private
        // cy.window().trigger('mousemove', {clientX: 500, clientY: 999});
        updateMousePosition({clientX: 999, clientY: 500});
        cy.wait(400).then(()=> {
            expect(document.documentElement.scrollTop === 0).to.equal(true);
            expect(document.documentElement.scrollLeft === 0).to.equal(false);
            disarmWindowScroller();
        });
    });
});