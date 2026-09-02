import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.Fog(0x05070c, 20, 58);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(9, 7, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);

// Entorno HDR sintetico para reflejos/refracciones realistas
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 40;

scene.add(new THREE.AmbientLight(0xffffff, 1.1));
scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x1a2436, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 2.4);
light.position.set(6, 12, 7);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.camera.near = 1;
light.shadow.camera.far = 45;
light.shadow.camera.left = -12;
light.shadow.camera.right = 12;
light.shadow.camera.top = 12;
light.shadow.camera.bottom = -12;
light.shadow.bias = -0.0005;
scene.add(light);

const boxSize = 10;
const radius = 0.5;
const limit = boxSize / 2 - radius;
const half = boxSize / 2;

// Cubo de cristal sin bordes: aristas ligeramente redondeadas que
// atrapan la luz, transmision total y doble refraccion (grosor).
const boxGeometry = new RoundedBoxGeometry(boxSize, boxSize, boxSize, 6, 0.12);
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    ior: 1.48,
    thickness: 0.35,
    attenuationColor: new THREE.Color(0xcdeeff),
    attenuationDistance: 3,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    specularIntensity: 1,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false
});
const glassBox = new THREE.Mesh(boxGeometry, glassMaterial);
glassBox.renderOrder = 2;
scene.add(glassBox);

// ===== Plano: piso de obsidiana pulida + rejilla + sombras =====
const floorY = -half;
const FLOOR_SIZE = 80;

// Acabado realista tipo obsidiana pulida: reflejo suave del entorno
// (sin espejo perfecto, para evitar destellos) y recibe las sombras.
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshStandardMaterial({
        color: 0x05070c,
        roughness: 0.45,
        metalness: 0.0,
        envMapIntensity: 0.25
    })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = floorY - 0.02;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(60, 60, 0x2aa9cf, 0x123647);
grid.position.y = floorY - 0.012;
grid.material.transparent = true;
grid.material.opacity = 0.26;
grid.material.depthWrite = false;
scene.add(grid);

// Halo reactivo bajo el piso: pulsa con cada choque
const floorGlow = new THREE.Mesh(
    new THREE.RingGeometry(half * 0.25, half * 1.05, 64),
    new THREE.MeshBasicMaterial({
        color: 0x1e9fd0,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    })
);
floorGlow.rotation.x = -Math.PI / 2;
floorGlow.position.y = floorY - 0.008;
scene.add(floorGlow);
let glowPulse = 0;

function pulseFloor(amount) {
    glowPulse = Math.min(glowPulse + amount, 1);
}

// ===== Esferas =====
const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
const sphereColors = [
    0xff7043, 0x42a5f5, 0x66bb6a, 0xffca28,
    0xab47bc, 0xef5350, 0x26c6da, 0xd4e157
];
const spheres = [];

const DEFAULT_BASE_SPEED = { x: 0.035, y: 0.027, z: 0.041 };
const baseSpeed = { ...DEFAULT_BASE_SPEED };

function randomSign() {
    return Math.random() < 0.5 ? -1 : 1;
}

function addSphere() {
    const mesh = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshPhysicalMaterial({
            color: sphereColors[spheres.length % sphereColors.length],
            roughness: 0.15,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            envMapIntensity: 1.2
        })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(
        THREE.MathUtils.randFloat(-limit, limit),
        THREE.MathUtils.randFloat(-limit, limit),
        THREE.MathUtils.randFloat(-limit, limit)
    );
    const velocity = new THREE.Vector3(
        baseSpeed.x * randomSign(),
        baseSpeed.y * randomSign(),
        baseSpeed.z * randomSign()
    );
    scene.add(mesh);
    spheres.push({ mesh, velocity });
}

function removeSphere() {
    const s = spheres.pop();
    if (!s) return;
    scene.remove(s.mesh);
    s.mesh.material.dispose();
}

function setSphereCount(n) {
    while (spheres.length < n) addSphere();
    while (spheres.length > n) removeSphere();
}

// Reescala la velocidad de todas las esferas conservando el sentido de cada eje
function applyBaseSpeed() {
    for (const s of spheres) {
        ['x', 'y', 'z'].forEach((axis) => {
            const dir = s.velocity[axis] >= 0 ? 1 : -1;
            s.velocity[axis] = dir * baseSpeed[axis];
        });
    }
}

