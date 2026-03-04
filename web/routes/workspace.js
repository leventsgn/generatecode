const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const EXPORT_ROOT = path.join(os.tmpdir(), 'generatecode-vscode');
const MAX_FILE_COUNT = 1200;
const MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024;
const EXPORT_TTL_MS = 12 * 60 * 60 * 1000;

function sanitizeProjectName(value) {
  const raw = String(value || '').trim();
  const normalized = raw.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'MyApi';
}

function sanitizePathSegment(segment) {
  const cleaned = String(segment || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return '';
  }

  return cleaned;
}

function toSafeRelativePath(filePath) {
  const normalizedInput = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedInput) return '';

  const segments = normalizedInput
    .split('/')
    .filter(Boolean)
    .map(sanitizePathSegment)
    .filter(Boolean);

  if (segments.length === 0) return '';
  return path.join(...segments);
}

function ensureExportRoot() {
  fs.mkdirSync(EXPORT_ROOT, { recursive: true });
}

function cleanupOldExports() {
  if (!fs.existsSync(EXPORT_ROOT)) return;

  const now = Date.now();
  const entries = fs.readdirSync(EXPORT_ROOT, { withFileTypes: true });

  entries.forEach(entry => {
    if (!entry.isDirectory()) return;

    const fullPath = path.join(EXPORT_ROOT, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > EXPORT_TTL_MS) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors so the export request can still continue.
    }
  });
}

router.post('/open-in-vscode', (req, res) => {
  const files = req.body?.files;
  const projectName = sanitizeProjectName(req.body?.projectName);

  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return res.status(400).json({ success: false, message: 'Gecersiz dosya payload.' });
  }

  const entries = Object.entries(files);
  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: 'Acilacak dosya bulunamadi.' });
  }

  if (entries.length > MAX_FILE_COUNT) {
    return res.status(400).json({
      success: false,
      message: `Dosya limiti asildi. En fazla ${MAX_FILE_COUNT} dosya desteklenir.`
    });
  }

  try {
    ensureExportRoot();
    cleanupOldExports();

    const sessionId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const workspacePath = path.join(EXPORT_ROOT, `${projectName}-${sessionId}`);
    fs.mkdirSync(workspacePath, { recursive: true });

    let filesWritten = 0;
    let filesSkipped = 0;
    let totalSize = 0;

    try {
      entries.forEach(([rawPath, content]) => {
        const safeRelativePath = toSafeRelativePath(rawPath);
        if (!safeRelativePath) {
          filesSkipped += 1;
          return;
        }

        const text = typeof content === 'string' ? content : String(content ?? '');
        totalSize += Buffer.byteLength(text, 'utf8');
        if (totalSize > MAX_TOTAL_SIZE_BYTES) {
          throw new Error('Toplam dosya boyutu limiti asildi (25MB).');
        }

        const targetPath = path.join(workspacePath, safeRelativePath);
        const relation = path.relative(workspacePath, targetPath);
        if (relation.startsWith('..') || path.isAbsolute(relation)) {
          filesSkipped += 1;
          return;
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, text, 'utf8');
        filesWritten += 1;
      });
    } catch (error) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      throw error;
    }

    if (filesWritten === 0) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      return res.status(400).json({ success: false, message: 'Yazilabilir dosya bulunamadi.' });
    }

    const vscodePath = workspacePath.replace(/\\/g, '/');
    const openUrl = `vscode://file/${encodeURI(vscodePath)}`;

    return res.json({
      success: true,
      openUrl,
      workspacePath,
      filesWritten,
      filesSkipped
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `VS Code aktarimi basarisiz: ${error.message}`
    });
  }
});

module.exports = router;
