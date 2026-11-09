/** Sanitize before stdout reaches a workflow tee or artifact capture. */
export function redactSyntheticSecrets(text:string,secrets:readonly string[]):string {
  return [...secrets].sort((a,b)=>b.length-a.length).reduce((output,secret)=>secret?output.replaceAll(secret,'[REDACTED]'):output,text);
}
