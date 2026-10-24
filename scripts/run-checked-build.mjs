import {spawnSync} from 'node:child_process';

function run(cmd){
 const res=spawnSync(process.execPath,[cmd],{env:process.env,stdio:'inherit'});
 if(res.error)throw res.error;
 if(res.status!==0)process.exit(res.status||1);
}
run('scripts/validate-privy-web.mjs');
if(process.env.VITE_WALLET_CONNECT_LAB_ENABLED==='true'&&
   process.env.VITE_WALLET_CONNECT_QA_INJECTED==='true'){
 run('scripts/build-walletconnect-qa.mjs');
}else{
 const res=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{
   env:process.env,stdio:'inherit'});
 if(res.error)throw res.error;
 if(res.status!==0)process.exit(res.status||1);
}
