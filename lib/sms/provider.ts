export type SMSProviderSendParams = {
  to: string;
  body: string;
  idempotencyKey?: string;
};

export type SMSProviderSendResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  retryable?: boolean;
};

export type SMSProviderNormalizedError = {
  message: string;
  retryable: boolean;
  code?: string;
};

export interface SMSProvider {
  name: string;
  send(input: SMSProviderSendParams): Promise<SMSProviderSendResult>;
  lookupStatus?(providerMessageId: string): Promise<{ status: string } | null>;
  normalizeError(error: unknown): SMSProviderNormalizedError;
}

