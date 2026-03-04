const express = require('express');

const router = express.Router();

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/g, '');
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveLlmConfig(inputConfig) {
  const incoming = inputConfig && typeof inputConfig === 'object' ? inputConfig : {};

  const apiKey = String(incoming.apiKey || '').trim() || process.env.GROQ_API_KEY || '';
  const model = String(incoming.model || '').trim() || process.env.GROQ_MODEL || DEFAULT_MODEL;
  const baseUrl = normalizeBaseUrl(incoming.baseUrl || process.env.GROQ_BASE_URL || DEFAULT_BASE_URL);

  return { apiKey, model, baseUrl };
}

function sanitizeRouteCase(value) {
  const valid = ['kebab', 'camel', 'lower'];
  return valid.includes(value) ? value : 'kebab';
}

function sanitizeDbProvider(value) {
  const valid = ['InMemory', 'SqlServer', 'PostgreSQL', 'MySQL'];
  return valid.includes(value) ? value : 'InMemory';
}

function sanitizeStringArray(value, fallback = [], maxItems = 20) {
  if (!Array.isArray(value)) {
    return fallback.slice(0, maxItems);
  }
  const cleaned = value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return cleaned.length ? cleaned : fallback.slice(0, maxItems);
}

function sanitizeModelOutput(baseStandard, modelPayload) {
  const safe = modelPayload || {};
  const routePrefix = String(safe.routePrefix || baseStandard.routePrefix || 'api').replace(/^\/+|\/+$/g, '');
  const targetFramework = String(safe.targetFramework || baseStandard.targetFramework || 'net8.0').trim();
  const rootNamespace = String(safe.rootNamespace || baseStandard.rootNamespace || 'MyApi').trim();

  return {
    name: String(safe.name || baseStandard.name || 'Imported Standard').trim(),
    targetFramework: targetFramework || 'net8.0',
    rootNamespace: rootNamespace || 'MyApi',
    dbProvider: sanitizeDbProvider(safe.dbProvider || baseStandard.dbProvider),
    useServiceInterfaces: Boolean(
      typeof safe.useServiceInterfaces === 'boolean'
        ? safe.useServiceInterfaces
        : baseStandard.useServiceInterfaces
    ),
    controllerPlural: Boolean(
      typeof safe.controllerPlural === 'boolean'
        ? safe.controllerPlural
        : baseStandard.controllerPlural
    ),
    routeCase: sanitizeRouteCase(safe.routeCase || baseStandard.routeCase),
    routePrefix: routePrefix || 'api',
    document: String(safe.document || baseStandard.document || '').trim()
  };
}

function sanitizeDesignStandardOutput(requestedName, modelPayload) {
  const safe = modelPayload || {};
  const fallbackSections = [
    'Purpose and Scope',
    'System Context',
    'Architecture Decisions',
    'Component Breakdown',
    'Data Design',
    'API Design',
    'Security and Compliance',
    'Observability',
    'Risks and Open Questions'
  ];

  const fallbackTemplate = [
    '# {{projectName}} Design Document',
    '',
    '## 1. Purpose and Scope',
    '- Goal:',
    '- Non-goals:',
    '',
    '## 2. System Context',
    '- Actors:',
    '- External systems:',
    '',
    '## 3. Architecture Decisions',
    '- Decision:',
    '- Rationale:',
    '',
    '## 4. Component Breakdown',
    '- Components:',
    '- Responsibilities:',
    '',
    '## 5. Data Design',
    '- Core entities:',
    '- Storage strategy:',
    '',
    '## 6. API Design',
    '- Endpoints:',
    '- Contracts:',
    '',
    '## 7. Security and Compliance',
    '- AuthN/AuthZ:',
    '- Sensitive data handling:',
    '',
    '## 8. Observability',
    '- Logs:',
    '- Metrics:',
    '- Traces:',
    '',
    '## 9. Risks and Open Questions',
    '- Risks:',
    '- Open questions:'
  ].join('\n');

  const name = String(safe.name || requestedName || 'Design Standard').trim() || 'Design Standard';
  const audience = String(safe.audience || 'Backend Team').trim() || 'Backend Team';
  const documentLanguage = String(safe.documentLanguage || 'tr-TR').trim() || 'tr-TR';
  const architectureStyle = String(safe.architectureStyle || 'Layered').trim() || 'Layered';
  const apiStyle = String(safe.apiStyle || 'REST').trim() || 'REST';
  const template = String(safe.template || fallbackTemplate).trim() || fallbackTemplate;

  return {
    name,
    audience,
    documentLanguage,
    architectureStyle,
    apiStyle,
    sectionOrder: sanitizeStringArray(safe.sectionOrder, fallbackSections, 24),
    namingConventions: sanitizeStringArray(safe.namingConventions, ['PascalCase for types', 'camelCase for locals'], 24),
    folderConventions: sanitizeStringArray(safe.folderConventions, ['Controllers', 'Services', 'Models', 'Data'], 24),
    diagramTypes: sanitizeStringArray(safe.diagramTypes, ['Context Diagram', 'Component Diagram', 'Sequence Diagram'], 24),
    qualityGates: sanitizeStringArray(
      safe.qualityGates,
      ['Security review', 'Error handling policy', 'Observability checklist', 'Test strategy coverage'],
      24
    ),
    template: template.slice(0, 20000)
  };
}

