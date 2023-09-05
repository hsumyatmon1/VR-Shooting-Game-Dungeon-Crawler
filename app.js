// Importing necessary modules from external libraries.
import * as THREE from "../../libs/three/three.module.js";
import { GLTFLoader } from "../../libs/three/jsm/GLTFLoader.js";
import { RGBELoader } from "../../libs/three/jsm/RGBELoader.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { Pathfinding } from "../../libs/three/jsm/three-pathfinding.module.js";
import { Stats } from "../../libs/stats.module.js";
import { VRButton } from "../../libs/VRButton.js";
import { TeleportMesh } from "../../libs/TeleportMesh.js";
import { Interactable } from "../../libs/Interactable.js";
import { Player } from "../../libs/Player.js";
import { LoadingBar } from "../../libs/LoadingBar.js";

// Define a JavaScript class named "App".
class App {
    // Constructor function for the "App" class.
    constructor() {
        // Create a container element and append it to the HTML body.
        const container = document.createElement("div");
        document.body.appendChild(container);

        // Define a path to the assets directory.
        this.assetsPath = "../../assets/";

        // Create a 3D perspective camera with specific parameters.
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            3000
        );
        this.camera.position.set(0, 1.6, 0);

        // Create a 3D scene.
        this.scene = new THREE.Scene();

        // Create ambient light and add it to the scene.
        const ambient = new THREE.HemisphereLight(0x555555, 0x999999);
        this.scene.add(ambient);

        // Create a directional light (sun) with specific properties and add it to the scene.
        this.sun = new THREE.DirectionalLight(0xaaaaff, 2.5);
        this.sun.castShadow = true;
        // Set light parameters such as shadow properties and position.
        const lightSize = 5;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 17;
        this.sun.shadow.camera.left = this.sun.shadow.camera.bottom =
            -lightSize;
        this.sun.shadow.camera.right = this.sun.shadow.camera.top = lightSize;
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;
        this.sun.position.set(0, 10, 10);
        this.scene.add(this.sun);

        // Debug settings.
        this.debug = { showPath: false, teleport: true };

        // Create a WebGLRenderer for rendering 3D content.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
        this.setEnvironment();

        // Create a Matrix4 for working with transformations.
        this.workingMatrix = new THREE.Matrix4();

        // Create a clock for measuring time.
        this.clock = new THREE.Clock();

        // Create and add statistics (FPS counter) to the container.
        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        // Create a loading bar for tracking asset loading progress.
        this.loadingBar = new LoadingBar();

        // Load the 3D environment.
        this.loadEnvironment();

        // Create a raycaster for intersection testing.
        this.raycaster = new THREE.Raycaster();

        // Initialize loading flag.
        this.loading = true;

        // Add a window resize event listener to handle viewport changes.
        window.addEventListener("resize", this.render.bind(this));

