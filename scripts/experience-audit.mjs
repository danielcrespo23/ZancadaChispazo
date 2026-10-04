// Runs inside the test browser on fixtures, never on a real runner profile.
export function visualAudit(){
 const visible=e=>{
  if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden'||e.closest('[inert]'))return false;
  for(let parent=e.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(e))return false;
  return true;
 };
 const rgb=value=>{const values=value.match(/[\d.]+/g)?.map(Number)||[];return [values[0]||0,values[1]||0,values[2]||0,values[3]??1];};
 const mix=(fg,bg)=>{const alpha=fg[3]+bg[3]*(1-fg[3]);return alpha?[(fg[0]*fg[3]+bg[0]*bg[3]*(1-fg[3]))/alpha,(fg[1]*fg[3]+bg[1]*bg[3]*(1-fg[3]))/alpha,(fg[2]*fg[3]+bg[2]*bg[3]*(1-fg[3]))/alpha,alpha]:[0,0,0,0];};
 const luminance=color=>color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const background=e=>{let value=[0,0,0,0];for(let n=e;n;n=n.parentElement){value=mix(value,rgb(getComputedStyle(n).backgroundColor));if(value[3]>=1)break;}return mix(value,[255,255,255,1]);};
 const failures=[],controls=[],unnamed=[];let checked=0;
 for(const e of document.querySelectorAll('h1,h2,h3,p,small,b,strong,span,label,button,summary,a,dt,dd,td,th')){
  if(!visible(e)||!e.textContent.trim()||e.matches(':disabled')||!Array.from(e.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const style=getComputedStyle(e),bg=background(e);let fg=rgb(style.color);for(let n=e;n;n=n.parentElement)fg[3]*=+getComputedStyle(n).opacity;
  const contrast=ratio(mix(fg,bg),bg),large=+parseFloat(style.fontSize)>=24||+parseFloat(style.fontSize)>=18.66&&+style.fontWeight>=700,minimum=large?3:4.5;checked++;
  if(contrast<minimum)failures.push({text:e.textContent.trim().slice(0,65),tag:e.tagName,class:e.className,contrast:+contrast.toFixed(2),minimum,foreground:style.color,background:bg.slice(0,3).map(Math.round)});
 }
 for(const e of document.querySelectorAll('button,input,select,textarea,summary')){
  if(!visible(e)||e.matches(':disabled'))continue;
  const style=getComputedStyle(e),rect=e.getBoundingClientRect();
  if(e.matches(':focus-visible')&&style.outlineStyle!=='none'){const contrast=ratio(rgb(style.outlineColor),background(e.parentElement));if(contrast<3)controls.push({type:'focus',label:e.textContent||e.getAttribute('aria-label'),contrast:+contrast.toFixed(2)});}
  if(e.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea')){
   const contrast=ratio(rgb(style.borderTopColor),background(e));if(contrast<3)controls.push({type:'boundary',label:e.getAttribute('aria-label')||e.closest('label')?.textContent.slice(0,60),contrast:+contrast.toFixed(2)});
   const color=!e.value&&e.getAttribute('placeholder')?getComputedStyle(e,'::placeholder').color:style.color,textContrast=ratio(rgb(color),background(e));if(textContrast<4.5)controls.push({type:'input-text',label:e.closest('label')?.textContent.slice(0,60),contrast:+textContrast.toFixed(2)});
  }
  if(e.closest('.mobile-navigation,.mobile-more-panel')&&(rect.height<44||rect.width<44))controls.push({type:'size',label:e.textContent,height:rect.height,width:rect.width});
  const name=e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')?.split(' ').map(id=>document.getElementById(id)?.textContent).join(' ')||(e.tagName==='BUTTON'||e.tagName==='SUMMARY'?e.textContent:e.closest('label')?.textContent)||e.id&&document.querySelector(`label[for="${e.id}"]`)?.textContent;
  if(!name?.trim())unnamed.push({tag:e.tagName,class:e.className});
 }
 return {checked,failures,controls,unnamed,overflow:document.documentElement.scrollWidth>innerWidth};
}
