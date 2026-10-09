import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if(Capacitor.isNativePlatform()){
  document.documentElement.classList.add('native-app');
  const safeName=name=>String(name||'Document.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
  const base64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
  async function shareFiles(data){
    const saved=[];
    try{
      for(const file of data.files||[]){
        const path='exports/'+crypto.randomUUID()+'-'+safeName(file.name);
        const result=await Filesystem.writeFile({path,directory:Directory.Cache,data:await base64(file),recursive:true});
        saved.push({path,uri:result.uri});
      }
      return await Share.share({title:data.title||'Document',text:data.text,url:data.url,files:saved.length?saved.map(f=>f.uri):undefined});
    }finally{for(const file of saved)await Filesystem.deleteFile({path:file.path,directory:Directory.Cache}).catch(()=>{})}
  }
  window.rafShareFiles=shareFiles;
  Object.defineProperty(navigator,'share',{configurable:true,writable:true,value:shareFiles});
  Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>!data.files||data.files.every(f=>f instanceof Blob)});
  const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    if(this.download&&this.href.startsWith('blob:')){
      const href=this.href,name=this.download;
      fetch(href).then(r=>{if(!r.ok)throw Error('Could not load export');return r.blob()}).then(blob=>shareFiles({files:[new File([blob],safeName(name),{type:blob.type})]})).catch(e=>alert(e.message));
      return;
    }
    return click.call(this);
  };
  const originalOpen=window.open.bind(window);
  let connectingEmail=false;
  window.open=function(url,target,features){
    if(!url)return originalOpen(url,target,features);
    const parsed=new URL(String(url),location.href);
    if(parsed.protocol==='https:'){Browser.open({url:parsed.href}).catch(e=>alert(e.message));return null}
    if(parsed.protocol==='mailto:'||parsed.protocol==='tel:')return originalOpen(parsed.href,target,features);
    return null;
  };
  window.rafTakeProgressPhoto=async function(){
    try{
      localStorage.setItem('raf_pending_camera',JSON.stringify({reportId:route.reportId,userId:me.id}));
      const photo=await Camera.getPhoto({source:CameraSource.Camera,resultType:CameraResultType.Uri,quality:85,correctOrientation:true,saveToGallery:false});
      await attachPhoto(photo);
    }catch(e){if(!/cancel/i.test(e.message||''))alert(e.message||'Could not take photo')}
    finally{localStorage.removeItem('raf_pending_camera')}
  };
  async function attachPhoto(photo){
    if(!photo?.webPath)return;
    const blob=await fetch(photo.webPath).then(r=>r.blob());
    const input=document.getElementById('p_files');if(!input)return;
    const files=new DataTransfer();for(const file of input.files||[])files.items.add(file);
    files.items.add(new File([blob],'Jobsite-'+Date.now()+'.'+photo.format,{type:blob.type||'image/jpeg'}));
    input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  document.addEventListener('DOMContentLoaded',()=>{
    window.connectEmailProvider=async function(provider){
      try{const result=await edge('email-oauth-start',{provider});if(!result.url?.startsWith('https://'))throw Error('Invalid email sign-in address');connectingEmail=true;await Browser.open({url:result.url})}catch(e){connectingEmail=false;alert(e.message||'Could not connect email')}
    };
    Browser.addListener('browserFinished',()=>{if(connectingEmail){connectingEmail=false;openEmailSettings().catch(e=>console.warn(e.message))}});
    const photoForm=window.photoForm;
    window.photoForm=function(){photoForm();const input=document.getElementById('p_files');if(input){const b=document.createElement('button');b.className='btn secondary block';b.textContent='Take Jobsite Photo';b.onclick=window.rafTakeProgressPhoto;input.parentNode.appendChild(b)}};
    App.addListener('appRestoredResult',async result=>{
      if(result.pluginId!=='Camera'||result.methodName!=='getPhoto')return;
      try{
        const pending=JSON.parse(localStorage.getItem('raf_pending_camera')||'null');
        if(!pending||!result.success)return;
        if(!me)await boot();
        if(me?.id!==pending.userId)return;
        await go('report',pending.reportId);photoForm();await attachPhoto(result.data);
      }catch(e){alert(e.message||'Could not restore photo')}
      finally{localStorage.removeItem('raf_pending_camera')}
    });
    App.addListener('backButton',()=>{
      if(document.getElementById('modal')){closeModal();return}
      if(window.siteLedgerDrawingContext?.()?.hasDraft||window.siteLedgerDrawingMarkupPending?.()){alert('Save or cancel your drawing changes before leaving.');return}
      if(route.screen==='report'&&!confirm('Leave this report? Save any edits first.'))return;
      if(route.screen==='drawing')go('drawings',route.projectId);
      else if(['drawings','rfis','submittals'].includes(route.screen))go('project',route.projectId);
      else if(route.screen!=='home')go('home');
      else App.minimizeApp();
    });
    App.addListener('appStateChange',async({isActive})=>{if(isActive&&typeof refreshToken!=='undefined'&&refreshToken)try{await refreshSiteLedgerSession()}catch(e){console.warn('Session refresh failed',e.message)}});
  });
}
