import * as THREE from 'three';

export const CONFIG = {
    particleCount: 20000,
    particleSize: 0.15,
    defaultColor: new THREE.Color(0x00ffff),
    hoverColor: new THREE.Color(0xff00ff),
    maxForceDist: 30, // Distance for hand interaction
    returnSpeed: 0.08, // Speed returning to shape
    damping: 0.92,
    currShape: 'sphere'
};
