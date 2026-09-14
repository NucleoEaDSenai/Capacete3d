/* =============================================================
   CONFIGURAÇÃO
   -------------------------------------------------------------
   CALIBRATION_ENABLED:
     - true  -> mostra o botão "Calibração" e permite ajustar os
                pontos (use isso enquanto estiver preparando o material).
     - false -> esconde totalmente o modo calibração. Use este valor
                antes de publicar/incorporar no Storyline (modo aluno "limpo").

   HOTSPOTS:
     - Lista das peças a identificar. "position" e "normal" ficam
       como null até serem calibrados no Modo Calibração.
     - Depois de calibrar e exportar, cole o array exportado aqui
       (substituindo esta lista inteira) e publique com
       CALIBRATION_ENABLED = false.
   ============================================================= */

const CALIBRATION_ENABLED = true;

const HOTSPOTS = [
  { id: "cinta-jugular",  label: "Cinta Jugular",         position: "-0.3045 0.3803 0.1613", normal: "-0.1390 0.1790 0.9740" },
  { id: "ajuste-traseiro",label: "Ajuste Traseiro",       position: "0.0000 0.4773 -0.3009", normal: "0.0220 0.8450 0.5340" },
  { id: "carneira",       label: "Carneira (Suspensão)",  position: "0.0000 0.7039 0.0819", normal: "-0.1000 -0.8110 -0.5760" },
  { id: "encaixe",        label: "Encaixe de Acessórios", position: "0.3703 0.8101 0.0205", normal: "0.6670 0.7450 -0.0180" },
  { id: "aba",            label: "Aba",                   position: "-0.0053 0.5955 0.4102", normal: "-0.0900 -0.9470 0.3070" },
  { id: "fivela",         label: "Fivela da Jugular",     position: "0.1288 0.4700 -0.2656", normal: "0.7820 -0.6150 0.1070" },
  { id: "queixeira",      label: "Queixeira",             position: "0.0043 0.0263 0.2468", normal: "0.0040 -0.6540 0.7560" },
];

/* ============================================================= */

