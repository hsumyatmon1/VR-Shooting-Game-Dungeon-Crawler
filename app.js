// Import necessary libraries and modules from external files
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

// Define the class named "App"
class App {
    constructor() {
        // Create a container (HTML div element) to hold the 3D scene
        const container = document.createElement("div");
        document.body.appendChild(container);

        // Set the path to the assests folder
        this.assetsPath = "../../assets/";

        // Create a camera with a perspective projection
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            3000
        );

        // Set the initial position of the camera
        this.camera.position.set(0, 1.6, 0);

        // Create a 3D scene
        this.scene = new THREE.Scene();

        // Add ambient light to the scene
        const ambient = new THREE.HemisphereLight(0x000000, 0x111111);
        this.scene.add(ambient);

        // Create a directional light (sun) with shadows
        this.sun = new THREE.DirectionalLight(0x111111, 0.5);
        this.sun.castShadow = true;

        // Configure the shadow settings for the light
        // TODO: Need to fix the shadow going everywhere
        const lightSize = 5;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 17;
        this.sun.shadow.camera.left = this.sun.shadow.camera.bottom =
            -lightSize;
        this.sun.shadow.camera.right = this.sun.shadow.camera.top = lightSize;

        //this.sun.shadow.bias = 0.0039;
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;

        // Set the position of the sun
        this.sun.position.set(0, 10, 10);
        this.scene.add(this.sun);

        // Portal and Teleport
        this.debug = { showPath: false, teleport: true };

        // Create a WebGL renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        // Set the renderer's pixel ratio to match the device's pixel ratio
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Set the renderer's size to match the window's size
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Enable shadows in the renderer
        this.renderer.shadowMap.enabled = true;

        // Set the output encoding to sRGB for color correctness
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Attach the renderer's canvas element to the container
        container.appendChild(this.renderer.domElement);

        // Initialize a working matrix and clock for time-based operations
        this.workingMatrix = new THREE.Matrix4();
        this.clock = new THREE.Clock();

        // Initialize a raycaster to perfrom raycasting for intersection tests
        this.raycaster = new THREE.Raycaster();

        // Create a Stats object for performance monitoring
        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        // Create a loading bar to indicate progress during asset loading
        this.loadingBar = new LoadingBar();

        // Load the environment (HDR environment map)
        this.loadEnvironment();

        // Set a flag to indicate that loading is in progress
        this.loading = true;

