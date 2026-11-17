// Gini Raksha mask try-on.
// Draws the mask in 3D with Three.js and fits it to your face with Google's
// MediaPipe face tracking. Everything runs in the browser: camera frames and
// photos are never uploaded anywhere.
import * as THREE from 'three';
import { faceSVG, jawSVG, crownSVG, earSVG } from './mask-art.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const BRAND_URL = 'sunbirdtours.lk/mask';
const SHARE_TEXT = 'I tried on the Gini Raksha, Sri Lanka\'s fire demon mask. Try it:';

// Mask layout, in the face drawing's units (see mask-art.js). Origin = between the eyes.
const JAW_Y = -277;        // centre of the jaw piece when the mouth is closed
const JAW_DROP = 64;       // how far the jaw drops when the mouth is wide open
const HEADDRESS = 0.85;    // size of the crown and side flames compared with the face
const EYE_SPAN = 230;      // mask units between the outer corners of your eyes

const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('view'), video = $('cam');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageURL = new URL('./', location.href).href;
const track = (name) => { try { if (window.gtag) window.gtag('event', name); } catch (e) { /* analytics is optional */ } };

// ------------------------------------------------------------------ messages
let toastTimer = 0;
function showToast(msg, ms = 7000) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function hideToast() { $('toast').hidden = true; }
function showLoading(text) { $('loadingText').textContent = text; $('loading').hidden = false; }
function hideLoading() { $('loading').hidden = true; }
let hintText = '';
function setHint(text) { if (text !== hintText) { hintText = text; $('hint').textContent = text; } }

// ------------------------------------------------------------------ renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  showToast('This browser can\'t show 3D graphics, so the mask can\'t load here. Please try another browser.', 1e9);
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10000, 10000);

const U = { time: { value: 0 }, fire: { value: 0 } };

