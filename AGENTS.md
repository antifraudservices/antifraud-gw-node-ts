# Regional Qualification Gateway agent contract

Read `.codex/skills/build-regional-qualification-gateway/SKILL.md` and
`docs/ARCHITECTURE.md` before implementation.

Use red-green-refactor test-driven development. Start each test file with the
flow-contract comment required by the workspace release discipline. Prove the
smallest manager contract first, then route integration, SDK live behavior and
the real local portal-to-gateway journey. Mocks do not prove a channel write.

Keep the gateway public and product-neutral. The trusted manager derives the
regional ledger channel; callers never provide channel or smart-contract
names. Claims-first encrypted persistence, tenant isolation, key custody and
ledger evidence must remain separate concerns.

Do not copy a superseded product gateway. Audit the current shared gateway only
as a possible neutral source, and record every adopted, equivalent,
profile-specific or rejected capability before porting code.

Do not claim a channel, operator or deployment is active without a real write,
transaction identifier and authoritative readback from that exact environment.
