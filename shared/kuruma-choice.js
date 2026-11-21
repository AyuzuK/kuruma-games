/* =====================================================
   はたらくくるま 共通の部品：3択の仕組み（Kuruma.choice）
   ・問題の作り方：袋から取り出す順番（bag）、正解と まちがいの くるまの選び方（pick）、正解の場所（places）
   ・やさしい間違い：首をかしげる（wrong）。「ぽよん」も鳴る
   ・そっと教える光（glow）。点滅させない（transition で明るくするだけ）
   ・えらんでね（nudge）：3台が左から順に、小さく1回ずつ はねる
   ・正解の合図（celebrate）：「ピポピン♪」と紙ふぶき
   bag・pick・places は、ランダムのもとの関数（rand。ふだんは Math.random）を引数で渡せる。
   決まった数の並びを渡せば、同じ結果になる（単体で確かめられる）。
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  // ----- 設定 -----
  var HINT_AFTER = 2;      // 何回まちがえたら、正解を光で教えるか
  var WRONG_TIME = 600;    // 首をかしげている時間（ミリ秒）。CSS の 0.6s と同じ
  var NUDGE_STEP = 0.12;   // えらんでね：となりの台とのはね始めのずれ（秒）

  // ===== ランダムの小さな道具 =====
  function useRand(rand) {
    return typeof rand === "function" ? rand : Math.random;
  }
  // 0 以上 n 未満の整数をひとつ（rand が 1 を返しても、はみ出さない）
  function randInt(rand, n) {
    var i = Math.floor(rand() * n);
    if (i >= n) i = n - 1;
    if (i < 0) i = 0;
    return i;
  }
  // 並びをまぜた、新しい配列を返す（もとの配列は変えない）
  function shuffle(list, rand) {
    rand = useRand(rand);
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(rand, i + 1);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ===== ① 正解の順番：袋から取り出す =====
  //   list … 図鑑の名前の一覧（9台）
  // 返すもの：{ next() }。next() で1台ずつ取り出す。出しきったら、また まぜて入れ直す。
  // 入れ直したときの最初の1台が、前の袋の最後の1台と同じなら、入れかえる（袋の変わり目でも続かない）
  function bag(list, rand) {
    rand = useRand(rand);
    var items = [];
    var last = null;
    function refill() {
      items = shuffle(list, rand);
      if (items.length > 1 && items[0] === last) {
        var j = 1 + randInt(rand, items.length - 1);
        var t = items[0];
        items[0] = items[j];
        items[j] = t;
      }
    }
    return {
      next: function () {
        if (items.length === 0) refill();
        last = items.shift();
        return last;
      }
    };
  }

  // ===== ② 正解と、まちがいの くるまを選ぶ =====
  //   answer  … 正解の図鑑の名前
  //   pool    … 選んでよい くるまの一覧（正解をふくんでよい）
  //   ngPairs … 同じ3択に入れない組み合わせ（例：[["dump", "garbage"], …]）
  //   count   … 3択なら 3（正解をふくむ台数）
  //   prevSet … 前の問題の組（図鑑の名前の配列）。それと同じ組にしない。1問目は null（省略可）
  //   rand    … ランダムのもと
  //   seen    … 省略できる。最近の問題に出た回数（{ 図鑑の名前: 回数 }）。あまり出ていない くるまを、まちがいに選びやすくする
  //             （同じ くるまが まちがいに出つづけて、「このくるまは いつも まちがい」と おぼえられないように）
  // 返すもの：[正解, まちがい, まちがい]（count 台）。作れないときは null。
  // どの2台も ngPairs にならない。前の組を部品の中に覚えておかない（同じ引数なら、同じ結果になる）
  function pick(answer, pool, ngPairs, count, prevSet, rand, seen) {
    rand = useRand(rand);
    count = count || 3;
    var ng = {};
    ngPairs = ngPairs || [];
    for (var p = 0; p < ngPairs.length; p++) {
      ng[ngPairs[p][0] + "|" + ngPairs[p][1]] = true;
      ng[ngPairs[p][1] + "|" + ngPairs[p][0]] = true;
    }
    function bad(a, b) { return !!ng[a + "|" + b]; }

    // 正解と組にできる くるま
    var cand = [];
    for (var i = 0; i < pool.length; i++) {
      if (pool[i] !== answer && !bad(answer, pool[i])) cand.push(pool[i]);
    }

    // まちがいの くるま（count − 1 台）の組み合わせを、すべて数え上げる（どの2台も ngPairs にならないもの）
    var need = count - 1;
    var combos = [];
    (function walk(start, chosen) {
      if (chosen.length === need) {
        combos.push(chosen.slice());
        return;
      }
      for (var k = start; k < cand.length; k++) {
        var ok = true;
        for (var c = 0; c < chosen.length; c++) {
          if (bad(chosen[c], cand[k])) { ok = false; break; }
        }
        if (!ok) continue;
        chosen.push(cand[k]);
        walk(k + 1, chosen);
        chosen.pop();
      }
    })(0, []);
    if (combos.length === 0) return null;

    // 前の問題と まったく同じ3台の組は、はずす（ほかに選べるものが あるとき）
    var fresh = combos;
    if (prevSet && combos.length > 1) {
      var prevKey = prevSet.slice().sort().join("|");
      fresh = [];
      for (var f = 0; f < combos.length; f++) {
        if ([answer].concat(combos[f]).sort().join("|") !== prevKey) fresh.push(combos[f]);
      }
      if (fresh.length === 0) fresh = combos;
    }
    if (seen) {
      // 最近 たくさん出た くるまを ふくむ組ほど、選ばれにくくする（重み = 1 ÷ (1 + 回数の合計)⁴）
      var weights = [];
      var total = 0;
      for (var w = 0; w < fresh.length; w++) {
        var sum = 0;
        for (var m = 0; m < fresh[w].length; m++) sum += seen[fresh[w][m]] || 0;
        var weight = 1 / Math.pow(1 + sum, 4);
        weights.push(weight);
        total += weight;
      }
      var r = rand() * total;
      for (var x = 0; x < fresh.length; x++) {
        r -= weights[x];
        if (r < 0) return [answer].concat(fresh[x]);
      }
      return [answer].concat(fresh[fresh.length - 1]);
    }
    return [answer].concat(fresh[randInt(rand, fresh.length)]);
  }

  // ===== ③ 正解の場所（0 = 左、1 = まん中、2 = 右） =====
  //   count … 場所の数（省略で 3）
  // 返すもの：{ next() }。3回続けて同じ場所にはしない（2回までは続いてよい）
  function places(rand, count) {
    rand = useRand(rand);
    count = count || 3;
    var prev = -1;
    var prev2 = -1;
    return {
      next: function () {
        var allowed = [];
        for (var i = 0; i < count; i++) {
          if (i === prev && i === prev2) continue;   // 3回目になる場所は、はずす
          allowed.push(i);
        }
        var place = allowed[randInt(rand, allowed.length)];
        prev2 = prev;
        prev = place;
        return place;
      }
    };
  }

  // ===== やさしい間違い：首をかしげる =====
  //   el … 首をかしげる箱（くるまの絵を入れた、transform-origin が下のまん中の箱）
  // 印（kuruma-wrong）を付け直して、0.6秒の動きを最初からやり直す。印を外す 0.6秒のタイマーは、
  // 要素ごとに持つ（ちがうくるまを続けてさわっても、前のくるまの印が外れなくならないように）。
  // 返すもの：まちがえた回数に数えてよいか。呼ばれたとき、その要素が まだゆれている途中なら false
  function wrong(el) {
    var counted = !el.classList.contains("kuruma-wrong");
    clearTimeout(el._kurumaWrongTimer);
    el.classList.remove("kuruma-wrong");
    void el.offsetWidth;                 // ブラウザに一度反映させる（やり直せるように）
    el.classList.add("kuruma-wrong");
    el._kurumaWrongTimer = setTimeout(function () {
      el.classList.remove("kuruma-wrong");
    }, WRONG_TIME);
    if (Kuruma.sound) Kuruma.sound.playPoyon();
    return counted;
  }

  // ===== そっと教える光 =====
  //   frame … 大きさの箱（横 310 × 縦 220 の枠。くるまの絵の うしろに光を入れる）
  //   width … くるまの絵の横幅
  // うすい黄色の だ円を、くるまの うしろに置いて、transition でゆっくり明るくする（そのまま光る）。
  // 付いていれば何もしない（付け直さないので、点滅しない）。
  function glow(frame, width) {
    if (frame.querySelector(".kuruma-glow")) return;
    var el = document.createElement("div");
    el.className = "kuruma-glow";
    el.setAttribute("aria-hidden", "true");
    var w = width * 1.1;                        // 横 ＝ くるまの横幅の 1.1倍
    el.style.width = w + "px";
    el.style.height = "176px";                  // 縦 ＝ 220 × 0.8
    el.style.left = (155 - w / 2) + "px";       // 中心は (155, 127)
    el.style.top = "39px";
    frame.insertBefore(el, frame.firstChild);   // くるまより奥
    void el.offsetWidth;                        // 暗い状態を一度反映させてから、明るくする
    el.classList.add("on");
  }
  function clearGlow(frame) {
    var el = frame.querySelector(".kuruma-glow");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ===== えらんでね =====
  //   els … はねる箱（左から順に）。「ぴょん」（hop）とは別の専用の印（kuruma-nudge）を付ける。
  // ずらす時間は、専用の印の中だけで効く（CSS の変数 --nudge-delay）ので、「ぴょん」には遅れが付かない。
  // 途中で呼ばれたら、最初からやり直す。はね終わったら、印と変数を外す
  function bindNudgeEnd(el) {
    if (el._kurumaNudgeBound) return;
    el._kurumaNudgeBound = true;
    el.addEventListener("animationend", function (e) {
      if (e.target !== el || e.animationName !== "kuruma-nudge-hop") return;
      el.classList.remove("kuruma-nudge");
      el.style.removeProperty("--nudge-delay");
    });
  }
  function nudge(els) {
    var i;
    for (i = 0; i < els.length; i++) els[i].classList.remove("kuruma-nudge");
    if (els.length) void els[0].offsetWidth;
    for (i = 0; i < els.length; i++) {
      bindNudgeEnd(els[i]);
      els[i].style.setProperty("--nudge-delay", (i * NUDGE_STEP).toFixed(2) + "s");
      els[i].classList.add("kuruma-nudge");
    }
  }
  // 残っている えらんでね の印を、すぐに外す（選んだあとに、ほかの台が遅れて はねないように）
  function stopNudge(els) {
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove("kuruma-nudge");
      els[i].style.removeProperty("--nudge-delay");
    }
  }

  // ===== 正解の合図：「ピポピン♪」と紙ふぶき =====
  // 跳ぶ・重なる・走りさる動きは、ゲームの側で作る
  function celebrate() {
    if (Kuruma.sound) Kuruma.sound.playCorrect();
    if (Kuruma.stage) Kuruma.stage.confetti();
  }

  // ===== 見た目（このファイルが <style> を1回だけ足す。kuruma-base.css は変えない） =====
  var CSS =
    /* 首をかしげる：上へ 6px、左へ 8度 → 右へ 6度 → もと。回る中心は、下のまん中 */
    ".kuruma-wrong { transform-origin: 50% 100%; animation: kuruma-wrong-tilt 0.6s ease-in-out; }\n" +
    "@keyframes kuruma-wrong-tilt {\n" +
    "  0%   { transform: translateY(0)    rotate(0deg); }\n" +
    "  30%  { transform: translateY(-6px) rotate(-8deg); }\n" +
    "  65%  { transform: translateY(-3px) rotate(6deg); }\n" +
    "  100% { transform: translateY(0)    rotate(0deg); }\n" +
    "}\n" +
    /* そっと教える光：ふだんは見えない。.on が付くと 0.8秒でゆっくり明るくなって、そのまま。@keyframes は使わない */
    ".kuruma-glow { position: absolute; border-radius: 50%; pointer-events: none; opacity: 0;\n" +
    "  transition: opacity 0.8s ease-out;\n" +
    "  background: radial-gradient(closest-side, rgba(255, 236, 140, 0.9) 0%, rgba(255, 236, 140, 0.75) 60%, rgba(255, 236, 140, 0) 100%); }\n" +
    ".kuruma-glow.on { opacity: 1; }\n" +
    /* えらんでね：「ぴょん」と同じ動き（0.3秒、上へ 12px）。はね始めを --nudge-delay だけ遅らせる */
    ".kuruma-hop.kuruma-nudge { animation: kuruma-nudge-hop 0.3s ease-out var(--nudge-delay, 0s); }\n" +
    "@keyframes kuruma-nudge-hop {\n" +
    "  0%   { transform: translateY(0); }\n" +
    "  40%  { transform: translateY(-12px); }\n" +
    "  100% { transform: translateY(0); }\n" +
    "}\n" +
    /* 動きを減らす設定では、光は transition なしで、光った形をすぐに出す。
       首をかしげる・えらんでね は、さわったことへの小さな返事なので残す */
    "@media (prefers-reduced-motion: reduce) {\n" +
    "  .kuruma-glow { transition: none; }\n" +
    "}\n";
  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  Kuruma.choice = {
    HINT_AFTER: HINT_AFTER,
    WRONG_TIME: WRONG_TIME,
    NUDGE_STEP: NUDGE_STEP,
    shuffle: shuffle,
    bag: bag,
    pick: pick,
    places: places,
    wrong: wrong,
    glow: glow,
    clearGlow: clearGlow,
    nudge: nudge,
    stopNudge: stopNudge,
    celebrate: celebrate
  };
})();
