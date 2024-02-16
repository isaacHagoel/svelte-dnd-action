# SVELTE DND ACTION [![Known Vulnerabilities](https://snyk.io/test/github/isaacHagoel/svelte-dnd-action/badge.svg?targetFile=package.json)](https://snyk.io/test/github/isaacHagoel/svelte-dnd-action?targetFile=package.json)

This is a feature-complete implementation of drag and drop for Svelte using a custom action. It supports almost every imaginable drag and drop use-case, any input device and is fully accessible. <br />
It requires very minimal configuration, while offering a rich set of primitives that allow overriding basically any of its default behaviours (using the handler functions). <br /><br />
See full features list below. <br />

![dnd_demo2](https://user-images.githubusercontent.com/20507787/81682367-267eb780-9498-11ea-8dbc-5c9582033522.gif)

[Play with this example in the REPL](https://svelte.dev/repl/e2ef044af75c4b16b424b8219fb31fd9?version=3).

### Current Status

The library is **production ready**, and I am in the process of integrating it into several production systems that will be used at scale.
It is being actively maintained.
**I am doing my best to avoid breaking-changes and keep the API stable**.

### Features

-   Awesome drag and drop with minimal fuss
-   Supports horizontal, vertical or any other type of container (it doesn't care much about the shape)
-   Supports nested dnd-zones (draggable containers with other draggable elements inside, think Trello)
-   Rich animations (can be opted out of)
-   Touch support
-   Define what can be dropped where (dnd-zones optionally have a "type")
-   Scroll dnd-zones and/or the window horizontally or vertically by placing the dragged element next to the edge
-   Supports advanced use-cases such as various flavours of copy-on-drag and custom drag handles (see examples below)
-   Performant and small footprint (no external dependencies, no fluff code)
-   Fully accessible (beta) - keyboard support, aria attributes and assistive instructions for screen readers

### Why a svelte action rather than a higher order component?

A custom action allows for a much more elegant API (no slot props thanks god) as well as more control. <br />
If you prefer a generic dnd list component that accepts different child components as your abstraction, you can very easily wrap this library with one (see [here](https://svelte.dev/repl/028674733f67409c94bd52995d5906f1?version=3)).

### Installation

**Pre-requisites**: svelte-3 (>=3.23.0)

```bash
yarn add -D svelte-dnd-action
```

or

```bash
npm install --save-dev svelte-dnd-action
```

### Usage

```html
<div use:dndzone="{{items: myItems, ...otherOptions}}" on:consider="{handler}" on:finalize="{handler}">
    {#each myItems as item(item.id)}
    <div>this is now a draggable div that can be dropped in other dnd zones</div>
    {/each}
</div>
```

##### Basic Example:

```html
<script>
    import {flip} from "svelte/animate";
    import {dndzone} from "svelte-dnd-action";
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
<section use:dndzone="{{items, flipDurationMs}}" on:consider="{handleDndConsider}" on:finalize="{handleDndFinalize}">
    {#each items as item(item.id)}
    <div animate:flip="{{duration: flipDurationMs}}">{item.name}</div>
    {/each}
</section>
```

##### Input:

An options-object with the following attributes:
| Name | Type | Required? | Default Value | Description |
| ------------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| `items` | Array&lt;Object&gt; | Yes. Each object in the array **has to have** an `id` property (key name can be overridden globally) with a unique value (within all dnd-zones of the same type) | N/A | The data array that is used to produce the list with the draggable items (the same thing you run your #each block on). The dndzone should not have children that don't originate in `items` |
| `flipDurationMs` | Number | No | `0` | The same value you give the flip animation on the items (to make them animated as they "make space" for the dragged item). Set to zero if you dont want animations, if unset it defaults to 100ms |
| `type` | String | No | Internal | dnd-zones that share the same type can have elements from one dragged into another. By default, all dnd-zones have the same type |
| `dragDisabled` | Boolean | No | `false` | Setting it to true will make it impossible to drag elements out of the dnd-zone. You can change it at any time, and the zone will adjust on the fly |
| `morphDisabled` | Boolean | No | `false` | By default, when dragging over a zone, the dragged element is morphed to look like it would if dropped. You can prevent it by setting this option. |
| `dropFromOthersDisabled` | Boolean | No | `false` | Setting it to true will make it impossible to drop elements from other dnd-zones of the same type. Can be useful if you want to limit the max number of items for example. You can change it at any time, and the zone will adjust on the fly |
| `zoneTabIndex` | Number | No | `0` | Allow user to set custom tabindex to the list container when not dragging. Can be useful if you want to make the screen reader to skip the list container. You can change it at any time. |
| `zoneItemTabIndex` | Number | No | `0` | Allow user to set custom tabindex to the list container items when not dragging. Can be useful if you use [Drag handles](https://github.com/isaacHagoel/svelte-dnd-action#examples-and-recipes). You can change it at any time. |
| `dropTargetStyle` | Object&lt;String&gt; | No | `{outline: 'rgba(255, 255, 102, 0.7) solid 2px'}` | An object of styles to apply to the dnd-zone when items can be dragged into it. Note: the styles override any inline styles applied to the dnd-zone. When the styles are removed, any original inline styles will be lost |
| `dropTargetClasses`| Array&lt;String&gt; | No | `[]` | A list of classes to apply to the dnd-zone when items can be dragged into it. Note: make sure the classes you use are global. |
| `transformDraggedElement` | Function | No | `() => {}` | A function that is invoked when the draggable element enters the dnd-zone or hover overs a new index in the current dnd-zone. <br />Signature:<br />function(element, data, index) {}<br />**element**: The dragged element. <br />**data**: The data of the item from the items array.<br />**index**: The index the dragged element will become in the new dnd-zone.<br /><br />This allows you to override properties on the dragged element, such as innerHTML to change how it displays. If what you are after is altering styles, do it to the children, not to the dragged element itself |
| `autoAriaDisabled` | Boolean | No | `false` | Setting it to true will disable all the automatically added aria attributes and aria alerts (for example when the user starts/ stops dragging using the keyboard).<br /> **Use it only if you intend to implement your own custom instructions, roles and alerts.** In such a case, you might find the exported function `alertToScreenReader(string)` useful. |
| `centreDraggedOnCursor` | Boolean | No | `false` | Setting it to true will cause elements from this dnd-zone to position their center on the cursor on drag start, effectively turning the cursor to the focal point that triggers all the dnd events (ex: entering another zone). Useful for dnd-zones with large items that can be dragged over small items. |

##### Output:

The action dispatches two custom events:

-   `consider` - dispatched whenever the dragged element needs to make room for itself in a new position in the items list and when it leaves. The host (your component) is expected to update the items list (you can keep a copy of the original list if you need to)
-   `finalize` - dispatched on the target and origin dnd-zones when the dragged element is dropped into position. This is the event you want to use to [save the items to the server](https://svelte.dev/repl/964fdac31cb9496da9ded35002300abb?version=3) for example.

The expectation is the same for both event handlers - update the list of items.
In both cases the payload (within e.detail) is the same: an object with two attributes: `items` and `info`.

-   `items`: contains the updated items list.
-   `info`: This one can be used to achieve very advanced custom behaviours (ex: copy on drag). In most cases, don't worry about it. It is an object with the following properties:
    -   `trigger`: will be one of the exported list of TRIGGERS (Please import if you plan to use): [DRAG_STARTED, DRAGGED_ENTERED, DRAGGED_ENTERED_ANOTHER, DRAGGED_OVER_INDEX, DRAGGED_LEFT, DRAGGED_LEFT_ALL, DROPPED_INTO_ZONE, DROPPED_INTO_ANOTHER, DROPPED_OUTSIDE_OF_ANY, DRAG_STOPPED]. Most triggers apply to both pointer and keyboard, but some are only relevant for pointer (dragged_entered, dragged_over_index and dragged_left), and some only for keyboard (drag_stopped).
    -   `id`: the item id of the dragged element
    -   `source`: will be one of the exported list of SOURCES (Please import if you plan to use): [POINTER, KEYBOARD]

You have to listen for both events and update the list of items in order for this library to work correctly.

For advanced use-cases (ex: [custom styling for the placeholder element](https://svelte.dev/repl/9c8db8b91b2142d19dcf9bc963a27838?version=3)) you might also need to import `SHADOW_ITEM_MARKER_PROPERTY_NAME`, which marks the placeholder element that is temporarily added to the list the dragged element hovers over.
For use cases that have recursively nested zones (ex: [crazy nesting](https://svelte.dev/repl/fe8c9eca04f9417a94a8b6041df77139?version=3)), you might want to import `SHADOW_PLACEHOLDER_ITEM_ID` in order to filter the placeholder out when passing the items in to the nested component.
If you need to manipulate the dragged element either dynamically (and don't want to use the `transformDraggedElement` option), or statically targeting it or its children with CSS, you can import and use `DRAGGED_ELEMENT_ID`;

### Accessibility (beta)

If you want screen-readers to tell the user which item is being dragged and which container it interacts with, **please add `aria-label` on the container and on every draggable item**. The library will take care of the rest.
For example:

```html
<h2>{listName}</h2>
<section aria-label="{listName}" use:dndzone="{{items, flipDurationMs}}" on:consider="{handleDndConsider}" on:finalize="{handleDndFinalize}">
    {#each items as item(item.id)}
    <div aria-label="{item.name}" animate:flip="{{duration: flipDurationMs}}">{item.name}</div>
    {/each}
</section>
```

If you don't provide the aria-labels everything will still work, but the messages to the user will be less informative.
_Note_: in general you probably want to use semantic-html (ex: `ol` and `li` elements rather than `section` and `div`) but the library is screen readers friendly regardless (or at least that's the goal :)).
If you want to implement your own custom screen-reader alerts, roles and instructions, you can use the `autoAriaDisabled` options and wire everything up yourself using markup and the `consider` and `finalize` handlers (for example: [unsortable list](https://svelte.dev/repl/e020ea1051dc4ae3ac2b697064f234bc?version=3)).

##### Keyboard support

-   Tab into a dnd container to get a description and instructions
-   Tab into an item and press the _Space_/_Enter_ key to enter dragging-mode. The reader will tell the user a drag has started.
-   Use the _arrow keys_ while in dragging-mode to change the item's position in the list (down and right are the same, up and left are the same). The reader will tell the user about position changes.
-   Tab to another dnd container while in dragging-mode in order to move the item to it (the item will be moved to it when it gets focus). The reader will tell the user that item was added to the new list.
-   Press _Space_/_Enter_ key while focused on an item, or the _Escape_ key anywhere to exit dragging mode. The reader will tell the user that they are no longer dragging.
-   Clicking on another item while in drag mode will make it the new drag target. Clicking outside of any draggable will exit dragging-mode (and tell the user)
-   Mouse drag and drop can be preformed independently of keyboard dragging (as in an item can be dragged with the mouse while in or out of keyboard initiated dragging-mode)
-   Keyboard drag uses the same `consider` (only on drag start) and `finalize` (every time the item is moved) events but share only some of the `TRIGGERS`. The same handlers should work fine for both.

### Examples and Recipes

-   [Super basic, single list, no animation](https://svelte.dev/repl/bbd709b1a00b453e94658392c97a018a?version=3)
-   [Super basic, single list, with animation](https://svelte.dev/repl/3d544791e5c24fd4aa1eb983d749f776?version=3)
-   [Multiple dndzones, multiple types](https://svelte.dev/repl/4d23eb3b9e184b90b58f0867010ad258?version=3)
-   [Board (nested zones and multiple types), scrolling containers, scrolling page](https://svelte.dev/repl/e2ef044af75c4b16b424b8219fb31fd9?version=3)
-   [Selectively enable/disable drag/drop](https://svelte.dev/repl/44c9229556f3456e9883c10fc0aa0ee9?version=3)
-   [Custom active dropzone styling](https://svelte.dev/repl/4ceecc5bae54490b811bd62d4d613e59?version=3)
-   [Customizing the dragged element](https://svelte.dev/repl/438fca28bb1f4eb1b34eff9dc6a728dc?version=3)
-   [Styling the dragged element](https://svelte.dev/repl/3d8be94b2bbd407c8a706d5054c8df6a?version=3)
-   [Customizing the placeholder(shadow) element](https://svelte.dev/repl/9c8db8b91b2142d19dcf9bc963a27838?version=3)

-   [Copy on drag, simple and Dragula like](https://svelte.dev/repl/924b4cc920524065a637fa910fe10193?version=3)
-   [Copy on drop and a drop area with a single slot](https://svelte.dev/repl/b4e120c45c3e48e49a0d637f0cf097d9?version=3)
-   [Drag handles](https://svelte.dev/repl/4949485c5a8f46e7bdbeb73ed565a9c7?version=3), courtesy of @gleuch
-   [Interaction (save/get items) with an asynchronous server](https://svelte.dev/repl/964fdac31cb9496da9ded35002300abb?version=3)
-   [Unsortable lists with custom aria instructions](https://svelte.dev/repl/e020ea1051dc4ae3ac2b697064f234bc?version=3)
-   [Crazy nesting](https://svelte.dev/repl/fe8c9eca04f9417a94a8b6041df77139?version=3), courtesy of @zahachtah
-   [Generic List Component (Alternative to Slots)](https://svelte.dev/repl/028674733f67409c94bd52995d5906f1?version=3)
-   [Maitaining internal scroll poisition on scrollable dragabble](https://svelte.dev/repl/eb2f5988bd2f46488810606c1fb13392?version=3)
-   [Scrabble like board using over a 100 single slot dnd-zones](https://svelte.dev/repl/ed2e138417094281be6db1aef23d7859?version=3)
-   [Select multiple elements to drag (multi-drag) with mouse or keyboard](https://svelte.dev/repl/c4eb917bb8df42c4b17402a7dda54856?version=3)

-   [Fade in/out but without using Svelte transitions](https://svelte.dev/repl/3f1e68203ef140969a8240eba3475a8d?version=3)
-   [Nested fade in/out without using Svelte transitions](https://svelte.dev/repl/49b09aedfe0543b4bc8f575c8dbf9a53?version=3)

### Rules/ assumptions to keep in mind

-   Only one element can be dragged in any given time
-   The data that represents items within dnd-zones **of the same type** is expected to have the same shape (as in a data object that represents an item in one container can be added to another without conversion).
-   Item ids (#each keys) are unique in all dnd containers of the same type. EVERY DRAGGABLE ITEM (passed in through `items`) MUST HAVE AN ID PROPERTY CALLED `id`. You can override it globally if you'd like to use a different key (see below)
-   Item ids are provided as the key for the #each block (no keyless each blocks please)
-   If you need to make a copy an item, you allocate a new id for the copy upon creation.
-   The items in the list that is passed-in are in the same order as the children of the container (i.e the items are rendered in an #each block), and the container has no extra (and no fewer) children.
-   Any data that should "survive" when the items are dragged around and dropped should be included in the `items` array that is passed in.
-   The host component must refresh the items that are passed in to the custom-action when receiving consider and finalize events (do not omit any handler).
-   FYI, the library assumes it is okay to add a temporary item to the items list in any of the dnd-zones while an element is dragged around.
-   If you want dragged items to be able to scroll the container, make sure the scroll-container (the element with overflow:scroll) is the dnd-zone (the element decorated with this custom action)
-   Svelte's built-in transitions might not play nice with this library. Luckily, it is an easy issue to work around. There are examples above.

### Overriding the item id key name

Sometimes it is useful to use a different key for your items instead of `id`, for example when working with PouchDB which expects `_id`. It can save some annoying conversions back and forth.
In such cases you can import and call `overrideItemIdKeyNameBeforeInitialisingDndZones`. This function accepts one parameter of type `string` which is the new id key name.
For example:

```javascript
import {overrideItemIdKeyNameBeforeInitialisingDndZones} from "svelte-dnd-action";
overrideItemIdKeyNameBeforeInitialisingDndZones("_id");
```

It applies globally (as in, all of your items everywhere are expected to have a unique identifier with this name). It can only be called when there are no rendered dndzones (I recommend calling it within the top-level <script> tag, ex: in the App component).

### Debug output

By default, no debug output will be logged to the console. If you want to see internal debug messages, you can enable the debug output like this:

```javascript
import {setDebugMode} from "svelte-dnd-action";
setDebugMode(true);
```

### Feature Flags

Feature flags allow controlling global optional behaviour. They were originally introduced as a way to enable a workaround for a browser bug that helps in certain scenarios but comes with unwanted side effects in others.
In order to set a feature flag use:

```javascript
import {setFeatureFlag, FEATURE_FLAG_NAMES} from "svelte-dnd-action";
setFeatureFlag(FEATURE_FLAG_NAMES.MY_FLAG, true);
```

Currently, there is only one flag: USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, which defaults to false.
See issues [454](https://github.com/isaacHagoel/svelte-dnd-action/issues/454) and [470](https://github.com/isaacHagoel/svelte-dnd-action/issues/470) for details about why it is needed and when (most users don't need to care about this)

```javascript
import {setDebugMode} from "svelte-dnd-action";
setDebugMode(true);
```

### Typescript

If you are using Typescript, you will need to add the following block to your `global.d.ts` (at least until [this svelte issue](https://github.com/sveltejs/language-tools/issues/431) is resolved):

#### Svelte 3 or below

```typescript
declare type Item = import("svelte-dnd-action").Item;
declare type DndEvent<ItemType = Item> = import("svelte-dnd-action").DndEvent<ItemType>;
declare namespace svelte.JSX {
    interface HTMLAttributes<T> {
        onconsider?: (event: CustomEvent<DndEvent<ItemType>> & {target: EventTarget & T}) => void;
        onfinalize?: (event: CustomEvent<DndEvent<ItemType>> & {target: EventTarget & T}) => void;
    }
}
```

#### Svelte 4:

```typescript
declare type Item = import("svelte-dnd-action").Item;
declare type DndEvent<ItemType = Item> = import("svelte-dnd-action").DndEvent<ItemType>;
declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        "on:consider"?: (event: CustomEvent<DndEvent<ItemType>> & {target: EventTarget & T}) => void;
        "on:finalize"?: (event: CustomEvent<DndEvent<ItemType>> & {target: EventTarget & T}) => void;
    }
}
```

You may need to edit `tsconfig.json` to include `global.d.ts` if it doesn't already: "include": ["src/**/*", "global.d.ts"].

> Note: If you are using Sveltekit you should use `svelte.config.js` to modify the generated `tsconfig.json` rather than adding the `include` element to the root `tsconfig.json`.  Adding `include` to the root file will cause issues because it will [override](https://www.typescriptlang.org/tsconfig#extends) the `include` array defined in `.svelte-kit/tsconfig.json`. Example:
> ```javascript
> const config = {
>   kit: {
>     typescript: {
>       config(config) {
>          // This path is relative to the ".svelte-kit" folder
>         config.include.push('../global.d.ts');
>       },
>     },
>   },
> };
> ```

Then you will be able to use the library with type safety as follows (Typescript gurus out there, improvements are welcome :smile:):

```html
<style>
    section {
        width: 12em;
        padding: 1em;
        height: 7.5em;
    }
    div {
        height: 1.5em;
        width: 10em;
        text-align: center;
        border: 1px solid black;
        margin: 0.2em;
        padding: 0.3em;
    }
</style>
<script lang="ts">
    import {dndzone} from "svelte-dnd-action";
    import {flip} from "svelte/animate";

    const flipDurationMs = 200;
    function handleSort(e: CustomEvent<DndEvent>) {
        items = e.detail.items as {id: number; title: string}[];
    }

    let items = [
        {id: 1, title: "I"},
        {id: 2, title: "Am"},
        {id: 3, title: "Yoda"}
    ];
</script>
<section use:dndzone="{{items, flipDurationMs}}" on:consider="{handleSort}" on:finalize="{handleSort}">
    {#each items as item(item.id)}
    <div animate:flip="{{duration:flipDurationMs}}">{item.title}</div>
    {/each}
</section>
```

#### Custom types with `DndEvent<T>`

You can use generics to set the type of `items` you are expecting in `DndEvent`. Simply add a type to it like so: `DndEvent<Dog>`. For example:

```html
<script lang="ts">
    import {dndzone} from "svelte-dnd-action";
    import {flip} from "svelte/animate";

    interface Dog {
        id: number;
        name: string;
        breed: string;
    }

    function handleSort(e: CustomEvent<DndEvent<Dog>>) {
        //e.detail.items now evaluates to type Dog.
        items = e.detail.items;
    }

    let items: Dog[] = [
        {id: 1, name: "Fido", breed: "bulldog"},
        {id: 2, name: "Spot", breed: "labrador"},
        {id: 3, name: "Jacky", breed: "golden retriever"}
    ];
</script>
```

### Nested Zones Optional Optimization (experimental)

This is an experimental feature added in version 0.9.29. If you have multiple levels of nesting, the lib might do unnecessary work when dragging an element that has nested zones inside.
Specifically, it allows nested zones within the shadow element (the placeholder under the dragged element) to register and destroy.
This is because Svelte calls nested actions before the parent action (opposite to the rendering order).
You can use a data attribute **on the items** to help the lib prevent this: `data-is-dnd-shadow-item-hint={item[SHADOW_ITEM_MARKER_PROPERTY_NAME]} `

#### Simplified Example (just shows where to place the attribute):

```html
<script>
    import {dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME} from 'svelte-dnd-action';
    let items = [];
</script>
<section>
    <div use:dndzone={{items}} on:consider={e => items = e.detail.items} on:finalize={e => items = e.detail.items}>
        {#each items as item (item.id)}
            <div data-is-dnd-shadow-item-hint={item[SHADOW_ITEM_MARKER_PROPERTY_NAME]}>
                <h1>{item.title}</h1>
                <!--more nested zones go here, can include the attribute on their items as demonstrated above-->
            </div>
        {/each}
    </div>
</section>
```

### Contributing [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/isaacHagoel/svelte-dnd-action/issues)

There is still quite a lot to do. If you'd like to contribute please get in touch (raise an issue or comment on an existing one).
Ideally, be specific about which area you'd like to help with.
Thank you for reading :)