// Flames sway more the further they are from their base, and more when breathing fire.
function material(map, wobble) {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  if (wobble) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.uniforms.uFire = U.fire;
      sh.uniforms.uBase = { value: new THREE.Vector2(wobble.x, wobble.y) };
      sh.uniforms.uReach = { value: wobble.reach };
      sh.vertexShader = 'uniform float uTime;\nuniform float uFire;\nuniform vec2 uBase;\nuniform float uReach;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float k = clamp(length(position.xy - uBase) / uReach, 0.0, 1.0);
          k *= k;
          float amp = 7.0 + 14.0 * uFire;
          transformed.x += sin(uTime * 3.1 + position.y * 0.018 + position.x * 0.011) * amp * k;
          transformed.y += sin(uTime * 4.3 + position.x * 0.025) * amp * 0.5 * k;`);
    };
  }
  return m;
}

// The face and jaw bend back at the sides like a real carved mask.
const curve = (x, y) => -58 * (x / 200) ** 2 - 20 * (y / 300) ** 2;

function plane(map, w, h, x, y, z, { seg = [1, 1], curved = false, wobble = null, order = 0 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, seg[0], seg[1]);
  if (curved) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, curve(p.getX(i) + x, p.getY(i) + y));
  }
  const mesh = new THREE.Mesh(g, material(map, wobble));
  mesh.position.set(x, y, z);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  return mesh;
}

async function svgTexture(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,170,60,.9)');
  r.addColorStop(0.25, 'rgba(255,110,30,.35)');
  r.addColorStop(0.6, 'rgba(255,70,20,.07)');
  r.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ the mask
const mask = new THREE.Group();
mask.matrixAutoUpdate = false;
mask.visible = false;
scene.add(mask);
let jaw = null, glow = null, built = false;

async function buildMask() {
  const [faceT, jawT, crownT, earT] = await Promise.all(
    [faceSVG(2.5), jawSVG(2.5), crownSVG(2), earSVG(2)].map(svgTexture));

  glow = plane(glowTexture(), 1300, 1300, 0, 330, -80, { order: 0 });
  glow.material.blending = THREE.AdditiveBlending;
  glow.material.opacity = 0;
  mask.add(glow);

  // Crown: the base of the flames (crown y 690) sits behind the forehead (face y 120).
  const crown = plane(crownT, 700, 700, 0, 340 * HEADDRESS + 108, -60,
    { seg: [24, 24], wobble: { x: 0, y: -340, reach: 650 }, order: 1 });
  crown.scale.setScalar(HEADDRESS);
  mask.add(crown);

  // Side flames: the ear rosette (480×520 drawing, centre 380, 360) sits on the edge of the face.
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(192 * side, -8, -20);
    ear.rotation.y = 0.6 * side;
    ear.scale.setScalar(HEADDRESS);
    const m = plane(earT, 480, 520, 140 * side, 100, 0, { seg: [20, 20], wobble: { x: 140, y: -100, reach: 420 }, order: 2 });
    m.scale.x = -side;
    ear.add(m);
    mask.add(ear);
  }

  mask.add(plane(faceT, 400, 500, 0, -22, 0, { seg: [24, 30], curved: true, order: 3 }));
  jaw = plane(jawT, 400, 250, 0, JAW_Y, 3, { seg: [20, 12], curved: true, order: 4 });
  mask.add(jaw);
  built = true;
}

// ------------------------------------------------------------------ fire
const MAXP = 420;
const pPos = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 2);
const pSize = new Float32Array(MAXP), pLife = new Float32Array(MAXP).fill(1);
const pAge = new Float32Array(MAXP), pMax = new Float32Array(MAXP).fill(1);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('aLife', new THREE.BufferAttribute(pLife, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 1 } },
  vertexShader: `
    attribute float aSize; attribute float aLife; uniform float uScale; varying float vLife;
    void main() {
      vLife = aLife;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aLife >= 1.0 ? 0.0 : aSize * uScale * (1.0 - 0.45 * aLife);
    }`,
  fragmentShader: `
    varying float vLife;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float a = pow(1.0 - d, 1.8) * pow(1.0 - vLife, 1.2) * 0.85;
      vec3 hot = vec3(1.0, 0.96, 0.72), mid = vec3(1.0, 0.62, 0.12), cool = vec3(0.85, 0.12, 0.06);
      vec3 c = vLife < 0.35 ? mix(hot, mid, vLife / 0.35) : mix(mid, cool, (vLife - 0.35) / 0.65);
      gl_FragColor = vec4(c * a, a);
    }`,
  transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
points.renderOrder = 10;
scene.add(points);

const tmpV = new THREE.Vector3(), upV = new THREE.Vector3();
let pNext = 0;
function emit(s) {
  const i = pNext;
  pNext = (pNext + 1) % MAXP;
  let x, y;
  if (Math.random() < 0.8) { // from the top of the crown
    x = (Math.random() * 2 - 1) * 250 * HEADDRESS;
    y = 108 + (420 + Math.random() * 240 - Math.abs(x) * 0.5) * HEADDRESS;
  } else { // from the side flames
    x = (Math.random() < 0.5 ? -1 : 1) * (200 + (130 + Math.random() * 140) * HEADDRESS);
    y = 30 + Math.random() * 200 * HEADDRESS;
  }
  tmpV.set(x, y, -40).applyMatrix4(mask.matrix);
  upV.set(0, 1, 0).applyQuaternion(cur.quat);
  const speed = (240 + Math.random() * 300) * s;
  pPos[i * 3] = tmpV.x; pPos[i * 3 + 1] = tmpV.y; pPos[i * 3 + 2] = 0;
  pVel[i * 2] = upV.x * 0.5 * speed + (Math.random() - 0.5) * 120 * s;
  pVel[i * 2 + 1] = (0.5 + upV.y * 0.5) * speed;
  pSize[i] = (110 + Math.random() * 130) * s;
  pAge[i] = 0;
  pMax[i] = 0.5 + Math.random() * 0.5;
  pLife[i] = 0;
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    if (pLife[i] >= 1) continue;
    pAge[i] += dt;
    const life = pAge[i] / pMax[i];
    if (life >= 1) { pLife[i] = 1; continue; }
    pLife[i] = life;
    pPos[i * 3] += pVel[i * 2] * dt;
    pPos[i * 3 + 1] += pVel[i * 2 + 1] * dt;
    pVel[i * 2] *= 0.97;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.aSize.needsUpdate = true;
  pGeo.attributes.aLife.needsUpdate = true;
}

// ------------------------------------------------------------------ fitting the mask to a face
const cur = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1, ready: false };
const tgt = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), s: 1 };
const scaleV = new THREE.Vector3();

function applyPose(snap) {
  if (snap || !cur.ready) {
    cur.pos.copy(tgt.pos); cur.quat.copy(tgt.quat); cur.s = tgt.s; cur.ready = true;
  } else {
    // Smooth out jitter, but follow quick head movements straight away.
    const d = cur.pos.distanceTo(tgt.pos) / (cur.s * 60 + 1e-6);
    const a = Math.min(1, 0.45 + d * 0.6);
    cur.pos.lerp(tgt.pos, a);
    cur.quat.slerp(tgt.quat, a);
    cur.s += (tgt.s - cur.s) * a;
  }
  mask.matrix.compose(cur.pos, cur.quat, scaleV.setScalar(cur.s));
  mask.matrixWorldNeedsUpdate = true;
}

// Landmark numbers come from MediaPipe's face mesh: 33/263 outer eye corners,
// 133/362 inner eye corners, 10 top of the forehead, 152 chin.
const P = [0, 1, 2, 3].map(() => new THREE.Vector3());
const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3(), basis = new THREE.Matrix4();
function poseFromLandmarks(lm, w, h) {
  const at = (i, out) => out.set(lm[i].x * w, (1 - lm[i].y) * h, -lm[i].z * w);
  const e1 = at(33, P[0]), e2 = at(263, P[1]);
  ax.subVectors(e2, e1);
  const span = ax.length();
  ax.normalize();
  ay.subVectors(at(10, P[2]), at(152, P[3]));
  ay.addScaledVector(ax, -ay.dot(ax)).normalize();
  az.crossVectors(ax, ay);
  basis.makeBasis(ax, ay, az);
  tgt.quat.setFromRotationMatrix(basis);
  tgt.s = span / EYE_SPAN;
  tgt.pos.copy(e1).add(e2).add(at(133, P[2])).add(at(362, P[3])).multiplyScalar(0.25);
  tgt.pos.addScaledVector(az, 25 * tgt.s);
}
function jawFrom(res) {
  const cats = res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories;
  const c = cats && cats.find((x) => x.categoryName === 'jawOpen');
  return c ? c.score : 0;
}

// ------------------------------------------------------------------ view
// World units are image pixels (y up). The camera shows the part of the image
// that fits the screen: "cover" for the live camera, "contain" for photos.
// Photos are drawn on this background plane. The live camera is not: the <video>
// element shows it (mirrored with CSS) and the canvas on top only draws the mask.
const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
bg.renderOrder = -10;
bg.visible = false;
bg.frustumCulled = false;
scene.add(bg);
function setBackground(tex, w, h) {
  const old = bg.material.map;
  if (old && old !== tex) old.dispose();
  bg.material.map = tex || null;
  bg.material.needsUpdate = true;
  bg.visible = !!tex;
  if (tex) { bg.scale.set(w, h, 1); bg.position.set(w / 2, h / 2, -5000); }
}

let world = { w: 1, h: 1, fit: 'cover', mirror: false };
let viewK = 1, spot = { x: 0, y: 0, w: 1, h: 1 }, crop = { x: 0, y: 0, w: 1, h: 1 };
function setView(w, h, fit, mirror) { world = { w, h, fit, mirror }; layout(); }
function layout() {
  const cw = stage.clientWidth || 1, ch = stage.clientHeight || 1;
  renderer.setSize(cw, ch, false);
  if (stage.dataset.mode === 'intro') world = { w: cw, h: ch, fit: 'cover', mirror: false };
  const { w, h, fit, mirror } = world;
  const k = fit === 'cover' ? Math.max(cw / w, ch / h) : Math.min(cw / w, ch / h);
  const vw = cw / k, vh = ch / k, x0 = (w - vw) / 2, y0 = (h - vh) / 2;
  camera.left = mirror ? x0 + vw : x0;
  camera.right = mirror ? x0 : x0 + vw;
  camera.top = h - y0;
  camera.bottom = h - y0 - vh;
  camera.updateProjectionMatrix();
  viewK = k;
  crop = { x: x0, y: y0, w: vw, h: vh }; // visible part of the image (y down), same as CSS object-fit: cover
  pMat.uniforms.uScale.value = k * renderer.getPixelRatio();
  const r = $('maskSpot').getBoundingClientRect(), sr = stage.getBoundingClientRect();
  spot = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
}
window.addEventListener('resize', layout);

// ------------------------------------------------------------------ start screen preview
const eul = new THREE.Euler();
let jawRaw = 0, jawOpen = 0, fireAmt = 0, fireOn = false;
function idle(t) {
  // The whole mask spans about 1200 units tall (crown tip to tongue) and 1040 wide.
  const s = Math.max(0.05, Math.min((spot.h * 1.1) / 1100, spot.w / 1000));
  const cx = spot.x + spot.w / 2, cy = spot.y + spot.h / 2;
  tgt.pos.set(cx, world.h - cy - 170 * s, 0);
  const m = reduceMotion ? 0.3 : 1;
  tgt.quat.setFromEuler(eul.set(Math.sin(t * 0.45) * 0.07 * m, Math.sin(t * 0.6) * 0.4 * m, Math.sin(t * 0.5) * 0.05 * m));
  tgt.s = s;
  applyPose(true);
  const phase = t % 6.5;
  jawRaw = !reduceMotion && phase > 4 && phase < 5.8 ? 0.9 : 0;
  mask.visible = built;
}

// ------------------------------------------------------------------ face tracking
let landmarker = null, lmPromise = null, runningMode = 'VIDEO';
function loadLandmarker() {
  if (!lmPromise) {
    lmPromise = (async () => {
      const vision = await import(`${MP}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      const make = (delegate) => vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
      });
      try { landmarker = await make('GPU'); } catch (e) { landmarker = await make('CPU'); }
      runningMode = 'VIDEO';
      return landmarker;
    })();
    lmPromise.catch(() => { lmPromise = null; });
  }
  return lmPromise;
}
async function useMode(m) {
  if (runningMode !== m) { await landmarker.setOptions({ runningMode: m }); runningMode = m; }
}

