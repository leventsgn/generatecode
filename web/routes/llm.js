const express = require('express');

const router = express.Router();

const DEFAULT_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

function sanitizeRouteCase(value) {
  const valid = ['kebab', 'camel', 'lower'];
  return valid.includes(value) ? value : 'kebab';
}

function sanitizeDbProvider(value) {
  const valid = ['InMemory', 'SqlServer', 'PostgreSQL', 'MySQL'];
  return valid.includes(value) ? value : 'InMemory';
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

function buildMessages(standard) {
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

router.get('/status', (req, res) => {
  return res.json({
    success: true,
    provider: 'groq-openai-compatible',
    configured: Boolean(process.env.GROQ_API_KEY),
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL
  });
});

router.post('/enhance-standard', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      message: 'GROQ_API_KEY is not configured on server.'
    });
  }

  const standard = req.body?.standard;
  if (!standard || typeof standard !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'standard payload is required.'
    });
  }

  const requestBody = {
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    messages: buildMessages(standard)
  };

  let response;
  try {
    response = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: `LLM request failed: ${error.message}`
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    return res.status(502).json({
      success: false,
      message: `LLM request returned ${response.status}`,
      detail: errorBody.slice(0, 500)
    });
  }

  const result = await response.json();
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
      model: requestBody.model
    }
  });
});

module.exports = router;
