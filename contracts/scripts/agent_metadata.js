const PLACEHOLDER_PATTERN = /\{([A-Z0-9_]+)\}/g;

function applyPlaceholders(value, placeholders) {
  if (typeof value === "string") {
    return value.replace(PLACEHOLDER_PATTERN, (match, key) => placeholders[key] ?? match);
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyPlaceholders(item, placeholders));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, applyPlaceholders(item, placeholders)])
    );
  }

  return value;
}

function findUnresolvedPlaceholders(value) {
  const unresolved = new Set();

  function visit(item) {
    if (typeof item === "string") {
      let match;
      while ((match = PLACEHOLDER_PATTERN.exec(item)) !== null) {
        unresolved.add(match[0]);
      }
      PLACEHOLDER_PATTERN.lastIndex = 0;
      return;
    }

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (item && typeof item === "object") {
      Object.values(item).forEach(visit);
    }
  }

  visit(value);
  return Array.from(unresolved).sort();
}

function assertNoUnresolvedPlaceholders(value) {
  const unresolved = findUnresolvedPlaceholders(value);
  if (unresolved.length > 0) {
    throw new Error(`Unresolved placeholders: ${unresolved.join(", ")}`);
  }
}

function buildAgentUri(cid) {
  const trimmed = cid.trim();
  if (!trimmed) {
    throw new Error("Pinata returned an empty CID");
  }
  return `ipfs://${trimmed}`;
}

function getPlaceholderValues(env) {
  return {
    AGENT_ID: env.AGENT_ID ?? "0",
    AGENT_CONTROLLER_ADDRESS: env.AGENT_CONTROLLER_ADDRESS,
    IDENTITY_REGISTRY_ADDRESS: env.IDENTITY_REGISTRY_ADDRESS,
    VAULT_MANAGER_ADDRESS: env.VAULT_MANAGER_ADDRESS,
    RISK_ENGINE_ADDRESS: env.RISK_ENGINE_ADDRESS,
  };
}

module.exports = {
  applyPlaceholders,
  assertNoUnresolvedPlaceholders,
  buildAgentUri,
  findUnresolvedPlaceholders,
  getPlaceholderValues,
};
