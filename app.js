// Endurance sites front end: one app, branded per domain (window.BRAND from the build). Everything real happens
// in the Coachly goal-planner edge function; this file only collects answers and shows results.
(function () {
  const SB_URL = "https://adjjdrgffrfaelvxqyee.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkampkcmdmZnJmYWVsdnhxeWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNDUzNjUsImV4cCI6MjA2NDkyMTM2NX0.QGD4dxYBOfHUtGOHmIF2tF_Y_iafM8Ftu-DHT3rw9pk";
  const API = SB_URL + "/functions/v1/goal-planner";
  const sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, detectSessionInUrl: true } });
  const B = window.BRAND;
  const SITE = window.HOST;

  const RACES = {
    sprint: "Sprint triathlon", olympic: "Olympic triathlon", "70.3": "70.3 / Half Ironman", ironman: "Ironman",
    marathon: "Marathon", "half-marathon": "Half marathon", "10k": "10 km run", "ow-1.5k": "1.5 km open water swim", "ow-5k": "5 km open water swim",
  };
  const DISC = {
    sprint: ["swim", "bike", "run"], olympic: ["swim", "bike", "run"], "70.3": ["swim", "bike", "run"], ironman: ["swim", "bike", "run"],
    marathon: ["run"], "half-marathon": ["run"], "10k": ["run"], "ow-1.5k": ["swim"], "ow-5k": ["swim"],
  };
  const SPEED = { FT: { swim: 2.4, bike: 24, run: 9 }, INT: { swim: 2.8, bike: 27, run: 10.5 }, ADV: { swim: 3.2, bike: 30, run: 12 } };
  const LEVEL = { FT: "First timer", INT: "Intermediate", ADV: "Advanced" };
  const PHASE = { TECH: "Technique", STRENGTH: "Strength", SPEED: "Speed", TAPER: "Taper" };
  const COL = { TECH: "var(--base)", STRENGTH: "var(--build)", SPEED: "var(--peak)", TAPER: "var(--taper)", RECOVERY: "var(--rec)" };
  const SLOT = { long_ride: "Long ride", circuit_ride: "Tempo ride", wind_trainer: "Trainer intervals", easy_ride: "Easy ride", long_run: "Long run", tempo_run: "Tempo run", hill_repeats: "Hill repeats", easy_run: "Easy run", swim_endurance: "Endurance swim", swim_intervals: "CSS intervals", swim_speed: "Speed swim", swim_strength: "Strength swim", brick: "Brick run off the bike", strength: "Strength" };
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAYN = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get: (k) => { try { return JSON.parse(localStorage.getItem("gp_" + k)); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem("gp_" + k) : localStorage.setItem("gp_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  async function api(body, auth) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const { data } = await sb.auth.getSession();
      if (!data.session) throw Object.assign(new Error("sign in first"), { code: 401 });
      headers.Authorization = "Bearer " + data.session.access_token;
    }
    const r = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  }

  // ---------------------------------------------------------------- header + brand
  $("logo").innerHTML = esc(B.logo[0]) + "<span>" + esc(B.logo[1]) + "</span>";
  $("eyebrow").textContent = B.eyebrow; $("headline").textContent = B.h; $("lede").textContent = B.l;
  $("dist").innerHTML = B.races.map((r) => `<option value="${r}" ${r === B.def ? "selected" : ""}>${RACES[r]}</option>`).join("");
  const d = new Date(); d.setDate(d.getDate() + 7 * 22); $("date").value = d.toISOString().slice(0, 10);

  async function renderWho() {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    $("who").innerHTML = u ? `${esc(u.email)}<button id="out-btn">Sign out</button>` : "";
    if (u) $("out-btn").onclick = async () => { await sb.auth.signOut(); store.set("job", null); location.href = location.pathname; };
  }

  // ---------------------------------------------------------------- preview
  function previewBody() {
    return {
      action: "preview", site: SITE, distance: $("dist").value, raceDate: $("date").value,
      trainingAgeYears: +$("years").value, racesAtDistance: +$("racesAt").value, racesAnyDistance: +$("racesAny").value,
      currentWeeklyHours: +$("nowHrs").value, maxWeeklyHours: +$("maxHrs").value,
    };
  }
  const hoursOf = (km, lvl) => Object.entries(km).reduce((a, [k, v]) => a + v / SPEED[lvl][k], 0);

  function seasonHtml(weeks, level, extra) {
    const w = weeks.map((x) => ({ ...x, hrs: Math.round(hoursOf(x.km, level) * 10) / 10 }));
    const max = Math.max(...w.map((x) => x.hrs)), total = w.reduce((a, x) => a + x.hrs, 0), recs = w.filter((x) => x.kind === "RECOVERY").length;
    const seg = []; for (const x of w) { const l = seg[seg.length - 1]; if (l && l[0] === x.phase) l[1]++; else seg.push([x.phase, 1]); }
    return `
      <div class="stats">
        <div class="stat"><div class="k">Weeks</div><div class="v">${w.length}</div></div>
        <div class="stat"><div class="k">Peak week</div><div class="v">${max} h</div></div>
        <div class="stat"><div class="k">Total training</div><div class="v">${Math.round(total)} h</div></div>
        <div class="stat"><div class="k">Lighter weeks</div><div class="v">${recs}</div></div>
      </div>
      <div class="phases">${seg.map((x) => `<div style="flex:${x[1]};background:${COL[x[0]]}">${PHASE[x[0]]} ${x[1]}w</div>`).join("")}</div>
      <div class="chart">${w.map((x) => `<div class="bar" title="Week ${x.week}: ${x.hrs} h" style="height:${x.hrs / max * 100}%;background:${COL[x.kind === "RECOVERY" ? "RECOVERY" : x.phase]}"></div>`).join("")}</div>
      <div class="legend">${Object.keys(COL).map((k) => `<span><i style="background:${COL[k]}"></i>${PHASE[k] || "Lighter week"}</span>`).join("")}</div>
      ${extra || ""}`;
  }

  $("go").onclick = async () => {
    $("out").innerHTML = '<div class="empty"><span class="spin"></span>Building your season with the Coachly engine...</div>';
    const body = previewBody();
    store.set("preview", body);
    let r;
    try { r = await api(body); } catch { $("out").innerHTML = '<div class="empty">Could not reach the planner. Try again in a moment.</div>'; return; }
    const p = r.body;
    if (p.error) { $("out").innerHTML = `<div class="empty">${esc((p.details || [p.error]).join(". "))}</div>`; return; }
    if (!p.ok) { $("out").innerHTML = `<div class="empty">${esc(p.reason)}. Pick a later race or a shorter distance.</div>`; return; }
    $("out").innerHTML = `<h2>Your ${RACES[body.distance]} season <span class="tag">${LEVEL[p.level]}</span></h2>` +
      seasonHtml(p.weeks, p.level, `<p class="note">Starts ${esc(p.startDate)}. Built from the training you do now: volume rises in 3-week cycles with a lighter week, then tapers to race day.</p>`) +
      `<div class="offer"><div style="font-weight:700">Get the full plan in Coachly</div>
        <div class="price">14 days free <small>then A$19/month or A$190/year, cancel any time</small></div>
        <p class="note" style="color:var(--text)">Every session written out, health-screened before it is built, reviewed by you, then in the Coachly app on your phone and watch.</p>
        <button class="btn" type="button" id="start">Build my full plan</button></div>`;
    $("start").onclick = () => startFlow();
  };

  // ---------------------------------------------------------------- flow
  const flow = $("flow");
  function show(html) { flow.classList.remove("hidden"); flow.innerHTML = html; flow.scrollIntoView({ behavior: "smooth", block: "start" }); }
  const steps = (n) => `<div class="steps">${["Account", "Your details", "Free trial", "Building", "Review"].map((s, i) => i === n ? `<b>${i + 1}. ${s}</b>` : `${i + 1}. ${s}`).join(" · ")}</div>`;

  async function startFlow() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return accountView();
    const job = store.get("job");
    if (job) return watchJob(job);
    return intakeView();
  }

  function accountView(msg) {
    show(`${steps(0)}<h2>Create your Coachly account</h2>
      <p class="note" style="margin-top:0">Your plan lives in Coachly. Already use Coachly? Sign in with the same email.</p>
      <label for="em">Email</label><input id="em" type="email" autocomplete="email">
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="new-password" minlength="8">
      <div class="row"><button class="btn" id="su">Create account</button><button class="btn ghost" id="si">Sign in</button></div>
      <div id="am">${msg ? `<p class="ok">${esc(msg)}</p>` : ""}</div>`);
    const go = async (mode) => {
      const email = $("em").value.trim(), password = $("pw").value;
      if (!email || password.length < 8) { $("am").innerHTML = '<p class="err">Enter your email and a password of at least 8 characters.</p>'; return; }
      $("am").innerHTML = '<p class="note"><span class="spin"></span>One moment...</p>';
      const r = mode === "up"
        ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname + "?step=details" } })
        : await sb.auth.signInWithPassword({ email, password });
      if (r.error) { $("am").innerHTML = `<p class="err">${esc(r.error.message)}</p>`; return; }
      await renderWho();
      if (!r.data.session) { $("am").innerHTML = `<p class="ok">Check ${esc(email)} for a confirmation link. It brings you straight back here.</p>`; return; }
      intakeView();
    };
    $("su").onclick = () => go("up"); $("si").onclick = () => go("in");
  }

  function yesNo(id, label) {
    return `<div class="q"><span>${label}</span><select id="${id}"><option value="no">No</option><option value="yes">Yes</option></select></div>`;
  }

  function intakeView(prefill, blocked) {
    const p = store.get("preview") || previewBody();
    const f = prefill || {};
    const disc = DISC[p.distance] || ["run"];
    show(`${steps(1)}<h2>About you and your training</h2>
      <p class="note" style="margin-top:0">${RACES[p.distance]} on ${esc(p.raceDate)}. These answers shape every week of your plan.</p>
      <div class="three">
        <div><label for="age">Age</label><input id="age" type="number" min="18" max="100" value="${f.age ?? ""}"></div>
        <div><label for="sex">Sex</label><select id="sex"><option value="female">Female</option><option value="male">Male</option><option value="other">Prefer not to say</option></select></div>
        <div><label for="yrs">Years training</label><input id="yrs" type="number" min="0" value="${p.trainingAgeYears}"></div>
      </div>
      <div class="two">
        <div><label for="rat">Races at this distance</label><input id="rat" type="number" min="0" value="${p.racesAtDistance}"></div>
        <div><label for="rany">Races at any distance</label><input id="rany" type="number" min="0" value="${p.racesAnyDistance}"></div>
      </div>
      <div class="two">
        <div><label for="hnow">Hours a week now</label><input id="hnow" type="number" min="0" value="${p.currentWeeklyHours}"></div>
        <div><label for="hmax">Most hours you can train</label><input id="hmax" type="number" min="2" value="${p.maxWeeklyHours}"></div>
      </div>
      <h3>Your last 4 weeks (average per week) and your longest recent session</h3>
      ${disc.map((x) => `<div class="two">
        <div><label for="rk_${x}">${x[0].toUpperCase() + x.slice(1)} km per week</label><input id="rk_${x}" type="number" min="0" step="0.5"></div>
        <div><label for="lk_${x}">Longest ${x} (km)</label><input id="lk_${x}" type="number" min="0" step="0.5"></div></div>`).join("")}
      <h3>Days you can train</h3>
      <div class="days">${DAYS.map((x) => `<label><input type="checkbox" name="day" value="${x}" ${["fri"].includes(x) ? "" : "checked"}>${DAYN[x]}</label>`).join("")}</div>
      <h3>Health check</h3>
      <p class="note" style="margin-top:0">Based on the PAR-Q+ used by exercise professionals. Answer honestly: it decides whether a plan is safe to build.</p>
      ${yesNo("hc", "Has a doctor ever said you have a heart condition?")}
      ${yesNo("cp", "Do you feel pain in your chest when you exercise?")}
      ${yesNo("dz", "Do you lose balance from dizziness or lose consciousness?")}
      ${yesNo("fh", "Did a close relative die suddenly of a heart problem before 60?")}
      ${yesNo("bp", "Do you take medication for blood pressure or your heart?")}
      ${yesNo("pn", "Do you have pain right now that limits training?")}
      <div class="q"><span>Injury in the last 3 months?</span><select id="i3"><option value="">No</option>${disc.map((x) => `<option value="${x}">Yes, ${x}</option>`).join("")}</select></div>
      <div class="q"><span>Injury in the last 12 months (now resolved)?</span><select id="i12"><option value="">No</option>${disc.map((x) => `<option value="${x}">Yes, ${x}</option>`).join("")}</select></div>
      <label for="rec">Areas that get injured again and again (optional, e.g. calf, knee)</label><input id="rec" type="text">
      ${yesNo("ill", "Have you been ill in the last 2 weeks?")}
      ${yesNo("st", "Is life unusually stressful right now?")}
      <div id="fem">
        ${yesNo("pg", "Are you pregnant?")}
        <div class="q"><span>Had a baby in the last 6 months? Weeks since birth</span><input id="pp" type="number" min="0" style="width:90px"></div>
        ${yesNo("am", "Have you missed periods for more than 3 months (not due to pregnancy or the pill)?")}
        <div class="q"><span>How many apply: constant tiredness, stress fractures, frequent illness, gut problems?</span><select id="le"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
      </div>
      ${blocked ? `<label class="chk" style="margin-top:14px"><input type="checkbox" id="clr"> A doctor has checked the items above and cleared me to train</label>` : ""}
      <label class="chk" style="margin-top:14px"><input type="checkbox" id="cons"> I agree to Coachly storing these health answers to build and keep my plan safe (<a href="https://coachly.net/privacy" target="_blank">privacy</a>).</label>
      <button class="btn" id="sub">Build my plan</button><div id="im"></div>`);
    const sexSel = $("sex");
    if (f.sex) sexSel.value = f.sex;
    const femToggle = () => { $("fem").style.display = sexSel.value === "female" ? "" : "none"; };
    sexSel.onchange = femToggle; femToggle();
    if (f.health) for (const [id, k] of Object.entries({ hc: "heartCondition", cp: "chestPain", dz: "dizziness", fh: "familySuddenCardiacDeathUnder60", bp: "bpOrHeartMedication", pn: "painNow", ill: "illnessLast2Weeks", st: "highLifeStress", pg: "pregnant", am: "amenorrhoeaOver3Months" })) if (f.health[k]) $(id).value = "yes";
    $("sub").onclick = () => submitIntake();
  }

  function collectIntake() {
    const p = store.get("preview") || previewBody();
    const disc = DISC[p.distance] || ["run"];
    const yes = (id) => $(id) && $(id).value === "yes";
    const num = (id) => ($(id) && $(id).value !== "" ? +$(id).value : undefined);
    const recentKm = {}, longestKm = {};
    for (const x of disc) { if (num("rk_" + x) !== undefined) recentKm[x] = num("rk_" + x); if (num("lk_" + x) !== undefined) longestKm[x] = num("lk_" + x); }
    const female = $("sex").value === "female";
    return {
      action: "submit", site: SITE, distance: p.distance, raceDate: p.raceDate,
      age: num("age"), sex: $("sex").value, trainingAgeYears: num("yrs"), racesAtDistance: num("rat"), racesAnyDistance: num("rany"),
      currentWeeklyHours: num("hnow"), maxWeeklyHours: num("hmax"), recentKm, longestKm,
      availableDays: [...document.querySelectorAll("input[name=day]:checked")].map((x) => x.value),
      health: {
        heartCondition: yes("hc"), chestPain: yes("cp"), dizziness: yes("dz"), familySuddenCardiacDeathUnder60: yes("fh"),
        bpOrHeartMedication: yes("bp"), painNow: yes("pn"), injuryLast3Months: $("i3").value || null, injuryLast12Months: $("i12").value || null,
        recurringInjuryAreas: $("rec").value ? $("rec").value.split(",").map((s) => s.trim()).filter(Boolean) : [],
        pregnant: female && yes("pg"), postpartumWeeks: female ? num("pp") ?? null : null, amenorrhoeaOver3Months: female && yes("am"),
        lowEnergySymptoms: female ? +$("le").value : 0, illnessLast2Weeks: yes("ill"), highLifeStress: yes("st"),
        medicalClearanceAttested: !!($("clr") && $("clr").checked),
      },
      consentHealthData: $("cons").checked,
    };
  }

  async function submitIntake(body) {
    const b = body || collectIntake();
    if (!body && !b.consentHealthData) { $("im").innerHTML = '<p class="err">Please agree to storing your health answers so the plan can be built safely.</p>'; return; }
    if ($("im")) $("im").innerHTML = '<p class="note"><span class="spin"></span>Checking your answers...</p>';
    const r = await api(b, true).catch((e) => ({ status: e.code || 0, body: { error: e.message } }));
    if (r.status === 401) return accountView();
    if (r.status === 402) { store.set("pending", b); return trialView(); }
    if (r.status >= 400) { const m = (r.body.details || [r.body.error || "Something went wrong"]).join(". "); if ($("im")) $("im").innerHTML = `<p class="err">${esc(m)}</p>`; else intakeView(b); return; }
    store.set("pending", null);
    if (r.body.status === "screening_blocked") return blockedView(b, r.body.screening);
    store.set("job", r.body.jobId);
    watchJob(r.body.jobId);
  }

  function blockedView(b, s) {
    const hard = (s.reasons || []).some((x) => /pregnant|pain that limits|postpartum/i.test(x) && !/24 weeks/i.test(x));
    show(`${steps(1)}<h2>Let's get you cleared first</h2>
      <p>Your answers show something a doctor or physio should check before we build a plan:</p>
      <ul>${(s.reasons || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${hard ? `<p>This one can't be self-cleared: once it has resolved, come back and start again.</p>`
        : `<p>When you have been cleared, tick the box at the end of your details and submit again. Your trial has not started and you have not been charged.</p><button class="btn" id="again">I've been cleared: back to my details</button>`}`);
    if (!hard) $("again").onclick = () => intakeView(b, true);
  }

  function trialView(msg) {
    show(`${steps(2)}<h2>Start your free trial</h2>
      <p>Your answers are saved. Start your 14 days free and your plan builds straight away.</p>
      <div class="two">
        <div class="offer" style="margin-top:0"><div style="font-weight:700">Monthly</div><div class="price">A$19 <small>/ month</small></div><button class="btn" data-i="month">Start 14 days free</button></div>
        <div class="offer" style="margin-top:0"><div style="font-weight:700">Yearly <span class="tag">2 months free</span></div><div class="price">A$190 <small>/ year</small></div><button class="btn" data-i="year">Start 14 days free</button></div>
      </div>
      <p class="note">Card needed, nothing charged today. Cancel any time before day 15 and you pay nothing. One free trial per person.</p>
      <div id="tm">${msg ? `<p class="err">${esc(msg)}</p>` : ""}</div>`);
    flow.querySelectorAll("button[data-i]").forEach((b) => b.onclick = async () => {
      $("tm").innerHTML = '<p class="note"><span class="spin"></span>Opening secure checkout...</p>';
      const r = await api({ action: "checkout", site: SITE, interval: b.dataset.i, returnUrl: location.origin + location.pathname }, true);
      if (r.body.alreadySubscribed) return submitIntake(store.get("pending"));
      if (r.body.url) { location.href = r.body.url; return; }
      $("tm").innerHTML = `<p class="err">${esc(r.body.error || "Checkout is not available right now.")}</p>`;
    });
  }

  let pollTimer = null;
  async function watchJob(jobId) {
    show(`${steps(3)}<h2>Building your plan</h2><p><span class="spin"></span><span id="bm">Structuring your season and choosing each session. This usually takes 3 to 8 minutes. You can close this page and come back.</span></p>`);
    clearTimeout(pollTimer);
    const tick = async () => {
      const r = await api({ action: "status", jobId }, true).catch(() => null);
      const st = r?.body?.status;
      if (st === "review") return reviewView(jobId);
      if (st === "accepted") return doneView();
      if (st === "failed" || st === "qc_failed") {
        store.set("job", null);
        show(`<h2>We couldn't build a plan that passes our checks</h2><p>${esc(r.body.error || "Your plan did not pass our safety checks.")}</p><p>Try a later race date or more training days.</p><button class="btn" id="re">Change my details</button>`);
        $("re").onclick = () => intakeView();
        return;
      }
      pollTimer = setTimeout(tick, 6000);
    };
    tick();
  }

  async function reviewView(jobId) {
    const r = await api({ action: "plan", jobId }, true);
    const p = r.body;
    if (!p.weeks) return watchJob(jobId);
    const weeks = p.weeks.map((w) => `<details><summary>Week ${w.week}: ${PHASE[w.phase]}${w.kind === "RECOVERY" ? " (lighter)" : w.kind === "TAPER" ? " (taper)" : ""} · ${Object.entries(w.km).map(([k, v]) => `${k} ${v} km`).join(", ")}</summary>
      <table><tbody>${w.sessions.map((s) => `<tr><td class="day">${DAYN[s.day]}</td><td><b>${esc(s.title || SLOT[s.type] || s.type)}</b><br><span class="note">${SLOT[s.type] || s.type}</span></td><td>${s.km ? s.km + " km" : ""}</td></tr>`).join("")}</tbody></table></details>`).join("");
    show(`${steps(4)}<h2>Your plan is ready to review</h2>
      <p class="note" style="margin-top:0">Starts ${esc(p.startDate)} · ${LEVEL[p.level]} · every week below. Nothing goes into your Coachly calendar until you accept.</p>
      ${seasonHtml(p.weeks.map((w) => ({ week: w.week, phase: w.phase, kind: w.kind, km: w.km })), p.level)}
      ${weeks}
      <div class="row"><button class="btn" id="acc">Accept my plan</button><button class="btn ghost" id="adj">Change something</button></div><div id="rm"></div>`);
    $("acc").onclick = async () => {
      $("rm").innerHTML = '<p class="note"><span class="spin"></span>Adding it to Coachly...</p>';
      const a = await api({ action: "accept", jobId }, true);
      if (a.status === 200) { store.set("job", null); return doneView(); }
      $("rm").innerHTML = `<p class="err">${esc(a.body.error)}</p>`;
    };
    $("adj").onclick = () => adjustView(jobId);
  }

  function adjustView(jobId) {
    show(`<h2>Change something</h2><p class="note" style="margin-top:0">We rebuild the whole plan with your changes.</p>
      <label for="nd">Race date</label><input id="nd" type="date" value="${esc((store.get("preview") || {}).raceDate || "")}">
      <label for="nh">Most hours you can train per week</label><input id="nh" type="number" min="2">
      <h3>Days you can train</h3><div class="days">${DAYS.map((x) => `<label><input type="checkbox" name="nday" value="${x}" checked>${DAYN[x]}</label>`).join("")}</div>
      <button class="btn" id="rb">Rebuild my plan</button><div id="am2"></div>`);
    $("rb").onclick = async () => {
      const changes = { availableDays: [...document.querySelectorAll("input[name=nday]:checked")].map((x) => x.value) };
      if ($("nd").value) changes.raceDate = $("nd").value;
      if ($("nh").value) changes.maxWeeklyHours = +$("nh").value;
      const r = await api({ action: "revise", jobId, changes }, true);
      if (r.status === 402) return trialView("Your subscription is not active. Restart it to rebuild your plan.");
      if (r.status !== 200) { $("am2").innerHTML = `<p class="err">${esc((r.body.details || [r.body.error]).join(". "))}</p>`; return; }
      store.set("job", r.body.jobId); watchJob(r.body.jobId);
    };
  }

  function doneView() {
    show(`<h2>You're all set</h2>
      <p>Your plan is in Coachly. Open it on the web or in the app, and connect your watch to send each session to your wrist.</p>
      <div class="row"><a class="btn" style="text-align:center;text-decoration:none" href="https://coachly.net/my-training">Open my plan</a></div>
      <p class="note">Get the app: <a href="https://apps.apple.com/app/id6804565629">App Store</a> · <a href="https://play.google.com/store/apps/details?id=net.coachly.app">Google Play</a>. Sign in with the same email.</p>`);
  }

  // ---------------------------------------------------------------- resume after email confirm / Stripe
  (async () => {
    await renderWho();
    sb.auth.onAuthStateChange(() => renderWho());
    const q = new URLSearchParams(location.search);
    const clean = () => history.replaceState(null, "", location.pathname);
    if (q.get("checkout") === "success" && store.get("pending")) {
      clean();
      show(`${steps(2)}<p><span class="spin"></span>Trial started. Building your plan...</p>`);
      await api({ action: "subscription" }, true).catch(() => null);
      return submitIntake(store.get("pending"));
    }
    if (q.get("checkout") === "cancelled") { clean(); return trialView("Checkout was cancelled. Your answers are still saved."); }
    if (q.get("step") === "details") { clean(); const { data } = await sb.auth.getSession(); if (data.session) return startFlow(); }
    if (store.get("job")) { const { data } = await sb.auth.getSession(); if (data.session) return watchJob(store.get("job")); }
  })();
})();
