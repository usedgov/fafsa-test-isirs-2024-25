export function create_uuid_trie(parent) {
    let depth = parent ? 1+parent.depth : 0
    let idx0 = _uuid_offsets[depth]
    let shared = parent?.shared ?? {n_multi: 0}

    let node = {__proto__: _uuid_trie_proto,
        n:0, depth, db: new Map(), shared,
        key_for: uuid => (uuid.uuid ?? uuid).slice(idx0, 4 + idx0),
    }

    if (depth > (shared.max?.depth ?? -1))
        shared.max = {depth, node}
    return node
}
export default create_uuid_trie

const _uuid_offsets = [0, 4, 9, 14, 19, 24, 28, 32]
const _uuid_trie_proto = {
    lookup(uuid_search, result_path) {
        let key = this.key_for(uuid_search)
        let tip = this.db.get(key)

        if (!tip || tip.uuid) {
            let full_match = uuid_search == tip?.uuid
            // this is the last stop when:
            // * undefined entry
            // * is single-leaf trie entry (has uuid)
            if (!result_path)
                return full_match && tip

            result_path.push({key, tip, full_match, uuid_search})
            return result_path

        } else {
            // if tracking path, add this step
            result_path?.push({key, tip})

            // otherwise this is a multi-leaf entry; recurse from deeper trie node
            return tip.lookup(uuid_search, result_path)
        }
    },

    add_record(rec) {
        let key = this.key_for(rec.uuid)
        let tip = this.db.get(key)
        this.n++

        if (!tip) {
            // first entry at this key,
            // add singular leaf node
            this.db.set(key, rec)
            return rec
        }

        if (tip.uuid) {
            // singular leaf node
            if (tip.uuid == rec.uuid)
                return tip // duplicate entry

            // second entry at this key,
            // transform into multi-entry node
            let node = create_uuid_trie(this)
            node.add_record(tip)
            this.db.set(key, node)
            this.shared.n_multi++
            return node.add_record(rec)

        } else {
            // multi-leaf node; add to the deeper trie node
            return tip.add_record(rec)
        }
    },
}