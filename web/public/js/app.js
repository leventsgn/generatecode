// Application State
const state = {
  tables: [],
  dtos: [],
  generatedFiles: {},
  currentFile: null,
  editingTableIndex: -1,
  editingDtoIndex: -1
};

// ==================== TABLE MANAGEMENT ====================

function addTable() {
  state.editingTableIndex = -1;
  document.getElementById('tableModalTitle').textContent = 'Yeni Tablo';
  document.getElementById('modalTableName').value = '';
  document.getElementById('modalGenCrud').checked = true;
  document.getElementById('modalColumnsBody').innerHTML = '';

  // Add default Id column
  addColumnToModal('Id', 'int', true, true, '');
  addColumnToModal('', 'string', false, false, '');

  new bootstrap.Modal(document.getElementById('tableModal')).show();
}

function editTable(index) {
  state.editingTableIndex = index;
  const table = state.tables[index];

  document.getElementById('tableModalTitle').textContent = `Tablo Düzenle: ${table.name}`;
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
    <td><input type="text" class="form-control form-control-sm col-name" value="${name}" placeholder="ColumnName"></td>
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
  if (!name) { alert('Tablo adı zorunlu!'); return; }

  const columns = [];
  document.querySelectorAll('#modalColumnsBody tr').forEach(row => {
    const colName = row.querySelector('.col-name').value.trim();
    if (!colName) return;
    columns.push({
      name: colName,
      type: row.querySelector('.col-type').value,
      isPrimaryKey: row.querySelector('.col-pk').checked,
      isRequired: row.querySelector('.col-req').checked,
      maxLength: row.querySelector('.col-maxlen').value ? parseInt(row.querySelector('.col-maxlen').value) : null
    });
  });

  if (columns.length === 0) { alert('En az bir sütun ekleyin!'); return; }

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
  bootstrap.Modal.getInstance(document.getElementById('tableModal')).hide();
}

function deleteTable(index) {
  if (confirm(`"${state.tables[index].name}" tablosunu silmek istediğinize emin misiniz?`)) {
    state.tables.splice(index, 1);
    renderTables();
  }
}

function renderTables() {
  const container = document.getElementById('tablesList');
  if (state.tables.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Henüz tablo eklenmedi. "Tablo Ekle" butonuna tıklayın veya veritabanından içe aktarın.</small></div>';
    return;
  }

  container.innerHTML = state.tables.map((t, i) => `
    <div class="table-card d-flex justify-content-between align-items-center" onclick="editTable(${i})">
      <div>
        <div class="table-name"><i class="bi bi-table me-1"></i>${t.name}</div>
        <div class="table-info">${t.columns.length} sütun ${t.generateCrud ? '• CRUD' : ''}</div>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteTable(${i})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
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

  document.getElementById('dtoModalTitle').textContent = `DTO Düzenle: ${dto.name}`;
  document.getElementById('modalDtoName').value = dto.name;
  document.getElementById('modalDtoType').value = dto.type;
  document.getElementById('modalDtoFieldsBody').innerHTML = '';

  dto.fields.forEach(f => addDtoFieldToModal(f.name, f.type, f.isRequired, f.maxLength || ''));

  new bootstrap.Modal(document.getElementById('dtoModal')).show();
}

function addDtoFieldToModal(name = '', type = 'string', isReq = false, maxLen = '') {
  const tbody = document.getElementById('modalDtoFieldsBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" class="form-control form-control-sm dto-fname" value="${name}" placeholder="FieldName"></td>
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
  if (!name) { alert('DTO adı zorunlu!'); return; }

  const fields = [];
  document.querySelectorAll('#modalDtoFieldsBody tr').forEach(row => {
    const fName = row.querySelector('.dto-fname').value.trim();
    if (!fName) return;
    fields.push({
      name: fName,
      type: row.querySelector('.dto-ftype').value,
      isRequired: row.querySelector('.dto-freq').checked,
      maxLength: row.querySelector('.dto-fmaxlen').value ? parseInt(row.querySelector('.dto-fmaxlen').value) : null
    });
  });

  if (fields.length === 0) { alert('En az bir alan ekleyin!'); return; }

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
  bootstrap.Modal.getInstance(document.getElementById('dtoModal')).hide();
}

function deleteDto(index) {
  if (confirm(`"${state.dtos[index].name}" DTO'sunu silmek istediğinize emin misiniz?`)) {
    state.dtos.splice(index, 1);
    renderDtos();
  }
}

