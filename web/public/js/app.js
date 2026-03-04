// Application state
const state = {
  tables: [],
  dtos: [],
  generatedFiles: {},
  currentFile: null,
  editingTableIndex: -1,
  editingDtoIndex: -1,
  standards: [],
  selectedStandardId: '',
  designStandards: [],
  selectedDesignStandardId: '',
  generatedDesignDocument: null,
  generatedConformanceReport: null,
  generatedAdrPack: [],
  generatedDiagramPack: null,
  generatedRequirementsAnalysis: null,
  generatedTaskPlan: null,
  taskBoard: [],
  taskBoardSelectedIds: [],
  isConfigCollapsed: false,
  isZenMode: false,
  workbenchLeftRatio: 0.38
};

const STORAGE_KEY = 'generatecode_workspace_v4';

const STARTER_PRESETS = {
  webapi: {
    label: 'Web API',
    projectType: 'webapi',
    targetTab: '#tabTables',
    summary: 'API odakli akis acilir. Ilk adim olarak tablo ve DTO tanimlariyla baslanir.'
  },
  windowsservice: {
    label: 'Windows Service',
    projectType: 'windowsservice',
    targetTab: '#tabSettings',
    summary: 'Uzun sure calisan servis senaryolari icin ayarlar odakli akis acilir.'
  },
  worker: {
    label: 'Worker Service',
    projectType: 'worker',
    targetTab: '#tabSettings',
    summary: 'Queue, scheduler ve background job isleri icin worker tipi secilir.'
  },
  grpc: {
    label: 'gRPC Service',
    projectType: 'grpc',
    targetTab: '#tabSettings',
    summary: 'Proto tabanli, yuksek performansli servis akisi hazirlanir.'
  },
  console: {
    label: 'Console App',
    projectType: 'console',
    targetTab: '#tabSettings',
    summary: 'CLI ve arac odakli bir baslangic profili secilir.'
  },
  library: {
    label: 'Class Library',
    projectType: 'library',
    targetTab: '#tabSettings',
    summary: 'Tekrar kullanilabilir kutuphane yapisi icin baslangic ayarlari acilir.'
  },
  documentation: {
    label: 'Dokuman Akisi',
    projectType: null,
    targetTab: '#tabStandards',
    summary: 'Kod uretiminden bagimsiz olarak standart, tasarim ve dokuman akisina gecilir.'
  }
};

// ==================== UTIL ====================

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'position-fixed bottom-0 end-0 p-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `<div class="toast show" role="alert"><div class="toast-body">${escapeHtml(message)}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const TURKISH_CHAR_FOLD_MAP = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u'
};

function normalizeForSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, char => TURKISH_CHAR_FOLD_MAP[char] || char)
    .trim();
}

function toPascalCase(text) {
  return text.replace(/(^|_)(\w)/g, (_, __, ch) => ch.toUpperCase());
}

