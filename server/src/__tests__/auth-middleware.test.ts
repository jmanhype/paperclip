import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindBoardApiKeyByToken = vi.hoisted(() => vi.fn());

vi.mock("../services/board-auth.js", () => ({
  boardAuthService: () => ({
    findBoardApiKeyByToken: mockFindBoardApiKeyByToken,
    resolveBoardAccess: vi.fn(),
    touchBoardApiKey: vi.fn(),
  }),
}));

function createSelectChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        then: (callback: (value: unknown[]) => unknown) => Promise.resolve(callback(rows)),
      })),
    })),
  };
}

function createDbStub() {
  const selectCalls = [
    [
      {
        id: "key-1",
        agentId: "11111111-1111-4111-8111-111111111111",
        companyId: "company-1",
      },
    ],
    [
      {
        id: "11111111-1111-4111-8111-111111111111",
        companyId: "company-1",
        status: "idle",
      },
    ],
  ];

  return {
    select: vi.fn(() => createSelectChain(selectCalls.shift() ?? [])),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };
}

describe("actorMiddleware", () => {
  const originalGlobalAccess = process.env.PAPERCLIP_AGENT_GLOBAL_ACCESS;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFindBoardApiKeyByToken.mockResolvedValue(null);
    process.env.PAPERCLIP_AGENT_GLOBAL_ACCESS = "true";
  });

  afterEach(() => {
    if (originalGlobalAccess === undefined) {
      delete process.env.PAPERCLIP_AGENT_GLOBAL_ACCESS;
    } else {
      process.env.PAPERCLIP_AGENT_GLOBAL_ACCESS = originalGlobalAccess;
    }
  });

  it("elevates agent API key actors when PAPERCLIP_AGENT_GLOBAL_ACCESS is enabled", async () => {
    const { actorMiddleware } = await import("../middleware/auth.js");
    const db = createDbStub();
    const middleware = actorMiddleware(db as any, { deploymentMode: "authenticated" as any });
    const req = {
      header(name: string) {
        if (name === "authorization") return "Bearer test-token";
        return undefined;
      },
    } as any;

    await new Promise<void>((resolve, reject) => {
      middleware(req, {} as any, (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    expect(req.actor).toMatchObject({
      type: "agent",
      agentId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      userId: "11111111-1111-4111-8111-111111111111",
      isInstanceAdmin: true,
      source: "agent_key",
    });
  });
});
