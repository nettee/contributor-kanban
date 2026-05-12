import { describe, expect, it } from "vitest";
import { ConfigError, getServerConfig } from "./config";

const validEnv = {
  GITHUB_APP_ID: "12345",
  GITHUB_APP_INSTALLATION_ID: "67890",
  GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("test-private-key").toString("base64"),
  GITHUB_OWNER: "nexu-io",
  GITHUB_REPO: "open-design",
  GITHUB_ORG: "nexu-io",
};

describe("getServerConfig", () => {
  it("reads required GitHub configuration", () => {
    expect(getServerConfig({ ...validEnv, GITHUB_REQUEST_CONCURRENCY: "2" })).toEqual({
      githubAppId: "12345",
      githubAppInstallationId: "67890",
      githubAppPrivateKeyBase64: Buffer.from("test-private-key").toString("base64"),
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
    expect(() => getServerConfig({ ...validEnv, GITHUB_APP_ID: "" })).toThrow(ConfigError);
    expect(() => getServerConfig({ ...validEnv, GITHUB_APP_ID: "" })).toThrow(
      "Missing required environment variable: GITHUB_APP_ID",
    );
  });

  it("fails fast when concurrency is invalid", () => {
    expect(() => getServerConfig({ ...validEnv, GITHUB_REQUEST_CONCURRENCY: "0" })).toThrow(
      "GITHUB_REQUEST_CONCURRENCY must be a positive integer",
    );
  });

  it("fails fast when GitHub App IDs are invalid", () => {
    expect(() => getServerConfig({ ...validEnv, GITHUB_APP_ID: "abc" })).toThrow(
      "GITHUB_APP_ID must be a positive integer",
    );
    expect(() => getServerConfig({ ...validEnv, GITHUB_APP_INSTALLATION_ID: "0" })).toThrow(
      "GITHUB_APP_INSTALLATION_ID must be a positive integer",
    );
  });
});
