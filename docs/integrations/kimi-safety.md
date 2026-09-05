# Kimi text-backend isolation

Kimi Code prompt mode can auto-approve tools without `--yolo` or `--auto`.
Patina therefore supplies an explicit main-agent profile with `tools: []` and
`subagents: []`, plus an empty skills directory, for every text request.
The child enables the supported v2 profile path; global settings are unchanged.

The profile's prompt treats source prose as reference data. It does not inherit
workspace instructions, plugins or a coding agent's general tool permissions.
Clients without the required agent-file support fail with an upgrade message
instead of falling back to an unrestricted legacy print mode.

Requires Kimi Code 0.29 or newer. A live check against 0.29.1 selected the K3
coding profile, requested a harmless test-file write in an isolated directory,
and confirmed a zero-tool request trace with no file created. The raw session
archive stays private; it contains no customer text.

This changes tool access, not Patina's pattern or meaning-preservation rules.
Modern Kimi Code receives the text through its `--prompt` argument; local process
listing visibility remains a limitation of that CLI interface.

Reference: https://moonshotai.github.io/kimi-code/en/customization/agents
