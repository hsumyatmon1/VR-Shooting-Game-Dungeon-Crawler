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

    // Initialize pathfinding by defining waypoints and creating a navigation zone.
    initPathfinding() {
        // Define a list of waypoints (positions) for pathfinding.
        this.waypoints = [
            new THREE.Vector3(8.689, 2.687, 0.349),
            new THREE.Vector3(0.552, 2.589, -2.122),
            new THREE.Vector3(-7.722, 2.63, 0.298),
            new THREE.Vector3(2.238, 2.728, 7.05),
            new THREE.Vector3(2.318, 2.699, 6.957),
            new THREE.Vector3(-1.837, 0.111, 1.782),
        ];

        // Create a Pathfinding instance.
        this.pathfinder = new Pathfinding();

        // Define a zone name for the navigation mesh.
        this.ZONE = "dungeon";

        // Set zone data for pathfinding based on the Navmesh geometry.
        this.pathfinder.setZoneData(
            this.ZONE,
            Pathfinding.createZone(this.navmesh.geometry)
        );
    }

    // Initialize the game environment after loading the Ghoul and setting up pathfinding.
    initGame() {
        // Create the player character.
        this.player = this.createPlayer();

        // Define teleport locations as 3D vectors.
        const locations = [
            new THREE.Vector3(-0.409, 0.086, 4.038),
            new THREE.Vector3(-0.846, 0.112, 5.777),
            new THREE.Vector3(5.22, 0.176, 2.677),
            new THREE.Vector3(1.49, 2.305, -1.599),
            new THREE.Vector3(7.565, 2.694, 0.008),
            new THREE.Vector3(-8.417, 2.676, 0.192),
            new THREE.Vector3(-6.644, 2.6, -4.114),
        ];

        const self = this;

        // Create teleportation points (TeleportMesh) at specified locations.
        this.teleports = [];
        locations.forEach((location) => {
            const teleport = new TeleportMesh();
            teleport.position.copy(location);
            self.scene.add(teleport);
            self.teleports.push(teleport);
        });

        // Set up XR (Extended Reality) for VR interaction.
        this.setupXR();

        // Set the loading flag to false, indicating that the environment is fully loaded.
        this.loading = false;

        // Start rendering the scene using the WebGLRenderer.
        this.renderer.setAnimationLoop(this.render.bind(this));

        // Hide the loading bar once everything is loaded.
        this.loadingBar.visible = false;
    }

    // Create a marker for intersection testing between the ray and 3D objects.
    createMarker(geometry, material) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    // Build XR controllers for VR interaction.
    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();

        // Create a line to represent the controller's ray.
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1),
        ]);
        const line = new THREE.Line(geometry);
        line.name = "ray";
        line.scale.z = 10;

        // Create a sphere marker for intersection testing.
        const geometry2 = new THREE.SphereGeometry(0.03, 8, 6);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const controllers = [];

        for (let i = 0; i <= 1; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.userData.index = i;
            controller.userData.selectPressed = false;
            controller.add(line.clone());
            controller.userData.marker = this.createMarker(geometry2, material);
            controllers.push(controller);
            this.dolly.add(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.dolly.add(grip);
        }

        return controllers;
    }

    // Set up XR for VR interaction and events.
    setupXR() {
        // Enable XR for the renderer.
        this.renderer.xr.enabled = true;

        const self = this;

        // Define event handlers for controller interaction.
        function onSelectStart() {
            this.userData.selectPressed = true;
            if (this.userData.teleport) {
                self.player.object.position.copy(
                    this.userData.teleport.position
                );
                self.teleports.forEach((teleport) => teleport.fadeOut(0.5));
            } else if (this.userData.interactable) {
                this.userData.interactable.play();
            } else if (this.marker.visible) {
                const pos = this.userData.marker.position;
                console.log(
                    `${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(
                        3
                    )}`
                );
            }
        }

        function onSelectEnd() {
            this.userData.selectPressed = false;
        }

        function onSqueezeStart() {
            this.userData.squeezePressed = true;
            self.teleports.forEach((teleport) => teleport.fadeIn(1));
        }

        function onSqueezeEnd() {
            this.userData.squeezePressed = false;
            self.teleports.forEach((teleport) => teleport.fadeOut(1));
        }

        // Create a button for entering VR mode.
        const btn = new VRButton(this.renderer);

        // Build XR controllers for both left and right hands.
        this.controllers = this.buildControllers();

        // Attach event listeners for controller interactions.
        this.controllers.forEach((controller) => {
            controller.addEventListener("selectstart", onSelectStart);
            controller.addEventListener("selectend", onSelectEnd);
            controller.addEventListener("squeezestart", onSqueezeStart);
            controller.addEventListener("squeezeend", onSqueezeEnd);
        });

        // Create a list of collision objects for intersection testing.
        this.collisionObjects = [this.navmesh];
        this.teleports.forEach((teleport) =>
            self.collisionObjects.push(teleport.children[0])
        );
        this.interactables.forEach((interactable) =>
            self.collisionObjects.push(interactable.mesh)
        );
    }

    // Function to intersect 3D objects with the controller's ray.
    intersectObjects(controller) {
        const line = controller.getObjectByName("ray");
        this.workingMatrix.identity().extractRotation(controller.matrixWorld);

        // Define the origin and direction of the ray.
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction
            .set(0, 0, -1)
            .applyMatrix4(this.workingMatrix);

        const intersects = this.raycaster.intersectObjects(
            this.collisionObjects
        );
        const marker = controller.userData.marker;
        marker.visible = false;

        controller.userData.teleport = undefined;
        controller.userData.interactable = undefined;

        if (intersects.length > 0) {
            const intersect = intersects[0];
            line.scale.z = intersect.distance;

            if (intersect.object === this.navmesh) {
                marker.scale.set(1, 1, 1);
                marker.position.copy(intersect.point);
                marker.visible = true;
            } else if (
                intersect.object.parent &&
                intersect.object.parent instanceof TeleportMesh
            ) {
                intersect.object.parent.selected = true;
                controller.userData.teleport = intersect.object.parent;
            } else {
                const tmp = this.interactables.filter(
                    (interactable) => interactable.mesh == intersect.object
                );

                if (tmp.length > 0) controller.userData.interactable = tmp[0];
            }
        }
    }

    // Create the player character with a target, camera, and dolly setup.
    createPlayer() {
        const target = new THREE.Object3D();
        target.position.set(-3, 0.25, 2);

        const options = {
            object: target,
            speed: 5,
            app: this,
            name: "player",
            npc: false,
        };

        // Create a player character using the Player class.
        const player = new Player(options);

        // Create a dolly to control the camera and attach it to the player.
        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, -0.25, 0);
        this.dolly.add(this.camera);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        target.add(this.dolly);

        this.dolly.rotation.y = Math.PI;

        return player;
    }

    // Main rendering function for the scene.
    render() {
        const dt = this.clock.getDelta();
        const self = this;

        // Update the position of the sun based on the camera's position.
        this.sun.position.copy(this.dummyCam.position);
        this.sun.position.y += 10;
        this.sun.position.z += 10;

        this.stats.update();

        // Perform updates only when in XR mode.
        if (this.renderer.xr.isPresenting) {
            // Update teleportation points.
            this.teleports.forEach((teleport) => {
                teleport.selected = false;
                teleport.update();
            });

            // Intersect objects with the controller's ray.
            this.controllers.forEach((controller) => {
                self.intersectObjects(controller);
            });

            // Update interactable objects.
            this.interactables.forEach((interactable) =>
                interactable.update(dt)
            );

            // Update the player character.
            this.player.update(dt);

            // Update Ghoul characters.
            this.ghouls.forEach((ghoul) => {
                ghoul.update(dt);
            });
        }

        // Render the scene using the renderer.
        this.renderer.render(this.scene, this.camera);
    }

    // In this part of the code, we initialize pathfinding, set up XR (VR) for interaction,
    // create the player character, and define the main rendering function for the scene.
    // This section of code handles the core functionality of the application, including player movement,
    // interaction, and rendering.
}

// Export the App class for use in other modules.
export { App };
