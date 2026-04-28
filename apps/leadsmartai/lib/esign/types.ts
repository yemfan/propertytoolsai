/**
 * Provider-agnostic e-signature types.
 *
 * The CRM tracks envelopes from any of Dotloop / DocuSign /
 * HelloSign behind a unified shape. Provider-specific webhook
 * payloads land in `signature_events.payload` for forensics.
 */

export type ESignProvider = "dotloop" | "docusign" | "hellosign";

export type EnvelopeStatus =
  | "sent"
  | "viewed"
  | "signed"
  | "completed"
  | "declined"
  | "voided"
  | "expired";

export type SignatureEventType =
  | "sent"
  | "viewed"
  | "signed"
  | "completed"
  | "declined"
  | "voided"
  | "expired"
  | "reminded";

export type Signer = {
  /** 0-based position. The "buyer" is typically signer 0, "seller" signer 1, etc. */
  index: number;
  name: string;
  email: string;
  /** True once this signer has applied their signature. Envelope is
   *  `completed` only when ALL signers are signed. */
  signed: boolean;
  signedAt: string | null;
};

export type SignatureEnvelope = {
  id: string;
  agentId: string;
  contactId: string | null;
  transactionId: string | null;
  provider: ESignProvider;
  providerId: string;
  status: EnvelopeStatus;
  subject: string;
  signers: Signer[];
  metadata: Record<string, unknown>;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
