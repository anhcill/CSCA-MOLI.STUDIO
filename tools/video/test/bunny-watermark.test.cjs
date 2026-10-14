const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../bunny-player-custom-head.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function setup(origin='https://www.molystudio.online') {
  const listeners={},messages=[];
  const container={tagName:'MEDIA-CONTROLLER',appendChild(el){el.parentElement=this;}};
  const parent={postMessage(data,target){messages.push({data,target});}};
  const window={parent,addEventListener(name,fn){listeners[name]=fn;}};
  const document={referrer:origin+'/admin',readyState:'complete',body:{},fullscreenElement:null,
    createElement(){return {setAttribute(){},textContent:''};},querySelector(){return container;},
    addEventListener(name,fn){listeners[name]=fn;}};
  vm.runInNewContext(script,{window,document,URL,Set,MutationObserver:class{observe(){}}});
  return {listeners,messages,container,parent,document};
}
test('watermark accepts only trusted parent and follows fullscreen container',()=>{
  const s=setup();
  const data={type:'moly:watermark',sessionId:'session-1',label:'ADMIN-5 <img src=x>'};
  s.listeners.message({source:{},origin:'https://www.molystudio.online',data});
  s.listeners.message({source:s.parent,origin:'https://evil.invalid',data});
  assert.equal(s.messages.length,1);
  s.listeners.message({source:s.parent,origin:'https://www.molystudio.online',data});
  assert.equal(s.messages.at(-1).data.type,'moly:watermark-applied');
  let captured;
  s.document.fullscreenElement={tagName:'DIV',appendChild(el){captured=el;el.parentElement=this;}};
  s.listeners.fullscreenchange();
  assert.equal(captured.textContent,data.label,'label remains plain text');
  assert.equal(captured.parentElement,s.document.fullscreenElement);
});
test('untrusted embed gets no watermark listener or messages',()=>{
  const s=setup('https://evil.invalid');
  assert.equal(s.listeners.message,undefined);assert.equal(s.messages.length,0);
});
