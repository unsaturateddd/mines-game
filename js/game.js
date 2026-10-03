(() => {
  const START_BALANCE = 291020.11;
  const MULTS = [1.9, 3.8, 7.6];
  const HINTS = [5, 2, 0];
  const BET_STEP = 500;
  const MIN_BET = 500;

  const bombSvg = `
    <svg class="bomb-outline" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="30" cy="40" r="16.5" fill="none" stroke="#6a6f7a" stroke-width="2.8"/>
      <rect x="26" y="21" width="8" height="5" rx="1" fill="#6a6f7a"/>
      <path d="M34 23c7-8 14-11 18-12" fill="none" stroke="#6a6f7a" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M52 8l3-4m1 5l3-2m-8-1l-2-3" fill="none" stroke="#6a6f7a" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;

  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const boardEl = $("board");
  const cells = [...boardEl.querySelectorAll(".cell")];
  const rows = [...boardEl.querySelectorAll(".row")];
  const vault = $("vault");
  const viewport = $("viewport");
  const dots = $("dots");
  const hashSteps = $("hashSteps");
  const prompt = $("prompt");
  const idleBar = $("idleBar");
  const playBar = $("playBar");
  const againBtn = $("againBtn");
  const totalWinBox = $("totalWinBox");
  const totalWinEl = $("totalWin");
  const fxDom = $("fxDom");

  cells.forEach((cell) => {
    const back = cell.querySelector(".cell-back");
    if (back) back.insertAdjacentHTML("beforeend", bombSvg);
  });

  const state = {
    mode: "idle",
    balance: START_BALANCE,
    bet: 5000,
    round: 0,
    busy: false,
  };

  const fmtMoney = (n) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n) => Math.round(n).toString();
  const payoutAt = (i) => state.bet * MULTS[i];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const haptic = () => {
    try { navigator.vibrate?.(12); } catch (_) {}
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
      el.className = "hash-step" + (i === idx ? " is-current" : "");
      el.innerHTML = i === idx
        ? `<span class="payout">${fmtInt(payoutAt(i))}</span><span>${m.toFixed(2)}x</span>`
        : `<span>${m.toFixed(2)}x</span>`;
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

  function fitBoard() {
    const box = viewport.getBoundingClientRect();
    const css = getComputedStyle(viewport);
    const padX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
    const padY = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    const innerW = box.width - padX;
    const innerH = box.height - padY;
    const visible = Math.max(1, rows.filter((row) => !row.classList.contains("spent")).length);
    const colGap = 12;
    const rowGap = 10;
    const size = Math.floor(
      Math.max(72, Math.min((innerW - colGap) / 2, (innerH - rowGap * (visible - 1)) / visible, 198))
    );
    boardEl.style.setProperty("--cell", `${size}px`);
  }

  async function applyShift() {
    if (state.round < 1 || state.round >= 3) return;
    const row = rows[3 - state.round];
    row.classList.add("leaving");
    await wait(240);
    row.classList.add("spent");
    fitBoard();
  }

  function clearCells() {
    cells.forEach((c) => {
      c.classList.remove("hint", "win", "bomb", "is-press");
      c.disabled = false;
    });
  }

  function showHints() {
    cells.forEach((c) => c.classList.remove("hint"));
    const row = activeRow();
    cells
      .filter((c) => Number(c.dataset.i) === row * 2 || Number(c.dataset.i) === row * 2 + 1)
      .forEach((c) => c.classList.add("hint"));
  }

  function setMode(mode) {
    state.mode = mode;
    app.classList.toggle("is-playing", mode !== "idle");
    app.classList.toggle("is-idle", mode === "idle");
    prompt.hidden = mode !== "idle";
    idleBar.hidden = mode !== "idle";
    playBar.hidden = mode === "idle";
    againBtn.hidden = mode !== "win";
    if (mode === "idle") {
      vault.classList.remove("is-open", "won");
      rows.forEach((row) => row.classList.remove("spent", "leaving"));
    }
    requestAnimationFrame(fitBoard);
  }

  let fxTimer = 0;

  function stopFX() {
    clearInterval(fxTimer);
    fxDom.innerHTML = "";
  }

  function startFX() {
    stopFX();
    const burst = () => {
      const appBox = app.getBoundingClientRect();
      const vaultBox = vault.getBoundingClientRect();
      const ox = vaultBox.left + vaultBox.width / 2 - appBox.left;
      const oy = vaultBox.top + vaultBox.height * 0.42 - appBox.top;
      for (let i = 0; i < 14; i++) {
        const el = document.createElement("div");
        const bill = Math.random() < 0.48;
        el.className = "spark " + (bill ? "bill" : "coin");
        if (bill) el.textContent = "$";
        el.style.left = `${ox}px`;
        el.style.top = `${oy}px`;
        el.style.setProperty("--dx", `${(Math.random() - 0.5) * 280}px`);
        el.style.setProperty("--dy", `${140 + Math.random() * 380}px`);
        el.style.setProperty("--rot", `${Math.random() * 640 - 320}deg`);
        el.style.animationDuration = `${2.2 + Math.random() * 1.2}s`;
        el.addEventListener("animationend", () => el.remove());
        fxDom.appendChild(el);
      }
    };
    burst();
    fxTimer = setInterval(burst, 420);
  }

  function resetBoard(keepBalance) {
    state.round = 0;
    state.busy = false;
    if (!keepBalance) state.balance = START_BALANCE;
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
    vault.classList.remove("is-open", "won");
    rows.forEach((row) => row.classList.remove("spent", "leaving"));
    clearCells();
    setTotalWin(0, false);
    setDots();
    renderHash();
    showHints();
    fitBoard();
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
    vault.classList.add("is-open", "won");
    startFX();
    setTimeout(() => { againBtn.hidden = false; }, 1600);
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
    cell.classList.remove("is-press");
    cells.forEach((c) => c.classList.remove("hint"));

    const col = i % 2;
    const sibling = cells[row * 2 + (1 - col)];
    cell.classList.add("win");
    if (sibling) sibling.classList.add("bomb");

    state.round += 1;
    setDots();
    renderHash();
    setTotalWin(payoutAt(state.round - 1), true);

    await wait(800);

    if (state.round < 3) await applyShift();
    if (state.round === 1) vault.classList.add("is-open");

    if (state.round < 3) {
      await wait(560);
      showHints();
      state.busy = false;
    } else {
      await wait(280);
      finishWin();
    }
  }

  function changeBet(dir) {
    if (state.mode !== "idle") return;
    const maxBet = Math.max(MIN_BET, Math.floor(state.balance / BET_STEP) * BET_STEP);
    state.bet = Math.min(maxBet, Math.max(MIN_BET, state.bet + dir * BET_STEP));
    setBalanceView();
  }

  cells.forEach((c) => {
    const pressOn = () => {
      if (c.classList.contains("win") || c.classList.contains("bomb")) return;
      c.classList.add("is-press");
    };
    const pressOff = () => c.classList.remove("is-press");
    c.addEventListener("pointerdown", pressOn);
    c.addEventListener("pointerup", pressOff);
    c.addEventListener("pointerleave", pressOff);
    c.addEventListener("pointercancel", pressOff);
    c.addEventListener("click", onCellClick);
    c.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        c.click();
      }
    });
  });
  $("playBtn").addEventListener("click", startGame);
  $("betMinus").addEventListener("click", () => changeBet(-1));
  $("betPlus").addEventListener("click", () => changeBet(1));
  $("againBtn").addEventListener("click", () => resetBoard(true));
  $("backBtn").addEventListener("click", () => {
    if (state.mode === "playing") state.balance += state.bet;
    resetBoard(true);
  });
  $("depositBtn").addEventListener("click", () => {
    $("depositBtn").animate(
      [{ transform: "scale(1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
      180
    );
  });
  $("cashBtn").addEventListener("click", () => {
    if (state.mode === "win") resetBoard(true);
  });

  window.addEventListener("resize", fitBoard);
  new ResizeObserver(fitBoard).observe(viewport);

  setMode("idle");
  setBalanceView();
  renderHash();
  fitBoard();
})();
