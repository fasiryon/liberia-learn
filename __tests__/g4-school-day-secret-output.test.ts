import {describe,it,expect} from 'vitest';
import {redactSyntheticSecrets} from '@/scripts/e2e/secret-output';
describe('synthetic credential output must be sanitized before workflow artifact capture',()=>{
  it('removes all known secret occurrences from commands, JSON and failure text',()=>{
    const secrets=['unit-fixture-password-alpha','unit-fixture-password-beta'];
    const raw=`::add-mask::${secrets[0]}\n${JSON.stringify({password:secrets[1]})}\nfill("${secrets[0]}")`;
    const sanitized=redactSyntheticSecrets(raw,secrets);
    for(const secret of secrets)expect(sanitized.includes(secret)).toBe(false);
    expect(sanitized.match(/\[REDACTED\]/g)).toHaveLength(3);
  });
  it('preserves non-sensitive failure evidence and ignores empty secret strings',()=>{
    expect(redactSyntheticSecrets('CredentialsSignin status=401',[''])).toBe('CredentialsSignin status=401');
  });
});
