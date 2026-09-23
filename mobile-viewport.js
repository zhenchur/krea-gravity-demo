/* Keep the complete composer above the mobile keyboard without resizing the
 * lens to the keyboard. Use the visible viewport, including browser panning. */
(() => {
  'use strict';
  const input=document.getElementById('prompt'),form=document.getElementById('prompt-form');
  const mobile=matchMedia('(max-width: 650px)'),viewport=window.visualViewport;
  const root=document.documentElement;
  let frame=0,keepVisible=false;
  function update(){
    frame=0;
    if(!mobile.matches){root.style.removeProperty('--keyboard-inset');root.style.removeProperty('--visible-height');return;}
    const height=viewport?.height??innerHeight,top=viewport?.offsetTop??0;
    root.style.setProperty('--visible-height',height+'px');
    // Pinch zoom is user controlled: don't fight it or mistake it for a keyboard.
    if(viewport&&Math.abs(viewport.scale-1)>.05){root.style.setProperty('--keyboard-inset','0px');return;}
    const focused=document.activeElement===input;
    const inset=focused?Math.max(0,innerHeight-height):0;
    root.style.setProperty('--keyboard-inset',(inset>80?inset:0)+'px');
    if(!focused||!keepVisible)return;
    keepVisible=false;
    const box=form.getBoundingClientRect(),upper=top+20,lower=top+height-20;
    // Include the send button. For an exceptionally short viewport, prioritize
    // the caret area; the remaining content stays reachable by normal scrolling.
    const target=box.height>height-40?input.getBoundingClientRect():box;
    const delta=target.bottom>lower?target.bottom-lower:target.top<upper?target.top-upper:0;
    if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
  }
  function schedule(reveal=false){
    keepVisible=keepVisible||reveal;
    if(!frame)frame=requestAnimationFrame(update);
  }
  input.addEventListener('focus',()=>schedule(true));
  input.addEventListener('blur',()=>schedule());
  input.addEventListener('input',()=>schedule(true));
  window.addEventListener('resize',()=>schedule(true),{passive:true});
  viewport?.addEventListener('resize',()=>schedule(true),{passive:true});
  // A browser may pan its visual viewport while bringing the caret into view.
  // Ordinary user scrolling should remain free, so only correct resize/focus.
  viewport?.addEventListener('scroll',()=>schedule(),{passive:true});
  mobile.addEventListener('change',()=>schedule(true));
  schedule();
})();
