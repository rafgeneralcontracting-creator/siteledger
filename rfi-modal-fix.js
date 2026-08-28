(function(){
function closeAllRfiModals(){document.querySelectorAll('.modal').forEach(m=>m.remove())}
const originalCreate=window.createRfiFromMarkedPage;
if(originalCreate){window.createRfiFromMarkedPage=async function(){closeAllRfiModals();return originalCreate.apply(this,arguments)}}
const originalAttach=window.attachMarkedPage;
if(originalAttach){window.attachMarkedPage=async function(){try{return await originalAttach.apply(this,arguments)}finally{closeAllRfiModals()}}}
})();