let stream = null, lastVideoTime = -1, lastFaceAt = 0, firedOnce = false;
function trackFrame(now) {
  if (!landmarker || runningMode !== 'VIDEO' || video.readyState < 2) return;
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let res = null;
    try { res = landmarker.detectForVideo(video, now); } catch (e) { res = null; }
    const lm = res && res.faceLandmarks && res.faceLandmarks[0];
    if (lm) {
      poseFromLandmarks(lm, video.videoWidth, video.videoHeight);
      applyPose(!mask.visible);
      jawRaw = jawFrom(res);
      lastFaceAt = now;
      mask.visible = built;
    }
  }
  if (now - lastFaceAt > 400) { mask.visible = false; jawRaw = 0; }
  if (!mask.visible) setHint('Look at the camera');
  else if (!firedOnce) setHint('Open your mouth wide to breathe fire');
  else setHint('');
}

function cameraError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera access is blocked. Allow the camera for this website in your browser settings, or tap “Use a photo” instead.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'We couldn\'t find a camera on this device. Tap “Use a photo” instead.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Your camera is busy in another app. Close that app and try again.';
  return 'The face tracking couldn\'t load. Check your internet connection and try again.';
}

async function startCamera() {
  hideToast();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast(window.isSecureContext
      ? 'This browser can\'t open the camera. Tap “Use a photo” instead.'
      : 'The camera only works on a secure (https) page. Tap “Use a photo” instead.');
    return;
  }
  showLoading('Starting the camera…');
  try {
    const camP = navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
    const lmP = loadLandmarker();
    stream = await camP;
    showLoading('Loading face tracking…');
    await lmP;
    await useMode('VIDEO');
    video.srcObject = stream;
    await video.play();
    if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
    setBackground(null);
    enterLive('camera');
    setView(video.videoWidth, video.videoHeight, 'cover', true);
    track('mask_camera_start');
  } catch (e) {
    stopCamera();
    showToast(cameraError(e));
  } finally {
    hideLoading();
  }
}
// Phones can swap the camera's width and height when rotated.
video.addEventListener('resize', () => {
  if (stage.dataset.mode !== 'camera' || !video.videoWidth) return;
  setView(video.videoWidth, video.videoHeight, 'cover', true);
});
function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

