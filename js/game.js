(() => {
  const START_BALANCE = 291020.11;
  const MULTS = [1.9, 3.8, 7.6];
  const HINTS = [5, 2, 0];
  const BET_STEP = 500;
  const MIN_BET = 500;

  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const boardEl = $("board");
  const cells = [...boardEl.querySelectorAll(".cell")];
  const rows = [...boardEl.querySelectorAll(".row")];
  const vault = $("vault");
  const dots = $("dots");
  const hash = $("hash");
  const hashSteps = $("hashSteps");
  const prompt = $("prompt");
  const idleBar = $("idleBar");
  const playBar = $("playBar");
  const againBtn = $("againBtn");
  const totalWinBox = $("totalWinBox");
  const totalWinEl = $("totalWin");
  const fx = $("fx");
  const ctx = fx.getContext("2d");

  const state = {
    mode: "idle",
    balance: START_BALANCE,
    bet: 5000,
    round: 0,
    busy: false,
    particles: [],
    raf: 0,
  };

  const fmtMoney = (n) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtInt = (n) => Math.round(n).toString();

  const payoutAt = (roundIndex) => state.bet * MULTS[roundIndex];

  const haptic = () => {
    try {
      navigator.vibrate?.(12);
    } catch (_) {}
  };

  function setBalanceView() {
    $("footerBalance").textContent = `${fmtMoney(state.balance)} ₽`;
    $("idleBalance").textContent = state.balance.toFixed(2);
    $("betLabel").textContent = fmtInt(state.bet);
  }

  function activeRow() {
    return 2 - state.round;
  }

  function renderHash() {
    const idx = Math.min(state.round, 2);
    hashSteps.innerHTML = "";
    MULTS.forEach((m, i) => {
      if (i < idx) return;
      const el = document.createElement("div");
      el.className = "hash-step";
      if (i === idx) {
        el.classList.add("is-current");
        el.innerHTML = `<span class="payout">${fmtInt(payoutAt(i))}</span><span>${m.toFixed(2)}x</span>`;
      } else {
        el.innerHTML = `<span>${m.toFixed(2)}x</span>`;
      }
      hashSteps.appendChild(el);
    });
  }

  function setTotalWin(value, lit) {
    totalWinEl.textContent = `${fmtInt(value)} RUB`;
    totalWinBox.classList.toggle("lit", Boolean(lit));
  }

  function setDots() {
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i < state.round));
  }

  function applyShift() {
    if (state.round >= 1 && state.round < 3) {
      const spentRow = 3 - state.round;
      rows[spentRow].classList.add("spent");
    }
  }

  function clearCells() {
    cells.forEach((c) => {
      c.classList.remove("hint", "win", "bomb");
      c.disabled = false;
    });
  }

  function showHints() {
    cells.forEach((c) => c.classList.remove("hint"));
    const row = activeRow();
    cells
      .filter((c) => Number(c.dataset.i) === row * 2 || Number(c.dataset.i) === row * 2 + 1)
      .forEach((c) => c.classList.add("hint"));
    const preferred = cells[HINTS[state.round]];
    if (preferred) preferred.classList.add("hint");
  }

  function setMode(mode) {
    state.mode = mode;
    app.classList.toggle("is-playing", mode !== "idle");
    app.classList.toggle("is-idle", mode === "idle");
    prompt.hidden = mode !== "idle";
    idleBar.hidden = mode !== "idle";
    playBar.hidden = mode === "idle";
    hash.hidden = mode === "idle";
    dots.hidden = mode === "idle";
    againBtn.hidden = mode !== "win";
    if (mode === "idle") {
      vault.hidden = true;
      vault.classList.remove("won");
    }
  }

  function resetBoard(keepBalance) {
    state.round = 0;
    state.busy = false;
    if (!keepBalance) state.balance = START_BALANCE;
    rows.forEach((row) => row.classList.remove("spent"));
    clearCells();
    setTotalWin(0, false);
    setDots();
    renderHash();
    setBalanceView();
    setMode("idle");
    stopFX();
  }

  function startGame() {
    if (state.mode !== "idle") return;
    if (state.balance < state.bet) return;
    haptic();
    state.balance -= state.bet;
    state.round = 0;
    state.busy = false;
    setBalanceView();
    setMode("playing");
    vault.hidden = true;
    vault.classList.remove("won");
    rows.forEach((row) => row.classList.remove("spent"));
    clearCells();
    setTotalWin(0, false);
    setDots();
    renderHash();
    showHints();
  }

  function finishWin() {
    state.mode = "win";
    state.busy = true;
    const prize = payoutAt(2);
    state.balance += prize;
    setBalanceView();
    setTotalWin(prize, true);
    renderHash();
    setDots();
    vault.hidden = false;
    vault.classList.add("won");
    againBtn.hidden = false;
    startFX();
  }

  async function onCellClick(ev) {
    const cell = ev.currentTarget;
    const i = Number(cell.dataset.i);
    const row = Math.floor(i / 2);
    if (state.mode !== "playing" || state.busy) return;
    if (row !== activeRow()) return;
    if (cell.classList.contains("win") || cell.classList.contains("bomb")) return;

    haptic();
    state.busy = true;
    cells.forEach((c) => c.classList.remove("hint"));

    const col = i % 2;
    const sibling = cells[row * 2 + (col === 0 ? 1 : 0)];
    cell.classList.add("win");
    if (sibling) sibling.classList.add("bomb");

    state.round += 1;
    setDots();
    renderHash();
    setTotalWin(payoutAt(state.round - 1), state.round > 0);

    await wait(700);

    if (state.round === 1) {
      vault.hidden = false;
    }

    if (state.round < 3) {
      applyShift();
      await wait(650);
      showHints();
      state.busy = false;
    } else {
      applyShift();
      await wait(400);
      finishWin();
    }
  }

  function changeBet(dir) {
    if (state.mode !== "idle") return;
    const maxBet = Math.max(MIN_BET, Math.floor(state.balance / BET_STEP) * BET_STEP);
    state.bet = Math.min(maxBet, Math.max(MIN_BET, state.bet + dir * BET_STEP));
    setBalanceView();
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function resizeFx() {
    const r = app.getBoundingClientRect();
    fx.width = Math.floor(r.width * devicePixelRatio);
    fx.height = Math.floor(r.height * devicePixelRatio);
  }

  function startFX() {
    document.querySelectorAll(".coin-rain").forEach((n) => n.remove());
    const rain = document.createElement("div");
    rain.className = "coin-rain";
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("span");
      s.className = Math.random() < 0.55 ? "coin" : "bill";
      s.style.left = `${16 + Math.random() * 68}%`;
      s.style.animationDelay = `${Math.random() * 0.7}s`;
      s.style.animationDuration = `${1.7 + Math.random() * 1.5}s`;
      rain.appendChild(s);
    }
    app.appendChild(rain);

    resizeFx();
    const dpr = devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = fx.clientWidth;
    const H = fx.clientHeight;
    state.particles = [];
    const spawn = (n) => {
      for (let i = 0; i < n; i++) {
        state.particles.push({
          kind: Math.random() < 0.55 ? "coin" : "bill",
          x: W * (0.22 + Math.random() * 0.56),
          y: H * (0.16 + Math.random() * 0.08),
          r: 9 + Math.random() * 14,
          vy: 1.4 + Math.random() * 3.2,
          vx: (Math.random() - 0.5) * 2.2,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.16,
          life: 1,
        });
      }
    };
    spawn(80);
    let extra = 0;
    cancelAnimationFrame(state.raf);
    const tick = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      extra += 1;
      if (extra % 8 === 0 && extra < 120) spawn(4);
      for (const p of state.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.045;
        p.life -= 0.0035;
        drawParticle(p);
      }
      state.particles = state.particles.filter((p) => p.life > 0 && p.y < H + 40);
      if (state.particles.length) state.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function drawParticle(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.strokeStyle = "#c8ff74";
    ctx.fillStyle = "rgba(90,255,120,0.16)";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "#7CFF4A";
    ctx.shadowBlur = 16;
    if (p.kind === "coin") {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const w = p.r * 1.9;
      const h = p.r * 1.15;
      roundRect(-w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function stopFX() {
    cancelAnimationFrame(state.raf);
    ctx.clearRect(0, 0, fx.width, fx.height);
    state.particles = [];
    document.querySelectorAll(".coin-rain").forEach((n) => n.remove());
  }

  cells.forEach((c) => c.addEventListener("click", onCellClick));
  $("playBtn").addEventListener("click", startGame);
  $("betMinus").addEventListener("click", () => changeBet(-1));
  $("betPlus").addEventListener("click", () => changeBet(1));
  $("againBtn").addEventListener("click", () => resetBoard(true));
  $("backBtn").addEventListener("click", () => {
    if (state.mode === "playing") {
      state.balance += state.bet;
    }
    resetBoard(true);
  });
  $("depositBtn").addEventListener("click", () => {
    $("depositBtn").animate([{ transform: "scale(1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }], 180);
  });
  $("cashBtn").addEventListener("click", () => {
    if (state.mode === "win") resetBoard(true);
  });
  $("musicBtn").addEventListener("click", () => {
    $("musicBtn").classList.toggle("off");
  });

  window.addEventListener("resize", () => {
    resizeFx();
  });

  setMode("idle");
  setBalanceView();
  renderHash();
  resizeFx();
})();
