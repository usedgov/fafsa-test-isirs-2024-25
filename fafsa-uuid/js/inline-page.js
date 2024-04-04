import {doc_inline_page_download} from 'https://cdn.jsdelivr.net/npm/imm-dom@0.3.7/esm/util/inline_page.js'

window.download_doc_inline_page = async () => {
    if (document.documentElement.dataset.status)
        throw new Error('Download after refreshing')
    
    let el = await doc_inline_page_download()
    el.click()
    return el
}