// Import required modules and dependencies from Three.js and custom libraries
import * as THREE from "../../libs/three/three.module.js";
import { GLTFLoader } from "../../libs/three/jsm/GLTFLoader.js";
import { RGBELoader } from "../../libs/three/jsm/RGBELoader.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { Stats } from "../../libs/stats.module.js";
import { VRButton } from "../../libs/VRButton.js";
import { TeleportMesh } from "../../libs/TeleportMesh.js";
import { Player } from "../../libs/Player.js";
import { LoadingBar } from "../../libs/LoadingBar.js";

// Main application class
class App {
    constructor() {
        // Create a container for the 3D scene and add it to the document body.
        const container = document.createElement("div");
        document.body.appendChild(container);

        // Set the path for loading assets.
        this.assetsPath = "../../assets/";

        // Create the camera and set its position.
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            3000
        );
        this.camera.position.set(0, 1.6, 0);

        // Create the scene.
        this.scene = new THREE.Scene();

        // Create ambient and directional lighting.
        // ...

        // Create the renderer and add it to the container.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // ...

        // Set up the environment (loading the HDR environment map).
        this.setEnvironment();

        // Set up other properties and event listeners.
        this.workingMatrix = new THREE.Matrix4();
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        // ...

        // Initialize the statistics display for performance monitoring.
        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        // Initialize the loading bar.
        this.loadingBar = new LoadingBar();

        // Load the 3D environment.
        this.loadEnvironment();

        // Flag to indicate if the loading is still in progress.
        this.loading = true;

        // Add a window resize event listener.
        window.addEventListener("resize", this.render.bind(this));
    }

    // Method to handle window resize events.
    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Method to set up the HDR environment map.
    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        // Load the HDR environment map texture.
        loader.load(
            "../../assets/hdr/venice_sunset_1k.hdr",
            (texture) => {
                const envMap =
                    pmremGenerator.fromEquirectangular(texture).texture;
                pmremGenerator.dispose();

                // Set the environment map for the scene to provide realistic lighting and reflections.
                self.scene.environment = envMap;
            },
            undefined,
            (err) => {
                console.error("An error occurred setting the environment");
            }
        );
    }

    // Method to load the 3D environment from a glTF file.
    loadEnvironment() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        // Load the glTF file.
        loader.load(
            "dungeon.glb",
            function (gltf) {
                const scale = 0.5;

                // Add the loaded 3D environment to the scene.
                self.scene.add(gltf.scene);

                // Traverse through the objects in the loaded scene (e.g., meshes).
                gltf.scene.traverse(function (child) {
                    if (child.isMesh) {
                        if (child.name === "Navmesh") {
                            // Hide the Navmesh from rendering and scaling it appropriately.
                            child.material.visible = false;
                            self.navmesh = child;
                            child.geometry.scale(scale, scale, scale);
                            child.scale.set(2, 2, 2);
                        } else {
                            // Set properties for other meshes like castShadow and receiveShadow.
                            child.castShadow = false;
                            child.receiveShadow = true;
                        }
                    }
                });

                // Scale the entire loaded scene.
                gltf.scene.scale.set(scale, scale, scale);

                // Initialize the game elements once the environment is loaded.
                self.initGame();
            },
            function (xhr) {
                // Function called while loading is in progress, update the loading bar.
                self.loadingBar.progress = xhr.loaded / xhr.total;
            },
            function (error) {
                console.log("An error happened");
            }
        );
    }

    // Method to initialize the game elements.
    initGame() {
        // Create the player object and add it to the scene.
        this.player = this.createPlayer();

        // Define teleportation locations.
        // ...

        // Set up XR (Virtual Reality) interactions and controllers.
        this.setupXR();

        // The loading is complete.
        this.loading = false;

        // Start rendering the scene.
        this.renderer.setAnimationLoop(this.render.bind(this));

        // Hide the loading bar once the game is initialized.
        this.loadingBar.visible = false;
    }

    // Method to create the player object.
    createPlayer() {
        // ...
        // Create and return the player object.
        // ...
    }

    // Method to handle rendering and updating the scene.
    render() {
        const dt = this.clock.getDelta();
        const self = this;

        // Update the position of the sun based on the camera position.
        this.sun.position.copy(this.dummyCam.position);
        this.sun.position.y += 10;
        this.sun.position.z += 10;

        // Update the statistics display for performance monitoring.
        this.stats.update();

        // Check if the VR mode is enabled.
        if (this.renderer.xr.isPresenting) {
            // Handle teleportation interactions and update player movement.
            // ...

            // Update the position and rotation of the player.
            this.player.update(dt);
        }

        // Render the 3D scene.
        this.renderer.render(this.scene, this.camera);
    }
}

// Export the App class to be used in other modules.
export { App };
