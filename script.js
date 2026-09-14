/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

// Ative para liberar o botão "Calibração" e reposicionar hotspots / câmera.
// Deixe em false para o modo aluno (produção / Storyline).
const CALIBRATION_ENABLED = true;

// ---- Posições dos hotspots no modelo (calibradas) ----
// position / normal = ponto 3D exato sobre a peça no modelo.
const HOTSPOTS = [
  { id: "cinta-jugular",  label: "Cinta Jugular",         position: "-0.3045 0.3803 0.1613", normal: "-0.1390 0.1790 0.9740" },
  { id: "ajuste-traseiro",label: "Ajuste Traseiro",       position: "0.0114 0.3993 -0.3336", normal: "0.1818 -0.7712 -0.6101" },
  { id: "carneira",       label: "Carneira (Suspensão)",  position: "0.0000 0.7039 0.0819", normal: "-0.1000 -0.8110 -0.5760" },
  { id: "encaixe",        label: "Encaixe de Acessórios", position: "0.3703 0.8101 0.0205", normal: "0.6670 0.7450 -0.0180" },
  { id: "aba",            label: "Aba",                   position: "0.0927 0.6744 0.4875", normal: "0.1933 0.8153 0.5459" },
  { id: "fivela",         label: "Fivela da Jugular",     position: "0.2285 0.0990 0.1580", normal: "0.6876 -0.6159 0.3847" },
  { id: "queixeira",      label: "Queixeira",             position: "0.0043 0.0263 0.2468", normal: "0.0040 -0.6540 0.7560" },
];

// ---- Ordem, título e texto de cada peça no menu / card ----
const PARTS = [
  { id: "aba",             label: "Aba",
    desc: "Ajuda a proteger a região dos olhos e do rosto contra luz, respingos e pequenas partículas, proporcionando maior conforto durante o uso." },
  { id: "cinta-jugular",   label: "Cinta Jugular",
    desc: "Auxilia na fixação do capacete à cabeça, reduzindo o risco de deslocamento ou queda durante as atividades." },
  { id: "queixeira",       label: "Queixeira",
    desc: "Apoia a cinta sob o queixo, proporcionando maior estabilidade, conforto e posicionamento adequado do capacete." },
  { id: "fivela",          label: "Fivela da Jugular",
    desc: "Permite prender e soltar a cinta com praticidade, mantendo o sistema de fixação fechado e ajustado." },
  { id: "encaixe",         label: "Encaixe de Acessórios",
    desc: "Permite acoplar acessórios compatíveis ao capacete de acordo com as necessidades de cada atividade." },
  { id: "ajuste-traseiro", label: "Ajuste Traseiro",
    desc: "Permite adaptar a suspensão ao tamanho da cabeça, proporcionando melhor encaixe, estabilidade e conforto." },
  { id: "carneira",        label: "Carneira (Suspensão)",
    desc: "Sistema interno que sustenta o capacete, distribui o peso e mantém o casco afastado da cabeça, proporcionando conforto e segurança." },
];

// ---- Posições de câmera (rotação automática) por peça ----
// Formato igual ao atributo camera-orbit: "θdeg φdeg raio"
// raio pode ser "%" (relativo ao enquadramento) ou "m" (metros absolutos,
// como fica ao usar "Capturar posição da câmera" no modo calibração).
// Estes são valores iniciais — recalibre e exporte para refiná-los.
const CAMERA_VIEWS = {
  "aba":             "0deg 78deg 100%",
  "cinta-jugular":   "-35deg 82deg 95%",
  "queixeira":       "5deg 96deg 90%",
  "fivela":          "-90deg 85deg 92%",
  "encaixe":         "60deg 55deg 100%",
  "ajuste-traseiro": "180deg 80deg 95%",
  "carneira":        "10deg 115deg 85%",
};

const CAMERA_TRANSITION_MS = 1000;

/* =========================================================
   ESTADO
   ========================================================= */
