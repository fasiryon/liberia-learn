const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const base='26026ca699df254aaf120e9ad23adf1d897d7346',port=git(['rev-parse','217405a0']),head=git(['rev-parse','5daefe7c']);
const changed=ref=>git(['diff','--name-only',base,ref,'--','app','lib','components']).split(/\r?\n/).filter(Boolean);
const security=changed(port),t1=changed(head),overlap=security.filter(f=>t1.includes(f));assert.deepEqual(overlap,[]);
const tree=git(['merge-tree','--write-tree','--name-only',port,head]).split(/\r?\n/)[0];assert(/^[a-f0-9]{40}$/.test(tree));
assert(security.every(file=>git(['rev-parse',`${tree}:${file}`])===git(['rev-parse',`${port}:${file}`])));
const normalize=text=>{
  const source=ts.createSourceFile('route.ts',text,ts.ScriptTarget.Latest,true);
  const transformed=ts.transform(source,[context=>root=>{
    const visit=node=>{
      if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='@/lib/preview/identityFreeze')return undefined;
      if(ts.isVariableStatement(node)&&node.declarationList.declarations.every(d=>d.initializer&&ts.isCallExpression(d.initializer)&&d.initializer.expression.getText(source)==='previewIdentityFrozen'))return undefined;
      if(ts.isIfStatement(node)&&node.expression.getText(source)==='frozen'&&ts.isReturnStatement(node.thenStatement))return undefined;
      const next=ts.visitEachChild(node,visit,context);
      if(ts.isIfStatement(next)&&ts.isBlock(next.thenStatement)&&next.thenStatement.statements.length===0)return undefined;
      return next;
    };return ts.visitNode(root,visit);
  }]);
  const result=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed}).printFile(transformed.transformed[0]);transformed.dispose();return result;
};
const routes=t1.filter(file=>file.startsWith('app/api/')&&git(['show',`${head}:${file}`]).includes('@/lib/preview/identityFreeze'));
const production=routes.map(file=>({file,unchangedWithoutNoopGuard:normalize(git(['show',`${base}:${file}`]))===normalize(git(['show',`${head}:${file}`]))}));
assert(production.every(p=>p.unchangedWithoutNoopGuard));
const result={status:'PASS',applicationBase:base,securityPort:port,reviewedHead:head,uncommittedReviewTree:tree,branchUpdated:false,securityFilesPreserved:security.length,overlap,identityRouteProductionEquivalence:production};
fs.writeFileSync(path.join(__dirname,'integration-source-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,securityFilesPreserved:security.length,identityRoutesEquivalent:routes.length,branchUpdated:false}));
