import * as THREE from './vendor/three.module.js';

const geometries = new Set();
const materials = new Set();
const textures = new Set();
const palette = { dark: '#20262e', metal: '#bfc8d1', gold: '#edb775', teal: '#78cfb2', blue: '#83b4ee', green: '#b9d68d' };

function material(color, options = {}) {
  const value = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.27, ...options });
  materials.add(value);
  return value;
}

function basic(color, options = {}) {
  const value = new THREE.MeshBasicMaterial({ color, ...options });
  materials.add(value);
  return value;
}

function mesh(parent, geometry, surface, position = [0, 0, 0]) {
  geometries.add(geometry);
  const value = new THREE.Mesh(geometry, surface);
  value.position.set(...position);
  parent.add(value);
  return value;
}

function box(parent, size, surface, position, bevel = 0.035) {
  const [width, height, depth] = size;
  const edge = Math.min(bevel, width / 5, height / 5, depth / 3);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + edge, -height / 2 + edge);
  shape.lineTo(width / 2 - edge, -height / 2 + edge);
  shape.lineTo(width / 2 - edge, height / 2 - edge);
  shape.lineTo(-width / 2 + edge, height / 2 - edge);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - edge * 2, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: edge, bevelThickness: edge, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2 + edge);
  return mesh(parent, geometry, surface, position);
}

function sphere(parent, radius, surface, position, segments = 64) {
  return mesh(parent, new THREE.SphereGeometry(radius, segments, Math.floor(segments * 0.65)), surface, position);
}

function ring(parent, radius, tube, surface, position = [0, 0, 0], arc = Math.PI * 2) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 12, 144, arc), surface, position);
}

function line(parent, points, radius, surface) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, 64, radius, 8, false), surface);
}

function texture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const value = new THREE.CanvasTexture(canvas);
  value.colorSpace = THREE.SRGBColorSpace;
  textures.add(value);
  return value;
}

function label(text, foreground = '#e9e8e1', background = '#171d25') {
  return texture((context, width, height) => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = foreground;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 76px monospace';
    context.fillText(text, width / 2, height / 2);
    context.strokeStyle = foreground;
    context.globalAlpha = 0.22;
    context.lineWidth = 3;
    context.strokeRect(22, 22, width - 44, height - 44);
  }, 512, 256);
}

function planetTexture() {
  return texture((context, width, height) => {
    context.fillStyle = '#224e62';
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 42; index++) {
      const x = (Math.sin(index * 17.13) * 0.5 + 0.5) * width;
      const y = (Math.cos(index * 8.73) * 0.5 + 0.5) * height;
      context.fillStyle = ['#769a5a', '#a7b977', '#4c8058'][index % 3];
      context.beginPath();
      context.ellipse(x, y, 28 + index % 7 * 13, 18 + index % 5 * 10, index * 0.41, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 0.2;
    context.fillStyle = '#d5e0c8';
    for (let index = 0; index < 20; index++) {
      context.beginPath();
      context.ellipse(index * 81 % width, index * 53 % height, 100, 6, 0.2, 0, Math.PI * 2);
      context.fill();
    }
  }, 1024, 512);
}

function solarProbe(parent, position, scale = 1) {
  const probe = new THREE.Group();
  parent.add(probe);
  probe.position.set(...position);
  probe.scale.setScalar(scale);
  box(probe, [0.22, 0.32, 0.25], material(palette.gold), [0, 0, 0]);
  const panel = material('#24477a', { metalness: 0.7, roughness: 0.18 });
  for (const direction of [-1, 1]) {
    box(probe, [0.52, 0.3, 0.025], panel, [direction * 0.38, 0, 0]);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
      box(probe, [0.095, 0.065, 0.006], material('#4779bb'), [direction * 0.38 - 0.18 + column * 0.12, -0.1 + row * 0.1, 0.018], 0.002);
    }
  }
  const dish = sphere(probe, 0.15, material(palette.metal), [0, 0.25, 0]);
  dish.scale.z = 0.28;
  line(probe, [[0, 0.15, 0], [0, 0.33, 0], [0.02, 0.38, 0.1]], 0.008, material(palette.metal));
  return probe;
}

