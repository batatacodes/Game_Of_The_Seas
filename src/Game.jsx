import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/*
  Navegador de Odisseia - Game.jsx

  - Boat on an infinite ocean: objects spawn randomly in front and move toward the player.
  - Controls: Left / Center / Right (three lanes) + Front (brief boost).
  - Welcome modal is handled by App; this component waits for "started" prop.
  - Collision ends the run and shows restart modal.
  - Old objects fade out and are removed.
  - Mobile optimized: capped pixelRatio, low-poly geometry, no shadows.
*/

const LANES_X = [-3.2, 0, 3.2];
const SPAWN_AHEAD = 120; // initial spawn distance ahead
const SPAWN_INTERVAL = 2.2; // average distance between spawn events
const BASE_SPEED = 6.0; // how fast environment moves toward the boat
const SPEED_INCREASE = 0.0009; // increase per ms scaled
const OBJECT_LIFETIME = 20; // seconds max before forced removal (safety)

export default function Game({ started, onRequestStart }){
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const boatRef = useRef(null);
  const objectsRef = useRef([]); // active obstacles/objects
  const fadingRef = useRef([]); // objects fading
  const animRef = useRef(null);
  const lastRef = useRef(null);
  const speedRef = useRef(BASE_SPEED);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showOverModal, setShowOverModal] = useState(false);
  const laneTarget = useRef(1); // center
  const boostRef = useRef(false);
  const spawnCursor = useRef(10.0); // z position to place next spawn (positive ahead)
  const touchStartRef = useRef(null);

  useEffect(() => {
    if (started) {
      initScene();
    } else {
      // ensure we don't render before start
      cleanup();
    }
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function initScene(){
    // basic three setup
    const parent = mountRef.current;
    if (!parent) return;

    const width = parent.clientWidth || window.innerWidth;
    const height = parent.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x052833);
    scene.fog = new THREE.Fog(0x052833, 20, 240);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width/height, 0.1, 800);
    camera.position.set(0, 6.2, -12);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    parent.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights (very light)
    const hemi = new THREE.HemisphereLight(0xbfeaf5, 0x041426, 0.8);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.2);
    dir.position.set(5, 12, -5);
    scene.add(dir);

    // Ocean plane with simple vertex displacement shader
    const ocean = createOcean();
    ocean.rotation.x = -Math.PI/2;
    ocean.position.y = 0;
    scene.add(ocean);
    scene.userData.ocean = ocean;

    // Boat mesh (low poly)
    const boat = createBoatMesh();
    boat.position.set(LANES_X[1], 0.6, 0);
    scene.add(boat);
    boatRef.current = { mesh: boat, bbox: new THREE.Box3() };

    // initial spawn objects ahead
    objectsRef.current = [];
    fadingRef.current = [];
    spawnCursor.current = 8;
    for(let i=0;i<12;i++){
      spawnRandomObject(spawnCursor.current + i * SPAWN_INTERVAL * (0.6 + Math.random()*0.8));
    }

    // event listeners
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive:true });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive:true });

    // reset parameters
    speedRef.current = BASE_SPEED;
    distanceRef.current = 0;
    lastRef.current = performance.now();
    setDistance(0);
    setGameOver(false);
    setShowOverModal(false);

    // animate
    animRef.current = requestAnimationFrame(loop);
  }

  function cleanup(){
    cancelAnimationFrame(animRef.current);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeyDown);
    if(rendererRef.current && rendererRef.current.domElement){
      rendererRef.current.domElement.removeEventListener('touchstart', onTouchStart);
      rendererRef.current.domElement.removeEventListener('touchend', onTouchEnd);
    }

    const scene = sceneRef.current;
    if(scene){
      scene.traverse(o => {
        if(o.geometry) o.geometry.dispose?.();
        if(o.material){
          if(Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else o.material.dispose?.();
        }
      });
    }
    if(rendererRef.current && rendererRef.current.domElement && mountRef.current){
      mountRef.current.removeChild(rendererRef.current.domElement);
    }

    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    boatRef.current = null;
    objectsRef.current = [];
    fadingRef.current = [];
  }

  function createOcean(){
    // Plane with simple vertex displacement via shader for light waves
    const geom = new THREE.PlaneGeometry(1200, 1200, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x023a47) },
        uColor2: { value: new THREE.Color(0x0a6a7d) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          float f = sin((p.x + uTime*0.8)*0.12) * 0.25 + cos((p.y + uTime*0.6)*0.09) * 0.15;
          p.z += f;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1; uniform vec3 uColor2;
        varying vec2 vUv;
        void main(){
          vec3 c = mix(uColor1, uColor2, vUv.y);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      transparent: false
    });
    return new THREE.Mesh(geom, mat);
  }

  function createBoatMesh(){
    const group = new THREE.Group();
    // hull
    const hullGeo = new THREE.BoxGeometry(1.6, 0.5, 3.0);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xffc46b, roughness: 0.6 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.25;
    hull.rotation.x = 0.02;
    group.add(hull);
    // cabin
    const cabGeo = new THREE.BoxGeometry(1.0, 0.4, 0.8);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x103a5a, roughness: 0.6 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(0, 0.6, -0.2);
    group.add(cab);
    // simple mast / flag
    const mastGeo = new THREE.CylinderGeometry(0.03,0.03,0.7,6);
    const mast = new THREE.Mesh(mastGeo, hullMat);
    mast.position.set(0, 1.0, -0.6);
    group.add(mast);
    return group;
  }

  function spawnRandomObject(zPos){
    const scene = sceneRef.current;
    if(!scene) return;
    // choose a lane or free x
    const laneIndex = Math.floor(Math.random() * 3);
    const x = LANES_X[laneIndex] + (Math.random() - 0.5) * 1.0;
    const z = zPos + (Math.random() - 0.5) * 3.5;
    const t = Math.random();
    let mesh, bbox, type;
    if(t < 0.35){
      // small wreck (box)
      const g = new THREE.BoxGeometry(1.2, 0.6, 1.8);
      const m = new THREE.MeshStandardMaterial({ color: 0x6b2b2b, roughness: 0.9 });
      mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, 0.3, z);
      type = "wreck";
    } else if(t < 0.7){
      // floating log (capsule-like)
      const g = new THREE.CylinderGeometry(0.25,0.25,1.6,6);
      const m = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
      mesh = new THREE.Mesh(g, m);
      mesh.rotation.z = Math.random() * Math.PI;
      mesh.position.set(x, 0.2, z);
      type = "log";
    } else {
      // small islet (low cylinder with green top)
      const group = new THREE.Group();
      const base = new THREE.CylinderGeometry(1.4,1.6,0.3,10);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x5a3b2a, roughness: 1 });
      const soil = new THREE.Mesh(base, baseMat);
      soil.position.y = 0.15;
      group.add(soil);
      const top = new THREE.ConeGeometry(1.1,0.6,8);
      const topMat = new THREE.MeshStandardMaterial({ color: 0x18a35a, roughness: 0.9 });
      const grass = new THREE.Mesh(top, topMat);
      grass.position.y = 0.45;
      group.add(grass);
      group.position.set(x, 0, z);
      mesh = group;
      type = "islet";
    }

    mesh.userData = {
      born: performance.now(),
      type,
      opacity: 1.0
    };

    // compute bbox
    bbox = new THREE.Box3().setFromObject(mesh);

    scene.add(mesh);
    objectsRef.current.push({ mesh, bbox, type, born: performance.now() });
    // advance spawn cursor
    spawnCursor.current += SPAWN_INTERVAL * (0.8 + Math.random() * 1.6);
  }

  function onResize(){
    const parent = mountRef.current;
    if(!parent) return;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    const cam = cameraRef.current;
    const renderer = rendererRef.current;
    if(cam && renderer){
      cam.aspect = w/h;
      cam.updateProjectionMatrix();
      renderer.setSize(w,h);
    }
  }

  function onKeyDown(e){
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') laneTarget.current = Math.max(0, laneTarget.current - 1);
    if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') laneTarget.current = Math.min(2, laneTarget.current + 1);
    if(e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') doBoost();
    if(e.key === 'Enter' && showOverModal) restartGame();
  }

  function doBoost(){
    boostRef.current = true;
    // small burst and temporary speed bump
    speedRef.current += 2.6;
    setTimeout(()=>{ boostRef.current = false; }, 500);
  }

  function onTouchStart(e){
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
  }
  function onTouchEnd(e){
    const t = e.changedTouches[0];
    if(!touchStartRef.current) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.t;
    if(dt < 500 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)){
      if(dx < 0) laneTarget.current = Math.max(0, laneTarget.current - 1);
      else laneTarget.current = Math.min(2, laneTarget.current + 1);
    } else {
      // tap: left/right halves
      const w = window.innerWidth;
      if(t.clientX < w*0.4) laneTarget.current = Math.max(0, laneTarget.current - 1);
      else if(t.clientX > w*0.6) laneTarget.current = Math.min(2, laneTarget.current + 1);
      else doBoost();
    }
    touchStartRef.current = null;
  }

  function loop(now){
    animRef.current = requestAnimationFrame(loop);
    const last = lastRef.current || now;
    const dt = Math.min(0.05, (now - last) / 1000);
    lastRef.current = now;

    // gently increase baseline speed
    speedRef.current += SPEED_INCREASE * (now - last);

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const boat = boatRef.current;
    if(!scene || !camera || !renderer || !boat) return;

    // animate ocean shader time
    const ocean = scene.userData.ocean;
    if(ocean && ocean.material && ocean.material.uniforms) ocean.material.uniforms.uTime.value = now * 0.001;

    // boat gentle bobbing motion (floating)
    const bob = Math.sin(now * 0.0025) * 0.08;
    boat.mesh.position.y = 0.6 + bob;
    boat.mesh.rotation.z = Math.sin(now * 0.0018) * 0.03;

    // lateral smoothing toward lane
    const targetX = LANES_X[laneTarget.current];
    boat.mesh.position.x = THREE.MathUtils.lerp(boat.mesh.position.x, targetX, 0.16);

    // camera follows boat smoothly
    const camTarget = new THREE.Vector3(boat.mesh.position.x, boat.mesh.position.y + 6.2, boat.mesh.position.z - 12.0);
    camera.position.lerp(camTarget, 0.12);
    camera.lookAt(boat.mesh.position.x, boat.mesh.position.y + 0.8, boat.mesh.position.z + 8);

    // move objects toward the boat (simulate forward travel)
    const speed = speedRef.current * (boostRef.current ? 1.45 : 1.0);
    for(let i = objectsRef.current.length - 1; i >= 0; i--){
      const o = objectsRef.current[i];
      // some small lateral drift for variety
      if(o.mesh.position) o.mesh.position.z -= speed * dt;
      // update bbox
      o.bbox.setFromObject(o.mesh);
      // collision check: simple intersection with boat bbox
      boatRef.current.bbox.setFromObject(boat.mesh);
      if(boatRef.current.bbox.intersectsBox(o.bbox)){
        // collision -> game over
        onCollision();
        return;
      }
      // remove if far behind
      if(o.mesh.position.z < -20){
        // start fade and remove
        scene.remove(o.mesh);
        objectsRef.current.splice(i,1);
      }
      // safety lifetime removal
      if((now - o.born) / 1000 > OBJECT_LIFETIME){
        try{ scene.remove(o.mesh); }catch(e){}
        objectsRef.current.splice(i,1);
      }
    }

    // spawn new objects when needed ahead
    // keep spawnCursor ahead of furthest object's z or boat
    const maxObjZ = Math.max(spawnCursor.current, ...objectsRef.current.map(o => o.mesh.position.z), boat.mesh.position.z + 8);
    if(objectsRef.current.length < 18 || spawnCursor.current < boat.mesh.position.z + SPAWN_AHEAD){
      spawnRandomObject(spawnCursor.current + 6 + Math.random() * 20);
    }

    // update distance HUD
    distanceRef.current += speed * dt * 0.6;
    const distInt = Math.floor(distanceRef.current);
    setDistance(distInt);

    // render
    renderer.render(scene, camera);
  }

  function onCollision(){
    if(gameOver) return;
    setGameOver(true);
    setShowOverModal(true);
    // stop loop
    cancelAnimationFrame(animRef.current);
  }

  function restartGame(){
    // clear scene and re-init
    setGameOver(false);
    setShowOverModal(false);
    cleanup();
    // small delay to ensure cleanup finished
    setTimeout(() => {
      // ensure App started is true; if not, request start
      if(!started && onRequestStart) onRequestStart();
      initScene();
    }, 120);
  }

  // UI controls
  return (
    <div ref={mountRef} style={{width:'100%', height:'100%', position:'relative'}}>
      <div className="hud" aria-hidden>
        <div className="badge">Dist: {distance}</div>
        <div className="badge">Vel: {Math.round(speedRef.current * 10) / 10}</div>
      </div>

      <div className="top-right">
        <div className="info">Objetos: {objectsRef.current.length}</div>
      </div>

      <div className="controls" role="toolbar" aria-label="Controles do jogo">
        <div className="ctrl-btn" onPointerDown={() => laneTarget.current = Math.max(0, laneTarget.current - 1)}>⟵</div>
        <div className="ctrl-btn" onPointerDown={() => { laneTarget.current = 1; }}>CENTRO</div>
        <div className="ctrl-btn" onPointerDown={() => laneTarget.current = Math.min(2, laneTarget.current + 1)}>⟶</div>
        <div className="ctrl-btn" onPointerDown={() => doBoost()}>FRENTE</div>
      </div>

      {showOverModal && (
        <div className="modal-bg" role="dialog" aria-modal="true">
          <div className="modal">
            <h1>Você deseja continuar?</h1>
            <p>Sua distância: <strong>{distance}</strong></p>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => restartGame()}>Sim</button>
              <button className="btn btn-ghost" onClick={() => { setShowOverModal(false); }}>Não</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}