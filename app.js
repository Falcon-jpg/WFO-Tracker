/* RTO Tracker — Amadeus
 * Plain vanilla JS, no build step. Data is stored in the browser via localStorage.
 */

(function(){
  "use strict";
  var K = { att:"officedays:v1:attendance", hol:"officedays:v1:holidays", set:"officedays:v1:settings", last:"officedays:v1:lastPrompt" };
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MSHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  var FALLBACK_HOLIDAYS = [
    {date:"2026-01-26",name:"Republic Day"},
    {date:"2026-05-01",name:"May Day"},
    {date:"2026-05-28",name:"Buddha Purnima"},
    {date:"2026-10-02",name:"Gandhi Jayanti"},
    {date:"2026-10-21",name:"Diwali"},
    {date:"2026-11-10",name:"Guru Nanak Jayanti"},
    {date:"2026-12-25",name:"Christmas Day"}
  ];

  function load(key, fallback){ try{ var v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch(e){ return fallback; } }
  function save(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
  function fmt(n){ return String(Math.round(n*10)/10); }   // 12 -> "12", 12.5 -> "12.5"

  var attendance = load(K.att, {});
  var holidays   = load(K.hol, null);
  var settings   = load(K.set, {name:"You", target:60, theme:"light"});

  var now = new Date();
  var view = { year: now.getFullYear(), month: now.getMonth() };

  // bulk-edit state
  var bulkMode=false, selection={}, dragging=false, dragAdd=true;

  function pad(n){ return n<10?"0"+n:""+n; }
  function ymd(y,m,d){ return y+"-"+pad(m+1)+"-"+pad(d); }
  function isWeekend(y,m,d){ var w=new Date(y,m,d).getDay(); return w===0||w===6; }
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function holidayMap(){ var map={}; holidays.forEach(function(h){ map[h.date]=h.name; }); return map; }

  // ---- stats (supports fractional half-days) ----
  function statsFor(y,m){
    var hmap = holidayMap();
    var dim = daysInMonth(y,m);
    var weekdays=0, publicHolidays=0, wfo=0, wfh=0, leave=0, holidayMarks=0, unmarked=0, effective=0;
    for(var d=1; d<=dim; d++){
      var key = ymd(y,m,d);
      var weekend = isWeekend(y,m,d);
      var isPublic = !!hmap[key];
      if(isPublic) publicHolidays++;
      if(weekend) continue;
      weekdays++;
      var st = attendance[key];
      if(isPublic || st==="holiday"){ holidayMarks++; continue; }   // holidays: out of effective
      if(st==="leave"){ leave+=1; continue; }                       // full leave: out of effective
      if(st==="half-wfo" || st==="half"){ effective+=0.5; leave+=0.5; wfo+=1; continue; }   // half leave + office → full office credit
      if(st==="half-wfh"){ effective+=0.5; leave+=0.5; wfh+=0.5; continue; }                // half leave + home → no office credit
      effective+=1;
      if(st==="wfo") wfo+=1;
      else if(st==="wfh") wfh+=1;
      else unmarked+=1;
    }
    var pct = effective>0 ? Math.min(100, Math.round((wfo/effective)*100)) : 0;
    var targetDays = Math.round((settings.target/100)*effective);   // standard rounding
    var need = Math.max(0, targetDays - wfo);
    var met = effective>0 && wfo >= targetDays;
    return {weekdays:weekdays, publicHolidays:publicHolidays, effective:effective,
            wfo:wfo, wfh:wfh, leave:leave, holidayMarks:holidayMarks, unmarked:unmarked,
            pct:pct, need:need, targetDays:targetDays, met:met};
  }

  // ---- renderers ----
  function renderHeader(){
    document.getElementById("targetVal").textContent = settings.target;
    document.getElementById("nameVal").textContent = settings.name;
    document.getElementById("avatar").textContent = (settings.name||"Y").trim().charAt(0).toUpperCase()||"Y";
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.getElementById("themeState").textContent = settings.theme==="dark"?"Dark":"Light";
    document.getElementById("nameState").textContent = settings.name;
    document.getElementById("promptState").textContent = settings.dailyPrompt===false?"Off":"On";
    document.getElementById("pctMark").style.left = settings.target+"%";
    document.getElementById("pctMark").setAttribute("data-label", settings.target+"%");
  }

  function renderMonths(){
    var box = document.getElementById("months"); box.innerHTML="";
    MSHORT.forEach(function(name,i){
      var b=document.createElement("button");
      b.className="mbtn"; b.textContent=name;
      if(i===view.month) b.setAttribute("aria-current","true");
      b.onclick=function(){ view.month=i; renderAll(); };
      box.appendChild(b);
    });
    document.getElementById("yearLabel").textContent = view.year;
  }

  function renderDashboard(){
    var s = statsFor(view.year, view.month);
    document.getElementById("pctTitle").textContent = "Office % — "+MONTHS[view.month]+" "+view.year;
    var big = document.getElementById("pctBig");
    big.textContent = s.pct+"%";
    big.style.color = s.met ? "var(--ok)" : "var(--danger)";
    document.getElementById("pctFill").style.width = Math.min(100,s.pct)+"%";
    document.getElementById("pctFill").style.background = s.met ? "var(--ok)" : "var(--brand)";
    document.getElementById("effDays").textContent = fmt(s.effective);
    var need = document.getElementById("needTxt");
    if(s.need>0){ need.textContent = "⚠ Need "+fmt(s.need)+" more office day"+(s.need===1?"":"s"); need.className="need"; }
    else { need.textContent = "✓ Target met"; need.className="need ok"; }

    document.getElementById("weekdaysBig").textContent = s.weekdays;
    document.getElementById("bdWeekdays").textContent = s.weekdays;
    document.getElementById("bdHolidays").textContent = s.publicHolidays;
    document.getElementById("bdLeaves").textContent = fmt(s.leave);
    document.getElementById("bdUnmarked").textContent = s.unmarked;

    document.getElementById("acWfo").textContent = fmt(s.wfo)+" days";
    document.getElementById("acWfh").textContent = fmt(s.wfh)+" days";
    document.getElementById("acLeave").textContent = fmt(s.leave)+" days";
    document.getElementById("acHoliday").textContent = s.holidayMarks;

    renderMiniCal();

    renderYearOverview();
    renderHoliThisMonth();
  }

  function renderYearOverview(){
    var box=document.getElementById("yearOverview"); box.innerHTML="";
    for(var m=0;m<12;m++){
      var s=statsFor(view.year,m);
      var row=document.createElement("div"); row.className="yrow";
      var mm=document.createElement("div"); mm.className="m"+(m===view.month?" cur":""); mm.textContent=MSHORT[m];
      var bar=document.createElement("div"); bar.className="ybar";
      var fill=document.createElement("div"); fill.className="yfill";
      fill.style.width=Math.min(100,s.pct)+"%";
      fill.style.background = s.met?"var(--ok)":"var(--brand)";
      var mk=document.createElement("div"); mk.className="ymark"; mk.style.left=settings.target+"%";
      bar.appendChild(fill); bar.appendChild(mk);
      var pct=document.createElement("div"); pct.className="pct";
      pct.innerHTML = '<span>'+s.pct+'%</span><span class="ind" style="background:'+(s.met?"var(--ok)":"var(--danger)")+'"></span>';
      row.appendChild(mm); row.appendChild(bar); row.appendChild(pct);
      box.appendChild(row);
    }
  }

  function renderHoliThisMonth(){
    var box=document.getElementById("holiThisMonth"); box.innerHTML="";
    var prefix = view.year+"-"+pad(view.month+1)+"-";
    var list = holidays.filter(function(h){ return h.date.indexOf(prefix)===0; }).sort(function(a,b){ return a.date<b.date?-1:1; });
    if(!list.length){ box.innerHTML='<div class="empty">No public holidays this month 🎉</div>'; return; }
    list.forEach(function(h){
      var parts=h.date.split("-");
      var row=document.createElement("div"); row.className="holi-this";
      row.innerHTML='<span class="d">'+parts[2]+" "+MSHORT[view.month]+'</span><span>'+escapeHtml(h.name)+'</span>';
      box.appendChild(row);
    });
  }

  function labelFor(st){
    return st==="wfo"?"Office":st==="wfh"?"Home":st==="leave"?"Leave":st==="holiday"?"Holiday":
           (st==="half"||st==="half-wfo")?"Office ½":st==="half-wfh"?"Home ½":"";
  }

  function renderCalendar(){
    document.getElementById("calTitle").textContent = MONTHS[view.month]+" "+view.year;
    var grid=document.getElementById("calGrid"); grid.innerHTML="";
    grid.classList.toggle("selecting", bulkMode);
    DOW.forEach(function(d){ var h=document.createElement("div"); h.className="head"; h.textContent=d; grid.appendChild(h); });
    var first=new Date(view.year,view.month,1).getDay();
    var lead=(first+6)%7;
    var dim=daysInMonth(view.year,view.month);
    var hmap=holidayMap();
    for(var i=0;i<lead;i++){ var blank=document.createElement("div"); blank.className="cell muteday"; grid.appendChild(blank); }
    var todayKey = ymd(now.getFullYear(), now.getMonth(), now.getDate());
    for(var d=1; d<=dim; d++){
      var key=ymd(view.year,view.month,d);
      var weekend=isWeekend(view.year,view.month,d);
      var isPublic=!!hmap[key];
      var st=attendance[key];
      if(isPublic) st="holiday";              // public holiday display wins
      var cell=document.createElement("div");
      cell.className = "cell" + (weekend?" weekend":" day");
      cell.dataset.key = key;
      if(st && !weekend) cell.className += " s-"+st;
      if(key===todayKey) cell.className += " today-cell";
      if(selection[key]) cell.className += " sel";
      var dn=document.createElement("div"); dn.className="dn"; dn.textContent=d; cell.appendChild(dn);
      var tagText = isPublic ? hmap[key] : labelFor(st);
      if(tagText && !weekend){ var tag=document.createElement("div"); tag.className="tag"; tag.textContent=tagText; cell.appendChild(tag); }
      if(!weekend){
        (function(k,dd){ cell.onclick=function(ev){ if(bulkMode) return; openPopover(ev,k,dd); }; })(key,d);
      }
      grid.appendChild(cell);
    }
  }

  function renderMiniCal(){
    var box=document.getElementById("miniCal"); box.innerHTML="";
    ["M","T","W","T","F","S","S"].forEach(function(d){ var h=document.createElement("div"); h.className="mini-head"; h.textContent=d; box.appendChild(h); });
    var first=new Date(view.year,view.month,1).getDay();
    var lead=(first+6)%7;
    var dim=daysInMonth(view.year,view.month);
    var hmap=holidayMap();
    for(var i=0;i<lead;i++){ var b=document.createElement("div"); b.className="mini-cell empty"; box.appendChild(b); }
    for(var d=1; d<=dim; d++){
      var key=ymd(view.year,view.month,d);
      var weekend=isWeekend(view.year,view.month,d);
      var isPublic=!!hmap[key];
      var st=attendance[key];
      if(isPublic) st="holiday";
      var cell=document.createElement("div");
      cell.className="mini-cell";
      if(weekend) cell.className+=" mini-weekend";
      else if(st) cell.className+=" mini-"+st;
      else cell.className+=" mini-none";
      cell.textContent = d;
      cell.title = d+" "+MSHORT[view.month]+(weekend?" — weekend":(st?(" — "+labelFor(st)):" — unmarked"));
      box.appendChild(cell);
    }
  }

  function renderHolidaysTab(){
    var box=document.getElementById("holiList"); box.innerHTML="";
    var sorted=holidays.slice().sort(function(a,b){ return a.date<b.date?-1:1; });
    if(!sorted.length){ box.innerHTML='<div class="empty">No holidays added yet. Add your first one below.</div>'; }
    sorted.forEach(function(h){
      var p=h.date.split("-");
      var row=document.createElement("div"); row.className="hrow";
      row.innerHTML='<span class="hd">'+p[2]+" "+MSHORT[parseInt(p[1],10)-1]+" "+p[0]+'</span><span class="hn">'+escapeHtml(h.name)+'</span>';
      var x=document.createElement("button"); x.className="x"; x.innerHTML="&times;"; x.setAttribute("aria-label","Remove "+h.name);
      x.onclick=function(){ holidays=holidays.filter(function(z){ return z.date!==h.date; }); save(K.hol,holidays); renderHolidaysTab(); renderAll(); };
      row.appendChild(x);
      box.appendChild(row);
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

  // ---- single-day popover ----
  function openPopover(ev, key, dayNum){
    ev.stopPropagation();
    closePopover();
    var p=document.getElementById("popover");
    var dateObj=new Date(view.year,view.month,dayNum);
    var head=DOW[(dateObj.getDay()+6)%7]+", "+dayNum+" "+MSHORT[view.month]+" "+view.year;
    var shortHead=DOW[(dateObj.getDay()+6)%7]+" "+dayNum+" "+MSHORT[view.month];
    var pop=document.createElement("div"); pop.className="pop";
    function setStatus(st){ if(st) attendance[key]=st; else delete attendance[key]; save(K.att,attendance); closePopover(); renderAll(); }
    function bindStatus(){ pop.querySelectorAll("button[data-st]").forEach(function(b){ b.onclick=function(){ setStatus(b.getAttribute("data-st")); }; }); }
    function renderMain(){
      pop.innerHTML='<div class="ph">'+head+'</div>'
        +'<button data-st="wfo"><span class="ic" style="background:var(--wfo)">🏢</span>Work from office</button>'
        +'<button data-st="wfh"><span class="ic" style="background:var(--wfh)">🏠</span>Work from home</button>'
        +'<button data-st="leave"><span class="ic" style="background:var(--leave)">🌴</span>Full-day leave</button>'
        +'<button class="half-row"><span class="ic" style="background:var(--leave)">½</span>Half-day leave</button>'
        +'<button data-st="holiday"><span class="ic" style="background:var(--holiday)">🎉</span>Holiday</button>'
        +'<div class="sep"></div><button class="clear" data-st=""><span class="ic">✕</span>Clear / unmark</button>';
      bindStatus();
      pop.querySelector(".half-row").onclick=function(e){ e.stopPropagation(); renderHalf(); };
    }
    function renderHalf(){
      pop.innerHTML='<div class="ph"><span class="back">‹</span>Half-day leave · '+shortHead+'</div>'
        +'<div class="askline">Mode for the working half?</div>'
        +'<button data-st="half-wfo"><span class="ic" style="background:var(--wfo)">🏢</span>In office</button>'
        +'<button data-st="half-wfh"><span class="ic" style="background:var(--wfh)">🏠</span>From home</button>';
      bindStatus();
      pop.querySelector(".back").onclick=function(e){ e.stopPropagation(); renderMain(); };
    }
    renderMain();
    p.appendChild(pop);
    var px=Math.min(ev.clientX, window.innerWidth-260);
    var py=Math.min(ev.clientY, window.innerHeight-360);
    pop.style.left=Math.max(8,px)+"px"; pop.style.top=Math.max(8,py)+"px";
    setTimeout(function(){ document.addEventListener("click", closePopover, {once:true}); },0);
  }
  function closePopover(){ document.getElementById("popover").innerHTML=""; }

  // ---- bulk edit ----
  function setBulk(on){ bulkMode=on; selection={}; closePopover(); renderCalendar(); updateBulkUI(); }
  function updateBulkUI(){
    var t=document.getElementById("bulkToggle");
    t.classList.toggle("active", bulkMode);
    t.textContent = bulkMode ? "✓ Bulk edit (on)" : "✏️ Bulk edit";
    document.getElementById("bulkHelpers").classList.toggle("hide", !bulkMode);
    document.getElementById("bulkBar").classList.toggle("hide", !bulkMode);
    updateBulkBar();
  }
  function updateBulkBar(){
    var n=Object.keys(selection).length;
    document.getElementById("bulkCount").textContent = n+" selected";
    document.querySelectorAll("#bulkBar .bulkbtns button").forEach(function(b){ b.disabled=(n===0); });
  }
  function applySel(key, add, cell){
    if(add){ selection[key]=true; if(cell) cell.classList.add("sel"); }
    else { delete selection[key]; if(cell) cell.classList.remove("sel"); }
    updateBulkBar();
  }
  function applyBulk(status){
    var keys=Object.keys(selection); if(!keys.length) return;
    keys.forEach(function(k){ if(status) attendance[k]=status; else delete attendance[k]; });
    save(K.att, attendance); selection={}; renderAll(); updateBulkUI();
  }
  function weekdayKeys(){
    var arr=[]; var dim=daysInMonth(view.year,view.month);
    for(var d=1; d<=dim; d++){ if(!isWeekend(view.year,view.month,d)) arr.push(ymd(view.year,view.month,d)); }
    return arr;
  }

  // ---- backup ----
  function exportBackup(){
    var data={ app:"office-days", version:1, exportedAt:new Date().toISOString(), attendance:attendance, holidays:holidays, settings:settings };
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download="office-days-backup-"+new Date().toISOString().slice(0,10)+".json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importBackup(file){
    var r=new FileReader();
    r.onload=function(){
      try{
        var d=JSON.parse(r.result);
        if(d.attendance) attendance=d.attendance;
        if(d.holidays) holidays=d.holidays;
        if(d.settings) settings=Object.assign(settings, d.settings);
        save(K.att,attendance); save(K.hol,holidays); save(K.set,settings);
        renderHeader(); renderHolidaysTab(); renderAll(); alert("Backup restored.");
      }catch(e){ alert("That file could not be read as a valid backup."); }
    };
    r.readAsText(file);
  }

  // ---- tabs ----
  function showTab(name){
    ["dashboard","calendar","holidays"].forEach(function(t){ document.getElementById(t).classList.toggle("hide", t!==name); });
    document.querySelectorAll(".tab").forEach(function(b){ b.setAttribute("aria-selected", b.getAttribute("data-tab")===name); });
    if(name==="holidays") renderHolidaysTab();
    if(name!=="calendar" && bulkMode) setBulk(false);
  }

  function renderAll(){ renderMonths(); renderDashboard(); renderCalendar(); }

  // ---- wire up ----
  document.querySelectorAll(".tab").forEach(function(b){ b.onclick=function(){ showTab(b.getAttribute("data-tab")); }; });
  document.getElementById("prevYear").onclick=function(){ view.year--; renderAll(); };
  document.getElementById("nextYear").onclick=function(){ view.year++; renderAll(); };
  document.getElementById("todayBtn").onclick=function(){ view.year=now.getFullYear(); view.month=now.getMonth(); renderAll(); };
  var settingsBtn=document.getElementById("settingsBtn"), settingsMenu=document.getElementById("settingsMenu");
  function closeSettings(e){ if(settingsMenu.contains(e.target)||settingsBtn.contains(e.target)) return; settingsMenu.classList.add("hide"); document.removeEventListener("click", closeSettings); }
  settingsBtn.onclick=function(e){ e.stopPropagation(); var wasOpen=!settingsMenu.classList.contains("hide"); settingsMenu.classList.toggle("hide"); if(!wasOpen){ renderHeader(); setTimeout(function(){ document.addEventListener("click", closeSettings); },0); } };
  document.getElementById("themeToggle").onclick=function(){ settings.theme=settings.theme==="dark"?"light":"dark"; save(K.set,settings); renderHeader(); };
  document.getElementById("nameEdit").onclick=function(){ var v=prompt("Your name", settings.name); if(v===null) return; settings.name=v.trim()||"You"; save(K.set,settings); renderHeader(); };
  document.getElementById("promptToggle").onclick=function(){ settings.dailyPrompt = settings.dailyPrompt===false; save(K.set,settings); renderHeader(); };
  document.getElementById("miniCal").onclick=function(){ showTab("calendar"); };
  document.getElementById("resetMonth").onclick=function(){
    if(!confirm("Remove all marks for "+MONTHS[view.month]+" "+view.year+"?\n\nThis cannot be undone.")) return;
    var prefix=view.year+"-"+pad(view.month+1)+"-";
    Object.keys(attendance).forEach(function(k){ if(k.indexOf(prefix)===0) delete attendance[k]; });
    save(K.att, attendance); selection={}; renderAll();
    if(bulkMode) updateBulkUI();
  };
  document.getElementById("targetChip").onclick=function(){
    var v=prompt("Office attendance target (%)", settings.target);
    if(v===null) return; v=parseInt(v,10);
    if(!isNaN(v)&&v>=0&&v<=100){ settings.target=v; save(K.set,settings); renderHeader(); renderAll(); }
  };
  document.getElementById("exportBtn").onclick=exportBackup;
  document.getElementById("importBtn").onclick=function(){ document.getElementById("importFile").click(); };
  document.getElementById("importFile").onchange=function(e){ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=""; };
  document.getElementById("addHoliBtn").onclick=function(){
    var date=document.getElementById("newHoliDate").value;
    var name=document.getElementById("newHoliName").value.trim();
    if(!date){ alert("Pick a date for the holiday."); return; }
    if(!name) name="Public Holiday";
    holidays=holidays.filter(function(h){ return h.date!==date; });
    holidays.push({date:date,name:name});
    save(K.hol,holidays);
    document.getElementById("newHoliDate").value=""; document.getElementById("newHoliName").value="";
    renderHolidaysTab(); renderAll();
  };
  (function(){ var di=document.getElementById("newHoliDate"); if(di) di.addEventListener("click", function(){ if(this.showPicker){ try{ this.showPicker(); }catch(e){} } }); })();

  // bulk wiring
  document.getElementById("bulkToggle").onclick=function(){ setBulk(!bulkMode); };
  document.getElementById("bulkDone").onclick=function(){ setBulk(false); };
  document.getElementById("selWeekdays").onclick=function(){ weekdayKeys().forEach(function(k){ selection[k]=true; }); renderCalendar(); updateBulkBar(); };
  document.getElementById("selUnmarked").onclick=function(){ var hmap=holidayMap(); weekdayKeys().forEach(function(k){ if(!attendance[k] && !hmap[k]) selection[k]=true; }); renderCalendar(); updateBulkBar(); };
  document.getElementById("selDeselect").onclick=function(){ selection={}; renderCalendar(); updateBulkBar(); };
  document.querySelectorAll("#bulkBar .bulkbtns button").forEach(function(b){ b.onclick=function(){ applyBulk(b.getAttribute("data-bs")); }; });

  // drag-to-select (mouse + touch via pointer events)
  var grid=document.getElementById("calGrid");
  grid.addEventListener("pointerdown", function(e){
    if(!bulkMode) return;
    var cell=e.target.closest(".cell.day"); if(!cell) return;
    e.preventDefault();
    dragging=true; var key=cell.dataset.key; dragAdd=!selection[key];
    applySel(key, dragAdd, cell);
  });
  document.addEventListener("pointermove", function(e){
    if(!bulkMode || !dragging) return;
    e.preventDefault();
    var el=document.elementFromPoint(e.clientX, e.clientY);
    if(!el || !el.closest) return;
    var cell=el.closest(".cell.day");
    if(!cell || !cell.dataset.key) return;
    applySel(cell.dataset.key, dragAdd, cell);
  }, {passive:false});
  document.addEventListener("pointerup", function(){ dragging=false; });

  // ---- daily check-in prompt ----
  function maybePrompt(){
    if(settings.dailyPrompt===false) return;            // user turned it off
    var t=new Date();
    if(t.getDay()===0 || t.getDay()===6) return;        // weekend
    var key=ymd(t.getFullYear(),t.getMonth(),t.getDate());
    if(holidayMap()[key]) return;                       // public holiday
    if(attendance[key]) return;                         // already marked today
    if(load(K.last,null)===key) return;                 // already prompted today
    showPrompt(key);
  }
  function showPrompt(key){
    save(K.last, key);                                  // don't ask again today, whatever they pick
    var t=new Date();
    var hr=t.getHours();
    var greet=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening";
    var opts=[["wfo","In office","🏢","var(--wfo)"],["wfh","From home","🏠","var(--wfh)"],["leave","On leave","🌴","var(--leave)"]];
    var html='<div class="modal"><h3>'+greet+", "+escapeHtml(settings.name)+'!</h3><p class="sub">Where are you working from today?</p><div class="opts">';
    opts.forEach(function(o){ html+='<button data-st="'+o[0]+'"><span class="mic" style="background:'+o[3]+'">'+o[2]+'</span>'+o[1]+'</button>'; });
    html+='</div><div class="foot"><button class="dont">Don\u2019t ask me again</button><button class="skip">Skip for today</button></div></div>';
    var wrap=document.createElement("div"); wrap.className="modal-backdrop"; wrap.innerHTML=html;
    function close(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    wrap.addEventListener("click", function(e){ if(e.target===wrap) close(); });
    wrap.querySelectorAll(".opts button").forEach(function(b){
      b.onclick=function(){ attendance[key]=b.getAttribute("data-st"); save(K.att,attendance); close(); renderAll(); };
    });
    wrap.querySelector(".skip").onclick=close;
    wrap.querySelector(".dont").onclick=function(){ settings.dailyPrompt=false; save(K.set,settings); close(); };
    document.body.appendChild(wrap);
  }

  function boot(){ renderHeader(); renderAll(); maybePrompt(); }
  // Seed default holidays from holidays.json the first time; fall back to the
  // built-in list if the file cannot be fetched (e.g. opened directly via file://).
  if(holidays === null){
    fetch("holidays.json")
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(data){ holidays = Array.isArray(data) ? data : (data.holidays || FALLBACK_HOLIDAYS.slice()); })
      .catch(function(){ holidays = FALLBACK_HOLIDAYS.slice(); })
      .then(function(){ save(K.hol, holidays); boot(); });
  } else {
    boot();
  }
})();
