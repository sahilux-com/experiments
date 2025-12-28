import { CONFIG } from './config.js';

export const shapeTargets = {
    sphere: [],
    cube: [],
    heart: [],
    spiral: [],
    hand: [],
    fire: [],
    arrow: []
};

export function generateShapeTargets() {
    const cnt = CONFIG.particleCount;

    // Sphere
    shapeTargets.sphere = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
        const phi = Math.acos(-1 + (2 * i) / cnt);
        const theta = Math.sqrt(cnt * Math.PI) * phi;
        const r = 15;
        shapeTargets.sphere[i * 3] = r * Math.cos(theta) * Math.sin(phi);
        shapeTargets.sphere[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        shapeTargets.sphere[i * 3 + 2] = r * Math.cos(phi);
    }

    // Cube
    shapeTargets.cube = new Float32Array(cnt * 3);
    const side = 20;
    for (let i = 0; i < cnt; i++) {
        shapeTargets.cube[i * 3] = (Math.random() - 0.5) * side;
        shapeTargets.cube[i * 3 + 1] = (Math.random() - 0.5) * side;
        shapeTargets.cube[i * 3 + 2] = (Math.random() - 0.5) * side;
    }

    // Heart
    shapeTargets.heart = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
        let t = Math.random() * Math.PI * 2;
        // Parametric heart
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const z = (Math.random() - 0.5) * 10;
        const rOffset = (Math.random() - 0.5) * 2;
        shapeTargets.heart[i * 3] = (x + rOffset) * 0.8;
        shapeTargets.heart[i * 3 + 1] = (y + rOffset) * 0.8;
        shapeTargets.heart[i * 3 + 2] = z;
    }

    // Spiral
    shapeTargets.spiral = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
        const angle = i * 0.1;
        const r = i * 0.002 * 10;
        shapeTargets.spiral[i * 3] = Math.cos(angle * 0.5) * (7 + r);
        shapeTargets.spiral[i * 3 + 1] = (i * 0.003 - 15);
        shapeTargets.spiral[i * 3 + 2] = Math.sin(angle * 0.5) * (7 + r);
    }

    // Hand
    shapeTargets.hand = new Float32Array(cnt * 3);
    let i = 0;
    const palmCount = Math.floor(cnt * 0.4);
    for (; i < palmCount; i++) {
        shapeTargets.hand[i * 3] = (Math.random() - 0.5) * 12;
        shapeTargets.hand[i * 3 + 1] = (Math.random() - 0.5) * 10 - 5;
        shapeTargets.hand[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const fingers = [
        { x: -6, h: 8, rot: -0.3 },
        { x: -3, h: 12, rot: -0.1 },
        { x: 0, h: 13, rot: 0 },
        { x: 3, h: 11, rot: 0.05 },
        { x: 6, h: 9, rot: 0.15 }
    ];
    fingers.forEach(f => {
        const fCount = Math.floor(cnt * 0.12);
        for (let j = 0; j < fCount && i < cnt; j++, i++) {
            const h = Math.random() * f.h;
            const ang = Math.random() * Math.PI * 2;
            const r = 1.5;
            let lx = Math.cos(ang) * r + f.x;
            let ly = h;
            let lz = Math.sin(ang) * r;
            const rx = lx * Math.cos(f.rot) - ly * Math.sin(f.rot);
            const ry = lx * Math.sin(f.rot) + ly * Math.cos(f.rot);
            shapeTargets.hand[i * 3] = rx;
            shapeTargets.hand[i * 3 + 1] = ry;
            shapeTargets.hand[i * 3 + 2] = lz;
        }
    });

    // Fire
    shapeTargets.fire = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
        const r = Math.random() * 10;
        const h = Math.random() * 30 - 15;
        const taper = (15 - h) / 30 * 12;
        shapeTargets.fire[i * 3] = (Math.random() - 0.5) * taper + (Math.sin(h * 0.5) * 2);
        shapeTargets.fire[i * 3 + 1] = h;
        shapeTargets.fire[i * 3 + 2] = (Math.random() - 0.5) * taper + (Math.cos(h * 0.5) * 2);
    }

    // Arrow
    shapeTargets.arrow = new Float32Array(cnt * 3);
    const shaftCount = Math.floor(cnt * 0.7);
    // Shaft
    for (let i = 0; i < shaftCount; i++) {
        const h = Math.random() * 20 - 10;
        const theta = Math.random() * Math.PI * 2;
        const r = 3;
        shapeTargets.arrow[i * 3] = Math.cos(theta) * r;
        shapeTargets.arrow[i * 3 + 1] = h;
        shapeTargets.arrow[i * 3 + 2] = Math.sin(theta) * r;
    }
    // Head
    for (let i = shaftCount; i < cnt; i++) {
        const h = Math.random() * 10 + 10;
        const taper = (20 - h) / 10 * 8;
        const theta = Math.random() * Math.PI * 2;
        const rad = Math.random() * taper;
        shapeTargets.arrow[i * 3] = Math.cos(theta) * rad;
        shapeTargets.arrow[i * 3 + 1] = h;
        shapeTargets.arrow[i * 3 + 2] = Math.sin(theta) * rad;
    }
}
