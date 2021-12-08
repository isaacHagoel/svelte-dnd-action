<script>
    import Board from "./Board.svelte";
    let board = [
        {
            id: 1,
            name: "TODO",
            items: [
                {id: 41, name: "item41"},
                {id: 42, name: "item42"},
                {id: 43, name: "item43"}
            ]
        },
        {
            id: 2,
            name: "DOING",
            items: []
        },
        {
            id: 3,
            name: "DONE",
            items: []
        }
    ];
</script>

<Board columnItems={board} />

<style>
    :global(*) {
        box-sizing: border-box;
        margin: 0;
    }
</style>
