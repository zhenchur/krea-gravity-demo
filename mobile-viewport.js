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
    const active=document.activeElement,composerFocused=active===input;
    const focused=composerFocused||active?.matches('.flow-axis input');
    const inset=focused?Math.max(0,innerHeight-height):0;
    root.style.setProperty('--keyboard-inset',(inset>80?inset:0)+'px');
    if(!focused||!keepVisible)return;
    keepVisible=false;
    // The settings panel becomes shorter above the keyboard. First reveal the
    // active axis inside its own scroll area, then adjust the page viewport.
    const panel=!composerFocused?active.closest('#settings'):null;
    if(panel){
      const fieldBox=active.getBoundingClientRect(),panelBox=panel.getBoundingClientRect();
      const insideTop=panelBox.top+12,insideBottom=panelBox.bottom-12;
      panel.scrollTop+=fieldBox.bottom>insideBottom?fieldBox.bottom-insideBottom:fieldBox.top<insideTop?fieldBox.top-insideTop:0;
    }
    const box=(composerFocused?form:active).getBoundingClientRect(),upper=top+20,lower=top+height-20;
    // Include the send button. For an exceptionally short viewport, prioritize
    // the caret area; the remaining content stays reachable by normal scrolling.
    const target=composerFocused&&box.height>height-40?input.getBoundingClientRect():box;
    const delta=target.bottom>lower?target.bottom-lower:target.top<upper?target.top-upper:0;
    if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});
  }
  function schedule(reveal=false){
    keepVisible=keepVisible||reveal;
    if(!frame)frame=requestAnimationFrame(update);
  }
  for(const field of [input,...document.querySelectorAll('.flow-axis input')]){
    field.addEventListener('focus',()=>schedule(true));
    field.addEventListener('blur',()=>schedule());
    field.addEventListener('input',()=>schedule(true));
  }
  window.addEventListener('resize',()=>schedule(true),{passive:true});
  viewport?.addEventListener('resize',()=>schedule(true),{passive:true});
  // A browser may pan its visual viewport while bringing the caret into view.
  // Ordinary user scrolling should remain free, so only correct resize/focus.
  viewport?.addEventListener('scroll',()=>schedule(),{passive:true});
  mobile.addEventListener('change',()=>schedule(true));
  schedule();
})();