const state = {
  mode: "aluno",              // "aluno" | "calibracao"
  selectedId: null,           // peça selecionada (hotspot + menu + card)
  calibSelectedId: PARTS[0].id,
  hotspots: {},               // id -> { position, normal } (mutável em calibração)
  cameraViews: { ...CAMERA_VIEWS }, // id -> string (mutável em calibração)
  resolvedViews: {},          // id -> { theta, phi, radius } em rad/rad/m (cache resolvido)
  cameraCalibrated: {},       // id -> true se já foi capturado manualmente
  hotspotCalibrated: {},      // id -> true se a posição já existe
  animating: false,
  initialOrbitString: null,
  initialFovString: null,
};

HOTSPOTS.forEach(h => {
  state.hotspots[h.id] = { position: h.position, normal: h.normal };
  state.hotspotCalibrated[h.id] = !!(h.position && h.normal);
});

/* =========================================================
   ELEMENTOS
   ========================================================= */
const viewer = document.getElementById("viewer");
const stage = document.getElementById("stage");
const viewerFrame = document.getElementById("viewer-frame");

const btnReset = document.getElementById("btn-reset");
const btnZoomIn = document.getElementById("btn-zoom-in");
const btnZoomOut = document.getElementById("btn-zoom-out");
const btnToggleCalib = document.getElementById("btn-toggle-calib");

const infoCard = document.getElementById("info-card");
const infoNumber = document.getElementById("info-number");
const infoTitle = document.getElementById("info-title");
const infoDesc = document.getElementById("info-desc");
const infoClose = document.getElementById("info-close");

const partMenu = document.getElementById("part-menu");
const hint = document.getElementById("hint");
const emptyState = document.getElementById("empty-state");

const calibPanel = document.getElementById("calib-panel");
const calibClose = document.getElementById("calib-close");
const selectPart = document.getElementById("select-part");
const calibStatus = document.getElementById("calib-status");
const btnCaptureCamera = document.getElementById("btn-capture-camera");
const btnTestView = document.getElementById("btn-test-view");
const calibList = document.getElementById("calib-list");
const btnExport = document.getElementById("btn-export");
const btnClearCalib = document.getElementById("btn-clear-calib");
const exportBox = document.getElementById("export-box");
const exportText = document.getElementById("export-text");
const btnCopyExport = document.getElementById("btn-copy-export");

/* =========================================================
   UTILITÁRIOS DE CÂMERA
   ========================================================= */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Normaliza uma diferença angular para o caminho mais curto (-π, π]
function shortestDelta(from, to) {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return delta;
}

// Resolve uma string de camera-orbit (aceita % ou m) para valores absolutos
// em radianos/radianos/metros, aplicando-a momentaneamente ao viewer.
function resolveOrbitString(orbitString) {
  const prevOrbit = viewer.getAttribute("camera-orbit");
  viewer.cameraOrbit = orbitString;
  viewer.jumpCameraToGoal();
  const resolved = viewer.getCameraOrbit();
  // restaura imediatamente (mesmo tick, sem repaint intermediário)
  viewer.cameraOrbit = prevOrbit;
  viewer.jumpCameraToGoal();
  return { theta: resolved.theta, phi: resolved.phi, radius: resolved.radius };
}

// Resolve todas as visões de câmera configuradas, sem "flash" visível
// (tudo acontece de forma síncrona antes do próximo repaint).
function resolveAllCameraViews() {
  state.initialOrbitString = viewer.getAttribute("camera-orbit");
  state.initialFovString = viewer.getAttribute("field-of-view");

  state.resolvedViews["__initial__"] = viewer.getCameraOrbit();

  Object.keys(state.cameraViews).forEach(id => {
    state.resolvedViews[id] = resolveOrbitString(state.cameraViews[id]);
  });

  // garante que o viewer volta exatamente ao estado inicial
  viewer.cameraOrbit = state.initialOrbitString;
  viewer.jumpCameraToGoal();
}

