window.T5_CASES=window.T5_CASES||[];
(function(){
  function n36(s){return parseInt(s,36)}
  function decode(d){
    const t=d.z.split(','),bars=[];let prev=0;
    for(let i=0,j=0;i<t.length;i+=4,j++){
      const o=(j===0?n36(t[i]):prev+n36(t[i]));
      const h=o+n36(t[i+1]),l=o+n36(t[i+2]),c=o+n36(t[i+3]);
      bars.push([o/100,h/100,l/100,c/100]);prev=c;
    }
    return {visibleCount:d.n,bars};
  }
  function agg3(src){
    const vis=src.bars.slice(0,src.visibleCount),fut=src.bars.slice(src.visibleCount),out=[];
    const rem=vis.length%3,start=rem;
    const add=a=>{if(a.length)out.push([a[0][0],Math.max(...a.map(x=>x[1])),Math.min(...a.map(x=>x[2])),a[a.length-1][3]])};
    if(rem)add(vis.slice(0,rem));
    for(let i=start;i<vis.length;i+=3)add(vis.slice(i,i+3));
    const visibleCount=out.length;
    for(let i=0;i<fut.length;i+=3)add(fut.slice(i,i+3));
    return {visibleCount,bars:out};
  }
  window.T5_ADD=function(c){
    const m5=decode(c.data.M5),h1=decode(c.data.H1);
    c.data={M5:m5,M15:agg3(m5),H1:h1};
    window.T5_CASES.push(c);
  };
})();
