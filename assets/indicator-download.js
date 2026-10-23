document.querySelectorAll('[data-download][data-status]').forEach(btn=>btn.addEventListener('click',async()=>{
 const status=document.getElementById(btn.dataset.status);btn.disabled=true;status.hidden=false;status.textContent='正在核对账户权限…';
 try{const r=await fetch('/api/member/indicators/'+encodeURIComponent(btn.dataset.download)+'/download',{credentials:'same-origin',cache:'no-store'});
 if(r.status===401){location.href='/account/login/?next='+encodeURIComponent(location.pathname);return}
 if(!r.ok){let d={};try{d=await r.json()}catch{}throw new Error(r.status===403?'当前账户没有此指标的有效下载权限。':d.error||'安装包暂时不可下载')}
 const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=btn.dataset.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='权限验证通过，下载已开始。';
 }catch(e){status.textContent=e.message||'下载失败，请稍后重试。'}finally{btn.disabled=false}
}));