// ===== Caja de controles =====
const countInput = document.getElementById('count');
const countOut = document.getElementById('countOut');
countInput.addEventListener('input', () => {
    const n = parseInt(countInput.value, 10);
    countOut.textContent = n;
    setSphereCount(n);
});

const axisInputs = {
    x: document.getElementById('velX'),
    y: document.getElementById('velY'),
    z: document.getElementById('velZ')
};
const axisOutputs = {
    x: document.getElementById('velXOut'),
    y: document.getElementById('velYOut'),
    z: document.getElementById('velZOut')
};

function bindAxis(axis) {
    const input = axisInputs[axis];
    const output = axisOutputs[axis];
    const apply = () => {
        const value = Math.abs(parseFloat(input.value));
        baseSpeed[axis] = value;
        output.textContent = value.toFixed(3);
        applyBaseSpeed();
    };
    input.addEventListener('input', apply);
    output.textContent = Math.abs(parseFloat(input.value)).toFixed(3);
}
['x', 'y', 'z'].forEach(bindAxis);

let soundEnabled = document.getElementById('soundOn').checked;
let masterVolume = parseFloat(document.getElementById('volume').value);
document.getElementById('soundOn').addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});
const volumeInput = document.getElementById('volume');
const volumeOut = document.getElementById('volumeOut');
volumeInput.addEventListener('input', () => {
    masterVolume = parseFloat(volumeInput.value);
    volumeOut.textContent = masterVolume.toFixed(2);
});
volumeOut.textContent = masterVolume.toFixed(2);

document.getElementById('resetBtn').addEventListener('click', () => {
    ['x', 'y', 'z'].forEach((axis) => {
        axisInputs[axis].value = DEFAULT_BASE_SPEED[axis];
        baseSpeed[axis] = DEFAULT_BASE_SPEED[axis];
        axisOutputs[axis].textContent = DEFAULT_BASE_SPEED[axis].toFixed(3);
    });
    for (const s of spheres) {
        s.mesh.position.set(
            THREE.MathUtils.randFloat(-limit, limit),
            THREE.MathUtils.randFloat(-limit, limit),
            THREE.MathUtils.randFloat(-limit, limit)
        );
        s.velocity.set(
            baseSpeed.x * randomSign(),
            baseSpeed.y * randomSign(),
            baseSpeed.z * randomSign()
        );
    }
});

// ===== Sonido de choque (Web Audio API) =====
let audioCtx = null;
let lastSoundAt = 0;

function ensureAudio() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
window.addEventListener('pointerdown', ensureAudio);

function playClack(intensity) {
    if (!soundEnabled || masterVolume <= 0) return;
    ensureAudio();
    if (!audioCtx) return;

    const t = performance.now();
    if (t - lastSoundAt < 25) return; // evita saturar con choques simultaneos
    lastSoundAt = t;

    const now = audioCtx.currentTime;
    const length = Math.floor(audioCtx.sampleRate * 0.14);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700 + intensity * 2600;
    filter.Q.value = 1.1;

    const gain = audioCtx.createGain();
    gain.gain.value = Math.min(0.4, 0.08 + intensity * 0.5) * masterVolume;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + 0.14);
}

// ===== Marcas de impacto contra las caras =====
const markerDuration = 0.7;
const activeMarkers = [];
const markerGeometry = new THREE.RingGeometry(radius * 0.6, radius * 1.6, 32);

