# Zones in other windows

[Open the official release-preview REPL](https://svelte.dev/playground/be37a2f642a14a21ae8c5c11bf0a8055?version=4.2.20).

An example for Svelte 3/4's component API (the saved playground uses Svelte 4.2.20). It mounts the same `Lists` component and the same library instance into a page, a same-origin iframe and an optional popup. The component's styles are copied into each target document as well.

Playground isolates iframe and popup documents for visitors. To run the full example there, log in, fork/save it under your account, then reload. Alternatively, use **Download app** and run it locally. The example shows an explanatory notice when the sandbox blocks these documents; the page's own two lists still work. This is a Playground restriction, not a requirement of the library.

Each document contains two lists. Pointer dragging stays within that document. Keyboard dragging can transfer between the page and its same-origin iframe, but not between separate top-level windows. All list and card labels are provided so the library's automatic instructions and announcements remain enabled.

Use unique item IDs across all the same-type lists, even when they are in different documents. Destroy mounted components when their host document is removed, and close the example's popup when the parent component is destroyed.

## Before publication

Run `yarn build`, then:

```sh
node examples/other-windows/create-playground.cjs --output /private/tmp/svelte-dnd-other-windows-playground.txt
```

Open the generated URL in Svelte Playground and save it under the maintainer's account, then reload. It embeds the exact local build as `dnd.js`, so it works without publishing a preview npm package. The draft is labelled as a release preview.

## At release

After `0.9.80` is published, generate with `--published` and update/save the official playground. This removes the embedded build and imports `svelte-dnd-action@0.9.80` from npm. Do not use that variant before the package exists.

## Manual checks

-   Reorder cards and move between both lists in the iframe with a mouse.
-   Start a keyboard drag in the page, Tab into the iframe's list, then Shift+Tab back; continue reordering and finish with Escape.
-   Repeat in reverse, and verify the item retains focus and announcements come from its current document.
-   Open the popup, reorder and transfer between its own two lists using both mouse and keyboard. It must not be advertised as a page-drag destination. If the playground blocks popups, run the downloaded example outside its sandbox.
-   Remove/recreate the iframe and close/reopen the popup; the remaining lists must keep working.
-   With a screen reader, verify the list labels, keyboard instructions, pickup, move and drop announcements in each document.
