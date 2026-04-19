import { beforeEach, describe, expect, it, vi } from "vitest";

const hermesExecuteMock = vi.fn(async (ctx: unknown) => ({
  exitCode: 0,
  signal: null,
  timedOut: false,
  forwardedContext: ctx,
}));

vi.mock("hermes-paperclip-adapter/server", () => ({
  execute: hermesExecuteMock,
  testEnvironment: vi.fn(async () => ({
    adapterType: "hermes_local",
    status: "pass",
    checks: [],
    testedAt: new Date(0).toISOString(),
  })),
  sessionCodec: null,
  listSkills: vi.fn(async () => []),
  syncSkills: vi.fn(async () => ({ entries: [] })),
  detectModel: vi.fn(async () => null),
}));

vi.mock("hermes-paperclip-adapter", () => ({
  agentConfigurationDoc: "",
  models: [],
}));

describe("hermes_local adapter Paperclip auth wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    hermesExecuteMock.mockClear();
  });

  it("injects the Paperclip API key and safe default prompt for Hermes runs", async () => {
    const { findActiveServerAdapter } = await import("../adapters/index.js");
    const adapter = findActiveServerAdapter("hermes_local");
    expect(adapter).not.toBeNull();

    await adapter!.execute({
      runId: "run-123",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Hermes Worker",
        adapterConfig: {},
      },
      runtime: {},
      config: {},
      context: {
        taskId: "issue-1",
        taskTitle: "Fix it",
        taskBody: "Do the work",
      },
      authToken: "agent-token-123",
      onLog: async () => undefined,
    } as any);

    expect(hermesExecuteMock).toHaveBeenCalledTimes(1);
    const forwarded = hermesExecuteMock.mock.calls[0][0] as {
      agent: {
        adapterConfig?: { env?: Record<string, string>; promptTemplate?: string };
      };
    };

    expect(forwarded.agent.adapterConfig?.env?.PAPERCLIP_API_KEY).toBe("agent-token-123");
    expect(forwarded.agent.adapterConfig?.promptTemplate).toContain("Authorization: Bearer $PAPERCLIP_API_KEY");
    expect(forwarded.agent.adapterConfig?.promptTemplate).toContain("X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID");
    expect(forwarded.agent.adapterConfig?.promptTemplate).toContain("Never call");
  });

  it("preserves explicit Hermes prompt and Paperclip API key overrides", async () => {
    const { findActiveServerAdapter } = await import("../adapters/index.js");
    const adapter = findActiveServerAdapter("hermes_local");
    expect(adapter).not.toBeNull();

    await adapter!.execute({
      runId: "run-456",
      agent: {
        id: "agent-2",
        companyId: "company-1",
        name: "Hermes Worker",
        adapterConfig: {
          promptTemplate: "custom prompt",
          env: {
            PAPERCLIP_API_KEY: "preconfigured-token",
          },
        },
      },
      runtime: {},
      config: {},
      context: {},
      authToken: "agent-token-456",
      onLog: async () => undefined,
    } as any);

    expect(hermesExecuteMock).toHaveBeenCalledTimes(1);
    const forwarded = hermesExecuteMock.mock.calls[0][0] as {
      agent: {
        adapterConfig?: { env?: Record<string, string>; promptTemplate?: string };
      };
    };

    expect(forwarded.agent.adapterConfig?.env?.PAPERCLIP_API_KEY).toBe("preconfigured-token");
    expect(forwarded.agent.adapterConfig?.promptTemplate).toBe("custom prompt");
  });
});
