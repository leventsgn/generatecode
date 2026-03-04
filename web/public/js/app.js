// Application state
const state = {
  tables: [],
  dtos: [],
  generatedFiles: {},
  currentFile: null,
  editingTableIndex: -1,
  editingDtoIndex: -1,
  standards: [],
  selectedStandardId: ''
};

const STORAGE_KEY = 'generatecode_workspace_v3';

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
    selectedStandardId: state.selectedStandardId || ''
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
    selectedStandardId: ''
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
  state.selectedStandardId = cfg.selectedStandardId || '';
}

function persistWorkspace() {
  const payload = {
    config: getConfigSnapshot(),
    tables: state.tables,
    dtos: state.dtos,
    standards: state.standards,
    selectedStandardId: state.selectedStandardId
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const payload = JSON.parse(raw);
    applyConfigSnapshot(payload.config || {});
    state.tables = Array.isArray(payload.tables) ? payload.tables : [];
    state.dtos = Array.isArray(payload.dtos) ? payload.dtos : [];
    state.standards = Array.isArray(payload.standards) ? payload.standards : [];
    state.selectedStandardId = payload.selectedStandardId || payload.config?.selectedStandardId || state.selectedStandardId;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearGeneratedView() {
  state.generatedFiles = {};
  state.currentFile = null;
  const explorer = document.getElementById('fileExplorer');
  if (explorer) {
    explorer.innerHTML = `
      <div class="explorer-header">DOSYALAR</div>
      <div class="file-explorer-empty">Henuz uretilmis dosya yok.</div>
    `;
  }
  document.getElementById('codeContainer').innerHTML = `
    <div class="empty-state text-center py-5">
      <i class="bi bi-code-square display-4"></i>
      <p class="mt-3 mb-1">Sol panelden tablo/DTO ekleyip ÃƒÂ¼retime baÃ…Å¸la.</p>
      <small>Ãƒâ€“rnek baÃ…Å¸langÃ„Â±ÃƒÂ§ iÃƒÂ§in Ã¢â‚¬Å“Ãƒâ€“rnek Ã…Âema YÃƒÂ¼kleÃ¢â‚¬Â butonunu kullanabilirsin.</small>
    </div>
  `;
}

function updateStats() {
  document.getElementById('statTables').textContent = String(state.tables.length);
  document.getElementById('statDtos').textContent = String(state.dtos.length);
  document.getElementById('statFiles').textContent = String(Object.keys(state.generatedFiles).length);
  document.getElementById('generatedFileCount').textContent = `${Object.keys(state.generatedFiles).length} dosya`;
}

function openConfigTab(tabTarget) {
  const normalizedTarget = String(tabTarget || '').startsWith('#') ? String(tabTarget) : `#${String(tabTarget || '')}`;
  const trigger = document.querySelector(`#configTabs .nav-link[data-bs-target="${normalizedTarget}"]`);
  if (!trigger) return;
  bootstrap.Tab.getOrCreateInstance(trigger).show();
}

function updateWorkflowSteps() {
  const activeTab = document.querySelector('#configTabs .nav-link.active');
  const activeTarget = activeTab?.getAttribute('data-bs-target') || '';
  document.querySelectorAll('.workflow-step').forEach(step => {
    step.classList.toggle('active', step.dataset.target === activeTarget);
  });
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
    preview.textContent = 'Henuz standart analizi yapilmadi.';
    return;
  }

  preview.textContent = standard.document || 'Standart dokumani olusturulamadi.';
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
    '- Bu profil secilirse controller route ve isimleri bu standarda gore olusur.',
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
    alert('Lutfen analiz icin proje klasoru secin.');
    return;
  }

  const analyzableFiles = files.filter(file => shouldAnalyzeFile(file.webkitRelativePath || file.name));
  if (!analyzableFiles.length) {
    alert('Analiz icin uygun dosya bulunamadi.');
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
    alert(`Standart analizi basarisiz: ${error.message}`);
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
    alert('Silinecek standart secili degil.');
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
    alert('Lutfen once bir standart secin.');
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
  const button = document.getElementById('enhanceStandardWithLlmBtn');
  if (!button) return;

  const runtime = getLlmRuntimeConfig();
  if (runtime.apiKey) {
    button.disabled = false;
    button.title = `LLM model: ${runtime.model || 'openai/gpt-oss-120b'} (ekran ayari)`;
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
      button.disabled = true;
      button.title = 'LLM token girin veya server env de GROQ_API_KEY tanimlayin.';
      setLlmConfigHint('Token girin veya server env icinde GROQ_API_KEY tanimlayin.', 'warning');
      return;
    }

    button.disabled = false;
    button.title = `LLM model: ${data.model} (server env)`;
    setLlmConfigHint('Server env tokeni aktif. Istersen ekrandan override edebilirsin.', 'muted');
  } catch {
    button.disabled = true;
    button.title = 'LLM durumu okunamadi.';
    setLlmConfigHint('LLM status okunamadi. URL/token degerlerini kontrol et.', 'danger');
  }
}