        // This end as the beginning of the JavaScript code that sets up a 3D environment using
        // the Three.js library.The code imports various modules, creates a 3D scene,
        // sets up lighting, and prepares for rendering in a web - based VR environment.
    }

    // A function to resize the renderer when the window size changes.
    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // A function to set the 3D environment's background using an HDR image.
    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        // Load the HDR environment map and set it as the scene's environment.
        loader.load(
            "../../assets/hdr/venice_sunset_1k.hdr",
            (texture) => {
                const envMap =
                    pmremGenerator.fromEquirectangular(texture).texture;
                pmremGenerator.dispose();

                self.scene.environment = envMap;
            },
            undefined,
            (err) => {
                console.error("An error occurred setting the environment");
            }
        );
    }

    // Load the 3D environment (e.g., the dungeon) from a GLTF model.
    loadEnvironment() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        this.interactables = [];

        // Load the GLTF resource representing the environment.
        loader.load(
            "dungeon.glb",
            function (gltf) {
                self.scene.add(gltf.scene);

                // Traverse the loaded 3D scene and configure its components.
                gltf.scene.traverse(function (child) {
                    if (child.isMesh) {
                        if (child.name == "Navmesh") {
                            // Hide the Navmesh by making it invisible.
                            child.material.visible = false;
                            self.navmesh = child;
                            // Scale and position the Navmesh.
                            child.geometry.scale(0.5, 0.5, 0.5);
                            self.navmesh.scale.set(2, 2, 2);
                        } else {
                            if (child.name == "SD_Prop_Chest_Skull_Lid_01") {
                                // Create an Interactable object for a chest lid.
                                self.interactables.push(
                                    new Interactable(child, {
                                        mode: "tweens",
                                        tweens: [
                                            {
                                                target: child.quaternion,
                                                channel: "x",
                                                start: 0,
                                                end: -0.7,
                                                duration: 1,
                                            },
                                        ],
                                    })
                                );
                            } else if (child.name == "Door_1") {
                                // Create an Interactable object for a door.
                                self.interactables.push(
                                    new Interactable(child, {
                                        mode: "tweens",
                                        tweens: [
                                            {
                                                target: child.quaternion,
                                                channel: "z",
                                                start: 0,
                                                end: 0.6,
                                                duration: 1,
                                            },
                                        ],
                                    })
                                );
                            }
                            child.castShadow = false;
                            child.receiveShadow = true;
                        }
                    }
                });

                const scale = 0.5;
                gltf.scene.scale.set(scale, scale, scale);

                // Initialize pathfinding and load the Ghoul character.
                self.initPathfinding();
                self.loadGhoul();
            },
            function (xhr) {
                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.5;
            },
            function (error) {
                console.error(error.message);
            }
        );
    }

    // In this part of the code, we handle resizing the viewport,
    // setting up the 3D environment's background, and loading the dungeon environment.
    // We also create interactable objects like chest lids and doors within the environment.

    // Load the Ghoul character from a GLTF model.
    loadGhoul() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        // Define animations for the Ghoul character.
        const anims = [
            { start: 81, end: 161, name: "idle", loop: true },
            { start: 250, end: 290, name: "block", loop: false },
            { start: 300, end: 320, name: "gethit", loop: false },
            { start: 340, end: 375, name: "die", loop: false },
            { start: 380, end: 430, name: "attack", loop: false },
            { start: 470, end: 500, name: "walk", loop: true },
            { start: 540, end: 560, name: "run", loop: true },
        ];

        // Load the Ghoul character GLTF resource.
        loader.load(
            `ghoul.glb`,
            function (gltf) {
                const gltfs = [gltf];
                for (let i = 0; i < 3; i++) gltfs.push(self.cloneGLTF(gltf));

                self.ghouls = [];

                gltfs.forEach(function (gltf) {
                    const object = gltf.scene.children[0];

                    // Traverse the character object to set it to cast shadows.
                    object.traverse(function (child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                        }
                    });

                    // Configure options for creating a Ghoul character.
                    const options = {
                        object: object,
                        speed: 0.8,
                        assetsPath: self.assetsPath,
                        loader: loader,
                        anims: anims,
                        clip: gltf.animations[0],
                        app: self,
                        name: "ghoul",
                        npc: true,
                    };

                    // Create a Ghoul character using the Player class.
                    const ghoul = new Player(options);

                    // Set the scale for the Ghoul character.
                    const scale = 0.01;
                    ghoul.object.scale.set(scale, scale, scale);

                    // Position the Ghoul character at a random waypoint.
                    ghoul.object.position.copy(self.randomWaypoint);
                    ghoul.newPath(self.randomWaypoint);

                    // Add the Ghoul character to the list of Ghouls in the scene.
                    self.ghouls.push(ghoul);
                });

                // Initialize the game environment after loading the Ghoul.
                self.initGame();
            },
            function (xhr) {
                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.5 + 0.5;
            },
            function (error) {
                console.error(error.message);
            }
        );
    }

    // Function to clone a GLTF model to ensure multiple instances share animations correctly.
    cloneGLTF(gltf) {
        const clone = {
            animations: gltf.animations,
            scene: gltf.scene.clone(true),
        };

        const skinnedMeshes = {};

        // Traverse the cloned scene to find skinned meshes.
        gltf.scene.traverse((node) => {
            if (node.isSkinnedMesh) {
                skinnedMeshes[node.name] = node;
            }
        });

        const cloneBones = {};
        const cloneSkinnedMeshes = {};

        // Traverse the original scene to find bones and skinned meshes.
        clone.scene.traverse((node) => {
            if (node.isBone) {
                cloneBones[node.name] = node;
            }
            if (node.isSkinnedMesh) {
                cloneSkinnedMeshes[node.name] = node;
            }
        });

        // Bind the cloned skinned meshes with the cloned bones.
        for (let name in skinnedMeshes) {
            const skinnedMesh = skinnedMeshes[name];
            const skeleton = skinnedMesh.skeleton;
            const cloneSkinnedMesh = cloneSkinnedMeshes[name];
            const orderedCloneBones = [];
            for (let i = 0; i < skeleton.bones.length; ++i) {
                const cloneBone = cloneBones[skeleton.bones[i].name];
                orderedCloneBones.push(cloneBone);
            }
            cloneSkinnedMesh.bind(
                new THREE.Skeleton(orderedCloneBones, skeleton.boneInverses),
                cloneSkinnedMesh.matrixWorld
            );
        }

        return clone;
    }

    // Function to get a random waypoint from a predefined list.
    get randomWaypoint() {
        const index = Math.floor(Math.random() * this.waypoints.length);
        return this.waypoints[index];
    }

    // In this part of the code, we load the Ghoul character, configure its animations,
    // and set up cloning for the character to allow multiple instances to share animations correctly.
    // We also handle random waypoint generation for the character's initial positions.
}