function makeAstro() {
  const group = new THREE.Group();
  sphere(group, 0.57, basic('#030405'), [0, 0, 0], 96);
  const halo = ring(group, 0.64, 0.012, basic('#ffe3b1'));
  halo.rotation.x = 0.13;
  const diskMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform float time; void main(){vec2 p=vUv-0.5;float r=length(p);float a=atan(p.y,p.x);float bands=0.72+0.18*sin(r*220.0+a*5.0-time*1.4)+0.1*sin(a*38.0-r*95.0+time);float inner=1.0-smoothstep(0.31,0.51,r);vec3 col=mix(vec3(0.94,0.3,0.08),vec3(1.0,0.94,0.73),pow(inner,0.6));float alpha=smoothstep(0.3,0.32,r)*(1.0-smoothstep(0.45,0.5,r));gl_FragColor=vec4(col*bands,alpha*0.95);}',
  });
  materials.add(diskMaterial);
  const disk = mesh(group, new THREE.RingGeometry(0.68, 1.12, 256, 4), diskMaterial);
  disk.rotation.x = 1.09;
  disk.rotation.z = -0.12;
  ring(group, 0.72, 0.015, basic('#f4bc78')).rotation.x = 1.09;
  const planet = sphere(group, 0.22, material('#6998ce', { roughness: 0.5, metalness: 0.12 }), [-1.13, 0.74, -0.25], 64);
  ring(group, 0.3, 0.012, material(palette.gold), [-1.13, 0.74, -0.25]).rotation.x = 1.1;
  const probe = solarProbe(group, [1.0, -0.54, 0.1], 0.66);
  probe.rotation.set(0.16, -0.25, -0.3);
  return { group, rotation: [0.05, -0.12, -0.08], animate(time) { diskMaterial.uniforms.time.value = time; planet.rotation.y = time * 0.08; probe.position.y = -0.54 + Math.sin(time * 0.7) * 0.06; } };
}

function makeChip() {
  const group = new THREE.Group();
  const board = material('#224b40', { roughness: 0.43, metalness: 0.2 });
  const gold = material(palette.gold, { roughness: 0.22, metalness: 0.85 });
  box(group, [2.05, 1.44, 0.075], board, [0, 0, -0.16]);
  const processor = new THREE.Group();
  group.add(processor);
  box(processor, [1.02, 0.9, 0.18], material('#252a33'), [0, 0, 0.08]);
  box(processor, [0.88, 0.76, 0.024], material('#353c46', { roughness: 0.35 }), [0, 0, 0.19], 0.008);
  mesh(processor, new THREE.PlaneGeometry(0.68, 0.34), basic('#ffffff', { map: label('i8080', '#d3c2a5', '#353c46') }), [0, 0.04, 0.207]);
  for (const direction of [-1, 1]) for (let index = 0; index < 9; index++) {
    box(processor, [0.27, 0.052, 0.048], gold, [direction * 0.62, -0.36 + index * 0.09, -0.02], 0.008);
    const y = -0.36 + index * 0.09;
    line(group, [[direction * 0.73, y, -0.112], [direction * 0.86, y, -0.112], [direction * 0.96, y + 0.08, -0.112]], 0.008, gold);
  }
  for (const direction of [-1, 1]) {
    sphere(group, 0.038, gold, [direction * 0.9, 0.58, -0.1], 24);
    sphere(group, 0.038, gold, [direction * 0.9, -0.58, -0.1], 24);
  }
  for (let index = 0; index < 4; index++) {
    const capacitor = mesh(group, new THREE.CylinderGeometry(0.068, 0.068, 0.13, 48), material('#668598'), [-0.7 + index * 0.46, 0.59, -0.02]);
    capacitor.rotation.x = Math.PI / 2;
    box(group, [0.18, 0.06, 0.048], gold, [-0.72 + index * 0.47, -0.59, -0.07], 0.009);
  }
  return { group, rotation: [0.38, -0.35, -0.15], animate(time) { processor.position.z = 0.035 + Math.sin(time * 0.65) * 0.025; } };
}

function makeHush() {
  const group = new THREE.Group();
  const dark = material(palette.dark, { metalness: 0.8 });
  const silver = material(palette.metal, { metalness: 0.85, roughness: 0.19 });
  const laptop = new THREE.Group();
  group.add(laptop);
  laptop.position.set(-0.5, -0.12, -0.18);
  laptop.rotation.y = 0.2;
  const base = box(laptop, [1.22, 0.71, 0.08], silver, [0, -0.48, 0.36]);
  base.rotation.x = -Math.PI / 2;
  for (let row = 0; row < 3; row++) for (let column = 0; column < 9; column++) {
    const key = box(laptop, [0.095, 0.06, 0.014], dark, [-0.47 + column * 0.117, -0.43, 0.2 + row * 0.115], 0.004);
    key.rotation.x = -Math.PI / 2;
  }
  const hinge = new THREE.Group();
  laptop.add(hinge);
  hinge.position.y = -0.43;
  box(hinge, [1.22, 0.8, 0.07], dark, [0, 0.4, 0]);
  const screenTexture = texture((context, width, height) => {
    context.fillStyle = '#132c29'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#83d3b5'; context.font = 'bold 44px sans-serif'; context.fillText('HushDrop', 32, 65);
    context.strokeStyle = '#83d3b5'; context.lineWidth = 5; context.strokeRect(184, 121, 138, 101);
    context.fillStyle = '#83d3b5'; context.fillRect(184, 109, 65, 19);
    context.fillStyle = '#365750'; context.fillRect(64, 283, 384, 15);
    context.fillStyle = '#83d3b5'; context.fillRect(64, 283, 287, 15);
  }, 512, 320);
  mesh(hinge, new THREE.PlaneGeometry(1.1, 0.67), basic('#ffffff', { map: screenTexture }), [0, 0.4, 0.04]);
  const phone = new THREE.Group();
  group.add(phone);
  phone.position.set(0.91, -0.07, 0.29);
  phone.rotation.set(-0.07, -0.3, -0.08);
  box(phone, [0.53, 1.01, 0.095], silver, [0, 0, 0]);
  box(phone, [0.47, 0.92, 0.008], material('#14312b'), [0, 0, 0.054], 0.003);
  mesh(phone, new THREE.PlaneGeometry(0.37, 0.27), basic('#ffffff', { map: label('LAN', '#8ad7b8', '#14312b') }), [0, 0.12, 0.061]);
  box(phone, [0.12, 0.018, 0.008], dark, [0, 0.43, 0.064], 0.003);
  box(phone, [0.16, 0.012, 0.008], silver, [0, -0.4, 0.064], 0.003);
  const files = [];
  for (let index = 0; index < 3; index++) {
    const file = new THREE.Group(); group.add(file); files.push(file);
    box(file, [0.22, 0.28, 0.035], material(['#86d7b5', '#9fc8ee', '#e7bc85'][index]), [0, 0, 0], 0.009);
    for (let row = 0; row < 3; row++) box(file, [0.13, 0.012, 0.004], basic('#315647'), [0, 0.065 - row * 0.055, 0.021], 0.002);
  }
  return { group, rotation: [0.12, -0.05, -0.04], animate(time) { hinge.rotation.x = -0.1 + Math.sin(time * 0.6) * 0.025; files.forEach((file, index) => { const progress = (time * 0.13 + index / 3) % 1; file.position.set(-0.03 + progress * 0.48, 0.34 + Math.sin(progress * Math.PI) * 0.35, 0.25); file.rotation.z = -0.12 + progress * 0.3; }); } };
}

