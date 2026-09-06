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

        const icon = document.createElement('i')
        icon.setAttribute('data-lucide', ICONS[type.toUpperCase()])
        icon.classList.add('admonition-icon', type)
        bq.appendChild(icon)
        icon.moveBefore(bq.firstChild)
    }
}

document.addEventListener('DOMContentLoaded', () => {
    formatAdmonitions()
    lucide.createIcons()
})

const ICONS = {
    NOTE: 'pencil',
    INFO: 'info',
    QUESTION: 'circle-question-mark',
    WARNING: 'circle-alert',
    TODO: 'check-check',
    TIP: 'flame',
}