function sanitizeMermaidCode(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const fenced = raw.match(/```mermaid\s*([\s\S]*?)```/i);
  const content = fenced ? fenced[1].trim() : raw;
  if (!content) return fallback;

  return content.slice(0, 20000);
}

function sanitizeDiagramPackOutput(modelPayload) {
  const safe = modelPayload || {};
  const fallbackContext = [
    'flowchart LR',
    '  User[User] --> Api[API]',
    '  Api --> Db[(Database)]'
  ].join('\n');
  const fallbackContainer = [
    'flowchart TB',
    '  subgraph Service',
    '    C1[Controllers]',
    '    C2[Services]',
    '    C3[Data Access]',
    '  end',
    '  C1 --> C2 --> C3'
  ].join('\n');
  const fallbackSequence = [
    'sequenceDiagram',
    '  actor Client',
    '  participant API',
    '  participant DB',
    '  Client->>API: Request',
    '  API->>DB: Query',
    '  DB-->>API: Data',
    '  API-->>Client: Response'
  ].join('\n');

  return {
    contextDiagram: sanitizeMermaidCode(safe.contextDiagram, fallbackContext),
    containerDiagram: sanitizeMermaidCode(safe.containerDiagram, fallbackContainer),
    sequenceDiagram: sanitizeMermaidCode(safe.sequenceDiagram, fallbackSequence)
  };
}

function buildAdrMarkdown(projectName, adr) {
  const status = String(adr.status || 'Proposed').trim() || 'Proposed';
  const title = String(adr.title || 'Untitled Decision').trim() || 'Untitled Decision';
  const context = String(adr.context || '').trim() || '-';
  const decision = String(adr.decision || '').trim() || '-';
  const consequences = String(adr.consequences || '').trim() || '-';
  const fileName = String(adr.fileName || '').trim();
  const finalFileName = fileName || `${projectName.toLowerCase()}-decision.md`;

  return {
    fileName: finalFileName,
    title,
    status,
    content: [
      `# ${title}`,
      '',
      `- Status: ${status}`,
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## Context',
      context,
      '',
      '## Decision',
      decision,
      '',
      '## Consequences',
      consequences
    ].join('\n')
  };
}

function sanitizeAdrPackOutput(projectName, modelPayload, adrCount) {
  const safe = modelPayload || {};
  const requestedCount = Math.max(1, Math.min(10, parseInt(adrCount, 10) || 3));
  const adrs = Array.isArray(safe.adrs) ? safe.adrs : [];
  const sliced = adrs.slice(0, requestedCount);

  const normalized = sliced
    .map(adr => buildAdrMarkdown(projectName, adr))
    .filter(adr => adr.content && adr.title);

  if (normalized.length) {
    return normalized;
  }

  return [
    buildAdrMarkdown(projectName, {
      fileName: 'adr-0001-architecture-baseline.md',
      title: 'Architecture Baseline',
      status: 'Proposed',
      context: 'Initial architecture baseline is required.',
      decision: 'Adopt a layered service architecture with clear API-service-data boundaries.',
      consequences: 'Improves maintainability, but requires strict boundary enforcement.'
    })
  ];
}

function extractJsonPayload(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue with fallback extraction
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const jsonStart = candidate.indexOf('{');
  const jsonEnd = candidate.lastIndexOf('}');

  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
}