function makeVoice() {
  const group = new THREE.Group();
  const silver = material('#c5cdd4', { metalness: 0.88, roughness: 0.21 });
  const gold = material(palette.gold, { metalness: 0.8, roughness: 0.22 });
  const dark = material('#242833');
  const microphone = new THREE.Group(); group.add(microphone); microphone.position.set(-0.42, 0.03, 0.24); microphone.rotation.z = -0.12;
  const profile = [[0, -0.24], [0.15, -0.24], [0.2, -0.2], [0.22, -0.12], [0.22, 0.28], [0.2, 0.39], [0.14, 0.47], [0, 0.49]].map(point => new THREE.Vector2(...point));
  mesh(microphone, new THREE.LatheGeometry(profile, 96), silver, [0, 0.16, 0]);
  for (let index = 0; index < 10; index++) ring(microphone, 0.224, 0.008, dark, [0, 0.06 + index * 0.043, 0]).rotation.x = Math.PI / 2;
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2;
    line(microphone, [[Math.cos(angle) * 0.219, -0.01, Math.sin(angle) * 0.219], [Math.cos(angle) * 0.224, 0.27, Math.sin(angle) * 0.224], [Math.cos(angle) * 0.17, 0.57, Math.sin(angle) * 0.17]], 0.006, dark);
  }
  const collar = mesh(microphone, new THREE.CylinderGeometry(0.23, 0.23, 0.095, 64), gold, [0, -0.04, 0]);
  collar.rotation.z = 0;
  mesh(microphone, new THREE.CylinderGeometry(0.065, 0.065, 0.5, 64), silver, [0, -0.47, 0]);
  const foot = mesh(microphone, new THREE.CylinderGeometry(0.36, 0.4, 0.075, 96), dark, [0, -0.77, 0]);
  ring(microphone, 0.34, 0.017, gold, [0, -0.73, 0]).rotation.x = Math.PI / 2;
  foot.rotation.y = 0.2;
  const book = new THREE.Group(); group.add(book); book.position.set(0.62, 0.04, -0.17); book.rotation.set(0.12, -0.28, 0.12);
  box(book, [0.78, 1.02, 0.18], material('#586ba0'), [0, 0, 0]);
  box(book, [0.69, 0.92, 0.14], material('#d8d1bd', { metalness: 0, roughness: 0.7 }), [0.04, 0, 0.01]);
  box(book, [0.78, 1.02, 0.023], material('#607db0'), [0, 0, 0.11], 0.006);
  mesh(book, new THREE.PlaneGeometry(0.54, 0.27), basic('#ffffff', { map: label('M4B', '#e7dfcc', '#607db0') }), [0.03, 0.16, 0.126]);
  for (let index = 0; index < 9; index++) line(book, [[0.39, -0.43 + index * 0.1, -0.04], [0.39, -0.43 + index * 0.1, 0.08]], 0.003, material('#aba590'));
  const bars = [];
  for (let index = 0; index < 15; index++) bars.push(box(group, [0.06, 0.25 + Math.abs(Math.sin(index * 0.8)) * 0.27, 0.055], gold, [-0.78 + index * 0.112, -0.91, 0.54], 0.014));
  return { group, rotation: [0.08, -0.15, 0.02], animate(time) { bars.forEach((bar, index) => { bar.scale.y = 0.75 + Math.sin(time * 2.1 + index * 0.65) * 0.24; }); microphone.rotation.z = -0.12 + Math.sin(time * 0.6) * 0.018; } };
}

