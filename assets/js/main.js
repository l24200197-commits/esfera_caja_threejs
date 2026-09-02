import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);

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
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 40;

scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 6);
scene.add(light);

const boxSize = 10;
const radius = 0.5;
const limit = boxSize / 2 - radius;

const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8fd3ff,
    transparent: true,
    opacity: 0.18,
    transmission: 0.9,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false
});
const glassBox = new THREE.Mesh(boxGeometry, glassMaterial);
scene.add(glassBox);

const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeometry),
    new THREE.LineBasicMaterial({ color: 0xbfe8ff })
);
scene.add(edges);

const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.35 })
);
scene.add(sphere);

const DEFAULT_VELOCITY = { x: 0.035, y: 0.027, z: 0.041 };
const velocity = new THREE.Vector3(
    DEFAULT_VELOCITY.x,
    DEFAULT_VELOCITY.y,
    DEFAULT_VELOCITY.z
);

// ===== Caja de controles: desplazadores de velocidad =====
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
        const value = parseFloat(input.value);
        velocity[axis] = value;
        output.textContent = value.toFixed(3);
    };
    input.addEventListener('input', apply);
    apply();
}

['x', 'y', 'z'].forEach(bindAxis);

document.getElementById('resetBtn').addEventListener('click', () => {
    sphere.position.set(0, 0, 0);
    ['x', 'y', 'z'].forEach((axis) => {
        axisInputs[axis].value = DEFAULT_VELOCITY[axis];
        axisInputs[axis].dispatchEvent(new Event('input'));
    });
});

// Marcas de impacto: anillos que aparecen al tocar una cara y se desvanecen
const half = boxSize / 2;
const markerDuration = 0.7; // segundos que dura visible la marca
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

let lastTime = performance.now();

function animate() {
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    sphere.position.add(velocity);

    if (sphere.position.x >= limit || sphere.position.x <= -limit) {
        velocity.x *= -1;
        sphere.position.x = THREE.MathUtils.clamp(sphere.position.x, -limit, limit);
        spawnMarker(
            new THREE.Vector3(Math.sign(sphere.position.x) * half, sphere.position.y, sphere.position.z),
            new THREE.Vector3(-Math.sign(sphere.position.x), 0, 0)
        );
    }
    if (sphere.position.y >= limit || sphere.position.y <= -limit) {
        velocity.y *= -1;
        sphere.position.y = THREE.MathUtils.clamp(sphere.position.y, -limit, limit);
        spawnMarker(
            new THREE.Vector3(sphere.position.x, Math.sign(sphere.position.y) * half, sphere.position.z),
            new THREE.Vector3(0, -Math.sign(sphere.position.y), 0)
        );
    }
    if (sphere.position.z >= limit || sphere.position.z <= -limit) {
        velocity.z *= -1;
        sphere.position.z = THREE.MathUtils.clamp(sphere.position.z, -limit, limit);
        spawnMarker(
            new THREE.Vector3(sphere.position.x, sphere.position.y, Math.sign(sphere.position.z) * half),
            new THREE.Vector3(0, 0, -Math.sign(sphere.position.z))
        );
    }

    updateMarkers(delta);

    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});