function extractMarkdownPayload(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  const fenced = trimmed.match(/^```(?:md|markdown)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function buildEnhanceStandardMessages(standard) {
  return [
    {
      role: 'system',
      content:
        'You are a software architecture assistant. Return ONLY valid JSON. Improve coding standard profile for .NET API scaffolding.'
    },
    {
      role: 'user',
      content: [
        'Given this current coding standard profile and doc, improve it for consistency and practical production defaults.',
        'Do not invent unsupported keys.',
        'Output JSON with EXACT keys:',
        'name, targetFramework, rootNamespace, dbProvider, useServiceInterfaces, controllerPlural, routeCase, routePrefix, document',
        'Valid dbProvider: InMemory | SqlServer | PostgreSQL | MySQL',
        'Valid routeCase: kebab | camel | lower',
        '',
        JSON.stringify(
          {
            standard
          },
          null,
          2
        )
      ].join('\n')
    }
  ];
}

function buildDesignStandardMessages(sampleProject, requestedName) {
  return [
    {
      role: 'system',
      content: 'You are a software design standards assistant. Return ONLY valid JSON.'
    },
    {
      role: 'user',
      content: [
        'Create a reusable design-document standard based on this sample project summary.',
        'Keep it practical and suitable for backend .NET teams.',
        'Do not invent random data; infer from sample and fill missing points with safe defaults.',
        'Output JSON with EXACT keys and value types:',
        'name:string, audience:string, documentLanguage:string, architectureStyle:string, apiStyle:string,',
        'sectionOrder:string[], namingConventions:string[], folderConventions:string[], diagramTypes:string[], qualityGates:string[], template:string',
        `Preferred standard name: ${String(requestedName || '').trim() || 'Design Standard'}`,
        '',
        JSON.stringify(
          {
            sampleProject
          },
          null,
          2
        )
      ].join('\n')
    }
  ];
}

function buildDesignDocumentMessages(targetProject, designStandard, preferredTitle) {
  return [
    {
      role: 'system',
      content: 'You are a senior software architect. Return ONLY markdown.'
    },
    {
      role: 'user',
      content: [
        'Write a detailed but concise software design document in markdown.',
        'Use the provided design standard exactly, especially section order and writing conventions.',
        'If some facts are missing, write explicit assumptions under a separate "Assumptions" section.',
        `Preferred title: ${String(preferredTitle || '').trim() || `${targetProject?.projectName || 'Project'} Design Document`}`,
        '',
        'Design standard:',
        JSON.stringify(designStandard, null, 2),
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

function buildConformanceReportMessages(targetProject, designStandard) {
  return [
    {
      role: 'system',
      content: 'You are a software architecture reviewer. Return ONLY markdown.'
    },
    {
      role: 'user',
      content: [
        'Evaluate project conformance to the given design standard.',
        'Use a practical score table from 0 to 100 for each category.',
        'Output markdown sections:',
        '1) Executive Summary',
        '2) Score Table',
        '3) Findings by Category',
        '4) Priority Actions (Top 10)',
        '5) Risks if ignored',
        '',
        'Design standard:',
        JSON.stringify(designStandard, null, 2),
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

function buildAdrPackMessages(targetProject, designStandard, adrCount) {
  return [
    {
      role: 'system',
      content: 'You are a software architect. Return ONLY valid JSON.'
    },
    {
      role: 'user',
      content: [
        'Create architecture decision records for this project.',
        `Generate exactly ${adrCount} ADR items.`,
        'Output JSON with EXACT keys:',
        'adrs: [{fileName, title, status, context, decision, consequences}]',
        'Use concise and actionable decisions.',
        '',
        'Design standard:',
        JSON.stringify(designStandard, null, 2),
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

function buildDiagramPackMessages(targetProject, designStandard) {
  return [
    {
      role: 'system',
      content: 'You are a software architect. Return ONLY valid JSON.'
    },
    {
      role: 'user',
      content: [
        'Generate Mermaid diagrams for this project and standard.',
        'Output JSON with EXACT keys:',
        'contextDiagram, containerDiagram, sequenceDiagram',
        'Values must be plain mermaid code (without markdown fences).',
        '',
        'Design standard:',
        JSON.stringify(designStandard, null, 2),
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

function buildRequirementsAnalysisMessages(targetProject, designStandard, businessContext) {
  const standardPayload = designStandard && typeof designStandard === 'object' ? designStandard : {};
  const contextPayload = String(businessContext || '').trim();

  return [
    {
      role: 'system',
      content: 'You are a senior business analyst and software architect. Return ONLY markdown.'
    },
    {
      role: 'user',
      content: [
        'Create a software requirements analysis document from the given project summary.',
        'Output markdown in Turkish with these sections in order:',
        '1) Amac ve Kapsam',
        '2) Paydaslar',
        '3) Fonksiyonel Gereksinimler (FR-001 formati ile)',
        '4) Fonksiyonel Olmayan Gereksinimler (NFR-001 formati ile)',
        '5) Kisitlar ve Bagimliliklar',
        '6) Varsayimlar',
        '7) Kapsam Disi Maddeler',
        '8) Onceliklendirilmis MVP Backlog (Must/Should/Could)',
        '9) Acik Sorular ve Riskler',
        'Each requirement must include a short acceptance criterion bullet.',
        '',
        'Design standard (optional context):',
        JSON.stringify(standardPayload, null, 2),
        '',
        `Business context (optional): ${contextPayload || '-'}`,
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

function buildTaskPlanMessages(targetProject, designStandard, requirementsDocument, businessContext) {
  const standardPayload = designStandard && typeof designStandard === 'object' ? designStandard : {};
  const requirementsPayload = String(requirementsDocument || '').trim();
  const contextPayload = String(businessContext || '').trim();

  return [
    {
      role: 'system',
      content: 'You are a senior technical project manager and software architect. Return ONLY markdown.'
    },
    {
      role: 'user',
      content: [
        'Create an actionable implementation task plan in Turkish for the given project.',
        'Output markdown with these sections in order:',
        '1) Plan Ozeti',
        '2) Epic Listesi (EPIC-001 formatinda)',
        '3) Sprint Plani (Sprint 1/2/3 hedefleri)',
        '4) Gorev Backlogu (TASK-001 formatinda, tahmin: XS/S/M/L)',
        '5) Bagimliliklar',
        '6) Riskler ve Azaltma Aksiyonlari',
        '7) Definition of Done',
        'Each task must include an acceptance criterion bullet and owner role suggestion.',
        'Avoid generic placeholders; produce concrete technical tasks.',
        '',
        `Business context (optional): ${contextPayload || '-'}`,
        '',
        'Design standard (optional context):',
        JSON.stringify(standardPayload, null, 2),
        '',
        'Requirements analysis markdown (optional context):',
        requirementsPayload || '-',
        '',
        'Target project summary:',
        JSON.stringify(targetProject, null, 2)
      ].join('\n')
    }
  ];
}

async function executeChatCompletion(llmConfig, requestBody) {
  let response;
  try {
    response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    throw new Error(`LLM request failed: ${error.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    const message = `LLM request returned ${response.status}`;
    const error = new Error(message);
    error.detail = errorBody.slice(0, 500);
    throw error;
  }

  return response.json();
}

function ensureLlmConfig(llmConfig, res) {
  if (!llmConfig.apiKey) {
    res.status(400).json({
      success: false,
      message: 'LLM token missing. Set GROQ_API_KEY on server or send llmConfig.apiKey.'
    });
    return false;
  }

  if (!isValidHttpUrl(llmConfig.baseUrl)) {
    res.status(400).json({
      success: false,
      message: 'llmConfig.baseUrl is invalid.'
    });
    return false;
  }

  return true;
}

router.get('/status', (req, res) => {
  const config = resolveLlmConfig(null);
  return res.json({
    success: true,
    provider: 'groq-openai-compatible',
    configured: Boolean(process.env.GROQ_API_KEY),
    model: config.model,
    baseUrl: config.baseUrl,
    acceptsRuntimeConfig: true
  });
});

router.post('/enhance-standard', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const standard = req.body?.standard;
  if (!standard || typeof standard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'standard payload is required.'
    });
  }

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.2,
    messages: buildEnhanceStandardMessages(standard)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonPayload(content);

  if (!parsed) {
    return res.status(502).json({
      success: false,
      message: 'LLM response could not be parsed as JSON.'
    });
  }

  const enhanced = sanitizeModelOutput(standard, parsed);
  return res.json({
    success: true,
    standard: enhanced,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/derive-design-standard', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const sampleProject = req.body?.sampleProject;
  if (!sampleProject || typeof sampleProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'sampleProject payload is required.'
    });
  }

  const requestedName = String(req.body?.name || '').trim() || 'Design Standard';
  const requestBody = {
    model: llmConfig.model,
    temperature: 0.2,
    messages: buildDesignStandardMessages(sampleProject, requestedName)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonPayload(content);
  if (!parsed) {
    return res.status(502).json({
      success: false,
      message: 'LLM response for design standard is not valid JSON.'
    });
  }

  const designStandard = sanitizeDesignStandardOutput(requestedName, parsed);
  return res.json({
    success: true,
    designStandard,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/generate-design-document', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  const designStandard = req.body?.designStandard;

  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }

  if (!designStandard || typeof designStandard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'designStandard payload is required.'
    });
  }

  const preferredTitle = String(req.body?.title || '').trim();
  const requestBody = {
    model: llmConfig.model,
    temperature: 0.35,
    messages: buildDesignDocumentMessages(targetProject, designStandard, preferredTitle)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const document = extractMarkdownPayload(content);
  if (!document) {
    return res.status(502).json({
      success: false,
      message: 'LLM response did not include a design document.'
    });
  }

  return res.json({
    success: true,
    document,
    title: preferredTitle || `${targetProject.projectName || 'Project'} Design Document`,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/generate-conformance-report', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  const designStandard = req.body?.designStandard;
  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }
  if (!designStandard || typeof designStandard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'designStandard payload is required.'
    });
  }

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.2,
    messages: buildConformanceReportMessages(targetProject, designStandard)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const report = extractMarkdownPayload(content);
  if (!report) {
    return res.status(502).json({
      success: false,
      message: 'LLM response did not include a conformance report.'
    });
  }

  return res.json({
    success: true,
    report,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/generate-adr-pack', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  const designStandard = req.body?.designStandard;
  const adrCount = Math.max(1, Math.min(10, parseInt(req.body?.adrCount, 10) || 3));
  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }
  if (!designStandard || typeof designStandard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'designStandard payload is required.'
    });
  }

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.25,
    messages: buildAdrPackMessages(targetProject, designStandard, adrCount)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonPayload(content);
  if (!parsed) {
    return res.status(502).json({
      success: false,
      message: 'LLM response for ADR pack is not valid JSON.'
    });
  }

  const projectName = String(targetProject.projectName || 'project').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase() || 'project';
  const adrs = sanitizeAdrPackOutput(projectName, parsed, adrCount);

  return res.json({
    success: true,
    adrs,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/generate-diagram-pack', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  const designStandard = req.body?.designStandard;
  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }
  if (!designStandard || typeof designStandard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'designStandard payload is required.'
    });
  }

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.2,
    messages: buildDiagramPackMessages(targetProject, designStandard)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonPayload(content);
  if (!parsed) {
    return res.status(502).json({
      success: false,
      message: 'LLM response for diagram pack is not valid JSON.'
    });
  }

  const diagrams = sanitizeDiagramPackOutput(parsed);
  return res.json({
    success: true,
    diagrams,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/analyze-requirements', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }

  const designStandard = req.body?.designStandard && typeof req.body.designStandard === 'object'
    ? req.body.designStandard
    : null;
  const businessContext = String(req.body?.businessContext || '').trim().slice(0, 8000);

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.25,
    messages: buildRequirementsAnalysisMessages(targetProject, designStandard, businessContext)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const requirementsDocument = extractMarkdownPayload(content);
  if (!requirementsDocument) {
    return res.status(502).json({
      success: false,
      message: 'LLM response did not include a requirements document.'
    });
  }

  return res.json({
    success: true,
    requirementsDocument,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

router.post('/generate-task-plan', async (req, res) => {
  const llmConfig = resolveLlmConfig(req.body?.llmConfig);
  if (!ensureLlmConfig(llmConfig, res)) {
    return undefined;
  }

  const targetProject = req.body?.targetProject;
  if (!targetProject || typeof targetProject !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'targetProject payload is required.'
    });
  }

  const designStandard = req.body?.designStandard && typeof req.body.designStandard === 'object'
    ? req.body.designStandard
    : null;
  const requirementsDocument = String(req.body?.requirementsDocument || '').trim().slice(0, 30000);
  const businessContext = String(req.body?.businessContext || '').trim().slice(0, 8000);

  const requestBody = {
    model: llmConfig.model,
    temperature: 0.2,
    messages: buildTaskPlanMessages(targetProject, designStandard, requirementsDocument, businessContext)
  };

  let result;
  try {
    result = await executeChatCompletion(llmConfig, requestBody);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error.message,
      detail: error.detail || ''
    });
  }

  const content = result?.choices?.[0]?.message?.content || '';
  const taskPlanDocument = extractMarkdownPayload(content);
  if (!taskPlanDocument) {
    return res.status(502).json({
      success: false,
      message: 'LLM response did not include a task plan.'
    });
  }

  return res.json({
    success: true,
    taskPlanDocument,
    meta: {
      provider: 'groq-openai-compatible',
      model: requestBody.model,
      baseUrl: llmConfig.baseUrl
    }
  });
});

module.exports = router;