function makeDevops() {
  const group = new THREE.Group();
  const dark = material('#35414d', { metalness: 0.75 });
  const silver = material('#9dafbf', { metalness: 0.87, roughness: 0.21 });
  const leds = [];
  for (let index = 0; index < 3; index++) {
    const y = -0.51 + index * 0.43;
    box(group, [1.43, 0.35, 0.62], dark, [-0.29, y, 0]);
    box(group, [1.35, 0.27, 0.025], silver, [-0.29, y, 0.327], 0.007);
    for (let vent = 0; vent < 11; vent++) box(group, [0.024, 0.15, 0.016], material('#26323d'), [-0.82 + vent * 0.049, y, 0.352], 0.004);
    for (let light = 0; light < 3; light++) leds.push(sphere(group, 0.025, basic(light === 0 ? '#a1dfb5' : '#73b4db'), [0.04 + light * 0.075, y, 0.36], 24));
    for (const side of [-1, 1]) sphere(group, 0.019, material('#d2dbe1'), [-0.29 + side * 0.64, y - 0.094, 0.355], 16);
  }
  const cloud = new THREE.Group(); group.add(cloud); cloud.position.set(0.76, 0.34, -0.01);
  const shell = new THREE.BoxGeometry(0.57, 0.57, 0.57); geometries.add(shell);
  const wireGeometry = new THREE.EdgesGeometry(shell); geometries.add(wireGeometry);
  const wireMaterial = new THREE.LineBasicMaterial({ color: palette.teal }); materials.add(wireMaterial);
  cloud.add(new THREE.LineSegments(wireGeometry, wireMaterial));
  sphere(cloud, 0.13, material(palette.teal, { metalness: 0.5 }), [0, 0, 0], 48);
  line(group, [[0.37, -0.48, 0.22], [0.83, -0.42, 0.12], [0.76, 0.12, 0.1]], 0.012, material(palette.teal));
  const database = new THREE.Group(); group.add(database); database.position.set(0.75, -0.48, 0.28);
  for (let index = 0; index < 3; index++) mesh(database, new THREE.CylinderGeometry(0.2, 0.2, 0.085, 64), material('#5b8b94'), [0, index * 0.105, 0]);
  return { group, rotation: [0.17, -0.35, -0.04], animate(time) { cloud.rotation.y = time * 0.22; cloud.rotation.x = Math.sin(time * 0.5) * 0.13; leds.forEach((led, index) => { led.material.color.set(index % 3 === 0 ? '#a1dfb5' : '#73b4db'); led.scale.setScalar(1 + Math.sin(time * 1.9 + index) * 0.08); }); } };
}

function makeTrade() {
  const group = new THREE.Group();
  const cardboard = material('#c18e5b', { metalness: 0.05, roughness: 0.66 });
  const tape = material('#e3c696', { metalness: 0.08, roughness: 0.45 });
  const crate = new THREE.Group(); group.add(crate); crate.position.set(-0.56, -0.34, 0.12); crate.rotation.y = 0.28;
  box(crate, [0.88, 0.68, 0.68], cardboard, [0, 0, 0]);
  box(crate, [0.13, 0.7, 0.016], tape, [0, 0, 0.352], 0.004);
  const topTape = box(crate, [0.13, 0.69, 0.016], tape, [0, 0.35, 0]); topTape.rotation.x = Math.PI / 2;
  const barcode = texture((context, width, height) => {
    context.fillStyle = '#f0e9d7'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#30333a';
    for (let index = 0; index < 45; index++) context.fillRect(25 + index * 5, 24, index % 3 === 0 ? 4 : 2, 104);
    context.font = '20px monospace'; context.textAlign = 'center'; context.fillText('TELEPORT', width / 2, 158);
  }, 256, 180);
  mesh(crate, new THREE.PlaneGeometry(0.31, 0.21), basic('#ffffff', { map: barcode }), [-0.23, -0.06, 0.366]);
  const terminal = new THREE.Group(); group.add(terminal); terminal.position.set(0.52, 0.05, 0.24); terminal.rotation.set(-0.06, -0.25, 0.13);
  box(terminal, [0.6, 1.1, 0.11], material('#456782'), [0, 0, 0]);
  box(terminal, [0.49, 0.43, 0.016], material('#163b4b'), [0, 0.23, 0.067], 0.005);
  mesh(terminal, new THREE.PlaneGeometry(0.37, 0.17), basic('#ffffff', { map: label('SHOP', '#a6d2df', '#163b4b') }), [0, 0.23, 0.079]);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) box(terminal, [0.105, 0.092, 0.027], material(row === 2 && column === 2 ? palette.teal : '#9fb5c1'), [-0.15 + column * 0.15, -0.06 - row * 0.145, 0.079], 0.012);
  const resistor = new THREE.Group(); group.add(resistor); resistor.position.set(-0.44, 0.58, 0.03); resistor.rotation.z = -0.23;
  const body = mesh(resistor, new THREE.CylinderGeometry(0.095, 0.095, 0.38, 64), material('#d3b485')); body.rotation.z = Math.PI / 2;
  for (let index = 0; index < 3; index++) ring(resistor, 0.096, 0.017, material(['#855228', '#191f27', '#c8784e'][index]), [-0.11 + index * 0.11, 0, 0]).rotation.y = Math.PI / 2;
  line(resistor, [[-0.52, -0.1, 0], [-0.34, 0, 0], [-0.18, 0, 0]], 0.012, material(palette.metal));
  line(resistor, [[0.18, 0, 0], [0.34, 0, 0], [0.5, 0.12, 0]], 0.012, material(palette.metal));
  return { group, rotation: [0.16, -0.21, 0.02], animate(time) { resistor.position.y = 0.58 + Math.sin(time * 0.8) * 0.055; } };
}

