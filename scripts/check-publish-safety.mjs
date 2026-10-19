import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';

// Scan the staged index, not ignored/private working files. Never print matches.
const gitArgs=['-c','safe.directory='+process.cwd()];
const files=execFileSync('git',[...gitArgs,'diff','--cached','--name-only','--diff-filter=ACMR','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:\.env(?:\..*)?$|\.playwright-mcp\/|\.codex-remote-attachments\/|scripts\/private\/|(?:MANIFEST|LAPORAN|KODE-LENGKAP)[^/]*\.(?:json|md)$)|\.(?:zip|dump|backup|bak)$/i;
const signatures=[
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{10,})\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*[A-Za-z0-9+/=]{30,}/,
  /VAPID_PRIVATE_KEY\s*[:=]\s*['"][A-Za-z0-9_-]{30,}['"]/,
];
const findings=[];let bytes=0;
for(const file of files){
  if(file!=='.env.example'&&forbidden.test(file))findings.push({file,reason:'private/artifact path'});
  const data=execFileSync('git',[...gitArgs,'show',':'+file],{maxBuffer:100*1024*1024});
  bytes+=data.length;
  if(data.length>95*1024*1024)findings.push({file,reason:'oversized GitHub file'});
  if(!data.includes(0)&&signatures.some(pattern=>pattern.test(data.toString('utf8'))))findings.push({file,reason:'possible credential; value withheld'});
}
// Environment example must contain placeholders, not a live project key.
if(files.includes('.env.example')){
  const example=await readFile('.env.example','utf8');
  if(!example.includes('YOUR_SUPABASE_PUBLISHABLE_KEY'))findings.push({file:'.env.example',reason:'missing key placeholder'});
}
// This is a focused scanner, not a guarantee that every possible secret is detectable.
console.log(JSON.stringify({staged_files:files.length,staged_bytes:bytes,findings},null,2));
if(!files.length||findings.length)process.exitCode=1;
// Ensure private records are still local; no deletion occurs during publication.
await stat('.gitignore');