// Anima suavemente a câmera até a visão resolvida de `id` (ou "__initial__").
function animateCameraTo(id, duration = CAMERA_TRANSITION_MS) {
  const target = state.resolvedViews[id];
  if (!target) return;

  const start = viewer.getCameraOrbit();
  const dTheta = shortestDelta(start.theta, target.theta);
  const dPhi = target.phi - start.phi;
  const dRadius = target.radius - start.radius;

  state.animating = true;
  viewer.classList.add("no-interaction");

  const t0 = performance.now();

  function frame(now) {
    const raw = Math.min(1, (now - t0) / duration);
    const eased = easeInOutCubic(raw);

    const theta = start.theta + dTheta * eased;
    const phi = start.phi + dPhi * eased;
    const radius = start.radius + dRadius * eased;

    viewer.cameraOrbit = `${theta}rad ${phi}rad ${radius}m`;
    viewer.jumpCameraToGoal();

    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      state.animating = false;
      viewer.classList.remove("no-interaction");
    }
  }
  requestAnimationFrame(frame);
}

/* =========================================================
   HOTSPOTS (DOM dentro do model-viewer)
   ========================================================= */
function buildHotspotElements() {
  // remove hotspots antigos, se houver
  viewer.querySelectorAll(".hotspot").forEach(el => el.remove());

  PARTS.forEach(part => {
    const data = state.hotspots[part.id];
    const btn = document.createElement("button");
    btn.className = "hotspot";
    btn.dataset.id = part.id;
    btn.slot = `hotspot-${part.id}`;
    btn.setAttribute("aria-label", part.label);

    if (data && data.position) {
      btn.setAttribute("data-position", data.position);
      btn.setAttribute("data-normal", data.normal || "0 1 0");
    } else {
      // posição provisória no centro, até ser calibrado
      btn.setAttribute("data-position", "0 0.5 0");
      btn.setAttribute("data-normal", "0 1 0");
      btn.hidden = !CALIBRATION_ENABLED;
    }

    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (state.mode === "calibracao") {
        // no modo calibração, clicar num hotspot já existente apenas o seleciona
        state.calibSelectedId = part.id;
        selectPart.value = part.id;
        refreshHotspotVisualState();
        refreshCalibList();
        setCalibStatus(`Peça selecionada: ${labelOf(part.id)}.`);
        return;
      }
      onHotspotClick(part.id);
    });

    viewer.appendChild(btn);
  });
  refreshHotspotVisualState();
}

function refreshHotspotVisualState() {
  viewer.querySelectorAll(".hotspot").forEach(el => {
    const id = el.dataset.id;
    el.classList.toggle("selected", state.mode === "aluno" && state.selectedId === id);
    el.classList.toggle("calib-target", state.mode === "calibracao" && state.calibSelectedId === id);
  });
}

/* =========================================================
   MENU LATERAL (modo aluno)
   ========================================================= */
function buildPartMenu() {
  partMenu.innerHTML = "";
  PARTS.forEach((part, idx) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "part-menu-item";
    item.dataset.id = part.id;

    const dot = document.createElement("span");
    dot.className = "part-menu-dot";
    dot.textContent = String(idx + 1).padStart(2, "0");

    const label = document.createElement("span");
    label.className = "part-menu-label";
    label.textContent = part.label;

    item.appendChild(dot);
    item.appendChild(label);
    item.addEventListener("click", () => onMenuClick(part.id));
    partMenu.appendChild(item);
  });
  refreshMenuVisualState();
}

function refreshMenuVisualState() {
  partMenu.querySelectorAll(".part-menu-item").forEach(el => {
    el.classList.toggle("active", state.selectedId === el.dataset.id);
  });
}

/* =========================================================
   CARD DE INFORMAÇÃO (modo aluno)
   ========================================================= */
function showInfoCard(id) {
  const idx = PARTS.findIndex(p => p.id === id);
  const part = PARTS[idx];
  if (!part) return;
  infoNumber.textContent = String(idx + 1).padStart(2, "0");
  infoTitle.textContent = part.label;
  infoDesc.textContent = part.desc;
  infoCard.hidden = false;
}
function hideInfoCard() {
  infoCard.hidden = true;
}

/* =========================================================
   SELEÇÃO / SINCRONIZAÇÃO
   ========================================================= */
function onMenuClick(id) {
  if (state.animating) return;
  state.selectedId = id;
  refreshMenuVisualState();
  refreshHotspotVisualState();
  showInfoCard(id);
  animateCameraTo(id);
}