function makeNamaz() {
  const group = new THREE.Group();
  const gold = material('#ddc088', { metalness: 0.86, roughness: 0.2 });
  const dark = material('#263e37', { metalness: 0.35, roughness: 0.45 });
  const compass = new THREE.Group(); group.add(compass); compass.position.set(-0.24, -0.01, 0.13);
  const body = mesh(compass, new THREE.CylinderGeometry(0.61, 0.61, 0.12, 128), dark); body.rotation.x = Math.PI / 2;
  ring(compass, 0.57, 0.046, gold, [0, 0, 0.079]);
  const dial = texture((context, width, height) => {
    context.fillStyle = '#193b33'; context.fillRect(0, 0, width, height);
    context.translate(width / 2, height / 2); context.strokeStyle = '#cbd8b4';
    for (let index = 0; index < 72; index++) { const angle = index / 72 * Math.PI * 2; const radius = index % 6 === 0 ? 174 : 185; context.lineWidth = index % 6 === 0 ? 3 : 1; context.beginPath(); context.moveTo(Math.sin(angle) * radius, -Math.cos(angle) * radius); context.lineTo(Math.sin(angle) * 198, -Math.cos(angle) * 198); context.stroke(); }
    context.fillStyle = '#d9dfbb'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = 'bold 34px serif';
    [['N', 0, -146], ['E', 146, 0], ['S', 0, 146], ['W', -146, 0]].forEach(([text, x, y]) => context.fillText(text, x, y));
    context.globalAlpha = 0.25; context.beginPath(); context.arc(0, 0, 118, 0, Math.PI * 2); context.stroke();
  });
  mesh(compass, new THREE.CircleGeometry(0.53, 128), basic('#ffffff', { map: dial }), [0, 0, 0.066]);
  const needle = new THREE.Group(); compass.add(needle); needle.position.z = 0.09;
  const arrow = new THREE.Shape(); arrow.moveTo(0, 0.42); arrow.lineTo(0.085, 0); arrow.lineTo(0, -0.04); arrow.lineTo(-0.085, 0); arrow.closePath();
  mesh(needle, new THREE.ExtrudeGeometry(arrow, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }), material('#d0dcab'));
  const south = mesh(needle, new THREE.ExtrudeGeometry(arrow, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 }), gold); south.rotation.z = Math.PI;
  sphere(compass, 0.055, gold, [0, 0, 0.12], 48);
  const clock = new THREE.Group(); group.add(clock); clock.position.set(0.64, 0.48, -0.1); clock.scale.setScalar(0.67);
  const clockBody = mesh(clock, new THREE.CylinderGeometry(0.45, 0.45, 0.08, 96), gold); clockBody.rotation.x = Math.PI / 2;
  mesh(clock, new THREE.CircleGeometry(0.38, 96), material('#e2dec8', { metalness: 0.03, roughness: 0.5 }), [0, 0, 0.047]);
  for (let index = 0; index < 12; index++) { const angle = index / 12 * Math.PI * 2; const tick = box(clock, [0.014, 0.045, 0.006], dark, [Math.sin(angle) * 0.32, Math.cos(angle) * 0.32, 0.06], 0.002); tick.rotation.z = -angle; }
  const hour = box(clock, [0.03, 0.18, 0.015], dark, [0.04, 0.055, 0.068], 0.005); hour.rotation.z = -0.62;
  const minute = box(clock, [0.021, 0.24, 0.015], dark, [-0.065, 0.055, 0.07], 0.004); minute.rotation.z = 0.9;
  ring(compass, 0.13, 0.025, gold, [0, 0.71, 0]);
  return { group, rotation: [0.23, -0.23, -0.12], animate(time) { needle.rotation.z = -0.52 + Math.sin(time * 0.6) * 0.12; } };
}

