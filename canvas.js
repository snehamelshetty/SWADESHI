// canvas.js — stable frontend canvas logic
document.addEventListener("DOMContentLoaded", () => {

  const fileInput = document.getElementById("product-image");
  const chooseFileBtn = document.getElementById("choose-file-btn");
  const dropzone = document.getElementById("product-dropzone");
  const promptInput = document.getElementById("design-prompt");
  const generateBtn = document.getElementById("generate-canvas");
  const strengthInput = document.getElementById("canvas-strength");
  const styleSelect = document.getElementById("canvas-style");

  const imagePreview = document.getElementById("image-preview");
  const previewImg = document.getElementById("preview-img");
  const previewName = document.getElementById("preview-name");
  const removePreview = document.getElementById("remove-preview");

  const resultWrap = document.getElementById("canvas-result");
  const enhancedImg = document.getElementById("enhanced-image");
  const processingCanvas = document.getElementById("processing-canvas");
  const statusEl = document.getElementById("canvas-status");

  let selectedImageURL = null;

  /* ---------------- FILE PICKER ---------------- */
  chooseFileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
      previewName.textContent = file.name;
      imagePreview.classList.remove("hidden");
      selectedImageURL = reader.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---------------- DROPZONE ---------------- */
  dropzone.addEventListener("click", (e) => {
    if (e.target === dropzone) fileInput.click();
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-[var(--primary-color)]");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-[var(--primary-color)]");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-[var(--primary-color)]");
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
      previewName.textContent = file.name;
      imagePreview.classList.remove("hidden");
      selectedImageURL = reader.result;
    };
    reader.readAsDataURL(file);
  });

  removePreview.addEventListener("click", () => {
    fileInput.value = "";
    imagePreview.classList.add("hidden");
    previewImg.src = "#";
    selectedImageURL = null;
  });

  /* ---------------- LOCAL ENHANCEMENT ---------------- */
  function enhanceImage(img, strength, style) {
    const canvas = processingCanvas;
    const ctx = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    ctx.filter =
      style === "vintage"
        ? `contrast(${100 + strength}%) saturate(${80}%) sepia(30%)`
        : style === "artistic"
        ? `contrast(${100 + strength}%) saturate(${120 + strength}%)`
        : `contrast(${100 + strength}%)`;

    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  /* ---------------- PROMPT PARSING & SIMULATION ---------------- */
  function parsePromptAdjustments(prompt) {
    const p = (prompt || '').toLowerCase();
    const adj = { brightness: 0, contrast: 0, saturate: 0, tint: null, vintage: false, text: null };
    if (/bright|brighter|brighten/.test(p)) adj.brightness += 15;
    if (/dark|darker/.test(p)) adj.brightness -= 15;
    if (/vivid|vibrant|festive/.test(p)) adj.saturate += 25;
    if (/muted|desaturate|soft/.test(p)) adj.saturate -= 25;
    if (/vintage|retro|sepia/.test(p)) { adj.vintage = true; adj.saturate -= 10; adj.brightness -= 5; }
    if (/warm|warmth|gold|orange/.test(p)) adj.tint = { r: 255, g: 150, b: 50, a: 0.07 };
    if (/cool|blue|cooler/.test(p)) adj.tint = { r: 60, g: 120, b: 255, a: 0.06 };
    const textMatch = prompt.match(/text[:=]\s*['"]([^'"]+)['"]/i) || prompt.match(/with text ['"]([^'"]+)['"]/i);
    if (textMatch) adj.text = textMatch[1];
    return adj;
  }

  function simulatePromptEffect(img, prompt, strength = 50, style = 'natural') {
    const canvas = processingCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    // base draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const adj = parsePromptAdjustments(prompt);

    // compute CSS-like filter parameters
    const b = 1 + (adj.brightness / 100) + ((strength - 50) / 400);
    const c = 1 + ((strength - 50) / 180);
    const s = 1 + (adj.saturate / 100) + (style === 'artistic' ? 0.15 : 0);

    // apply filters by drawing to an offscreen canvas with ctx.filter
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
    tctx.drawImage(canvas, 0, 0);

    // copy back
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);

    // vintage/sepia tint
    if (adj.vintage) {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(112,66,20,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    // color tint overlay
    if (adj.tint) {
      ctx.fillStyle = `rgba(${adj.tint.r},${adj.tint.g},${adj.tint.b},${adj.tint.a})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // prompt text overlay (if requested)
    if (adj.text) {
      const fontSize = Math.max(18, Math.floor(canvas.width / 22));
      ctx.font = `${fontSize}px 'Playfair Display', serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(adj.text, canvas.width / 2, canvas.height - fontSize - 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeText(adj.text, canvas.width / 2, canvas.height - fontSize - 16);
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  }

  /* ---------------- GENERATE ---------------- */
  generateBtn.addEventListener('click', async () => {
    if (!selectedImageURL) { alert('Upload an image first'); return; }

    const mode = document.querySelector('input[name="canvas-mode"]:checked')?.value || 'local';
    const prompt = promptInput.value.trim();
    const strength = Number(strengthInput.value);
    const style = styleSelect.value;

    statusEl.textContent = mode === 'ai' ? 'Generating AI (simulated)…' : 'Processing…';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (mode === 'local') {
          const result = enhanceImage(img, strength, style);
          enhancedImg.src = result;
          statusEl.textContent = 'Done ✅';
        } else {
          // AI mode — simulate prompt effects client-side immediately
          const simulated = simulatePromptEffect(img, prompt, strength, style);
          enhancedImg.src = simulated;
          statusEl.textContent = 'Simulated AI result (no backend configured)';
        }
        resultWrap.classList.remove('hidden');
      } catch (err) {
        console.error('Generate error', err);
        alert('Generation failed — see console');
        statusEl.textContent = 'Idle';
      }
    };
    img.onerror = () => { alert('Could not load image for processing'); statusEl.textContent = 'Idle'; };
    img.src = selectedImageURL;
  });

});
