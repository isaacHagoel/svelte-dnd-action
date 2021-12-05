## Svelte Dnd Action - Release Notes

### [0.9.13](https://github.com/isaacHagoel/svelte-dnd-action/pull/331/)

fixed the typescript type for dropTargetClasses

### [0.9.12](https://github.com/isaacHagoel/svelte-dnd-action/pull/328/)

added a link example for a basic implementation of multi-drag in the README

### [0.9.11](https://github.com/isaacHagoel/svelte-dnd-action/pull/315/)

added a new option, `zoneTabIndex`, that allows to set custom tabindex in the list container.

### 0.9.10

Please do not use. It was deployed with unintended changes

### [0.9.9](https://github.com/isaacHagoel/svelte-dnd-action/pull/301)

bugfix - works properly when under shadow dom

### [0.9.7](https://github.com/isaacHagoel/svelte-dnd-action/pull/290)

bugfix - works properly now when dropFromOtherDisabled is set to true while the shadow element is in the zone

### [0.9.5](https://github.com/isaacHagoel/svelte-dnd-action/pull/271)

added a new option, `morphDisabled`, that allows to disable morphing of dragged item.

### [0.9.4](https://github.com/isaacHagoel/svelte-dnd-action/pull/274)

bug fix - not crashing when a new dnd zone is created mid drag

### [0.9.3](https://github.com/isaacHagoel/svelte-dnd-action/pull/273)

exporting `DRAGGED_ELEMENT_ID` to allow targeting the dragged element and its subtree using CSS or to fetch it with `document.getElementById`.

### [0.9.2](https://github.com/isaacHagoel/svelte-dnd-action/pull/264)

fixed a race condition that could happen under extremely rapid drag-start -> drop while spam-clicking feverishly

### [0.9.1](https://github.com/isaacHagoel/svelte-dnd-action/pull/256)

exporting `SHADOW_PLACEHOLDER_ITEM_ID` for easier filtering in recursive zones use-cases

### [0.9.0](https://github.com/isaacHagoel/svelte-dnd-action/pull/250)

added the `centreDraggedOnCursor` option to deal with zones that have large items (wide, tall or both) in them that can be dragged over much smaller items. <br/>
in these cases, having the center of the items (which is the focal point that triggers all dnd events), and the cursor be the same point makes it more intuitive to drag the large items around.

### [0.8.6](https://github.com/isaacHagoel/svelte-dnd-action/pull/231)

fixed an issue when dragging an item on top of a droppedFromItemsDisabled zone (it is treated as outside of any now, as it should)

### [0.8.4](https://github.com/isaacHagoel/svelte-dnd-action/pull/226)

fixed a keyboard related bug - it is now possible to tab back to the dragged item after tabbing to external elements mid drag

### [0.8.2](https://github.com/isaacHagoel/svelte-dnd-action/pull/221)

accessibility features now work when the library is dynamically imported (in other words, keyboard navigation now works in the REPL again).

### [0.8.1](https://github.com/isaacHagoel/svelte-dnd-action/pull/220)

Made `dropTargetClasses` when initiating drag via keyboard.

### [v0.8.0](https://github.com/isaacHagoel/svelte-dnd-action/pull/218)

Added a new option, `dropTargetClasses`, that allows adding global classes to a dnd-zone when it is a potential drop target (during drag).

### [v0.7.4](https://github.com/isaacHagoel/svelte-dnd-action/pull/213)

This release introduces a subtle change to the dragStarted event. <br />
If you are using [Dragula Copy on Drag](https://svelte.dev/repl/924b4cc920524065a637fa910fe10193?version=3.31.2), you will need to update your consider handler (add 1 line of code to remove the newly added shadow placeholder, see linked REPL). <br />
Same goes for the [crazy nesting](https://svelte.dev/repl/fe8c9eca04f9417a94a8b6041df77139?version=3.31.2) example <br />
Starting with this version, the initial consider event (dragStarted) places a placeholder item with a new id instead of the dragged item in the items list (old behaviour: removing the dragged item from the list altogether). The placeholder is replaced with the real shadow element (the one that has the same id as the original item) in the next event (basically instantly).
This change makes the initial behaviour of large items (relative to their peers) much smoother.

### [v0.7.0](https://github.com/isaacHagoel/svelte-dnd-action/pull/202)

All the changes in this release only affect pointer (mouse/ touch) based drag and drop operations.
It changes some default behaviours (for the better).

-   When an element is being dragged outside of any dnd zone, the placeholder element now appears in the original dnd zone in the original index and indicates where the element would land if dropped. This was added for better UX and to address single sortable list use cases.
-   This change includes the introduction of two new triggers, that can be intercepted by the `consider` handler: `DRAGGED_LEFT_ALL` which fires when the placeholder is added to the origin dndzone, and `DRAGGED_ENTERED_ANOTHER` which fires when the placeholder is removed from the origin dnd zone.
-   When drag starts - the library now locks the minimum width and height of the origin dropzone for the duration of the drag operation. This is done in order to prevent the container from shrinking and growing jarringly as the element is dragged around. This is especially helpful when the user drags the last element, which in previous versions could make the dndzone shrink underneath such that the dragged element wasn't over it anymore.
