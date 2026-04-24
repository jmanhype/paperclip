import { describe, expect, it } from "vitest";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin } from "../routes/authz.js";

describe("authz elevated agent access", () => {
  const elevatedAgentReq = {
    actor: {
      type: "agent",
      agentId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      source: "agent_key",
      isInstanceAdmin: true,
    },
  } as any;

  it("allows elevated agents through board-only guards", () => {
    expect(() => assertBoard(elevatedAgentReq)).not.toThrow();
    expect(() => assertInstanceAdmin(elevatedAgentReq)).not.toThrow();
  });

  it("allows elevated agents to access companies outside their home company", () => {
    expect(() => assertCompanyAccess(elevatedAgentReq, "company-2")).not.toThrow();
  });

  it("still rejects non-elevated agents outside their home company", () => {
    const req = {
      actor: {
        type: "agent",
        agentId: "11111111-1111-4111-8111-111111111111",
        companyId: "company-1",
        source: "agent_key",
        isInstanceAdmin: false,
      },
    } as any;

    expect(() => assertCompanyAccess(req, "company-2")).toThrow(/another company/i);
  });
});
