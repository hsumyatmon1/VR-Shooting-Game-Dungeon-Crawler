// Import necessary libraries and modules from external files
import * as THREE from "../../libs/three/three.module.js";
import { GLTFLoader } from "../../libs/three/jsm/GLTFLoader.js";
import { RGBELoader } from "../../libs/three/jsm/RGBELoader.js";
import { XRControllerModelFactory } from "../../libs/three/jsm/XRControllerModelFactory.js";
import { Stats } from "../../libs/stats.module.js";
import { VRButton } from "../../libs/VRButton.js";
import { TeleportMesh } from "../../libs/TeleportMesh.js";
import { Player } from "../../libs/Player.js";
import { LoadingBar } from "../../libs/LoadingBar.js";

// Define a class named "App"
class App {
    constructor() {
        // Create a container (HTML div element) to hold the 3D scene
        const container = document.createElement("div");
        document.body.appendChild(container);

        // Set the path to the assets folder
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
        const ambient = new THREE.HemisphereLight(0x555555, 0x999999);
        this.scene.add(ambient);

        // Create a directional light (sun) with shadows
        this.sun = new THREE.DirectionalLight(0xaaaaff, 2.5);
        this.sun.castShadow = true;
        // Configure the shadow settings for the light
        const lightSize = 5;
        this.sun.shadow.camera.near = 0.1;
        this.sun.shadow.camera.far = 17;
        this.sun.shadow.camera.left = this.sun.shadow.camera.bottom =
            -lightSize;
        this.sun.shadow.camera.right = this.sun.shadow.camera.top = lightSize;
        this.sun.shadow.mapSize.width = 1024;
        this.sun.shadow.mapSize.height = 1024;
        // Set the position of the sun
        this.sun.position.set(0, 10, 10);
        this.scene.add(this.sun);

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
        // Initialize a raycaster to perform raycasting for intersection tests
        this.raycaster = new THREE.Raycaster();

        // Create a Stats object for performance monitoring (optional)
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

        // Load the HDR environment map from the specified file
        loader.load(
            "../../assets/hdr/venice_sunset_1k.hdr",
            (texture) => {
                // Generate an environment map from the loaded texture
                const envMap =
                    pmremGenerator.fromEquirectangular(texture).texture;
                pmremGenerator.dispose();

                // Set the environment map for the scene
                self.scene.environment = envMap;
            },
            undefined,
            (err) => {
                console.error("An error occurred setting the environment");
            }
        );
    }

    // Method to load the 3D environment model (glTF format)
    loadEnvironment() {
        // Create a loader for loading glTF files
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const self = this;

        // Load the glTF resource from the specified file
        loader.load(
            "dungeon.glb",
            function (gltf) {
                // Define a scale factor for the loaded model
                const scale = 0.5;

                // Add the loaded scene to the main scene
                self.scene.add(gltf.scene);

                // Traverse the loaded scene to perform operations on its children
                gltf.scene.traverse(function (child) {
                    if (child.isMesh) {
                        // Identify and process the "Navmesh" in the scene
                        if (child.name === "Navmesh") {
                            child.material.visible = false;
                            self.navmesh = child;
                            child.geometry.scale(scale, scale, scale);
                            child.scale.set(2, 2, 2);
                        } else {
                            // Configure other meshes in the scene for shadow casting and receiving
                            child.castShadow = false;
                            child.receiveShadow = true;
                        }
                    }
                });

                // Scale the entire loaded scene
                gltf.scene.scale.set(scale, scale, scale);

                // Call the method to initialize the game
                self.initGame();
            },
            // Called while loading is progressing (for displaying loading progress)
            function (xhr) {
                self.loadingBar.progress = xhr.loaded / xhr.total;
            },
            // Called when loading has errors
            function (error) {
                console.log("An error happened");
            }
        );
    }

