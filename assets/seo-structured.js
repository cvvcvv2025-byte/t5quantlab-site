(()=>{
'use strict';
if(document.querySelector('meta[name="robots"][content*="noindex" i]'))return;
const canonical=document.querySelector('link[rel="canonical"]')?.href||location.href.split('#')[0].split('?')[0];
const title=(document.querySelector('.page-hero h1,.hero h1')?.textContent||document.title||'').trim();
const description=document.querySelector('meta[name="description"]')?.content?.trim()||'';
const origin=new URL(canonical).origin;
const path=new URL(canonical).pathname;
const orgId=origin+'/#organization';
const siteId=origin+'/#website';
const pageId=canonical+'#webpage';
const graph=[
 { '@type':'Organization','@id':orgId,name:'T5 Quant Lab',url:origin+'/',logo:{'@type':'ImageObject',url:origin+'/favicon.svg'} },
 { '@type':'WebSite','@id':siteId,url:origin+'/',name:'T5 Quant Lab',publisher:{'@id':orgId},inLanguage:'zh-CN' }
];
const crumbBox=document.querySelector('.breadcrumbs');
if(crumbBox){
 const items=[];let pos=1;
 [...crumbBox.querySelectorAll('a')].forEach(a=>{const name=(a.textContent||'').trim();if(!name)return;items.push({'@type':'ListItem',position:pos++,name,item:new URL(a.getAttribute('href'),origin).href});});
 if(title)items.push({'@type':'ListItem',position:pos,name:title,item:canonical});
 if(items.length>=2)graph.push({'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:items});
}
const hubs=new Set(['/','/library/','/market-lab/','/research/','/verification/','/tools/']);
const isCase=/^\/market-lab\/20\d{2}-\d{2}-\d{2}-/.test(path);
const isLeaf=!hubs.has(path)&&!path.includes('/practice/trainer/')&&!path.includes('/strategy-builder/inspect/')&&!path.includes('/checkout/');
const pageType=hubs.has(path)?'CollectionPage':'WebPage';
graph.push({'@type':pageType,'@id':pageId,url:canonical,name:title||document.title,description,isPartOf:{'@id':siteId},publisher:{'@id':orgId},inLanguage:'zh-CN',breadcrumb:crumbBox?{'@id':canonical+'#breadcrumb'}:undefined});
if(isLeaf){
 const article={
  '@type':'Article','@id':canonical+'#article',headline:title||document.title,description,url:canonical,mainEntityOfPage:{'@id':pageId},author:{'@id':orgId},publisher:{'@id':orgId},inLanguage:'zh-CN'
 };
 const m=path.match(/\/(20\d{2})-(\d{2})-(\d{2})-/);if(m)article.datePublished=`${m[1]}-${m[2]}-${m[3]}`;
 if(isCase){article.articleSection='Market Lab Case Study';article.about=[{'@type':'Thing',name:'XAUUSD'},{'@type':'Thing',name:'Market structure and execution audit'}];}
 graph.push(article);
}
const clean=x=>{if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object'){const o={};for(const [k,v] of Object.entries(x))if(v!==undefined&&v!==''&&v!==null)o[k]=clean(v);return o;}return x;};
const script=document.createElement('script');script.type='application/ld+json';script.id='t5-structured-data';script.textContent=JSON.stringify(clean({'@context':'https://schema.org','@graph':graph}));document.head.appendChild(script);
})();