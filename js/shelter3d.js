/**
 * SOLARTHERM SIH26051 - Three.js Parametric 3D Digital Twin
 * Real-time data-driven parametric shelter geometry, camera presets,
 * clipping section, exploded view, sun path arc, and dimension annotations.
 */

class Shelter3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.shelterGroup = new THREE.Group();
    this.sunGroup = new THREE.Group();
    this.dimensionGroup = new THREE.Group();
    this.compassGroup = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.meshes = {};
    this.isExploded = false;
    this.isSection = false;
    this.isThermal = false;
    this.sunPathVisible = true;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene with transparent background to reveal Ladakh Himalayan mountain backdrop
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    this.camera.position.set(11, 7.5, 12);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // allow slightly looking up from ground
      this.controls.minDistance = 4;
      this.controls.maxDistance = 35;
      this.controls.target.set(0, 1.4, 0);
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Ground & Compass
    this.setupGround();

    // 7. Add Groups
    this.scene.add(this.shelterGroup);
    this.scene.add(this.sunGroup);
    this.scene.add(this.dimensionGroup);

    // 8. Build initial geometry
    this.rebuildGeometry();

    // 9. Sun Path
    this.updateSunPath();

    // 10. Event Listeners
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // Subscribe to state changes
    window.state.subscribe((st, key) => {
      if (key === 'shelterDesign') {
        this.rebuildGeometry();
      } else if (key === 'selectedComponent') {
        this.highlightComponent(st.selectedComponent);
      } else if (key === 'viewMode') {
        this.applyViewMode(st.viewMode);
      }
    });

    // Render loop
    this.animate();
  }

  setupLighting() {
    // Ambient soft skylight
    const hemiLight = new THREE.HemisphereLight(0x90cdf4, 0x1e293b, 0.65);
    this.scene.add(hemiLight);

    // Directional Sunlight (simulating high-altitude Ladakh winter sun from South)
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.sunLight.position.set(6, 12, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 40;
    const d = 10;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Subtle fill light
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-8, 5, -8);
    this.scene.add(fillLight);
  }

  setupGround() {
    // Rocky/snowy high-altitude terrain disc
    const groundGeo = new THREE.CylinderGeometry(14, 14, 0.4, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a263d,
      roughness: 0.88,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Circular ground grid ring
    const grid = new THREE.PolarGridHelper(13.5, 16, 8, 64, 0x38bdf8, 0x1e3a5f);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Cardinal Orientation Compass
    this.setupCompass();
  }

  setupCompass() {
    const r = 7.5;
    const points = [
      { label: 'S', pos: [0, 0.05, r], color: '#f59e0b', sub: 'SOLAR NOON (180°)' }, // South in front
      { label: 'N', pos: [0, 0.05, -r], color: '#64748b', sub: 'SHADOW ZONE (0°)' },
      { label: 'E', pos: [r, 0.05, 0], color: '#38bdf8', sub: 'MORNING (90°)' },
      { label: 'W', pos: [-r, 0.05, 0], color: '#38bdf8', sub: 'EVENING (270°)' }
    ];

    points.forEach(pt => {
      // 3D Canvas sprite for letters
      const sprite = this.createTextSprite(pt.label, pt.color, 48);
      sprite.position.set(pt.pos[0], pt.pos[1] + 0.3, pt.pos[2]);
      sprite.scale.set(1.2, 0.8, 1);
      this.scene.add(sprite);
    });
  }

  createTextSprite(text, color = '#ffffff', fontSize = 36) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(spriteMat);
  }

  rebuildGeometry() {
    // Clear previous shelter meshes
    while (this.shelterGroup.children.length > 0) {
      const obj = this.shelterGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.shelterGroup.remove(obj);
    }
    this.meshes = {};

    const d = window.state.shelterDesign;
    const L = d.length;
    const W = d.width;
    const H = d.height;
    const T = d.wallThickness;
    const pitchRad = (d.roofPitch * Math.PI) / 180;
    const roofDeltaH = W * Math.tan(pitchRad); // mono-pitch slope: south high, north low or vice versa

    // Materials
    const wallMatDef = window.MATERIALS_DB.wall[d.wallMaterial] || window.MATERIALS_DB.wall.plain_concrete;
    const roofMatDef = window.MATERIALS_DB.roof[d.roofMaterial] || window.MATERIALS_DB.roof.metal_corrugated;

    // Three.js materials
    const concretePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.1
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(wallMatDef.color),
      roughness: 0.75,
      metalness: 0.15,
      clippingPlanes: this.isSection ? [this.clipPlane] : []
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(roofMatDef.color),
      roughness: 0.5,
      metalness: 0.4,
      clippingPlanes: this.isSection ? [this.clipPlane] : []
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transmission: 0.85,
      opacity: 1,
      transparent: true,
      roughness: 0.05,
      ior: 1.52,
      thickness: 0.1
    });

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8
    });

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5a3825,
      roughness: 0.6,
      metalness: 0.2
    });

    const pcmMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.2,
      metalness: 0.5,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25
    });

    // 1. Foundation Plinth / Substructure
    const plinthGeo = new THREE.BoxGeometry(L + 0.6, 0.35, W + 0.6);
    const plinthMesh = new THREE.Mesh(plinthGeo, concretePlinthMat);
    plinthMesh.position.set(0, 0.175, 0);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    plinthMesh.userData = { id: 'foundation', name: 'Foundation / Floor Plinth' };
    this.shelterGroup.add(plinthMesh);
    this.meshes.foundation = plinthMesh;

    // Base Y level for walls
    const baseY = 0.35;

    // 2. North Wall (Cold Opaque Back Wall, facing -Z)
    const northGeo = new THREE.BoxGeometry(L, H, T);
    const northMesh = new THREE.Mesh(northGeo, wallMat.clone());
    northMesh.position.set(0, baseY + H / 2, -W / 2 + T / 2);
    northMesh.castShadow = true;
    northMesh.receiveShadow = true;
    northMesh.userData = { id: 'north_wall', name: 'North Wall (Thermal Buffer)' };
    this.shelterGroup.add(northMesh);
    this.meshes.north_wall = northMesh;

    // 3. South Wall with Window & Door Cutout (facing +Z)
    // Construct modular sections: Left solid, Center window, Right door
    const southGroup = new THREE.Group();
    southGroup.userData = { id: 'south_wall', name: 'South Wall (Solar Facade)' };

    // South window width derived from windowArea / windowHeight
    const winH = Math.min(H * 0.75, 2.0);
    const winW = Math.min(L * 0.65, d.windowArea / winH);
    const doorW = d.doorWidth || 1.0;
    const doorH = d.doorHeight || 2.0;

    const leftWallW = Math.max(0.4, (L - winW - doorW - 0.4) / 2);
    const rightWallW = L - winW - doorW - leftWallW;

    // Left opaque portion of south wall
    const sLeftGeo = new THREE.BoxGeometry(leftWallW, H, T);
    const sLeftMesh = new THREE.Mesh(sLeftGeo, wallMat.clone());
    sLeftMesh.position.set(-L / 2 + leftWallW / 2, baseY + H / 2, W / 2 - T / 2);
    sLeftMesh.castShadow = true;
    southGroup.add(sLeftMesh);

    // Spandrel / Header above window
    const winHeaderH = H - winH;
    if (winHeaderH > 0.1) {
      const headerGeo = new THREE.BoxGeometry(winW, winHeaderH, T);
      const headerMesh = new THREE.Mesh(headerGeo, wallMat.clone());
      headerMesh.position.set(-L / 2 + leftWallW + winW / 2, baseY + winH + winHeaderH / 2, W / 2 - T / 2);
      headerMesh.castShadow = true;
      southGroup.add(headerMesh);
    }

    // Header above door
    const doorHeaderH = H - doorH;
    if (doorHeaderH > 0.05) {
      const dHeaderGeo = new THREE.BoxGeometry(doorW, doorHeaderH, T);
      const dHeaderMesh = new THREE.Mesh(dHeaderGeo, wallMat.clone());
      dHeaderMesh.position.set(L / 2 - rightWallW - doorW / 2, baseY + doorH + doorHeaderH / 2, W / 2 - T / 2);
      dHeaderMesh.castShadow = true;
      southGroup.add(dHeaderMesh);
    }

    // Right opaque portion
    const sRightGeo = new THREE.BoxGeometry(rightWallW, H, T);
    const sRightMesh = new THREE.Mesh(sRightGeo, wallMat.clone());
    sRightMesh.position.set(L / 2 - rightWallW / 2, baseY + H / 2, W / 2 - T / 2);
    sRightMesh.castShadow = true;
    southGroup.add(sRightMesh);

    this.shelterGroup.add(southGroup);
    this.meshes.south_wall = southGroup;

    // 4. Glazing (Window)
    const glassGeo = new THREE.BoxGeometry(winW, winH, 0.04);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(-L / 2 + leftWallW + winW / 2, baseY + winH / 2, W / 2 - T / 2);
    glassMesh.castShadow = true;
    glassMesh.userData = { id: 'window_s', name: `Glazing (${d.windowType.toUpperCase()})` };

    // Glazing Frame
    const frameEdges = new THREE.BoxHelper(glassMesh, 0x0284c7);
    this.shelterGroup.add(frameEdges);

    this.shelterGroup.add(glassMesh);
    this.meshes.window_s = glassMesh;

    // 5. Insulated Entry Door
    const doorGeo = new THREE.BoxGeometry(doorW - 0.04, doorH, 0.08);
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(L / 2 - rightWallW - doorW / 2, baseY + doorH / 2, W / 2 - T / 2);
    doorMesh.castShadow = true;
    doorMesh.userData = { id: 'door_d1', name: 'Thermal Airlock Door' };
    this.shelterGroup.add(doorMesh);
    this.meshes.door_d1 = doorMesh;

    // 6. East Wall (facing +X)
    const sideWallLen = W - 2 * T;
    const eastGeo = new THREE.BoxGeometry(T, H, sideWallLen);
    const eastMesh = new THREE.Mesh(eastGeo, wallMat.clone());
    eastMesh.position.set(L / 2 - T / 2, baseY + H / 2, 0);
    eastMesh.castShadow = true;
    eastMesh.receiveShadow = true;
    eastMesh.userData = { id: 'east_wall', name: 'East Wall' };
    this.shelterGroup.add(eastMesh);
    this.meshes.east_wall = eastMesh;

    // 7. West Wall (facing -X)
    const westGeo = new THREE.BoxGeometry(T, H, sideWallLen);
    const westMesh = new THREE.Mesh(westGeo, wallMat.clone());
    westMesh.position.set(-L / 2 + T / 2, baseY + H / 2, 0);
    westMesh.castShadow = true;
    westMesh.receiveShadow = true;
    westMesh.userData = { id: 'west_wall', name: 'West Wall' };
    this.shelterGroup.add(westMesh);
    this.meshes.west_wall = westMesh;

    // 8. Pitched Roof with Solar Array
    const roofLen = L + 0.6;
    const roofHypot = Math.sqrt(Math.pow(W + 0.6, 2) + Math.pow(roofDeltaH, 2));
    const roofGeo = new THREE.BoxGeometry(roofLen, d.roofThickness, roofHypot);
    const roofMesh = new THREE.Mesh(roofGeo, roofMat.clone());
    
    // Sloped roof angle: South is higher for maximum solar capture
    roofMesh.rotation.x = -pitchRad;
    roofMesh.position.set(0, baseY + H + (roofDeltaH / 2) + (d.roofThickness / 2), 0);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofMesh.userData = { id: 'roof', name: 'Pitched Insulated Roof' };

    // Solar PV / Thermal Absorber Panels on Roof
    const pvGeo = new THREE.BoxGeometry(roofLen * 0.85, 0.03, roofHypot * 0.75);
    const pvMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // deep solar blue
      roughness: 0.2,
      metalness: 0.85
    });
    const pvMesh = new THREE.Mesh(pvGeo, pvMat);
    pvMesh.position.y = d.roofThickness / 2 + 0.02;
    roofMesh.add(pvMesh);

    this.shelterGroup.add(roofMesh);
    this.meshes.roof = roofMesh;

    // 9. Internal Thermal Mass / Storage
    if (d.thermalStorageType !== 'none') {
      const storageGroup = new THREE.Group();
      storageGroup.userData = { id: 'thermal_mass', name: d.thermalStorageType.replace(/_/g, ' ').toUpperCase() };

      if (d.thermalStorageType === 'water_thermal_mass') {
        // Water storage cylinders behind south glazing
        const numDrums = 3;
        const drumRadius = 0.32;
        const drumHeight = 1.4;
        const drumGeo = new THREE.CylinderGeometry(drumRadius, drumRadius, drumHeight, 24);
        const drumMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.4,
          metalness: 0.3
        });

        for (let i = 0; i < numDrums; i++) {
          const drum = new THREE.Mesh(drumGeo, drumMat);
          const xOffset = -winW / 2 + (i + 0.5) * (winW / numDrums);
          drum.position.set(-L / 2 + leftWallW + winW / 2 + xOffset, baseY + drumHeight / 2, W / 2 - T - drumRadius - 0.15);
          drum.castShadow = true;
          storageGroup.add(drum);
        }
      } else {
        // Concrete Trombe or PCM layer panel
        const massGeo = new THREE.BoxGeometry(winW * 0.9, 1.8, 0.15);
        const massMesh = new THREE.Mesh(massGeo, pcmMat);
        massMesh.position.set(-L / 2 + leftWallW + winW / 2, baseY + 0.9, W / 2 - T - 0.25);
        massMesh.castShadow = true;
        storageGroup.add(massMesh);
      }

      this.shelterGroup.add(storageGroup);
      this.meshes.thermal_mass = storageGroup;
    }

    // 10. Re-apply highlights & annotations
    this.highlightComponent(window.state.selectedComponent);
    this.updateDimensionAnnotations();
  }

  updateDimensionAnnotations() {
    // Clear dimension group
    while (this.dimensionGroup.children.length > 0) {
      const obj = this.dimensionGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.dimensionGroup.remove(obj);
    }

    const d = window.state.shelterDesign;
    const L = d.length;
    const W = d.width;
    const H = d.height;
    const pitch = d.roofPitch;

    // 1. Length Dimension (Front South Ground)
    const lenSprite = this.createTextSprite(`Length\n${L.toFixed(2)} m`, '#38bdf8', 30);
    lenSprite.position.set(0, 0.35, W / 2 + 1.2);
    lenSprite.scale.set(2.4, 1.2, 1);
    this.dimensionGroup.add(lenSprite);

    // Dimension line for Length
    const lenLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const lenPts = [
      new THREE.Vector3(-L / 2, 0.1, W / 2 + 0.8),
      new THREE.Vector3(L / 2, 0.1, W / 2 + 0.8)
    ];
    const lenGeo = new THREE.BufferGeometry().setFromPoints(lenPts);
    this.dimensionGroup.add(new THREE.Line(lenGeo, lenLineMat));

    // 2. Width Dimension (East Side Ground)
    const widSprite = this.createTextSprite(`Width\n${W.toFixed(2)} m`, '#38bdf8', 30);
    widSprite.position.set(L / 2 + 1.2, 0.35, 0);
    widSprite.scale.set(2.4, 1.2, 1);
    this.dimensionGroup.add(widSprite);

    // 3. Height Dimension (Front Left Column)
    const hgtSprite = this.createTextSprite(`Height\n${H.toFixed(2)} m`, '#ffffff', 32);
    hgtSprite.position.set(-L / 2 - 1.2, 0.35 + H / 2, W / 2);
    hgtSprite.scale.set(2.4, 1.2, 1);
    this.dimensionGroup.add(hgtSprite);

    // Height vertical line
    const hgtPts = [
      new THREE.Vector3(-L / 2 - 0.8, 0.35, W / 2),
      new THREE.Vector3(-L / 2 - 0.8, 0.35 + H, W / 2)
    ];
    const hgtGeo = new THREE.BufferGeometry().setFromPoints(hgtPts);
    this.dimensionGroup.add(new THREE.Line(hgtGeo, lenLineMat));

    // 4. Roof Pitch Angle Callout
    const pitchSprite = this.createTextSprite(`Roof Pitch\n${pitch}°`, '#f59e0b', 30);
    pitchSprite.position.set(0, 0.35 + H + 1.2, -W / 4);
    pitchSprite.scale.set(2.4, 1.2, 1);
    this.dimensionGroup.add(pitchSprite);
  }

  updateSunPath() {
    // Clear sun group
    while (this.sunGroup.children.length > 0) {
      const obj = this.sunGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.sunGroup.remove(obj);
    }

    if (!this.sunPathVisible) return;

    // Dome arc curve representing high-altitude winter solar trajectory
    const curve = new THREE.EllipseCurve(
      0, 0,            // ax, aY
      10, 8,           // xRadius, yRadius
      0, Math.PI,      // aStartAngle, aEndAngle
      false,           // aClockwise
      0                // aRotation
    );

    const points = curve.getPoints(50);
    // Orient ellipse arc vertically from East (+X) through South (+Z) to West (-X)
    const pts3D = points.map(p => new THREE.Vector3(p.x, p.y + 0.3, Math.sin(p.x / 10 * Math.PI) * 4 + 4));
    const arcGeo = new THREE.BufferGeometry().setFromPoints(pts3D);
    const arcMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.4,
      gapSize: 0.2,
      linewidth: 2
    });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.computeLineDistances();
    this.sunGroup.add(arcLine);

    // Glowing Sun sphere at noon position (solar azimuth 180°, elevation 32° in Ladakh winter)
    const sunGeo = new THREE.SphereGeometry(0.65, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(1.5, 7.8, 7.5);
    this.sunGroup.add(sunMesh);

    // Sun rays glow halo
    const glowSprite = this.createTextSprite('☀️', '#f59e0b', 64);
    glowSprite.position.copy(sunMesh.position);
    glowSprite.scale.set(2.5, 2.5, 1);
    this.sunGroup.add(glowSprite);
  }

  highlightComponent(componentId) {
    // Reset all mesh highlights
    Object.keys(this.meshes).forEach(id => {
      const meshOrGroup = this.meshes[id];
      meshOrGroup.traverse(child => {
        if (child.isMesh && child.material) {
          if (child.userData.originalEmissive !== undefined) {
            child.material.emissive.setHex(child.userData.originalEmissive);
            child.material.emissiveIntensity = child.userData.originalIntensity || 0;
          }
        }
      });
    });

    // Highlight target component in vibrant cyan glow
    const target = this.meshes[componentId];
    if (target) {
      target.traverse(child => {
        if (child.isMesh && child.material) {
          if (child.userData.originalEmissive === undefined) {
            child.userData.originalEmissive = child.material.emissive.getHex();
            child.userData.originalIntensity = child.material.emissiveIntensity;
          }
          child.material.emissive.setHex(0x00f2fe);
          child.material.emissiveIntensity = 0.45;
        }
      });
    }
  }

  applyViewMode(mode) {
    if (!this.controls) return;

    // Reset exploded and section states
    if (mode !== 'explode') this.setExploded(false);
    if (mode !== 'section') this.setSection(false);
    if (mode !== 'thermal') this.setThermal(false);

    const d = window.state.shelterDesign;
    const targetY = 1.4;

    switch (mode) {
      case 'iso':
        this.camera.position.set(11, 7.5, 12);
        this.controls.target.set(0, targetY, 0);
        break;
      case 'front':
        this.camera.position.set(0, targetY + 0.5, 14);
        this.controls.target.set(0, targetY, 0);
        break;
      case 'top':
        this.camera.position.set(0, 16, 0.01);
        this.controls.target.set(0, 0, 0);
        break;
      case 'side':
        this.camera.position.set(14, targetY + 0.5, 0);
        this.controls.target.set(0, targetY, 0);
        break;
      case 'section':
        this.setSection(true);
        this.camera.position.set(10, 5, 8);
        this.controls.target.set(0, targetY, 0);
        break;
      case 'explode':
        this.setExploded(true);
        break;
      case 'reset':
        this.camera.position.set(11, 7.5, 12);
        this.controls.target.set(0, targetY, 0);
        break;
    }
    this.controls.update();
  }

  setExploded(state) {
    this.isExploded = state;
    const offset = state ? 2.2 : 0;

    if (this.meshes.north_wall) this.meshes.north_wall.position.z = -window.state.shelterDesign.width / 2 - offset;
    if (this.meshes.south_wall) this.meshes.south_wall.position.z = offset;
    if (this.meshes.window_s) this.meshes.window_s.position.z = window.state.shelterDesign.width / 2 + offset;
    if (this.meshes.door_d1) this.meshes.door_d1.position.z = window.state.shelterDesign.width / 2 + offset;
    if (this.meshes.east_wall) this.meshes.east_wall.position.x = window.state.shelterDesign.length / 2 + offset;
    if (this.meshes.west_wall) this.meshes.west_wall.position.x = -window.state.shelterDesign.length / 2 - offset;
    if (this.meshes.roof) this.meshes.roof.position.y = 0.35 + window.state.shelterDesign.height + 1.2 + (state ? 2.5 : 0);
  }

  setSection(state) {
    this.isSection = state;
    this.rebuildGeometry();
  }

  setThermal(state) {
    this.isThermal = state;
    if (state) {
      // Color envelope meshes with thermal heat loss false-color
      if (this.meshes.south_wall) {
        this.meshes.south_wall.traverse(c => {
          if (c.isMesh) c.material.color.setHex(0xf59e0b); // amber solar capture
        });
      }
      if (this.meshes.window_s) {
        this.meshes.window_s.material.color.setHex(0xfbbf24);
      }
      if (this.meshes.north_wall) {
        this.meshes.north_wall.material.color.setHex(0x38bdf8); // cold blue
      }
      if (this.meshes.roof) {
        this.meshes.roof.material.color.setHex(0xef4444); // heat loss roof
      }
    } else {
      this.rebuildGeometry();
    }
  }

  toggleSunPath() {
    this.sunPathVisible = !this.sunPathVisible;
    this.updateSunPath();
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.shelterGroup.children, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && !hit.userData.id && hit.parent !== this.shelterGroup) {
        hit = hit.parent;
      }
      if (hit && hit.userData.id) {
        window.state.selectComponent(hit.userData.id);
      }
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Global initialization helper
window.Shelter3D = Shelter3D;