function makeEden() {
  const group = new THREE.Group();
  const planet = new THREE.Group(); group.add(planet); planet.position.set(-0.27, 0.02, 0);
  sphere(planet, 0.69, material('#ffffff', { map: planetTexture(), metalness: 0.08, roughness: 0.58 }), [0, 0, 0], 96);
  ring(group, 0.89, 0.012, material(palette.green), [-0.27, 0.02, 0]).rotation.set(1.09, 0.15, -0.21);
  const bark = material('#8e7352', { roughness: 0.72, metalness: 0.03 });
  const foliage = material('#a9cc8a', { roughness: 0.56, metalness: 0.08 });
  for (const [x, y, z] of [[0.17, 0.58, 0.37], [-0.35, 0.56, 0.24], [0.43, 0.41, 0.37]]) {
    const direction = new THREE.Vector3(x, y, z).normalize(); const tree = new THREE.Group(); planet.add(tree); tree.position.copy(direction.clone().multiplyScalar(0.68)); tree.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    mesh(tree, new THREE.CylinderGeometry(0.024, 0.038, 0.25, 32), bark, [0, 0.1, 0]);
    sphere(tree, 0.13, foliage, [0, 0.24, 0], 48);
    sphere(tree, 0.085, material('#7da766', { roughness: 0.6 }), [0.07, 0.21, 0.01], 40);
  }
  const dna = new THREE.Group(); group.add(dna); dna.position.set(0.95, 0.1, 0.2); dna.rotation.z = -0.14;
  const first = [], second = [];
  for (let index = 0; index <= 64; index++) { const phase = index / 64 * Math.PI * 3; const y = -0.7 + index / 64 * 1.4; first.push([Math.cos(phase) * 0.18, y, Math.sin(phase) * 0.18]); second.push([-Math.cos(phase) * 0.18, y, -Math.sin(phase) * 0.18]); }
  line(dna, first, 0.024, material('#99c9c4')); line(dna, second, 0.024, material(palette.gold));
  for (let index = 0; index < 13; index++) { const phase = index / 12 * Math.PI * 3; const y = -0.7 + index / 12 * 1.4; line(dna, [[Math.cos(phase) * 0.18, y, Math.sin(phase) * 0.18], [-Math.cos(phase) * 0.18, y, -Math.sin(phase) * 0.18]], 0.012, material('#d7dfb7')); }
  const probe = solarProbe(group, [-1.18, -0.54, 0.18], 0.38); probe.rotation.set(0.2, -0.2, -0.25);
  return { group, rotation: [0.03, -0.05, 0.04], animate(time) { planet.rotation.y = time * 0.09; dna.rotation.y = time * 0.2; probe.position.y = -0.54 + Math.sin(time * 0.75) * 0.045; } };
}

function starShape(radius, waist, points = 4) {
  const shape = new THREE.Shape();
  for (let index = 0; index < points; index++) {
    const start = index / points * Math.PI * 2 - Math.PI / 2;
    const next = start + Math.PI / points;
    const outer = [Math.cos(start) * radius, Math.sin(start) * radius];
    const control = [Math.cos(next) * waist, Math.sin(next) * waist];
    const target = [Math.cos(next + Math.PI / points) * radius, Math.sin(next + Math.PI / points) * radius];
    if (!index) shape.moveTo(...outer);
    else shape.lineTo(...outer);
    shape.quadraticCurveTo(...control, ...target);
  }
  shape.closePath();
  return shape;
}

