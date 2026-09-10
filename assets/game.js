/* 6×6 Mini Sudoku — 本站自研在线游戏
 * 生成器：回溯填充完整解 → 随机挖洞 + 唯一解校验
 * 特性：三难度、候选数铅笔标记、计时、错误统计、本地排行榜
 * 纯原生 JS，无依赖，支持键盘与触控。
 */
(function () {
  "use strict";

  var SIZE = 6;
  var BOX_H = 2; // 宫格高（行）
  var BOX_W = 3; // 宫格宽（列）
  var CELLS = SIZE * SIZE;

  var DIFF = {
    easy: { label: "简单", givens: 22, maxErrors: 3 },
    medium: { label: "中等", givens: 16, maxErrors: 3 },
    hard: { label: "困难", givens: 11, maxErrors: 2 }
  };

  var LS_KEY = "ms6-leaderboard-v1";
  var LEADER_LIMIT = 10;

  /* ---------- 工具 ---------- */

  function shuffle(a) {
    return shuffleWith(a, Math.random);
  }

  // 带随机源洗牌（用于每日一题的确定性生成）
  function shuffleWith(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // mulberry32：轻量可播种 PRNG
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return pad2(m) + ":" + pad2(s);
  }

  /* ---------- 数独求解与生成 ---------- */

  function emptyGrid() {
    var g = new Array(SIZE);
    for (var r = 0; r < SIZE; r++) {
      g[r] = new Array(SIZE).fill(0);
    }
    return g;
  }

  function boxIndex(r, c) {
    return Math.floor(r / BOX_H) * BOX_W + Math.floor(c / BOX_W);
  }

  function canPlace(g, r, c, v) {
    for (var i = 0; i < SIZE; i++) {
      if (g[r][i] === v) return false;
      if (g[i][c] === v) return false;
    }
    var br = Math.floor(r / BOX_H) * BOX_H;
    var bc = Math.floor(c / BOX_W) * BOX_W;
    for (var dr = 0; dr < BOX_H; dr++) {
      for (var dc = 0; dc < BOX_W; dc++) {
        if (g[br + dr][bc + dc] === v) return false;
      }
    }
    return true;
  }

  // 回溯填充完整解；成功返回 true
  function fill(g) {
    return fillWith(g, Math.random);
  }

  function fillWith(g, rng) {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (g[r][c] !== 0) continue;
        var nums = shuffleWith([1, 2, 3, 4, 5, 6], rng);
        for (var i = 0; i < nums.length; i++) {
          var v = nums[i];
          if (canPlace(g, r, c, v)) {
            g[r][c] = v;
            if (fillWith(g, rng)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }

  // 统计解的个数（最多统计到 limit）
  function countSolutions(g, limit) {
    var count = 0;
    (function solve() {
      if (count >= limit) return;
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (g[r][c] !== 0) continue;
          for (var v = 1; v <= SIZE; v++) {
            if (canPlace(g, r, c, v)) {
              g[r][c] = v;
              solve();
              g[r][c] = 0;
              if (count >= limit) return;
            }
          }
          return;
        }
      }
      count++;
    })();
    return count;
  }

  // 生成谜题：返回 { puzzle, solution }
  function generate(difficultyKey) {
    return generateWith(difficultyKey, Math.random);
  }

  // 播种生成：同一 seed 永远产出同一谜题（用于每日一题）
  function generateSeeded(difficultyKey, seed) {
    return generateWith(difficultyKey, mulberry32(seed));
  }

  function generateWith(difficultyKey, rng) {
    var target = DIFF[difficultyKey].givens;
    var solution = emptyGrid();
    fillWith(solution, rng);

    var puzzle = emptyGrid();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        puzzle[r][c] = solution[r][c];
      }
    }

    // 挖洞：随机顺序移除，保证唯一解
    var cells = [];
    for (var i = 0; i < CELLS; i++) cells.push(i);
    shuffleWith(cells, rng);

    var givens = CELLS;
    for (var k = 0; k < cells.length && givens > target; k++) {
      var idx = cells[k];
      var rr = Math.floor(idx / SIZE);
      var cc = idx % SIZE;
      var backup = puzzle[rr][cc];
      puzzle[rr][cc] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        givens--;
      } else {
        puzzle[rr][cc] = backup;
      }
    }
    return { puzzle: puzzle, solution: solution };
  }

  /* ---------- 排行榜 ---------- */

  function loadLeaderboard() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      if (typeof obj !== "object" || obj === null) return {};
      return obj;
    } catch (e) {
      return {};
    }
  }

  function saveLeaderboard(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) { /* 隐私模式下静默失败 */ }
  }

  function addScore(difficultyKey, entry) {
    var lb = loadLeaderboard();
    var list = lb[difficultyKey] || [];
    list.push(entry);
    list.sort(function (a, b) {
      if (a.errors !== b.errors) return a.errors - b.errors;
      return a.time - b.time;
    });
    if (list.length > LEADER_LIMIT) list.length = LEADER_LIMIT;
    lb[difficultyKey] = list;
    saveLeaderboard(lb);
    return list;
  }

  /* ---------- 游戏组件 ---------- */

  function Game(host) {
    this.host = host;
    this.difficulty = "easy";
    this.puzzle = null;
    this.solution = null;
    this.board = null;      // 当前值（0=空）
    this.candidates = null; // [r][c] = {1..6:bool}
    this.selR = -1;
    this.selC = -1;
    this.errors = 0;
    this.seconds = 0;
    this.timerId = null;
    this.pencil = false;
    this.over = false;
    this.won = false;
    this.startedAt = null;

    this.build();
    this.newGame();
  }

  Game.prototype.build = function () {
    var h = this.host;
    h.innerHTML =
      '<div class="ms6-toolbar">' +
        '<label class="ms6-diff" aria-label="选择难度">' +
          '<select aria-label="难度">' +
            '<option value="easy">简单</option>' +
            '<option value="medium">中等</option>' +
            '<option value="hard">困难</option>' +
          '</select>' +
        '</label>' +
        '<div class="ms6-stats" aria-live="polite">' +
          '<span class="ms6-timer" aria-label="用时">⏱ 00:00</span>' +
          '<span class="ms6-err" aria-label="错误数">✗ 0/3</span>' +
        '</div>' +
        '<button type="button" class="ms6-new" aria-label="开始新游戏">新局</button>' +
      '</div>' +
      '<div class="ms6-grid-wrap">' +
        '<div class="ms6-grid" role="grid" aria-label="6×6 数独棋盘"></div>' +
      '</div>' +
      '<div class="ms6-panel">' +
        '<div class="ms6-numpad" role="group" aria-label="数字键区"></div>' +
        '<div class="ms6-actions">' +
          '<button type="button" class="ms6-pencil" aria-pressed="false">✎ 候选</button>' +
          '<button type="button" class="ms6-clear" aria-label="清除选中格">清除</button>' +
        '</div>' +
      '</div>' +
      '<div class="ms6-modal" hidden role="dialog" aria-modal="true" aria-labelledby="ms6-modal-title">' +
        '<div class="ms6-modal-card">' +
          '<h3 id="ms6-modal-title"></h3>' +
          '<p class="ms6-modal-stats"></p>' +
          '<label class="ms6-name-field">昵称（可选）' +
            '<input type="text" maxlength="12" placeholder="匿名" aria-label="昵称">' +
          '</label>' +
          '<div class="ms6-modal-actions">' +
            '<button type="button" class="ms6-save">保存成绩</button>' +
            '<button type="button" class="ms6-again">再来一局</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    this.el = {
      select: h.querySelector(".ms6-diff select"),
      timer: h.querySelector(".ms6-timer"),
      err: h.querySelector(".ms6-err"),
      newBtn: h.querySelector(".ms6-new"),
      grid: h.querySelector(".ms6-grid"),
      numpad: h.querySelector(".ms6-numpad"),
      pencilBtn: h.querySelector(".ms6-pencil"),
      clearBtn: h.querySelector(".ms6-clear"),
      modal: h.querySelector(".ms6-modal"),
      modalTitle: h.querySelector("#ms6-modal-title"),
      modalStats: h.querySelector(".ms6-modal-stats"),
      nameInput: h.querySelector(".ms6-name-field input"),
      saveBtn: h.querySelector(".ms6-save"),
      againBtn: h.querySelector(".ms6-again")
    };

    this.el.select.addEventListener("change", (function () {
      this.difficulty = this.el.select.value;
      this.newGame();
    }).bind(this));

    this.el.newBtn.addEventListener("click", (function () {
      this.newGame();
    }).bind(this));

    this.el.pencilBtn.addEventListener("click", (function () {
      this.pencil = !this.pencil;
      this.el.pencilBtn.classList.toggle("is-on", this.pencil);
      this.el.pencilBtn.setAttribute("aria-pressed", this.pencil ? "true" : "false");
    }).bind(this));

    this.el.clearBtn.addEventListener("click", (function () {
      if (this.selR < 0) return;
      this.clearCell(this.selR, this.selC);
    }).bind(this));

    this.el.saveBtn.addEventListener("click", (function () {
      this.saveScore();
    }).bind(this));

    this.el.againBtn.addEventListener("click", (function () {
      this.el.modal.hidden = true;
      this.newGame();
    }).bind(this));

    this.el.modal.addEventListener("click", (function (e) {
      if (e.target === this.el.modal) {
        this.el.modal.hidden = true;
        this.newGame();
      }
    }).bind(this));

    // 键盘支持
    document.addEventListener("keydown", (function (e) {
      if (this.el.modal.hidden === false) return;
      var k = e.key;
      if (k >= "1" && k <= "6") {
        e.preventDefault();
        this.inputNumber(parseInt(k, 10));
      } else if (k === "Backspace" || k === "Delete") {
        if (this.selR >= 0) { e.preventDefault(); this.clearCell(this.selR, this.selC); }
      } else if (k === "p" || k === "P") {
        this.el.pencilBtn.click();
      } else if (k.indexOf("Arrow") === 0) {
        e.preventDefault();
        this.moveSelection(k);
      }
    }).bind(this));

    this.buildGrid();
    this.buildNumpad();
  };

  Game.prototype.buildGrid = function () {
    var frag = document.createDocumentFragment();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ms6-cell";
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", "第" + (r + 1) + "行第" + (c + 1) + "列");
        cell.setAttribute("data-r", r);
        cell.setAttribute("data-c", c);
        (function (rr, cc, el) {
          el.addEventListener("click", function () {
            this.select(rr, cc);
          }.bind(this));
        }).call(this, r, c, cell);
        frag.appendChild(cell);
      }
    }
    this.el.grid.appendChild(frag);
  };

  Game.prototype.buildNumpad = function () {
    var frag = document.createDocumentFragment();
    for (var v = 1; v <= SIZE; v++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ms6-num";
      b.textContent = v;
      b.setAttribute("aria-label", "数字 " + v);
      (function (n) {
        b.addEventListener("click", function () {
          this.inputNumber(n);
        }.bind(this));
      }).call(this, v);
      frag.appendChild(b);
    }
    this.el.numpad.appendChild(frag);
  };

  Game.prototype.newGame = function () {
    this.stopTimer();
    var gen = generate(this.difficulty);
    this.puzzle = gen.puzzle;
    this.solution = gen.solution;
    this.board = emptyGrid();
    this.candidates = new Array(SIZE);
    for (var r = 0; r < SIZE; r++) {
      this.candidates[r] = new Array(SIZE);
      for (var c = 0; c < SIZE; c++) {
        this.candidates[r][c] = {};
        if (this.puzzle[r][c] !== 0) this.board[r][c] = this.puzzle[r][c];
      }
    }
    this.selR = -1;
    this.selC = -1;
    this.errors = 0;
    this.seconds = 0;
    this.over = false;
    this.won = false;
    this.startedAt = null;
    this.el.select.value = this.difficulty;
    this.el.modal.hidden = true;
    this.el.err.textContent = "✗ 0/" + DIFF[this.difficulty].maxErrors;
    this.el.timer.textContent = "⏱ 00:00";
    this.render();
  };

  Game.prototype.stopTimer = function () {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  };

  Game.prototype.startTimer = function () {
    if (this.timerId || this.won) return;
    var self = this;
    this.timerId = setInterval(function () {
      self.seconds++;
      self.el.timer.textContent = "⏱ " + fmtTime(self.seconds);
    }, 1000);
  };

  Game.prototype.select = function (r, c) {
    this.selR = r;
    this.selC = c;
    this.render();
  };

  Game.prototype.moveSelection = function (key) {
    if (this.selR < 0) { this.select(0, 0); return; }
    var r = this.selR, c = this.selC;
    if (key === "ArrowUp") r = (r + SIZE - 1) % SIZE;
    else if (key === "ArrowDown") r = (r + 1) % SIZE;
    else if (key === "ArrowLeft") c = (c + SIZE - 1) % SIZE;
    else if (key === "ArrowRight") c = (c + 1) % SIZE;
    this.select(r, c);
  };

  Game.prototype.isGiven = function (r, c) {
    return this.puzzle[r][c] !== 0;
  };

  Game.prototype.clearCell = function (r, c) {
    if (this.over || this.isGiven(r, c)) return;
    this.board[r][c] = 0;
    this.candidates[r][c] = {};
    this.render();
  };

  Game.prototype.inputNumber = function (v) {
    if (this.over || this.selR < 0) return;
    var r = this.selR, c = this.selC;
    if (this.isGiven(r, c)) return;
    this.startTimer();

    if (this.pencil) {
      var cand = this.candidates[r][c];
      if (this.board[r][c] !== 0) this.board[r][c] = 0;
      cand[v] = !cand[v];
      this.render();
      return;
    }

    if (this.board[r][c] === v) {
      this.board[r][c] = 0;
      this.render();
      return;
    }

    this.board[r][c] = v;
    this.candidates[r][c] = {};

    if (v !== this.solution[r][c]) {
      this.errors++;
      this.el.err.textContent = "✗ " + this.errors + "/" + DIFF[this.difficulty].maxErrors;
      if (this.errors >= DIFF[this.difficulty].maxErrors) {
        this.finish(false);
        return;
      }
    }
    this.render();
    if (this.isSolved()) this.finish(true);
  };

  Game.prototype.isSolved = function () {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (this.board[r][c] !== this.solution[r][c]) return false;
      }
    }
    return true;
  };

  Game.prototype.finish = function (won) {
    this.over = true;
    this.won = won;
    this.stopTimer();
    this.render();
    var title = won ? "🎉 完成！" : "❌ 本局结束";
    var stats = won
      ? "用时 " + fmtTime(this.seconds) + "，错误 " + this.errors + " 次"
      : "错误次数达到上限。用时 " + fmtTime(this.seconds) + "。";
    this.el.modalTitle.textContent = title;
    this.el.modalStats.textContent = stats;
    this.el.nameInput.value = "";
    if (won) {
      this.el.nameInput.parentElement.style.display = "";
      this.el.saveBtn.style.display = "";
    } else {
      this.el.nameInput.parentElement.style.display = "none";
      this.el.saveBtn.style.display = "none";
    }
    this.el.modal.hidden = false;
    this.el.nameInput.focus();
  };

  Game.prototype.saveScore = function () {
    if (!this.won) return;
    var name = (this.el.nameInput.value || "").trim() || "匿名";
    addScore(this.difficulty, {
      name: name,
      time: this.seconds,
      errors: this.errors,
      date: new Date().toISOString().slice(0, 10)
    });
    this.el.saveBtn.style.display = "none";
    this.el.nameInput.parentElement.style.display = "none";
    this.el.modalTitle.textContent = "🎉 已保存";
    this.el.modalStats.textContent = "你的成绩已写入本地排行榜。";
  };

  Game.prototype.render = function () {
    var cells = this.el.grid.children;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = cells[r * SIZE + c];
        var val = this.board[r][c];
        var given = this.isGiven(r, c);
        var wrong = val !== 0 && val !== this.solution[r][c];

        cell.textContent = "";
        cell.className = "ms6-cell";
        if (given) cell.classList.add("is-given");
        if (this.selR === r && this.selC === c) cell.classList.add("is-sel");
        if (wrong) cell.classList.add("is-wrong");
        if (this.selR >= 0 && val !== 0 && val === this.board[this.selR][this.selC] && !(this.selR === r && this.selC === c)) {
          cell.classList.add("is-peer");
        }
        if (val !== 0) {
          cell.textContent = val;
        } else {
          var cand = this.candidates[r][c];
          var nums = [];
          for (var v = 1; v <= SIZE; v++) if (cand[v]) nums.push(v);
          if (nums.length) {
            cell.innerHTML = this.candidateHTML(nums);
          }
        }
      }
    }
    this.el.pencilBtn.classList.toggle("is-on", this.pencil);
    this.el.pencilBtn.setAttribute("aria-pressed", this.pencil ? "true" : "false");
  };

  Game.prototype.candidateHTML = function (nums) {
    var html = '<span class="ms6-cand">';
    for (var v = 1; v <= SIZE; v++) {
      html += '<span class="ms6-cand-n' + (nums.indexOf(v) >= 0 ? " on" : "") + '">' + v + "</span>";
    }
    return html + "</span>";
  };

  /* ---------- 启动 ---------- */

  function initAll() {
    var hosts = document.querySelectorAll("[data-ms6-game]");
    for (var i = 0; i < hosts.length; i++) {
      new Game(hosts[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // 导出用于打印页复用
  window.MS6 = {
    generate: generate,
    generateSeeded: generateSeeded,
    DIFF: DIFF,
    countSolutions: countSolutions,
    addScore: addScore,
    loadLeaderboard: loadLeaderboard
  };
})();
