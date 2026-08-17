(function(){
 const $=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const els={board:$('#board'),message:$('#boardMessage'),hint:$('#turnHint'),play:$('#playView'),end:$('#endView'),filters:$('#filterSection'),range:$('#ratingRange'),category:$('#category'),filterSummary:$('#filterSummary'),score:$('#streakScore'),target:$('#targetRating'),passed:$('#currentBest'),playingCategory:$('#playingCategory'),number:$('#puzzleNumber'),puzzleReference:$('#puzzleReference'),puzzleId:$('#puzzleId'),puzzleLink:$('#puzzleLink'),status:$('#playStatus'),review:$('#reviewControls'),reviewMoves:$('#reviewMoves'),reviewPrevious:$('#reviewPrevious'),reviewNext:$('#reviewNext'),reviewPosition:$('#reviewPosition'),nextPuzzle:$('#nextPuzzleButton'),replayPuzzle:$('#replayPuzzleButton'),backToStreak:$('#backToStreakButton'),giveUp:$('#giveUpButton')};
 const defaults={coordinates:true,sound:true,animation:true,window:75};
 const playableBuckets=new Set(Array.from({length:21},(_,i)=>1000+i*100));
 const isPlayableBucket=bucket=>playableBuckets.has(Number(bucket));
 function readSettings(){try{return JSON.parse(localStorage.getItem('streakChessSettings')||'{}')}catch{return{}}}
 window.appSettings={...defaults,...readSettings()};
 window.PUZZLE_BUCKETS=window.PUZZLE_BUCKETS||{};
 let run=null,puzzle=null,index=0,token=0,lastPuzzleId=null,puzzleStartedAt=0,puzzleRecorded=false,reviewPly=1,pausedStreak=null;
 let passedIds=PlayedHistory.passedIds();
 const bucketLoads={};
 const engine=new PuzzleEngine(els.board,{onUserMove});

 function rangeLabel(min=+els.range.value){return min===3000?'3000+':`${min}–${min+99}`}
 function view(name){els.play.classList.toggle('hidden',name!=='play');els.end.classList.toggle('hidden',name!=='end')}
 function loadBucket(bucket){
  bucket=Number(bucket);if(!isPlayableBucket(bucket))return Promise.reject(new Error(`Unsupported puzzle bucket ${bucket}`));
  if(window.PUZZLE_BUCKETS[bucket])return Promise.resolve(window.PUZZLE_BUCKETS[bucket]);
  if(bucketLoads[bucket])return bucketLoads[bucket];
  bucketLoads[bucket]=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`data/browser/puzzles-${bucket}.js`;script.onload=()=>resolve(window.PUZZLE_BUCKETS[bucket]||[]);script.onerror=()=>reject(new Error(`Could not load puzzle bucket ${bucket}`));document.head.append(script)});
  return bucketLoads[bucket]
 }
 function bucketPool(){return window.PUZZLE_BUCKETS[run.rangeMin]||[]}
 function matchingPuzzles(includeSolved=false){return bucketPool().filter(p=>p.themes.includes(run.category)&&(includeSolved||!passedIds.has(p.id)))}
 function choosePuzzle(){let eligible=matchingPuzzles().filter(p=>p.id!==lastPuzzleId);if(!eligible.length)eligible=matchingPuzzles();return eligible[Math.floor(Math.random()*eligible.length)]||null}
 function updatePuzzleReference(selectedPuzzle){
  const id=String(selectedPuzzle?.id||'');els.puzzleReference.classList.toggle('hidden',!id);els.puzzleId.textContent=id;els.puzzleLink.href=id?`https://lichess.org/training/${encodeURIComponent(id)}`:'#'
 }
 function userIsWhite(){const from=puzzle.moves[0].slice(0,2),piece=engine.position[from];return !(piece===piece.toUpperCase())}
 function lockReview(message='Solve puzzle to review moves'){els.review.classList.remove('hidden');els.review.classList.add('locked');els.reviewMoves.innerHTML='';els.reviewPrevious.disabled=true;els.reviewNext.disabled=true;els.reviewPosition.textContent=message}
 function resetReview(){lockReview();els.nextPuzzle.disabled=true;els.replayPuzzle.classList.add('hidden');els.backToStreak.classList.add('hidden');els.giveUp.classList.remove('hidden')}
 function renderMoveChips(){
  const fragment=document.createDocumentFragment();
  puzzle.moves.slice(1).forEach((move,i)=>{const button=document.createElement('button');button.className='move-chip';button.dataset.ply=String(i+2);button.textContent=`${i+1}. ${move}`;button.onclick=()=>showReviewPly(i+2);fragment.append(button)});
  els.reviewMoves.replaceChildren(fragment)
 }

 async function presentPuzzle(selectedPuzzle){
  const mine=++token;puzzle=selectedPuzzle;index=0;puzzleRecorded=false;resetReview();run.currentSolved=false;run.ended=false;updatePuzzleReference(puzzle);
  if(!puzzle){engine.locked=true;engine.loadFen('8/8/8/8/8/8/8/8 w - - 0 1');els.status.textContent=matchingPuzzles(true).length?'Every puzzle in this range has been passed.':'No puzzles are available in this range.';els.hint.textContent='Choose another rating level in Filters.';els.filters.open=true;return}
  lastPuzzleId=puzzle.id;els.board.setAttribute('aria-label',`Interactive chess board, puzzle ${puzzle.id}`);engine.loadFen(puzzle.fen);
  const initial=puzzle.moves[0],userWhite=userIsWhite();
  engine.setOrientation(userWhite?'white':'black');engine.locked=true;els.status.textContent='Opponent is moving…';els.hint.textContent='Watch the last move';
  await sleep(window.appSettings.animation?450:80);if(mine!==token)return;
  engine.move(initial);sound('move');index=1;puzzleStartedAt=Date.now();engine.locked=false;els.status.textContent='Your move';els.hint.textContent=userWhite?'White to move':'Black to move';updatePanel()
 }
 async function loadPuzzle(){return presentPuzzle(choosePuzzle())}

 async function onUserMove(uci){
  if(!run||run.ended||!puzzle)return;
  const expected=puzzle.moves[index];
  if(uci!==expected){recordAttempt('fail',uci,expected);engine.markWrong(uci.slice(0,2),uci.slice(2,4));sound('wrong');els.status.textContent='Incorrect move';showMessage('Incorrect');engine.locked=true;run.ended=true;await sleep(500);enterFailedState();return}
  engine.move(uci);sound('correct');index++;engine.locked=true;
  if(index>=puzzle.moves.length){await solved();return}
  els.status.textContent='Opponent is moving…';await sleep(window.appSettings.animation?430:70);engine.move(puzzle.moves[index]);sound('move');index++;
  if(index>=puzzle.moves.length){await solved();return}
  engine.locked=false;els.status.textContent='Your move'
 }

 function recordAttempt(result,attemptedMove=null,expectedMove=null){
  if(puzzleRecorded||!puzzle)return;puzzleRecorded=true;
  PlayedHistory.save({timestamp:Date.now(),puzzleId:puzzle.id,rating:puzzle.rating,result,rangeMin:run.rangeMin,category:run.category,duration:Date.now()-puzzleStartedAt,moveIndex:index,attemptedMove,expectedMove,solution:puzzle.moves.slice(1),fen:puzzle.fen,moves:puzzle.moves,themes:puzzle.themes||['mate'],gameUrl:puzzle.gameUrl||null});
  if(result==='pass')passedIds.add(puzzle.id);renderHistory()
 }
 async function solved(){recordAttempt('pass');run.puzzles.push({id:puzzle.id,rating:puzzle.rating,result:'pass'});if(!run.reviewingHistory)run.score++;run.currentSolved=true;showMessage('Puzzle complete');sound('complete');updatePanel();enterReview('pass');if(pausedStreak){els.nextPuzzle.disabled=true;els.backToStreak.classList.remove('hidden')}}

 function showReviewPly(ply){
  reviewPly=Math.max(1,Math.min(puzzle.moves.length,ply));engine.loadFen(puzzle.fen);engine.setOrientation(userIsWhite()?'white':'black');
  for(let i=0;i<reviewPly;i++)engine.move(puzzle.moves[i]);engine.locked=true;
  els.reviewMoves.querySelectorAll('.move-chip').forEach(chip=>chip.classList.toggle('active',+chip.dataset.ply===reviewPly));
  els.reviewPrevious.disabled=reviewPly<=1;els.reviewNext.disabled=reviewPly>=puzzle.moves.length;els.reviewPosition.textContent=`Move ${reviewPly-1} of ${puzzle.moves.length-1}`;
  if(run?.historySolved&&!run.currentSolved){els.status.textContent='Reviewing previously solved puzzle';els.replayPuzzle.classList.remove('hidden');els.giveUp.classList.add('hidden')}
 }
 function unlockSolvedHistoryNavigation(){
  run.historySolved=true;run.currentSolved=true;reviewPly=1;els.review.classList.remove('hidden','locked');renderMoveChips();
  els.reviewPrevious.disabled=true;els.reviewNext.disabled=puzzle.moves.length<=1;els.reviewPosition.textContent=`Move 0 of ${puzzle.moves.length-1}`
  els.nextPuzzle.disabled=!!pausedStreak||!isPlayableBucket(run.rangeMin);if(pausedStreak)els.backToStreak.classList.remove('hidden')
 }
 function enterReview(result,fromHistory=false){
  engine.locked=true;els.review.classList.remove('hidden','locked');renderMoveChips();
  showReviewPly(result==='pass'?puzzle.moves.length:1);els.nextPuzzle.disabled=!(result==='pass'&&!fromHistory)||!!pausedStreak;els.giveUp.classList.toggle('hidden',fromHistory||result==='fail'||!!pausedStreak);
  els.status.textContent=fromHistory?`Reviewing ${result==='pass'?'passed':'failed'} puzzle`:result==='pass'?'Solved — review the line or continue':'Failed — review the correct line';
  els.hint.textContent='Use the arrows or click a move to review the solution.'
 }
 function enterFailedState(){
  engine.locked=true;run.lastAttemptFailed=true;run.currentSolved=false;lockReview('Correct moves locked — solve to unlock');els.nextPuzzle.disabled=true;els.replayPuzzle.classList.remove('hidden');els.giveUp.classList.add('hidden');els.backToStreak.classList.toggle('hidden',!pausedStreak);els.status.textContent='Failed — replay to try again';els.hint.textContent='The correct moves stay hidden until you solve this puzzle.'
 }

 async function startRun(){
  pausedStreak=null;const startToken=++token;run={rangeMin:+els.range.value,startRating:+els.range.value,category:els.category.value,score:0,startedAt:Date.now(),puzzles:[],ended:false,currentSolved:false};updatePuzzleReference(null);
  view('play');resetReview();els.filters.open=false;engine.locked=true;engine.loadFen('8/8/8/8/8/8/8/8 w - - 0 1');els.status.textContent='Loading puzzle library…';els.hint.textContent=`Loading ${rangeLabel(run.rangeMin)} Mate puzzles`;
  try{const pool=await loadBucket(run.rangeMin);if(startToken!==token||run.ended)return;const count=(window.PUZZLE_BUCKET_COUNTS||{})[run.rangeMin]||pool.length;els.filterSummary.textContent=`${rangeLabel(run.rangeMin)} · Mate · ${count.toLocaleString()}`;updatePanel();loadPuzzle()}
  catch(error){console.error(error);els.status.textContent='Puzzle library could not be loaded.';els.hint.textContent='Keep the data/browser folder beside index.html.';els.filters.open=true}
 }

 function endRun(){if(!run||run.ended)return;run.ended=true;token++;engine.locked=true;if(puzzle&&!puzzleRecorded)recordAttempt('fail','gave up',puzzle.moves[index]||null);enterFailedState()}
 function updatePanel(){if(!run)return;els.score.textContent=run.score;els.target.textContent=rangeLabel(run.rangeMin);els.passed.textContent=PlayedHistory.all().filter(x=>x.result==='pass'&&x.rangeMin===run.rangeMin).length;els.playingCategory.textContent='Mate';els.number.textContent='#'+(run.score+1)}
 function showMessage(s){els.message.textContent=s;els.message.classList.add('show');setTimeout(()=>els.message.classList.remove('show'),600)}
 function sound(kind){if(!window.appSettings.sound)return;try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=kind==='wrong'?140:kind==='complete'?620:kind==='correct'?480:260;g.gain.setValueAtTime(.05,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.1);o.start();o.stop(c.currentTime+.1)}catch{}}

 function renderHistory(){
  const s=PlayedHistory.stats(),stats=$('#stats'),statsFragment=document.createDocumentFragment();
  [['Played',s.played],['Passed',s.passed],['Failed',s.failed],['Accuracy',s.accuracy],['Highest rating',s.highest||'—']].forEach(([label,value])=>{const card=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');card.className='stat';strong.textContent=String(value);span.textContent=label;card.append(strong,span);statsFragment.append(card)});stats.replaceChildren(statsFragment);
  const records=PlayedHistory.all(),box=$('#history');if(!records.length){const empty=document.createElement('div');empty.className='history-empty';empty.textContent='Every passed or failed puzzle will be recorded here.';box.replaceChildren(empty);return}
  const grid=document.createElement('div');grid.className='history-grid';
  records.forEach(record=>{const timestamp=Number(record.timestamp)||0,rating=Number(record.rating)||0,bucket=Number(record.rangeMin)||1500,puzzleId=String(record.puzzleId||''),passed=record.result==='pass',when=new Date(timestamp).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}),result=passed?'Passed':'Failed',detail=`${result} · Rating ${rating} · ${when} · Duration ${formatDuration(record.duration)} · Puzzle ${puzzleId}`;
   const button=document.createElement('a'),ratingLabel=document.createElement('strong'),resultLabel=document.createElement('span'),idLabel=document.createElement('small');button.className=`history-puzzle-button ${passed?'pass':'fail'}`;button.href=`#review=${encodeURIComponent(puzzleId)}&bucket=${encodeURIComponent(bucket)}&at=${encodeURIComponent(timestamp)}`;button.title=detail;button.setAttribute('aria-label',detail);ratingLabel.textContent=String(rating);resultLabel.textContent=passed?'✓ Passed':'✕ Failed';idLabel.textContent=puzzleId;button.append(ratingLabel,resultLabel,idLabel);
   button.onclick=async event=>{event.preventDefault();window.history.replaceState(null,'',button.getAttribute('href'));await openHistoryRecord(record,!!(run&&!run.ended&&!run.reviewingHistory))};grid.append(button)
  });box.replaceChildren(grid)
 }
 function formatDuration(ms){const sec=Math.max(0,Math.round((ms||0)/1000));return `${Math.floor(sec/60)}m ${sec%60}s`}

 $('#applyFilters').onclick=startRun;$('#retryButton').onclick=startRun;$('#changeButton').onclick=()=>{view('play');els.filters.open=true};
 async function goToNextPuzzle(){
  if(!run?.currentSolved||!isPlayableBucket(run.rangeMin))return;const activeRun=run;els.nextPuzzle.disabled=true;els.status.textContent='Loading next puzzle…';
  try{await loadBucket(run.rangeMin);if(run!==activeRun)return;run.currentSolved=false;run.historySolved=false;run.lastAttemptFailed=false;if(location.hash||new URLSearchParams(location.search).has('review'))window.history.replaceState(null,'',location.pathname);await loadPuzzle()}
  catch(error){console.error(error);els.status.textContent='The next puzzle could not be loaded.';els.nextPuzzle.disabled=false}
 }
 els.nextPuzzle.onclick=goToNextPuzzle;els.replayPuzzle.onclick=async()=>{if(puzzle){const keepKnownNavigation=run?.historySolved&&!run?.lastAttemptFailed;await presentPuzzle(puzzle);if(keepKnownNavigation)unlockSolvedHistoryNavigation();if(pausedStreak)els.backToStreak.classList.remove('hidden')}};els.reviewPrevious.onclick=()=>showReviewPly(reviewPly-1);els.reviewNext.onclick=()=>showReviewPly(reviewPly+1);els.giveUp.onclick=endRun;els.backToStreak.onclick=restorePausedStreak;
 $('#clearHistory').onclick=()=>{if(confirm('Clear every recorded puzzle result?')){PlayedHistory.clear();passedIds=new Set();renderHistory();updatePanel()}};
 const dialog=$('#settingsDialog');$('#settingsButton').onclick=()=>dialog.showModal();
 const controls=[['coordinatesSetting','coordinates'],['soundSetting','sound'],['animationSetting','animation']];controls.forEach(([id,key])=>{const e=$('#'+id);e.checked=window.appSettings[key];e.onchange=saveSettings});$('#windowSetting').value=window.appSettings.window;$('#windowSetting').onchange=saveSettings;
 function saveSettings(){controls.forEach(([id,k])=>window.appSettings[k]=$('#'+id).checked);window.appSettings.window=+$('#windowSetting').value;localStorage.setItem('streakChessSettings',JSON.stringify(window.appSettings));engine.render()}

 async function openHistoryRecord(record,preserveStreak=false){
  if(preserveStreak&&run&&!run.ended&&!run.reviewingHistory){
   for(let tries=0;engine.locked&&!run.currentSolved&&tries<20;tries++)await sleep(50);
   pausedStreak={run,puzzle,index,puzzleStartedAt,puzzleRecorded,lastPuzzleId,pausedAt:Date.now()}
  }
  const storedBucket=Number(record.rangeMin),bucket=Number.isFinite(storedBucket)?storedBucket:1500;els.range.value=isPlayableBucket(bucket)?String(bucket):'1500';run={rangeMin:bucket,startRating:bucket,category:'mate',score:pausedStreak?.run.score||0,puzzles:[],ended:false,currentSolved:false,replaying:true,reviewingHistory:!!pausedStreak};view('play');resetReview();els.status.textContent='Loading saved puzzle…';
  if(record.fen&&record.moves)puzzle={id:record.puzzleId,fen:record.fen,moves:record.moves,rating:record.rating,themes:record.themes||['mate'],gameUrl:record.gameUrl};
  else if(isPlayableBucket(bucket)){const pool=await loadBucket(bucket);puzzle=pool.find(p=>p.id===record.puzzleId)}else puzzle=null;
  if(!puzzle){els.status.textContent='This saved puzzle could not be loaded.';if(pausedStreak)els.backToStreak.classList.remove('hidden');return true}
  lastPuzzleId=puzzle.id;els.filterSummary.textContent=`${rangeLabel(bucket)} · Mate · Replay`;updatePanel();await presentPuzzle(puzzle);if(record.result==='pass')unlockSolvedHistoryNavigation();if(pausedStreak){els.nextPuzzle.disabled=true;els.backToStreak.classList.remove('hidden')}return true
 }
 function restorePausedStreak(){
  if(!pausedStreak)return;const saved=pausedStreak;pausedStreak=null;token++;run=saved.run;puzzle=saved.puzzle;index=saved.index;puzzleRecorded=saved.puzzleRecorded;lastPuzzleId=saved.lastPuzzleId;puzzleStartedAt=saved.puzzleStartedAt+(Date.now()-saved.pausedAt);view('play');els.filters.open=false;els.backToStreak.classList.add('hidden');els.board.setAttribute('aria-label',`Interactive chess board, puzzle ${puzzle.id}`);updatePuzzleReference(puzzle);engine.loadFen(puzzle.fen);const white=userIsWhite();engine.setOrientation(white?'white':'black');for(let i=0;i<index;i++)engine.move(puzzle.moves[i]);updatePanel();
  if(run.currentSolved)enterReview('pass');else{resetReview();engine.locked=false;els.status.textContent='Your move';els.hint.textContent=white?'White to move':'Black to move'}
 }
 async function openHistoryReplay(){
  const queryParams=new URLSearchParams(location.search),hashParams=new URLSearchParams(location.hash.slice(1)),params=hashParams.has('review')?hashParams:queryParams,id=params.get('review');if(!id)return false;
  const requestedBucket=Number(params.get('bucket')),at=Number(params.get('at'));let record=PlayedHistory.all().find(r=>String(r.puzzleId)===id&&(!at||Number(r.timestamp)===at));
  if(!record)return false;record={...record};if(isPlayableBucket(requestedBucket)||(requestedBucket===1400&&record.fen&&record.moves))record.rangeMin=requestedBucket;return openHistoryRecord(record,false)
 }
 renderHistory();openHistoryReplay().then(opened=>{if(!opened)startRun()});
})();
