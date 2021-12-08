<script>
    // This is done in a single file for clarity. A more factored version here: https://svelte.dev/repl/288f827275db4054b23c437a572234f6?version=3.38.2
    import {flip} from "svelte/animate";
    import {dndzone} from "../../src/index";
    export let columnItems;
    const flipDurationMs = 200;
    let newItem = "";
    function handleDndConsiderColumns(e) {
        columnItems = e.detail.items;
    }
    function handleDndFinalizeColumns(e) {
        columnItems = e.detail.items;
    }
    function handleDndConsiderCards(cid, e) {
        const colIdx = columnItems.findIndex(c => c.id === cid);
        columnItems[colIdx].items = e.detail.items;
        columnItems = [...columnItems];
    }
    function handleDndFinalizeCards(cid, e) {
        const colIdx = columnItems.findIndex(c => c.id === cid);
        columnItems[colIdx].items = e.detail.items;
        columnItems = [...columnItems];
    }
    function handleClick(e) {
        alert("dragabble elements are still clickable :)");
    }

    function pushItem(colIdx) {
        columnItems[colIdx - 1].items = [...columnItems[colIdx - 1].items, {id: 100, name: newItem}];
        columnItems = [...columnItems];
    }
</script>

<section
    class="board"
    use:dndzone={{items: columnItems, flipDurationMs, type: "columns"}}
    on:consider={handleDndConsiderColumns}
    on:finalize={handleDndFinalizeColumns}
>
    {#each columnItems as column (column.id)}
        <div class="column" animate:flip={{duration: flipDurationMs}}>
            <div class="column-title">{column.name}</div>
            <div
                class="column-content"
                use:dndzone={{items: column.items, flipDurationMs}}
                on:consider={e => handleDndConsiderCards(column.id, e)}
                on:finalize={e => handleDndFinalizeCards(column.id, e)}
            >
                {#each column.items as item (item.id)}
                    <div class="card" animate:flip={{duration: flipDurationMs}} on:click={handleClick}>
                        {item.name}
                    </div>
                {/each}
                <div class="card nonmovingcard">
                    <input bind:value={newItem} />
                    <button on:click={() => pushItem(column.id)}> Add </button>
                </div>
            </div>
        </div>
    {/each}
</section>

<style>
    .board {
        height: 90vh;
        width: 100%;
        padding: 0.5em;
        margin-bottom: 40px;
    }
    .column {
        height: 100%;
        width: 250px;
        padding: 0.5em;
        margin: 1em;
        float: left;
        border: 1px solid #333333;
        /*Notice we make sure this container doesn't scroll so that the title stays on top and the dndzone inside is scrollable*/
        overflow-y: hidden;
    }
    .column-content {
        height: 100%;
        /* Notice that the scroll container needs to be the dndzone if you want dragging near the edge to trigger scrolling */
        overflow-y: scroll;
    }
    .column-title {
        margin-bottom: 1em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .card {
        height: 15%;
        width: 100%;
        margin: 0.4em 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #dddddd;
        border: 1px solid #333333;
    }

    .nonmovingcard {
        background-color: #dddddf;
        padding: 10px;
        cursor: default !important;
    }

    .nonmovingcard input {
        max-width: 50%;
    }
</style>
