/* =====================================================
   はたらくくるま 共通の部品：くるまの順番と、基本の動き（Kuruma.stage）
   ・くるまの順番（order：最後のあとは最初に戻る。randomOrder：袋からランダムに出す）
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

  // ===== くるまの順番（ランダム。袋方式） =====
  //   list    … 図鑑の名前の一覧
  //   colorOf … colorOf(id) で、そのくるまの主な色の組を返す関数（例：図鑑の color）
  //   rand    … ランダムのもと（0 以上 1 未満の数を返す関数。省略か関数でないときは Math.random）。
  //             決まった数の並びを渡すと、同じ順番になる（テスト用）
  // 一覧の全部のくるまを袋に入れてまぜ、1台ずつ出す。出しきったら、また袋を作る。
  //   ・同じくるまが続かない（袋の変わり目でも）
  //   ・となり合うくるまの色の組が、できるだけ かぶらない。
  //     まぜた並びを TRIES 回ためして、かぶりの点数がいちばん小さいものを使う（0 点が出たら、そこでやめる）。
  //     どうしても かぶるときも、いちばん少ない並びで進む（止まらない）
  // 返すもの：order() と同じ形 { current(), next() }
  var TRIES = 200;           // 1つの袋を作るとき、まぜる回数の上限

  function randomOrder(list, colorOf, rand) {
    var items = list.slice();
    var pick = (typeof rand === "function") ? rand : Math.random;
    var colorFn = (typeof colorOf === "function") ? colorOf : function (id) { return id; };
    var last = null;         // いま出ているくるま
    var queue = [];          // この袋の、まだ出ていないくるま

    // まぜる（フィッシャー–イェーツ）。元の並びは変えない
    function shuffle(arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(pick() * (i + 1));
        if (j > i) j = i;    // rand が 1 を返してしまっても、はみ出さない
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }

    // 並び seq を、前のくるま prev のあとに出したときの「かぶりの点数」
    function cost(seq, prev) {
      var c = 0;
      if (seq.length === 0) return 0;
      if (prev !== null) {
        if (seq[0] === prev) c += 1000;                          // 同じくるまが続く（いちばん悪い）
        else if (colorFn(seq[0]) === colorFn(prev)) c += 1;      // 袋の変わり目で、色がかぶる
      }
      for (var i = 1; i < seq.length; i++) {
        if (colorFn(seq[i]) === colorFn(seq[i - 1])) c += 1;     // 袋の中で、色がかぶる
      }
      return c;
    }

    // 新しい袋を作る
    function refill() {
      var best = [];
      var bestCost = Infinity;
      for (var t = 0; t < TRIES; t++) {
        var s = shuffle(items);
        var c = cost(s, last);
        if (c < bestCost) { best = s; bestCost = c; }
        if (c === 0) break;
      }
      // 念のため：先頭が前のくるまと同じままなら（2台以上のとき）、先頭と、2番目以降のどれかを入れかえる。
      // 入れかえたあとの点数がいちばん小さいものを選ぶ（同じ点数なら、小さい添字）
      if (items.length > 1 && last !== null && best[0] === last) {
        var pickIndex = 1;
        var pickCost = Infinity;
        for (var k = 1; k < best.length; k++) {
          var trial = best.slice();
          var tmp = trial[0]; trial[0] = trial[k]; trial[k] = tmp;
          var tc = cost(trial, last);
          if (tc < pickCost) { pickIndex = k; pickCost = tc; }
        }
        var swap = best[0]; best[0] = best[pickIndex]; best[pickIndex] = swap;
      }
      queue = best;
    }

    refill();
    last = queue.shift();

    return {
      current: function () { return last; },
      next: function () {
        if (queue.length === 0) refill();
        last = queue.shift();
        return last;
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
    randomOrder: randomOrder,
    mover: mover,
    timeFor: timeFor,
    exitX: exitX,
    enterX: enterX,
    waiter: waiter,
    hopper: hopper,
    confetti: confetti
  };
})();