function renderDtos() {
  const container = document.getElementById('dtoList');
  if (state.dtos.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-3"><small>Henüz DTO eklenmedi. Request/Response modelleri için "DTO Ekle" butonuna tıklayın.</small></div>';
    return;
  }

  container.innerHTML = state.dtos.map((d, i) => `
    <div class="dto-card d-flex justify-content-between align-items-center" onclick="editDto(${i})">
      <div>
        <div class="fw-bold">
          <span class="badge badge-${d.type} me-1">${d.type === 'request' ? 'REQ' : 'RES'}</span>
          ${d.name}
        </div>
        <div class="table-info">${d.fields.length} alan</div>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteDto(${i})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ==================== DATABASE CONNECTION ====================

function getDbConfig() {
  return {
    provider: document.getElementById('dbProvider').value,
    host: document.getElementById('dbHost').value,
    port: parseInt(document.getElementById('dbPort').value),
    database: document.getElementById('dbName').value,
    user: document.getElementById('dbUser').value,
    password: document.getElementById('dbPassword').value
  };
}

async function testDbConnection() {
  const status = document.getElementById('dbStatus');
  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>Bağlanıyor...</div>';

  try {
    const resp = await fetch('/api/database/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDbConfig())
    });
    const data = await resp.json();

    if (data.success) {
      status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${data.message}</div>`;
    } else {
      status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small"><i class="bi bi-x-circle me-1"></i>${data.message}</div>`;
    }
  } catch (err) {
    status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small"><i class="bi bi-x-circle me-1"></i>Bağlantı hatası: ${err.message}</div>`;
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
      status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${data.tables.length} tablo bulundu</div>`;

      list.innerHTML = `
        <div class="mt-2">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <small class="fw-bold">Tabloları seçin:</small>
            <button class="btn btn-sm btn-success" onclick="importSelectedTables()">
              <i class="bi bi-download me-1"></i>İçe Aktar
            </button>
          </div>
          ${data.tables.map(t => `
            <div class="form-check">
              <input class="form-check-input db-table-check" type="checkbox" value="${t}" id="dbTbl_${t}" checked>
              <label class="form-check-label small" for="dbTbl_${t}">${t}</label>
            </div>
          `).join('')}
        </div>
      `;
    } else if (data.success) {
      status.innerHTML = '<div class="alert alert-warning py-1 mt-2 small">Tablo bulunamadı.</div>';
    } else {
      status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small">${data.message}</div>`;
    }
  } catch (err) {
    status.innerHTML = `<div class="alert alert-danger py-1 mt-2 small">Hata: ${err.message}</div>`;
  }
}

async function importSelectedTables() {
  const checked = document.querySelectorAll('.db-table-check:checked');
  const config = getDbConfig();
  const status = document.getElementById('dbStatus');

  status.innerHTML = '<div class="alert alert-info py-1 mt-2 small"><i class="bi bi-hourglass-split me-1"></i>Sütunlar getiriliyor...</div>';

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
        const pascalName = tableName.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
        const existing = state.tables.findIndex(t => t.name === pascalName);
        const table = {
          name: pascalName,
          generateCrud: true,
          columns: data.columns.map(c => ({
            name: c.name.replace(/(^|_)(\w)/g, (_, __, ch) => ch.toUpperCase()),
            type: c.dataType,
            isPrimaryKey: c.isPrimaryKey,
            isRequired: !c.isNullable,
            maxLength: c.maxLength
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
  status.innerHTML = `<div class="alert alert-success py-1 mt-2 small"><i class="bi bi-check-circle me-1"></i>${checked.length} tablo başarıyla içe aktarıldı!</div>`;

  // Switch to tables tab
  document.querySelector('[data-bs-target="#tabTables"]').click();
}

// ==================== CODE GENERATION ====================

function generateCode() {
  if (state.tables.length === 0) {
    alert('Lütfen en az bir tablo ekleyin!');
    return;
  }

  const config = {
    projectName: document.getElementById('projectName').value || 'MyApi',
    rootNamespace: document.getElementById('rootNamespace').value || 'MyApi',
    targetDbProvider: document.getElementById('targetDbProvider').value,
    targetFramework: document.getElementById('targetFramework').value,
    optSwagger: document.getElementById('optSwagger').checked,
    optFluentValidation: document.getElementById('optFluentValidation').checked,
    optAutoMapper: document.getElementById('optAutoMapper').checked,
    tables: state.tables,
    dtos: state.dtos
  };

  state.generatedFiles = CodeGen.generateAll(config);
  renderGeneratedCode();
}

function renderGeneratedCode() {
  const files = Object.keys(state.generatedFiles);
  if (files.length === 0) return;

  // File tabs
  const tabsContainer = document.getElementById('fileTabs');
  tabsContainer.innerHTML = files.map((f, i) => `
    <li class="nav-item">
      <button class="nav-link ${i === 0 ? 'active' : ''}" onclick="showFile('${f}', this)">
        <i class="bi ${getFileIcon(f)} me-1"></i>${f.split('/').pop()}
      </button>
    </li>
  `).join('');

  // Show first file
  state.currentFile = files[0];
  showFileContent(files[0]);
}

function showFile(filename, btn) {
  state.currentFile = filename;
  document.querySelectorAll('#fileTabs .nav-link').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showFileContent(filename);
}

function showFileContent(filename) {
  const container = document.getElementById('codeContainer');
  const code = state.generatedFiles[filename];
  const lang = filename.endsWith('.cs') ? 'csharp' : filename.endsWith('.json') ? 'json' : 'markup';

  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    showToast('Kod panoya kopyalandı!');
  });
}

function downloadAllCode() {
  const files = state.generatedFiles;
  if (Object.keys(files).length === 0) return;

  // Download as a combined text file (since we can't create ZIPs without a library)
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
  const a = document.createElement('a');
  a.href = url;
  a.download = `${document.getElementById('projectName').value || 'MyApi'}_generated.cs`;
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'position-fixed bottom-0 end-0 p-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `<div class="toast show" role="alert"><div class="toast-body"><i class="bi bi-check-circle text-success me-1"></i>${message}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ==================== DB PROVIDER CHANGE ====================

document.getElementById('dbProvider').addEventListener('change', function() {
  const portMap = { postgresql: 5432, mssql: 1433, mysql: 3306 };
  document.getElementById('dbPort').value = portMap[this.value] || 5432;
});

// ==================== INIT ====================

renderTables();
renderDtos();
