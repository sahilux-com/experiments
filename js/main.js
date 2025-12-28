import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';
import { shapeTargets, generateShapeTargets } from './shapes.js';
import { initVision, updateVision, initVoice, trackingState } from './vision.js';

let scene, camera, renderer, particles, geometry, material;
let positions = [];
let velocities = [];
let shapeOffset = new THREE.Vector3();

// --- Init ---
async function init() {
    // Scene Setup
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 40;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Initialize Particles
    initParticles();

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    // Listeners
    window.addEventListener('resize', onWindowResize);
    setupUI();

    // Vision Init
    const video = document.getElementById('input_video');
    const canvas = document.getElementById('output_canvas');
    const statusText = document.getElementById('status-text');
    const indicator = document.getElementById('interaction-indicator');
    const btn = document.getElementById('start-tracking-btn');

    await initVision(video, canvas, statusText, indicator, btn);
    initVoice((emotion) => {
        setShape(
            emotion === 'wave' ? 'hand' :
                emotion === 'happy' ? 'spiral' :
                    emotion === 'void' ? 'cube' : emotion
        );
    });

    animate();
}

// --- Particles ---
function initParticles() {
    geometry = new THREE.BufferGeometry();
    generateShapeTargets(); // Populates shapeTargets export

    positions = new Float32Array(CONFIG.particleCount * 3);
    velocities = new Float32Array(CONFIG.particleCount * 3);

    // Initial positions
    for (let i = 0; i < CONFIG.particleCount * 3; i++) {
        positions[i] = shapeTargets.sphere[i];
        velocities[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    material = new THREE.PointsMaterial({
        size: CONFIG.particleSize,
        color: CONFIG.defaultColor,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}


function updateParticles() {
    updateVision(camera); // Update hand tracking

    const targetShape = shapeTargets[CONFIG.currShape] || shapeTargets.sphere;

    let forceCenter = trackingState.handPosition;
    let forceType = 0; // 0: none, 1: repel, -1: attract

    // Pinch / Drag Logic
    if (trackingState.handState === 'pinching' && forceCenter) {
        // Drag shape
        shapeOffset.lerp(forceCenter, 0.1);
    } else {
        // Spring back to center
        shapeOffset.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    }

    if (forceCenter) {
        if (trackingState.handState === 'open') forceType = 1;
        if (trackingState.handState === 'closed') forceType = -1;
        // Disable force interactions while pinching to avoid fighting drag
        if (trackingState.handState === 'pinching') forceType = 0;
    }

    const forceStrength = parseFloat(document.getElementById('force-strength').value) * 2.0;
    const radiusScale = parseFloat(document.getElementById('shape-radius').value);
    const time = performance.now() * 0.001;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const idx = i * 3;

        // 1. Return to Target (plus Offset)
        let tx = targetShape[idx] * radiusScale + shapeOffset.x;
        let ty = targetShape[idx + 1] * radiusScale + shapeOffset.y;
        let tz = targetShape[idx + 2] * radiusScale + shapeOffset.z;

        // Wave Animation
        if (CONFIG.currShape === 'hand') {
            const waveAngle = Math.sin(time * 3) * 0.3;
            const py = ty + 10 - shapeOffset.y; // Local Y
            const px = tx - shapeOffset.x;      // Local X
            const rpx = px * Math.cos(waveAngle) - py * Math.sin(waveAngle);
            const rpy = px * Math.sin(waveAngle) + py * Math.cos(waveAngle);
            tx = rpx + shapeOffset.x;
            ty = rpy - 10 + shapeOffset.y;
        }

        const dx = tx - positions[idx];
        const dy = ty - positions[idx + 1];
        const dz = tz - positions[idx + 2];

        velocities[idx] += dx * CONFIG.returnSpeed * 0.1;
        velocities[idx + 1] += dy * CONFIG.returnSpeed * 0.1;
        velocities[idx + 2] += dz * CONFIG.returnSpeed * 0.1;

        // 2. Interaction
        if (forceCenter && forceType !== 0) {
            const fx = positions[idx] - forceCenter.x;
            const fy = positions[idx + 1] - forceCenter.y;
            const fz = positions[idx + 2] - forceCenter.z;
            const distSq = fx * fx + fy * fy + fz * fz;

            if (distSq < 2500) {
                const dist = Math.sqrt(distSq);
                const force = (1.0 - dist / 50) * forceStrength;

                if (forceType === 1) { // Repel
                    velocities[idx] += (fx / dist) * force;
                    velocities[idx + 1] += (fy / dist) * force;
                    velocities[idx + 2] += (fz / dist) * force;
                } else { // Attract
                    velocities[idx] -= (fx / dist) * force;
                    velocities[idx + 1] -= (fy / dist) * force;
                    velocities[idx + 2] -= (fz / dist) * force;
                }
            }
        }

        // 3. Damping
        velocities[idx] *= CONFIG.damping;
        velocities[idx + 1] *= CONFIG.damping;
        velocities[idx + 2] *= CONFIG.damping;

        positions[idx] += velocities[idx];
        positions[idx + 1] += velocities[idx + 1];
        positions[idx + 2] += velocities[idx + 2];
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    updateParticles();
    renderer.render(scene, camera);
}

// --- UI ---
function setupUI() {
    // Shapes
    window.setShape = function (shape) {
        CONFIG.currShape = shape;
        document.querySelectorAll('.buttons button').forEach(b => {
            b.classList.remove('active');
            if (b.innerText.toLowerCase().includes(shape)) b.classList.add('active');
        });
    }

    // Color Picker
    document.getElementById('particle-color').addEventListener('input', (e) => {
        const color = new THREE.Color(e.target.value);
        particles.material.color = color;
        document.getElementById('color-val').innerText = e.target.value;
    });

    // Icons
    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
    }, 500);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Run
init();