function makeCycle() {
  const group = new THREE.Group();
  const silver = material(palette.metal, { metalness: 0.9, roughness: 0.17 });
  const accent = material('#ff7a45', { metalness: 0.85, roughness: 0.26 });
  const teal = material(palette.teal, { metalness: 0.5, roughness: 0.3, emissive: '#1d5c48', emissiveIntensity: 0.4 });
  const grey = material('#707a86', { metalness: 0.75, roughness: 0.33 });

  const orbit = new THREE.Group(); group.add(orbit);
  orbit.rotation.set(1.12, 0, -0.24);
  ring(orbit, 1, 0.022, silver);
  const nodes = [
    { tilt: 0.42, build: node => mesh(node, new THREE.IcosahedronGeometry(0.12, 1), material('#ff7a45', { metalness: 0.85, roughness: 0.24, flatShading: true })) },
    { tilt: 0.58, build: node => box(node, [0.195, 0.195, 0.195], silver, [0, 0, 0], 0.022) },
    { tilt: 1.18, build: node => ring(node, 0.115, 0.032, teal) },
  ].map(({ tilt, build }, index) => {
    const pivot = new THREE.Group(); orbit.add(pivot);
    pivot.rotation.z = index / 3 * Math.PI * 2;
    const node = new THREE.Group(); pivot.add(node);
    node.position.set(1, 0, 0);
    return { pivot, node, tilt, part: build(node) };
  });

  const cycle = new THREE.Group(); group.add(cycle);
  cycle.rotation.set(1.02, 0.34, 0.52);
  const sweep = Math.PI * 1.42;
  ring(cycle, 1.19, 0.009, grey, [0, 0, 0], sweep);
  const arrow = mesh(cycle, new THREE.ConeGeometry(0.05, 0.15, 48), grey, [Math.cos(sweep) * 1.19, Math.sin(sweep) * 1.19, 0]);
  arrow.rotation.z = sweep;

  const core = new THREE.Group(); group.add(core);
  const spark = mesh(core, new THREE.ExtrudeGeometry(starShape(0.37, 0.09), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 32 }), accent, [0, 0, -0.035]);
  ring(core, 0.53, 0.007, basic('#ffb894'));

  const satellite = new THREE.Group(); group.add(satellite);
  satellite.rotation.set(1.34, 0.22, 0);
  sphere(satellite, 0.05, basic('#ff885b'), [0.75, 0, 0], 48);

  return {
    group, rotation: [0, 0, 0], fit: 0.72,
    animate(time, intro = 1) {
      const ease = 1 - Math.pow(1 - intro, 3);
      group.scale.setScalar(0.58 + 0.42 * ease);
      group.position.y = Math.sin(time * 0.65) * 0.035 * ease - (1 - ease) * 0.6;
      const spin = time * 0.26 - (1 - ease) * 2.4;
      orbit.rotation.z = spin;
      nodes.forEach(({ pivot, node, part, tilt }, index) => {
        node.rotation.z = -(spin + pivot.rotation.z);
        part.rotation.y = time * (0.55 + index * 0.12);
        part.rotation.x = tilt + Math.sin(time * 0.6 + pivot.rotation.z) * 0.32;
      });
      core.rotation.z = time * 0.11;
      core.rotation.y = Math.sin(time * 0.45) * 0.3;
      spark.scale.setScalar(1 + Math.sin(time * 1.7) * 0.04);
      satellite.rotation.z = -time * 0.62;
      cycle.rotation.z = Math.sin(time * 0.21) * 0.09;
    }
  };
}

function makeSpark() {
  const group = new THREE.Group();
  const accent = material('#ff7a45', { metalness: 0.85, roughness: 0.26 });
  const silver = material(palette.metal, { metalness: 0.9, roughness: 0.17 });

  const spark = mesh(group, new THREE.ExtrudeGeometry(starShape(0.4, 0.1), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 }), accent, [0, 0, -0.04]);
  const orbit = new THREE.Group(); group.add(orbit);
  orbit.rotation.set(1.18, 0, 0.42);
  ring(orbit, 0.62, 0.011, silver);
  sphere(orbit, 0.05, basic('#ffb894'), [0.62, 0, 0], 32);

  return {
    group, rotation: [0.1, -0.2, 0], fit: 0.82,
    animate(time, intro = 1) {
      const ease = 1 - Math.pow(1 - intro, 3);
      group.scale.setScalar(0.7 + 0.3 * ease);
      group.position.y = Math.sin(time * 0.8) * 0.03 * ease - (1 - ease) * 0.4;
      orbit.rotation.z = 0.42 + time * 0.34;
      spark.rotation.z = -time * 0.16;
      spark.scale.setScalar(1 + Math.sin(time * 1.5) * 0.05);
    }
  };
}

function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#596473');
  for (const [position, size, color] of [[[0, 5, 3], [8, 4], [4, 3.5, 3]], [[-5, 1, 1], [4, 7], [2, 2.6, 4]], [[5, -1, -2], [3, 5], [4, 2.8, 1.8]]]) {
    const panel = mesh(studio, new THREE.PlaneGeometry(...size), basic(new THREE.Color(...color)), position);
    panel.lookAt(0, 0, 0);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04);
  generator.dispose();
  return environment;
}

