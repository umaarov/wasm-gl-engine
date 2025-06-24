import { UIManager } from './modules/UIManager.js';

export class App {
    constructor() {
        this.canvas = document.querySelector('#c');
        this.worker = new Worker(new URL('./workers/renderer.worker.js', import.meta.url), {
            type: 'module'

        });

        this.worker.onerror = (error) => {
            console.error("❌ An error occurred in the renderer worker:", error.message);
            console.error("Full error object:", error);
        };

        const offscreen = this.canvas.transferControlToOffscreen();

        this.worker.postMessage({
            type: 'init',
            payload: {
                canvas: offscreen,
                badgeName: 'votes',
                width: window.innerWidth,
                height: window.innerHeight,
                wasm: {
                    url: '/src/assets/wasm/geometry_optimizer.js'
                }
            }
        }, [offscreen]);

        this.setupEventListeners();

        this.fetchBadgeDetails().then(badgeDetails => {
            this.uiManager = new UIManager(badgeDetails, this.switchBadge.bind(this));
            // this.uiManager.handleSwitch('votes');
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

    switchBadge(badgeName) {
        this.worker.postMessage({
            type: 'switchBadge',
            payload: { badgeName }
        });
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
        this.worker.postMessage({
            type: 'mouseMove',
            payload: {
                mouseX: (event.clientX / window.innerWidth) * 2 - 1,
                mouseY: -(event.clientY / window.innerHeight) * 2 + 1
            }
        });
    }
}