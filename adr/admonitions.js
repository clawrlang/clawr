function formatAdmonitions() {
    const calloutPs = [...document.querySelectorAll('blockquote')]
        .map((bq) => bq.querySelector('p'))
        .filter((p) => /^\[!(.*)\]/.test(p.textContent))
    for (const p of calloutPs) {
        const bq = p.parentNode
        const type = p.textContent.match(/^\[!(.*)\]/)[1]

        if (/^\[!(.*)\]$/.test(p.textContent))
            p.textContent = p.textContent.replace(/^\[!(.*)\]/, $1)
        else p.textContent = p.textContent.replace(/^\[!(.*)\]\s*/, '')

        bq.classList.add('admonition', type)

        const icon = document.createElement('i')
        icon.setAttribute('data-lucide', ICONS[type.toUpperCase()])
        icon.classList.add('admonition-icon', type)
        p.insertBefore(icon, p.firstChild)
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
