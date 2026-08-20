export const REVIEW_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export const REVIEW_SERIALIZABLE_TRANSACTION_OPTIONS = {
  ...REVIEW_TRANSACTION_OPTIONS,
  isolationLevel: "Serializable" as const,
};
