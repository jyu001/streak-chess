(function(){
 const KEY='streakChessPlayedPuzzles';
 function all(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
 function save(attempt){
  const history=all();history.unshift(attempt);
  try{localStorage.setItem(KEY,JSON.stringify(history));return true}
  catch(error){console.error('Unable to save puzzle history',error);return false}
 }
 function clear(){localStorage.removeItem(KEY)}
 function passedIds(){return new Set(all().filter(x=>x.result==='pass').map(x=>x.puzzleId))}
 function stats(){
  const history=all(),passed=history.filter(x=>x.result==='pass').length,failed=history.filter(x=>x.result==='fail').length;
  return{played:history.length,passed,failed,accuracy:history.length?Math.round(passed/history.length*100)+'%':'—',highest:Math.max(0,...history.map(x=>x.rating||0))}
 }
 window.PlayedHistory={all,save,clear,passedIds,stats};
})();
