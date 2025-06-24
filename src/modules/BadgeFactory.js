import * as THREE from "three";
import heartVertexShader from '../shaders/likes_badge/vertex.glsl?raw';
import heartFragmentShader from '../shaders/likes_badge/fragment.glsl?raw';

let wasmModule;

export class BadgeFactory {
    static setWasm(module) {
        wasmModule = module;
    }

    static create(badgeName) {
        switch (badgeName) {
            case 'votes': return this.createVotesBadge();
            case 'posters': return this.createPostersBadge();
            case 'likes': return this.createLikesBadge();
            case 'commentators': return this.createCommentatorsBadge();
            default: return null;
        }
    }

    static createVotesBadge() {
        const group = new THREE.Group();
        const hornMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15, sheen: 1, sheenColor: 0xffeec9 });
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1.5, 2, 0), new THREE.Vector3(0, 3, -1), new THREE.Vector3(-1.5, 4, 0)]);
        const hornGeometry = new THREE.TubeGeometry(curve, 64, 0.25, 12, false);
        const horn1 = new THREE.Mesh(hornGeometry, hornMaterial);
        const horn2 = horn1.clone();
        horn2.scale.x = -1;
        group.add(horn1, horn2);
        group.update = (time) => {
            group.rotation.y = time * 0.2;
        };
        return group;
    }

    static createPostersBadge() {
        const group = new THREE.Group();
        const quillMaterial = new THREE.MeshPhysicalMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.8 });
        const quillBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 4, 32), quillMaterial);
        const quillTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 32), quillMaterial);
        quillTip.position.y = -2.2;
        group.add(quillBody, quillTip);
        group.rotation.z = Math.PI / 8;
        group.update = (time) => {
            group.rotation.y = time * 0.1;
        };
        return group;
    }

    static createLikesBadge() {
        const group = new THREE.Group();
        const heartShape = new THREE.Shape();
        heartShape.moveTo(2.5, 2.5); heartShape.bezierCurveTo(2.5, 2.5, 2, 0, 0, 0); heartShape.bezierCurveTo(-3, 0, -3, 3.5, -3, 3.5); heartShape.bezierCurveTo(-3, 5.5, -1, 7.7, 2.5, 9.5); heartShape.bezierCurveTo(6, 7.7, 8, 5.5, 8, 3.5); heartShape.bezierCurveTo(8, 3.5, 8, 0, 5, 0); heartShape.bezierCurveTo(3.5, 0, 2.5, 2.5, 2.5, 2.5);
        const heartGeom = new THREE.ExtrudeGeometry(heartShape, { depth: 1, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.5, bevelThickness: 0.5 }).center().scale(0.3, 0.3, 0.3);

        const heartMat = new THREE.ShaderMaterial({
            vertexShader: heartVertexShader,
            fragmentShader: heartFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xff0055) },
                uLightPosition: { value: new THREE.Vector3(0, 0, 8) }
            }
        });

        const heart = new THREE.Mesh(heartGeom, heartMat);
        group.add(heart);

        group.update = (time, lightPosition) => {
            heartMat.uniforms.uTime.value = time;
            if (lightPosition) {
                heartMat.uniforms.uLightPosition.value.copy(lightPosition);
            }
            group.rotation.y = -time * 0.15;
        };
        return group;
    }

    static createCommentatorsBadge() {
    if (!wasmModule) {
        console.error("WASM module not initialized for Commentators Badge.");
        return new THREE.Group();
    }

    console.dir(wasmModule, { depth: null });

    const group = new THREE.Group();
    const weaverMat = new THREE.MeshPhysicalMaterial({
        color: 0x666688,
        metalness: 0.9,
        roughness: 0.3,
        emissive: 0x4444ff,
        emissiveIntensity: 0.2
    });

    const createWeaver = wasmModule.cwrap('createComplexWeaverGeometry', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
    const sizePtr = wasmModule._malloc(4);
    const verticesPtr = createWeaver(10, 1.5, 0.1, 5, 7, sizePtr);
    const size = wasmModule.getValue(sizePtr, 'i32');

    const weaverVerticesRaw = new Float32Array(wasmModule.memory.buffer, verticesPtr, size);

        const points = [];
        for (let i = 0; i < weaverVerticesRaw.length; i += 3) {
            points.push(new THREE.Vector3(weaverVerticesRaw[i], weaverVerticesRaw[i + 1], weaverVerticesRaw[i + 2]));
        }

        wasmModule._free(verticesPtr);
        wasmModule._free(sizePtr);

        const curve = new THREE.CatmullRomCurve3(points, true);
        const weaverGeom = new THREE.TubeGeometry(curve, 128, 0.3, 16, true);

        const weaver = new THREE.Mesh(weaverGeom, weaverMat);
        group.add(weaver);

        group.update = (time) => {
            group.rotation.x = time * 0.1;
            group.rotation.y = time * 0.15;
        };
        return group;
    }
}