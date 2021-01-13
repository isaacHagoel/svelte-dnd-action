## Svelte Dnd Action - Release Notes

### [v0.7.0](https://github.com/isaacHagoel/svelte-dnd-action/pull/202)

All the changes in this release only affect pointer (mouse/ touch) based drag and drop operations.
It changes some default behaviours (for the better).

-   When an element is being dragged outside of any dnd zone, the placeholder element now appears in the original dnd zone in the original index and indicates where the element would land if dropped. This was added for better UX and to address single sortable list use cases.
-   This change includes the introduction of two new triggers, that can be intercepted by the `consider` handler: `DRAGGED_LEFT_ALL` which fires when the placeholder is added to the origin dndzone, and `DRAGGED_ENTERED_ANOTHER` which fires when the placeholder is removed from the origin dnd zone.
-   When drag starts - the library now locks the minimum width and height of the origin dropzone for the duration of the drag operation. This is done in order to prevent the container from shrinking and growing jarringly as the element is dragged around. This is especially helpful when the user drags the last element, which in previous versions could make the dndzone shrink underneath such that the dragged element wasn't over it anymore.

### [v0.7.4](https://github.com/isaacHagoel/svelte-dnd-action/pull/213)

This release introduces a subtle change to the dragStarted event. If you are using [Dragula Copy on Drag](https://svelte.dev/repl/924b4cc920524065a637fa910fe10193?version=3.31.2), you will need to update your consider handler (add 1 line of code to remove the newly added shadow placeholder, see linked REPL).
Starting with this version, the initial consider event (dragStarted) places a placeholder item with a new id instead of the dragged item in the items list (old behaviour: removing the dragged item from the list altogether). The placeholder is replaced with the real shadow element (the one that has the same id as the original item) in the next event (basically instantly).
This change makes the initial behaviour of large items (relative to their peers) much smoother.

### [v0.8.0](https://github.com/isaacHagoel/svelte-dnd-action/pull/218)

Added a new option, `dropTargetClasses`, that allows adding global classes to a dnd-zone when it is a potential drop target (during drag).