    // Method to initialize the game after the environment is loaded
    initGame() {
        // Create the player character and initialize teleportation points
        this.player = this.createPlayer();

        const locations = [
            new THREE.Vector3(-0.409, 0.086, 4.038),
            new THREE.Vector3(-0.846, 0.112, 5.777),
            // Add more teleportation locations as needed
            // ...
        ];

        const self = this;

        // Create teleportation points and add them to the scene
        this.teleports = [];
        locations.forEach((location) => {
            const teleport = new TeleportMesh();
            teleport.position.copy(location);
            self.scene.add(teleport);
            self.teleports.push(teleport);
        });

        // Add additional waypoints for navigation purposes (optional)
        const waypoints = [
            new THREE.Vector3(-3.55, 0.263, 4.104),
            new THREE.Vector3(2.559, 0.093, 3.052),
            // Add more waypoints as needed
            // ...
        ];

        // Set up the XR (WebXR) system for VR interaction
        this.setupXR();

        // Set the loading flag to false as the loading is complete
        this.loading = false;

        // Start rendering the scene using the renderer's animation loop
        this.renderer.setAnimationLoop(this.render.bind(this));

        // Hide the loading bar as loading is complete
        this.loadingBar.visible = false;
    }

    // Method to create a marker for intersection visualization
    createMarker(geometry, material) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
    }

    // Method to build VR controllers and their visual representations
    buildControllers() {
        // Create a factory for XR controller models
        const controllerModelFactory = new XRControllerModelFactory();

        // Create a line geometry for ray visualization
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1),
        ]);

        // Create a line for ray visualization
        const line = new THREE.Line(geometry);
        line.name = "ray";
        line.scale.z = 10;

        // Create a sphere geometry and material for controller markers
        const geometry2 = new THREE.SphereGeometry(0.03, 8, 6);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // Create arrays to store the controllers and grips
        const controllers = [];

        // Loop to create two controllers (for left and right hands)
        for (let i = 0; i <= 1; i++) {
            // Get the XR controller object for the current hand
            const controller = this.renderer.xr.getController(i);
            controller.userData.index = i;
            controller.userData.selectPressed = false;
            // Add the ray visualization to the controller
            controller.add(line.clone());
            // Create a marker for intersection visualization and attach it to the controller
            controller.userData.marker = this.createMarker(geometry2, material);
            controllers.push(controller);
            // Add the controller and its grip to the dolly (main VR group)
            this.dolly.add(controller);

            // Get the grip (visual representation) for the controller
            const grip = this.renderer.xr.getControllerGrip(i);
            // Add the controller model to the grip
            grip.add(controllerModelFactory.createControllerModel(grip));
            // Add the grip to the dolly
            this.dolly.add(grip);
        }

        return controllers;
    }

    // Method to set up the WebXR system for VR interaction
    setupXR() {
        // Enable the WebXR renderer
        this.renderer.xr.enabled = true;

        // Store a reference to "this" for use inside event listeners
        const self = this;

        // Event listener function for the controller's select (trigger) button press
        function onSelectStart() {
            this.userData.selectPressed = true;
            // Check if the controller is pointing at a teleportation point
            if (this.userData.teleport) {
                // Move the player character to the teleportation point
                self.player.object.position.copy(
                    this.userData.teleport.position
                );
                // Hide all teleportation points
                self.teleports.forEach((teleport) => teleport.fadeOut(0.5));
            } else if (this.userData.marker.visible) {
                // Get the position of the marker and log it to the console
                const pos = this.userData.marker.position;
                console.log(
                    `${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(
                        3
                    )}`
                );
            }
        }

        // Event listener function for the controller's select (trigger) button release
        function onSelectEnd() {
            this.userData.selectPressed = false;
        }

        // Event listener function for the controller's squeeze (grip) button press
        function onSqueezeStart() {
            this.userData.squeezePressed = true;
            // Fade in all teleportation points when squeezing the controller
            self.teleports.forEach((teleport) => teleport.fadeIn(1));
        }

        // Event listener function for the controller's squeeze (grip) button release
        function onSqueezeEnd() {
            this.userData.squeezePressed = false;
            // Fade out all teleportation points when releasing the squeeze
            self.teleports.forEach((teleport) => teleport.fadeOut(1));
        }

        // Create a VR button for entering VR mode
        const btn = new VRButton(this.renderer);

        // Build VR controllers and store references to them
        this.controllers = this.buildControllers();

        // Attach event listeners to the controllers for interaction
        this.controllers.forEach((controller) => {
            controller.addEventListener("selectstart", onSelectStart);
            controller.addEventListener("selectend", onSelectEnd);
            controller.addEventListener("squeezestart", onSqueezeStart);
            controller.addEventListener("squeezeend", onSqueezeEnd);
        });

        // Create an array to store objects for collision detection (optional)
        this.collisionObjects = [this.navmesh];
        this.teleports.forEach((teleport) =>
            self.collisionObjects.push(teleport.children[0])
        );
    }

    // Method to perform raycasting and intersection tests with objects
    intersectObjects(controller) {
        // Get the ray visualization line from the controller
        const line = controller.getObjectByName("ray");
        // Reset the working matrix to identity and extract the controller's rotation
        this.workingMatrix.identity().extractRotation(controller.matrixWorld);

        // Set the ray origin to the controller's position
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        // Set the ray direction along the controller's negative z-axis (forward)
        this.raycaster.ray.direction
            .set(0, 0, -1)
            .applyMatrix4(this.workingMatrix);

        // Perform the raycasting intersection test with the collision objects
        const intersects = this.raycaster.intersectObjects(
            this.collisionObjects
        );
        // Get the marker object from the controller's user data
        const marker = controller.userData.marker;
        marker.visible = false;

        // Clear the "teleport" property in the controller's user data
        controller.userData.teleport = undefined;

        // If the ray intersects with an object in the collision objects array
        if (intersects.length > 0) {
            const intersect = intersects[0];
            // Set the line scale to the distance of the intersection point
            line.scale.z = intersect.distance;

            // Check if the intersected object is the "Navmesh" in the scene
            if (intersect.object === this.navmesh) {
                // Set the marker scale and position to the intersection point
                marker.scale.set(1, 1, 1);
                marker.position.copy(intersect.point);
                marker.visible = true;
            } else if (
                intersect.object.parent &&
                intersect.object.parent instanceof TeleportMesh
            ) {
                // If the intersected object is a teleportation point
                intersect.object.parent.selected = true;
                controller.userData.teleport = intersect.object.parent;
            }
        }
    }

    // Method to create the player character for navigation (optional)
    createPlayer() {
        // Create an object (target) to control the player's position and orientation
        const target = new THREE.Object3D();
        target.position.set(-3, 0.25, 2);

        // Define options for the player character
        const options = {
            object: target,
            speed: 5, // Speed of the player character's movement
            app: this,
            name: "player",
            npc: false,
        };

        // Create a player character with the specified options
        const player = new Player(options);

        // Create a group (dolly) to hold the camera and controllers for VR movement
        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, -0.25, 0);
        this.dolly.add(this.camera);

        // Create a dummy camera for rotation control
        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        // Add the dolly to the target, and set the initial rotation
        target.add(this.dolly);
        this.dolly.rotation.y = Math.PI;

        // Return the player character
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

        // Update the performance statistics (optional)
        this.stats.update();

        // Check if the renderer is in VR mode (presenting)
        if (this.renderer.xr.isPresenting) {
            // Iterate through all teleportation points to update their state
            this.teleports.forEach((teleport) => {
                teleport.selected = false;
                teleport.update();
            });

            // Iterate through all controllers to perform intersection tests
            this.controllers.forEach((controller) => {
                self.intersectObjects(controller);
            });

            // Update the player character's movement (optional)
            this.player.update(dt);
        }

        // Render the scene with the camera using the WebGL renderer
        this.renderer.render(this.scene, this.camera);
    }
}

// Export the App class to make it accessible to other parts of the application
export { App };
