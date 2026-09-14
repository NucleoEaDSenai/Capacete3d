/* =============================================================
   CONFIGURAÇÃO
   -------------------------------------------------------------
   CALIBRATION_ENABLED:
     - true  -> mostra o botão "Calibração" e permite ajustar os
                pontos e as posições de câmera (use isso enquanto
                estiver preparando o material).
     - false -> esconde totalmente o modo calibração. Use este
                valor antes de publicar/incorporar no Storyline
                (modo aluno "limpo").

   HOTSPOTS:
     - Lista das peças a identificar, na ordem em que aparecem no
       menu lateral. "position" e "normal" são as coordenadas 3D
       ancoradas no modelo (não foram alteradas). "desc" é o texto
       exibido no card do modo aluno.
     - Para reposicionar um hotspot: abra o Modo Calibração,
       selecione a peça, clique sobre o ponto correspondente no
       modelo e exporte o array atualizado.

   CAMERA_PRESETS:
     - Posição de câmera "ideal" para cada peça (para onde o
       capacete gira automaticamente ao selecionar o item no menu
       ou clicar no hotspot).
     - theta/phi em graus, radius em metros (ou null para usar o
       raio da posição inicial) e fov em graus (ou null para usar
       o campo de visão inicial).
     - Para recalibrar: no Modo Calibração, posicione o modelo e o
       zoom manualmente, selecione a peça e clique em
       "Capturar posição da câmera". Depois exporte os valores.
   ============================================================= */

const CALIBRATION_ENABLED = true;

const HOTSPOTS = [
  { id: "aba",             label: "Aba",                    position: "0.0284 0.6528 0.5353",  normal: "0.0633 0.8349 0.5467",
    desc: "Ajuda a proteger a região dos olhos e do rosto contra luz, respingos e pequenas partículas, proporcionando maior conforto durante o uso." },
  { id: "cinta-jugular",   label: "Cinta Jugular",          position: "-0.3045 0.3803 0.1613",  normal: "-0.1390 0.1790 0.9740",
    desc: "Auxilia na fixação do capacete à cabeça, reduzindo o risco de deslocamento ou queda durante as atividades." },
  { id: "queixeira",       label: "Queixeira",              position: "0.0043 0.0263 0.2468",   normal: "0.0040 -0.6540 0.7560",
    desc: "Apoia a cinta sob o queixo, proporcionando maior estabilidade, conforto e posicionamento adequado do capacete." },
  { id: "fivela",          label: "Fivela da Jugular",      position: "0.2285 0.0990 0.1580",   normal: "0.6876 -0.6159 0.3847",
    desc: "Permite prender e soltar a cinta com praticidade, mantendo o sistema de fixação fechado e ajustado." },
  { id: "encaixe",         label: "Encaixe de Acessórios",  position: "0.3703 0.8101 0.0205",   normal: "0.6670 0.7450 -0.0180",
    desc: "Permite acoplar acessórios compatíveis ao capacete de acordo com as necessidades de cada atividade." },
  { id: "ajuste-traseiro", label: "Ajuste Traseiro",        position: "0.0114 0.3993 -0.3336",  normal: "0.1818 -0.7712 -0.6101",
    desc: "Permite adaptar a suspensão ao tamanho da cabeça, proporcionando melhor encaixe, estabilidade e conforto." },
  { id: "carneira",        label: "Carneira (Suspensão)",   position: "0.0000 0.7039 0.0819",   normal: "-0.1000 -0.8110 -0.5760",
    desc: "Sistema interno que sustenta o capacete, distribui o peso e mantém o casco afastado da cabeça, proporcionando conforto e segurança." },
];

const CAMERA_PRESETS = {
  "aba":             { theta: 0,   phi: 78, radius: null, fov: null },
  "cinta-jugular":   { theta: -35, phi: 88, radius: null, fov: null },
  "queixeira":       { theta: 0,   phi: 96, radius: null, fov: null },
  "fivela":          { theta: 55,  phi: 96, radius: null, fov: null },
  "encaixe":         { theta: 35,  phi: 55, radius: null, fov: null },
  "ajuste-traseiro": { theta: 180, phi: 80, radius: null, fov: null },
  "carneira":        { theta: 0,   phi: 35, radius: null, fov: null },
};

/* ============================================================= */

