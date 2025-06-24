import * as THREE from 'three';
import { BadgeFactory } from '../modules/BadgeFactory.js';

let sceneManager;
let currentBadge;
let wasmModule;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'init':
            if (!wasmModule && payload.wasm) {
                const wasmFactory = await import(payload.wasm.url);
                wasmModule = await wasmFactory.default();
                BadgeFactory.setWasm(wasmModule);
            }
            init(payload.canvas, payload.badgeName);
            animate();
            break;
        case 'switchBadge':
            switchBadge(payload.badgeName);
            break;
        case 'mouseMove':
            if (sceneManager) {
                sceneManager.updateMouseLight(payload);
            }
            break;
        case 'resize':
            if (sceneManager) {
                sceneManager.onWindowResize(payload);
            }
            break;
    }
};

class SceneManager {
    constructor(canvas) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 1000);
        this.camera.position.z = 12;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(self.devicePixelRatio);
        this.renderer.setSize(canvas.width, canvas.height, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this._setupLighting();
    }

    _setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        this.pointLight = new THREE.PointLight(0xffffff, 50, 100, 2);
        this.pointLight.position.set(0, 0, 8);
        this.scene.add(this.pointLight);
    }

    onWindowResize({ width, height }) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    updateMouseLight({ mouseX, mouseY }) {
        if (!this.pointLight) return;
        const vector = new THREE.Vector3(mouseX, mouseY, 0.5).unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        this.pointLight.position.lerp(pos, 0.1);
    }

    add(object) { this.scene.add(object); }
    remove(object) { this.scene.remove(object); }
    render() { this.renderer.render(this.scene, this.camera); }
}


function init(canvas, initialBadge) {
    sceneManager = new SceneManager(canvas);
    switchBadge(initialBadge);
}

function switchBadge(badgeName) {
    if (currentBadge) {
        currentBadge.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.isMaterial) {
                    if (child.material.uniforms) {
                        Object.values(child.material.uniforms).forEach(uniform => {
                            if (uniform.value instanceof THREE.Texture) {
                                uniform.value.dispose();
                            }
                        });
                    }
                    child.material.dispose();
                }
            }
        });
        sceneManager.remove(currentBadge);
    }

    currentBadge = BadgeFactory.create(badgeName);
    if (currentBadge) {
        sceneManager.add(currentBadge);
    }
}

function animate() {
    const time = Date.now() * 0.001;
    if (currentBadge && typeof currentBadge.update === 'function') {
        currentBadge.update(time);
    }
    sceneManager.render();
    requestAnimationFrame(animate);
}