function formatAdmonitions() {
    const calloutPs = [...document.querySelectorAll('blockquote')]
        .map((bq) => bq.querySelector('p'))
        .filter((p) => /^\[!(.*)\]/.test(p.textContent))
    for (const p of calloutPs) {
        const bq = p.parentNode
        const type = p.textContent.match(/^\[!(.*)\]/)[1]
        if (/^\[!(.*)\]$/.test(p.textContent)) p.remove()
        else p.textContent = p.textContent.replace(/^\[!(.*)\]/, '')
        bq.classList.add('admonition', type)

        const icon = document.createElement('span')
        icon.classList.add('admonition-icon', type)
    }
}

document.addEventListener('DOMContentLoaded', formatAdmonitions)
