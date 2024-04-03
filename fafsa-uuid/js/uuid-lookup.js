import {aiter_stream_lines} from "https://cdn.jsdelivr.net/npm/csv-iter-parse@0.1.3/src/aiter-utils.js"
import {imm, imm_set, imm_html, imm_raf} from 'https://cdn.jsdelivr.net/npm/imm-dom@0.3.7/esm/index.min.js'
import {create_uuid_trie} from './uuid-trie.js'


window.on_use_csv_file = async (file) =>
    await on_load_csv_of_uuids( aiter_stream_lines( file.stream() ) )

export const uuid_search_api = {
    history: new Map(),

    search(uuid_search) {
        let el_search_result = this.history.get(uuid_search)
        if (null == el_search_result) {
            let el_status = imm_html.td()
            el_search_result = imm_html.tr(
                {class: 'search-result'},
                imm_html.td(`${uuid_search}`),
                el_status)
            this.history.set(uuid_search, el_search_result)

            this._update_status(uuid_search, el_status)
        }

        window.search_result_tbody.prepend(el_search_result)
    },

    async _update_status(uuid_search, el_status) {
        do {
            let match_found = window.uuid_trie.lookup(uuid_search)

            if (match_found) {
                return imm_set(el_status, {class:'hint-match'}, imm_html.b('Present'))
            } else if ('ready' == document.documentElement.dataset.status) {
                return imm_set(el_status, {class:'hint-nomatch'}, imm_html.b('Not'), ' present')
            } else if (!el_status.className) {
                imm_set(el_status, {class:'hint-caution'}, imm_html.i('(searching)'))
            }

            await imm_raf()
        } while (1)
    },

    clear() {
        this.history = new Map()
        imm_set(window.search_result_tbody)
    },

    refresh() {
        let prev_searches = this.history.keys()
        this.clear()

        for (let uuid of prev_searches)
            this.search(uuid)
    },

    evt_form(evt) {
        evt.preventDefault()
        let frm = new FormData(evt.target)
        return this.search(frm.get('uuid_search'))
    },

    evt_input(evt) {
        return this.search(evt.target.value)
    },
}
window.uuid_search_api = uuid_search_api



const _csv_uuid_progress = {
    n_report: 5000,
    update(ts0) {
        let td = (Date.now() - ts0)/1000
        let el = window.progress_tgt
        el.querySelector('[name=uuid_count]').textContent = `${uuid_trie.n}`

        //let [[,rec]] = uuid_trie.shared.max.node.db
        //console.log('Sample UUID:', rec.uuid)
        return imm_raf()
    }
}

export async function on_load_csv_of_uuids(aiter_lines, progress=_csv_uuid_progress) {
    document.documentElement.dataset.status = 'loading'

    let ts0 = new Date()
    window.uuid_trie = create_uuid_trie()
    for await (let n of _aiter_load_csv_of_uuids(window.uuid_trie, aiter_lines, progress.n_report))
        await progress.update(ts0)
    await progress.update(ts0)

    document.documentElement.dataset.status = 'ready'
    return window.uuid_trie
}
async function * _aiter_load_csv_of_uuids(uuid_trie, aiter_lines, n_batch) {
    // skip CSV header line
    await aiter_lines.next()

    let n = n_batch ?? 5000
    for await (let ln of aiter_lines) {
        let uuid = ln.split(',')[0].replaceAll('"', '')
        uuid_trie.add_record({uuid})

        if (0 >= --n) {
            // yield to UI thread after a batch
            yield n = n_batch
        }
    }

    console.log('Done loading UUIDs', {uuid_trie})
}