        // Add a window resize event listener to adjust the rendering size on window resize
        window.addEventListener("resize", this.render.bind(this));
    }

    // Methods

    // Method to resize the camera and renderer based on window size

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Method to set up the environment with an HDR environment map

    setEnvironment() {
        // Create a loader for loading the HDR environment map
        const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const self = this;

        // Load the HDR environment map
        loader.load(
            "../../assets/hdr/venice_sunset_1k.hdr",
            (texture) => {
                // Generate an environment map from the loaded texture
                const envMap =
                    pmremGenerator.fromEquirectangular(texture).texture;
                pmremGenerator.dispose();

                // Set the environment for the scene
                self.scene.environment = envMap;
            },
            undefined,
            (err) => {
                console.error("An error occurred setting the environment");
            }
        );
    }

    // Method to load the 3D environment model (glTF format)

    // TODO: If have time can add more teleporting places here
    loadEnvironment() {
        // Create a loader for loading glTF files
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        this.interactables = [];

        // Load a glTF resource
        loader.load(
            // resource URL
            "dungeon.glb",
            // called when the resource is loaded
            function (gltf) {
                // Define a scale factor for the loaded model
                // const scale = 0.5;

                // Add the loaded scene to the main scene
                self.scene.add(gltf.scene);

                // Tranverse the loaded scent to perform operations on its children
                gltf.scene.traverse(function (child) {
                    if (child.isMesh) {
                        // Identify and process the "Navmesh" in the scene
                        if (child.name == "Navmesh") {
                            child.material.visible = false;
                            self.navmesh = child;
                            child.geometry.scale(0.5, 0.5, 0.5);
                            self.navmesh.scale.set(2, 2, 2);
                        } else {
                            // To find the gun
                            if (child.name == "SD_Prop_Chest_Skull_Lid_01") {
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
                                // Teleport to another room
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

                // Define a scale factor for the loaded model
                const scale = 0.5;

                // Scale the entire loaded scene
                gltf.scene.scale.set(scale, scale, scale);

                // Initialize the portal paths
                self.initPathfinding();

                // Add the monsters
                self.loadMonster();
            },
            // called while loading is progressing
            function (xhr) {
                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.5;
            },
            // called when loading has errors
            function (error) {
                console.error(error.message);
            }
        );
    }

    loadMonster() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        // Add animations to the monsters
        const anims = [
            { start: 81, end: 161, name: "idle", loop: true },
            { start: 250, end: 290, name: "block", loop: false },
            { start: 300, end: 320, name: "gethit", loop: false },
            { start: 340, end: 375, name: "die", loop: false },
            { start: 380, end: 430, name: "attack", loop: false },
            { start: 470, end: 500, name: "walk", loop: true },
            { start: 540, end: 560, name: "run", loop: true },
        ];

        // Load a GLTF resource
        loader.load(
            // resource URL
            `ghoul.glb`,
            // called when the resource is loaded
            function (gltf) {
                const gltfs = [gltf];
                for (let i = 0; i < 3; i++) gltfs.push(self.cloneGLTF(gltf));

                self.ghouls = [];

                gltfs.forEach(function (gltf) {
                    const object = gltf.scene.children[0];

                    object.traverse(function (child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                        }
                    });

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

                    const ghoul = new Player(options);

                    const scale = 0.01;
                    ghoul.object.scale.set(scale, scale, scale);

                    ghoul.object.position.copy(self.randomWaypoint);
                    ghoul.newPath(self.randomWaypoint);

                    self.ghouls.push(ghoul);
                });

                // Call the method to initiate the game
                self.initGame();
            },
            // called while loading is progressing
            function (xhr) {
                self.loadingBar.progress = (xhr.loaded / xhr.total) * 0.5 + 0.5;
            },
            // called when loading has errors
            function (error) {
                console.error(error.message);
            }
        );
    }

    cloneGLTF(gltf) {
        const clone = {
            animations: gltf.animations,
            scene: gltf.scene.clone(true),
        };

        const skinnedMeshes = {};

        gltf.scene.traverse((node) => {
            if (node.isSkinnedMesh) {
                skinnedMeshes[node.name] = node;
            }
        });

        const cloneBones = {};
        const cloneSkinnedMeshes = {};

        clone.scene.traverse((node) => {
            if (node.isBone) {
                cloneBones[node.name] = node;
            }
            if (node.isSkinnedMesh) {
                cloneSkinnedMeshes[node.name] = node;
            }
        });

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

    get randomWaypoint() {
        const index = Math.floor(Math.random() * this.waypoints.length);
        return this.waypoints[index];
    }

    initPathfinding() {
        this.waypoints = [
            new THREE.Vector3(8.689, 2.687, 0.349),
            new THREE.Vector3(0.552, 2.589, -2.122),
            new THREE.Vector3(-7.722, 2.63, 0.298),
            new THREE.Vector3(2.238, 2.728, 7.05),
            new THREE.Vector3(2.318, 2.699, 6.957),
            new THREE.Vector3(-1.837, 0.111, 1.782),
        ];
        this.pathfinder = new Pathfinding();
        this.ZONE = "dungeon";
        this.pathfinder.setZoneData(
            this.ZONE,
            Pathfinding.createZone(this.navmesh.geometry)
        );
    }

    initGame() {
        this.player = this.createPlayer();

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

        this.teleports = [];
        locations.forEach((location) => {
            const teleport = new TeleportMesh();
            teleport.position.copy(location);
            self.scene.add(teleport);
            self.teleports.push(teleport);
        });

        this.setupXR();

        this.loading = false;

        this.renderer.setAnimationLoop(this.render.bind(this));

        this.loadingBar.visible = false;
    }

    createMarker(geometry, material) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();

        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1),
        ]);

        const line = new THREE.Line(geometry);
        line.name = "ray";
        line.scale.z = 10;

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

    setupXR() {
        this.renderer.xr.enabled = true;

        const self = this;

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

        const btn = new VRButton(this.renderer);

        this.controllers = this.buildControllers();

        this.controllers.forEach((controller) => {
            controller.addEventListener("selectstart", onSelectStart);
            controller.addEventListener("selectend", onSelectEnd);
            controller.addEventListener("squeezestart", onSqueezeStart);
            controller.addEventListener("squeezeend", onSqueezeEnd);
        });

        this.collisionObjects = [this.navmesh];
        this.teleports.forEach((teleport) =>
            self.collisionObjects.push(teleport.children[0])
        );
        this.interactables.forEach((interactable) =>
            self.collisionObjects.push(interactable.mesh)
        );
    }

    intersectObjects(controller) {
        const line = controller.getObjectByName("ray");
        this.workingMatrix.identity().extractRotation(controller.matrixWorld);

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

        const player = new Player(options);

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, -0.25, 0);
        this.dolly.add(this.camera);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        target.add(this.dolly);

        this.dolly.rotation.y = Math.PI;

        return player;
    }

    // Main rendering method to update the scene and render it to the canvas

    render() {
        // Get the time difference (delta time) since the last frame
        const dt = this.clock.getDelta();
        const self = this;

        // Update the position of the sun to follow the camera (for lighting purposes)
        this.sun.position.copy(this.dummyCam.position);
        this.sun.position.y += 10;
        this.sun.position.z += 10;

        // Update the performance stats
        this.stats.update();

        // Check if the VR is working properly

        if (this.renderer.xr.isPresenting) {
            // Iterate through all teleportation points to update their states
            this.teleports.forEach((teleport) => {
                teleport.selected = false;
                teleport.update();
            });

            // Iterate through all controllers to perform intersection tests
            this.controllers.forEach((controller) => {
                self.intersectObjects(controller);
            });

            this.interactables.forEach((interactable) =>
                interactable.update(dt)
            );

            // Update the player character's movement
            this.player.update(dt);

            this.ghouls.forEach((ghoul) => {
                ghoul.update(dt);
            });
        }

        // Render the scene with the camera using the WebGL renderer
        this.renderer.render(this.scene, this.camera);
    }
}

// Export the App class to make it accessible to other parts of the application
export { App };