function toDisplayDate(value) {
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function shouldAnalyzeFile(path) {
  const lower = normalizePath(path).toLowerCase();
  return (
    lower.endsWith('.csproj') ||
    lower.endsWith('.cs') ||
    lower.endsWith('.sln') ||
    lower.endsWith('.editorconfig') ||
    lower.endsWith('appsettings.json')
  );
}

function shouldAnalyzeDesignFile(path) {
  const lower = normalizePath(path).toLowerCase();
  const blockedParts = ['/bin/', '/obj/', '/.git/', '/node_modules/', '/dist/', '/out/'];
  if (blockedParts.some(part => lower.includes(part))) {
    return false;
  }

  return (
    lower.endsWith('.csproj') ||
    lower.endsWith('.cs') ||
    lower.endsWith('.sln') ||
    lower.endsWith('.editorconfig') ||
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.http') ||
    lower.endsWith('.xml')
  );
}

function findFirstMatch(text, regex, defaultValue = '') {
  const match = (text || '').match(regex);
  return match ? match[1].trim() : defaultValue;
}

function mapDbProviderFromCode(content) {
  const code = content || '';
  if (/UseSqlServer\s*\(/i.test(code)) return 'SqlServer';
  if (/UseNpgsql\s*\(/i.test(code)) return 'PostgreSQL';
  if (/UseMySql\s*\(/i.test(code)) return 'MySQL';
  if (/UseInMemoryDatabase\s*\(/i.test(code)) return 'InMemory';
  return 'InMemory';
}

function detectRouteCase(routes) {
  if (!routes.length) return 'kebab';
  if (routes.some(route => route.includes('-'))) return 'kebab';
  if (routes.some(route => /[A-Z]/.test(route))) return 'camel';
  return 'lower';
}

function inferRoutePrefix(routes) {
  if (!routes.length) return 'api';
  const route = routes.find(Boolean);
  if (!route) return 'api';
  const normalized = route.replace(/^\/+/, '');
  const firstSegment = normalized.split('/')[0];
  return firstSegment || 'api';
}

function getProjectRootName(files) {
  if (!files.length) return 'ImportedProject';
  const first = normalizePath(files[0].path);
  const root = first.split('/')[0];
  return root || 'ImportedProject';
}

function getLlmRuntimeConfig() {
  const baseUrl = document.getElementById('llmBaseUrl')?.value?.trim() || '';
  const model = document.getElementById('llmModel')?.value?.trim() || '';
  const apiKey = document.getElementById('llmApiKey')?.value?.trim() || '';
  return { baseUrl, model, apiKey };
}

function getConfigSnapshot() {
  return {
    projectType: document.getElementById('projectType')?.value || 'webapi',
    projectName: document.getElementById('projectName').value || 'MyApi',
    rootNamespace: document.getElementById('rootNamespace').value || 'MyApi',
    targetDbProvider: document.getElementById('targetDbProvider').value,
    targetFramework: document.getElementById('targetFramework').value,
    optSwagger: document.getElementById('optSwagger').checked,
    optFluentValidation: document.getElementById('optFluentValidation').checked,
    optAutoMapper: document.getElementById('optAutoMapper').checked,
    optAuthPack: document.getElementById('optAuthPack')?.checked || false,
    optProductionPack: document.getElementById('optProductionPack')?.checked || false,
    optTestGeneration: document.getElementById('optTestGeneration')?.checked || false,
    optEfMigrations: document.getElementById('optEfMigrations')?.checked || false,
    optPostmanExport: document.getElementById('optPostmanExport')?.checked || false,
    dbProvider: document.getElementById('dbProvider').value,
    dbHost: document.getElementById('dbHost').value,
    dbPort: document.getElementById('dbPort').value,
    dbName: document.getElementById('dbName').value,
    dbUser: document.getElementById('dbUser').value,
    dbPassword: document.getElementById('dbPassword').value,
    llmBaseUrl: document.getElementById('llmBaseUrl')?.value || 'https://api.groq.com/openai/v1',
    llmModel: document.getElementById('llmModel')?.value || 'openai/gpt-oss-120b',
    llmApiKey: document.getElementById('llmApiKey')?.value || '',
    selectedStandardId: state.selectedStandardId || '',
    selectedDesignStandardId: state.selectedDesignStandardId || '',
    designStandardName: document.getElementById('designStandardNameInput')?.value || '',
    designDocTitle: document.getElementById('designDocTitleInput')?.value || '',
    adrCount: document.getElementById('adrCountInput')?.value || '3',
    requirementsContext: document.getElementById('requirementsContextInput')?.value || '',
    taskBoardSearch: document.getElementById('taskBoardSearch')?.value || '',
    taskBoardStatusFilter: document.getElementById('taskBoardStatusFilter')?.value || 'All',
    taskBoardSort: document.getElementById('taskBoardSort')?.value || 'TaskId',
    taskBoardBulkStatus: document.getElementById('taskBoardBulkStatus')?.value || 'Todo',
    isConfigCollapsed: state.isConfigCollapsed,
    isZenMode: state.isZenMode,
    workbenchLeftRatio: state.workbenchLeftRatio
  };
}

function buildWorkspacePayload() {
  return {
    config: getConfigSnapshot(),
    tables: state.tables,
    dtos: state.dtos,
    standards: state.standards,
    selectedStandardId: state.selectedStandardId,
    designStandards: state.designStandards,
    selectedDesignStandardId: state.selectedDesignStandardId,
    generatedDesignDocument: state.generatedDesignDocument,
    generatedConformanceReport: state.generatedConformanceReport,
    generatedAdrPack: state.generatedAdrPack,
    generatedDiagramPack: state.generatedDiagramPack,
    generatedRequirementsAnalysis: state.generatedRequirementsAnalysis,
    generatedTaskPlan: state.generatedTaskPlan,
    taskBoard: state.taskBoard,
    taskBoardSelectedIds: state.taskBoardSelectedIds,
    generatedFiles: state.generatedFiles,
    currentFile: state.currentFile
  };
}

function applyConfigSnapshot(snapshot = {}) {
  const defaults = {
    projectType: 'webapi',
    projectName: 'MyApi',
    rootNamespace: 'MyApi',
    targetDbProvider: 'InMemory',
    targetFramework: 'net8.0',
    optSwagger: true,
    optFluentValidation: false,
    optAutoMapper: false,
    optAuthPack: false,
    optProductionPack: false,
    optTestGeneration: false,
    optEfMigrations: false,
    optPostmanExport: false,
    dbProvider: 'postgresql',
    dbHost: 'localhost',
    dbPort: '5432',
    dbName: '',
    dbUser: '',
    dbPassword: '',
    llmBaseUrl: 'https://api.groq.com/openai/v1',
    llmModel: 'openai/gpt-oss-120b',
    llmApiKey: '',
    selectedStandardId: '',
    selectedDesignStandardId: '',
    designStandardName: '',
    designDocTitle: '',
    adrCount: '3',
    requirementsContext: '',
    taskBoardSearch: '',
    taskBoardStatusFilter: 'All',
    taskBoardSort: 'TaskId',
    taskBoardBulkStatus: 'Todo',
    isConfigCollapsed: false,
    isZenMode: false,
    workbenchLeftRatio: 0.38
  };

  const cfg = { ...defaults, ...snapshot };
  const projectTypeInput = document.getElementById('projectType');
  if (projectTypeInput) projectTypeInput.value = cfg.projectType;
  document.getElementById('projectName').value = cfg.projectName;
  document.getElementById('rootNamespace').value = cfg.rootNamespace;
  document.getElementById('targetDbProvider').value = cfg.targetDbProvider;
  document.getElementById('targetFramework').value = cfg.targetFramework;
  document.getElementById('optSwagger').checked = cfg.optSwagger;
  document.getElementById('optFluentValidation').checked = cfg.optFluentValidation;
  document.getElementById('optAutoMapper').checked = cfg.optAutoMapper;
  const optAuthPack = document.getElementById('optAuthPack');
  const optProductionPack = document.getElementById('optProductionPack');
  const optTestGeneration = document.getElementById('optTestGeneration');
  const optEfMigrations = document.getElementById('optEfMigrations');
  const optPostmanExport = document.getElementById('optPostmanExport');
  if (optAuthPack) optAuthPack.checked = cfg.optAuthPack;
  if (optProductionPack) optProductionPack.checked = cfg.optProductionPack;
  if (optTestGeneration) optTestGeneration.checked = cfg.optTestGeneration;
  if (optEfMigrations) optEfMigrations.checked = cfg.optEfMigrations;
  if (optPostmanExport) optPostmanExport.checked = cfg.optPostmanExport;
  document.getElementById('dbProvider').value = cfg.dbProvider;
  document.getElementById('dbHost').value = cfg.dbHost;
  document.getElementById('dbPort').value = cfg.dbPort;
  document.getElementById('dbName').value = cfg.dbName;
  document.getElementById('dbUser').value = cfg.dbUser;
  document.getElementById('dbPassword').value = cfg.dbPassword;
  const llmBaseUrlInput = document.getElementById('llmBaseUrl');
  const llmModelInput = document.getElementById('llmModel');
  const llmApiKeyInput = document.getElementById('llmApiKey');
  if (llmBaseUrlInput) llmBaseUrlInput.value = cfg.llmBaseUrl;
  if (llmModelInput) llmModelInput.value = cfg.llmModel;
  if (llmApiKeyInput) llmApiKeyInput.value = cfg.llmApiKey;
  const designStandardNameInput = document.getElementById('designStandardNameInput');
  const designDocTitleInput = document.getElementById('designDocTitleInput');
  const adrCountInput = document.getElementById('adrCountInput');
  const requirementsContextInput = document.getElementById('requirementsContextInput');
  const taskBoardSearchInput = document.getElementById('taskBoardSearch');
  const taskBoardStatusFilterInput = document.getElementById('taskBoardStatusFilter');
  const taskBoardSortInput = document.getElementById('taskBoardSort');
  const taskBoardBulkStatusInput = document.getElementById('taskBoardBulkStatus');
  if (designStandardNameInput) designStandardNameInput.value = cfg.designStandardName;
  if (designDocTitleInput) designDocTitleInput.value = cfg.designDocTitle;
  if (adrCountInput) adrCountInput.value = cfg.adrCount;
  if (requirementsContextInput) requirementsContextInput.value = cfg.requirementsContext;
  if (taskBoardSearchInput) taskBoardSearchInput.value = cfg.taskBoardSearch;
  if (taskBoardStatusFilterInput) taskBoardStatusFilterInput.value = cfg.taskBoardStatusFilter;
  if (taskBoardSortInput) taskBoardSortInput.value = cfg.taskBoardSort;
  if (taskBoardBulkStatusInput) taskBoardBulkStatusInput.value = cfg.taskBoardBulkStatus;
  state.selectedStandardId = cfg.selectedStandardId || '';
  state.selectedDesignStandardId = cfg.selectedDesignStandardId || '';
  state.isConfigCollapsed = Boolean(cfg.isConfigCollapsed);
  state.isZenMode = Boolean(cfg.isZenMode);
  const parsedWorkbenchLeftRatio = Number(cfg.workbenchLeftRatio);
  state.workbenchLeftRatio = Number.isFinite(parsedWorkbenchLeftRatio) ? parsedWorkbenchLeftRatio : 0.38;
  applyLayoutState();
}

function persistWorkspace() {
  const payload = buildWorkspacePayload();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function applyWorkspacePayload(payload = {}, options = {}) {
  const opts = {
    persist: false,
    showToast: false,
    toastMessage: 'Çalışma yüklendi.',
    ...options
  };

  applyConfigSnapshot(payload.config || {});
  state.tables = Array.isArray(payload.tables) ? payload.tables : [];
  state.dtos = Array.isArray(payload.dtos) ? payload.dtos : [];
  state.standards = Array.isArray(payload.standards) ? payload.standards : [];
  state.selectedStandardId = payload.selectedStandardId || payload.config?.selectedStandardId || state.selectedStandardId;
  state.designStandards = Array.isArray(payload.designStandards) ? payload.designStandards : [];
  state.selectedDesignStandardId = payload.selectedDesignStandardId || payload.config?.selectedDesignStandardId || '';
  state.generatedDesignDocument = payload.generatedDesignDocument || null;
  state.generatedConformanceReport = payload.generatedConformanceReport || null;
  state.generatedAdrPack = Array.isArray(payload.generatedAdrPack) ? payload.generatedAdrPack : [];
  state.generatedDiagramPack = payload.generatedDiagramPack || null;
  state.generatedRequirementsAnalysis = payload.generatedRequirementsAnalysis || null;
  state.generatedTaskPlan = payload.generatedTaskPlan || null;
  state.taskBoard = Array.isArray(payload.taskBoard) ? payload.taskBoard : [];
  state.taskBoardSelectedIds = Array.isArray(payload.taskBoardSelectedIds) ? payload.taskBoardSelectedIds : [];
  state.generatedFiles = payload.generatedFiles && typeof payload.generatedFiles === 'object' ? payload.generatedFiles : {};
  state.currentFile = typeof payload.currentFile === 'string' ? payload.currentFile : null;

  renderTables();
  renderDtos();
  renderStandardSelects();
  renderDesignStandardSelects();
  renderDesignDocumentPreview();
  renderConformancePreview();
  renderAdrPackPreview();
  renderDiagramPackPreview();
  renderRequirementsPreview();
  renderTaskPlanPreview();
  renderTaskBoard();
  if (Object.keys(state.generatedFiles).length > 0) {
    renderGeneratedCode();
  } else {
    clearGeneratedView();
  }
  updateStats();

  if (opts.persist) {
    persistWorkspace();
  }
  if (opts.showToast) {
    showToast(opts.toastMessage);
  }
}

function restoreWorkspace() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem('generatecode_workspace_v3');
    }
    if (!raw) {
      return false;
    }
    const payload = JSON.parse(raw);
    applyWorkspacePayload(payload, { persist: false, showToast: false });
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function clearGeneratedView() {
  state.generatedFiles = {};
  state.currentFile = null;
  const explorer = document.getElementById('fileExplorer');
  if (explorer) {
    explorer.innerHTML = `
      <div class="explorer-header">DOSYALAR</div>
      <div class="file-explorer-empty">Henüz üretilmiş dosya yok.</div>
    `;
  }
  document.getElementById('codeContainer').innerHTML = `
    <div class="empty-state text-center py-5">
      <i class="bi bi-code-square display-4"></i>
      <p class="mt-3 mb-1">Sol panelden tablo/DTO ekleyip uretime basla.</p>
      <small>Ornek baslangic icin "Ornek Sema Yukle" butonunu kullanabilirsin.</small>
    </div>
  `;
}

function updateStats() {
  document.getElementById('statTables').textContent = String(state.tables.length);
  document.getElementById('statDtos').textContent = String(state.dtos.length);
  document.getElementById('statFiles').textContent = String(Object.keys(state.generatedFiles).length);
  document.getElementById('generatedFileCount').textContent = `${Object.keys(state.generatedFiles).length} dosya`;
  updateStatusBar();
}

function updateStatusBar() {
  const projectTypeSelect = document.getElementById('projectType');
  const activeTabText = document.getElementById('activeTabLabel')?.textContent?.trim() || 'Tablolar';
  const projectTypeText = projectTypeSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Web API';
  const activeStandard = getActiveStandardProfile();
  const generatedFileCount = Object.keys(state.generatedFiles).length;
  const currentFileText = state.currentFile || '-';
  const layoutText = state.isZenMode ? 'Zen' : state.isConfigCollapsed ? 'Kod Odakli' : 'Normal';

  const statusActiveTab = document.getElementById('statusActiveTab');
  const statusProjectType = document.getElementById('statusProjectType');
  const statusActiveStandard = document.getElementById('statusActiveStandard');
  const statusLayout = document.getElementById('statusLayout');
  const statusCurrentFile = document.getElementById('statusCurrentFile');
  const statusGeneratedCount = document.getElementById('statusGeneratedCount');

  if (statusActiveTab) statusActiveTab.textContent = `Tab: ${activeTabText}`;
  if (statusProjectType) statusProjectType.textContent = `Tip: ${projectTypeText}`;
  if (statusActiveStandard) statusActiveStandard.textContent = `Standart: ${activeStandard?.name || 'Yok'}`;
  if (statusLayout) statusLayout.textContent = `Mod: ${layoutText}`;
  if (statusCurrentFile) statusCurrentFile.textContent = `Dosya: ${currentFileText}`;
  if (statusGeneratedCount) statusGeneratedCount.textContent = `${generatedFileCount} dosya`;
}

const WORKBENCH_SPLIT_CONFIG = {
  defaultRatio: 0.38,
  minRatio: 0.26,
  maxRatio: 0.72,
  minLeftPx: 300,
  minRightPx: 420
};

let workbenchResizeSession = null;

function getWorkbenchSplitBounds() {
  const workbench = document.querySelector('.workbench-layout');
  if (!workbench) return null;

  const rect = workbench.getBoundingClientRect();
  if (!rect.width) return null;

  const minRatio = Math.max(WORKBENCH_SPLIT_CONFIG.minRatio, WORKBENCH_SPLIT_CONFIG.minLeftPx / rect.width);
  const maxRatio = Math.min(WORKBENCH_SPLIT_CONFIG.maxRatio, 1 - (WORKBENCH_SPLIT_CONFIG.minRightPx / rect.width));

  if (minRatio >= maxRatio) return null;

  return { workbench, rect, minRatio, maxRatio };
}

function clampWorkbenchRatio(ratio, bounds = null) {
  const numeric = Number.isFinite(Number(ratio)) ? Number(ratio) : WORKBENCH_SPLIT_CONFIG.defaultRatio;
  if (!bounds) {
    return Math.min(WORKBENCH_SPLIT_CONFIG.maxRatio, Math.max(WORKBENCH_SPLIT_CONFIG.minRatio, numeric));
  }
  return Math.min(bounds.maxRatio, Math.max(bounds.minRatio, numeric));
}

function applyWorkbenchSplit(bounds = null) {
  const workbench = document.querySelector('.workbench-layout');
  if (!workbench) return;

  const activeBounds = bounds || getWorkbenchSplitBounds();
  const ratio = clampWorkbenchRatio(state.workbenchLeftRatio, activeBounds);
  state.workbenchLeftRatio = ratio;
  workbench.style.setProperty('--left-pane-width', `${(ratio * 100).toFixed(2)}%`);

  const resizer = document.getElementById('workbenchResizer');
  if (resizer) {
    const min = activeBounds ? Math.round(activeBounds.minRatio * 100) : Math.round(WORKBENCH_SPLIT_CONFIG.minRatio * 100);
    const max = activeBounds ? Math.round(activeBounds.maxRatio * 100) : Math.round(WORKBENCH_SPLIT_CONFIG.maxRatio * 100);
    resizer.setAttribute('aria-valuemin', String(min));
    resizer.setAttribute('aria-valuemax', String(max));
    resizer.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  }
}

function startWorkbenchResize(event) {
  if (state.isZenMode || state.isConfigCollapsed || window.matchMedia('(max-width: 991px)').matches) return;

  const bounds = getWorkbenchSplitBounds();
  if (!bounds) return;

  event.preventDefault();
  workbenchResizeSession = bounds;
  bounds.workbench.classList.add('is-resizing');
  window.addEventListener('pointermove', onWorkbenchResizeMove);
  window.addEventListener('pointerup', stopWorkbenchResize);
  window.addEventListener('pointercancel', stopWorkbenchResize);
}

function onWorkbenchResizeMove(event) {
  if (!workbenchResizeSession) return;

  const { rect, minRatio, maxRatio } = workbenchResizeSession;
  const nextRatio = (event.clientX - rect.left) / rect.width;
  state.workbenchLeftRatio = Math.min(maxRatio, Math.max(minRatio, nextRatio));
  applyWorkbenchSplit(workbenchResizeSession);
}

function stopWorkbenchResize() {
  if (!workbenchResizeSession) return;

  const activeSession = workbenchResizeSession;
  workbenchResizeSession = null;
  activeSession.workbench.classList.remove('is-resizing');
  window.removeEventListener('pointermove', onWorkbenchResizeMove);
  window.removeEventListener('pointerup', stopWorkbenchResize);
  window.removeEventListener('pointercancel', stopWorkbenchResize);
  persistWorkspace();
}

function handleWorkbenchResizerKeydown(event) {
  if (state.isZenMode || state.isConfigCollapsed || window.matchMedia('(max-width: 991px)').matches) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  event.preventDefault();
  const step = event.shiftKey ? 0.04 : 0.02;
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const bounds = getWorkbenchSplitBounds();
  state.workbenchLeftRatio = clampWorkbenchRatio(state.workbenchLeftRatio + (step * direction), bounds);
  applyWorkbenchSplit(bounds);
  persistWorkspace();
}

function applyLayoutState() {
  const workbench = document.querySelector('.workbench-layout');
  if (workbench) {
    workbench.classList.toggle('config-collapsed', state.isConfigCollapsed && !state.isZenMode);
  }
  document.body.classList.toggle('zen-mode', state.isZenMode);
  applyWorkbenchSplit();
  updateLayoutControls();
  updateStatusBar();
}

function updateLayoutControls() {
  const configBtn = document.getElementById('toggleConfigPaneBtn');
  const zenBtn = document.getElementById('toggleZenModeBtn');

  if (configBtn) {
    const collapsed = state.isConfigCollapsed || state.isZenMode;
    configBtn.innerHTML = collapsed
      ? '<i class="bi bi-layout-sidebar"></i><span class="btn-label">Sol Paneli Ac</span>'
      : '<i class="bi bi-layout-sidebar-inset"></i><span class="btn-label">Sol Panel</span>';
    configBtn.title = collapsed ? 'Sol Paneli Ac (Ctrl/Cmd + B)' : 'Sol Paneli Gizle (Ctrl/Cmd + B)';
    configBtn.setAttribute('aria-label', collapsed ? 'Sol Paneli Ac' : 'Sol Paneli Gizle');
    configBtn.disabled = state.isZenMode;
  }

  if (zenBtn) {
    zenBtn.innerHTML = state.isZenMode
      ? '<i class="bi bi-fullscreen-exit"></i><span class="btn-label">Zen Cik</span>'
      : '<i class="bi bi-arrows-fullscreen"></i><span class="btn-label">Zen</span>';
    zenBtn.title = state.isZenMode ? 'Zen Modundan Cik (Ctrl + Alt + Z)' : 'Zen Moda Gec (Ctrl + Alt + Z)';
    zenBtn.setAttribute('aria-label', state.isZenMode ? 'Zen Modundan Cik' : 'Zen Moda Gec');
  }
}

function toggleConfigPane() {
  if (state.isZenMode) return;
  state.isConfigCollapsed = !state.isConfigCollapsed;
  applyLayoutState();
  persistWorkspace();
}

function toggleZenMode(forceValue = null) {
  state.isZenMode = typeof forceValue === 'boolean' ? forceValue : !state.isZenMode;
  applyLayoutState();
  persistWorkspace();
}

function openConfigTab(tabTarget) {
  const normalizedTarget = String(tabTarget || '').startsWith('#') ? String(tabTarget) : `#${String(tabTarget || '')}`;
  const trigger = document.querySelector(`#configTabs .nav-link[data-bs-target="${normalizedTarget}"]`);
  if (!trigger) return;
  bootstrap.Tab.getOrCreateInstance(trigger).show();
}

function normalizeProjectIdentifier(value, fallback = 'MyApi') {
  const text = String(value || '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();

  if (!text) return fallback;

  const token = text
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (!token) return fallback;
  return /^\d/.test(token) ? `Project${token}` : token;
}

function setStarterPreset(presetKey = 'webapi') {
  const safePreset = STARTER_PRESETS[presetKey] ? presetKey : 'webapi';
  const preset = STARTER_PRESETS[safePreset];

  const presetInput = document.getElementById('starterPresetInput');
  const summary = document.getElementById('starterPresetSummary');
  const frameworkSelect = document.getElementById('starterFramework');

  if (presetInput) presetInput.value = safePreset;
  if (summary) summary.textContent = preset.summary;
  if (frameworkSelect) frameworkSelect.disabled = !preset.projectType;

  document.querySelectorAll('#starterPresetGrid .starter-template').forEach(button => {
    button.classList.toggle('active', button.dataset.preset === safePreset);
  });
}

function openStarterModal() {
  const modalElement = document.getElementById('projectStartModal');
  if (!modalElement) return;

  const projectType = document.getElementById('projectType')?.value || 'webapi';
  const activeTab = document.querySelector('#configTabs .nav-link.active')?.getAttribute('data-bs-target') || '';
  const defaultPreset = activeTab === '#tabStandards'
    ? 'documentation'
    : (STARTER_PRESETS[projectType] ? projectType : 'webapi');

  const starterProjectName = document.getElementById('starterProjectName');
  const starterNamespace = document.getElementById('starterNamespace');
  const starterFramework = document.getElementById('starterFramework');
  const starterClearWorkspace = document.getElementById('starterClearWorkspace');

  if (starterProjectName) {
    const currentProjectName = document.getElementById('projectName')?.value || 'MyApi';
    starterProjectName.value = currentProjectName;
  }
  if (starterNamespace) {
    const currentNamespace = document.getElementById('rootNamespace')?.value || 'MyApi';
    starterNamespace.value = currentNamespace;
  }
  if (starterFramework) {
    const currentFramework = document.getElementById('targetFramework')?.value || 'net8.0';
    starterFramework.value = currentFramework;
  }
  if (starterClearWorkspace) {
    starterClearWorkspace.checked = hasWorkspaceData();
  }

  setStarterPreset(defaultPreset);
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function hideStarterModal() {
  const modalElement = document.getElementById('projectStartModal');
  if (!modalElement) return;
  const modalInstance = bootstrap.Modal.getInstance(modalElement);
  if (modalInstance) {
    modalInstance.hide();
  }
}

function clearWorkspaceForStarter() {
  state.tables = [];
  state.dtos = [];
  state.generatedFiles = {};
  state.currentFile = null;
  state.editingTableIndex = -1;
  state.editingDtoIndex = -1;
  state.generatedDesignDocument = null;
  state.generatedConformanceReport = null;
  state.generatedAdrPack = [];
  state.generatedDiagramPack = null;
  state.generatedRequirementsAnalysis = null;
  state.generatedTaskPlan = null;
  state.taskBoard = [];
  state.taskBoardSelectedIds = [];

  const tableSearch = document.getElementById('tableSearch');
  const dtoSearch = document.getElementById('dtoSearch');
  const dbStatus = document.getElementById('dbStatus');
  const dbTablesList = document.getElementById('dbTablesList');
  if (tableSearch) tableSearch.value = '';
  if (dtoSearch) dtoSearch.value = '';
  if (dbStatus) dbStatus.innerHTML = '';
  if (dbTablesList) dbTablesList.innerHTML = '';

  renderTables();
  renderDtos();
  renderDesignDocumentPreview();
  renderConformancePreview();
  renderAdrPackPreview();
  renderDiagramPackPreview();
  renderRequirementsPreview();
  renderTaskPlanPreview();
  renderTaskBoard();
  clearGeneratedView();
  updateStats();
}

function applyStarterPreset() {
  const presetKey = document.getElementById('starterPresetInput')?.value || 'webapi';
  const preset = STARTER_PRESETS[presetKey] || STARTER_PRESETS.webapi;
  const shouldClearWorkspace = Boolean(document.getElementById('starterClearWorkspace')?.checked);

  const starterProjectName = document.getElementById('starterProjectName')?.value || '';
  const starterNamespace = document.getElementById('starterNamespace')?.value || '';
  const starterFramework = document.getElementById('starterFramework')?.value || 'net8.0';
  const projectName = normalizeProjectIdentifier(starterProjectName, preset.projectType ? 'MyApi' : 'MyProject');
  const rootNamespace = normalizeProjectIdentifier(starterNamespace || projectName, projectName);

  if (shouldClearWorkspace) {
    clearWorkspaceForStarter();
  }

  state.isZenMode = false;
  state.isConfigCollapsed = false;

  if (preset.projectType) {
    const projectTypeSelect = document.getElementById('projectType');
    const projectNameInput = document.getElementById('projectName');
    const rootNamespaceInput = document.getElementById('rootNamespace');
    const targetFrameworkInput = document.getElementById('targetFramework');

    if (projectTypeSelect && projectTypeSelect.querySelector(`option[value="${preset.projectType}"]`)) {
      projectTypeSelect.value = preset.projectType;
    }
    if (projectNameInput) projectNameInput.value = projectName;
    if (rootNamespaceInput) rootNamespaceInput.value = rootNamespace;
    if (targetFrameworkInput && targetFrameworkInput.querySelector(`option[value="${starterFramework}"]`)) {
      targetFrameworkInput.value = starterFramework;
    }

    if (preset.projectType === 'webapi' || preset.projectType === 'grpc') {
      const swaggerCheckbox = document.getElementById('optSwagger');
      if (swaggerCheckbox) swaggerCheckbox.checked = true;
    }
  }

  applyLayoutState();
  openConfigTab(preset.targetTab);
  hideStarterModal();
  persistWorkspace();
  updateStatusBar();
  showToast(`Yeni calisma baslatildi: ${preset.label}`);
}

function bindStarterEvents() {
  const starterModal = document.getElementById('projectStartModal');
  const openStarterBtn = document.getElementById('openStarterBtn');
  const applyStarterBtn = document.getElementById('applyStarterBtn');
  const starterProjectName = document.getElementById('starterProjectName');
  const starterNamespace = document.getElementById('starterNamespace');

  if (openStarterBtn) {
    openStarterBtn.addEventListener('click', openStarterModal);
  }

  if (starterModal) {
    starterModal.querySelectorAll('.starter-template').forEach(button => {
      button.addEventListener('click', () => {
        setStarterPreset(button.dataset.preset || 'webapi');
      });
    });

    starterModal.addEventListener('shown.bs.modal', () => {
      const nameInput = document.getElementById('starterProjectName');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    });

    starterModal.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'textarea') return;
      event.preventDefault();
      applyStarterPreset();
    });
  }

  if (applyStarterBtn) {
    applyStarterBtn.addEventListener('click', applyStarterPreset);
  }

  if (starterProjectName && starterNamespace) {
    starterProjectName.addEventListener('blur', () => {
      if (!starterNamespace.value.trim()) {
        starterNamespace.value = normalizeProjectIdentifier(starterProjectName.value, 'MyApi');
      }
    });
  }
}

function updateWorkflowSteps() {
  const activeTab = document.querySelector('#configTabs .nav-link.active');
  const activeTarget = activeTab?.getAttribute('data-bs-target') || '';
  const activeLabel = activeTab?.textContent?.trim() || 'Tablolar';
  document.querySelectorAll('.workflow-step').forEach(step => {
    step.classList.toggle('active', step.dataset.target === activeTarget);
  });
  const activeTabLabel = document.getElementById('activeTabLabel');
  if (activeTabLabel) {
    activeTabLabel.textContent = activeLabel;
  }
  updateStatusBar();
}

function setLlmConfigHint(message, tone = 'muted') {
  const hint = document.getElementById('llmConfigHint');
  if (!hint) return;
  hint.classList.remove('text-muted', 'text-success', 'text-warning', 'text-danger');
  const toneMap = {
    muted: 'text-muted',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger'
  };
  hint.classList.add(toneMap[tone] || 'text-muted');
  hint.textContent = message;
}

// ==================== STANDARDS ====================

function getStandardById(id) {
  return state.standards.find(standard => standard.id === id) || null;
}

function getActiveStandardProfile() {
  return getStandardById(state.selectedStandardId);
}

function renderStandardDocument(standard) {
  const preview = document.getElementById('standardDocPreview');
  if (!preview) return;

  if (!standard) {
    preview.textContent = 'Henüz standart analizi yapılmadı.';
    return;
  }

  preview.textContent = standard.document || 'Standart dokümanı oluşturulamadı.';
}

function renderStandardSelects() {
  const listSelect = document.getElementById('standardsListSelect');
  const activeSelect = document.getElementById('activeStandardSelect');
  if (!listSelect || !activeSelect) return;

  const defaultListOption = '<option value="">Standart secilmedi</option>';
  const defaultActiveOption = '<option value="">Varsayilan (standart yok)</option>';
  const options = state.standards.map(standard => {
    const created = toDisplayDate(standard.createdAt);
    return `<option value="${standard.id}">${escapeHtml(standard.name)} (${escapeHtml(created)})</option>`;
  }).join('');

  listSelect.innerHTML = defaultListOption + options;
  activeSelect.innerHTML = defaultActiveOption + options;

  if (state.selectedStandardId && getStandardById(state.selectedStandardId)) {
    listSelect.value = state.selectedStandardId;
    activeSelect.value = state.selectedStandardId;
  } else {
    state.selectedStandardId = '';
    listSelect.value = '';
    activeSelect.value = '';
  }

  renderStandardDocument(getActiveStandardProfile());
  updateStatusBar();
}

function createStandardDocument(profile, stats) {
  return [
    `# ${profile.name}`,
    '',
    `- Olusturma tarihi: ${toDisplayDate(profile.createdAt)}`,
    `- Kaynak proje: ${profile.sourceProject}`,
    `- Toplam analiz edilen dosya: ${stats.analyzedFileCount}`,
    `- Controller dosyasi: ${stats.controllerFileCount}`,
    `- Service dosyasi: ${stats.serviceFileCount}`,
    '',
    '## Tespit Edilen Kurallar',
    `- Target framework: ${profile.targetFramework}`,
    `- Root namespace: ${profile.rootNamespace}`,
    `- DB provider egilimi: ${profile.dbProvider}`,
    `- Service interface kullanimi: ${profile.useServiceInterfaces ? 'Evet' : 'Hayir'}`,
    `- Controller adlandirma: ${profile.controllerPlural ? 'Cogul (ProductsController)' : 'Tekil (ProductController)'}`,
    `- Route case stili: ${profile.routeCase}`,
    `- Route prefix: ${profile.routePrefix}`,
    '',
    '## Uretimde Uygulama',
    '- Bu profil seçilirse controller route ve isimleri bu standarda göre oluşur.',
    '- Service interface tercihleri profile gore kullanilir.',
    '- Framework ve DB varsayimlari profile gore ayarlanir.'
  ].join('\n');
}

function analyzeProjectStandard(projectFiles, customName) {
  const files = projectFiles.map(file => ({
    path: normalizePath(file.path),
    pathLower: normalizePath(file.path).toLowerCase(),
    content: file.content || ''
  }));

  const projectRoot = getProjectRootName(files);
  const csprojFile = files.find(file => file.pathLower.endsWith('.csproj'));
  const csprojContent = csprojFile?.content || '';

  const targetFramework = findFirstMatch(csprojContent, /<TargetFramework>([^<]+)<\/TargetFramework>/i, 'net8.0');
  const rootNamespace = findFirstMatch(
    csprojContent,
    /<RootNamespace>([^<]+)<\/RootNamespace>/i,
    projectRoot.replace(/[^A-Za-z0-9_]/g, '')
  );

  const sourceProject = csprojFile
    ? csprojFile.path.split('/').pop().replace('.csproj', '')
    : projectRoot;

  const controllerFiles = files.filter(file => file.pathLower.includes('/controllers/') && file.pathLower.endsWith('.cs'));
  const serviceFiles = files.filter(file => file.pathLower.includes('/services/') && file.pathLower.endsWith('.cs'));
  const programFile = files.find(file => /\/program\.cs$/i.test(file.pathLower));

  let pluralControllers = 0;
  let singularControllers = 0;
  const routes = [];

  controllerFiles.forEach(file => {
    const classRegex = /class\s+([A-Za-z0-9_]+)\s*:\s*ControllerBase/g;
    let classMatch = classRegex.exec(file.content);
    while (classMatch) {
      const className = classMatch[1];
      if (className.endsWith('sController')) {
        pluralControllers += 1;
      } else if (className.endsWith('Controller')) {
        singularControllers += 1;
      }
      classMatch = classRegex.exec(file.content);
    }

    const routeRegex = /\[Route\("([^"]+)"\)\]/g;
    let routeMatch = routeRegex.exec(file.content);
    while (routeMatch) {
      routes.push(routeMatch[1]);
      routeMatch = routeRegex.exec(file.content);
    }
  });

  const routePrefix = inferRoutePrefix(routes);
  const routeSegments = routes
    .map(route => route.replace(/^\/+/, ''))
    .map(route => (route.startsWith(`${routePrefix}/`) ? route.slice(routePrefix.length + 1) : route));

  const routeCase = detectRouteCase(routeSegments);
  const controllerPlural = pluralControllers >= singularControllers;

  const hasServiceInterfaceFile = serviceFiles.some(file => /\/services\/i[A-Za-z0-9_]+service\.cs$/i.test(file.pathLower));
  const hasServiceInterfaceRegistration = /AddScoped<\s*I[A-Za-z0-9_]+Service/i.test(programFile?.content || '');
  const useServiceInterfaces = hasServiceInterfaceFile || hasServiceInterfaceRegistration;

  const dbProvider = mapDbProviderFromCode(files.map(file => file.content).join('\n'));

  const profile = {
    id: `std-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (customName || '').trim() || `${sourceProject} Standard`,
    sourceProject,
    createdAt: new Date().toISOString(),
    targetFramework,
    rootNamespace,
    dbProvider,
    useServiceInterfaces,
    controllerPlural,
    routeCase,
    routePrefix
  };

  profile.document = createStandardDocument(profile, {
    analyzedFileCount: files.length,
    controllerFileCount: controllerFiles.length,
    serviceFileCount: serviceFiles.length
  });

  return profile;
}

async function analyzeUploadedProjectStandard() {
  const input = document.getElementById('projectUploadInput');
  const files = Array.from(input?.files || []);
  if (!files.length) {
    alert('Lütfen analiz için proje klasörü seçin.');
    return;
  }

  const analyzableFiles = files.filter(file => shouldAnalyzeFile(file.webkitRelativePath || file.name));
  if (!analyzableFiles.length) {
    alert('Analiz için uygun dosya bulunamadı.');
    return;
  }

  const button = document.getElementById('analyzeStandardBtn');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Analiz...';

  try {
    const projectFiles = await Promise.all(analyzableFiles.map(async file => ({
      path: file.webkitRelativePath || file.name,
      content: await file.text()
    })));

    const customName = document.getElementById('standardNameInput').value;
    const profile = analyzeProjectStandard(projectFiles, customName);

    state.standards.push(profile);
    state.selectedStandardId = profile.id;
    renderStandardSelects();
    applyStandardProfileToConfig(profile, false);
    persistWorkspace();
    showToast(`Standart olusturuldu: ${profile.name}`);
  } catch (error) {
    alert(`Standart analizi başarısız: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function applyStandardProfileToConfig(profile, showMessage = true) {
  if (!profile) return;

  if (profile.targetFramework) {
    document.getElementById('targetFramework').value = profile.targetFramework;
  }
  if (profile.dbProvider) {
    document.getElementById('targetDbProvider').value = profile.dbProvider;
  }
  const rootNamespaceInput = document.getElementById('rootNamespace');
  if (!rootNamespaceInput.value || rootNamespaceInput.value === 'MyApi') {
    rootNamespaceInput.value = profile.rootNamespace || rootNamespaceInput.value;
  }

  if (showMessage) {
    showToast(`Standart uygulandi: ${profile.name}`);
  }
}

function setActiveStandard(id, applyConfig = false) {
  state.selectedStandardId = id || '';
  renderStandardSelects();
  const active = getActiveStandardProfile();
  if (applyConfig && active) {
    applyStandardProfileToConfig(active, true);
  }
  persistWorkspace();
}

function deleteSelectedStandard() {
  const select = document.getElementById('standardsListSelect');
  const selectedId = select?.value || state.selectedStandardId;
  if (!selectedId) {
    alert('Silinecek standart seçili değil.');
    return;
  }

  const standard = getStandardById(selectedId);
  if (!standard) return;
  if (!confirm(`"${standard.name}" standardini silmek istiyor musunuz?`)) return;

  state.standards = state.standards.filter(item => item.id !== selectedId);
  if (state.selectedStandardId === selectedId) {
    state.selectedStandardId = '';
  }

  renderStandardSelects();
  persistWorkspace();
  showToast('Standart silindi.');
}

function downloadSelectedStandardDocument() {
  const selectedId = document.getElementById('standardsListSelect')?.value || state.selectedStandardId;
  const standard = getStandardById(selectedId);
  if (!standard) {
    alert('Lütfen önce bir standart seçin.');
    return;
  }

  const blob = new Blob([standard.document || ''], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${standard.name.replace(/[^A-Za-z0-9_-]/g, '_')}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function syncLlmStatus() {
  const buttons = [
    document.getElementById('enhanceStandardWithLlmBtn'),
    document.getElementById('deriveDesignStandardBtn'),
    document.getElementById('generateDesignDocBtn'),
    document.getElementById('generateConformanceBtn'),
    document.getElementById('generateAdrPackBtn'),
    document.getElementById('generateDiagramPackBtn'),
    document.getElementById('generateRequirementsBtn')
  ].filter(Boolean);
  if (!buttons.length) return;

  const setButtons = (disabled, title) => {
    buttons.forEach(button => {
      button.disabled = disabled;
      button.title = title;
    });
  };

  const runtime = getLlmRuntimeConfig();
  if (runtime.apiKey) {
    setButtons(false, `LLM model: ${runtime.model || 'openai/gpt-oss-120b'} (ekran ayari)`);
    setLlmConfigHint('Ekran tokeni aktif. LLM cagrilari bu token ile yapilacak.', 'success');
    return;
  }

  try {
    const response = await fetch('/api/llm/status');
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'LLM status okunamadi');
    }

    if (!data.configured) {
      setButtons(true, 'LLM token girin veya server env de GROQ_API_KEY tanimlayin.');
      setLlmConfigHint('Token girin veya server env icinde GROQ_API_KEY tanimlayin.', 'warning');
      return;
    }

    setButtons(false, `LLM model: ${data.model} (server env)`);
    setLlmConfigHint('Server env tokeni aktif. Istersen ekrandan override edebilirsin.', 'muted');
  } catch {
    setButtons(true, 'LLM durumu okunamadi.');
    setLlmConfigHint('LLM status okunamadi. URL/token degerlerini kontrol et.', 'danger');
  }
}

async function enhanceSelectedStandardWithLlm() {
  const standardsSelect = document.getElementById('standardsListSelect');
  const selectedId = standardsSelect?.value || state.selectedStandardId;
  if (!selectedId) {
    alert('Lütfen önce bir standart seçin.');
    return;
  }

  const standard = getStandardById(selectedId);
  if (!standard) {
    alert('Seçili standart bulunamadı.');
    return;
  }

  const button = document.getElementById('enhanceStandardWithLlmBtn');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM isliyor...';

  try {
    const llmConfig = getLlmRuntimeConfig();
    const response = await fetch('/api/llm/enhance-standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standard, llmConfig })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'LLM isteği başarısız.');
    }

    const updated = {
      ...standard,
      ...data.standard,
      id: standard.id,
      sourceProject: standard.sourceProject,
      createdAt: standard.createdAt,
      enhancedAt: new Date().toISOString(),
      llmProvider: data.meta?.provider || 'groq-openai-compatible',
      llmModel: data.meta?.model || ''
    };

    const index = state.standards.findIndex(item => item.id === selectedId);
    if (index >= 0) {
      state.standards[index] = updated;
    }

    state.selectedStandardId = selectedId;
    renderStandardSelects();
    renderStandardDocument(updated);
    applyStandardProfileToConfig(updated, false);
    persistWorkspace();
    showToast(`LLM ile güncellendi: ${updated.name}`);
  } catch (error) {
    alert(`LLM zenginlestirme hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function getDesignStandardById(id) {
  return state.designStandards.find(standard => standard.id === id) || null;
}

function getActiveDesignStandard() {
  return getDesignStandardById(state.selectedDesignStandardId);
}

function renderDesignStandardPreview(standard) {
  const preview = document.getElementById('designStandardPreview');
  if (!preview) return;

  if (!standard || !standard.profile) {
    preview.textContent = 'Henüz tasarım standardı üretilmedi.';
    return;
  }

  const profile = standard.profile;
  const sectionOrder = Array.isArray(profile.sectionOrder) ? profile.sectionOrder : [];
  const qualityGates = Array.isArray(profile.qualityGates) ? profile.qualityGates : [];
  const lines = [
    `# ${profile.name || standard.name}`,
    '',
    `- Olusturma tarihi: ${toDisplayDate(standard.createdAt)}`,
    `- Kaynak proje: ${standard.sourceProject || 'Bilinmiyor'}`,
    `- Mimari stil: ${profile.architectureStyle || '-'}`,
    `- API stili: ${profile.apiStyle || '-'}`,
    `- Dokuman dili: ${profile.documentLanguage || '-'}`,
    `- Hedef kitle: ${profile.audience || '-'}`,
    '',
    '## Bolum Sirasi',
    ...sectionOrder.map(section => `- ${section}`),
    '',
    '## Kalite Kontrol',
    ...qualityGates.map(item => `- ${item}`),
    '',
    '## Template',
    profile.template || ''
  ];

  preview.textContent = lines.join('\n');
}

function renderDesignDocumentPreview(documentState = state.generatedDesignDocument) {
  const preview = document.getElementById('designDocPreview');
  if (!preview) return;

  if (!documentState || !documentState.content) {
    preview.textContent = 'Henüz tasarım dokümanı üretilmedi.';
    return;
  }

  preview.textContent = documentState.content;
}

function renderConformancePreview(reportState = state.generatedConformanceReport) {
  const preview = document.getElementById('conformancePreview');
  if (!preview) return;

  if (!reportState || !reportState.content) {
    preview.textContent = 'Henüz uygunluk raporu üretilmedi.';
    return;
  }

  preview.textContent = reportState.content;
}

function renderAdrPackPreview(adrPack = state.generatedAdrPack) {
  const preview = document.getElementById('adrPackPreview');
  if (!preview) return;

  if (!Array.isArray(adrPack) || !adrPack.length) {
    preview.textContent = 'Henüz ADR paketi üretilmedi.';
    return;
  }

  const lines = [];
  adrPack.forEach((adr, index) => {
    lines.push(`## ${index + 1}. ${adr.title || adr.fileName || 'ADR'}`);
    lines.push(`- Dosya: ${adr.fileName || '-'}`);
    lines.push(`- Durum: ${adr.status || '-'}`);
    lines.push('');
    lines.push((adr.content || '').slice(0, 1200));
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  preview.textContent = lines.join('\n').trim();
}

function renderDiagramPackPreview(diagrams = state.generatedDiagramPack) {
  const preview = document.getElementById('diagramPackPreview');
  if (!preview) return;

  if (!diagrams || !diagrams.contextDiagram) {
    preview.textContent = 'Henüz diyagram paketi üretilmedi.';
    return;
  }

  preview.textContent = [
    '# Context Diagram',
    '```mermaid',
    diagrams.contextDiagram || '',
    '```',
    '',
    '# Container Diagram',
    '```mermaid',
    diagrams.containerDiagram || '',
    '```',
    '',
    '# Sequence Diagram',
    '```mermaid',
    diagrams.sequenceDiagram || '',
    '```'
  ].join('\n');
}

function renderRequirementsPreview(requirementsState = state.generatedRequirementsAnalysis) {
  const preview = document.getElementById('requirementsPreview');
  if (!preview) return;

  if (!requirementsState || !requirementsState.content) {
    preview.textContent = 'Henüz gereksinim analizi üretilmedi.';
    return;
  }

  preview.textContent = requirementsState.content;
}

function renderTaskPlanPreview(taskPlanState = state.generatedTaskPlan) {
  const preview = document.getElementById('taskPlanPreview');
  if (!preview) return;

  if (!taskPlanState || !taskPlanState.content) {
    preview.textContent = 'Henüz task planı üretilmedi.';
    return;
  }

  preview.textContent = taskPlanState.content;
}

function sanitizeTaskStatus(value) {
  const normalized = String(value || '').trim();
  const allowed = ['Todo', 'InProgress', 'Done', 'Blocked'];
  return allowed.includes(normalized) ? normalized : 'Todo';
}

function mergeTaskBoardStatuses(newTasks, existingTasks = state.taskBoard) {
  const statusMap = new Map(
    (Array.isArray(existingTasks) ? existingTasks : []).map(task => [task.id, sanitizeTaskStatus(task.status)])
  );

  return newTasks.map(task => ({
    ...task,
    status: sanitizeTaskStatus(statusMap.get(task.id) || task.status)
  }));
}

function ensureUniqueTaskIds(tasks) {
  const used = new Map();
  return tasks.map((task, index) => {
    const baseId = String(task.id || '').trim().toUpperCase() || `TASK-${String(index + 1).padStart(3, '0')}`;
    const count = used.get(baseId) || 0;
    used.set(baseId, count + 1);
    const uniqueId = count === 0 ? baseId : `${baseId}-${count + 1}`;
    return {
      ...task,
      id: uniqueId
    };
  });
}

function parseInlineTaskMeta(line, fallbackEstimate = '', fallbackOwner = '') {
  const estimateMatch = String(line).match(/\b(?:XS|S|M|L)\b/i);
  const ownerMatch = String(line).match(/(?:@|owner[:\-]\s*|sorumlu[:\-]\s*)([A-Za-z0-9_.\- ]{2,40})/i);
  return {
    estimate: estimateMatch ? estimateMatch[0].toUpperCase() : fallbackEstimate,
    owner: ownerMatch ? ownerMatch[1].trim() : fallbackOwner
  };
}

function parseTaskPlanTasks(markdownContent) {
  const markdown = String(markdownContent || '').trim();
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    tasks.push({
      id: current.id,
      title: current.title || '-',
      estimate: current.estimate || '-',
      owner: current.owner || '-',
      acceptance: current.acceptance || '-',
      status: sanitizeTaskStatus(current.status || 'Todo')
    });
    current = null;
  };

  lines.forEach(rawLine => {
    const line = String(rawLine || '').trim();
    if (!line) return;

    const taskMatch = line.match(/^[-*]?\s*(?:\d+\.\s*)?(TASK-\d{3})\s*[:\-]\s*(.+)$/i);
    if (taskMatch) {
      pushCurrent();
      current = {
        id: taskMatch[1].toUpperCase(),
        title: taskMatch[2].trim(),
        estimate: '',
        owner: '',
        acceptance: '',
        status: 'Todo'
      };
      return;
    }

    if (!current) return;

    const estimateMatch = line.match(/(?:tahmin|estimate)\s*[:\-]\s*(XS|S|M|L)\b/i);
    if (estimateMatch) {
      current.estimate = estimateMatch[1].toUpperCase();
      return;
    }

    const ownerMatch = line.match(/(?:sorumlu(?: rol)?|owner(?: role)?)\s*[:\-]\s*(.+)$/i);
    if (ownerMatch) {
      current.owner = ownerMatch[1].trim().slice(0, 120);
      return;
    }

    const acceptanceMatch = line.match(/^[-*]\s*(?:kabul kriteri|acceptance(?: criterion| criteria)?)\s*[:\-]\s*(.+)$/i);
    if (acceptanceMatch) {
      current.acceptance = acceptanceMatch[1].trim().slice(0, 300);
      return;
    }
  });

  pushCurrent();
  if (tasks.length > 0) {
    return ensureUniqueTaskIds(tasks.slice(0, 500));
  }

  // Fallback parser: if TASK-xxx format is missing, convert backlog bullets/checklist lines into tasks.
  const fallbackTasks = [];
  let inBacklogSection = false;
  const fallbackLines = markdown.split(/\r?\n/);
  fallbackLines.forEach(rawLine => {
    const line = String(rawLine || '').trim();
    if (!line) return;

    if (
      /^#{1,6}\s*.*g[öo]rev\s+backlogu/i.test(line) ||
      /^#{1,6}\s*.*task\s+backlog/i.test(line) ||
      /^#{1,6}\s*.*sprint/i.test(line)
    ) {
      inBacklogSection = true;
      return;
    }

    if (inBacklogSection && /^#{1,6}\s+/.test(line)) {
      inBacklogSection = false;
    }

    if (!inBacklogSection) return;

    const acceptanceLine = line.match(/^[-*]\s*(?:kabul kriteri|acceptance(?: criterion| criteria)?)\s*[:\-]\s*(.+)$/i);
    if (acceptanceLine && fallbackTasks.length > 0) {
      fallbackTasks[fallbackTasks.length - 1].acceptance = acceptanceLine[1].trim().slice(0, 300);
      return;
    }

    const bullet = line.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    const content = bullet?.[1] || numbered?.[1] || '';
    if (!content) return;

    if (/^(kabul kriteri|acceptance)/i.test(content)) return;
    if (/^(tahmin|estimate|sorumlu|owner)/i.test(content)) return;

    const stripped = content
      .replace(/\s*\((?:XS|S|M|L)\)\s*$/i, '')
      .replace(/\s*\[(?:XS|S|M|L)\]\s*$/i, '')
      .trim();
    if (stripped.length < 6) return;

    const meta = parseInlineTaskMeta(content);
    fallbackTasks.push({
      id: `TASK-${String(fallbackTasks.length + 1).padStart(3, '0')}`,
      title: stripped,
      estimate: meta.estimate || '-',
      owner: meta.owner || '-',
      acceptance: '-',
      status: 'Todo'
    });
  });

  // Last fallback: if no backlog section markers, still try checklist/bullet lines globally.
  if (!fallbackTasks.length) {
    fallbackLines.forEach(rawLine => {
      const line = String(rawLine || '').trim();
      if (!line) return;
      const bullet = line.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      const content = bullet?.[1] || numbered?.[1] || '';
      if (!content) return;
      if (/^(kabul kriteri|acceptance|tahmin|estimate|sorumlu|owner|epic|sprint)/i.test(content)) return;
      if (content.length < 8) return;
      if (/^#{1,6}\s+/.test(content)) return;

      const meta = parseInlineTaskMeta(content);
      fallbackTasks.push({
        id: `TASK-${String(fallbackTasks.length + 1).padStart(3, '0')}`,
        title: content.trim(),
        estimate: meta.estimate || '-',
        owner: meta.owner || '-',
        acceptance: '-',
        status: 'Todo'
      });
    });
  }

  return ensureUniqueTaskIds(fallbackTasks.slice(0, 500));
}

function parseChecklistImportTasks(markdownContent) {
  const markdown = String(markdownContent || '').trim();
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  let sectionStatus = 'Todo';

  lines.forEach(rawLine => {
    const line = String(rawLine || '').trim();
    if (!line) return;

    if (/^##\s*todo\b/i.test(line)) {
      sectionStatus = 'Todo';
      return;
    }
    if (/^##\s*in\s*progress\b/i.test(line)) {
      sectionStatus = 'InProgress';
      return;
    }
    if (/^##\s*blocked\b/i.test(line)) {
      sectionStatus = 'Blocked';
      return;
    }
    if (/^##\s*done\b/i.test(line)) {
      sectionStatus = 'Done';
      return;
    }

    const checkedLine = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (!checkedLine) return;

    const isChecked = checkedLine[1].toLowerCase() === 'x';
    let payload = checkedLine[2].trim();

    const idMatch = payload.match(/\b(TASK-[A-Z0-9-]+)\b/i);
    const rawId = idMatch ? idMatch[1].toUpperCase() : `TASK-${String(tasks.length + 1).padStart(3, '0')}`;
    if (idMatch) {
      payload = payload.replace(new RegExp(`^${idMatch[1]}\\s*[:\\-]?\\s*`, 'i'), '').trim();
    }

    let acceptance = '-';
    const acceptanceMatch = payload.match(/\|\s*(?:Kabul|Acceptance)\s*:\s*(.+)$/i);
    if (acceptanceMatch) {
      acceptance = acceptanceMatch[1].trim().slice(0, 300);
      payload = payload.slice(0, acceptanceMatch.index).trim();
    }

    const meta = parseInlineTaskMeta(payload);
    const title = payload
      .replace(/\[(XS|S|M|L)\]/ig, '')
      .replace(/@([A-Za-z0-9_.\- ]{2,40})/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || '-';

    tasks.push({
      id: rawId,
      title,
      estimate: meta.estimate || '-',
      owner: meta.owner || '-',
      acceptance,
      status: isChecked ? 'Done' : sectionStatus
    });
  });

  return ensureUniqueTaskIds(tasks.slice(0, 500));
}

function mergeImportedChecklistTasks(importedTasks) {
  if (!Array.isArray(importedTasks) || !importedTasks.length) {
    return { created: 0, updated: 0 };
  }

  let created = 0;
  let updated = 0;

  importedTasks.forEach(imported => {
    const index = state.taskBoard.findIndex(task => task.id === imported.id);
    if (index >= 0) {
      const existing = state.taskBoard[index];
      state.taskBoard[index] = {
        ...existing,
        title: imported.title && imported.title !== '-' ? imported.title : existing.title,
        estimate: imported.estimate && imported.estimate !== '-' ? imported.estimate : existing.estimate,
        owner: imported.owner && imported.owner !== '-' ? imported.owner : existing.owner,
        acceptance: imported.acceptance && imported.acceptance !== '-' ? imported.acceptance : existing.acceptance,
        status: sanitizeTaskStatus(imported.status || existing.status)
      };
      updated += 1;
    } else {
      state.taskBoard.push({
        id: imported.id,
        title: imported.title || '-',
        estimate: imported.estimate || '-',
        owner: imported.owner || '-',
        acceptance: imported.acceptance || '-',
        status: sanitizeTaskStatus(imported.status || 'Todo')
      });
      created += 1;
    }
  });

  normalizeTaskBoardSelection();
  return { created, updated };
}

function getTaskBoardFilters() {
  const search = normalizeForSearch(document.getElementById('taskBoardSearch')?.value || '');
  const rawStatus = document.getElementById('taskBoardStatusFilter')?.value || 'All';
  const rawSort = document.getElementById('taskBoardSort')?.value || 'TaskId';
  const allowedSorts = ['TaskId', 'Status', 'Estimate', 'Title'];
  return {
    search,
    status: rawStatus === 'All' ? 'All' : sanitizeTaskStatus(rawStatus),
    sort: allowedSorts.includes(rawSort) ? rawSort : 'TaskId'
  };
}

function getFilteredTaskBoard() {
  const { search, status } = getTaskBoardFilters();
  return state.taskBoard.filter(task => {
    if (status !== 'All' && sanitizeTaskStatus(task.status) !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = normalizeForSearch(`${task.id || ''} ${task.title || ''} ${task.owner || ''} ${task.acceptance || ''}`);
    return haystack.includes(search);
  });
}

function getTaskEstimateRank(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const map = { XS: 1, S: 2, M: 3, L: 4 };
  return map[normalized] || 99;
}

function getTaskStatusRank(value) {
  const status = sanitizeTaskStatus(value);
  const map = { Todo: 1, InProgress: 2, Blocked: 3, Done: 4 };
  return map[status] || 99;
}

function compareTaskId(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'tr', { numeric: true, sensitivity: 'base' });
}

function normalizeTaskBoardSelection() {
  const validIds = new Set(state.taskBoard.map(task => task.id));
  state.taskBoardSelectedIds = Array.from(
    new Set((state.taskBoardSelectedIds || []).filter(id => validIds.has(id)))
  );
}

function getSelectedTaskIdSet() {
  normalizeTaskBoardSelection();
  return new Set(state.taskBoardSelectedIds);
}

function sortTaskBoard(tasks, sortMode) {
  const list = [...tasks];
  switch (sortMode) {
    case 'Status':
      return list.sort((a, b) => {
        const diff = getTaskStatusRank(a.status) - getTaskStatusRank(b.status);
        return diff !== 0 ? diff : compareTaskId(a.id, b.id);
      });
    case 'Estimate':
      return list.sort((a, b) => {
        const diff = getTaskEstimateRank(a.estimate) - getTaskEstimateRank(b.estimate);
        return diff !== 0 ? diff : compareTaskId(a.id, b.id);
      });
    case 'Title':
      return list.sort((a, b) => {
        const diff = String(a.title || '').localeCompare(String(b.title || ''), 'tr', { sensitivity: 'base' });
        return diff !== 0 ? diff : compareTaskId(a.id, b.id);
      });
    case 'TaskId':
    default:
      return list.sort((a, b) => compareTaskId(a.id, b.id));
  }
}

function getVisibleTaskBoardTasks() {
  const { sort } = getTaskBoardFilters();
  return sortTaskBoard(getFilteredTaskBoard(), sort);
}

function renderTaskBoard() {
  const body = document.getElementById('taskBoardBody');
  const meta = document.getElementById('taskBoardMeta');
  const progressBar = document.getElementById('taskBoardProgressBar');
  const selectAll = document.getElementById('taskBoardSelectAll');
  if (!body) return;

  if (!Array.isArray(state.taskBoard) || !state.taskBoard.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-muted small">Task board bos.</td></tr>';
    if (meta) {
      meta.textContent = 'Task board henuz olusturulmadi.';
    }
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.textContent = '0%';
    }
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    return;
  }

  const selected = getSelectedTaskIdSet();
  const counts = {
    total: state.taskBoard.length,
    todo: state.taskBoard.filter(task => sanitizeTaskStatus(task.status) === 'Todo').length,
    inProgress: state.taskBoard.filter(task => sanitizeTaskStatus(task.status) === 'InProgress').length,
    done: state.taskBoard.filter(task => sanitizeTaskStatus(task.status) === 'Done').length,
    blocked: state.taskBoard.filter(task => sanitizeTaskStatus(task.status) === 'Blocked').length
  };
  const visibleTasks = getVisibleTaskBoardTasks();
  const selectedVisibleCount = visibleTasks.filter(task => selected.has(task.id)).length;
  const completion = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  if (meta) {
    meta.textContent = `Gorunen ${visibleTasks.length}/${counts.total} | Secili ${selected.size} | Todo ${counts.todo} | In Progress ${counts.inProgress} | Done ${counts.done} | Blocked ${counts.blocked} | Tamamlanma %${completion}`;
  }

  if (progressBar) {
    progressBar.style.width = `${completion}%`;
    progressBar.textContent = `${completion}%`;
  }

  if (selectAll) {
    if (!visibleTasks.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    } else {
      selectAll.checked = selectedVisibleCount === visibleTasks.length;
      selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleTasks.length;
    }
  }

  if (!visibleTasks.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-muted small">Filtreye uygun task bulunamadı.</td></tr>';
    return;
  }

  body.innerHTML = visibleTasks.map(task => {
    const status = sanitizeTaskStatus(task.status);
    const isSelected = selected.has(task.id);
    return `
      <tr class="${isSelected ? 'task-row-selected' : ''}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input" ${isSelected ? 'checked' : ''} onchange="toggleTaskSelection('${task.id}', this.checked)">
        </td>
        <td><code>${escapeHtml(task.id || '-')}</code></td>
        <td>${escapeHtml(task.title || '-')}</td>
        <td>${escapeHtml(task.estimate || '-')}</td>
        <td>${escapeHtml(task.owner || '-')}</td>
        <td>
          <select class="form-select form-select-sm task-status-select" onchange="updateTaskBoardStatusById('${task.id}', this.value)">
            <option value="Todo" ${status === 'Todo' ? 'selected' : ''}>Todo</option>
            <option value="InProgress" ${status === 'InProgress' ? 'selected' : ''}>In Progress</option>
            <option value="Done" ${status === 'Done' ? 'selected' : ''}>Done</option>
            <option value="Blocked" ${status === 'Blocked' ? 'selected' : ''}>Blocked</option>
          </select>
        </td>
        <td>${escapeHtml(task.acceptance || '-')}</td>
      </tr>
    `;
  }).join('');
}

function updateTaskBoardStatusById(taskId, status) {
  if (!Array.isArray(state.taskBoard) || !taskId) {
    return;
  }

  const index = state.taskBoard.findIndex(task => task.id === taskId);
  if (index < 0) return;

  state.taskBoard[index].status = sanitizeTaskStatus(status);
  renderTaskBoard();
  persistWorkspace();
}

function applyBulkTaskStatus() {
  const nextStatus = sanitizeTaskStatus(document.getElementById('taskBoardBulkStatus')?.value || 'Todo');
  const visible = getVisibleTaskBoardTasks();
  const selected = getSelectedTaskIdSet();

  let targets = visible;
  if (selected.size > 0) {
    targets = state.taskBoard.filter(task => selected.has(task.id));
  }

  if (!targets.length) {
    alert('Toplu güncellenecek task bulunamadı.');
    return;
  }

  const targetIds = new Set(targets.map(task => task.id));
  state.taskBoard = state.taskBoard.map(task => (
    targetIds.has(task.id)
      ? { ...task, status: nextStatus }
      : task
  ));

  renderTaskBoard();
  persistWorkspace();
  if (selected.size > 0) {
    showToast(`${targets.length} seçili task durumu "${nextStatus}" olarak güncellendi.`);
  } else {
    showToast(`${targets.length} görünen task durumu "${nextStatus}" olarak güncellendi.`);
  }
}

function clearTaskBoardFilters() {
  const searchInput = document.getElementById('taskBoardSearch');
  const statusFilter = document.getElementById('taskBoardStatusFilter');
  const sortInput = document.getElementById('taskBoardSort');
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = 'All';
  if (sortInput) sortInput.value = 'TaskId';
  renderTaskBoard();
  persistWorkspace();
}

function toggleTaskSelection(taskId, isSelected) {
  if (!taskId) return;
  const selected = getSelectedTaskIdSet();
  if (isSelected) {
    selected.add(taskId);
  } else {
    selected.delete(taskId);
  }
  state.taskBoardSelectedIds = Array.from(selected);
  renderTaskBoard();
  persistWorkspace();
}

function toggleSelectAllVisible(isSelected) {
  const visible = getVisibleTaskBoardTasks();
  const selected = getSelectedTaskIdSet();
  visible.forEach(task => {
    if (isSelected) {
      selected.add(task.id);
    } else {
      selected.delete(task.id);
    }
  });
  state.taskBoardSelectedIds = Array.from(selected);
  renderTaskBoard();
  persistWorkspace();
}

function selectFilteredTasks() {
  const visible = getVisibleTaskBoardTasks();
  if (!visible.length) {
    alert('Seçilecek görünen task bulunamadı.');
    return;
  }

  const selected = getSelectedTaskIdSet();
  visible.forEach(task => selected.add(task.id));
  state.taskBoardSelectedIds = Array.from(selected);
  renderTaskBoard();
  persistWorkspace();
  showToast(`${visible.length} gorunen task secildi.`);
}

function clearTaskSelection() {
  if (!state.taskBoardSelectedIds.length) {
    showToast('Secim zaten bos.');
    return;
  }
  state.taskBoardSelectedIds = [];
  renderTaskBoard();
  persistWorkspace();
  showToast('Task secimi temizlendi.');
}

function extractTaskBoardFromGeneratedPlan(showNotification = true) {
  const markdown = state.generatedTaskPlan?.content || '';
  if (!markdown.trim()) {
    if (showNotification) {
      alert('Once task plani olusturun.');
    }
    return false;
  }

  const parsed = parseTaskPlanTasks(markdown);
  if (!parsed.length) {
    if (showNotification) {
      alert('Task planindan TASK-xxx satirlari ayrisamadi. Plan formatini kontrol edin.');
    }
    return false;
  }

  state.taskBoard = mergeTaskBoardStatuses(parsed, state.taskBoard);
  normalizeTaskBoardSelection();
  renderTaskBoard();
  persistWorkspace();
  if (showNotification) {
    showToast(`${state.taskBoard.length} task panoya aktarildi.`);
  }
  return true;
}

function renderDesignStandardSelects() {
  const select = document.getElementById('designStandardsListSelect');
  if (!select) return;

  const defaultOption = '<option value="">Tasarim standarti secilmedi</option>';
  const options = state.designStandards.map(standard => {
    const created = toDisplayDate(standard.createdAt);
    return `<option value="${standard.id}">${escapeHtml(standard.name)} (${escapeHtml(created)})</option>`;
  }).join('');

  select.innerHTML = defaultOption + options;

  if (state.selectedDesignStandardId && getDesignStandardById(state.selectedDesignStandardId)) {
    select.value = state.selectedDesignStandardId;
  } else {
    state.selectedDesignStandardId = '';
    select.value = '';
  }

  renderDesignStandardPreview(getActiveDesignStandard());
  renderDesignDocumentPreview();
  renderConformancePreview();
  renderAdrPackPreview();
  renderDiagramPackPreview();
  renderRequirementsPreview();
  renderTaskPlanPreview();
  renderTaskBoard();
  updateStatusBar();
}

async function readProjectFilesForDesign(inputId) {
  const input = document.getElementById(inputId);
  const files = Array.from(input?.files || []);
  if (!files.length) {
    throw new Error('Lütfen proje klasörü seçin.');
  }

  const analyzable = files.filter(file => shouldAnalyzeDesignFile(file.webkitRelativePath || file.name));
  if (!analyzable.length) {
    throw new Error('Analiz için uygun dosya bulunamadı.');
  }

  const limited = analyzable.slice(0, 220);
  return Promise.all(limited.map(async file => ({
    path: file.webkitRelativePath || file.name,
    content: (await file.text()).slice(0, 9000)
  })));
}

function buildProjectDesignSummary(projectFiles) {
  const files = projectFiles.map(file => ({
    path: normalizePath(file.path),
    pathLower: normalizePath(file.path).toLowerCase(),
    content: file.content || ''
  }));

  const projectName = getProjectRootName(files);
  const extensionCounts = {};
  const topFolders = {};
  const controllers = new Set();
  const services = new Set();
  const entities = new Set();
  const packageReferences = new Set();
  const routeSamples = new Set();
  const docHeadings = [];
  const architectureHints = new Set();
  const keyFiles = [];
  let targetFramework = 'unknown';
  let rootNamespace = '';

  files.forEach(file => {
    const parts = file.path.split('/');
    const filename = parts[parts.length - 1] || '';
    const dotIndex = filename.lastIndexOf('.');
    const ext = dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : 'other';
    const safeExt = ext.length < 12 ? ext : 'other';
    extensionCounts[safeExt] = (extensionCounts[safeExt] || 0) + 1;

    if (parts.length > 1) {
      topFolders[parts[0]] = (topFolders[parts[0]] || 0) + 1;
    }

    if (file.pathLower.endsWith('.csproj')) {
      const tf = findFirstMatch(file.content, /<TargetFramework>([^<]+)<\/TargetFramework>/i, '');
      const ns = findFirstMatch(file.content, /<RootNamespace>([^<]+)<\/RootNamespace>/i, '');
      if (tf) targetFramework = tf;
      if (ns) rootNamespace = ns;

      const packageRegex = /<PackageReference\s+Include="([^"]+)"/gi;
      let pkgMatch = packageRegex.exec(file.content);
      while (pkgMatch) {
        packageReferences.add(pkgMatch[1]);
        pkgMatch = packageRegex.exec(file.content);
      }
    }

    if (file.pathLower.includes('/controllers/') && file.pathLower.endsWith('.cs')) {
      const classRegex = /class\s+([A-Za-z0-9_]+Controller)\b/g;
      let classMatch = classRegex.exec(file.content);
      while (classMatch) {
        controllers.add(classMatch[1]);
        classMatch = classRegex.exec(file.content);
      }

      const routeRegex = /\[Route\("([^"]+)"\)\]/g;
      let routeMatch = routeRegex.exec(file.content);
      while (routeMatch) {
        routeSamples.add(routeMatch[1]);
        routeMatch = routeRegex.exec(file.content);
      }
    }

    if (file.pathLower.includes('/services/') && file.pathLower.endsWith('.cs')) {
      const svcRegex = /(interface|class)\s+([A-Za-z0-9_]+Service)\b/g;
      let svcMatch = svcRegex.exec(file.content);
      while (svcMatch) {
        services.add(svcMatch[2]);
        svcMatch = svcRegex.exec(file.content);
      }
    }

    if ((file.pathLower.includes('/models/') || file.pathLower.includes('/entities/')) && file.pathLower.endsWith('.cs')) {
      const entityRegex = /class\s+([A-Za-z0-9_]+)\b/g;
      let entityMatch = entityRegex.exec(file.content);
      while (entityMatch) {
        entities.add(entityMatch[1]);
        entityMatch = entityRegex.exec(file.content);
      }
    }

    if (file.pathLower.includes('/domain/')) architectureHints.add('Domain folder detected');
    if (file.pathLower.includes('/application/')) architectureHints.add('Application folder detected');
    if (file.pathLower.includes('/infrastructure/')) architectureHints.add('Infrastructure folder detected');
    if (file.pathLower.includes('/shared/')) architectureHints.add('Shared folder detected');
    if (/UseNpgsql|UseSqlServer|UseMySql|UseInMemoryDatabase/.test(file.content)) architectureHints.add('Database provider usage detected');
    if (/AddAuthentication|AddAuthorization|UseAuthentication|UseAuthorization/.test(file.content)) architectureHints.add('Auth middleware detected');

    if ((file.pathLower.endsWith('.md') || file.pathLower.endsWith('.txt')) && docHeadings.length < 25) {
      const headings = (file.content.match(/^#{1,4}\s+.+$/gm) || []).slice(0, 5);
      headings.forEach(heading => {
        if (docHeadings.length < 25) {
          docHeadings.push(`${file.path}: ${heading}`);
        }
      });
    }

    if (keyFiles.length < 30) {
      keyFiles.push({
        path: file.path,
        excerpt: file.content.split('\n').slice(0, 14).join('\n').slice(0, 700)
      });
    }
  });

  const extensionBreakdown = Object.entries(extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([extension, count]) => ({ extension, count }));

  const folderBreakdown = Object.entries(topFolders)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([folder, count]) => ({ folder, count }));

  return {
    projectName,
    fileCount: files.length,
    targetFramework,
    rootNamespace: rootNamespace || projectName.replace(/[^A-Za-z0-9_]/g, ''),
    extensionBreakdown,
    folderBreakdown,
    controllers: Array.from(controllers).slice(0, 40),
    services: Array.from(services).slice(0, 40),
    entities: Array.from(entities).slice(0, 60),
    routeSamples: Array.from(routeSamples).slice(0, 30),
    packageReferences: Array.from(packageReferences).slice(0, 40),
    architectureHints: Array.from(architectureHints).slice(0, 20),
    documentHeadings: docHeadings.slice(0, 30),
    keyFiles
  };
}

async function deriveDesignStandardWithLlm() {
  const button = document.getElementById('deriveDesignStandardBtn');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM isliyor...';

  try {
    const sampleFiles = await readProjectFilesForDesign('designSampleUploadInput');
    const sampleProject = buildProjectDesignSummary(sampleFiles);
    const requestedName = document.getElementById('designStandardNameInput')?.value?.trim() || '';
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/derive-design-standard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: requestedName || `${sampleProject.projectName} Design Standard`,
        sampleProject,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Tasarim standarti olusturulamadi.');
    }

    const standard = {
      id: `dstd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: data.designStandard?.name || requestedName || `${sampleProject.projectName} Design Standard`,
      sourceProject: sampleProject.projectName,
      createdAt: new Date().toISOString(),
      profile: data.designStandard,
      meta: data.meta || {}
    };

    state.designStandards.push(standard);
    state.selectedDesignStandardId = standard.id;
    renderDesignStandardSelects();
    persistWorkspace();
    showToast(`Tasarim standarti olusturuldu: ${standard.name}`);
  } catch (error) {
    alert(`Tasarim standarti hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function deleteSelectedDesignStandard() {
  const select = document.getElementById('designStandardsListSelect');
  const selectedId = select?.value || state.selectedDesignStandardId;
  if (!selectedId) {
    alert('Silinecek tasarım standardı seçili değil.');
    return;
  }

  const standard = getDesignStandardById(selectedId);
  if (!standard) return;
  if (!confirm(`"${standard.name}" tasarım standardı silinsin mi?`)) return;

  state.designStandards = state.designStandards.filter(item => item.id !== selectedId);
  if (state.selectedDesignStandardId === selectedId) {
    state.selectedDesignStandardId = '';
  }

  renderDesignStandardSelects();
  persistWorkspace();
  showToast('Tasarim standarti silindi.');
}

function downloadSelectedDesignStandard() {
  const selectedId = document.getElementById('designStandardsListSelect')?.value || state.selectedDesignStandardId;
  const standard = getDesignStandardById(selectedId);
  if (!standard) {
    alert('Lütfen önce bir tasarım standardı seçin.');
    return;
  }

  const preview = document.getElementById('designStandardPreview');
  const content = preview?.textContent || '';
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${standard.name.replace(/[^A-Za-z0-9_-]/g, '_')}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSelectedDesignStandardOrAlert() {
  const selectedId = document.getElementById('designStandardsListSelect')?.value || state.selectedDesignStandardId;
  const designStandard = getDesignStandardById(selectedId);
  if (!designStandard || !designStandard.profile) {
    alert('Lütfen önce bir tasarım standardı seçin.');
    return null;
  }

  return designStandard;
}

async function generateDesignDocumentWithLlm() {
  const designStandard = getSelectedDesignStandardOrAlert();
  if (!designStandard) return;

  const button = document.getElementById('generateDesignDocBtn');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM yaziyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const title = document.getElementById('designDocTitleInput')?.value?.trim() || '';
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/generate-design-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        targetProject,
        designStandard: designStandard.profile,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Tasarım dokümanı üretilmedi.');
    }

    state.generatedDesignDocument = {
      title: data.title || title || `${targetProject.projectName} Design Document`,
      content: data.document || '',
      generatedAt: new Date().toISOString(),
      sourceProject: targetProject.projectName,
      standardId: designStandard.id,
      standardName: designStandard.name,
      model: data.meta?.model || ''
    };

    state.selectedDesignStandardId = designStandard.id;
    renderDesignStandardSelects();
    persistWorkspace();
    showToast(`Tasarım dokümanı hazır: ${state.generatedDesignDocument.title}`);
  } catch (error) {
    alert(`Tasarım dokümanı hatası: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function generateConformanceReportWithLlm() {
  const designStandard = getSelectedDesignStandardOrAlert();
  if (!designStandard) return;

  const button = document.getElementById('generateConformanceBtn');
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM degerlendiriyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/generate-conformance-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject,
        designStandard: designStandard.profile,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Uygunluk raporu uretilmedi.');
    }

    state.generatedConformanceReport = {
      content: data.report || '',
      generatedAt: new Date().toISOString(),
      sourceProject: targetProject.projectName,
      standardId: designStandard.id,
      standardName: designStandard.name,
      model: data.meta?.model || ''
    };
    renderConformancePreview();
    persistWorkspace();
    showToast('Uygunluk raporu hazirlandi.');
  } catch (error) {
    alert(`Uygunluk raporu hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function generateAdrPackWithLlm() {
  const designStandard = getSelectedDesignStandardOrAlert();
  if (!designStandard) return;

  const button = document.getElementById('generateAdrPackBtn');
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM ADR uretiyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const llmConfig = getLlmRuntimeConfig();
    const adrCount = Math.max(1, Math.min(10, parseInt(document.getElementById('adrCountInput')?.value, 10) || 3));

    const response = await fetch('/api/llm/generate-adr-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject,
        designStandard: designStandard.profile,
        adrCount,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'ADR paketi uretilmedi.');
    }

    state.generatedAdrPack = Array.isArray(data.adrs) ? data.adrs : [];
    renderAdrPackPreview();
    persistWorkspace();
    showToast(`ADR paketi hazirlandi (${state.generatedAdrPack.length} kayit).`);
  } catch (error) {
    alert(`ADR paketi hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function generateDiagramPackWithLlm() {
  const designStandard = getSelectedDesignStandardOrAlert();
  if (!designStandard) return;

  const button = document.getElementById('generateDiagramPackBtn');
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM diyagram uretiyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/generate-diagram-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject,
        designStandard: designStandard.profile,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Diyagram paketi uretilmedi.');
    }

    state.generatedDiagramPack = data.diagrams || null;
    renderDiagramPackPreview();
    persistWorkspace();
    showToast('Mermaid diyagram paketi hazirlandi.');
  } catch (error) {
    alert(`Diyagram paketi hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function generateRequirementsAnalysisWithLlm() {
  const button = document.getElementById('generateRequirementsBtn');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>LLM analiz ediyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const selectedId = document.getElementById('designStandardsListSelect')?.value || state.selectedDesignStandardId;
    const designStandard = getDesignStandardById(selectedId);
    const businessContext = document.getElementById('requirementsContextInput')?.value?.trim() || '';
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/analyze-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject,
        designStandard: designStandard?.profile || null,
        businessContext,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Gereksinim analizi üretilmedi.');
    }

    state.generatedRequirementsAnalysis = {
      content: data.requirementsDocument || '',
      generatedAt: new Date().toISOString(),
      sourceProject: targetProject.projectName,
      standardId: designStandard?.id || '',
      standardName: designStandard?.name || '',
      model: data.meta?.model || ''
    };

    renderRequirementsPreview();
    persistWorkspace();
    showToast('Gereksinim analizi hazırlandı.');
  } catch (error) {
    alert(`Gereksinim analizi hatası: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function generateTaskPlanWithLlm() {
  const button = document.getElementById('generateTaskPlanBtn');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Task plani uretiliyor...';

  try {
    const targetFiles = await readProjectFilesForDesign('designTargetUploadInput');
    const targetProject = buildProjectDesignSummary(targetFiles);
    const selectedId = document.getElementById('designStandardsListSelect')?.value || state.selectedDesignStandardId;
    const designStandard = getDesignStandardById(selectedId);
    const businessContext = document.getElementById('requirementsContextInput')?.value?.trim() || '';
    const llmConfig = getLlmRuntimeConfig();

    const response = await fetch('/api/llm/generate-task-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject,
        designStandard: designStandard?.profile || null,
        requirementsDocument: state.generatedRequirementsAnalysis?.content || '',
        businessContext,
        llmConfig
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Task plani uretilmedi.');
    }

    state.generatedTaskPlan = {
      content: data.taskPlanDocument || '',
      generatedAt: new Date().toISOString(),
      sourceProject: targetProject.projectName,
      standardId: designStandard?.id || '',
      standardName: designStandard?.name || '',
      model: data.meta?.model || ''
    };

    renderTaskPlanPreview();
    const boardCreated = extractTaskBoardFromGeneratedPlan(false);
    if (!boardCreated) {
      persistWorkspace();
    }
    showToast(boardCreated ? 'Task plani hazirlandi ve panoya aktarildi.' : 'Task plani hazirlandi.');
  } catch (error) {
    alert(`Task plani hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function downloadGeneratedDesignDocument() {
  if (!state.generatedDesignDocument?.content) {
    alert('İndirilecek tasarım dokümanı yok.');
    return;
  }

  const safeTitle = (state.generatedDesignDocument.title || 'DesignDocument').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([state.generatedDesignDocument.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadConformanceReport() {
  if (!state.generatedConformanceReport?.content) {
    alert('Indirilecek uygunluk raporu yok.');
    return;
  }

  const fileBase = (state.generatedConformanceReport.sourceProject || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([state.generatedConformanceReport.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileBase}_conformance_report.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadAdrPack() {
  if (!Array.isArray(state.generatedAdrPack) || !state.generatedAdrPack.length) {
    alert('Indirilecek ADR paketi yok.');
    return;
  }

  let content = '# ADR Pack\n\n';
  state.generatedAdrPack.forEach((adr, index) => {
    content += `## ${index + 1}. ${adr.title || adr.fileName || 'ADR'}\n`;
    content += `- File: ${adr.fileName || '-'}\n`;
    content += `- Status: ${adr.status || '-'}\n\n`;
    content += `${adr.content || ''}\n\n---\n\n`;
  });

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'adr_pack.md';
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadDiagramPack() {
  if (!state.generatedDiagramPack?.contextDiagram) {
    alert('Indirilecek diyagram paketi yok.');
    return;
  }

  const diagrams = state.generatedDiagramPack;
  const content = [
    '# Mermaid Diagram Pack',
    '',
    '## Context Diagram',
    '```mermaid',
    diagrams.contextDiagram || '',
    '```',
    '',
    '## Container Diagram',
    '```mermaid',
    diagrams.containerDiagram || '',
    '```',
    '',
    '## Sequence Diagram',
    '```mermaid',
    diagrams.sequenceDiagram || '',
    '```'
  ].join('\n');

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mermaid_diagram_pack.md';
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadRequirementsAnalysis() {
  if (!state.generatedRequirementsAnalysis?.content) {
    alert('İndirilecek gereksinim analizi yok.');
    return;
  }

  const fileBase = (state.generatedRequirementsAnalysis.sourceProject || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([state.generatedRequirementsAnalysis.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileBase}_requirements_analysis.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTaskPlan() {
  if (!state.generatedTaskPlan?.content) {
    alert('Indirilecek task plani yok.');
    return;
  }

  const fileBase = (state.generatedTaskPlan.sourceProject || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([state.generatedTaskPlan.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileBase}_task_plan.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTaskBoardCsv() {
  if (!Array.isArray(state.taskBoard) || !state.taskBoard.length) {
    alert('Indirilecek task board verisi yok.');
    return;
  }

  const selected = getSelectedTaskIdSet();
  const exportTasks = selected.size > 0
    ? state.taskBoard.filter(task => selected.has(task.id))
    : state.taskBoard;

  if (!exportTasks.length) {
    alert('İndirilecek seçili task bulunamadı.');
    return;
  }

  const header = ['TaskId', 'Title', 'Estimate', 'Owner', 'Status', 'Acceptance'];
  const rows = exportTasks.map(task => [
    task.id || '',
    task.title || '',
    task.estimate || '',
    task.owner || '',
    task.status || '',
    task.acceptance || ''
  ]);

  const csv = [header, ...rows]
    .map(columns => columns.map(escapeCsv).join(','))
    .join('\n');

  const fileBase = (state.generatedTaskPlan?.sourceProject || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileBase}_task_board.csv`;
  anchor.click();
  URL.revokeObjectURL(url);

  if (selected.size > 0) {
    showToast(`${exportTasks.length} seçili task CSV olarak indirildi.`);
  }
}

function downloadTaskChecklist() {
  if (!Array.isArray(state.taskBoard) || !state.taskBoard.length) {
    alert('Indirilecek task board verisi yok.');
    return;
  }

  const selected = getSelectedTaskIdSet();
  let exportTasks = [];
  if (selected.size > 0) {
    exportTasks = state.taskBoard.filter(task => selected.has(task.id));
  } else {
    exportTasks = getVisibleTaskBoardTasks();
  }

  if (!exportTasks.length) {
    alert('İndirilecek task bulunamadı.');
    return;
  }

  const grouped = {
    Todo: [],
    InProgress: [],
    Blocked: [],
    Done: []
  };

  exportTasks.forEach(task => {
    const status = sanitizeTaskStatus(task.status);
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(task);
  });

  const statusTitles = {
    Todo: 'Todo',
    InProgress: 'In Progress',
    Blocked: 'Blocked',
    Done: 'Done'
  };

  const lines = [];
  lines.push('# Task Checklist');
  lines.push('');
  lines.push(`Toplam: ${exportTasks.length}`);
  lines.push(`Uretim Tarihi: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  ['Todo', 'InProgress', 'Blocked', 'Done'].forEach(status => {
    const tasks = grouped[status] || [];
    lines.push(`## ${statusTitles[status]} (${tasks.length})`);
    if (!tasks.length) {
      lines.push('- (Bos)');
      lines.push('');
      return;
    }

    tasks.forEach(task => {
      const checked = status === 'Done' ? 'x' : ' ';
      const estimate = task.estimate && task.estimate !== '-' ? ` [${task.estimate}]` : '';
      const owner = task.owner && task.owner !== '-' ? ` @${task.owner}` : '';
      const acceptance = task.acceptance && task.acceptance !== '-' ? ` | Kabul: ${task.acceptance}` : '';
      lines.push(`- [${checked}] ${task.id}: ${task.title}${estimate}${owner}${acceptance}`);
    });
    lines.push('');
  });

  const content = lines.join('\n');
  const fileBase = (state.generatedTaskPlan?.sourceProject || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileBase}_task_checklist.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openTaskChecklistImportDialog() {
  const input = document.getElementById('taskChecklistImportInput');
  if (!input) {
    alert('Checklist import alanı bulunamadı.');
    return;
  }
  input.click();
}

async function importTaskChecklistFromFile(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const tasks = parseChecklistImportTasks(content);
    if (!tasks.length) {
      alert('Checklist icinden task satiri ayrisamadi.');
      return;
    }

    const result = mergeImportedChecklistTasks(tasks);
    renderTaskBoard();
    persistWorkspace();
    showToast(`Checklist yüklendi: +${result.created} yeni, ${result.updated} güncel.`);
  } catch (error) {
    alert(`Checklist yükleme hatası: ${error.message}`);
  } finally {
    if (input) {
      input.value = '';
    }
  }
}

// ==================== TABLE MANAGEMENT ====================

function addTable() {
  state.editingTableIndex = -1;
  document.getElementById('tableModalTitle').textContent = 'Yeni Tablo';
  document.getElementById('modalTableName').value = '';
  document.getElementById('modalGenCrud').checked = true;
  document.getElementById('modalColumnsBody').innerHTML = '';

  addColumnToModal('Id', 'int', true, true, '');
  addColumnToModal('', 'string', false, false, '');

  new bootstrap.Modal(document.getElementById('tableModal')).show();
}

function editTable(index) {
  state.editingTableIndex = index;
  const table = state.tables[index];

  document.getElementById('tableModalTitle').textContent = `Tablo Duzenle: ${table.name}`;
  document.getElementById('modalTableName').value = table.name;
  document.getElementById('modalGenCrud').checked = table.generateCrud;
  document.getElementById('modalColumnsBody').innerHTML = '';

  table.columns.forEach(col => {
    addColumnToModal(col.name, col.type, col.isPrimaryKey, col.isRequired, col.maxLength || '');
  });

  new bootstrap.Modal(document.getElementById('tableModal')).show();
}

function addColumnToModal(name = '', type = 'string', isPk = false, isReq = false, maxLen = '') {
  const tbody = document.getElementById('modalColumnsBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" class="form-control form-control-sm col-name" value="${escapeHtml(name)}" placeholder="ColumnName"></td>
    <td>
      <select class="form-select form-select-sm col-type">
        <option value="int" ${type === 'int' ? 'selected' : ''}>int</option>
        <option value="long" ${type === 'long' ? 'selected' : ''}>long</option>
        <option value="string" ${type === 'string' ? 'selected' : ''}>string</option>
        <option value="bool" ${type === 'bool' ? 'selected' : ''}>bool</option>
        <option value="decimal" ${type === 'decimal' ? 'selected' : ''}>decimal</option>
        <option value="double" ${type === 'double' ? 'selected' : ''}>double</option>
        <option value="float" ${type === 'float' ? 'selected' : ''}>float</option>
        <option value="DateTime" ${type === 'DateTime' ? 'selected' : ''}>DateTime</option>
        <option value="Guid" ${type === 'Guid' ? 'selected' : ''}>Guid</option>
        <option value="byte[]" ${type === 'byte[]' ? 'selected' : ''}>byte[]</option>
      </select>
    </td>
    <td class="text-center"><input type="checkbox" class="form-check-input col-pk" ${isPk ? 'checked' : ''}></td>
    <td class="text-center"><input type="checkbox" class="form-check-input col-req" ${isReq ? 'checked' : ''}></td>
    <td><input type="number" class="form-control form-control-sm col-maxlen" value="${maxLen}" placeholder="-"></td>
    <td><button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><i class="bi bi-x"></i></button></td>
  `;
  tbody.appendChild(row);
}

function saveTable() {
  const name = document.getElementById('modalTableName').value.trim();
  if (!name) {
    alert('Tablo adi zorunlu.');
    return;
  }

  const columns = [];
  document.querySelectorAll('#modalColumnsBody tr').forEach(row => {
    const colName = row.querySelector('.col-name').value.trim();
    if (!colName) return;

    columns.push({
      name: colName,
      type: row.querySelector('.col-type').value,
      isPrimaryKey: row.querySelector('.col-pk').checked,
      isRequired: row.querySelector('.col-req').checked,
      maxLength: row.querySelector('.col-maxlen').value ? parseInt(row.querySelector('.col-maxlen').value, 10) : null
    });
  });

  if (columns.length === 0) {
    alert('En az bir sutun ekleyin.');
    return;
  }

  const table = {
    name,
    generateCrud: document.getElementById('modalGenCrud').checked,
    columns
  };

  if (state.editingTableIndex >= 0) {
    state.tables[state.editingTableIndex] = table;
  } else {
    state.tables.push(table);
  }

  renderTables();
  persistWorkspace();
  bootstrap.Modal.getInstance(document.getElementById('tableModal')).hide();
  showToast('Tablo kaydedildi.');
}

function deleteTable(index) {
  if (!confirm(`"${state.tables[index].name}" tablosunu silmek istediginize emin misiniz?`)) {
    return;
  }
  state.tables.splice(index, 1);
  renderTables();
  persistWorkspace();
}

function renderTables() {
  const container = document.getElementById('tablesList');
  const search = normalizeForSearch(document.getElementById('tableSearch').value);
  const list = state.tables.filter(table => normalizeForSearch(table.name).includes(search));

  if (state.tables.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Henüz tablo eklenmedi. "Tablo Ekle" butonuna tıklayın veya veritabanından içe aktarın.</small></div>';
    updateStats();
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Aramaya uygun tablo bulunamadı.</small></div>';
    updateStats();
    return;
  }

  container.innerHTML = list.map(table => {
    const index = state.tables.indexOf(table);
    return `
      <div class="table-card d-flex justify-content-between align-items-center" onclick="editTable(${index})">
        <div>
          <div class="table-name"><i class="bi bi-table me-1"></i>${escapeHtml(table.name)}</div>
          <div class="table-info">${table.columns.length} sutun ${table.generateCrud ? '- CRUD' : ''}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteTable(${index})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateStats();
}

// ==================== DTO MANAGEMENT ====================

function addDto() {
  state.editingDtoIndex = -1;
  document.getElementById('dtoModalTitle').textContent = 'Yeni DTO';
  document.getElementById('modalDtoName').value = '';
  document.getElementById('modalDtoType').value = 'request';
  document.getElementById('modalDtoFieldsBody').innerHTML = '';
  addDtoFieldToModal();
  new bootstrap.Modal(document.getElementById('dtoModal')).show();
}

function editDto(index) {
  state.editingDtoIndex = index;
  const dto = state.dtos[index];

  document.getElementById('dtoModalTitle').textContent = `DTO Duzenle: ${dto.name}`;
  document.getElementById('modalDtoName').value = dto.name;
  document.getElementById('modalDtoType').value = dto.type;
  document.getElementById('modalDtoFieldsBody').innerHTML = '';
  dto.fields.forEach(field => addDtoFieldToModal(field.name, field.type, field.isRequired, field.maxLength || ''));

  new bootstrap.Modal(document.getElementById('dtoModal')).show();
}

function addDtoFieldToModal(name = '', type = 'string', isReq = false, maxLen = '') {
  const tbody = document.getElementById('modalDtoFieldsBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" class="form-control form-control-sm dto-fname" value="${escapeHtml(name)}" placeholder="FieldName"></td>
    <td>
      <select class="form-select form-select-sm dto-ftype">
        <option value="int" ${type === 'int' ? 'selected' : ''}>int</option>
        <option value="long" ${type === 'long' ? 'selected' : ''}>long</option>
        <option value="string" ${type === 'string' ? 'selected' : ''}>string</option>
        <option value="bool" ${type === 'bool' ? 'selected' : ''}>bool</option>
        <option value="decimal" ${type === 'decimal' ? 'selected' : ''}>decimal</option>
        <option value="double" ${type === 'double' ? 'selected' : ''}>double</option>
        <option value="DateTime" ${type === 'DateTime' ? 'selected' : ''}>DateTime</option>
        <option value="Guid" ${type === 'Guid' ? 'selected' : ''}>Guid</option>
      </select>
    </td>
    <td class="text-center"><input type="checkbox" class="form-check-input dto-freq" ${isReq ? 'checked' : ''}></td>
    <td><input type="number" class="form-control form-control-sm dto-fmaxlen" value="${maxLen}" placeholder="-"></td>
    <td><button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><i class="bi bi-x"></i></button></td>
  `;
  tbody.appendChild(row);
}

function saveDto() {
  const name = document.getElementById('modalDtoName').value.trim();
  if (!name) {
    alert('DTO adi zorunlu.');
    return;
  }

  const fields = [];
  document.querySelectorAll('#modalDtoFieldsBody tr').forEach(row => {
    const fieldName = row.querySelector('.dto-fname').value.trim();
    if (!fieldName) return;
    fields.push({
      name: fieldName,
      type: row.querySelector('.dto-ftype').value,
      isRequired: row.querySelector('.dto-freq').checked,
      maxLength: row.querySelector('.dto-fmaxlen').value ? parseInt(row.querySelector('.dto-fmaxlen').value, 10) : null
    });
  });

  if (fields.length === 0) {
    alert('En az bir alan ekleyin.');
    return;
  }

  const dto = {
    name,
    type: document.getElementById('modalDtoType').value,
    fields
  };

  if (state.editingDtoIndex >= 0) {
    state.dtos[state.editingDtoIndex] = dto;
  } else {
    state.dtos.push(dto);
  }

  renderDtos();
  persistWorkspace();
  bootstrap.Modal.getInstance(document.getElementById('dtoModal')).hide();
  showToast('DTO kaydedildi.');
}

function deleteDto(index) {
  if (!confirm(`"${state.dtos[index].name}" DTO kaydini silmek istediginize emin misiniz?`)) {
    return;
  }
  state.dtos.splice(index, 1);
  renderDtos();
  persistWorkspace();
}

function renderDtos() {
  const container = document.getElementById('dtoList');
  const search = normalizeForSearch(document.getElementById('dtoSearch').value);
  const list = state.dtos.filter(dto => normalizeForSearch(dto.name).includes(search));

  if (state.dtos.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Henüz DTO eklenmedi. "DTO Ekle" butonuna tıklayın.</small></div>';
    updateStats();
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Aramaya uygun DTO bulunamadı.</small></div>';
    updateStats();
    return;
  }

  container.innerHTML = list.map(dto => {
    const index = state.dtos.indexOf(dto);
    return `
      <div class="dto-card d-flex justify-content-between align-items-center" onclick="editDto(${index})">
        <div>
          <div class="fw-bold">
            <span class="badge badge-${dto.type} me-1">${dto.type === 'request' ? 'REQ' : 'RES'}</span>
            ${escapeHtml(dto.name)}
          </div>
          <div class="table-info">${dto.fields.length} alan</div>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteDto(${index})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateStats();
}

// ==================== DATABASE ====================

function getDbConfig() {
  return {
    provider: document.getElementById('dbProvider').value,
    host: document.getElementById('dbHost').value,
    port: parseInt(document.getElementById('dbPort').value, 10),
    database: document.getElementById('dbName').value,
    user: document.getElementById('dbUser').value,
    password: document.getElementById('dbPassword').value
  };
}

async function testDbConnection() {
  const status = document.getElementById('dbStatus');
  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>Baglaniliyor...</div>';

  try {
    const resp = await fetch('/api/database/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDbConfig())
    });
    const data = await resp.json();

    if (data.success) {
      status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${escapeHtml(data.message)}</div>`;
    } else {
      status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small"><i class="bi bi-x-circle me-1"></i>${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small"><i class="bi bi-x-circle me-1"></i>Baglanti hatasi: ${escapeHtml(err.message)}</div>`;
  }
}

async function fetchTablesFromDb() {
  const status = document.getElementById('dbStatus');
  const list = document.getElementById('dbTablesList');
  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>Tablolar getiriliyor...</div>';
  list.innerHTML = '';

  try {
    const resp = await fetch('/api/database/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDbConfig())
    });
    const data = await resp.json();

    if (data.success && data.tables.length > 0) {
      status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${data.tables.length} tablo bulundu.</div>`;
      list.innerHTML = `
        <div class="mt-2">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <small class="fw-bold">Ice aktarilacak tablolar:</small>
            <button class="btn btn-sm btn-success" onclick="importSelectedTables()">
              <i class="bi bi-download me-1"></i>Ice Aktar
            </button>
          </div>
          ${data.tables.map(tableName => `
            <div class="form-check">
              <input class="form-check-input db-table-check" type="checkbox" value="${escapeHtml(tableName)}" id="dbTbl_${escapeHtml(tableName)}" checked>
              <label class="form-check-label small" for="dbTbl_${escapeHtml(tableName)}">${escapeHtml(tableName)}</label>
            </div>
          `).join('')}
        </div>
      `;
    } else if (data.success) {
      status.innerHTML = '<div class="alert alert-warning py-1 mt-2 small">Tablo bulunamadı.</div>';
    } else {
      status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small">${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small">Hata: ${escapeHtml(err.message)}</div>`;
  }
}

async function importSelectedTables() {
  const checked = document.querySelectorAll('.db-table-check:checked');
  const config = getDbConfig();
  const status = document.getElementById('dbStatus');

  if (checked.length === 0) {
    status.innerHTML = '<div class="alert alert-warning py-1 mt-2 small">Lütfen en az bir tablo seçin.</div>';
    return;
  }

  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>Sutunlar getiriliyor...</div>';

  for (const cb of checked) {
    const tableName = cb.value;
    try {
      const resp = await fetch('/api/database/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, tableName })
      });
      const data = await resp.json();

      if (data.success) {
        const pascalName = toPascalCase(tableName);
        const existing = state.tables.findIndex(table => table.name === pascalName);
        const table = {
          name: pascalName,
          generateCrud: true,
          columns: data.columns.map(column => ({
            name: toPascalCase(column.name),
            type: column.dataType,
            isPrimaryKey: column.isPrimaryKey,
            isRequired: !column.isNullable,
            maxLength: column.maxLength
          }))
        };

        if (existing >= 0) {
          state.tables[existing] = table;
        } else {
          state.tables.push(table);
        }
      }
    } catch (err) {
      console.error(`Error importing ${tableName}:`, err);
    }
  }

  renderTables();
  persistWorkspace();
  status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${checked.length} tablo ice aktarildi.</div>`;
  document.querySelector('[data-bs-target="#tabTables"]').click();
}

// ==================== CODE GENERATION ====================

function generateCode() {
  const projectType = document.getElementById('projectType')?.value || 'webapi';
  if (projectType === 'webapi' && state.tables.length === 0) {
    alert('Lütfen en az bir tablo ekleyin.');
    return;
  }

  const standardProfile = getActiveStandardProfile();

  const config = {
    projectType,
    projectName: document.getElementById('projectName').value || 'MyApi',
    rootNamespace: document.getElementById('rootNamespace').value || 'MyApi',
    targetDbProvider: document.getElementById('targetDbProvider').value,
    targetFramework: document.getElementById('targetFramework').value,
    optSwagger: document.getElementById('optSwagger').checked,
    optFluentValidation: document.getElementById('optFluentValidation').checked,
    optAutoMapper: document.getElementById('optAutoMapper').checked,
    optAuthPack: document.getElementById('optAuthPack')?.checked || false,
    optProductionPack: document.getElementById('optProductionPack')?.checked || false,
    optTestGeneration: document.getElementById('optTestGeneration')?.checked || false,
    optEfMigrations: document.getElementById('optEfMigrations')?.checked || false,
    optPostmanExport: document.getElementById('optPostmanExport')?.checked || false,
    tables: state.tables,
    dtos: state.dtos,
    standardProfile
  };

  state.generatedFiles = CodeGen.generateAll(config);
  renderGeneratedCode();
  persistWorkspace();
  if (standardProfile) {
    showToast(`${Object.keys(state.generatedFiles).length} dosya hazirlandi (${standardProfile.name} standardi).`);
  } else {
    showToast(`${Object.keys(state.generatedFiles).length} dosya hazirlandi.`);
  }
}

function renderGeneratedCode() {
  const files = Object.keys(state.generatedFiles);

  if (files.length === 0) {
    clearGeneratedView();
    updateStats();
    return;
  }

  if (!state.currentFile || !state.generatedFiles[state.currentFile]) {
    state.currentFile = files[0];
  }

  renderFileExplorer(files);
  showFileContent(state.currentFile);
  updateExplorerSelection();
  updateStats();
}

function buildFileTree(filePaths) {
  const root = { type: 'folder', name: '', path: '', children: [], folders: new Map() };

  filePaths.forEach(filePath => {
    const parts = filePath.split('/').filter(Boolean);
    let cursor = root;
    const folderStack = [];

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      if (isFile) {
        cursor.children.push({ type: 'file', name: part, path: filePath });
        return;
      }

      folderStack.push(part);
      if (!cursor.folders.has(part)) {
        const folderNode = {
          type: 'folder',
          name: part,
          path: folderStack.join('/'),
          children: [],
          folders: new Map()
        };
        cursor.folders.set(part, folderNode);
        cursor.children.push(folderNode);
      }
      cursor = cursor.folders.get(part);
    });
  });

  const sortNodes = node => {
    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'folder' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, 'tr', { sensitivity: 'base' });
    });
    node.children.forEach(child => {
      if (child.type === 'folder') {
        sortNodes(child);
        delete child.folders;
      }
    });
  };

  sortNodes(root);
  delete root.folders;
  return root;
}

function createExplorerNode(node, depth = 0) {
  if (node.type === 'file') {
    const fileButton = document.createElement('button');
    fileButton.type = 'button';
    fileButton.className = 'explorer-item explorer-file';
    fileButton.style.setProperty('--depth', String(depth));
    fileButton.dataset.path = node.path;

    const icon = document.createElement('i');
    icon.className = `bi ${getFileIcon(node.path)} explorer-node-icon`;

    const label = document.createElement('span');
    label.className = 'explorer-label';
    label.textContent = node.name;

    fileButton.appendChild(icon);
    fileButton.appendChild(label);
    return fileButton;
  }

  const folderWrapper = document.createElement('div');
  folderWrapper.className = 'explorer-folder';
  folderWrapper.dataset.path = node.path;

  const folderButton = document.createElement('button');
  folderButton.type = 'button';
  folderButton.className = 'explorer-item explorer-folder-toggle';
  folderButton.style.setProperty('--depth', String(depth));
  folderButton.dataset.path = node.path;

  const caret = document.createElement('i');
  caret.className = 'bi bi-chevron-down explorer-caret';

  const folderIcon = document.createElement('i');
  folderIcon.className = 'bi bi-folder2-open explorer-node-icon';

  const label = document.createElement('span');
  label.className = 'explorer-label';
  label.textContent = node.name;

  folderButton.appendChild(caret);
  folderButton.appendChild(folderIcon);
  folderButton.appendChild(label);

  const children = document.createElement('div');
  children.className = 'explorer-children';
  node.children.forEach(child => {
    children.appendChild(createExplorerNode(child, depth + 1));
  });

  folderWrapper.appendChild(folderButton);
  folderWrapper.appendChild(children);
  return folderWrapper;
}

function updateExplorerSelection() {
  document.querySelectorAll('#fileExplorer .explorer-file').forEach(fileButton => {
    fileButton.classList.toggle('active', fileButton.dataset.path === state.currentFile);
  });
}

function bindExplorerInteractions() {
  const explorer = document.getElementById('fileExplorer');
  if (!explorer) return;

  explorer.querySelectorAll('.explorer-file').forEach(fileButton => {
    fileButton.addEventListener('click', () => {
      state.currentFile = fileButton.dataset.path;
      showFileContent(state.currentFile);
      updateExplorerSelection();
    });
  });

  explorer.querySelectorAll('.explorer-folder-toggle').forEach(folderButton => {
    folderButton.addEventListener('click', () => {
      const folder = folderButton.closest('.explorer-folder');
      if (!folder) return;
      folder.classList.toggle('collapsed');
      const collapsed = folder.classList.contains('collapsed');
      const caret = folderButton.querySelector('.explorer-caret');
      const folderIcon = folderButton.querySelector('.explorer-node-icon');
      if (caret) {
        caret.className = `bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-down'} explorer-caret`;
      }
      if (folderIcon) {
        folderIcon.className = `bi ${collapsed ? 'bi-folder2' : 'bi-folder2-open'} explorer-node-icon`;
      }
    });
  });
}

function renderFileExplorer(filePaths) {
  const explorer = document.getElementById('fileExplorer');
  if (!explorer) return;

  explorer.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'explorer-header';
  header.textContent = 'DOSYALAR';
  explorer.appendChild(header);

  const treeHost = document.createElement('div');
  treeHost.className = 'explorer-tree';

  const tree = buildFileTree(filePaths);
  tree.children.forEach(node => {
    treeHost.appendChild(createExplorerNode(node, 0));
  });

  explorer.appendChild(treeHost);
  bindExplorerInteractions();
}

function showFile(filename) {
  if (!filename || !state.generatedFiles[filename]) return;
  state.currentFile = filename;
  showFileContent(filename);
  updateExplorerSelection();
}

function showFileContent(filename) {
  const container = document.getElementById('codeContainer');
  const code = state.generatedFiles[filename];
  const lang = filename.endsWith('.cs') ? 'csharp' : filename.endsWith('.json') ? 'json' : 'markup';
  const escaped = escapeHtml(code);
  container.innerHTML = `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  Prism.highlightAll();
  updateStatusBar();
}

function getFileIcon(filename) {
  if (filename.endsWith('.cs')) return 'bi-filetype-cs';
  if (filename.endsWith('.json')) return 'bi-filetype-json';
  if (filename.endsWith('.csproj')) return 'bi-file-earmark-code';
  return 'bi-file-earmark';
}

function copyCurrentCode() {
  if (!state.currentFile) return;
  const code = state.generatedFiles[state.currentFile];
  navigator.clipboard.writeText(code).then(() => {
    showToast('Dosya panoya kopyalandi.');
  });
}

async function openCurrentProjectInVsCode() {
  const files = state.generatedFiles || {};
  if (Object.keys(files).length === 0) {
    alert('Once kod uretmelisin.');
    return;
  }

  const projectName = (document.getElementById('projectName')?.value || 'MyApi').trim() || 'MyApi';

  try {
    showToast('VS Code aktarimi hazirlaniyor...');
    const response = await fetch('/api/workspace/open-in-vscode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        files
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success || !payload.openUrl) {
      throw new Error(payload.message || 'VS Code acma istegi basarisiz.');
    }

    const openAnchor = document.createElement('a');
    openAnchor.href = payload.openUrl;
    openAnchor.rel = 'noopener';
    openAnchor.style.display = 'none';
    document.body.appendChild(openAnchor);
    openAnchor.click();
    openAnchor.remove();

    showToast(`VS Code acma komutu gonderildi (${payload.filesWritten || 0} dosya).`);
  } catch (error) {
    alert(`VS Code'a aktarim hatasi: ${error.message}`);
  }
}

function downloadAllCode() {
  const files = state.generatedFiles;
  if (Object.keys(files).length === 0) return;

  let content = '';
  for (const [name, code] of Object.entries(files)) {
    content += `// ============================================================\n`;
    content += `// File: ${name}\n`;
    content += `// ============================================================\n\n`;
    content += code;
    content += `\n\n`;
  }

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${document.getElementById('projectName').value || 'MyApi'}_generated.cs`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function hasWorkspaceData() {
  return (
    state.tables.length > 0 ||
    state.dtos.length > 0 ||
    state.standards.length > 0 ||
    state.designStandards.length > 0 ||
    state.taskBoard.length > 0 ||
    Object.keys(state.generatedFiles || {}).length > 0
  );
}

function exportWorkspaceToFile() {
  const projectName = (document.getElementById('projectName')?.value || 'workspace').trim() || 'workspace';
  const safeProjectName = projectName.replace(/[^A-Za-z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);

  const payload = buildWorkspacePayload();
  if (payload.config) {
    payload.config.llmApiKey = '';
  }

  const filePayload = {
    format: 'generatecode-workspace-v1',
    savedAt: new Date().toISOString(),
    workspace: payload
  };

  const blob = new Blob([JSON.stringify(filePayload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeProjectName}_${dateStamp}.workspace.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Çalışma dosyası indirildi.');
}

function openWorkspaceImportDialog() {
  const input = document.getElementById('workspaceImportInput');
  if (!input) {
    alert('Çalışma yükleme alanı bulunamadı.');
    return;
  }
  input.click();
}

async function importWorkspaceFromFile(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const workspace = parsed?.workspace && typeof parsed.workspace === 'object'
      ? parsed.workspace
      : parsed;

    if (!workspace || typeof workspace !== 'object') {
      throw new Error('Geçersiz çalışma dosyası.');
    }

    if (hasWorkspaceData()) {
      const confirmed = confirm('Mevcut çalışma üzerine yazılsın mı?');
      if (!confirmed) {
        return;
      }
    }

    applyWorkspacePayload(workspace, { persist: true, showToast: true, toastMessage: 'Çalışma yüklendi, kaldığın yerden devam edebilirsin.' });
  } catch (error) {
    alert(`Çalışma yüklenemedi: ${error.message}`);
  } finally {
    if (input) {
      input.value = '';
    }
  }
}

// ==================== QUICK ACTIONS ====================

function loadDemoData() {
  const projectTypeInput = document.getElementById('projectType');
  if (projectTypeInput) projectTypeInput.value = 'webapi';
  document.getElementById('projectName').value = 'SampleStoreApi';
  document.getElementById('rootNamespace').value = 'SampleStoreApi';
  document.getElementById('targetDbProvider').value = 'InMemory';
  document.getElementById('targetFramework').value = 'net8.0';
  document.getElementById('optSwagger').checked = true;
  const optAuthPack = document.getElementById('optAuthPack');
  const optProductionPack = document.getElementById('optProductionPack');
  const optTestGeneration = document.getElementById('optTestGeneration');
  const optEfMigrations = document.getElementById('optEfMigrations');
  const optPostmanExport = document.getElementById('optPostmanExport');
  if (optAuthPack) optAuthPack.checked = false;
  if (optProductionPack) optProductionPack.checked = true;
  if (optTestGeneration) optTestGeneration.checked = true;
  if (optEfMigrations) optEfMigrations.checked = true;
  if (optPostmanExport) optPostmanExport.checked = true;

  state.tables = [
    {
      name: 'Product',
      generateCrud: true,
      columns: [
        { name: 'Id', type: 'int', isPrimaryKey: true, isRequired: true, maxLength: null },
        { name: 'Name', type: 'string', isPrimaryKey: false, isRequired: true, maxLength: 120 },
        { name: 'Price', type: 'decimal', isPrimaryKey: false, isRequired: true, maxLength: null },
        { name: 'Stock', type: 'int', isPrimaryKey: false, isRequired: true, maxLength: null }
      ]
    },
    {
      name: 'Category',
      generateCrud: true,
      columns: [
        { name: 'Id', type: 'int', isPrimaryKey: true, isRequired: true, maxLength: null },
        { name: 'Title', type: 'string', isPrimaryKey: false, isRequired: true, maxLength: 80 }
      ]
    }
  ];

  state.dtos = [
    {
      name: 'CreateProductRequest',
      type: 'request',
      fields: [
        { name: 'Name', type: 'string', isRequired: true, maxLength: 120 },
        { name: 'Price', type: 'decimal', isRequired: true, maxLength: null },
        { name: 'Stock', type: 'int', isRequired: true, maxLength: null }
      ]
    },
    {
      name: 'ProductResponse',
      type: 'response',
      fields: [
        { name: 'Id', type: 'int', isRequired: true, maxLength: null },
        { name: 'Name', type: 'string', isRequired: true, maxLength: 120 },
        { name: 'Price', type: 'decimal', isRequired: true, maxLength: null }
      ]
    }
  ];

  clearGeneratedView();
  renderTables();
  renderDtos();
  persistWorkspace();
  showToast('Örnek şema yüklendi.');
}

function resetWorkspace() {
  if (!confirm('Tum tablo/DTO verisi ve kod ciktisi temizlensin mi? (Standartlar korunur)')) {
    return;
  }

  state.tables = [];
  state.dtos = [];
  state.generatedFiles = {};
  state.currentFile = null;
  state.editingTableIndex = -1;
  state.editingDtoIndex = -1;
  state.generatedDesignDocument = null;
  state.generatedConformanceReport = null;
  state.generatedAdrPack = [];
  state.generatedDiagramPack = null;
  state.generatedRequirementsAnalysis = null;
  state.generatedTaskPlan = null;
  state.taskBoard = [];
  state.taskBoardSelectedIds = [];

  applyConfigSnapshot({
    selectedStandardId: state.selectedStandardId,
    selectedDesignStandardId: state.selectedDesignStandardId,
    isConfigCollapsed: state.isConfigCollapsed,
    isZenMode: state.isZenMode,
    workbenchLeftRatio: state.workbenchLeftRatio
  });
  document.getElementById('tableSearch').value = '';
  document.getElementById('dtoSearch').value = '';
  document.getElementById('dbStatus').innerHTML = '';
  document.getElementById('dbTablesList').innerHTML = '';

  renderTables();
  renderDtos();
  renderStandardSelects();
  renderDesignStandardSelects();
  renderDesignDocumentPreview();
  renderConformancePreview();
  renderAdrPackPreview();
  renderDiagramPackPreview();
  renderRequirementsPreview();
  renderTaskPlanPreview();
  renderTaskBoard();
  clearGeneratedView();
  updateStats();
  persistWorkspace();
  showToast('Çalışma alanı sıfırlandı.');
}

// ==================== BINDINGS ====================

function bindWorkflowEvents() {
  document.querySelectorAll('.workflow-step').forEach(step => {
    step.addEventListener('click', () => {
      openConfigTab(step.dataset.target || '');
    });
  });

  document.querySelectorAll('#configTabs .nav-link').forEach(tabButton => {
    tabButton.addEventListener('shown.bs.tab', updateWorkflowSteps);
  });

  updateWorkflowSteps();
}

function bindFilterEvents() {
  document.getElementById('tableSearch').addEventListener('input', renderTables);
  document.getElementById('dtoSearch').addEventListener('input', renderDtos);

  const taskBoardSearch = document.getElementById('taskBoardSearch');
  const taskBoardStatusFilter = document.getElementById('taskBoardStatusFilter');
  const taskBoardSort = document.getElementById('taskBoardSort');
  if (taskBoardSearch) {
    taskBoardSearch.addEventListener('input', renderTaskBoard);
  }
  if (taskBoardStatusFilter) {
    taskBoardStatusFilter.addEventListener('change', renderTaskBoard);
  }
  if (taskBoardSort) {
    taskBoardSort.addEventListener('change', renderTaskBoard);
  }
}

function bindAutoSaveEvents() {
  const ids = [
    'projectType', 'projectName', 'rootNamespace', 'targetDbProvider', 'targetFramework',
    'optSwagger', 'optFluentValidation', 'optAutoMapper',
    'optAuthPack', 'optProductionPack', 'optTestGeneration', 'optEfMigrations', 'optPostmanExport',
    'dbProvider', 'dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword',
    'activeStandardSelect', 'designStandardsListSelect', 'designStandardNameInput', 'designDocTitleInput', 'adrCountInput',
    'requirementsContextInput',
    'taskBoardSearch', 'taskBoardStatusFilter', 'taskBoardSort', 'taskBoardBulkStatus',
    'llmBaseUrl', 'llmModel', 'llmApiKey'
  ];

  ids.forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    const eventName = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
    element.addEventListener(eventName, persistWorkspace);
    element.addEventListener(eventName, updateStatusBar);
    if (id.startsWith('llm')) {
      element.addEventListener(eventName, syncLlmStatus);
    }
  });
}

function bindShortcuts() {
  document.addEventListener('keydown', event => {
    const key = String(event.key || '').toLowerCase();
    const isMacMeta = event.metaKey;
    const isCtrl = event.ctrlKey || isMacMeta;

    if (event.key === 'Escape' && state.isZenMode) {
      event.preventDefault();
      toggleZenMode(false);
      return;
    }

    if (isCtrl && !event.shiftKey && !event.altKey && key === 'b') {
      event.preventDefault();
      toggleConfigPane();
      return;
    }

    if (isCtrl && event.shiftKey && !event.altKey && key === 'n') {
      event.preventDefault();
      openStarterModal();
      return;
    }

    if ((event.ctrlKey || isMacMeta) && event.altKey && key === 'z') {
      event.preventDefault();
      toggleZenMode();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      generateCode();
    }
  });
}

function bindStandardEvents() {
  const analyzeBtn = document.getElementById('analyzeStandardBtn');
  const standardsList = document.getElementById('standardsListSelect');
  const applyBtn = document.getElementById('applyStandardBtn');
  const enhanceBtn = document.getElementById('enhanceStandardWithLlmBtn');
  const activeSelect = document.getElementById('activeStandardSelect');
  const downloadBtn = document.getElementById('downloadStandardDocBtn');
  const deleteBtn = document.getElementById('deleteStandardBtn');
  const designStandardsList = document.getElementById('designStandardsListSelect');
  const deriveDesignStandardBtn = document.getElementById('deriveDesignStandardBtn');
  const deleteDesignStandardBtn = document.getElementById('deleteDesignStandardBtn');
  const downloadDesignStandardBtn = document.getElementById('downloadDesignStandardBtn');
  const generateDesignDocBtn = document.getElementById('generateDesignDocBtn');
  const downloadDesignDocBtn = document.getElementById('downloadDesignDocBtn');
  const generateConformanceBtn = document.getElementById('generateConformanceBtn');
  const downloadConformanceBtn = document.getElementById('downloadConformanceBtn');
  const generateAdrPackBtn = document.getElementById('generateAdrPackBtn');
  const downloadAdrPackBtn = document.getElementById('downloadAdrPackBtn');
  const generateDiagramPackBtn = document.getElementById('generateDiagramPackBtn');
  const downloadDiagramPackBtn = document.getElementById('downloadDiagramPackBtn');
  const generateRequirementsBtn = document.getElementById('generateRequirementsBtn');
  const downloadRequirementsBtn = document.getElementById('downloadRequirementsBtn');
  const generateTaskPlanBtn = document.getElementById('generateTaskPlanBtn');
  const downloadTaskPlanBtn = document.getElementById('downloadTaskPlanBtn');
  const extractTaskBoardBtn = document.getElementById('extractTaskBoardBtn');
  const importTaskChecklistBtn = document.getElementById('importTaskChecklistBtn');
  const taskChecklistImportInput = document.getElementById('taskChecklistImportInput');
  const selectFilteredTasksBtn = document.getElementById('selectFilteredTasksBtn');
  const clearTaskSelectionBtn = document.getElementById('clearTaskSelectionBtn');
  const taskBoardSelectAll = document.getElementById('taskBoardSelectAll');
  const downloadTaskBoardCsvBtn = document.getElementById('downloadTaskBoardCsvBtn');
  const downloadTaskChecklistBtn = document.getElementById('downloadTaskChecklistBtn');
  const applyTaskBoardBulkBtn = document.getElementById('applyTaskBoardBulkBtn');
  const clearTaskBoardFiltersBtn = document.getElementById('clearTaskBoardFiltersBtn');

  if (!analyzeBtn || !standardsList || !applyBtn || !enhanceBtn || !activeSelect || !downloadBtn || !deleteBtn) {
    return;
  }

  analyzeBtn.addEventListener('click', analyzeUploadedProjectStandard);

  standardsList.addEventListener('change', event => {
    renderStandardDocument(getStandardById(event.target.value));
  });

  applyBtn.addEventListener('click', () => {
    const selectedId = standardsList.value;
    if (!selectedId) {
      alert('Lütfen bir standart seçin.');
      return;
    }
    setActiveStandard(selectedId, true);
  });

  activeSelect.addEventListener('change', event => {
    setActiveStandard(event.target.value, false);
  });

  enhanceBtn.addEventListener('click', enhanceSelectedStandardWithLlm);
  downloadBtn.addEventListener('click', downloadSelectedStandardDocument);
  deleteBtn.addEventListener('click', deleteSelectedStandard);

  if (designStandardsList) {
    designStandardsList.addEventListener('change', event => {
      state.selectedDesignStandardId = event.target.value || '';
      renderDesignStandardPreview(getActiveDesignStandard());
      persistWorkspace();
    });
  }

  if (deriveDesignStandardBtn) {
    deriveDesignStandardBtn.addEventListener('click', deriveDesignStandardWithLlm);
  }

  if (deleteDesignStandardBtn) {
    deleteDesignStandardBtn.addEventListener('click', deleteSelectedDesignStandard);
  }

  if (downloadDesignStandardBtn) {
    downloadDesignStandardBtn.addEventListener('click', downloadSelectedDesignStandard);
  }

  if (generateDesignDocBtn) {
    generateDesignDocBtn.addEventListener('click', generateDesignDocumentWithLlm);
  }

  if (downloadDesignDocBtn) {
    downloadDesignDocBtn.addEventListener('click', downloadGeneratedDesignDocument);
  }

  if (generateConformanceBtn) {
    generateConformanceBtn.addEventListener('click', generateConformanceReportWithLlm);
  }

  if (downloadConformanceBtn) {
    downloadConformanceBtn.addEventListener('click', downloadConformanceReport);
  }

  if (generateAdrPackBtn) {
    generateAdrPackBtn.addEventListener('click', generateAdrPackWithLlm);
  }

  if (downloadAdrPackBtn) {
    downloadAdrPackBtn.addEventListener('click', downloadAdrPack);
  }

  if (generateDiagramPackBtn) {
    generateDiagramPackBtn.addEventListener('click', generateDiagramPackWithLlm);
  }

  if (downloadDiagramPackBtn) {
    downloadDiagramPackBtn.addEventListener('click', downloadDiagramPack);
  }

  if (generateRequirementsBtn) {
    generateRequirementsBtn.addEventListener('click', generateRequirementsAnalysisWithLlm);
  }

  if (downloadRequirementsBtn) {
    downloadRequirementsBtn.addEventListener('click', downloadRequirementsAnalysis);
  }

  if (generateTaskPlanBtn) {
    generateTaskPlanBtn.addEventListener('click', generateTaskPlanWithLlm);
  }

  if (downloadTaskPlanBtn) {
    downloadTaskPlanBtn.addEventListener('click', downloadTaskPlan);
  }

  if (extractTaskBoardBtn) {
    extractTaskBoardBtn.addEventListener('click', () => extractTaskBoardFromGeneratedPlan(true));
  }

  if (importTaskChecklistBtn) {
    importTaskChecklistBtn.addEventListener('click', openTaskChecklistImportDialog);
  }

  if (taskChecklistImportInput) {
    taskChecklistImportInput.addEventListener('change', importTaskChecklistFromFile);
  }

  if (selectFilteredTasksBtn) {
    selectFilteredTasksBtn.addEventListener('click', selectFilteredTasks);
  }

  if (clearTaskSelectionBtn) {
    clearTaskSelectionBtn.addEventListener('click', clearTaskSelection);
  }

  if (taskBoardSelectAll) {
    taskBoardSelectAll.addEventListener('change', event => {
      toggleSelectAllVisible(event.target.checked);
    });
  }

  if (downloadTaskBoardCsvBtn) {
    downloadTaskBoardCsvBtn.addEventListener('click', downloadTaskBoardCsv);
  }

  if (downloadTaskChecklistBtn) {
    downloadTaskChecklistBtn.addEventListener('click', downloadTaskChecklist);
  }

  if (applyTaskBoardBulkBtn) {
    applyTaskBoardBulkBtn.addEventListener('click', applyBulkTaskStatus);
  }

  if (clearTaskBoardFiltersBtn) {
    clearTaskBoardFiltersBtn.addEventListener('click', clearTaskBoardFilters);
  }
}

function bindSettingsEvents() {
  const toggleTokenBtn = document.getElementById('toggleLlmTokenBtn');
  const tokenInput = document.getElementById('llmApiKey');
  const checkBtn = document.getElementById('checkLlmStatusBtn');

  if (toggleTokenBtn && tokenInput) {
    toggleTokenBtn.addEventListener('click', () => {
      const isHidden = tokenInput.type === 'password';
      tokenInput.type = isHidden ? 'text' : 'password';
      toggleTokenBtn.innerHTML = isHidden ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      await syncLlmStatus();
      showToast('LLM ayari kontrol edildi.');
    });
  }
}

function bindLayoutEvents() {
  const toggleConfigPaneBtn = document.getElementById('toggleConfigPaneBtn');
  const toggleZenModeBtn = document.getElementById('toggleZenModeBtn');
  const zenExitBtn = document.getElementById('zenExitBtn');
  const workbenchResizer = document.getElementById('workbenchResizer');
  const exportWorkspaceBtn = document.getElementById('exportWorkspaceBtn');
  const importWorkspaceBtn = document.getElementById('importWorkspaceBtn');
  const workspaceImportInput = document.getElementById('workspaceImportInput');

  if (toggleConfigPaneBtn) {
    toggleConfigPaneBtn.addEventListener('click', toggleConfigPane);
  }

  if (toggleZenModeBtn) {
    toggleZenModeBtn.addEventListener('click', () => toggleZenMode());
  }

  if (zenExitBtn) {
    zenExitBtn.addEventListener('click', () => toggleZenMode(false));
  }

  if (workbenchResizer) {
    workbenchResizer.addEventListener('pointerdown', startWorkbenchResize);
    workbenchResizer.addEventListener('keydown', handleWorkbenchResizerKeydown);
  }

  window.addEventListener('resize', () => {
    if (workbenchResizeSession) {
      stopWorkbenchResize();
    }
    applyWorkbenchSplit();
  });

  if (exportWorkspaceBtn) {
    exportWorkspaceBtn.addEventListener('click', exportWorkspaceToFile);
  }

  if (importWorkspaceBtn) {
    importWorkspaceBtn.addEventListener('click', openWorkspaceImportDialog);
  }

  if (workspaceImportInput) {
    workspaceImportInput.addEventListener('change', importWorkspaceFromFile);
  }

  applyWorkbenchSplit();
  updateLayoutControls();
}

document.getElementById('dbProvider').addEventListener('change', function onProviderChange() {
  const portMap = { postgresql: 5432, mssql: 1433, mysql: 3306 };
  document.getElementById('dbPort').value = portMap[this.value] || 5432;
  persistWorkspace();
});

// ==================== INIT ====================

const restoredWorkspace = restoreWorkspace();
if (!restoredWorkspace) {
  renderTables();
  renderDtos();
  renderStandardSelects();
  renderDesignStandardSelects();
  renderDesignDocumentPreview();
  renderConformancePreview();
  renderAdrPackPreview();
  renderDiagramPackPreview();
  renderRequirementsPreview();
  renderTaskPlanPreview();
  renderTaskBoard();
  clearGeneratedView();
  updateStats();
}
bindWorkflowEvents();
bindFilterEvents();
bindAutoSaveEvents();
bindStarterEvents();
bindShortcuts();
bindLayoutEvents();
bindStandardEvents();
bindSettingsEvents();
syncLlmStatus();

