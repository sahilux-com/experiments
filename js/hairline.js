import * as hairline from '@lucasmarkes/hairline';

// The nineteen figures, in the order the library documents them.
const FIGURES = [
    'riffle', 'terrain', 'exploded', 'phosphor', 'slow', 'turntable', 'keyboard',
    'elevator', 'phone', 'laptop', 'terminal', 'cabinet', 'branches', 'vault',
    'lockers', 'padlock', 'patch', 'dish', 'router'
];

// Our own figures, drawn on the hairline-create kernel (js/figures/hairline-kernel.js,
// a classic script that defines HL; copied unchanged from github.com/lucasmarkes/hairline,
// MIT © Lucas Marques). Each one declares itself through window.hairline.
const CUSTOM = [];
window.hairline = (figure) => { CUSTOM.push(figure); };
await import('./figures/coupons.js');

// Mounts a kernel figure the way the library mounts its own, with the same
// { update, destroy } handle. The slider's 0-1 maps onto the figure's range.
function mountCustom(figure, el, { intensity, onRead }) {
    const [lo, mid, hi] = figure.range;
    const at = (i) => (i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid));

    HL.inject(document);
    el.setAttribute('data-hairline', figure.name);
    el.setAttribute('data-hairline-theme', 'dark');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', figure.means);
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, el);

    let text = null;
    const read = {
        get textContent() { return text; },
        set textContent(value) { text = value == null ? '' : String(value); onRead(text); }
    };
    const handle = figure.mount({ stage: el, svg, read }, at(intensity));
    if (text === null) read.textContent = 'rest';

    return {
        update: (options) => handle.set(at(options.intensity)),
        destroy: () => { handle.destroy(); svg.remove(); }
    };
}

const ALL = [
    ...FIGURES.map((name) => ({ name, mount: (el, options) => hairline[name](el, { theme: 'dark', ...options }) })),
    ...CUSTOM.map((figure) => ({ name: figure.name, mount: (el, options) => mountCustom(figure, el, options) }))
];

let mounted = [];

export function initHairline() {
    const overlay = document.getElementById('hairline-overlay');
    const grid = document.getElementById('hairline-grid');
    const intensity = document.getElementById('hairline-intensity');
    const intensityVal = document.getElementById('hairline-intensity-val');

    // Figures size themselves to their element's width, so mount them only
    // once the overlay is visible.
    function mount() {
        if (mounted.length) return;
        ALL.forEach(({ name, mount: draw }) => {
            const card = document.createElement('div');
            card.className = `hairline-card hairline-card--${name}`;

            const figure = document.createElement('div');
            figure.className = 'hairline-figure';

            const meta = document.createElement('div');
            meta.className = 'hairline-meta';
            const title = document.createElement('span');
            title.textContent = name;
            const reading = document.createElement('span');
            reading.className = 'hairline-reading';
            meta.append(title, reading);

            card.append(figure, meta);
            grid.appendChild(card);

            mounted.push(draw(figure, {
                intensity: parseFloat(intensity.value),
                onRead: (text) => { reading.textContent = text; }
            }));
        });
    }

    function open() {
        overlay.hidden = false;
        mount();
    }

    function close() {
        overlay.hidden = true;
    }

    document.getElementById('hairline-open-btn').addEventListener('click', open);
    document.getElementById('hairline-close-btn').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) close();
    });

    intensity.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        intensityVal.innerText = value.toFixed(2);
        mounted.forEach((f) => f.update({ intensity: value }));
    });
}
