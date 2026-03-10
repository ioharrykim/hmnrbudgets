import { createPinSessionValue, verifyPinSessionValue } from "@/lib/pin-auth";

describe("pin auth session", () => {
  const originalSecret = process.env.SESSION_SIGNING_SECRET;

  beforeEach(() => {
    process.env.SESSION_SIGNING_SECRET = "test-session-secret";
  });

  afterAll(() => {
    process.env.SESSION_SIGNING_SECRET = originalSecret;
  });

  it("creates and verifies a signed pin session", () => {
    const value = createPinSessionValue("hmnr@example.com");
    const payload = verifyPinSessionValue(value);

    expect(payload).toMatchObject({
      email: "hmnr@example.com",
      authMode: "pin",
    });
  });

  it("rejects a tampered pin session", () => {
    const value = createPinSessionValue("hmnr@example.com");
    const [payload] = value.split(".");

    expect(verifyPinSessionValue(`${payload}.invalid-signature`)).toBeNull();
  });
});
