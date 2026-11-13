import {readFileSync} from 'node:fs';
const {SCHOOL_DAY_EMAILS,SCHOOL_DAY_IDS}=JSON.parse(readFileSync(new URL('../e2e/school-day-identities.json',import.meta.url),'utf8'));

/** Only these school-scoped logins may leave the private bootstrap process. */
export const PREVIEW_REVIEWER_KEYS=Object.freeze(['student','teacher','admin']);
export const PREVIEW_CREDENTIAL_SCOPE='school-reviewers-only/1';

export function assertReviewerAccounts(accounts){
  if(accounts.length!==3)throw Error('preview_reviewer_scope_failed');
  for(const [id,role] of [[SCHOOL_DAY_IDS.studentUser,'STUDENT'],[SCHOOL_DAY_IDS.teacher,'TEACHER'],[SCHOOL_DAY_IDS.admin,'ADMIN']]){
    const account=accounts.find(row=>row.id===id);
    if(!account||account.role!==role||account.schoolId!==SCHOOL_DAY_IDS.school||account.isPlatformAdmin!==false||!account.hashedPwd)throw Error('preview_reviewer_scope_failed');
  }
}

/** The caller supplies CONOUT$ only. No logger, return value or fixture-only credential output. */
export function writeReviewerCredentials(operatorWrite,passwords){
  for(const key of PREVIEW_REVIEWER_KEYS)operatorWrite(`${SCHOOL_DAY_EMAILS[key]}  ${passwords[key]}\r\n`);
}
