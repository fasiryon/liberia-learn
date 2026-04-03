import {
  getDemoCredential,
  getDemoCredentials,
  type DemoCredentialKey,
} from "@/lib/demoCredentials";

export type DemoHintGroup = {
  key: DemoCredentialKey;
  label: string;
  email: string;
  passwordHint: string;
  role: string;
};

export function getDemoHintGroups(): DemoHintGroup[] {
  return getDemoCredentials().map((credential) => ({
    key: credential.key,
    label: credential.label,
    email: credential.email,
    role: credential.role,
    passwordHint: `Password: ${credential.password}`,
  }));
}

export function getDemoHintGroup(key: DemoCredentialKey): DemoHintGroup {
  const credential = getDemoCredential(key);
  return {
    key: credential.key,
    label: credential.label,
    email: credential.email,
    role: credential.role,
    passwordHint: `Password: ${credential.password}`,
  };
}