// ------------------------------------------------------------------ photos
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
async function usePhoto(file) {
  hideToast();
  showLoading('Finding your face…');
  try {
    let img;
    try { img = await loadImage(file); } catch (e) { showToast('That photo couldn\'t be opened. Try a JPG or PNG photo.'); return; }
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    await loadLandmarker();
    await useMode('IMAGE');
    const res = landmarker.detect(c);
    stopCamera();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    setBackground(tex, c.width, c.height);
    enterLive('photo');
    setView(c.width, c.height, 'contain', false);
    const lm = res.faceLandmarks && res.faceLandmarks[0];
    if (lm) {
      poseFromLandmarks(lm, c.width, c.height);
      applyPose(true);
      jawRaw = jawFrom(res);
      mask.visible = built;
      setHint('Tap the flame for fire');
    } else {
      mask.visible = false;
      jawRaw = 0;
      setHint('');
      showToast('We couldn\'t find a face in that photo. Try one where your face is clear and looking at the camera.');
    }
    track('mask_photo_used');
  } catch (e) {
    showToast('The face tracking couldn\'t load. Check your internet connection and try again.');
  } finally {
    hideLoading();
  }
}

// ------------------------------------------------------------------ modes
function enterLive(mode) {
  stage.dataset.mode = mode;
  $('live').hidden = false;
  mask.visible = false;
  cur.ready = false;
  jawRaw = 0;
  firedOnce = false;
  setFire(false);
  clearFire();
  setHint('');
}
function exitLive() {
  stopCamera();
  stage.dataset.mode = 'intro';
  $('live').hidden = true;
  setBackground(null);
  setFire(false);
  clearFire();
  setHint('');
  hideToast();
  layout();
}
function setFire(on) {
  fireOn = on;
  $('fireBtn').setAttribute('aria-pressed', String(on));
}
// Sparks from the start-screen demo would otherwise drift over the camera view.
function clearFire() {
  pLife.fill(1);
  emitAcc = 0;
  fireAmt = 0;
  jawOpen = 0;
}