function spawnMarker(position, normal) {
    const material = new THREE.MeshBasicMaterial({
        color: 0xfff2b0,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const marker = new THREE.Mesh(markerGeometry, material);
    marker.position.copy(position).addScaledVector(normal, 0.01);
    marker.lookAt(position.clone().add(normal));
    scene.add(marker);
    activeMarkers.push({ mesh: marker, material, life: markerDuration });
}

function updateMarkers(delta) {
    for (let i = activeMarkers.length - 1; i >= 0; i--) {
        const m = activeMarkers[i];
        m.life -= delta;
        const t = Math.max(m.life / markerDuration, 0);
        m.material.opacity = 0.9 * t;
        m.mesh.scale.setScalar(1 + (1 - t) * 1.5);
        if (m.life <= 0) {
            scene.remove(m.mesh);
            m.material.dispose();
            activeMarkers.splice(i, 1);
        }
    }
}

// ===== Chispas =====
const MAX_BURSTS = 40;
const sparkBursts = [];

function spawnSparks(position, intensity, tint) {
    if (sparkBursts.length >= MAX_BURSTS) return;

    const count = 8 + Math.round(intensity * 10);
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;
        vels.push(
            new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize().multiplyScalar(THREE.MathUtils.randFloat(1.5, 4) * (0.6 + intensity))
        );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: tint,
        size: 0.14,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    sparkBursts.push({ points, geo, mat, vels, life: 0.45, maxLife: 0.45 });
}

function updateSparks(delta) {
    for (let i = sparkBursts.length - 1; i >= 0; i--) {
        const b = sparkBursts[i];
        b.life -= delta;
        const arr = b.geo.attributes.position.array;
        for (let j = 0; j < b.vels.length; j++) {
            arr[j * 3] += b.vels[j].x * delta;
            arr[j * 3 + 1] += b.vels[j].y * delta;
            arr[j * 3 + 2] += b.vels[j].z * delta;
            b.vels[j].multiplyScalar(0.9);
        }
        b.geo.attributes.position.needsUpdate = true;
        b.mat.opacity = Math.max(b.life / b.maxLife, 0);
        if (b.life <= 0) {
            scene.remove(b.points);
            b.geo.dispose();
            b.mat.dispose();
            sparkBursts.splice(i, 1);
        }
    }
}

// ===== Colisiones =====
const AXES = ['x', 'y', 'z'];
const tmpNormal = new THREE.Vector3();
const tmpRel = new THREE.Vector3();

function collideWithWalls(s) {
    for (const axis of AXES) {
        const p = s.mesh.position[axis];
        if (p >= limit || p <= -limit) {
            s.velocity[axis] *= -1;
            s.mesh.position[axis] = THREE.MathUtils.clamp(p, -limit, limit);

            const contact = s.mesh.position.clone();
            contact[axis] = Math.sign(p) * half;
            const normal = new THREE.Vector3();
            normal[axis] = -Math.sign(p);

            const speed = Math.abs(s.velocity[axis]);
            const intensity = THREE.MathUtils.clamp(speed / 0.12, 0.1, 1);
            spawnMarker(contact, normal);
            spawnSparks(contact, intensity, 0xfff2b0);
            playClack(intensity);
            pulseFloor(intensity * 0.6);
        }
    }
}

function collidePair(a, b) {
    tmpNormal.subVectors(b.mesh.position, a.mesh.position);
    const dist = tmpNormal.length();
    const minDist = radius * 2;
    if (dist === 0 || dist >= minDist) return;

    tmpNormal.multiplyScalar(1 / dist); // normal a -> b

    // separar el solapamiento
    const overlap = (minDist - dist) / 2;
    a.mesh.position.addScaledVector(tmpNormal, -overlap);
    b.mesh.position.addScaledVector(tmpNormal, overlap);

    // choque elastico de masas iguales: se intercambia la componente normal
    tmpRel.subVectors(a.velocity, b.velocity);
    const sep = tmpRel.dot(tmpNormal);
    if (sep <= 0) return; // ya se estan separando

    a.velocity.addScaledVector(tmpNormal, -sep);
    b.velocity.addScaledVector(tmpNormal, sep);

    const contact = a.mesh.position.clone().addScaledVector(tmpNormal, radius);
    const intensity = THREE.MathUtils.clamp(sep / 0.15, 0.15, 1);
    spawnSparks(contact, intensity, 0xbdecff);
    playClack(intensity);
    pulseFloor(intensity * 0.4);
}

// ===== Post-proceso: bloom cinematografico =====
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.32, // strength
    0.5,  // radius
    0.86  // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ===== Bucle =====
let lastTime = performance.now();

function animate() {
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    for (const s of spheres) {
        s.mesh.position.add(s.velocity);
        collideWithWalls(s);
    }

    for (let i = 0; i < spheres.length; i++) {
        for (let j = i + 1; j < spheres.length; j++) {
            collidePair(spheres[i], spheres[j]);
        }
    }

    updateMarkers(delta);
    updateSparks(delta);

    // halo del piso: decae suave y respira ligeramente
    glowPulse = Math.max(glowPulse - delta * 1.8, 0);
    const breathe = 0.015 + 0.01 * Math.sin(now * 0.002);
    floorGlow.material.opacity = breathe + glowPulse * 0.4;
    floorGlow.scale.setScalar(1 + glowPulse * 0.15);
    grid.material.opacity = 0.28 + glowPulse * 0.3;

    controls.update();
    composer.render();
}

setSphereCount(parseInt(countInput.value, 10));
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});
