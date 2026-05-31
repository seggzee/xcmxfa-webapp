// src/utils/passkeys.ts
//
// PURPOSE
// - Browser-only WebAuthn / passkeys helper for the web app.
// - Keeps navigator.credentials.* and PublicKeyCredential parsing out of UI components.
//
// LOCKED PHASE-1 TOPOLOGY
// - WebAuthn ceremonies are initiated from https://webapp.xcmxfa.com
// - Passkeys API lives on https://passkeys.xcmxfa.com
// - Main backend exchange endpoint lives on https://apps-backend.xcmxfa.com
//
// IMPORTANT
// - This file does NOT perform fetch calls.
// - This file does NOT own auth store mutations.
// - This file only handles browser capability detection + credential create/get.
//
// NOTES
// - JSON-safe options returned by backend are converted with:
//     PublicKeyCredential.parseCreationOptionsFromJSON(...)
//     PublicKeyCredential.parseRequestOptionsFromJSON(...)
// - Browser-returned credentials are serialized with credential.toJSON()
//   when available, else by manual extraction.

export type RegistrationOptionsJSON = Record<string, unknown>;
export type AuthenticationOptionsJSON = Record<string, unknown>;

export type SerializedCredential = {
  id: string;
  rawId?: string;
  type: "public-key";
  authenticatorAttachment?: string | null;
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
  response: Record<string, unknown>;
};

export type NormalizedPasskeySetupError = {
  message: string;
  treatAsReady: boolean;
};

function isPublicKeyCredentialSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

export function isPasskeySupported(): boolean {
  return isPublicKeyCredentialSupported() && !!navigator.credentials;
}

export function normalizePasskeySetupError(error: unknown): NormalizedPasskeySetupError {
  const name = String((error as any)?.name || "").trim();
  const raw = String((error as any)?.message || error || "PASSKEY_SETUP_FAILED");
  const lower = `${name} ${raw}`.toLowerCase();

  if (
    lower.includes("invalidstateerror") ||
    lower.includes("already set up") ||
    lower.includes("already exists") ||
    lower.includes("already ready") ||
    lower.includes("duplicate_credential")
  ) {
    return {
      message: "Passkey is already set up on this device.",
      treatAsReady: true,
    };
  }

  if (
    lower.includes("notallowederror") ||
    lower.includes("passkey_creation_cancelled") ||
    lower.includes("passkey_auth_cancelled") ||
    lower.includes("cancelled")
  ) {
    return {
      message: "Passkey setup was cancelled.",
      treatAsReady: false,
    };
  }

  if (
    lower.includes("passkeys_not_supported") ||
    lower.includes("not supported") ||
    lower.includes("passkey_creation_json_parser_unavailable") ||
    lower.includes("passkey_request_json_parser_unavailable")
  ) {
    return {
      message: "Passkeys are not supported on this device/browser.",
      treatAsReady: false,
    };
  }

  return {
    message: "Passkey setup failed. Please try again or use your password.",
    treatAsReady: false,
  };
}

export async function canUseConditionalMediation(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isConditionalMediationAvailable?: () => Promise<boolean>;
  };

  if (typeof pkc.isConditionalMediationAvailable !== "function") {
    return false;
  }

  try {
    return await pkc.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

export async function isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };

  if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }

  try {
    return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function createPasskeyFromOptions(
  optionsJson: RegistrationOptionsJSON,
): Promise<SerializedCredential> {
  if (!isPasskeySupported()) {
    throw new Error("PASSKEYS_NOT_SUPPORTED");
  }

  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    parseCreationOptionsFromJSON?: (json: unknown) => PublicKeyCredentialCreationOptions;
  };

  if (typeof pkc.parseCreationOptionsFromJSON !== "function") {
    throw new Error("PASSKEY_CREATION_JSON_PARSER_UNAVAILABLE");
  }

  const creationOptions = pkc.parseCreationOptionsFromJSON(optionsJson);

  const credential = (await navigator.credentials.create({
    publicKey: creationOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("PASSKEY_CREATION_CANCELLED");
  }

  return serializeCredential(credential);
}

export async function getPasskeyAssertionFromOptions(
  optionsJson: AuthenticationOptionsJSON,
  useConditionalMediation = false,
): Promise<SerializedCredential> {
  if (!isPasskeySupported()) {
    throw new Error("PASSKEYS_NOT_SUPPORTED");
  }

  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    parseRequestOptionsFromJSON?: (json: unknown) => PublicKeyCredentialRequestOptions;
  };

  if (typeof pkc.parseRequestOptionsFromJSON !== "function") {
    throw new Error("PASSKEY_REQUEST_JSON_PARSER_UNAVAILABLE");
  }

  const requestOptions = pkc.parseRequestOptionsFromJSON(optionsJson);

  const credential = (await navigator.credentials.get({
    publicKey: requestOptions,
    ...(useConditionalMediation ? { mediation: "conditional" as const } : {}),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("PASSKEY_AUTH_CANCELLED");
  }

  return serializeCredential(credential);
}

function serializeCredential(credential: PublicKeyCredential): SerializedCredential {
  const anyCredential = credential as PublicKeyCredential & {
    toJSON?: () => SerializedCredential;
    authenticatorAttachment?: string | null;
  };

  if (typeof anyCredential.toJSON === "function") {
    return anyCredential.toJSON();
  }

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: "public-key",
    authenticatorAttachment: anyCredential.authenticatorAttachment ?? null,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: serializeAuthenticatorResponse(credential.response),
  };
}

function serializeAuthenticatorResponse(response: AuthenticatorResponse): Record<string, unknown> {
  if (response instanceof AuthenticatorAttestationResponse) {
    const maybeTransports =
      typeof response.getTransports === "function" ? response.getTransports() : undefined;

    return {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      ...(maybeTransports ? { transports: maybeTransports } : {}),
      ...(response.getPublicKey
        ? {
            publicKey: response.getPublicKey()
              ? bufferToBase64Url(response.getPublicKey() as ArrayBuffer)
              : undefined,
          }
        : {}),
      ...(response.getPublicKeyAlgorithm
        ? {
            publicKeyAlgorithm: response.getPublicKeyAlgorithm(),
          }
        : {}),
    };
  }

  if (response instanceof AuthenticatorAssertionResponse) {
    return {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    };
  }

  throw new Error("UNSUPPORTED_AUTHENTICATOR_RESPONSE");
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}