import * as hairline from '@lucasmarkes/hairline';

// The nineteen figures, in the order the library documents them.
const FIGURES = [
    'riffle', 'terrain', 'exploded', 'phosphor', 'slow', 'turntable', 'keyboard',
    'elevator', 'phone', 'laptop', 'terminal', 'cabinet', 'branches', 'vault',
    'lockers', 'padlock', 'patch', 'dish', 'router'
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
        FIGURES.forEach((name) => {
            const card = document.createElement('div');
            card.className = 'hairline-card';

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

            mounted.push(hairline[name](figure, {
                theme: 'dark',
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
