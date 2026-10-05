# Zones in other windows

[Open the official example REPL](https://svelte.dev/playground/be37a2f642a14a21ae8c5c11bf0a8055?version=4.2.20).

An example for Svelte 3/4's component API (the saved playground uses Svelte 4.2.20). It mounts the same `Lists` component and the same library instance into a page, a same-origin iframe and an optional popup. The component's styles are copied into each target document as well.

Playground isolates iframe and popup documents for visitors. To run the full example there, log in, fork/save it under your account, then reload. Alternatively, use **Download app** and run it locally. The example shows an explanatory notice when the sandbox blocks these documents; the page's own two lists still work. This is a Playground restriction, not a requirement of the library.

Each document contains two lists. Both pointer and keyboard dragging stay within that document: no transfers between the page, iframe or popup. All list and card labels are provided so the library's automatic instructions and announcements remain enabled.

An iframe that imports the library in its own app could already use it. This example demonstrates the different case this feature fixes: code loaded once in the parent page mounts components into other documents, without loading a separate app/library instance there.

Use unique item IDs across all the same-type lists, even when they are in different documents. Destroy mounted components when their host document is removed, and close the example's popup when the parent component is destroyed.

## Before publication

Run `yarn build`, then:

```sh
node examples/other-windows/create-playground.cjs --output /private/tmp/svelte-dnd-other-windows-playground.txt
```

Open the generated URL in Svelte Playground and save it under the maintainer's account, then reload. It embeds the exact local build as `dnd.js`, so it works without publishing a preview npm package. The draft is labelled as a release preview.

## At release

Generate with `--published` and update/save the official playground. This removes the embedded build and imports `svelte-dnd-action` from npm without a version pin, so the example uses the latest release. The official REPL can be prepared before publication, but other-document support will only work once npm includes this feature. After publication, reload and retest the REPL to verify that Playground resolves the new release.

## Manual checks

-   Reorder cards and move between both lists in the iframe with a mouse.
-   In each document, start a keyboard drag, reorder with arrows and move between its two lists with Tab/Shift+Tab; finish with Escape. Announcements must come from that document.
-   During a page drag, neither the iframe nor popup lists should be highlighted or offered as destinations. Focusing a list in another document must not move the item. Repeat starting in the iframe and popup.
-   Open the popup, reorder and transfer between its own two lists using both mouse and keyboard. It must not be advertised as a page-drag destination. If the playground blocks popups, run the downloaded example outside its sandbox.
-   Remove/recreate the iframe and close/reopen the popup; the remaining lists must keep working.
-   With a screen reader, verify the list labels, keyboard instructions, pickup, move and drop announcements in each document.
