(()=>{
  const nav=document.getElementById('navlinks')||document.querySelector('.navlinks');
  if(!nav||nav.querySelector('[data-t5-account-nav]'))return;

  const link=document.createElement('a');
  link.href='/account/login/';
  link.textContent='登录 / 注册';
  link.className='account-nav-link';
  link.setAttribute('data-t5-account-nav','1');
  link.setAttribute('aria-label','登录或注册 T5 Quant Lab');
  nav.appendChild(link);

  fetch('/api/auth/me',{credentials:'same-origin',headers:{Accept:'application/json'}})
    .then(async r=>{
      const type=(r.headers.get('content-type')||'').toLowerCase();
      if(!type.includes('application/json'))return null;
      return r.json();
    })
    .then(data=>{
      if(data?.authenticated){
        link.href='/account/';
        link.textContent='My T5';
        link.classList.add('is-authenticated');
        link.setAttribute('aria-label','打开 My T5 工作区');
      }
    })
    .catch(()=>{});
})();
