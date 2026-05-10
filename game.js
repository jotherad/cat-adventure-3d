class Game {
    constructor() {
        // Ensure THREE is loaded
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded!');
            return;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        this.scene.fog = new THREE.Fog(0x87ceeb, 100, 1000);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.clock = new THREE.Clock();
        this.keys = {};
        this.cat = null;
        this.catVelocity = new THREE.Vector3();
        this.isJumping = false;
        this.solids = [];
        this.speedMultiplier = 1;
        this.jumpMultiplier = 1;
        this.orb = null;
        this.bowl = null;
        this.food = null;
        this.isNearBowl = false;
        this.bubbleState = 0; // 0: hidden, 1: Food?, 2: Press E
        this.isEating = false;
        this.catScale = 1;
        this.houseSummoned = false;
        this.raycaster = new THREE.Raycaster();
        this.orangeCat = null;
        this.orangeCatLegs = [];
        this.isOrangeCatFollowing = false;
        this.pinkOrb = null;
        this.pinkOrbSummoned = false;
        this.isCutscene = false;
        this.audioCtx = null;
        
        // Joystick State
        this.joystickData = { x: 0, y: 0, active: false };

        try {
            this.init();
        } catch (error) {
            console.error('Initialization failed:', error);
            document.getElementById('loading-screen').classList.add('hidden');
        }
    }

    init() {
        this.setupLights();
        this.createEnvironment();
        this.createCastle();
        this.createCat();
        this.setupControls();
        this.setupTouchControls();
        this.animate();

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetPosition();
        });

        window.addEventListener('resize', () => this.onWindowResize());
        
        // Hide loading screen quickly
        setTimeout(() => {
            const loader = document.getElementById('loading-screen');
            if (loader) loader.classList.add('hidden');
        }, 500);
    }

    setupTouchControls() {
        const base = document.getElementById('joystick-base');
        const stick = document.getElementById('joystick-stick');
        const jumpBtn = document.getElementById('jump-btn');
        const interactBtn = document.getElementById('interact-btn');

        const handleMove = (clientX, clientY) => {
            if (!this.joystickData.active) return;
            const rect = base.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let deltaX = clientX - centerX;
            let deltaY = clientY - centerY;
            
            const distance = Math.min(60, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
            const angle = Math.atan2(deltaY, deltaX);
            
            deltaX = Math.cos(angle) * distance;
            deltaY = Math.sin(angle) * distance;
            
            stick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
            
            this.joystickData.x = deltaX / 60;
            this.joystickData.y = deltaY / 60;
        };

        // Touch Events
        base.addEventListener('touchstart', (e) => {
            this.joystickData.active = true;
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        });
        window.addEventListener('touchmove', (e) => {
            if (this.joystickData.active) handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        // Mouse Events for Joystick
        base.addEventListener('mousedown', (e) => {
            this.joystickData.active = true;
            handleMove(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => {
            if (this.joystickData.active) handleMove(e.clientX, e.clientY);
        });
        
        const endMove = () => {
            this.joystickData.active = false;
            this.joystickData.x = 0;
            this.joystickData.y = 0;
            stick.style.transform = 'translate(-50%, -50%)';
        };
        window.addEventListener('touchend', endMove);
        window.addEventListener('mouseup', endMove);

        // Action Buttons (Touch + Mouse)
        const setupBtn = (btn, key) => {
            const start = (e) => {
                e.preventDefault();
                this.keys[key] = true;
            };
            const end = () => {
                this.keys[key] = false;
            };
            btn.addEventListener('touchstart', start);
            btn.addEventListener('touchend', end);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
            btn.addEventListener('mouseleave', end);
        };

        setupBtn(jumpBtn, 'Space');
        setupBtn(interactBtn, 'KeyE');
    }

    createCastle() {
        const castleGroup = new THREE.Group();
        const castlePos = { x: 0, y: 0, z: 200 }; // Much closer now
        
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.8 });
        const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x616161 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

        // Main Walls
        const wallSize = 60;
        const wallHeight = 25;
        const wallThickness = 4;

        const wallGeom = new THREE.BoxGeometry(wallSize, wallHeight, wallThickness);
        
        // Front Wall (Now Solid)
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(wallSize, wallHeight, wallThickness), stoneMat);
        frontWall.position.set(0, wallHeight / 2, 0);
        castleGroup.add(frontWall);
        this.solids.push(frontWall);

        // Back Wall
        const backWallL = new THREE.Mesh(new THREE.BoxGeometry(20, wallHeight, wallThickness), stoneMat);
        backWallL.position.set(-20, wallHeight / 2, -wallSize);
        castleGroup.add(backWallL);
        this.solids.push(backWallL);

        const backWallR = new THREE.Mesh(new THREE.BoxGeometry(20, wallHeight, wallThickness), stoneMat);
        backWallR.position.set(20, wallHeight / 2, -wallSize);
        castleGroup.add(backWallR);
        this.solids.push(backWallR);

        const backWallTop = new THREE.Mesh(new THREE.BoxGeometry(20, 10, wallThickness), stoneMat);
        backWallTop.position.set(0, 20, -wallSize);
        castleGroup.add(backWallTop);
        // Top part doesn't need ground collision usually but good to have

        // Side Walls
        const wallL = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallSize), stoneMat);
        wallL.position.set(-wallSize / 2, wallHeight / 2, -wallSize / 2);
        castleGroup.add(wallL);
        this.solids.push(wallL);

        const wallR = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallSize), stoneMat);
        wallR.position.set(wallSize / 2, wallHeight / 2, -wallSize / 2);
        castleGroup.add(wallR);
        this.solids.push(wallR);

        // Second Floor Walkway
        const walkway = new THREE.Mesh(new THREE.BoxGeometry(wallSize, 1, 15), darkStoneMat);
        walkway.position.set(0, 14.625, -8.5);
        castleGroup.add(walkway);
        this.solids.push(walkway);

        // Staircase
        const numSteps = 20;
        const stepHeight = 0.75;
        const stepDepth = 2;
        for (let i = 0; i < numSteps; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(10, stepHeight, stepDepth), stoneMat);
            // Start at -55, end at -15 (where walkway starts)
            step.position.set(-20, (i * stepHeight) + (stepHeight / 2), -55 + (i * stepDepth));
            castleGroup.add(step);
            this.solids.push(step);
        }

        // Keep (Detailed Building with Interior)
        const keepGroup = new THREE.Group();
        const keepWidth = 30;
        const keepHeight = 50;
        const keepDepth = 30;
        
        // Keep Walls
        const kWallMat = stoneMat;
        
        // Front Wall (with 2nd floor door)
        const kFrontLower = new THREE.Mesh(new THREE.BoxGeometry(keepWidth, 15, 2), kWallMat);
        kFrontLower.position.set(0, 7.5, 14);
        keepGroup.add(kFrontLower);
        this.solids.push(kFrontLower);

        const kFrontUpper = new THREE.Mesh(new THREE.BoxGeometry(keepWidth, 25, 2), kWallMat);
        kFrontUpper.position.set(0, 37.5, 14);
        keepGroup.add(kFrontUpper);
        this.solids.push(kFrontUpper);

        const kFrontL = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2), kWallMat);
        kFrontL.position.set(-10, 20, 14);
        keepGroup.add(kFrontL);
        this.solids.push(kFrontL);

        const kFrontR = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2), kWallMat);
        kFrontR.position.set(10, 20, 14);
        keepGroup.add(kFrontR);
        this.solids.push(kFrontR);

        // Keep Sides and Back
        const kSideL = new THREE.Mesh(new THREE.BoxGeometry(2, keepHeight, keepDepth), kWallMat);
        kSideL.position.set(-14, 25, 0);
        keepGroup.add(kSideL);
        this.solids.push(kSideL);

        const kSideR = new THREE.Mesh(new THREE.BoxGeometry(2, keepHeight, keepDepth), kWallMat);
        kSideR.position.set(14, 25, 0);
        keepGroup.add(kSideR);
        this.solids.push(kSideR);

        const kBack = new THREE.Mesh(new THREE.BoxGeometry(keepWidth, keepHeight, 2), kWallMat);
        kBack.position.set(0, 25, -14);
        keepGroup.add(kBack);
        this.solids.push(kBack);

        // Keep Second Floor Interior
        const kFloor2 = new THREE.Mesh(new THREE.BoxGeometry(keepWidth, 1, keepDepth), darkStoneMat);
        kFloor2.position.set(0, 14.625, 0);
        keepGroup.add(kFloor2);
        this.solids.push(kFloor2);

        // Keep Roof
        const kRoof = new THREE.Mesh(new THREE.BoxGeometry(keepWidth + 4, 2, keepDepth + 4), darkStoneMat);
        kRoof.position.set(0, keepHeight, 0);
        keepGroup.add(kRoof);
        this.solids.push(kRoof);

        // SPEED ORB
        const orbGeom = new THREE.SphereGeometry(1.5, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.8
        });
        this.orb = new THREE.Mesh(orbGeom, orbMat);
        this.orb.position.set(0, 17, 0); // Relative to keepGroup
        keepGroup.add(this.orb);

        // Orb light
        const orbLight = new THREE.PointLight(0x00ffff, 10, 20);
        orbLight.position.set(0, 17, 0);
        keepGroup.add(orbLight);

        keepGroup.position.set(0, 0, -wallSize / 2);
        castleGroup.add(keepGroup);

        // Huge Gate (Moved to back)
        const gateGroup = new THREE.Group();
        const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(20, 15, 1), woodMat);
        gateGroup.add(gateFrame);

        const barGeom = new THREE.BoxGeometry(0.5, 15, 0.5);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
        for (let i = -8; i <= 8; i += 4) {
            const bar = new THREE.Mesh(barGeom, barMat);
            bar.position.set(i, 0, 0.6);
            gateGroup.add(bar);
        }
        gateGroup.position.set(0, 18, -wallSize + 1);
        castleGroup.add(gateGroup);

        // Towers
        const towerGeom = new THREE.CylinderGeometry(8, 8, 40, 8);
        const towerPositions = [
            { x: -wallSize / 2, z: 0 },
            { x: wallSize / 2, z: 0 },
            { x: -wallSize / 2, z: -wallSize },
            { x: wallSize / 2, z: -wallSize }
        ];

        towerPositions.forEach(pos => {
            const tower = new THREE.Mesh(towerGeom, stoneMat);
            tower.position.set(pos.x, 20, pos.z);
            tower.castShadow = true;
            tower.receiveShadow = true;
            castleGroup.add(tower);
            this.solids.push(tower);

            const topGeom = new THREE.CylinderGeometry(9, 9, 4, 8);
            const top = new THREE.Mesh(topGeom, darkStoneMat);
            top.position.set(pos.x, 42, pos.z);
            castleGroup.add(top);
        });

        // Interior Detail: Red Carpet
        const carpetGeom = new THREE.PlaneGeometry(15, 60);
        const carpetMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c });
        const carpet = new THREE.Mesh(carpetGeom, carpetMat);
        carpet.rotation.x = -Math.PI / 2;
        carpet.position.set(0, 0.1, -30);
        castleGroup.add(carpet);

        castleGroup.position.set(castlePos.x, castlePos.y, castlePos.z);
        
        // Add a "path" leading to it
        const pathGeom = new THREE.PlaneGeometry(25, 200);
        const pathMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const path = new THREE.Mesh(pathGeom, pathMat);
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.05, 100);
        path.receiveShadow = true;
        this.scene.add(path);

        this.scene.add(castleGroup);
    }

    createHouse() {
        const houseGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });

        const size = 15;
        const height = 12;

        // Walls
        const wallGeom = new THREE.BoxGeometry(size, height, 1);
        
        // Front wall with opening
        const frontL = new THREE.Mesh(new THREE.BoxGeometry(6, height, 1), woodMat);
        frontL.position.set(-4.5, height / 2, size / 2);
        houseGroup.add(frontL);
        this.solids.push(frontL);

        const frontR = new THREE.Mesh(new THREE.BoxGeometry(6, height, 1), woodMat);
        frontR.position.set(4.5, height / 2, size / 2);
        houseGroup.add(frontR);
        this.solids.push(frontR);

        const frontTop = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 1), woodMat);
        frontTop.position.set(0, 10, size / 2);
        houseGroup.add(frontTop);

        // Back and sides
        const back = new THREE.Mesh(wallGeom, woodMat);
        back.position.set(0, height / 2, -size / 2);
        houseGroup.add(back);
        this.solids.push(back);

        const sideL = new THREE.Mesh(new THREE.BoxGeometry(1, height, size), woodMat);
        sideL.position.set(-size / 2, height / 2, 0);
        houseGroup.add(sideL);
        this.solids.push(sideL);

        const sideR = new THREE.Mesh(new THREE.BoxGeometry(1, height, size), woodMat);
        sideR.position.set(size / 2, height / 2, 0);
        houseGroup.add(sideR);
        this.solids.push(sideR);

        // Pitched Roof
        const roofGeom = new THREE.ConeGeometry(size, 8, 4);
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(0, height + 3, 0);
        roof.rotation.y = Math.PI / 4;
        houseGroup.add(roof);
        this.solids.push(roof);

        // Interior Floor
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), woodMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.05;
        houseGroup.add(floor);

        houseGroup.position.set(20, 0, 20); // Near starting point but not exactly on top
        this.scene.add(houseGroup);

        // Cat Bowl
        this.bowlGroup = new THREE.Group();
        const bowlGeom = new THREE.CylinderGeometry(1.5, 1.2, 0.8, 16);
        const bowlMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f });
        this.bowl = new THREE.Mesh(bowlGeom, bowlMat);
        this.bowlGroup.add(this.bowl);

        const foodGeom = new THREE.SphereGeometry(1.2, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const foodMat = new THREE.MeshStandardMaterial({ color: 0x795548 });
        this.food = new THREE.Mesh(foodGeom, foodMat);
        this.food.position.y = 0.2;
        this.bowlGroup.add(this.food);

        this.bowlGroup.position.set(20, 0.4, 18); // Inside the house
        this.scene.add(this.bowlGroup);
    }

    createPinkOrb() {
        const orbGeom = new THREE.SphereGeometry(1.5, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({ 
            color: 0xff00ff, 
            emissive: 0xff00ff, 
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0.8
        });
        this.pinkOrb = new THREE.Mesh(orbGeom, orbMat);
        this.pinkOrb.position.set(0, 5, 140); // At the main gate
        this.scene.add(this.pinkOrb);

        const orbLight = new THREE.PointLight(0xff00ff, 10, 20);
        orbLight.position.set(0, 5, 140);
        this.scene.add(orbLight);
        this.pinkOrbSummoned = true;
    }

    startCutscene() {
        this.isCutscene = true;
        this.pinkOrb.removeFromParent();
        
        // Position cats to face each other
        this.cat.position.set(-5, 0, 140);
        this.cat.lookAt(new THREE.Vector3(5, 0, 140));
        
        this.orangeCat.position.set(5, 0, 140);
        this.orangeCat.lookAt(new THREE.Vector3(-5, 0, 140));

        // Cutscene Sequence
        const hud = document.querySelector('#hud p');
        if (hud) hud.innerHTML = '<span style="color: #ff00ff; font-weight: bold;">BEST FRIENDS FOREVER</span>';

        setTimeout(() => this.playMeow(600), 500); // Grey cat (high pitch)
        setTimeout(() => this.playMeow(400), 1000); // Orange cat (low pitch)
        setTimeout(() => this.playMeow(600), 1500);
        setTimeout(() => this.playMeow(400), 1800);

        setTimeout(() => {
            this.isCutscene = false;
            this.speedMultiplier = 6; // Super fast!
            if (hud) hud.innerHTML = '<span style="color: #00ff00; font-weight: bold;">LEGENDARY SPEED UNLOCKED!</span>';
        }, 3000);
    }

    createOrangeCat() {
        const catGroup = new THREE.Group();
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x2196f3 }); // Vivid Blue
        const darkBlueMat = new THREE.MeshStandardMaterial({ color: 0x1976d2 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffc1e3 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 2.5), blueMat);
        body.position.y = 1;
        body.castShadow = true;
        catGroup.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), blueMat);
        head.position.set(0, 1.8, 1.2);
        head.castShadow = true;
        catGroup.add(head);

        // Ears
        const earGeom = new THREE.ConeGeometry(0.3, 0.6, 4);
        const earL = new THREE.Mesh(earGeom, blueMat);
        earL.position.set(-0.4, 2.6, 1.2);
        catGroup.add(earL);
        const earR = new THREE.Mesh(earGeom, blueMat);
        earR.position.set(0.4, 2.6, 1.2);
        catGroup.add(earR);

        // Eyes
        const eyeGeom = new THREE.SphereGeometry(0.15, 8, 8);
        const eyeL = new THREE.Mesh(eyeGeom, blackMat);
        eyeL.position.set(-0.3, 2.0, 1.75);
        orangeCatGroup.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeom, blackMat);
        eyeR.position.set(0.3, 2.0, 1.75);
        orangeCatGroup.add(eyeR);

        // Legs
        const legGeom = new THREE.BoxGeometry(0.3, 1, 0.3);
        const legPositions = [
            { x: -0.4, z: 0.8 }, { x: 0.4, z: 0.8 },
            { x: -0.4, z: -0.8 }, { x: 0.4, z: -0.8 }
        ];
        this.orangeCatLegs = [];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeom, orangeMat);
            leg.position.set(pos.x, 0.5, pos.z);
            orangeCatGroup.add(leg);
            this.orangeCatLegs.push(leg);
        });

        // Tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.5), orangeMat);
        tail.position.set(0, 1.4, -1.8);
        tail.rotation.x = -0.5;
        orangeCatGroup.add(tail);

        orangeCatGroup.position.set(0, 0, 260); // Behind the castle
        orangeCatGroup.rotation.y = Math.PI; // Face the castle
        this.scene.add(orangeCatGroup);
        this.orangeCat = orangeCatGroup;
        
        // Add to solids for camera
        body.castShadow = true;
        head.castShadow = true;
        this.solids.push(body);
    }

    playMeow(pitch = 400) {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(pitch * 2, this.audioCtx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, this.audioCtx.currentTime + 0.4);
        
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.5);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(50, 50, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        this.scene.add(sunLight);
    }

    createEnvironment() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x567d46, // Grassy green
            roughness: 0.9
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add some "trees"
        const canopyColors = [0x2e7d32, 0x388e3c, 0x43a047];

        for (let i = 0; i < 60; i++) {
            const x = (Math.random() - 0.5) * 600;
            const z = (Math.random() - 0.5) * 600;
            
            // Skip player start area
            if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;
            
            // Skip house area (centered at (20,20), size ~15x15)
            if (x > 5 && x < 35 && z > 5 && z < 35) continue;
            
            // Skip castle area (centered at z=200, size ~60x60)
            if (Math.abs(x) < 50 && z > 130 && z < 250) continue;

            const treeGroup = new THREE.Group();
            
            // Randomize overall scale
            const overallScale = 1.5 + Math.random() * 2.5;
            const height = (4 + Math.random() * 3) * overallScale;
            
            // Detailed Trunk
            const trunkGeom = new THREE.CylinderGeometry(0.4 * overallScale, 0.7 * overallScale, height, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = height / 2;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            treeGroup.add(trunk);
            this.solids.push(trunk);

            const layers = 3 + Math.floor(Math.random() * 2);
            for (let l = 0; l < layers; l++) {
                const layerScale = (1 - l * 0.2) * overallScale * 3;
                const layerHeight = height + (l * 1.5 * overallScale);
                
                const clusterSize = 3;
                for (let c = 0; c < clusterSize; c++) {
                    const sphereGeom = new THREE.SphereGeometry(layerScale * (0.8 + Math.random() * 0.4), 8, 8);
                    const sphereMat = new THREE.MeshStandardMaterial({ 
                        color: canopyColors[Math.floor(Math.random() * canopyColors.length)],
                        roughness: 0.8
                    });
                    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
                    
                    const angle = (c / clusterSize) * Math.PI * 2;
                    const dist = layerScale * 0.3;
                    sphere.position.set(
                        Math.cos(angle) * dist,
                        layerHeight,
                        Math.sin(angle) * dist
                    );
                    
                    sphere.castShadow = true;
                    treeGroup.add(sphere);
                    this.solids.push(sphere);
                }
            }

            treeGroup.position.set(x, 0, z);
            this.scene.add(treeGroup);
        }

        // Add some rocks
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;
            
            // Skip player start area
            if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
            
            // Skip house area (centered at 20, 20)
            if (x > 5 && x < 35 && z > 5 && z < 35) continue;
            
            // Skip castle area
            if (Math.abs(x) < 50 && z > 130 && z < 250) continue;

            const scale = 0.5 + Math.random() * 1.5;
            const rockGeom = new THREE.DodecahedronGeometry(scale, 0);
            const rockMat = new THREE.MeshStandardMaterial({ color: 0x757575 });
            const rock = new THREE.Mesh(rockGeom, rockMat);
            rock.position.set(x, scale * 0.5, z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
            this.solids.push(rock);
        }
    }

    createCat() {
        const catGroup = new THREE.Group();

        // Materials
        const blueBody = new THREE.MeshStandardMaterial({ color: 0x2196f3 }); // Vivid Blue
        const darkBlue = new THREE.MeshStandardMaterial({ color: 0x1976d2 });
        const pink = new THREE.MeshStandardMaterial({ color: 0xf48fb1 });
        const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const black = new THREE.MeshStandardMaterial({ color: 0x212121 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.1), blueBody);
        body.position.y = 0.6;
        body.castShadow = true;
        catGroup.add(body);

        // White chest patch
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.1), white);
        chest.position.set(0, 0.6, 0.56);
        catGroup.add(chest);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.55), blueBody);
        head.position.set(0, 0.95, 0.6);
        head.castShadow = true;
        catGroup.add(head);

        // Ears
        const earGeom = new THREE.ConeGeometry(0.15, 0.3, 4);
        const earL = new THREE.Mesh(earGeom, darkBlue);
        earL.position.set(0.2, 1.3, 0.6);
        catGroup.add(earL);

        const earR = new THREE.Mesh(earGeom, darkBlue);
        earR.position.set(-0.2, 1.3, 0.6);
        catGroup.add(earR);

        // Eyes
        const eyeGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeL = new THREE.Mesh(eyeGeom, black);
        eyeL.position.set(0.15, 1.05, 0.85);
        catGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeom, black);
        eyeR.position.set(-0.15, 1.05, 0.85);
        catGroup.add(eyeR);

        // Nose
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), pink);
        nose.position.set(0, 0.9, 0.88);
        catGroup.add(nose);

        // Legs
        const legGeom = new THREE.BoxGeometry(0.18, 0.45, 0.18);
        this.legs = [];
        const legPositions = [
            { x: 0.22, y: 0.225, z: 0.35 },
            { x: -0.22, y: 0.225, z: 0.35 },
            { x: 0.22, y: 0.225, z: -0.35 },
            { x: -0.22, y: 0.225, z: -0.35 }
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeom, blueBody);
            leg.position.set(pos.x, pos.y, pos.z);
            leg.castShadow = true;
            catGroup.add(leg);
            this.legs.push(leg);
        });

        // Tail
        const tailGeom = new THREE.BoxGeometry(0.12, 0.12, 0.7);
        this.tail = new THREE.Mesh(tailGeom, darkBlue);
        this.tail.position.set(0, 0.75, -0.8);
        this.tail.rotation.x = -Math.PI / 6;
        catGroup.add(this.tail);

        this.cat = catGroup;
        this.scene.add(this.cat);
    }

    setupControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // R Key Reset
            if (e.code === 'KeyR') {
                this.resetPosition();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update(delta) {
        if (this.isCutscene) {
            // Cutscene Animation (Tail wags, etc.)
            this.tail.rotation.y = Math.sin(this.clock.elapsedTime * 4) * 0.4;
            return;
        }

        const baseSpeed = 12;
        const speed = baseSpeed * this.speedMultiplier;
        const baseJump = 12;
        const jumpForce = baseJump * this.jumpMultiplier;
        const gravity = 30;

        let isMoving = false;
        const oldPos = this.cat.position.clone();

        // --- Summon Pink Orb ---
        if (this.isOrangeCatFollowing && !this.pinkOrbSummoned) {
            this.createPinkOrb();
        }

        // --- Interaction Logic (Pink Orb) ---
        if (this.pinkOrb) {
            const dist = this.cat.position.distanceTo(this.pinkOrb.position);
            const bubble = document.getElementById('interaction-bubble');

            if (dist < 8) {
                if (this.bubbleState === 0) {
                    this.bubbleState = 1;
                    bubble.innerText = 'What is this?';
                    bubble.classList.remove('hidden');
                }
                
                const screenPos = this.pinkOrb.position.clone().project(this.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
                bubble.style.left = `${x}px`;
                bubble.style.top = `${y - 100}px`;

                if (dist < 3) {
                    this.startCutscene();
                }
            } else if (this.bubbleState === 1 && bubble.innerText === 'What is this?') {
                this.bubbleState = 0;
                bubble.classList.add('hidden');
            }
        }

        // --- Interaction Logic (Bowl) ---
        if (this.bowl && !this.isEating && this.food && this.food.parent) {
            const bowlWorldPos = new THREE.Vector3();
            this.bowl.getWorldPosition(bowlWorldPos);
            const dist = this.cat.position.distanceTo(bowlWorldPos);
            const bubble = document.getElementById('interaction-bubble');

            if (dist < 4) {
                if (this.bubbleState === 0) {
                    this.bubbleState = 1;
                    this.bubbleTimer = 0;
                    bubble.innerText = 'Food?';
                    bubble.classList.remove('hidden');
                } else if (this.bubbleState === 1) {
                    this.bubbleTimer += delta;
                    if (this.bubbleTimer > 1) {
                        this.bubbleState = 2;
                        bubble.innerText = 'Press E to interact';
                    }
                }

                const screenPos = bowlWorldPos.clone().project(this.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
                bubble.style.left = `${x}px`;
                bubble.style.top = `${y - 100}px`;

                if (this.keys['KeyE'] && this.bubbleState === 2) {
                    this.startEating();
                }
            } else {
                this.bubbleState = 0;
                bubble.classList.add('hidden');
            }
        }

        // --- Interaction Logic (Orange Cat) ---
        if (this.orangeCat) {
            const dist = this.cat.position.distanceTo(this.orangeCat.position);
            const bubble = document.getElementById('interaction-bubble');

            // Trigger following if close
            if (dist < 15 && !this.isOrangeCatFollowing) {
                this.isOrangeCatFollowing = true;
            }

            if (this.isOrangeCatFollowing) {
                // Follow Logic: Target a point behind the player
                const followDistance = 8;
                const playerDir = new THREE.Vector3(0, 0, -1);
                playerDir.applyQuaternion(this.cat.quaternion);
                const targetPos = this.cat.position.clone().addScaledVector(playerDir, followDistance);
                
                // Ground clamp for target
                targetPos.y = 0; 

                const distToTarget = this.orangeCat.position.distanceTo(targetPos);
                const followSpeed = 12; // Original cat speed
                
                if (distToTarget > 1) {
                    // Move towards target
                    const moveDir = targetPos.clone().sub(this.orangeCat.position).normalize();
                    this.orangeCat.position.addScaledVector(moveDir, followSpeed * delta);
                    
                    // Look at player smoothly
                    const lookTarget = new THREE.Vector3(this.cat.position.x, this.orangeCat.position.y, this.cat.position.z);
                    this.orangeCat.lookAt(lookTarget);

                    // Animate orange cat legs
                    const legTime = this.clock.elapsedTime * 24;
                    this.orangeCatLegs[0].rotation.x = Math.sin(legTime) * 0.5;
                    this.orangeCatLegs[1].rotation.x = Math.cos(legTime) * 0.5;
                    this.orangeCatLegs[2].rotation.x = Math.cos(legTime) * 0.5;
                    this.orangeCatLegs[3].rotation.x = Math.sin(legTime) * 0.5;
                } else {
                    // Idle legs
                    this.orangeCatLegs.forEach(l => l.rotation.x = 0);
                }
            }

            if (dist < 10) {
                if (this.bubbleState === 0) {
                    this.bubbleState = 1;
                    bubble.innerText = 'Meow?';
                    bubble.classList.remove('hidden');
                }
                
                const screenPos = this.orangeCat.position.clone().project(this.camera);
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
                bubble.style.left = `${x}px`;
                bubble.style.top = `${y - 120}px`;

                if (this.keys['KeyE']) {
                    this.playMeow();
                    this.keys['KeyE'] = false; // Prevent spam
                }
            } else if (this.bubbleState === 1 && bubble.innerText === 'Meow?') {
                this.bubbleState = 0;
                bubble.classList.add('hidden');
            }
        }

        // Eating Animation (Bowing)
        if (this.isEating) {
            this.eatTimer += delta;
            this.cat.rotation.x = Math.sin(this.eatTimer * 10) * 0.3; // Bowing
            if (this.eatTimer > 2) {
                this.finishEating();
            }
            return; // Stop other movement while eating
        }

        // Orb Animation and Collection
        if (this.orb && this.orb.parent) {
            this.orb.rotation.y += delta * 2;
            this.orb.position.y = 17 + Math.sin(this.clock.elapsedTime * 3) * 0.5;
            
            const orbWorldPos = new THREE.Vector3();
            this.orb.getWorldPosition(orbWorldPos);
            
            const dist = this.cat.position.distanceTo(orbWorldPos);
            if (dist < 3 && !this.houseSummoned) {
                this.speedMultiplier = 3;
                this.orb.removeFromParent(); 
                this.createHouse(); 
                this.houseSummoned = true;
                
                const hud = document.querySelector('#hud p');
                if (hud) {
                    hud.innerHTML = '<span style="color: #00ffff; font-weight: bold;">SPEED BOOST ACTIVE!</span><br><span style="color: #ffd166;">A mysterious house appeared at the start!</span>';
                }
            }
        }

        // Rotation
        const turnSpeed = 6;
        if (this.keys['KeyA']) this.cat.rotation.y += turnSpeed * delta;
        if (this.keys['KeyD']) this.cat.rotation.y -= turnSpeed * delta;
        if (this.joystickData.active) {
            this.cat.rotation.y -= this.joystickData.x * turnSpeed * delta;
        }

        // Movement
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(this.cat.quaternion);

        if (this.keys['KeyW']) {
            this.cat.position.addScaledVector(direction, speed * delta);
            isMoving = true;
        }
        if (this.keys['KeyS']) {
            this.cat.position.addScaledVector(direction, -speed * delta * 0.5);
            isMoving = true;
        }
        if (this.joystickData.active && Math.abs(this.joystickData.y) > 0.1) {
            this.cat.position.addScaledVector(direction, -this.joystickData.y * speed * delta);
            isMoving = true;
        }

        // --- Collision Detection (Horizontal) ---
        // Simple bounding box for cat (approx 0.5 radius)
        const catBox = new THREE.Box3().setFromCenterAndSize(
            this.cat.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
            new THREE.Vector3(0.8, 1.0, 0.8)
        );

        let horizontalCollision = false;
        for (const solid of this.solids) {
            const solidBox = new THREE.Box3().setFromObject(solid);
            if (catBox.intersectsBox(solidBox)) {
                // If it's a wall (too high to step over), block movement
                // Allow stepping up if the difference is small (< 0.6)
                const heightDiff = solidBox.max.y - oldPos.y;
                if (heightDiff > 0.6) {
                    horizontalCollision = true;
                    break;
                }
            }
        }

        if (horizontalCollision) {
            this.cat.position.copy(oldPos);
        }

        // --- Gravity and Vertical Collision ---
        let groundY = 0;
        const catBottom = this.cat.position.x; // Just a placeholder for local check
        
        // Check what's under the cat
        const downRay = new THREE.Vector3(this.cat.position.x, this.cat.position.y + 1, this.cat.position.z);
        for (const solid of this.solids) {
            const solidBox = new THREE.Box3().setFromObject(solid);
            // Check if cat is horizontally within the solid's bounds
            if (this.cat.position.x >= solidBox.min.x && this.cat.position.x <= solidBox.max.x &&
                this.cat.position.z >= solidBox.min.z && this.cat.position.z <= solidBox.max.z) {
                // If cat is above or slightly inside the top of the solid
                if (this.cat.position.y >= solidBox.max.y - 0.5) {
                    groundY = Math.max(groundY, solidBox.max.y);
                }
            }
        }

        if (this.keys['Space'] && !this.isJumping) {
            this.catVelocity.y = jumpForce;
            this.isJumping = true;
        }

        if (this.isJumping || this.cat.position.y > groundY) {
            this.catVelocity.y -= gravity * delta;
            this.cat.position.y += this.catVelocity.y * delta;

            if (this.cat.position.y <= groundY) {
                this.cat.position.y = groundY;
                this.isJumping = false;
                this.catVelocity.y = 0;
            }
        } else {
            // Snap to ground/solid
            this.cat.position.y = groundY;
        }

        // Animations
        if (isMoving && !this.isJumping) {
            const time = this.clock.elapsedTime * 24 * this.speedMultiplier;
            // Add a small bounce relative to current height
            const bounce = 0.05 * Math.abs(Math.sin(time));
            this.cat.position.y += bounce;
            
            this.legs[0].rotation.x = Math.sin(time) * 0.5;
            this.legs[1].rotation.x = Math.cos(time) * 0.5;
            this.legs[2].rotation.x = Math.cos(time) * 0.5;
            this.legs[3].rotation.x = Math.sin(time) * 0.5;
            this.tail.rotation.y = Math.sin(time * 0.5) * 0.3;
        } else if (!this.isJumping) {
            this.tail.rotation.y = Math.sin(this.clock.elapsedTime * 2) * 0.2;
            this.legs.forEach(l => l.rotation.x = 0);
        }

        // Camera Follow (Smart Camera with Collision)
        const idealOffset = new THREE.Vector3(0, 5, -12);
        idealOffset.applyQuaternion(this.cat.quaternion);
        idealOffset.add(this.cat.position);
        
        const catHeadPos = this.cat.position.clone().add(new THREE.Vector3(0, 1, 0));
        const rayDirection = idealOffset.clone().sub(catHeadPos).normalize();
        const rayLength = catHeadPos.distanceTo(idealOffset);
        
        this.raycaster.set(catHeadPos, rayDirection);
        this.raycaster.far = rayLength;
        
        const intersects = this.raycaster.intersectObjects(this.solids, true);
        let targetCameraPos = idealOffset;
        
        if (intersects.length > 0) {
            // Move camera to intersection point with a bit of padding
            targetCameraPos = intersects[0].point.clone().addScaledVector(rayDirection, -0.5);
        }
        
        const idealLookAt = this.cat.position.clone().add(new THREE.Vector3(0, 1, 0));
        this.camera.position.lerp(targetCameraPos, 0.1);
        this.camera.lookAt(idealLookAt);
    }


    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        this.update(delta);
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    startEating() {
        this.isEating = true;
        this.eatTimer = 0;
        document.getElementById('interaction-bubble').classList.add('hidden');
    }

    finishEating() {
        this.isEating = false;
        this.cat.rotation.x = 0;
        
        // Completely remove the entire bowl group
        if (this.bowlGroup) {
            this.scene.remove(this.bowlGroup);
            this.bowlGroup = null;
        }
        
        this.bowl = null;
        this.food = null;

        // Increase size
        this.catScale = 2;
        this.cat.scale.set(this.catScale, this.catScale, this.catScale);
        
        // Increase jump
        this.jumpMultiplier = 1.5;

        // Create Friend Cat
        this.createOrangeCat();

        // Feedback
        const hud = document.querySelector('#hud p');
        if (hud) {
            hud.innerHTML = '<span style="color: #ffb6c1; font-weight: bold;">BIG CAT ACTIVATED!</span><br>A new friend appeared behind the castle!';
        }
    }

    resetPosition() {
        if (!this.cat) return;
        this.cat.position.set(0, 0, 0);
        this.cat.rotation.set(0, 0, 0);
        this.catVelocity.set(0, 0, 0);
    }
}

new Game();