(function () {
  "use strict";

  const viewer = document.getElementById("viewer");
  const stage = document.getElementById("stage");
  const emptyState = document.getElementById("empty-state");
  const btnOpenCalibFromEmpty = document.getElementById("btn-open-calib-from-empty");

  const tooltip = document.getElementById("tooltip");
  const tooltipText = document.getElementById("tooltip-text");
  const tooltipClose = document.getElementById("tooltip-close");

  const btnReset = document.getElementById("btn-reset");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnToggleCalib = document.getElementById("btn-toggle-calib");

  const calibPanel = document.getElementById("calib-panel");
  const selectPart = document.getElementById("select-part");
  const calibStatus = document.getElementById("calib-status");
  const calibList = document.getElementById("calib-list");
  const btnExport = document.getElementById("btn-export");
  const btnCloseCalib = document.getElementById("btn-close-calib");
  const exportBox = document.getElementById("export-box");
  const exportText = document.getElementById("export-text");
  const btnCopy = document.getElementById("btn-copy");

  const INITIAL_CAMERA_ORBIT = viewer.getAttribute("camera-orbit");
  const INITIAL_FOV = viewer.getAttribute("field-of-view");

  let mode = "aluno"; // "aluno" | "calibracao"
  let selectedPartId = HOTSPOTS[0].id;

  /* -----------------------------------------------------------
     Utilidades
     ----------------------------------------------------------- */
  function findHotspot(id) {
    return HOTSPOTS.find((h) => h.id === id);
  }

  function vecToString(v) {
    // v pode ser um objeto {x,y,z} (Vector3) do model-viewer
    return [v.x, v.y, v.z].map((n) => n.toFixed(4)).join(" ");
  }

  function hasAnyCalibrated() {
    return HOTSPOTS.some((h) => h.position);
  }

  /* -----------------------------------------------------------
     Renderização dos hotspots dentro do <model-viewer>
     (slots "hotspot-<id>", atributos data-position / data-normal)
     ----------------------------------------------------------- */
  function renderHotspots() {
    // remove hotspots antigos
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
        onHotspotClick(h.id, btn);
      });

      viewer.appendChild(btn);
    });

    updateEmptyState();
  }

  function updateEmptyState() {
    const calibrated = hasAnyCalibrated();
    emptyState.hidden = calibrated || mode === "calibracao";
    btnOpenCalibFromEmpty.hidden = !CALIBRATION_ENABLED;
  }

  function highlightHotspot(id) {
    viewer.querySelectorAll(".hotspot").forEach((el) => {
      el.classList.toggle("selected", el.dataset.partId === id && mode === "aluno");
      el.classList.toggle("calib-target", el.dataset.partId === id && mode === "calibracao");
    });
  }

  /* -----------------------------------------------------------
     Modo aluno: clique no hotspot mostra apenas o nome
     ----------------------------------------------------------- */
  function onHotspotClick(id, btnEl) {
    if (mode === "calibracao") {
      // no modo calibração, clicar num hotspot já existente apenas o seleciona
      selectPart.value = id;
      selectedPartId = id;
      highlightHotspot(id);
      updateCalibStatus();
      return;
    }

    const h = findHotspot(id);
    tooltipText.textContent = h.label;
    tooltip.hidden = false;
    highlightHotspot(id);
  }

  tooltipClose.addEventListener("click", () => {
    tooltip.hidden = true;
    highlightHotspot(null);
  });

  /* -----------------------------------------------------------
     Câmera: reset e zoom controlado
     ----------------------------------------------------------- */
  btnReset.addEventListener("click", () => {
    viewer.cameraOrbit = INITIAL_CAMERA_ORBIT;
    viewer.fieldOfView = INITIAL_FOV;
    viewer.jumpCameraToGoal();
  });

  function stepZoom(factor) {
    const orbit = viewer.getCameraOrbit(); // {theta, phi, radius}
    if (!orbit) return;
    const nextRadius = orbit.radius * factor;
    viewer.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${nextRadius}m`;
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
    btnToggleCalib.classList.toggle("active", isCalib);
    tooltip.hidden = true;

    viewer.classList.toggle("calib-cursor", isCalib);
    updateEmptyState();
    renderHotspots();
    if (isCalib) {
      highlightHotspot(selectedPartId);
      updateCalibStatus();
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
      opt.textContent = h.label + (h.position ? " ✓" : "");
      selectPart.appendChild(opt);
    });
    selectPart.value = selectedPartId;
  }

  selectPart.addEventListener("change", () => {
    selectedPartId = selectPart.value;
    highlightHotspot(selectedPartId);
    updateCalibStatus();
  });

  function updateCalibStatus() {
    const h = findHotspot(selectedPartId);
    calibStatus.textContent = h.position
      ? `"${h.label}" já calibrado. Clique novamente no modelo para reposicionar.`
      : `Clique no modelo no local correspondente a "${h.label}".`;
  }

  function renderCalibList() {
    calibList.innerHTML = "";
    HOTSPOTS.forEach((h) => {
      const li = document.createElement("li");
      li.className = h.position ? "done" : "";
      li.innerHTML = `<span class="dot"></span><span class="name">${h.label}</span>`;
      li.addEventListener("click", () => {
        selectPart.value = h.id;
        selectedPartId = h.id;
        highlightHotspot(h.id);
        updateCalibStatus();
      });
      calibList.appendChild(li);
    });
  }

  /* -----------------------------------------------------------
     Captura de clique sobre a superfície do modelo (calibração)
     ----------------------------------------------------------- */
  viewer.addEventListener("click", (ev) => {
    if (mode !== "calibracao") return;
    // ignora clique quando o alvo já é um hotspot (tratado em onHotspotClick)
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
    buildSelect();
    highlightHotspot(selectedPartId);
    updateCalibStatus();
  });

  /* -----------------------------------------------------------
     Exportar coordenadas calibradas
     ----------------------------------------------------------- */
  function buildExportText() {
    const lines = HOTSPOTS.map((h) => {
      const pos = h.position ? `"${h.position}"` : "null";
      const nor = h.normal ? `"${h.normal}"` : "null";
      return `  { id: "${h.id}", label: "${h.label}", position: ${pos}, normal: ${nor} },`;
    });
    return "const HOTSPOTS = [\n" + lines.join("\n") + "\n];";
  }

  btnExport.addEventListener("click", () => {
    exportText.value = buildExportText();
    exportBox.hidden = false;
  });

  btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportText.value);
      btnCopy.textContent = "Copiado!";
    } catch (e) {
      exportText.select();
      document.execCommand("copy");
      btnCopy.textContent = "Copiado!";
    }
    setTimeout(() => (btnCopy.textContent = "Copiar"), 1500);
  });

  /* -----------------------------------------------------------
     Inicialização
     ----------------------------------------------------------- */
  function init() {
    buildSelect();
    renderCalibList();
    renderHotspots();
    updateEmptyState();
  }

  if (viewer.loaded) {
    init();
  } else {
    viewer.addEventListener("load", init, { once: true });
  }
})();