function startObjects() {
  const stages = [...document.querySelectorAll('[data-model]')];
  if (!stages.length) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'projects-3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return;
  }
  document.body.append(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  let environment = studioEnvironment(renderer);
  const factories = { cycle: makeCycle, spark: makeSpark, astro: makeAstro, chip: makeChip, hush: makeHush, voice: makeVoice, devops: makeDevops, trade: makeTrade, namaz: makeNamaz, eden: makeEden };
  const views = stages.map(stage => {
    const model = factories[stage.dataset.model]();
    const scene = new THREE.Scene();
    scene.environment = environment.texture;
    scene.add(model.group);
    scene.add(new THREE.HemisphereLight('#e5ecff', '#33413c', 2.1));
    const key = new THREE.DirectionalLight('#fff3d9', 3.4); key.position.set(-2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight('#9bc5ef', 2.3); rim.position.set(3, -1, 2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30); camera.position.z = 4.8;
    model.group.rotation.set(...model.rotation);
    model.animate(0);
    const bounds = new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3());
    const owner = stage.closest('.project-card');
    return { stage, model, scene, camera, bounds, owner, fit: model.fit ?? 1, idle: stage.hasAttribute('data-idle'), target: owner || stage.closest('.hero') || stage, introAt: 0, visible: false, time: 0, pointer: new THREE.Vector2(), tilt: new THREE.Vector2() };
  });
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  let frame = 0, lastDraw = 0, disposed = false, contextLost = false, dirty = true, hovered;

  function motionScale() {
    if (preference.matches || document.documentElement.dataset.motion === 'off') return 0;
    return Math.max(0, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-motion')) || 0);
  }

  function schedule() {
    if (!frame && !disposed && !contextLost && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function refresh() { dirty = true; schedule(); }

  function draw(timestamp) {
    frame = 0;
    if (disposed || contextLost || document.hidden) return;
    const speed = motionScale();
    const visible = views.filter(view => view.visible);
    if (dirty || timestamp - lastDraw >= 1000 / 30) {
      const delta = Math.min((timestamp - lastDraw) / 1000, 0.05);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio, coarsePointer.matches ? 1 : 1.5);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { renderer.setPixelRatio(ratio); renderer.setSize(width, height, false); }
      const rectangles = visible.map(view => ({ view, rect: view.stage.getBoundingClientRect() }));
      const active = hovered ?? rectangles.filter(({ view, rect }) => !view.idle && rect.bottom > 0 && rect.top < height).sort((a, b) => Math.abs(a.rect.top + a.rect.height / 2 - height / 2) - Math.abs(b.rect.top + b.rect.height / 2 - height / 2))[0]?.view;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height); renderer.clear(); renderer.setScissorTest(true);
      for (const { view, rect } of rectangles) {
        const caption = view.stage.querySelector('.scene-caption');
        const captionHeight = caption ? caption.getBoundingClientRect().height : 0;
        const viewHeight = rect.height - Math.max(25, captionHeight + 12);
        if (rect.width <= 0 || viewHeight <= 0 || rect.bottom < 0 || rect.top > height) continue;
        if (view.owner && getComputedStyle(view.owner).opacity < 0.95) continue;
        if (speed > 0 && (view.idle || active === view)) {
          view.time += delta * speed;
          view.tilt.lerp(view.pointer, 1 - Math.pow(1 - 0.085, delta * 60));
          view.model.group.rotation.x = view.model.rotation[0] + view.tilt.y * 0.15;
          view.model.group.rotation.y = view.model.rotation[1] + view.tilt.x * 0.2;
          view.model.group.position.y = Math.sin(view.time * 0.65) * 0.035;
        }
        let intro = 1;
        if (view.idle && speed > 0) {
          if (!view.introAt) view.introAt = timestamp;
          intro = Math.min(1, Math.max(0, (timestamp - view.introAt - 380) / 1000));
        }
        view.model.animate(view.time, intro);
        view.camera.aspect = rect.width / viewHeight;
        const fittedSize = Math.max(view.bounds.y, view.bounds.x / view.camera.aspect);
        view.camera.position.z = (fittedSize * 1.25 / (2 * Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2))) + view.bounds.z * 0.45) * view.fit;
        view.camera.updateProjectionMatrix();
        const bottom = height - rect.top - viewHeight;
        const left = Math.max(0, rect.left), low = Math.max(0, bottom);
        const right = Math.min(width, rect.right), high = Math.min(height, bottom + viewHeight);
        if (right <= left || high <= low) continue;
        renderer.setViewport(rect.left, bottom, rect.width, viewHeight);
        renderer.setScissor(left, low, right - left, high - low);
        renderer.render(view.scene, view.camera);
        view.stage.classList.add('scene-ready');
        view.owner?.classList.add('has-3d');
      }
      lastDraw = timestamp; dirty = false;
    }
    if (speed > 0 && visible.length) schedule();
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) views.find(view => view.stage === entry.target).visible = entry.isIntersecting;
    refresh();
  }, { rootMargin: '50px' });
  views.forEach(view => {
    observer.observe(view.stage);
    const card = view.target;
    card.addEventListener('pointermove', event => {
      if (coarsePointer.matches || !motionScale()) return;
      const rect = view.stage.getBoundingClientRect();
      view.pointer.set(THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1), THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1));
      hovered = view; refresh();
    });
    card.addEventListener('pointerleave', () => { view.pointer.set(0, 0); hovered = undefined; refresh(); });
    card.addEventListener('focusin', () => { hovered = view; refresh(); });
    card.addEventListener('focusout', () => { hovered = undefined; refresh(); });
  });
  const resize = new ResizeObserver(refresh); resize.observe(canvas); views.forEach(view => resize.observe(view.stage));
  const settings = new MutationObserver(refresh); settings.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-motion'] });
  document.addEventListener('site:motionchange', refresh);
  preference.addEventListener('change', refresh);
  window.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else refresh(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0; canvas.style.visibility = 'hidden'; views.forEach(view => { view.stage.classList.remove('scene-ready'); view.owner?.classList.remove('has-3d'); }); });
  canvas.addEventListener('webglcontextrestored', () => { environment.dispose(); environment = studioEnvironment(renderer); views.forEach(view => { view.scene.environment = environment.texture; }); contextLost = false; canvas.style.visibility = ''; refresh(); });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); settings.disconnect();
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); environment.dispose(); renderer.dispose(); canvas.remove();
  });
  refresh();
}

startObjects();