(function () {
  "use strict";

  const viewer = document.getElementById("viewer");
  const stage = document.getElementById("stage");
  const emptyState = document.getElementById("empty-state");
  const btnOpenCalibFromEmpty = document.getElementById("btn-open-calib-from-empty");

  const infoPanel = document.getElementById("info-panel");
  const infoNumber = document.getElementById("info-number");
  const infoTitle = document.getElementById("info-title");
  const infoDesc = document.getElementById("info-desc");
  const infoClose = document.getElementById("info-close");

  const navList = document.getElementById("nav-list");

  const btnReset = document.getElementById("btn-reset");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnToggleCalib = document.getElementById("btn-toggle-calib");

  const calibPanel = document.getElementById("calib-panel");
  const selectPart = document.getElementById("select-part");
  const calibStatus = document.getElementById("calib-status");
  const calibList = document.getElementById("calib-list");
  const btnCaptureCamera = document.getElementById("btn-capture-camera");
  const btnExport = document.getElementById("btn-export");
  const btnCloseCalib = document.getElementById("btn-close-calib");
  const exportBox = document.getElementById("export-box");
  const exportText = document.getElementById("export-text");
  const btnCopy = document.getElementById("btn-copy");
  const btnExportCamera = document.getElementById("btn-export-camera");
  const exportCameraBox = document.getElementById("export-camera-box");
  const exportCameraText = document.getElementById("export-camera-text");
  const btnCopyCamera = document.getElementById("btn-copy-camera");

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  let mode = "aluno"; // "aluno" | "calibracao"
  let selectedPartId = HOTSPOTS[0].id;

  // Resolvidos após o modelo carregar (radianos / metros / graus)
  let INITIAL_THETA = 0, INITIAL_PHI = 0, INITIAL_RADIUS = 0, INITIAL_FOV = 0;

  let animToken = 0; // invalida animações anteriores em andamento

  /* -----------------------------------------------------------
     Utilidades
     ----------------------------------------------------------- */
  function findHotspot(id) {
    return HOTSPOTS.find((h) => h.id === id);
  }

  function vecToString(v) {
    return [v.x, v.y, v.z].map((n) => n.toFixed(4)).join(" ");
  }

  function hasAnyCalibrated() {
    return HOTSPOTS.some((h) => h.position);
  }

  function normalizeAngle(rad) {
    // devolve o ângulo equivalente no intervalo (-PI, PI]
    let a = rad % (2 * Math.PI);
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* -----------------------------------------------------------
     Câmera: animação suave até uma posição-alvo (~1s)
     ----------------------------------------------------------- */
  function resolveTarget(partId) {
    const preset = CAMERA_PRESETS[partId] || {};
    return {
      theta: (preset.theta != null ? preset.theta : 0) * DEG,
      phi: (preset.phi != null ? preset.phi : INITIAL_PHI * RAD) * DEG,
      radius: preset.radius != null ? preset.radius : INITIAL_RADIUS,
      fov: preset.fov != null ? preset.fov : INITIAL_FOV,
    };
  }

  function animateCameraTo(target, duration) {
    duration = duration || 1000;
    const myToken = ++animToken;

    const start = viewer.getCameraOrbit();
    const startFov = viewer.getFieldOfView();
    const startTheta = start.theta;
    const startPhi = start.phi;
    const startRadius = start.radius;

    let dTheta = normalizeAngle(target.theta - startTheta);
    const dPhi = target.phi - startPhi;
    const dRadius = target.radius - startRadius;
    const dFov = target.fov - startFov;

    const hadControls = viewer.hasAttribute("camera-controls");
    viewer.removeAttribute("camera-controls");

    const t0 = performance.now();

    function frame(now) {
      if (myToken !== animToken) return; // outra animação assumiu o controle

      const t = Math.min(1, (now - t0) / duration);
      const e = easeInOutCubic(t);

      const theta = startTheta + dTheta * e;
      const phi = startPhi + dPhi * e;
      const radius = startRadius + dRadius * e;
      const fov = startFov + dFov * e;

      viewer.cameraOrbit = theta + "rad " + phi + "rad " + radius + "m";
      viewer.fieldOfView = fov + "deg";
      viewer.jumpCameraToGoal();

      if (t < 1) {
        requestAnimationFrame(frame);
      } else if (hadControls) {
        viewer.setAttribute("camera-controls", "");
      }
    }

    requestAnimationFrame(frame);
  }

  function animateToPart(partId) {
    animateCameraTo(resolveTarget(partId), 1000);
  }

  /* -----------------------------------------------------------
     Renderização dos hotspots dentro do <model-viewer>
     (slots "hotspot-<id>", atributos data-position / data-normal)
     ----------------------------------------------------------- */
  function renderHotspots() {
    viewer.querySelectorAll(".hotspot").forEach((el) => el.remove());

    HOTSPOTS.forEach((h) => {
      if (!h.position) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hotspot";
      btn.slot = "hotspot-" + h.id;
      btn.dataset.partId = h.id;
      btn.setAttribute("data-position", h.position);
      btn.setAttribute("data-normal", h.normal || "0 1 0");
      btn.setAttribute("aria-label", h.label);
      btn.title = mode === "calibracao" ? h.label : "";

      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onHotspotClick(h.id);
      });

      viewer.appendChild(btn);
    });

    updateEmptyState();
    syncSelectionVisuals();
  }

  function updateEmptyState() {
    const calibrated = hasAnyCalibrated();
    emptyState.hidden = calibrated || mode === "calibracao";
    btnOpenCalibFromEmpty.hidden = !CALIBRATION_ENABLED;
  }

  /* -----------------------------------------------------------
     Sincronização: hotspot 3D + menu lateral + card de info
     ----------------------------------------------------------- */
  function syncSelectionVisuals() {
    viewer.querySelectorAll(".hotspot").forEach((el) => {
      el.classList.toggle("selected", el.dataset.partId === selectedPartId && mode === "aluno");
      el.classList.toggle("calib-target", el.dataset.partId === selectedPartId && mode === "calibracao");
    });

    navList.querySelectorAll(".nav-item").forEach((li) => {
      li.classList.toggle("selected", li.dataset.partId === selectedPartId);
    });
  }

  function renderInfoCard(partId) {
    const h = findHotspot(partId);
    if (!h) return;
    const idx = HOTSPOTS.indexOf(h) + 1;
    infoNumber.textContent = String(idx).padStart(2, "0");
    infoTitle.textContent = h.label.toUpperCase();
    infoDesc.textContent = h.desc || "";
  }

  /* -----------------------------------------------------------
     Modo aluno: selecionar peça (via hotspot ou menu)
     ----------------------------------------------------------- */
  function selectPartAluno(partId, opts) {
    opts = opts || {};
    selectedPartId = partId;
    syncSelectionVisuals();
    renderInfoCard(partId);
    infoPanel.hidden = false;

    if (!opts.skipAnimate) {
      animateToPart(partId);
    }
  }

  function clearSelectionAluno() {
    infoPanel.hidden = true;
    selectedPartId = null;
    syncSelectionVisuals();
  }

  function onHotspotClick(id) {
    if (mode === "calibracao") {
      selectPart.value = id;
      selectedPartId = id;
      syncSelectionVisuals();
      updateCalibStatus();
      renderCalibList();
      return;
    }
    selectPartAluno(id);
  }

  infoClose.addEventListener("click", clearSelectionAluno);

  /* -----------------------------------------------------------
     Navegação vertical numerada (menu lateral)
     ----------------------------------------------------------- */
  function buildNav() {
    navList.innerHTML = "";
    HOTSPOTS.forEach((h, i) => {
      const li = document.createElement("li");
      li.className = "nav-item";
      li.dataset.partId = h.id;

      const nodeBtn = document.createElement("button");
      nodeBtn.type = "button";
      nodeBtn.className = "nav-node";
      nodeBtn.textContent = String(i + 1).padStart(2, "0");
      nodeBtn.setAttribute("aria-label", h.label);

      const labelBtn = document.createElement("button");
      labelBtn.type = "button";
      labelBtn.className = "nav-label";
      labelBtn.textContent = h.label;

      function onClickNav() {
        if (mode === "calibracao") {
          selectPart.value = h.id;
          selectedPartId = h.id;
          syncSelectionVisuals();
          updateCalibStatus();
          renderCalibList();
          return;
        }
        selectPartAluno(h.id);
      }

      nodeBtn.addEventListener("click", onClickNav);
      labelBtn.addEventListener("click", onClickNav);

      li.appendChild(nodeBtn);
      li.appendChild(labelBtn);
      navList.appendChild(li);
    });
  }

  /* -----------------------------------------------------------
     Câmera: reset (suave) e zoom controlado
     ----------------------------------------------------------- */
  btnReset.addEventListener("click", () => {
    animateCameraTo({ theta: INITIAL_THETA, phi: INITIAL_PHI, radius: INITIAL_RADIUS, fov: INITIAL_FOV }, 1000);
  });

  function stepZoom(factor) {
    const orbit = viewer.getCameraOrbit();
    if (!orbit) return;
    animToken++; // cancela qualquer animação automática em curso
    const nextRadius = orbit.radius * factor;
    viewer.cameraOrbit = orbit.theta + "rad " + orbit.phi + "rad " + nextRadius + "m";
  }
  btnZoomIn.addEventListener("click", () => stepZoom(0.85));
  btnZoomOut.addEventListener("click", () => stepZoom(1.18));

  /* -----------------------------------------------------------
     Alternância de modo (aluno / calibração)
     ----------------------------------------------------------- */
  function setMode(newMode) {
    mode = newMode;
    const isCalib = mode === "calibracao";

    calibPanel.hidden = !isCalib;
    infoPanel.hidden = isCalib || !selectedPartId;
    btnToggleCalib.classList.toggle("active", isCalib);

    viewer.classList.toggle("calib-cursor", isCalib);
    updateEmptyState();
    renderHotspots();

    if (isCalib) {
      if (!selectedPartId) selectedPartId = HOTSPOTS[0].id;
      selectPart.value = selectedPartId;
      syncSelectionVisuals();
      updateCalibStatus();
      renderCalibList();
    } else if (selectedPartId) {
      renderInfoCard(selectedPartId);
      infoPanel.hidden = false;
    }
  }

  if (CALIBRATION_ENABLED) {
    btnToggleCalib.hidden = false;
    btnToggleCalib.addEventListener("click", () => {
      setMode(mode === "calibracao" ? "aluno" : "calibracao");
    });
    btnOpenCalibFromEmpty.addEventListener("click", () => setMode("calibracao"));
  }
  btnCloseCalib.addEventListener("click", () => setMode("aluno"));

  /* -----------------------------------------------------------
     Painel de calibração: lista de peças
     ----------------------------------------------------------- */
  function buildSelect() {
    selectPart.innerHTML = "";
    HOTSPOTS.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h.id;
      opt.textContent = h.label;
      selectPart.appendChild(opt);
    });
    selectPart.value = selectedPartId;
  }

  selectPart.addEventListener("change", () => {
    selectedPartId = selectPart.value;
    syncSelectionVisuals();
    updateCalibStatus();
    renderCalibList();
  });

  function updateCalibStatus() {
    const h = findHotspot(selectedPartId);
    if (!h) return;
    const hotspotDone = !!h.position;
    calibStatus.textContent = hotspotDone
      ? `"${h.label}": hotspot calibrado. Clique novamente no modelo para reposicionar, ou ajuste a câmera e capture a posição.`
      : `Clique no modelo no local correspondente a "${h.label}" para fixar o hotspot.`;
  }

  function renderCalibList() {
    calibList.innerHTML = "";
    HOTSPOTS.forEach((h) => {
      const preset = CAMERA_PRESETS[h.id];
      const cameraDone = !!(preset && preset.theta != null && preset.captured);
      const li = document.createElement("li");
      li.className = (h.position ? "hotspot-done " : "") + (h.id === selectedPartId ? "selected" : "");
      li.innerHTML =
        `<span class="dot" title="Hotspot"></span>` +
        `<span class="name">${h.label}</span>` +
        `<span class="flags"><span class="dot-camera" title="Posição de câmera capturada"></span></span>`;
      if (cameraDone) {
        li.querySelector(".dot-camera").style.background = "var(--green-strong)";
      }
      li.addEventListener("click", () => {
        selectPart.value = h.id;
        selectedPartId = h.id;
        syncSelectionVisuals();
        updateCalibStatus();
        renderCalibList();
      });
      calibList.appendChild(li);
    });
  }

  /* -----------------------------------------------------------
     Captura de clique sobre a superfície do modelo (hotspot)
     ----------------------------------------------------------- */
  viewer.addEventListener("click", (ev) => {
    if (mode !== "calibracao") return;
    if (ev.target.classList && ev.target.classList.contains("hotspot")) return;

    const hit = viewer.positionAndNormalFromPoint(ev.offsetX, ev.offsetY);
    if (!hit) {
      calibStatus.textContent = "Não foi possível capturar um ponto ali. Clique diretamente sobre a superfície do modelo.";
      return;
    }

    const h = findHotspot(selectedPartId);
    h.position = vecToString(hit.position);
    h.normal = vecToString(hit.normal);

    renderHotspots();
    renderCalibList();
    updateCalibStatus();
  });

  /* -----------------------------------------------------------
     Captura da posição de câmera ideal para a peça selecionada
     ----------------------------------------------------------- */
  btnCaptureCamera.addEventListener("click", () => {
    const h = findHotspot(selectedPartId);
    if (!h) return;

    const orbit = viewer.getCameraOrbit();
    const fov = viewer.getFieldOfView();

    CAMERA_PRESETS[selectedPartId] = {
      theta: +(orbit.theta * RAD).toFixed(2),
      phi: +(orbit.phi * RAD).toFixed(2),
      radius: +orbit.radius.toFixed(4),
      fov: +fov.toFixed(2),
      captured: true,
    };

    calibStatus.textContent = `Posição de câmera capturada para "${h.label}".`;
    renderCalibList();
  });

  /* -----------------------------------------------------------
     Exportar coordenadas dos hotspots
     ----------------------------------------------------------- */
  function buildExportText() {
    const lines = HOTSPOTS.map((h) => {
      const pos = h.position ? `"${h.position}"` : "null";
      const nor = h.normal ? `"${h.normal}"` : "null";
      const desc = (h.desc || "").replace(/"/g, '\\"');
      return `  { id: "${h.id}", label: "${h.label}", position: ${pos}, normal: ${nor},\n    desc: "${desc}" },`;
    });
    return "const HOTSPOTS = [\n" + lines.join("\n") + "\n];";
  }

  btnExport.addEventListener("click", () => {
    exportText.value = buildExportText();
    exportBox.hidden = false;
  });

  btnCopy.addEventListener("click", async () => {
    await copyToClipboard(exportText, btnCopy);
  });

  /* -----------------------------------------------------------
     Exportar posições de câmera calibradas
     ----------------------------------------------------------- */
  function buildCameraExportText() {
    const lines = HOTSPOTS.map((h) => {
      const p = CAMERA_PRESETS[h.id] || {};
      const theta = p.theta != null ? p.theta : 0;
      const phi = p.phi != null ? p.phi : 80;
      const radius = p.radius != null ? p.radius : "null";
      const fov = p.fov != null ? p.fov : "null";
      return `  "${h.id}": { theta: ${theta}, phi: ${phi}, radius: ${radius}, fov: ${fov} },`;
    });
    return "const CAMERA_PRESETS = {\n" + lines.join("\n") + "\n};";
  }

  btnExportCamera.addEventListener("click", () => {
    exportCameraText.value = buildCameraExportText();
    exportCameraBox.hidden = false;
  });

  btnCopyCamera.addEventListener("click", async () => {
    await copyToClipboard(exportCameraText, btnCopyCamera);
  });

  async function copyToClipboard(textarea, btn) {
    try {
      await navigator.clipboard.writeText(textarea.value);
      btn.textContent = "Copiado!";
    } catch (e) {
      textarea.select();
      document.execCommand("copy");
      btn.textContent = "Copiado!";
    }
    const original = btn === btnCopy ? "Copiar" : "Copiar";
    setTimeout(() => (btn.textContent = original), 1500);
  }

  /* -----------------------------------------------------------
     Inicialização
     ----------------------------------------------------------- */
  function init() {
    const orbit = viewer.getCameraOrbit();
    INITIAL_THETA = orbit.theta;
    INITIAL_PHI = orbit.phi;
    INITIAL_RADIUS = orbit.radius;
    INITIAL_FOV = viewer.getFieldOfView();

    buildSelect();
    buildNav();
    renderCalibList();
    renderHotspots();
    updateEmptyState();

    // Seleciona a primeira peça por padrão, sem animar (já é a vista inicial)
    selectPartAluno(HOTSPOTS[0].id, { skipAnimate: true });
  }

  if (viewer.loaded) {
    init();
  } else {
    viewer.addEventListener("load", init, { once: true });
  }
})();