function onHotspotClick(id) {
  if (state.animating) return;
  state.selectedId = id;
  refreshMenuVisualState();
  refreshHotspotVisualState();
  showInfoCard(id);
  // Já está visível (o usuário clicou nele) — não força rotação.
}

infoClose.addEventListener("click", () => {
  state.selectedId = null;
  refreshMenuVisualState();
  refreshHotspotVisualState();
  hideInfoCard();
});

/* =========================================================
   CONTROLES SUPERIORES
   ========================================================= */
btnReset.addEventListener("click", () => {
  if (state.animating) return;
  state.selectedId = null;
  refreshMenuVisualState();
  refreshHotspotVisualState();
  hideInfoCard();
  animateCameraTo("__initial__", 900);
});

function stepZoom(factor) {
  if (state.animating) return;
  const orbit = viewer.getCameraOrbit();
  const target = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius * factor };
  state.resolvedViews["__zoom_tmp__"] = target;
  animateCameraTo("__zoom_tmp__", 220);
}
btnZoomIn.addEventListener("click", () => stepZoom(0.85));
btnZoomOut.addEventListener("click", () => stepZoom(1.18));

/* =========================================================
   MODO CALIBRAÇÃO
   ========================================================= */
function setMode(mode) {
  state.mode = mode;
  const calib = mode === "calibracao";

  calibPanel.hidden = !calib;
  partMenu.hidden = calib;
  hint.hidden = calib;
  if (calib) hideInfoCard();

  btnToggleCalib.classList.toggle("active", calib);
  viewer.classList.toggle("calib-cursor", calib);

  refreshHotspotVisualState();
  if (calib) refreshCalibList();
}

if (CALIBRATION_ENABLED) {
  btnToggleCalib.hidden = false;
  btnToggleCalib.addEventListener("click", () => {
    setMode(state.mode === "calibracao" ? "aluno" : "calibracao");
  });
}
calibClose.addEventListener("click", () => setMode("aluno"));

// Select de peça (calibração)
function buildSelectPart() {
  selectPart.innerHTML = "";
  PARTS.forEach(part => {
    const opt = document.createElement("option");
    opt.value = part.id;
    opt.textContent = part.label;
    selectPart.appendChild(opt);
  });
  selectPart.value = state.calibSelectedId;
}
selectPart.addEventListener("change", () => {
  state.calibSelectedId = selectPart.value;
  refreshHotspotVisualState();
  refreshCalibList();
  setCalibStatus(`Peça selecionada: ${labelOf(state.calibSelectedId)}.`);
});

function labelOf(id) {
  const p = PARTS.find(p => p.id === id);
  return p ? p.label : id;
}
function setCalibStatus(msg) {
  calibStatus.textContent = msg;
}

// Clique no modelo define a posição do hotspot (modo calibração)
viewer.addEventListener("click", (ev) => {
  if (state.mode !== "calibracao") return;
  const hit = viewer.positionAndNormalFromPoint(ev.offsetX, ev.offsetY);
  if (!hit) {
    setCalibStatus("Nenhum ponto do modelo encontrado ali. Clique diretamente sobre o capacete.");
    return;
  }
  const id = state.calibSelectedId;
  const posStr = `${hit.position.x.toFixed(4)} ${hit.position.y.toFixed(4)} ${hit.position.z.toFixed(4)}`;
  const normStr = `${hit.normal.x.toFixed(4)} ${hit.normal.y.toFixed(4)} ${hit.normal.z.toFixed(4)}`;

  state.hotspots[id] = { position: posStr, normal: normStr };
  state.hotspotCalibrated[id] = true;

  const el = viewer.querySelector(`.hotspot[data-id="${id}"]`);
  if (el) {
    el.hidden = false;
    el.setAttribute("data-position", posStr);
    el.setAttribute("data-normal", normStr);
  }

  emptyState.hidden = true;
  setCalibStatus(`Ponto do hotspot capturado para "${labelOf(id)}".`);
  refreshCalibList();
});

