export function createStore(initialValue) {
    let _val = initialValue;
    const subs = new Set();
    return {
        get: () => _val,
        set: newVal => {
            _val = newVal;
            Array.from(subs).forEach(cb => cb(_val));
        },
        subscribe: cb => {
            subs.add(cb);
            cb(_val);
        },
        unsubscribe: cb => {
            subs.delete(cb);
        }
    };
}
