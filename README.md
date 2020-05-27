# SVELTE DND ACTION
This is an implementation of Trello-like drag and drop for Svelte using a custom action.

![dnd_demo2](https://user-images.githubusercontent.com/20507787/81682367-267eb780-9498-11ea-8dbc-5c9582033522.gif)

[Play with this example in the REPL](https://svelte.dev/repl/e2ef044af75c4b16b424b8219fb31fd9?version=3.22.2).

### Current Status
The library is working well as far as I can tell, but I have not used it in production yet. 

### Features
- Awesome drag and drop with minimal fuss 
- Supports horizontal, vertical or any other type of container (it doesn't care much about the shape)
- Supports nested dnd-zones (draggable containers with other draggable elements inside)
- Rich animations (can be opted out of)
- Touch support (beta)
- Define what can be dropped where (dnd-zones optionally have a "type")
- Scroll dnd-zones and/or the window horizontally or vertically by placing the dragged element next to the edge
- Performant and small footprint (no external dependencies, no fluff code)  

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

#### Basic Example:

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

#### Input:
An options-object with the following attributes:
- `items`: Array. The data array that is used to produce the list with the draggable items (the same thing you run your #each block on)
- `flipDurationMs`: Number. The same value you give the flip animation on the items (to make them animated as they "make space" for the dragged item). Set to zero or leave out if you don't want animations.
- `type`: Optional. String. dnd-zones that share the same type can have elements from one dragged into another. By default all dnd-zones have the same type.   

#### Output:
The action dispatches two custom events:
- `consider` - dispatched whenever the dragged element needs to make room for itself in a new position in the items list and when it leaves. The host (your component) is expected to update the items list (you can keep a copy of the original list if you need to)
- `finalize` - dispatched on the target and origin dnd-zones when the dragged element is dropped into position. The expectation is the same - update the list of items.
In both cases the payload (within e.detail) is the same: an object with a single attribute: `items`, that contains the updated items list.
You have to listen for both events and update the list of items in order for this library to work correctly.

### Rules/ assumptions to keep in mind
* Only one element can be dragged in any given time
* The data that represents items within dnd-zones **of the same type** is expected to have the same shape (as in a data object that represents an item in one container can be added to another without conversion).
* Item ids (#each keys) are unique in all dnd containers of the same type. EVERY DRAGGABLE MUST HAVE AN ID PROPERTY CALLED `id`.
* The items in the list that is passed-in are in the same order as the children of the container (i.e the items are rendered in an #each block).
* The host component should refresh the items that are passed in to the custom-action when receiving consider and finalize events.
* It is okay to add a temporary item to the items list in any of the dnd-zones while an element is dragged around.
* If you want dragged items to be able to scroll the container, make sure the scroll-container (the element with overflow:scroll) is the dnd-zone (the element decorated with this custom action)

### Contributing
There is still quite a lot to do. If you'd like to contribute please get in touch (raise an issue or comment on an existing one).
Ideally, be specific about which area you'd like to help with.
Thank you for reading :)