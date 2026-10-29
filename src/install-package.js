// Store-only ZIP writer: the original, hash-verified release ZIP stays intact.
// No executable download, shell command, or customer credential is embedded in
// public site assets. Credentials are supplied only to a private response.
const utf8=s=>new TextEncoder().encode(s);
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function installZip(entries){
 let offset=0;const local=[],central=[];const w=(a,n,v,size)=>new DataView(a.buffer).setUint32(n,v,true);
 for(const [name,value]of Object.entries(entries)){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..'))throw Error('INVALID_INSTALL_PATH');
  const n=utf8(name),b=typeof value==='string'?utf8(value):new Uint8Array(value),crc=crc32(b),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
  w(h,0,0x04034b50);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);w(h,14,crc);w(h,18,b.length);w(h,22,b.length);v.setUint16(26,n.length,true);h.set(n,30);
  const c=new Uint8Array(46+n.length),d=new DataView(c.buffer);w(c,0,0x02014b50);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);w(c,16,crc);w(c,20,b.length);w(c,24,b.length);d.setUint16(28,n.length,true);w(c,42,offset);c.set(n,46);local.push(h,b);central.push(c);offset+=h.length+b.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);w(end,0,0x06054b50);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);w(end,12,central.reduce((n,x)=>n+x.length,0));w(end,16,offset);
 return new Blob([...local,...central,end],{type:'application/zip'});
}
export const windowsInstaller=String.raw`# T5 bound installation. Runs as current user; never enables trading or DLLs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = $PSScriptRoot
$meta = Get-Content -LiteralPath (Join-Path $root 'install.json') -Raw -Encoding UTF8 | ConvertFrom-Json
try {
 $archive = Join-Path $root 'product.zip'
 if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne $meta.archive_sha256) { throw 'Package check failed. Please download again.' }
 $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
 $dialog.Description = 'In MT choose File > Open Data Folder. Select that SAME data folder here.'
 $dialog.ShowNewFolderButton = $false
 $homePath = Join-Path $env:APPDATA 'MetaQuotes\Terminal'
 if (Test-Path -LiteralPath $homePath) { $dialog.SelectedPath = $homePath }
 if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit }
 $target = $dialog.SelectedPath
 $mql = $meta.mql
 if (!(Test-Path -LiteralPath (Join-Path $target $mql) -PathType Container)) { throw ('Wrong data folder: ' + $mql + ' was not found. Nothing installed.') }
 $temp = Join-Path ([IO.Path]::GetTempPath()) ('T5Install-' + [guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($temp) | Out-Null
 [IO.Compression.ZipFile]::ExtractToDirectory($archive, $temp)
 # Only release executables in the selected platform's known directories.
 foreach ($category in @('Indicators','Experts')) {
  $from = Join-Path $temp ($mql + '\' + $category)
  if (Test-Path -LiteralPath $from) {
   $dest = Join-Path $target ($mql + '\' + $category)
   [IO.Directory]::CreateDirectory($dest) | Out-Null
   Get-ChildItem -LiteralPath $from -File | Where-Object { $_.Extension -eq $meta.extension } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dest $_.Name) -Force
   }
  }
 }
 $files = Join-Path $target ($mql + '\Files')
 [IO.Directory]::CreateDirectory($files) | Out-Null
 Copy-Item -LiteralPath (Join-Path $root $meta.credential_path) -Destination (Join-Path $files $meta.credential_name) -Force
 $templates = Join-Path $target $meta.templates
 [IO.Directory]::CreateDirectory($templates) | Out-Null
 if (Test-Path -LiteralPath (Join-Path $root 'T5_Start.tpl')) {
  Copy-Item -LiteralPath (Join-Path $root 'T5_Start.tpl') -Destination (Join-Path $templates $meta.template_name) -Force
 }
 $presets = Join-Path $target $meta.presets
 [IO.Directory]::CreateDirectory($presets) | Out-Null
 if (Test-Path -LiteralPath (Join-Path $root 'T5_Bound.set')) { Copy-Item -LiteralPath (Join-Path $root 'T5_Bound.set') -Destination (Join-Path $presets ($meta.product + '.set')) -Force }
  $message = 'Files installed. In MT refresh Navigator. Allow WebRequest to https://t5quantlab.com once. No key input required.'
 if ($meta.kind -eq 'indicator') { $message += (' Open a NEW chart and load template ' + $meta.template_name + '. Do not apply to an existing EA chart.') } else { $message += ' Load the EA itself, leave the license key blank. Review all trading parameters yourself. Auto trading has NOT been enabled.' }
 [System.Windows.Forms.MessageBox]::Show($message,'T5 installation') | Out-Null
} catch {
 [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'T5 installation failed') | Out-Null
} finally {
 if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
`;
export const startWindows='@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-T5.ps1"\r\n';
export function releaseNames(buffer){
 const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength);let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('RELEASE_ZIP_INVALID');let at=v.getUint32(end+16,true);const count=v.getUint16(end+10,true),names=[];
 for(let i=0;i<count;i++){if(at+46>b.length||v.getUint32(at,true)!==0x02014b50)throw Error('RELEASE_ZIP_INVALID');const n=v.getUint16(at+28,true);names.push(new TextDecoder().decode(b.slice(at+46,at+46+n)));at+=46+n+v.getUint16(at+30,true)+v.getUint16(at+32,true);}
 return names;
}
export function productTemplate(product,platform,indicator){
 const five=platform==='MT5',helper='T5_License_Bridge_'+platform;
 const expert=five?`name=${helper}\npath=Experts\\${helper}.ex5\nexpertmode=1`:`name=${helper}\nflags=339\nwindow_num=0`;
 const custom=five?`name=Custom Indicator\npath=Indicators\\${indicator}.ex5\nexpertmode=0\n<inputs>\n</inputs>`:`name=Custom Indicator\n<expert>\nname=${indicator}\nflags=339\nwindow_num=0\n<inputs>\n</inputs>\n</expert>\nshift_0=0\ndraw_0=12\ncolor_0=4294967295\nstyle_0=0\nweight_0=0\nperiod_flags=0\nshow_data=1`;
 const text=`<chart>\ngraph=1\n<expert>\n${expert}\n<inputs>\nInpProductCode=${product}\nInpT5LicenseKey=\n</inputs>\n</expert>\n<window>\nheight=100\n<indicator>\nname=${five?'Main':'main'}\n</indicator>\n<indicator>\n${custom}\n</indicator>\n</window>\n</chart>\n`;
 // MT5 native saved templates are UTF-16LE, including the BOM.
 if(!five)return text;const bytes=new Uint8Array(2+text.length*2),v=new DataView(bytes.buffer);v.setUint16(0,0xfeff,true);for(let i=0;i<text.length;i++)v.setUint16(2+i*2,text.charCodeAt(i),true);return bytes;
}
export async function boundInstallPackage(archive,profile,b,artifact,kind){
 const five=b.platform==='MT5',mql=five?'MQL5':'MQL4',ext=five?'.ex5':'.ex4';
 const credential='T5Owner3_'+b.product_code+'_'+b.platform+'.credential';
 const shortNames={structure_decision_map_mt4:'Structure_Map',mtf_structure_panel_mt4:'Multi_Timeframe',neckline_mtf_mt4:'Neckline',progress_candle_mt4:'Progress_Candle'};
 const template='T5_'+(shortNames[b.product_code]||b.product_code)+'_'+b.platform+'.tpl';
 const names=releaseNames(archive),indicator=names.find(n=>n.startsWith(mql+'/Indicators/')&&n.endsWith(ext));
 if(kind==='indicator'&&!indicator)throw Error('INSTALL_RELEASE_PLATFORM_INVALID');
 const files={
  'product.zip':new Uint8Array(archive),
  [mql+'/Files/'+credential]:profile,
  'Install-T5.ps1':new Uint8Array([239,187,191,...utf8(windowsInstaller)]),
  'Install-Windows.cmd':startWindows,
  'T5_Bound.set':'InpProductCode='+b.product_code+'\nInpT5LicenseKey=\n',
  'install.json':JSON.stringify({version:1,kind,product:b.product_code,platform:b.platform,mql,extension:ext,archive_sha256:artifact.sha256,credential_path:mql+'/Files/'+credential,credential_name:credential,presets:five?'MQL5/Profiles/Presets':'MQL4/Presets',templates:five?'MQL5/Profiles/Templates':'templates',template_name:template},null,2),
  'READ-ME-FIRST.txt':'T5 专属免输密钥安装包\r\n1. 完整解压当前 ZIP，不要只打开 ZIP 内的脚本。Windows 双击 Install-Windows.cmd，按提示选择 MT 中“文件 > 打开数据文件夹”对应目录。安装器以当前用户权限复制文件，不修改自动交易、DLL 或联网白名单。\r\n2. 指标：在 MT 新开一个空白图表，右键 > 模板 > '+template+'；不要应用到已有 EA 图表。模板自动加载本产品指标与授权服务，无须填写产品码或密钥。保留此图表；同产品其他周期图表也可加载指标。\r\n3. 首次需在工具 > 选项 > EA交易/专家顾问允许 WebRequest：https://t5quantlab.com。这是终端的本地联网许可，网站无法代替你授权。\r\nEA 产品：安装后加载产品本身，密钥参数留空；交易参数、自动交易许可由你自行确认，本安装器不会启用交易。\r\nMac/Wine：当前 Windows 安装器不适用。手动解压 product.zip，按 MQL4/MQL5 目录复制编译文件，再复制本包同名目录里的 Files 授权配置。指标模板 T5_Start.tpl 复制到对应模板目录，并改名为 '+template+'；MT4 为 templates，MT5 为 MQL5/Profiles/Templates。\r\n本包仅绑定你的网站权益、产品、平台、交易账号和券商服务器，不是通用免授权版。保持终端联网，每分钟校验，离线现有租约最多 5 分钟。到期、撤销及其他账号仍会失效。撤销后30分钟可自助重新绑定，已有撤销记录也按原撤销时间加30分钟计算。配置含私有授权资料，不要转发。已绑定时再次下载同一账号的专属包无需撤销。首次从手动密钥升级会替换旧密钥，绑定账号和冷却规则不变。请移除同产品旧授权助手再加载新模板，避免旧助手删除新授权凭证；EA原密钥参数须清空。\r\nproduct.zip 内旧说明保留作为原版技术参考，本次免输密钥安装以本文件为准。\r\n'
 };
 if(kind==='indicator')files['T5_Start.tpl']=productTemplate(b.product_code,b.platform,indicator.split('/').pop().slice(0,-4));
 return installZip(files);
}
