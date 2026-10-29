document.querySelectorAll('[data-download][data-status]').forEach(btn=>btn.addEventListener('click',()=>{location.href='/account/member-center/?install='+encodeURIComponent(btn.dataset.download);}));
