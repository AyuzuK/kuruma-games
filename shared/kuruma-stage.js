/* =====================================================
   はたらくくるま 共通の部品：くるまの順番と、基本の動き（Kuruma.stage）
   ・くるまの順番（最後のあとは最初に戻る）
   ・位置へ動かす（transition で translateX。動くあいだ .moving が付いて、タイヤが回る）
   ・走りさる先（右の外 +20px）と、入ってくる元（左の外：くるまの横幅 + 20px 外）、速さの計算
   ・ぷるぷる（さわらなくなってから 1.5秒）と、ぴょん（はねる）
   ・紙ふぶき（出して、落ちきったら消す）
   ゲームごとにちがう終わりの演出は、ゲームの側で作る。
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  // ----- 設定（1本目と同じ値） -----
  var START_X = 20;          // スタート地点（左からの距離 px）
  var MOVE_TIME = 600;       // ふつうの1歩にかかる時間（ミリ秒）
  var MAX_MOVE_TIME = 1500;  // 画面の外へ出る・入ってくる1回の移動の上限（ミリ秒）
  var WAIT_TIME = 1500;      // さわらなくなってから、ぷるぷるを始めるまでの時間（ミリ秒）
  var OUTSIDE = 20;          // 画面の外へ出るとき・外から入るときの、よぶんの距離（px）

  // 紙ふぶき
  var CONFETTI_COUNT = 24;   // 1回に落とす枚数
  var CONFETTI_COLORS = ["#f7c33c", "#f28ca6", "#76b0ea", "#82cf7c"]; // 黄・ピンク・水色・緑
  var CONFETTI_LIFE = 3200;  // 出してから消すまで（ミリ秒）。いちばん遅い1枚（0.5秒待って 2.5秒で落ちる）より長い

  // ===== くるまの順番 =====
  //   list … 図鑑の名前の一覧（例：["mixer", "dump", …]）
  // current() でいまのくるま、next() で次のくるまへ進めて、その名前を返す
  function order(list) {
    var i = 0;
    return {
      current: function () { return list[i]; },
      next: function () {
        i = (i + 1) % list.length;
        return list[i];
      }
    };
  }

  // ===== 位置へ動かす =====
  //   el … 位置を受け持つ箱（左右に動く）
  // 返すもの：{ x: いまの位置（動いている途中なら行き先）, moveTo(newX, duration) }
  // duration が 0 のときは、アニメーションなしで一瞬で移す
  function mover(el) {
    var movingTimer = null;
    var m = {
      x: 0,
      moveTo: function (newX, duration) {
        m.x = newX;
        if (!duration) {
          clearTimeout(movingTimer);      // 動いている途中なら、タイヤ・車輪も止める
          el.classList.remove("moving");
          el.style.transition = "none";
          el.style.transform = "translateX(" + newX + "px)";
          void el.offsetWidth;            // ブラウザに一度反映させる（次の移動がアニメーションになるように）
          return;
        }
        el.style.transition = "transform " + duration + "ms ease-out";
        el.style.transform = "translateX(" + newX + "px)";
        // 動いているあいだだけ、タイヤ・車輪を回す（duration ミリ秒たったら止める）
        el.classList.add("moving");
        clearTimeout(movingTimer);
        movingTimer = setTimeout(function () {
          el.classList.remove("moving");
        }, duration);
      }
    };
    return m;
  }

  // distance ピクセル動くのにかける時間（ミリ秒）。
  // ふつうの1歩（step）と同じ速さになるように、距離に比例させる（ただし上限 1.5秒）
  function timeFor(distance, step) {
    return Math.min(MAX_MOVE_TIME, MOVE_TIME * distance / step);
  }

  // 走りさる先（右の画面の外）
  function exitX() {
    return window.innerWidth + OUTSIDE;
  }

  // 入ってくる元（左の画面の外）。carWidth … いまの見た目のくるまの横幅
  function enterX(carWidth) {
    return -carWidth - OUTSIDE;
  }

  // ===== ぷるぷる =====
  //   el … .waiting を付ける箱（この中の .kuruma-wobble が ゆれる。見た目は kuruma-base.css）
  // later(delay) で、delay ミリ秒（省略で 1.5秒）たったら始める。stop() で止める
  function waiter(el) {
    var timer = null;
    return {
      later: function (delay) {
        clearTimeout(timer);
        timer = setTimeout(function () {
          el.classList.add("waiting");
        }, delay === undefined ? WAIT_TIME : delay);
      },
      stop: function () {
        clearTimeout(timer);
        el.classList.remove("waiting");
      }
    };
  }

  // ===== ぴょん =====
  //   el … はねる箱（.kuruma-hop）
  // hop() で1回はねる。連打しても、毎回 最初からはね直す。
  // くるまが画面の外にいても、印の付け直しは必ず行う（さわったことが、ページの変化として残るように）
  function hopper(el) {
    // はね終わったら印を外す（外さなくても元の高さに戻るが、見分けやすいように）
    el.addEventListener("animationend", function (e) {
      if (e.target === el) el.classList.remove("hop");
    });
    return {
      hop: function () {
        el.classList.remove("hop");
        void el.offsetWidth;             // ブラウザに一度反映させる（やり直せるように）
        el.classList.add("hop");
      }
    };
  }

  // ===== 紙ふぶき =====
  // 画面の上から、小さな紙が ゆっくり回りながら落ちる（2〜3秒）。
  // 1回ぶんを1つのグループにまとめて、落ちきったらグループごと消す（何周しても増えつづけない）。
  // 動きを減らす設定のときは出さない
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var group = document.createElement("div");
    group.className = "kuruma-confetti";
    group.setAttribute("aria-hidden", "true");
    for (var i = 0; i < CONFETTI_COUNT; i++) {
      var piece = document.createElement("div");
      piece.className = "kuruma-confetti-piece" + (i % 3 === 0 ? " round" : "");
      // 横の位置は、画面を枚数で分けた中で少しずつずらす（かたよらないように）
      var left = (i + 0.2 + Math.random() * 0.6) / CONFETTI_COUNT * 100;
      piece.style.left = left.toFixed(1) + "%";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.setProperty("--fall", (2.0 + Math.random() * 0.5).toFixed(2) + "s");
      piece.style.setProperty("--delay", (Math.random() * 0.5).toFixed(2) + "s");
      var spin = 180 + Math.random() * 300;
      piece.style.setProperty("--spin", (Math.random() < 0.5 ? -spin : spin).toFixed(0) + "deg");
      var sway = 10 + Math.random() * 20;
      piece.style.setProperty("--sway", (Math.random() < 0.5 ? -sway : sway).toFixed(0) + "px");
      group.appendChild(piece);
    }
    document.body.appendChild(group);
    setTimeout(function () {
      if (group.parentNode) group.parentNode.removeChild(group);
    }, CONFETTI_LIFE);
  }

  Kuruma.stage = {
    START_X: START_X,
    MOVE_TIME: MOVE_TIME,
    MAX_MOVE_TIME: MAX_MOVE_TIME,
    WAIT_TIME: WAIT_TIME,
    order: order,
    mover: mover,
    timeFor: timeFor,
    exitX: exitX,
    enterX: enterX,
    waiter: waiter,
    hopper: hopper,
    confetti: confetti
  };
})();
