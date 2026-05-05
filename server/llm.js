// ─── SourceDesk server-side LLM helper ───────────────────────────────────────
// Makes non-streaming calls to Anthropic, OpenAI, or a local OpenAI-compat LLM.
// No npm dependencies — uses Node.js built-in https/http modules only.
//
// Usage:
//   const { callLlm } = require('./server/llm');
//   const text = await callLlm(systemPrompt, userMessage, { env });
//
// opts:
//   opts.env          — the parsed .env object (from loadEnv in server.js)
//   opts.provider     — 'anthropic' | 'openai' | 'local'  (overrides env.LLM_PROVIDER)
//   opts.model        — model ID  (overrides env.LLM_MODEL)
//   opts.maxTokens    — max response tokens  (default: 4096)

'use strict';

const https = require('https');
const http  = require('http');

async function callLlm(systemPrompt, userMessage, opts) {
  const env = (opts && opts.env) || {};

  const provider  = (opts && opts.provider)  || env.LLM_PROVIDER  || 'anthropic';
  const maxTokens = (opts && opts.maxTokens) || 4096;

  if (provider === 'anthropic') {
    return _callAnthropic(systemPrompt, userMessage, opts, maxTokens, env);
  }
  if (provider === 'openai') {
    return _callOpenAiCompat(
      'https://api.openai.com/v1/chat/completions',
      env.OPENAI_API_KEY || '',
      systemPrompt, userMessage, opts, maxTokens, env
    );
  }
  if (provider === 'local') {
    const base = (env.LOCAL_LLM_URL || 'http://localhost:11434/v1')
      .replace(/\/+$/, '');
    return _callOpenAiCompat(
      base + '/chat/completions',
      env.LOCAL_LLM_KEY || '',
      systemPrompt, userMessage, opts, maxTokens, env
    );
  }

  throw new Error('callLlm: unknown provider "' + provider + '". Use anthropic, openai, or local.');
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function _callAnthropic(systemPrompt, userMessage, opts, maxTokens, env) {
  const key = (opts && opts.apiKey) || env.ANTHROPIC_API_KEY || '';
  if (!key) throw new Error('callLlm: ANTHROPIC_API_KEY is not set');

  const model = (opts && opts.model) || env.LLM_MODEL || 'claude-sonnet-4-6';

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    stream: false,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const resp = await _httpRequest('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'content-type':             'application/json',
      'x-api-key':                key,
      'anthropic-version':        '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  }, body);

  if (resp.status !== 200) {
    throw new Error('Anthropic API error ' + resp.status + ': ' + resp.text.slice(0, 300));
  }

  let parsed;
  try { parsed = JSON.parse(resp.text); } catch (e) {
    throw new Error('Anthropic response parse error: ' + e.message);
  }

  const content = parsed.content && parsed.content[0] && parsed.content[0].text;
  if (typeof content !== 'string') {
    throw new Error('Unexpected Anthropic response shape: ' + JSON.stringify(parsed).slice(0, 200));
  }
  return content;
}

// ─── OpenAI-compatible (OpenAI, OpenRouter, local) ───────────────────────────

async function _callOpenAiCompat(url, apiKey, systemPrompt, userMessage, opts, maxTokens, env) {
  const model = (opts && opts.model)
    || env.LLM_MODEL
    || (url.includes('openai') ? 'gpt-4o' : env.LOCAL_LLM_DEFAULT_MODEL || '');

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    stream: false,
    messages: [
      { role: 'system',  content: systemPrompt },
      { role: 'user',    content: userMessage  },
    ],
  });

  const headers = {
    'content-type': 'application/json',
  };
  if (apiKey) headers['authorization'] = 'Bearer ' + apiKey;

  const resp = await _httpRequest(url, { method: 'POST', headers }, body);

  if (resp.status !== 200) {
    throw new Error('LLM API error ' + resp.status + ' (' + url + '): ' + resp.text.slice(0, 300));
  }

  let parsed;
  try { parsed = JSON.parse(resp.text); } catch (e) {
    throw new Error('LLM response parse error: ' + e.message);
  }

  const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('Unexpected LLM response shape: ' + JSON.stringify(parsed).slice(0, 200));
  }
  return content;
}

// ─── Raw HTTP request helper ──────────────────────────────────────────────────

function _httpRequest(url, options, body) {
  return new Promise(function(resolve, reject) {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   options.method || 'GET',
      headers:  options.headers || {},
    };

    if (body) {
      reqOptions.headers['content-length'] = Buffer.byteLength(body, 'utf8');
    }

    const req = lib.request(reqOptions, function(res) {
      const chunks = [];
      res.on('data', function(chunk) { chunks.push(chunk); });
      res.on('end',  function() {
        resolve({
          status:  res.statusCode,
          headers: res.headers,
          text:    Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, function() {
      req.destroy(new Error('Request timed out after 120s'));
    });

    if (body) req.write(body, 'utf8');
    req.end();
  });
}

module.exports = { callLlm };