// Captura a posição de câmera atual como a visão automática da peça
btnCaptureCamera.addEventListener("click", () => {
  const id = state.calibSelectedId;
  const orbit = viewer.getCameraOrbit();
  state.resolvedViews[id] = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius };
  state.cameraCalibrated[id] = true;

  const thetaDeg = (orbit.theta * 180 / Math.PI).toFixed(2);
  const phiDeg = (orbit.phi * 180 / Math.PI).toFixed(2);
  const radiusM = orbit.radius.toFixed(4);
  state.cameraViews[id] = `${thetaDeg}deg ${phiDeg}deg ${radiusM}m`;

  setCalibStatus(`Posição de câmera capturada para "${labelOf(id)}".`);
  refreshCalibList();
});

// Testa a rotação automática da peça selecionada (sem sair do modo calibração)
btnTestView.addEventListener("click", () => {
  animateCameraTo(state.calibSelectedId);
});

function refreshCalibList() {
  calibList.innerHTML = "";
  PARTS.forEach(part => {
    const li = document.createElement("li");
    li.dataset.id = part.id;
    if (part.id === state.calibSelectedId) li.classList.add("current");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = part.label;

    const badges = document.createElement("span");
    badges.className = "badges";

    const bPos = document.createElement("span");
    bPos.className = "badge" + (state.hotspotCalibrated[part.id] ? " done" : "");
    bPos.textContent = "Ponto";

    const bCam = document.createElement("span");
    bCam.className = "badge" + (state.cameraCalibrated[part.id] ? " done" : "");
    bCam.textContent = "Câmera";

    badges.appendChild(bPos);
    badges.appendChild(bCam);
    li.appendChild(name);
    li.appendChild(badges);

    li.addEventListener("click", () => {
      state.calibSelectedId = part.id;
      selectPart.value = part.id;
      refreshHotspotVisualState();
      refreshCalibList();
      setCalibStatus(`Peça selecionada: ${labelOf(part.id)}.`);
    });

    calibList.appendChild(li);
  });
}

btnClearCalib.addEventListener("click", () => {
  if (!confirm("Restaurar as posições de câmera para os valores padrão (os pontos dos hotspots não serão afetados)?")) return;
  PARTS.forEach(part => {
    state.cameraCalibrated[part.id] = false;
    state.cameraViews[part.id] = CAMERA_VIEWS[part.id];
  });
  resolveAllCameraViews();
  refreshCalibList();
  setCalibStatus("Posições de câmera restauradas para o padrão.");
});

// Exporta HOTSPOTS + CAMERA_VIEWS prontos para colar no script.js
btnExport.addEventListener("click", () => {
  const hotspotsCode = PARTS.map(part => {
    const h = state.hotspots[part.id] || {};
    return `  { id: "${part.id}", label: "${part.label}", position: "${h.position || "0 0 0"}", normal: "${h.normal || "0 1 0"}" },`;
  }).join("\n");

  const camerasCode = PARTS.map(part => {
    return `  "${part.id}": "${state.cameraViews[part.id]}",`;
  }).join("\n");

  const text =
`// ---- Cole este bloco substituindo o array HOTSPOTS em script.js ----
const HOTSPOTS = [
${hotspotsCode}
];

// ---- Cole este bloco substituindo o objeto CAMERA_VIEWS em script.js ----
const CAMERA_VIEWS = {
${camerasCode}
};
`;
  exportText.value = text;
  exportBox.hidden = false;
  setCalibStatus("Coordenadas exportadas abaixo. Copie e cole no script.js.");
});

btnCopyExport.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(exportText.value);
    setCalibStatus("Copiado para a área de transferência!");
  } catch (e) {
    exportText.select();
    document.execCommand("copy");
    setCalibStatus("Copiado (via seleção manual).");
  }
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
function init() {
  buildPartMenu();
  buildSelectPart();

  const anyCalibrated = PARTS.some(p => state.hotspotCalibrated[p.id]);
  emptyState.hidden = anyCalibrated || !CALIBRATION_ENABLED ? true : false;

  viewer.addEventListener("load", () => {
    buildHotspotElements();
    resolveAllCameraViews();
    refreshCalibList();
  }, { once: true });
}

init();
