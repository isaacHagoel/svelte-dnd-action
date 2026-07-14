import {createDraggedElementFrom, morphDraggedElementToBeLike} from "../../src/helpers/styler";
import {FEATURE_FLAG_NAMES, setFeatureFlag} from "../../src/featureFlags";

function createElement(width, height) {
    const element = document.createElement("div");
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.position = "fixed";
    element.style.left = "0px";
    element.style.top = "0px";
    document.body.appendChild(element);
    return element;
}

function stubRenderedRect(element, {left, top, width, height}) {
    element.getBoundingClientRect = () => ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height
    });
}

describe("styler", () => {
    afterEach(() => {
        setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, false);
    });

    [false, true].forEach(useComputedDimensions => {
        it(`preserves the cursor position when remorphing during a transition (computed dimensions: ${useComputedDimensions})`, () => {
            cy.then(() => {
                setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, useComputedDimensions);
                const draggedEl = createElement(200, 200);
                const targetEl = createElement(100, 100);
                const nativeGetComputedStyle = window.getComputedStyle.bind(window);
                const getComputedStyleStub = cy.stub(window, "getComputedStyle").callsFake(element => {
                    const computedStyle = nativeGetComputedStyle(element);
                    if (element !== draggedEl) return computedStyle;
                    return new Proxy(computedStyle, {
                        get(target, property) {
                            if (property === "left" || property === "top") return "25px";
                            const value = target[property];
                            return typeof value === "function" ? value.bind(target) : value;
                        }
                    });
                });

                try {
                    // Model the midpoint of a previous morph. Its inline destination is
                    // 0px, while the currently rendered/animated position is 25px.
                    stubRenderedRect(draggedEl, {left: 25, top: 25, width: 150, height: 150});
                    stubRenderedRect(targetEl, {left: 0, top: 0, width: 100, height: 100});

                    morphDraggedElementToBeLike(draggedEl, targetEl, 100, 100);

                    // The cursor is halfway across the rendered box, so a 100px target
                    // must finish at 50px to keep the same relative grab point.
                    expect(parseFloat(draggedEl.style.left)).to.equal(50);
                    expect(parseFloat(draggedEl.style.top)).to.equal(50);
                } finally {
                    getComputedStyleStub.restore();
                    draggedEl.remove();
                    targetEl.remove();
                }
            });
        });
    });

    it("synchronizes size transitions when morphing before delayed transition setup", () => {
        cy.then(() => {
            const originalEl = createElement(100, 100);
            const targetEl = createElement(200, 200);
            const nativeSetTimeout = window.setTimeout;
            window.setTimeout = () => 1;
            let draggedEl;

            try {
                draggedEl = createDraggedElementFrom(originalEl);
                document.body.appendChild(draggedEl);
                expect(draggedEl.style.transitionProperty.split(", ")).not.to.include("width");

                morphDraggedElementToBeLike(draggedEl, targetEl, 50, 50);

                const transitionProperties = draggedEl.style.transitionProperty.split(", ");
                expect(transitionProperties).to.include("width");
                expect(transitionProperties).to.include("height");
            } finally {
                window.setTimeout = nativeSetTimeout;
                originalEl.remove();
                targetEl.remove();
                if (draggedEl) draggedEl.remove();
            }
        });
    });
});