// ------------------------------------------------------------------ taking the photo
const logo = new Image();
logo.src = '../img/logo-white.png';

function copyCanvas(src) {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  out.getContext('2d').drawImage(src, 0, 0);
  return out;
}
function snapshot() {
  if (stage.dataset.mode === 'photo') {
    // Render the photo at its own size rather than the screen's.
    const pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(world.w, world.h, false);
    camera.left = 0; camera.right = world.w; camera.top = world.h; camera.bottom = 0;
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = 1;
    renderer.render(scene, camera);
    const out = copyCanvas(renderer.domElement);
    renderer.setPixelRatio(pr);
    layout();
    return out;
  }
  // Live camera: the video frame (mirrored, cropped like the screen) with the mask on top.
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext('2d');
  g.save();
  g.translate(out.width, 0);
  g.scale(-1, 1);
  g.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
  g.restore();
  g.drawImage(src, 0, 0);
  return out;
}
function brand(g, w, h) {
  const u = Math.min(w, h) / 100;
  const band = Math.max(60, u * 17);
  const grad = g.createLinearGradient(0, h - band * 1.7, 0, h);
  grad.addColorStop(0, 'rgba(7,27,32,0)');
  grad.addColorStop(1, 'rgba(7,27,32,.85)');
  g.fillStyle = grad;
  g.fillRect(0, h - band * 1.7, w, band * 1.7);
  const lh = band * 0.5, lw = (lh * 480) / 176, pad = Math.max(14, u * 4);
  if (logo.complete && logo.naturalWidth) g.drawImage(logo, pad, h - pad - lh, lw, lh);
  g.fillStyle = '#fff';
  g.font = `700 ${Math.round(lh * 0.4)}px Manrope, system-ui, sans-serif`;
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillText(BRAND_URL, w - pad, h - pad - lh * 0.24);
}
function flash() {
  if (reduceMotion) return;
  const f = document.createElement('div');
  f.className = 'flash';
  stage.appendChild(f);
  setTimeout(() => f.remove(), 400);
}

