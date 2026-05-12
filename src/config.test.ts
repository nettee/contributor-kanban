import { describe, expect, it } from "vitest";
import { ConfigError, getServerConfig } from "./config";

const validEnv = {
  GITHUB_TOKEN: "token",
  GITHUB_OWNER: "nexu-io",
  GITHUB_REPO: "open-design",
  GITHUB_ORG: "nexu-io",
};

describe("getServerConfig", () => {
  it("reads required GitHub configuration", () => {
    expect(getServerConfig({ ...validEnv, GITHUB_REQUEST_CONCURRENCY: "2" })).toEqual({
      githubToken: "token",
      githubOwner: "nexu-io",
      githubRepo: "open-design",
      githubOrg: "nexu-io",
      githubRequestConcurrency: 2,
    });
  });

  it("defaults request concurrency to one", () => {
    expect(getServerConfig(validEnv).githubRequestConcurrency).toBe(1);
  });

  it("fails fast when a required environment variable is missing", () => {
    expect(() => getServerConfig({ ...validEnv, GITHUB_TOKEN: "" })).toThrow(ConfigError);
    expect(() => getServerConfig({ ...validEnv, GITHUB_TOKEN: "" })).toThrow(
      "Missing required environment variable: GITHUB_TOKEN",
    );
  });

  it("fails fast when concurrency is invalid", () => {
    expect(() => getServerConfig({ ...validEnv, GITHUB_REQUEST_CONCURRENCY: "0" })).toThrow(
      "GITHUB_REQUEST_CONCURRENCY must be a positive integer",
    );
  });
});
