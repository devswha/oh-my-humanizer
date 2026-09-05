const count = (value) => Number.isSafeInteger(value) && value >= 0;

function usageRow(value) {
  if (!value || !['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'].every((key) => count(value[key]))) return null;
  const prompt = value.inputTokens + value.cacheReadInputTokens + value.cacheCreationInputTokens;
  if (!count(prompt)) return null;
  return { prompt_tokens: prompt, completion_tokens: value.outputTokens,
    cached_read_tokens: value.cacheReadInputTokens, cache_write_tokens: value.cacheCreationInputTokens };
}

function sumUsage(rows) {
  if (rows.some((row) => row === null)) return null;
  const result = { prompt_tokens: 0, completion_tokens: 0, cached_read_tokens: 0, cache_write_tokens: 0 };
  for (const row of rows) for (const key of Object.keys(result)) result[key] += row[key];
  return Object.values(result).every(count) ? result : null;
}

function fallbackPrimaryUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const input = count(value.input_tokens) ? value.input_tokens : null;
  const cached = count(value.cache_read_input_tokens) ? value.cache_read_input_tokens : null;
  const created = count(value.cache_creation_input_tokens) ? value.cache_creation_input_tokens : null;
  const total = input !== null && cached !== null && created !== null ? input + cached + created : null;
  return { prompt_tokens: count(total) ? total : null,
    completion_tokens: count(value.output_tokens) ? value.output_tokens : null,
    cached_read_tokens: cached, cache_write_tokens: created,
    reasoning_tokens: count(value.output_tokens_details?.thinking_tokens) ? value.output_tokens_details.thinking_tokens : null };
}

/** Attribute returned text to assistant messages, while retaining all CLI usage. */
export function decodeClaudeStudyStream(stdout) {
  const events = String(stdout).split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const results = events.filter((event) => event.type === 'result');
  if (results.length !== 1) throw new Error('Claude study stream requires one terminal result');
  const result = results[0];
  const terminalIndex = events.indexOf(result);
  const roots = events.slice(0, terminalIndex).filter((event) => event.type === 'assistant' && event.parent_tool_use_id == null);
  const models = [...new Set(roots.map((event) => event.message?.model))];
  const replies = roots.map((event) => (Array.isArray(event.message?.content) ? event.message.content : [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n'));
  const text = typeof result.result === 'string' ? result.result : '';
  const outputBound = Boolean(text.trim() && replies.at(-1)?.trim() === text.trim()
    && models.length && models.every((model) => typeof model === 'string' && model.length)
    && !events.slice(terminalIndex + 1).some((event) => event.type === 'assistant'));
  const modelUsage = result.modelUsage && typeof result.modelUsage === 'object' && !Array.isArray(result.modelUsage) ? result.modelUsage : {};
  const entries = Object.entries(modelUsage);
  const totals = entries.length ? sumUsage(entries.map(([, value]) => usageRow(value))) : null;
  const primary = entries.filter(([model]) => models.includes(model));
  const primaryUsage = outputBound && primary.length === models.length ? sumUsage(primary.map(([, value]) => usageRow(value))) : null;
  const auxiliary = entries.filter(([model]) => !models.includes(model));
  return {
    text, isError: result.is_error !== false, outputBound,
    effectiveModels: outputBound ? models : [], identityEvidence: 'assistant-message',
    usage: totals, primaryUsage, observedResultUsage: fallbackPrimaryUsage(result.usage),
    auxiliaryUsage: entries.length && outputBound ? sumUsage(auxiliary.map(([, value]) => usageRow(value))) : null,
    accountedModelCount: entries.length, auxiliaryModelCount: outputBound ? auxiliary.length : null,
    usageComplete: totals !== null && primaryUsage !== null, usageEvidence: 'cli-model-usage', attemptUnit: 'cli-invocation',
    // Private receipt only. Public rows receive bounded numeric aggregates.
    modelUsage,
  };
}
