import * as THREE from 'three';
import { BadgeFactory } from '../modules/BadgeFactory.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

let sceneManager;
let currentBadge;
let wasmModule;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type !== 'init' && !sceneManager) {
        console.warn(`Worker is not initialized yet. Ignoring message type: ${type}`);
        return;
    }

    switch (type) {
        case 'init':
            if (!wasmModule && payload.wasm) {
                const wasmFactory = await import(payload.wasm.url);
                wasmModule = await wasmFactory.default();
                BadgeFactory.setWasm(wasmModule);
            }
            init(payload.canvas, payload.badgeName, payload.width, payload.height);
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
    constructor(canvas, width, height) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.z = 12;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
        this.renderer.setPixelRatio(self.devicePixelRatio);
        this.renderer.setSize(width, height, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this._setupLighting();
        this._setupPostProcessing(width, height);
    }

    _setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        this.pointLight = new THREE.PointLight(0xffffff, 50, 100, 2);
        this.pointLight.position.set(0, 0, 8);
        this.scene.add(this.pointLight);
    }

    _setupPostProcessing(width, height) {
        const renderPass = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.2, 0.5, 0);
        const outputPass = new OutputPass();

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderPass);
        this.composer.addPass(bloomPass);

        const fxaaPass = new ShaderPass(FXAAShader);
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
        this.composer.addPass(fxaaPass);

        this.composer.addPass(outputPass);
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

function init(canvas, initialBadge, width, height) {
    sceneManager = new SceneManager(canvas, width, height);
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
        currentBadge.update(time, sceneManager.pointLight.position);
    }
    sceneManager.render();
    requestAnimationFrame(animate);
}