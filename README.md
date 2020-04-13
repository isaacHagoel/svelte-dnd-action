This is a WIP implementation of Trello like drag and drop for Svelte using a custom action.
For examples please see [here](https://github.com/isaacHagoel/svelte-dnd-action-examples)

TODO

* [ ] turn this into a proper README file


# Rules/ assumptions to keep in mind
* Only one element can be dragged in any given time
* The data that represents items dnd containers of the same type is expected to have the same shape (as in a data object from one container can be added to another without conversion)
* Item ids are unique in all dnd containers of the same type
* The items in the list that is passed in are in the same order as the children of the container (i.e the items are rendered in an #each block)
* The host component will refresh the items that are passed in to the action when receiving consider and finalize events
* It is okay to add an artificial item to the list while an element is dragged around