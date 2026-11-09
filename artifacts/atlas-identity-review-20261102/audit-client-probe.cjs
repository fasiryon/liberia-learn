// Real installed Prisma + unchanged T1 singleton. All database attempts are READ ONLY on localhost.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createJiti}=require('jiti');
const root='C:/liberia-learn/.task-worktrees/t1-preview-app';
const load=createJiti(__filename,{alias:{'@':root},fsCache:false});
const url='postgresql://preview_app@127.0.0.1:55432/postgres?sslmode=disable';
async function main(){
  assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal(new URL(url).port,'55432');
  Object.assign(process.env,{DATABASE_URL:url,DIRECT_URL:url,VERCEL_ENV:'',VERCEL:'',NODE_ENV:'production',ENABLE_AUDIT_IMMUTABILITY:'true',ENABLE_RDS_DUAL_WRITE:'false'});
  const originalOut=process.stdout.write,originalErr=process.stderr.write;
  const discard=(...args)=>{const cb=args.at(-1);if(typeof cb==='function')cb();return true;};
  process.stdout.write=discard;process.stderr.write=discard;
  let result;
  const {prisma}=await load.import(root+'/lib/db.ts');
  try{
    const version=require('@prisma/client/package.json').version;
    assert.equal(typeof prisma.$use,'undefined');
    let rootBlocked=false;
    try{await prisma.auditLog.update({where:{id:'review-never-existing-row'},data:{action:'review-probe'}});}catch(error){rootBlocked=error.message==='AuditLog mutations are forbidden';}
    assert(rootBlocked);
    const attempts=[];
    async function probe(kind,fn){
      try{await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await fn(tx);});throw Error('unexpected_query_success');}
      catch(error){assert.notEqual(error.message,'AuditLog mutations are forbidden');assert(/25006|read.only transaction/i.test(error.message));attempts.push({kind,applicationGuardBlocked:false,readOnlyDatabaseRefused:true,driverCode:error.code??null});}
    }
    await probe('interactive-transaction-update',tx=>tx.auditLog.update({where:{id:'review-never-existing-row'},data:{action:'review-probe'}}));
    await probe('interactive-transaction-delete',tx=>tx.auditLog.deleteMany({where:{id:'review-never-existing-row'}}));
    await probe('interactive-transaction-upsert',tx=>tx.auditLog.upsert({where:{id:'review-never-existing-row'},create:{id:'review-never-existing-row',action:'review-probe'},update:{action:'review-probe'}}));
    await probe('raw-sql',tx=>tx.$executeRaw`UPDATE "AuditLog" SET action='review-probe' WHERE id='review-never-existing-row'`);
    let separateDelegate=false,transactionWrapperPresent=false;
    await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');separateDelegate=tx.auditLog!==prisma.auditLog;transactionWrapperPresent=Boolean(tx.auditLog.__immutabilityWrapped);});
    assert(separateDelegate);assert.equal(transactionWrapperPresent,false);
    result={status:'PASS',meaning:'GAPS_REPRODUCED',prismaVersion:version,useMiddlewarePresent:false,rootDirectUpdateBlocked:true,separateTransactionDelegate:true,transactionWrapperPresent:false,attempts,localOnly:true,noRowsModified:true,hostedGuards:'UNKNOWN_NOT_CONNECTED'};
  }finally{await prisma.$disconnect();process.stdout.write=originalOut;process.stderr.write=originalErr;}
  fs.writeFileSync(path.join(__dirname,'audit-client-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(()=>{process.exitCode=1;});
