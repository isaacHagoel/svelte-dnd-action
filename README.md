# SVELTE DND ACTION [![Known Vulnerabilities](https://snyk.io/test/github/isaacHagoel/svelte-dnd-action/badge.svg?targetFile=package.json)](https://snyk.io/test/github/isaacHagoel/svelte-dnd-action?targetFile=package.json) 
This is a feature-complete implementation of drag and drop for Svelte using a custom action. It supports almost every imaginable drag and drop use-case and is fully accessible. 
See full features list below.

![dnd_demo2](https://user-images.githubusercontent.com/20507787/81682367-267eb780-9498-11ea-8dbc-5c9582033522.gif)

[Play with this example in the REPL](https://svelte.dev/repl/e2ef044af75c4b16b424b8219fb31fd9?version=3.22.2).

### Current Status
The library is working well as far as I can tell, and I am in the process of integrating it into a production system that will be used at scale. 
It is being actively maintained.

### Features
- Awesome drag and drop with minimal fuss 
- Supports horizontal, vertical or any other type of container (it doesn't care much about the shape)
- Supports nested dnd-zones (draggable containers with other draggable elements inside, think Trello)
- Rich animations (can be opted out of)
- Touch support
- Define what can be dropped where (dnd-zones optionally have a "type")
- Scroll dnd-zones and/or the window horizontally or vertically by placing the dragged element next to the edge
- Supports advanced use-cases such as various flavours of copy-on-drag and custom drag handles (see examples below)
- Performant and small footprint (no external dependencies, no fluff code)  
- Fully accessible (alpha) - keyboard support, aria attributes and assistive instructions for screen readers  

### Installation
**Pre-requisites**: svelte-3
```bash
yarn add -D svelte-dnd-action
```
or
```bash
npm install --save-dev svelte-dnd-action
```

### Usage
```html
    <div use:dndzone="{{items: myItems, ...otherOptions}}" on:consider={handler} on:finalize={handler}>
         {#each myItems as item(item.id)}
            <div>this is now a draggable div that can be dropped in other dnd zones</div>
         {/each}   
    </div>
```

##### Basic Example:

```html
<script>
	import { flip } from 'svelte/animate';
	import { dndzone } from 'svelte-dnd-action';
    let items = [
    		{id: 1, name: "item1"},
    		{id: 2, name: "item2"},
    		{id: 3, name: "item3"},
    		{id: 4, name: "item4"}
    ]; 
    const flipDurationMs = 300;
	function handleDndConsider(e) {
		items = e.detail.items;
	}
	function handleDndFinalize(e) {
		items = e.detail.items;
	}
</script>

<style>
	section {
		width: 50%;
		padding: 0.3em;
		border: 1px solid black;
        /* this will allow the dragged element to scroll the list */
		overflow: scroll;
		height: 200px;
	}
	div {
		width: 50%;
		padding: 0.2em;
		border: 1px solid blue;
		margin: 0.15em 0;
	}
</style>
<section use:dndzone={{items, flipDurationMs}} on:consider={handleDndConsider} on:finalize={handleDndFinalize}>
	{#each items as item(item.id)}
		<div animate:flip="{{duration: flipDurationMs}}">
			{item.name}	
		</div>
	{/each}
</section>
```

##### Input:
An options-object with the following attributes:
| Name                      | Type           | Required?                                                    | Default Value                                     | Description                                                  |
| ------------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| `items`                   | Array<Object>  | Yes. Each object in the array **has to have** an `id` property (key name can be overridden globally) with a unique value (within all dnd-zones of the same type) | N/A                                               | The data array that is used to produce the list with the draggable items (the same thing you run your #each block on) |
| `flipDurationMs`          | Number         | No                                                           | `0`                                               | The same value you give the flip animation on the items (to make them animated as they "make space" for the dragged item). Set to zero or leave out if you don't want animations |
| `type`                    | String         | No                                                           | Internal                                          | dnd-zones that share the same type can have elements from one dragged into another. By default, all dnd-zones have the same type |
| `dragDisabled`            | Boolean        | No                                                           | `false`                                           | Setting it to true will make it impossible to drag elements out of the dnd-zone. You can change it at any time, and the zone will adjust on the fly |
| `dropFromOthersDisabled`  | Boolean        | No                                                           | `false`                                           | Setting it to true will make it impossible to drop elements from other dnd-zones of the same type. Can be useful if you want to limit the max number of items for example. You can change it at any time, and the zone will adjust on the fly |
| `dropTargetStyle`         | Object<String> | No                                                           | `{outline: 'rgba(255, 255, 102, 0.7) solid 2px'}` | An object of styles to apply to the dnd-zone when items can be dragged in to it. Note: the styles override any inline styles applied to the dnd-zone. When the styles are removed, any original inline styles will be lost |
| `transformDraggedElement` | Function       | No                                                           | `() => {}`                                               | A function that is invoked when the draggable element enters the dnd-zone or hover overs a new index in the current dnd-zone. <br />Signature:<br />function(element, data, index) {}<br />**element**: The dragged element. <br />**data**: The data of the item from the items array.<br />**index**: The index the dragged element will become in the new dnd-zone.<br /><br />This allows you to override properties on the dragged element, such as innerHTML to change how it displays. |

##### Output:

The action dispatches two custom events:
- `consider` - dispatched whenever the dragged element needs to make room for itself in a new position in the items list and when it leaves. The host (your component) is expected to update the items list (you can keep a copy of the original list if you need to)
- `finalize` - dispatched on the target and origin dnd-zones when the dragged element is dropped into position. 

The expectation is the same - update the list of items.
In both cases the payload (within e.detail) is the same: an object with two attributes: `items` and `info`.
- `items`: contains the updated items list.
- `info`: This one can be used to achieve very advanced custom behaviours (ex: copy on drag). In most cases, don't worry about it. It is an object with the following properties: 
   * `trigger`: will be one of the exported list of TRIGGERS (Please import if you plan to use): [DRAG_STARTED, DRAGGED_ENTERED, DRAGGED_OVER_INDEX, DRAGGED_LEFT, DROPPED_INTO_ZONE, DROPPED_INTO_ANOTHER, DROPPED_OUTSIDE_OF_ANY]
   * `id`: the item id of the dragged element  
   * `source`: will be one of the exported list of SOURCES (Please import if you plan to use): [POINTER, KEYBOARD]

You have to listen for both events and update the list of items in order for this library to work correctly.

For advanced usecases you might also need to import SHADOW_ITEM_MARKER_PROPERTY_NAME, which marks the place holder element that is temporarily added to the list the dragged element hovers over. I haven't seen a usecase that required it yet, but you might be the first :)

### Accessibility (alpha)
If you want screen-readers to tell the user which item is being dragged and which container it interacts with, **please add `aria-label` on the container and on every draggable item**. The library will take care of the rest.
For example:
```html
<h2>{listName}</h2>
<section aria-label="{listName}" use:dndzone={{items, flipDurationMs}} on:consider={handleDndConsider} on:finalize={handleDndFinalize}>
	{#each items as item(item.id)}
		<div aria-label="{item.name}" animate:flip="{{duration: flipDurationMs}}">
				{item.name}
		</div>
	{/each}
</section>
```
If you don't provide the aria-labels everything will still work, but the messages to the user will be less informative.
*Note*: in general you probably want to use semantic-html (ex: `ol` and `li` elements rather than `section` and `div`) but the library is screen readers friendly regardless (or at least that's the goal :)).

##### Keyboard support
- Tab into a dnd container to get a description and instructions
- Tab into an item and press the *Space*/*Enter* key to enter dragging-mode. The reader will tell the user a drag has started. 
- Use the *arrow keys* while in dragging-mode to change the item's position in the list (down and right are the same, up and left are the same). The reader will tell the user about position changes.
- Tab to another dnd container while in dragging-mode in order to move the item to it (the item will be moved to it when it gets focus). The reader will tell the user that item was added to the new list.
- Press *Space*/*Enter* key while focused on an item, or the *Escape* key anywhere to exit dragging mode. The reader will tell the user that they are no longer dragging.  
- Clicking on another item while in drag mode will make it the new drag target. Clicking outside of any draggable will exit dragging-mode (and tell the user)
- Mouse drag and drop can be preformed independently of keyboard dragging (as in an item can be dragged with the mouse while in or out of keyboard initiated dragging-mode)
- Keyboard drag uses the same `consider` (only on drag start) and `finalize` (every time the item is moved) events but only has a subset of the `TRIGGERS`. The same handlers should work fine for both.  

### Rules/ assumptions to keep in mind
* Only one element can be dragged in any given time
* The data that represents items within dnd-zones **of the same type** is expected to have the same shape (as in a data object that represents an item in one container can be added to another without conversion).
* Item ids (#each keys) are unique in all dnd containers of the same type. EVERY DRAGGABLE ITEM (passed in through `items`) MUST HAVE AN ID PROPERTY CALLED `id`. You can override it globally if you'd like to use a different key (see below)
* The items in the list that is passed-in are in the same order as the children of the container (i.e the items are rendered in an #each block).
* The host component should refresh the items that are passed in to the custom-action when receiving consider and finalize events.
* FYI, the library assumes it is okay to add a temporary item to the items list in any of the dnd-zones while an element is dragged around.
* If you want dragged items to be able to scroll the container, make sure the scroll-container (the element with overflow:scroll) is the dnd-zone (the element decorated with this custom action)
* Svelte's built-in transitions might not play nice with this library. Luckily, it is an easy issue to work around. There are examples below.

### Overriding the item id key name
Sometimes it is useful to use a different key for your items instead of `id`, for example when working with PouchDB which expects `_id`. It can save some annoying conversions back and forth.
In such cases you can import and call `overrideItemIdKeyNameBeforeInitialisingDndZones`. This function accepts one parameter of type `string` which is the new id key name.
For example:
```javascript
import {overrideItemIdKeyNameBeforeInitialisingDndZones} from 'svelte-dnd-action';
overrideItemIdKeyNameBeforeInitialisingDndZones('_id');
``` 
It applies globally (as in, all of your items everywhere are expected to have a unique identifier with this name). It can only be called when there are no rendered dndzones (I recommend calling it within the top-level <script> tag, ex: in the App component).

### Examples
* [Super basic, single list, no animation](https://svelte.dev/repl/bbd709b1a00b453e94658392c97a018a?version=3.24.1)
* [Super basic, single list, with animation](https://svelte.dev/repl/3d544791e5c24fd4aa1eb983d749f776?version=3.24.1) 
* [Multiple dndzones, multiple types](https://svelte.dev/repl/4d23eb3b9e184b90b58f0867010ad258?version=3.24.1)
* [Board (nested zones and multiple types), scrolling containers, scrolling page](https://svelte.dev/repl/e2ef044af75c4b16b424b8219fb31fd9?version=3.22.2)
* [Selectively enable/disable drag/drop](https://svelte.dev/repl/44c9229556f3456e9883c10fc0aa0ee9?version=3)
* [Custom active dropzone styling](https://svelte.dev/repl/4ceecc5bae54490b811bd62d4d613e59?version=3.24.1) 
* [Customizing the dragged element](https://svelte.dev/repl/438fca28bb1f4eb1b34eff9dc6a728dc?version=3)

* [Copy on drag, simple and Dragula like](https://svelte.dev/repl/924b4cc920524065a637fa910fe10193?version=3.24.1)
* [Drag handles](https://svelte.dev/repl/4949485c5a8f46e7bdbeb73ed565a9c7?version=3.24.1), courtesy of @gleuch
* [Crazy nesting](https://svelte.dev/repl/fe8c9eca04f9417a94a8b6041df77139?version=3), courtesy of @zahachtah

* [Fade in/out but without using Svelte transitions](https://svelte.dev/repl/3f1e68203ef140969a8240eba3475a8d?version=3.24.1)
* [Nested fade in/out without using Svelte transitions](https://svelte.dev/repl/49b09aedfe0543b4bc8f575c8dbf9a53?version=3.24.1)


### Contributing [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/isaacHagoel/svelte-dnd-action/issues)
There is still quite a lot to do. If you'd like to contribute please get in touch (raise an issue or comment on an existing one).
Ideally, be specific about which area you'd like to help with.
Thank you for reading :)
