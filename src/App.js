import { UIManager } from './modules/UIManager.js';

export class App {
    constructor() {
        this.canvas = document.querySelector('#c');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.isWorkerReady = false;

        this.worker = new Worker(new URL('./workers/renderer.worker.js', import.meta.url), {
            type: 'module'
        });

        this.worker.onerror = (error) => {
            console.error("❌ An error occurred in the renderer worker:", error.message, error);
        };

        this.worker.onmessage = (event) => {
            if (event.data.type === 'ready') {
                this.isWorkerReady = true;
                this.loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    this.loadingOverlay.style.display = 'none';
                }, 500);
            }
        };

        const offscreen = this.canvas.transferControlToOffscreen();

        this.worker.postMessage({
            type: 'init',
            payload: {
                canvas: offscreen,
                badgeName: 'votes',
                width: window.innerWidth,
                height: window.innerHeight,
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                wasm: {
                    url: '/src/assets/wasm/geometry_optimizer.js'
                }
            }
        }, [offscreen]);

        this.setupEventListeners();

        this.fetchBadgeDetails().then(badgeDetails => {
            this.uiManager = new UIManager(badgeDetails, this.switchBadge.bind(this));
            this.uiManager.handleSwitch('votes');
        });
    }

    async fetchBadgeDetails() {
        return Promise.resolve({
            votes: { title: "The Gilded Horn", description: "Awarded for receiving the most Post Votes. Forged in community acclaim." },
            posters: { title: "The Creator's Quill", description: "Awarded to the most active Posters. A testament to prolific creation." },
            likes: { title: "Heart of the Community", description: "Awarded for the most liked comments. Powered by a custom GLSL shader." },
            commentators: { title: "The Dialogue Weaver", description: "Awarded to frequent Commentators. Geometry generated via C++/WASM." }
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onResize.bind(this), false);
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    }

    sendMessageToWorker(type, payload) {
        if (!this.isWorkerReady) return;
        this.worker.postMessage({ type, payload });
    }

    switchBadge(badgeName) {
        this.sendMessageToWorker('switchBadge', { badgeName });
    }

    onResize() {
        this.worker.postMessage({
            type: 'resize',
            payload: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        });
    }

    onMouseMove(event) {
        this.sendMessageToWorker('mouseMove', {
            mouseX: (event.clientX / window.innerWidth) * 2 - 1,
            mouseY: -(event.clientY / window.innerHeight) * 2 + 1
        });
    }
}