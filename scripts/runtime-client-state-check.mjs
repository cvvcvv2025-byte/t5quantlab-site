// Executes the actual portable lease gate from the MQL include with C++ clock
// and account shims. This does not claim MetaEditor compilation or broker testing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('src/clients/T5_Runtime_License.mqh', 'utf8');
const start = source.indexOf('bool T5LicenseAllowsNewEntry()');
const begin = source.indexOf('{', start); let depth = 1, end = begin + 1;
while (depth && end < source.length) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
if (start < 0 || depth) throw Error('Lease gate not found');
const code = `#include <cstdint>
#include <string>
#include <cassert>
using uint=uint32_t;using datetime=int64_t;
uint t5LeaseTick=0,t5LeaseSeconds=0;datetime t5LeaseLocal=0;
std::string t5LeaseLogin,t5LeaseServer,login="123",server="Demo",state;
bool tester=false;uint tick=0;datetime wall=100000;
bool T5IsTester(){return tester;}uint GetTickCount(){return tick;}
datetime TimeLocal(){return wall;}std::string T5AccountLogin(){return login;}
std::string T5AccountServer(){return server;}
void T5LicenseDeny(std::string s){t5LeaseSeconds=0;state=s;}
${source.slice(start,end)}
void reset(){tester=false;login="123";server="Demo";tick=2000;wall=100000;
t5LeaseTick=tick;t5LeaseLocal=wall;t5LeaseSeconds=3600;t5LeaseLogin=login;t5LeaseServer=server;}
int main(){
reset();assert(T5LicenseAllowsNewEntry());
tick+=3599999;wall+=3599;assert(T5LicenseAllowsNewEntry());
tick++;assert(!T5LicenseAllowsNewEntry());
reset();wall+=3600;assert(!T5LicenseAllowsNewEntry());
reset();wall-=6;assert(!T5LicenseAllowsNewEntry());
reset();login="456";assert(!T5LicenseAllowsNewEntry());
reset();server="Live";assert(!T5LicenseAllowsNewEntry());
reset();t5LeaseTick=0xfffffff0;tick=0x10;assert(T5LicenseAllowsNewEntry());
reset();t5LeaseSeconds=0;assert(!T5LicenseAllowsNewEntry());
tester=true;assert(T5LicenseAllowsNewEntry());
reset();tick+=86400001;assert(!T5LicenseAllowsNewEntry());
}
`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't5-client-state-'));
try {
  const file = path.join(dir, 'gate.cpp'), bin = path.join(dir, 'gate'); fs.writeFileSync(file, code);
  for (const [command,args] of [['g++',['-std=c++17','-Wall','-Werror',file,'-o',bin]],[bin,[]]]) {
    const r=spawnSync(command,args,{encoding:'utf8'}); if(r.status!==0)throw Error(r.stderr || 'Lease gate test failed');
  }
  console.log('Actual portable MQL lease gate passed expiry, clock rollback, account/server change, timer rollover, initial denial and tester-only mode. Native compilation still required.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
