<script>
    import {onDestroy} from "svelte";
    import Lists from "./Lists.svelte";

    let showFrame = true;
    let frameComponent;
    let popup;
    let popupComponent;
    let message = "";
    let frameMessage = "";

    // The same compiled component and library instance are used in all documents.
    // Svelte styles must also be available in the document into which the component is mounted.
    function mountLists(doc, prefix, title, sourceDoc) {
        const component = new Lists({target: doc.body, props: {prefix, title}});
        for (const style of sourceDoc.querySelectorAll("style")) {
            if (!style.id || !doc.getElementById(style.id)) doc.head.appendChild(style.cloneNode(true));
        }
        doc.body.style.margin = "0";
        return component;
    }

    function loadFrame(event) {
        frameComponent?.$destroy();
        const frame = event.currentTarget;
        if (!frame.contentDocument) {
            frameMessage = "Playground isolates iframe documents for visitors. To try this part, log in, fork/save this app and reload it, or use Download app and run it locally.";
            return;
        }
        frameMessage = "";
        frameComponent = mountLists(frame.contentDocument, "frame", "Same-origin iframe", frame.ownerDocument);
    }

    function toggleFrame() {
        frameComponent?.$destroy();
        frameComponent = undefined;
        frameMessage = "";
        showFrame = !showFrame;
    }

    function releasePopup() {
        popupComponent?.$destroy();
        popupComponent = undefined;
        popup = undefined;
    }

    function openPopup(event) {
        if (popup && !popup.closed) {
            popup.focus();
            return;
        }
        const sourceDoc = event.currentTarget.ownerDocument;
        try {
            popup = sourceDoc.defaultView.open("", "", "width=600,height=400");
            if (!popup) {
                message = "Pop-ups are blocked here. Allow pop-ups to try the separate-window example.";
                return;
            }
            popup.document.title = "svelte-dnd-action: separate window";
            popup.document.documentElement.lang = "en";
            popupComponent = mountLists(popup.document, "popup", "Separate popup window", sourceDoc);
            popup.addEventListener("pagehide", releasePopup, {once: true});
            message = "The popup has its own two lists. Move items between those lists; it is not a destination for drags in this page.";
        } catch (error) {
            if (error.name !== "SecurityError") throw error;
            popup?.close();
            popup = undefined;
            message = "Playground isolates popup documents for visitors. Log in, fork/save this app and reload it, or use Download app and run it locally.";
        }
    }

    onDestroy(() => {
        frameComponent?.$destroy();
        if (popup) {
            popup.removeEventListener("pagehide", releasePopup);
            popupComponent?.$destroy();
            popup.close();
        }
    });
</script>

<main>
    <h1>Zones in other windows</h1>
    <p>The library is loaded once, in this page. The same action also powers lists in the iframe and popup.</p>
    <details open>
        <summary>How to try it</summary>
        <ul>
            <li><strong>Pointer:</strong> drag between the two lists inside each document. Pointer drags do not cross document boundaries.</li>
            <li><strong>Keyboard:</strong> Tab to a card, press Enter or Space, then use arrows to reorder or Tab/Shift+Tab to move between lists—including this page and its iframe. Escape finishes.</li>
            <li><strong>Screen reader:</strong> each document has its own list instructions and automatic drag announcements.</li>
            <li><strong>Popup:</strong> its two lists work independently; neither pointer nor keyboard drags transfer to another top-level window.</li>
        </ul>
    </details>
    <div class="controls">
        <button on:click={toggleFrame}>{showFrame ? "Remove iframe" : "Recreate iframe"}</button>
        <button on:click={openPopup}>Open popup</button>
    </div>
    <p class="status" role="status">{message}</p>
    <p class="status" role="status">{frameMessage}</p>
    <Lists prefix="page" title="Loading document" />
    {#if showFrame}
        <iframe
            title="Drag-and-drop lists in a same-origin iframe"
            srcdoc="<!doctype html><html lang='en'><head><title>Iframe lists</title></head><body></body></html>"
            on:load={loadFrame}
        />
    {/if}
</main>

<style>
    main {
        max-width: 760px;
        margin: auto;
        padding: 16px;
        color: #243042;
        font: 14px/1.5 system-ui, sans-serif;
    }
    h1 {
        margin-top: 0;
        font-size: 26px;
    }
    details {
        padding: 10px;
        border-radius: 8px;
        background: #edf2f7;
    }
    summary {
        cursor: pointer;
        font-weight: 600;
    }
    ul {
        margin-bottom: 0;
        padding-left: 22px;
    }
    li {
        margin-bottom: 6px;
    }
    .controls {
        display: flex;
        gap: 8px;
        margin-top: 14px;
    }
    button {
        padding: 8px 12px;
        border: 1px solid #235dcb;
        border-radius: 6px;
        color: #174992;
        background: white;
        cursor: pointer;
    }
    button:focus-visible {
        outline: 3px solid #235dcb;
        outline-offset: 2px;
    }
    .status:empty {
        display: none;
    }
    iframe {
        box-sizing: border-box;
        width: 100%;
        height: 280px;
        border: 2px solid #8aa6c4;
        border-radius: 10px;
    }
</style>