let resultURL = null, resultFile = null, saving = false;
async function takePhoto() {
  if (saving || $('result').open) return; // saving a big photo can take a moment on phones
  saving = true;
  const out = snapshot();
  brand(out.getContext('2d'), out.width, out.height);
  flash();
  const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
  saving = false;
  if (!blob) { showToast('Sorry, the photo couldn\'t be saved. Please try again.'); return; }
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = URL.createObjectURL(blob);
  resultFile = new File([blob], 'sunbird-gini-raksha.jpg', { type: 'image/jpeg' });
  $('resultImg').src = resultURL;
  $('saveBtn').href = resultURL;
  $('shareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [resultFile] }));
  $('result').showModal();
  track('mask_photo_taken');
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), emitAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  U.time.value = now / 1000;
  const mode = stage.dataset.mode;
  if (mode === 'intro') idle(now / 1000);
  else if (mode === 'camera') trackFrame(now);

  const open = Math.min(1, Math.max(0, (jawRaw - 0.08) / 0.42));
  jawOpen += (open - jawOpen) * Math.min(1, dt * 18);
  if (jaw) jaw.position.y = JAW_Y - jawOpen * JAW_DROP;

  const want = mask.visible && (fireOn || jawOpen > 0.55) ? 1 : 0;
  fireAmt += (want - fireAmt) * Math.min(1, dt * (want ? 8 : 3));
  if (fireAmt > 0.6 && mode === 'camera') firedOnce = true;
  U.fire.value = fireAmt;
  if (glow) glow.material.opacity = fireAmt * 0.7;
  if (mask.visible && fireAmt > 0.05) {
    emitAcc += fireAmt * 300 * dt;
    while (emitAcc >= 1) { emit(cur.s); emitAcc -= 1; }
  }
  updateParticles(dt);
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ buttons
$('startCam').addEventListener('click', startCamera);
$('pickPhoto').addEventListener('click', () => $('photoInput').click());
$('photoInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) usePhoto(file);
});
$('closeBtn').addEventListener('click', exitLive);
$('shutter').addEventListener('click', takePhoto);
$('fireBtn').addEventListener('click', () => setFire(!fireOn));
$('againBtn').addEventListener('click', () => $('result').close());
$('saveBtn').addEventListener('click', () => track('mask_photo_saved'));
$('shareBtn').addEventListener('click', async () => {
  try {
    await navigator.share({ files: [resultFile], text: `${SHARE_TEXT} ${pageURL}` });
    track('mask_photo_shared');
  } catch (e) { /* the person closed the share sheet */ }
});
$('aboutBtn').addEventListener('click', () => $('about').showModal());
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (e) => {
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside || e.target.hasAttribute('data-close')) d.close();
  });
}

layout();
requestAnimationFrame(frame);
buildMask().catch((e) => {
  console.error(e);
  showToast('The mask couldn\'t load. Please refresh the page.');
});
