const fileInput = document.getElementById('fileInput');
const reduceBtn = document.getElementById('reduceBtn');
const downloadBtn = document.getElementById('downloadBtn');
const maxWidthEl = document.getElementById('maxWidth');
const maxHeightEl = document.getElementById('maxHeight');
const qualityEl = document.getElementById('quality');
const qualityVal = document.getElementById('qualityVal');
const formatEl = document.getElementById('format');

const origImg = document.getElementById('origImg');
const reImg = document.getElementById('reImg');
const origMeta = document.getElementById('origMeta');
const reMeta = document.getElementById('reMeta');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let originalFile = null;
let reducedBlob = null;
let reducedName = 'reduced-image';

qualityEl.addEventListener('input', () => {
  qualityVal.textContent = Number(qualityEl.value).toFixed(2);
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  originalFile = file;
  reducedBlob = null;
  downloadBtn.disabled = true;

  // Preview original
  const url = URL.createObjectURL(file);
  origImg.src = url;
  origImg.onload = () => URL.revokeObjectURL(url);

  // Show original meta
  const imgMeta = await readImageMeta(file);
  origMeta.textContent = `${imgMeta.width} x ${imgMeta.height} • ${formatBytes(file.size)}`;

  reduceBtn.disabled = false;
  reImg.src = '';
  reMeta.textContent = '—';
});

reduceBtn.addEventListener('click', async () => {
  if (!originalFile) return;
  const targetType = formatEl.value; // 'image/jpeg' | 'image/png' | 'image/webp'
  const quality = Number(qualityEl.value);
  const maxW = clampInt(maxWidthEl.value, 50, 20000);
  const maxH = clampInt(maxHeightEl.value, 50, 20000);

  try {
    const { blob, width, height } = await resizeImageFile(originalFile, { maxW, maxH, type: targetType, quality });
    reducedBlob = blob;
    reducedName = (originalFile.name.replace(/\.[^.]+$/, '') || 'image') + extFromType(targetType);

    const url = URL.createObjectURL(blob);
    reImg.src = url;
    reImg.onload = () => URL.revokeObjectURL(url);

    reMeta.textContent = `${width} x ${height} • ${formatBytes(blob.size)}`;
    downloadBtn.disabled = false;
  } catch (err) {
    console.error(err);
    alert('Failed to process image.');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!reducedBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(reducedBlob);
  a.download = reducedName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
});

/* Helpers */

function clampInt(val, min, max) {
  const n = Math.max(min, Math.min(max, parseInt(val || min, 10)));
  return isFinite(n) ? n : min;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function extFromType(type) {
  switch (type) {
    case 'image/jpeg': return '.jpg';
    case 'image/png':  return '.png';
    case 'image/webp': return '.webp';
    default: return '.img';
  }
}

function readImageMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function resizeImageFile(file, { maxW, maxH, type = 'image/jpeg', quality = 0.8 }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Handle orientation for iOS/EXIF by drawing as-is (basic approach).
    img.onload = () => {
      let { width, height } = img;

      // Maintain aspect ratio within bounds
      const ratio = Math.min(maxW / width, maxH / height, 1);
      const newW = Math.round(width * ratio);
      const newH = Math.round(height * ratio);

      canvas.width = newW;
      canvas.height = newH;

      // Draw
      ctx.clearRect(0, 0, newW, newH);
      ctx.drawImage(img, 0, 0, newW, newH);

      // Export
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve({ blob, width: newW, height: newH });
        },
        type,
        type === 'image/jpeg' || type === 'image/webp' ? quality : undefined
      );
    };
    img.onerror = reject;

    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