async function enhanceSelectedStandardWithLlm() {
  const standardsSelect = document.getElementById('standardsListSelect');
  const selectedId = standardsSelect?.value || state.selectedStandardId;
  if (!selectedId) {
    alert('Lutfen once bir standart secin.');
    return;
  }

  const standard = getStandardById(selectedId);
  if (!standard) {
    alert('Secili standart bulunamadi.');
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
      throw new Error(data.message || 'LLM istegi basarisiz.');
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
    showToast(`LLM ile guncellendi: ${updated.name}`);
  } catch (error) {
    alert(`LLM zenginlestirme hatasi: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
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

  document.getElementById('tableModalTitle').textContent = `Tablo DÃƒÂ¼zenle: ${table.name}`;
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
    alert('Tablo adÃ„Â± zorunlu.');
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
    alert('En az bir sÃƒÂ¼tun ekleyin.');
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
  if (!confirm(`"${state.tables[index].name}" tablosunu silmek istediÃ„Å¸inize emin misiniz?`)) {
    return;
  }
  state.tables.splice(index, 1);
  renderTables();
  persistWorkspace();
}

function renderTables() {
  const container = document.getElementById('tablesList');
  const search = document.getElementById('tableSearch').value.trim().toLowerCase();
  const list = state.tables.filter(table => table.name.toLowerCase().includes(search));

  if (state.tables.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>HenÃƒÂ¼z tablo eklenmedi. "Tablo Ekle" butonuna tÃ„Â±klayÃ„Â±n veya veritabanÃ„Â±ndan iÃƒÂ§e aktarÃ„Â±n.</small></div>';
    updateStats();
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Aramaya uygun tablo bulunamadÃ„Â±.</small></div>';
    updateStats();
    return;
  }

  container.innerHTML = list.map(table => {
    const index = state.tables.indexOf(table);
    return `
      <div class="table-card d-flex justify-content-between align-items-center" onclick="editTable(${index})">
        <div>
          <div class="table-name"><i class="bi bi-table me-1"></i>${escapeHtml(table.name)}</div>
          <div class="table-info">${table.columns.length} sÃƒÂ¼tun ${table.generateCrud ? 'Ã¢â‚¬Â¢ CRUD' : ''}</div>
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

  document.getElementById('dtoModalTitle').textContent = `DTO DÃƒÂ¼zenle: ${dto.name}`;
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
    alert('DTO adÃ„Â± zorunlu.');
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
  if (!confirm(`"${state.dtos[index].name}" DTO kaydÃ„Â±nÃ„Â± silmek istediÃ„Å¸inize emin misiniz?`)) {
    return;
  }
  state.dtos.splice(index, 1);
  renderDtos();
  persistWorkspace();
}

function renderDtos() {
  const container = document.getElementById('dtoList');
  const search = document.getElementById('dtoSearch').value.trim().toLowerCase();
  const list = state.dtos.filter(dto => dto.name.toLowerCase().includes(search));

  if (state.dtos.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>HenÃƒÂ¼z DTO eklenmedi. "DTO Ekle" butonuna tÃ„Â±klayÃ„Â±n.</small></div>';
    updateStats();
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Aramaya uygun DTO bulunamadÃ„Â±.</small></div>';
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
  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>BaÃ„Å¸lanÃ„Â±lÃ„Â±yor...</div>';

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
    status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small"><i class="bi bi-x-circle me-1"></i>BaÃ„Å¸lantÃ„Â± hatasÃ„Â±: ${escapeHtml(err.message)}</div>`;
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
            <small class="fw-bold">Ã„Â°ÃƒÂ§e aktarÃ„Â±lacak tablolar:</small>
            <button class="btn btn-sm btn-success" onclick="importSelectedTables()">
              <i class="bi bi-download me-1"></i>Ã„Â°ÃƒÂ§e Aktar
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
      status.innerHTML = '<div class="alert alert-warning py-1 mt-2 small">Tablo bulunamadÃ„Â±.</div>';
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
    status.innerHTML = '<div class="alert alert-warning py-1 mt-2 small">LÃƒÂ¼tfen en az bir tablo seÃƒÂ§in.</div>';
    return;
  }

  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>SÃƒÂ¼tunlar getiriliyor...</div>';

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
  status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${checked.length} tablo iÃƒÂ§e aktarÃ„Â±ldÃ„Â±.</div>`;
  document.querySelector('[data-bs-target="#tabTables"]').click();
}

// ==================== CODE GENERATION ====================

function generateCode() {
  const projectType = document.getElementById('projectType')?.value || 'webapi';
  if (projectType === 'webapi' && state.tables.length === 0) {
    alert('Lutfen en az bir tablo ekleyin.');
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
    showToast('Dosya panoya kopyalandÃ„Â±.');
  });
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
  showToast('Ãƒâ€“rnek Ã…Å¸ema yÃƒÂ¼klendi.');
}

function resetWorkspace() {
  if (!confirm('TÃƒÂ¼m tablo/DTO verisi ve kod ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â± temizlensin mi? (Standartlar korunur)')) {
    return;
  }

  state.tables = [];
  state.dtos = [];
  state.generatedFiles = {};
  state.currentFile = null;
  state.editingTableIndex = -1;
  state.editingDtoIndex = -1;

  applyConfigSnapshot({ selectedStandardId: state.selectedStandardId });
  document.getElementById('tableSearch').value = '';
  document.getElementById('dtoSearch').value = '';
  document.getElementById('dbStatus').innerHTML = '';
  document.getElementById('dbTablesList').innerHTML = '';

  renderTables();
  renderDtos();
  renderStandardSelects();
  clearGeneratedView();
  updateStats();
  persistWorkspace();
  showToast('Ãƒâ€¡alÃ„Â±Ã…Å¸ma alanÃ„Â± sÃ„Â±fÃ„Â±rlandÃ„Â±.');
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
}

function bindAutoSaveEvents() {
  const ids = [
    'projectType', 'projectName', 'rootNamespace', 'targetDbProvider', 'targetFramework',
    'optSwagger', 'optFluentValidation', 'optAutoMapper',
    'optAuthPack', 'optProductionPack', 'optTestGeneration', 'optEfMigrations', 'optPostmanExport',
    'dbProvider', 'dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword',
    'activeStandardSelect',
    'llmBaseUrl', 'llmModel', 'llmApiKey'
  ];

  ids.forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    const eventName = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
    element.addEventListener(eventName, persistWorkspace);
    if (id.startsWith('llm')) {
      element.addEventListener(eventName, syncLlmStatus);
    }
  });
}

function bindShortcuts() {
  document.addEventListener('keydown', event => {
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
      alert('LÃƒÂ¼tfen bir standart seÃƒÂ§in.');
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

document.getElementById('dbProvider').addEventListener('change', function onProviderChange() {
  const portMap = { postgresql: 5432, mssql: 1433, mysql: 3306 };
  document.getElementById('dbPort').value = portMap[this.value] || 5432;
  persistWorkspace();
});

// ==================== INIT ====================

restoreWorkspace();
renderTables();
renderDtos();
renderStandardSelects();
clearGeneratedView();
updateStats();
bindWorkflowEvents();
bindFilterEvents();
bindAutoSaveEvents();
bindShortcuts();
bindStandardEvents();
bindSettingsEvents();
syncLlmStatus();

