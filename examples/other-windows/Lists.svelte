<script>
    import {dndzone} from "svelte-dnd-action";
    import {flip} from "svelte/animate";

    export let prefix;
    export let title;
    const flipDurationMs = 150;
    let todo = [
        {id: `${prefix}-plan`, text: "Plan the example"},
        {id: `${prefix}-build`, text: "Build something"},
        {id: `${prefix}-test`, text: "Test with a keyboard"}
    ];
    let done = [{id: `${prefix}-read`, text: "Read the instructions"}];
</script>

<section class="board" aria-label={title}>
    <h2>{title}</h2>
    <div class="columns">
        <div>
            <h3>To do</h3>
            <div
                class="list"
                aria-label={`${title}: To do`}
                use:dndzone={{items: todo, type: "tasks", flipDurationMs}}
                on:consider={e => (todo = e.detail.items)}
                on:finalize={e => (todo = e.detail.items)}
            >
                {#each todo as item (item.id)}
                    <div class="card" aria-label={item.text} animate:flip={{duration: flipDurationMs}}>{item.text}</div>
                {/each}
            </div>
        </div>
        <div>
            <h3>Done</h3>
            <div
                class="list"
                aria-label={`${title}: Done`}
                use:dndzone={{items: done, type: "tasks", flipDurationMs}}
                on:consider={e => (done = e.detail.items)}
                on:finalize={e => (done = e.detail.items)}
            >
                {#each done as item (item.id)}
                    <div class="card" aria-label={item.text} animate:flip={{duration: flipDurationMs}}>{item.text}</div>
                {/each}
            </div>
        </div>
    </div>
</section>

<style>
    .board {
        color: #243042;
        font: 14px/1.5 system-ui, sans-serif;
        padding: 12px;
    }
    h2 {
        margin: 0 0 12px;
        font-size: 18px;
    }
    h3 {
        margin: 0 0 6px;
        font-size: 13px;
    }
    .columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }
    .list {
        min-height: 160px;
        padding: 8px;
        border: 1px solid #b9c7d6;
        border-radius: 8px;
        background: #edf2f7;
    }
    .card {
        box-sizing: border-box;
        margin-bottom: 8px;
        padding: 10px;
        border: 1px solid #c9d4df;
        border-radius: 6px;
        background: white;
    }
    .card:focus-visible,
    .list:focus-visible {
        outline: 3px solid #235dcb;
        outline-offset: 2px;
    }
</style>
