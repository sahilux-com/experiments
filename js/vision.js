import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';
import * as THREE from 'three';

export const trackingState = {
    handPosition: null, // THREE.Vector3
    handState: 'none',  // 'open', 'closed', 'none'
    isReady: false
};

let handLandmarker = null;
let lastVideoTime = -1;
let video = null;
let canvas = null;
let canvasCtx = null;
let drawingUtils = null;
let statusText = null;
let indicator = null;

export async function initVision(videoElement, canvasElement, statusEl, indicatorEl, startBtn) {
    video = videoElement;
    canvas = canvasElement;
    canvasCtx = canvas.getContext('2d');
    statusText = statusEl;
    indicator = indicatorEl;

    statusText.innerText = "Loading Model...";

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });

    statusText.innerText = "Model Loaded. Click Start.";

    startBtn.addEventListener('click', () => startWebcam(startBtn));
}

async function startWebcam(btn) {
    btn.disabled = true;
    btn.style.opacity = 0.5;
    btn.innerText = "Starting Camera...";

    statusText.innerText = "Requesting Webcam...";
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            statusText.innerText = "Tracking Active";
            btn.style.display = 'none';

            // Match canvas size to video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            trackingState.isReady = true;
            // Start Voice (assumed handled by initVoice if called)
            startVoice();
        });
    } catch (err) {
        statusText.innerText = "Webcam Error!";
        console.error(err);
        btn.disabled = false;
        btn.style.opacity = 1;
        btn.innerText = "Try Again";
    }
}

export function updateVision(camera) {
    if (!trackingState.isReady || !handLandmarker || !video.videoWidth) return;

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, startTimeMs);

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // Draw Hand Manually (Robust Fallback)
            if (canvasCtx) {
                // Connections
                const connections = HandLandmarker.HAND_CONNECTIONS;
                canvasCtx.strokeStyle = "#00FF00";
                canvasCtx.lineWidth = 3;
                connections.forEach(conn => {
                    const start = landmarks[conn.start];
                    const end = landmarks[conn.end];
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(start.x * canvas.width, start.y * canvas.height);
                    canvasCtx.lineTo(end.x * canvas.width, end.y * canvas.height);
                    canvasCtx.stroke();
                });

                // Landmarks
                canvasCtx.fillStyle = "#FF0000";
                landmarks.forEach(pt => {
                    canvasCtx.beginPath();
                    canvasCtx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
                    canvasCtx.fill();
                });
            }

            // 1. Calculate Hand Position in 3D World relative to Camera
            const ndcX = (landmarks[9].x * 2 - 1) * -1; // Mirror X
            const ndcY = (landmarks[9].y * 2 - 1) * -1; // Flip Y

            const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const pos = camera.position.clone().add(dir.multiplyScalar(distance));

            trackingState.handPosition = pos;

            // 2. Gesture Detection
            const tips = [4, 8, 12, 16, 20];
            const wrist = landmarks[0];
            let totalDist = 0;
            tips.forEach(idx => {
                const dx = landmarks[idx].x - wrist.x;
                const dy = landmarks[idx].y - wrist.y;
                totalDist += Math.sqrt(dx * dx + dy * dy);
            });
            const avgDist = totalDist / 5;

            // Pinch Detection (Thumb Tip 4 to Index Tip 8)
            const pDx = landmarks[4].x - landmarks[8].x;
            const pDy = landmarks[4].y - landmarks[8].y;
            const pinchDist = Math.sqrt(pDx * pDx + pDy * pDy);

            // Relaxed Threshold 0.08 -> 0.1
            if (pinchDist < 0.1) {
                trackingState.handState = 'pinching';
                indicator.className = 'pinching';
                statusText.innerText = `Pinching (Dist: ${pinchDist.toFixed(2)})`;
            } else if (avgDist < 0.25) {
                trackingState.handState = 'closed';
                indicator.className = 'pull';
                statusText.innerText = `Pulling (Dist: ${pinchDist.toFixed(2)})`;
            } else {
                trackingState.handState = 'open';
                indicator.className = 'push';
                statusText.innerText = `Pushing (Dist: ${pinchDist.toFixed(2)})`;
            }
            indicator.classList.add('tracking');

        } else {
            trackingState.handPosition = null;
            trackingState.handState = 'none';
            indicator.className = '';
            statusText.innerText = "No Hand Detected";
        }
        canvasCtx.restore();
    }
}

// Voice Logic
let recognition = null;
let emotionCallback = null; // Function to call when keyword detected

export function initVoice(onEmotion) {
    emotionCallback = onEmotion;
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            console.log("Voice:", transcript);

            if (transcript.includes('wave') || transcript.includes('hello') || transcript.includes('hi')) {
                if (emotionCallback) emotionCallback('wave');
            } else if (transcript.includes('heart') || transcript.includes('love')) {
                if (emotionCallback) emotionCallback('heart');
            } else if (transcript.includes('happy') || transcript.includes('smile')) {
                if (emotionCallback) emotionCallback('happy');
            } else if (transcript.includes('void') || transcript.includes('dark')) {
                if (emotionCallback) emotionCallback('void');
            }
        };

        recognition.onerror = (e) => {
            console.error("Speech error", e);
            const el = document.getElementById('voice-status');
            if (el) el.innerText = "Mic Error/Denied";
        };
    } else {
        const el = document.getElementById('voice-status');
        if (el) el.innerText = "Voice API not supported";
    }
}

function startVoice() {
    if (recognition) {
        try {
            recognition.start();
            const el = document.getElementById('voice-status');
            if (el) el.innerText = "Mic On: Say 'Wave', 'Heart'...";
        } catch (e) { console.log('Mic auto-start failed', e); }
    }
}
