// Reuse Content Factory's existing no-disk-cache Jiti loader pattern on Windows.
const path=require('node:path');
const {createJiti}=require('jiti');
const load=createJiti(__filename,{alias:{'@':path.resolve(__dirname,'../..')},fsCache:false});
load.import('./seed-school-day.ts').then(module=>module.runSchoolDaySeed()).catch(()=>{
  console.error('school_day_seed_failed');process.exitCode=1;
});
