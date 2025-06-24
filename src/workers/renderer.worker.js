import * as THREE from 'three';
import { BadgeFactory } from '../modules/BadgeFactory.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GodRaysPass } from '../postprocessing/GodRaysPass.js';
import { ChromaticAberrationPass } from '../postprocessing/ChromaticAberrationPass.js';

let sceneManager;
let currentBadge;
let wasmModule;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type === 'init') {
        if (!wasmModule && payload.wasm) {
            const wasmFactory = await import(payload.wasm.url);
            wasmModule = await wasmFactory.default();
            BadgeFactory.setWasm(wasmModule);
        }
        init(payload);
        animate();
        self.postMessage({ type: 'ready' });
        return;
    }

    if (!sceneManager) {
        console.warn(`Worker is not ready yet. Ignoring message type: ${type}`);
        return;
    }

    switch (type) {
        case 'switchBadge':
            switchBadge(payload.badgeName);
            break;
        case 'mouseMove':
            sceneManager.updateMouseLight(payload);
            break;
        case 'resize':
            sceneManager.onWindowResize(payload);
            break;
    }
};

class SceneManager {
    constructor(canvas, width, height, pixelRatio) {
        console.log(`Initializing SceneManager with:`, { width, height, pixelRatio });

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.z = 12;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this._setupLighting();
        this._setupPostProcessing(width, height);
    }

    _setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
        keyLight.position.set(-5, 5, 5);
        this.scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x8c9eff, 10, 100, 2);
        fillLight.position.set(5, 0, 5);
        this.scene.add(fillLight);

        this.pointLight = new THREE.PointLight(0xffffff, 15, 100, 2);
        this.pointLight.position.set(0, 0, 8);
        this.scene.add(this.pointLight);
    }

    _setupPostProcessing(width, height) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.5, 0.85);
        this.composer.addPass(bloomPass);

        this.chromaticAberrationPass = new ChromaticAberrationPass();
        this.composer.addPass(this.chromaticAberrationPass);

        const fxaaPass = new ShaderPass(FXAAShader);
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
        this.composer.addPass(fxaaPass);

        this.composer.addPass(new OutputPass());
    }

    onWindowResize({ width, height }) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
        this.composer.setSize(width, height);
        const pixelRatio = this.renderer.getPixelRatio();
        this.composer.passes.forEach(pass => {
            if (pass instanceof ShaderPass && pass.material.fragmentShader.includes('FXAA')) {
                pass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
                pass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
            }
        });
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
    render() { this.composer.render(); }
}

function init({ canvas, badgeName, width, height, pixelRatio }) {
    sceneManager = new SceneManager(canvas, width, height, pixelRatio);
    switchBadge(badgeName);
}

function switchBadge(badgeName) {
    if (currentBadge) {
        sceneManager.remove(currentBadge);
    }
    currentBadge = BadgeFactory.create(badgeName);
    if (currentBadge) {
        sceneManager.add(currentBadge);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;
    if (currentBadge?.update) {
        currentBadge.update(time, sceneManager.pointLight.position);
    }
    sceneManager.render();
}