/* =====================================================
   はたらくくるま 共通の部品：くるまの図鑑（Kuruma.cars）
   くるまごとに、次のことを書いておく。
     id      … 図鑑の名前（mixer など）
     name    … ひらがなの名前
     width   … 絵の横幅（縦はどのくるまも 220。タイヤ・キャタピラの下は y 215）
     tip     … 指マークの指先を置く場所（絵の中の x, y）
     draw    … 絵（SVG）を作る関数
     workTime… 仕事の動きの長さ（ミリ秒）
     lamp    … true なら、仕事の動きのときにランプが光る（光り方は下の lampOn）
     css     … 仕事の動きの CSS（このファイルが <style> を1つだけページに足して、そこに入れる）
     sound   … 仕事の音（Kuruma.sound の部品で作る）

   絵の決まり：
   ・部品ごとに <g data-part="…"> に分ける。data-part は入れ子にしない
   ・動かすためだけの <g> には data-part を付けず、class を付ける
   ・回る部品は、回る中心へ translate した <g> の中で、中心を (0, 0) にして描き、
     その中の class の <g> を回す（iPhone の Safari で回る中心がずれないように）
   ・部品のふちどりは、その部品の中に持たせる（ほかの部品をかくしても線が途切れない）
   ・clipPath は使う部品の中に置き、id は作るたびにちがう名前にする
   ・ロゴ・文字・顔は描かない
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  var HEIGHT = 220;            // どのくるまも、絵の縦は 220
  var LINE = "#5a3d1e";        // ふちどりの色（こげ茶）

  // ランプの光り方（A-2 のしょうぼうしゃ・きゅうきゅうしゃ・パトカーで使う）
  var LAMP_RISE = 300;         // ゆっくり明るくなる（ミリ秒）。CSS の transition と同じ
  var LAMP_HOLD = 300;         // 光ったままでいる（ミリ秒）
  var LAMP_FADE = 500;         // ゆっくり元に戻る（ミリ秒）。CSS の transition と同じ

  // =====================================================
  // 絵を作るための小さな部品
  // =====================================================

  // 部品の <g>。ふちどりの線の決まり（色・太さ・角の丸さ）を、部品ごとに持たせる
  function part(name, inner) {
    return '<g data-part="' + name + '" stroke="' + LINE + '" stroke-width="3" ' +
      'stroke-linejoin="round" stroke-linecap="round">' + inner + '</g>';
  }

  // 地面の影（くるまの本体ではないので、専用の部品 shadow にする）
  function shadow(cx, rx) {
    return '<g data-part="shadow"><ellipse cx="' + cx + '" cy="214" rx="' + rx +
      '" ry="5" fill="' + LINE + '" opacity="0.25"/></g>';
  }

  // タイヤ1つ（下のはしが y 215。回る中心を (0, 0) にして、.spin を回す）
  //   r … 半径（省略で 22。しょうぼうしゃ・きゅうきゅうしゃ・パトカーは 23）
  function tire(cx, r) {
    r = r || 22;
    return part("tire",
      '<g transform="translate(' + cx + ' ' + (215 - r) + ')"><g class="spin">' +
        '<circle r="' + r + '" fill="#4a4a4a"/>' +
        '<circle r="12" fill="#c8ccd0" stroke-width="2.5"/>' +
        // まん中の点と、回っているのが見えるボルト3つ
        '<g fill="#8a8a8a" stroke="none">' +
          '<circle r="3.5"/>' +
          '<circle cx="0" cy="-8" r="1.8"/>' +
          '<circle cx="6.9" cy="4" r="1.8"/>' +
          '<circle cx="-6.9" cy="4" r="1.8"/>' +
        '</g>' +
      '</g></g>');
  }

  // 前のライト（丸）と、うしろの小さな赤いランプ（光らせない、色だけ）
  function lights(fx, fy, rx, ry) {
    return part("light",
      '<circle cx="' + fx + '" cy="' + fy + '" r="5.5" fill="#fff3c4" stroke-width="2"/>' +
      '<rect x="' + rx + '" y="' + ry + '" width="6" height="10" rx="2" fill="#e86a5a" stroke-width="2"/>');
  }

  // トラックの運転席（右向き。窓1枚）。x0〜x1、y0〜y1 の箱に入る形
  //   c … 色 { main: ふだんの色, light: 明るいところ, shade: 影 }
  function cab(x0, x1, y0, y1, c) {
    var shape =
      "M " + x0 + " " + y1 + " L " + x0 + " " + (y0 + 12) +
      " Q " + x0 + " " + y0 + " " + (x0 + 12) + " " + y0 +
      " L " + (x1 - 26) + " " + y0 +
      " Q " + (x1 - 16) + " " + y0 + " " + (x1 - 13) + " " + (y0 + 10) +
      " L " + (x1 - 2) + " " + (y0 + 40) +
      " Q " + x1 + " " + (y0 + 46) + " " + x1 + " " + (y0 + 54) +
      " L " + x1 + " " + (y1 - 8) +
      " Q " + x1 + " " + y1 + " " + (x1 - 8) + " " + y1 + " Z";
    var win =
      "M " + (x0 + 10) + " " + (y0 + 18) +
      " Q " + (x0 + 10) + " " + (y0 + 12) + " " + (x0 + 16) + " " + (y0 + 12) +
      " L " + (x1 - 27) + " " + (y0 + 12) +
      " Q " + (x1 - 21) + " " + (y0 + 12) + " " + (x1 - 19) + " " + (y0 + 18) +
      " L " + (x1 - 11) + " " + (y0 + 41) +
      " Q " + (x1 - 10) + " " + (y0 + 46) + " " + (x1 - 15) + " " + (y0 + 46) +
      " L " + (x0 + 14) + " " + (y0 + 46) +
      " Q " + (x0 + 10) + " " + (y0 + 46) + " " + (x0 + 10) + " " + (y0 + 42) + " Z";
    return part("cab",
      // 塗り → 明るいところ（屋根の内がわ）→ 影（下）→ ふちどり の順に重ねる
      '<path d="' + shape + '" fill="' + c.main + '" stroke="none"/>' +
      '<path d="M ' + (x0 + 7) + ' ' + (y0 + 18) + ' Q ' + (x0 + 7) + ' ' + (y0 + 7) + ' ' + (x0 + 16) + ' ' + (y0 + 7) +
        ' L ' + (x1 - 28) + ' ' + (y0 + 7) + '" fill="none" stroke="' + c.light + '" stroke-width="5"/>' +
      '<path d="M ' + (x0 + 7) + ' ' + (y1 - 7) + ' L ' + (x1 - 8) + ' ' + (y1 - 7) +
        '" fill="none" stroke="' + c.shade + '" stroke-width="7"/>' +
      '<path d="' + shape + '" fill="none"/>' +
      // 窓と、ガラスに見せる白いななめの線（運転席の中の人は描かない）
      '<path d="' + win + '" fill="#bfe4f5" stroke-width="2.5"/>' +
      '<g fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7">' +
        '<path d="M ' + (x0 + 20) + ' ' + (y0 + 40) + ' L ' + (x0 + 32) + ' ' + (y0 + 18) + '"/>' +
        '<path d="M ' + (x0 + 31) + ' ' + (y0 + 40) + ' L ' + (x0 + 43) + ' ' + (y0 + 18) + '"/>' +
      '</g>' +
      // ドアの取っ手と、前の面のさかい目
      '<rect x="' + (x0 + 12) + '" y="' + (y0 + 56) + '" width="13" height="4" rx="2" fill="' + LINE + '" stroke="none"/>' +
      '<path d="M ' + (x1 - 10) + ' ' + (y0 + 54) + ' L ' + (x1 - 10) + ' ' + (y1 - 12) + '" fill="none" stroke-width="1.5"/>');
  }

  // トラックの台（車体の下の灰色の台）と、前のバンパー
  function chassis(x0, x1) {
    var w = x1 - x0;
    return part("body",
      '<rect x="' + x0 + '" y="167" width="' + w + '" height="23" rx="7" fill="#8a8f96" stroke="none"/>' +
      '<path d="M ' + (x0 + 7) + ' 184 L ' + (x1 - 7) + ' 184" fill="none" stroke="#6e737a" stroke-width="5"/>' +
      '<rect x="' + x0 + '" y="167" width="' + w + '" height="23" rx="7" fill="none"/>' +
      '<rect x="' + (x1 - 4) + '" y="173" width="13" height="12" rx="4" fill="#c8ccd0"/>');
  }

  // ----- 屋根のランプと、まわりの光の輪（しょうぼうしゃ・きゅうきゅうしゃ・パトカー） -----
  // ランプ（lamp）：赤い丸＋上半分の白いハイライト＋明るい丸（.lit。ふだんは見えない）
  function lampPart(cx, cy, rx, ry) {
    return part("lamp",
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#ff4f4f"/>' +
      '<ellipse class="lit" cx="' + cx + '" cy="' + cy + '" rx="' + (rx - 2) + '" ry="' + (ry - 2) + '" fill="#ffd0c8" stroke="none"/>' +
      '<ellipse cx="' + cx + '" cy="' + (cy - ry * 0.45) + '" rx="' + (rx * 0.6) + '" ry="' + (ry * 0.3) + '" fill="#ffffff" opacity="0.5" stroke="none"/>');
  }
  // 光の輪（glow）：くるまの本体ではないので、専用の部品にする。うすい色の丸を2つ重ねる（グラデーションなし）
  function glowPart(cx, cy) {
    return '<g data-part="glow">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="32" fill="#ffc4bc" opacity="0.25"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="22" fill="#ff8a80" opacity="0.35"/>' +
      '</g>';
  }

  // 色の組み合わせ（ふだん・明るいところ・影）
  var ORANGE = { main: "#f39a3d", light: "#ffb865", shade: "#d97a22" };
  var BLUE   = { main: "#4a90d9", light: "#76b0ea", shade: "#2f6fb4" };
  var GREEN  = { main: "#5cb85c", light: "#82cf7c", shade: "#3f9a44" };
  var RED    = { main: "#e5483c", light: "#f2705f", shade: "#c4352b" };
  var YELLOW = { main: "#f7c33c", light: "#ffd96b", shade: "#e0a52a" };

  // =====================================================
  // 図鑑
  // =====================================================
  var defs = {};
  var ids = [];

  // くるまを図鑑に足す（A-2 では、ここに4台を足す）
  function add(def) {
    if (!defs[def.id]) ids.push(def.id);
    defs[def.id] = def;
  }

  // 動かす部品の決まり（どのくるまにも共通）
  var COMMON_CSS =
    /* 絵。動く部品が枠から少し出ても切れないように overflow: visible（保険） */
    ".kuruma-car { position: absolute; left: 0; top: 0; display: block; overflow: visible; }\n" +
    /* 回す・動かす <g> は、(0, 0) を中心にする（SVG ではもともと 0 0。念のため書いておく） */
    ".kuruma-car .spin, .kuruma-car .stripe, .kuruma-car .drum-bob, .kuruma-car .bed-tilt," +
    " .kuruma-car .blade-push, .kuruma-car .dirt-squash, .kuruma-car .lid-open { transform-origin: 0 0; }\n" +
    /* 走っているあいだ（.moving が付いているあいだ）、タイヤ・車輪が回る */
    ".moving .kuruma-car .spin { animation: kuruma-kururu 0.5s linear infinite; }\n" +
    ".moving .kuruma-car .spin-fast { animation-duration: 0.3s; }\n" +
    "@keyframes kuruma-kururu { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n" +
    /* キャタピラのでこぼこ：点線のずらし位置を 12（でこぼこ 6 ＋ すき間 6）動かして、流れるように見せる */
    ".moving .kuruma-car .tread { animation: kuruma-gotogoto 0.25s linear infinite; }\n" +
    "@keyframes kuruma-gotogoto { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -12; } }\n" +
    /* ランプ（A-2）：@keyframes を使わず、transition で明るさを変える。
       .lamp-on が付くと 0.3秒で明るく、外れると 0.5秒で ゆっくり元に戻る。
       途中でまた .lamp-on が付いても、いまの明るさから明るくなる（暗く戻らない＝点滅しない） */
    ".kuruma-car .lit, .kuruma-car [data-part=\"glow\"] { opacity: 0; transition: opacity " + (LAMP_FADE / 1000) + "s ease-in-out; }\n" +
    ".kuruma-car.lamp-on .lit, .kuruma-car.lamp-on [data-part=\"glow\"] { opacity: 1; transition: opacity " + (LAMP_RISE / 1000) + "s ease-out; }\n" +
    /* 動きを減らす設定では、ランプは はじめから光った形のまま（明るさを変えない） */
    "@media (prefers-reduced-motion: reduce) {\n" +
    "  .kuruma-car .lit, .kuruma-car [data-part=\"glow\"] { opacity: 1; transition: none; }\n" +
    "}\n";

  // 仕事の動きの CSS を、ページに1回だけ足す（くるまごとの CSS は、そのくるまを初めて作るときに足す）
  var styleEl = null;
  var styled = {};
  function ensureStyle(id) {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.textContent = COMMON_CSS;
      document.head.appendChild(styleEl);
    }
    if (!styled[id] && defs[id] && defs[id].css) {
      styleEl.textContent += defs[id].css;
    }
    styled[id] = true;
  }

  // くるまの絵を作る。返すもの：
  //   el     … <svg> の要素（ゲームの側で、ぷるぷるの箱の中に入れる）
  //   width, height, tip … 図鑑の値
  //   work() … 仕事の動きを1回する（連打したら、最初からやり直す）
  //   sound()… 仕事の音を1つ鳴らす
  var counter = 0;
  function create(id) {
    var def = defs[id];
    if (!def) return null;
    ensureStyle(id);
    counter++;
    var uid = "kuruma" + counter + "-";   // この絵の中の id の先頭に付ける（作るたびにちがう）

    var holder = document.createElement("div");
    holder.innerHTML =
      '<svg class="kuruma-car kc-' + id + '" data-kuruma="' + id + '" viewBox="0 0 ' + def.width + ' ' + HEIGHT + '"' +
      ' width="' + def.width + '" height="' + HEIGHT + '" aria-hidden="true" focusable="false">' +
      def.draw(uid) + '</svg>';
    var svg = holder.firstElementChild;

    var workTimer = null;
    var lampTimer = null;

    // ランプを1回光らせる（transition＋タイマー。3-7 の光り方）
    //   光っている途中・明るくなる途中にさわったら、印を付けたまま、消え始めるまでの時間をのばす。
    //   消えかけの途中なら、印を付け直して、いまの明るさから明るい状態へ戻す
    function lampOn() {
      svg.classList.add("lamp-on");
      clearTimeout(lampTimer);
      lampTimer = setTimeout(function () {
        svg.classList.remove("lamp-on");   // ここから transition で ゆっくり元に戻る
      }, LAMP_RISE + LAMP_HOLD);
    }

    function work() {
      if (def.workTime) {
        // 印を外して、ブラウザに一度反映させてから付け直す（連打しても、最初からやり直せるように）
        svg.classList.remove("kw-on");
        void svg.getBoundingClientRect();
        svg.classList.add("kw-on");
        clearTimeout(workTimer);
        workTimer = setTimeout(function () {
          svg.classList.remove("kw-on");    // 終わったら印を外す（形はもう元に戻っている）
        }, def.workTime + 100);
      }
      if (def.lamp) lampOn();
    }

    return {
      id: id,
      name: def.name,
      el: svg,
      width: def.width,
      height: HEIGHT,
      tip: def.tip,
      work: work,
      sound: function () { if (def.sound) def.sound(); }
    };
  }

  // =====================================================
  // 1. ミキサーしゃ（mixer、横 300）
  //    右に運転席、左に台。台の上に、右下がりに傾いた大きなたまご形のドラム（白にオレンジのしま）
  //    仕事：しまがドラムの中で横に流れて、ドラムが回って見える。ドラムが少しだけ上下にゆれる
  // =====================================================
  add({
    id: "mixer",
    name: "みきさーしゃ",
    width: 300,
    tip: { x: 150, y: 60 },
    workTime: 600,
    draw: function (uid) {
      var clip = uid + "drum";
      // ななめのしま（平行四辺形）。56 ずつ並べ、56 動くと同じ模様に戻るので、つなぎ目が見えない
      var stripes = "";
      for (var a = -196; a <= 140; a += 56) {
        stripes += '<path d="M ' + (a + 8) + ' -56 L ' + (a + 30) + ' -56 L ' + (a + 2) + ' 56 L ' + (a - 20) + ' 56 Z"/>';
      }
      return shadow(152, 136) +
        // 台と、ドラムを支える足2本（足の上のはしは、ドラムのうしろにかくれる）
        part("body",
          '<path d="M 56 167 L 60 128 L 73 128 L 77 167 Z" fill="#8a8f96"/>' +
          '<path d="M 128 167 L 132 146 L 145 146 L 149 167 Z" fill="#8a8f96"/>' +
          '<rect x="15" y="166" width="275" height="24" rx="7" fill="#8a8f96" stroke="none"/>' +
          '<path d="M 22 184 L 283 184" fill="none" stroke="#6e737a" stroke-width="5"/>' +
          '<rect x="15" y="166" width="275" height="24" rx="7" fill="none"/>' +
          '<rect x="283" y="173" width="13" height="12" rx="4" fill="#c8ccd0"/>') +
        // ドラム：中心 (110, 100)、長い直径 170・短い直径 100、時計回りに 12度（右下がり）
        part("drum",
          '<g class="drum-bob"><g transform="translate(110 100) rotate(12)">' +
            // 左はし（高いほう）の小さな口
            '<rect x="-99" y="-17" width="20" height="34" rx="7" fill="#d97a22"/>' +
            '<clipPath id="' + clip + '"><ellipse rx="85" ry="50"/></clipPath>' +
            '<ellipse rx="85" ry="50" fill="#ffffff" stroke="none"/>' +
            // ドラムの形で切りぬいた中に、しま・影・明るいところを描く
            '<g clip-path="url(#' + clip + ')" stroke="none">' +
              '<g class="stripe" fill="#f39a3d">' + stripes + '</g>' +
              '<ellipse cx="0" cy="40" rx="95" ry="20" fill="' + LINE + '" opacity="0.12"/>' +
              '<ellipse cx="-12" cy="-31" rx="48" ry="9" fill="#ffffff" opacity="0.55"/>' +
            '</g>' +
            '<ellipse rx="85" ry="50" fill="none"/>' +
            '<path d="M 66 -32 Q 78 0 66 32" fill="none" stroke-width="2.5"/>' +
          '</g></g>') +
        cab(210, 290, 95, 195, ORANGE) +
        lights(285, 161, 10, 168) +
        tire(60) + tire(150) + tire(245);
    },
    css:
      ".kc-mixer.kw-on .stripe { animation: kuruma-mixer-stripe 0.6s ease-in-out; }\n" +
      ".kc-mixer.kw-on .drum-bob { animation: kuruma-mixer-bob 0.6s ease-in-out; }\n" +
      "@keyframes kuruma-mixer-stripe { from { transform: translateX(0); } to { transform: translateX(56px); } }\n" +
      "@keyframes kuruma-mixer-bob { 0%, 50%, 100% { transform: translateY(0); } 25%, 75% { transform: translateY(-2px); } }\n",
    // 「ゴロン ゴロン」：低く まるい音（ゴロゴロのゆれ入り）を2つ。0.62秒
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.7, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 95, 80, t, 0.32, 0.24, 500, 14, 0.25, 0.3);        // ゴロン
      S.rumble(ctx, 88, 72, t + 0.3, 0.32, 0.22, 500, 14, 0.25, 0.3);  // ゴロン
      S.tone(ctx, "sine", 75, 70, t, 0.62, 0.08);                        // ドラムの低い まるい響き
    }
  });

  // =====================================================
  // 2. ダンプカー（dump、横 290）
  //    右に青い運転席、左に灰青の荷台（からっぽ）
  //    仕事：荷台が、うしろの下のちょうつがい (37, 170) を中心に 20度 上がって戻る
  //    上がったとき：荷台の左上の角は x 10 くらい、右上の角は y 55 くらい（枠の中）
  // =====================================================
  var DUMP_BED = "M -5 -59 Q -5 -65 1 -65 L 152 -65 Q 158 -65 158 -59 L 158 -6 Q 158 0 152 0 L 1 0 Q -5 0 -5 -6 Z";
  add({
    id: "dump",
    name: "だんぷかー",
    width: 290,
    tip: { x: 140, y: 103 },
    workTime: 600,
    draw: function () {
      return shadow(146, 128) +
        part("bed",
          '<g transform="translate(37 170)"><g class="bed-tilt">' +
            '<path d="' + DUMP_BED + '" fill="#8fa3b8" stroke="none"/>' +
            '<rect x="-1" y="-61" width="155" height="7" rx="3" fill="#b3c3d3" stroke="none"/>' +   // 上のふち（明るい）
            '<rect x="-1" y="-10" width="155" height="6" rx="3" fill="#6d8299" stroke="none"/>' +   // 下（影）
            '<path d="M -5 -52 L 158 -52" fill="none" stroke-width="2"/>' +
            '<path d="M 36 -52 L 36 -4 M 77 -52 L 77 -4 M 118 -52 L 118 -4" fill="none" stroke-width="2.5"/>' + // たての補強
            '<path d="' + DUMP_BED + '" fill="none"/>' +
            '<circle r="5" fill="#c8ccd0" stroke-width="2.5"/>' +   // ちょうつがい
          '</g></g>') +
        chassis(25, 277) +
        cab(200, 280, 95, 195, BLUE) +
        lights(275, 161, 20, 170) +
        tire(60) + tire(140) + tire(235);
    },
    css:
      ".kc-dump.kw-on .bed-tilt { animation: kuruma-dump-bed 0.6s ease-in-out; }\n" +
      "@keyframes kuruma-dump-bed { 0% { transform: rotate(0deg); } 35%, 45% { transform: rotate(-20deg); }" +
      " 80%, 100% { transform: rotate(0deg); } }\n",
    // 「ウィーン・ゴトン」：やわらかく上がる音（200→300Hz、0.3秒）と、荷台が戻ったときの低い「ゴトン」
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.7, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "triangle", 200, 300, t, 0.3, 0.16, 1200, 0.6);  // ウィーン
      S.tone(ctx, "sine", 200, 300, t, 0.3, 0.06, 0, 0.6);          // ウィーン（まるみ）
      S.tone(ctx, "sine", 120, 70, t + 0.46, 0.2, 0.26, 0, 0.2);    // ゴトン（低い音）
      S.noise(ctx, t + 0.46, 0.06, 0.12, 500);                       // ゴトン（にごり）
    }
  });

  // =====================================================
  // 3. ブルドーザー（bulldozer、横 280）
  //    キャタピラ、黄色の車体と運転席、うしろに短い煙突（煙なし）、前に黄色のブレードと小さな土の山
  //    仕事：ブレードが 5px 下がって 8px 前へ押し、土の山が横に広がって低くなり（1.25倍・0.75倍）、元に戻る
  //    いちばん動いたとき：ブレードの右はし x 253 くらい、土の山の右はし x 272 くらい（枠の中）
  // =====================================================
  // キャタピラの形（カプセル形）。まわりの長さが 420（= 12 × 35）なので、でこぼこの流れにつなぎ目が出ない
  var DOZER_TRACK = "M 44 164.5 L 175.46 164.5 A 25 25 0 0 1 175.46 214.5 L 44 214.5 A 25 25 0 0 1 44 164.5 Z";
  // ブレード（付け根 (190, 150) が (0, 0)）。ゆるく丸く曲がった板。下のはしは丸い
  var DOZER_BLADE = "M 16 -26 Q 16 -32 24 -32 L 46 -30 Q 52 -29 50 -23 Q 38 12 52 48 Q 55 58 45 58 L 24 58 Q 16 58 16 50 Z";

  // キャタピラの車輪（大）とローラー（小）
  function dozerWheel(cx) {
    return '<g transform="translate(' + cx + ' 189.5)"><g class="spin">' +
      '<circle r="18" fill="#6e6e6e" stroke="#3a2614" stroke-width="2.5"/>' +
      '<circle r="7" fill="#555555" stroke="none"/>' +
      '<g fill="#8a8a8a" stroke="none">' +
        '<circle cx="0" cy="-11" r="2.2"/><circle cx="9.5" cy="5.5" r="2.2"/><circle cx="-9.5" cy="5.5" r="2.2"/>' +
      '</g></g></g>';
  }
  function dozerRoller(cx) {
    return '<g transform="translate(' + cx + ' 201)"><g class="spin spin-fast">' +
      '<circle r="5.5" fill="#5e5e5e" stroke="#3a2614" stroke-width="2"/>' +
      '<circle cx="0" cy="-2.6" r="1.4" fill="#8a8a8a" stroke="none"/>' +
      '</g></g>';
  }

  add({
    id: "bulldozer",
    name: "ぶるどーざー",
    width: 280,
    tip: { x: 108, y: 44 },
    workTime: 600,
    draw: function () {
      return shadow(142, 128) +
        // ブレードと、それを支えるうで（うでの付け根は車体の内がわ。車体のうしろにかくれる）
        part("blade",
          '<g transform="translate(190 150)"><g class="blade-push">' +
            '<path d="M -10 14 L 22 34" fill="none" stroke-width="9"/>' +
            '<path d="M -10 14 L 22 34" fill="none" stroke="#e0a52a" stroke-width="4"/>' +
            '<rect x="-16" y="-7" width="40" height="14" rx="6" fill="#e0a52a"/>' +
            '<path d="' + DOZER_BLADE + '" fill="#f7c33c" stroke="none"/>' +
            '<path d="M 44 -22 Q 33 12 46 46" fill="none" stroke="#ffd96b" stroke-width="4"/>' +  // 明るいところ
            '<path d="M 22 -24 L 22 50" fill="none" stroke="#e0a52a" stroke-width="5"/>' +      // 影
            '<path d="' + DOZER_BLADE + '" fill="none"/>' +
          '</g></g>') +
        // 運転席（屋根つき、窓2枚）。下のはしは車体のうしろにかくれる
        part("cab",
          '<path d="M 66 127 L 66 56 L 146 56 L 150 127 Z" fill="#f7c33c"/>' +
          '<rect x="74" y="66" width="30" height="44" rx="5" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<path d="M 112 66 L 136 66 Q 140 66 140.4 70 L 143 106 Q 143.3 110 139 110 L 112 110 Z" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<g fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7">' +
            '<path d="M 80 102 L 92 74"/><path d="M 117 102 L 129 74"/>' +
          '</g>' +
          '<rect x="57" y="45" width="98" height="14" rx="6" fill="#f7c33c"/>' +
          '<path d="M 64 50 L 148 50" fill="none" stroke="#ffd96b" stroke-width="4"/>') +
        // 車体と、うしろの短い煙突（煙は出さない）、前の通気口
        part("body",
          '<rect x="40" y="96" width="9" height="28" rx="2.5" fill="#4a4a4a"/>' +
          '<rect x="38" y="92" width="13" height="7" rx="3.5" fill="#4a4a4a"/>' +
          '<rect x="30" y="120" width="160" height="46" rx="12" fill="#f7c33c" stroke="none"/>' +
          '<rect x="36" y="124" width="148" height="6" rx="3" fill="#ffd96b" stroke="none"/>' +
          '<rect x="36" y="156" width="148" height="6" rx="3" fill="#e0a52a" stroke="none"/>' +
          '<rect x="30" y="120" width="160" height="46" rx="12" fill="none"/>' +
          '<g fill="none" stroke-width="3">' +
            '<path d="M 158 134 L 176 134"/><path d="M 158 142 L 176 142"/><path d="M 158 150 L 176 150"/>' +
          '</g>') +
        // キャタピラ（車輪・ローラーもこの中。タイヤの部品は作らない）
        part("track",
          '<path class="tread" d="' + DOZER_TRACK + '" fill="none" stroke="#333333" stroke-width="11"' +
            ' stroke-dasharray="6 6" stroke-linecap="butt"/>' +
          '<path d="' + DOZER_TRACK + '" fill="#454545" stroke="#3a2614"/>' +
          dozerWheel(44) + dozerWheel(175.46) +
          dozerRoller(82) + dozerRoller(110) + dozerRoller(138) +
          '<rect x="66" y="177" width="88" height="10" rx="5" fill="#f7c33c" stroke-width="2.5"/>') +
        // 土の山（くるまの本体ではないので、専用の部品 dirt にする）。下のはしのまん中 (254, 215) が (0, 0)
        part("dirt",
          '<g transform="translate(254 215)"><g class="dirt-squash">' +
            '<path d="M -14 0 Q -15 -9 -8 -13 Q -3 -22 4 -19 Q 12 -16 14 -6 Q 15 -2 14 0 Z" fill="#a9744a" stroke-width="2.5"/>' +
            '<path d="M -4 -16 Q 2 -20 6 -15 Q 8 -12 7 -9 Q 2 -13 -4 -16 Z" fill="#c28a5c" stroke="none"/>' +
          '</g></g>') +
        lights(184, 134, 26, 128);
    },
    css:
      ".kc-bulldozer.kw-on .blade-push { animation: kuruma-dozer-blade 0.6s ease-in-out; }\n" +
      ".kc-bulldozer.kw-on .dirt-squash { animation: kuruma-dozer-dirt 0.6s ease-in-out; }\n" +
      "@keyframes kuruma-dozer-blade { 0% { transform: translate(0, 0); } 35% { transform: translate(0, 5px); }" +
      " 60%, 72% { transform: translate(8px, 5px); } 100% { transform: translate(0, 0); } }\n" +
      "@keyframes kuruma-dozer-dirt { 0%, 35% { transform: scale(1, 1); } 60%, 72% { transform: scale(1.25, 0.75); }" +
      " 100% { transform: scale(1, 1); } }\n",
    // 「ズズッ」：低い音に、にごった「ザッ」を小さく重ねる。0.45秒
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.5, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 70, 58, t, 0.45, 0.22, 450, 22, 0.3, 0.5);  // ズズ（低い音）
      S.noise(ctx, t + 0.08, 0.28, 0.1, 600);                    // ザッ（にごった音を小さく）
      S.noise(ctx, t + 0.3, 0.12, 0.08, 900);                    // ッ
    }
  });

  // =====================================================
  // 4. ごみしゅうしゅうしゃ（garbage、横 300）
  //    右に緑の運転席、まん中に大きな箱（白い縦の帯3本）、うしろに丸みのあるふた
  //    仕事：ふたが、右上のちょうつがい (65, 100) を中心に 20度 開いて（下のはしが左うしろへ上がる）、閉じる
  //    口に歯のような形は描かない（中は暗い緑の丸い穴だけ）。開いたとき、ふたの左下は x 8 くらい（枠の中）
  // =====================================================
  add({
    id: "garbage",
    name: "ごみしゅうしゅうしゃ",
    width: 300,
    tip: { x: 150, y: 73 },
    workTime: 500,
    draw: function () {
      return shadow(162, 132) +
        chassis(40, 287) +
        part("box",
          // うしろの口のまわりと、中の暗い穴（ふたを閉じているときは、ふたのうしろにかくれる）
          '<path d="M 40 106 Q 40 98 48 98 L 72 98 L 72 180 L 48 180 Q 40 180 40 172 Z" fill="#3f9a44"/>' +
          '<path d="M 47 112 Q 47 105 54 105 L 66 105 L 66 170 L 54 170 Q 47 170 47 163 Z" fill="#2f6f34" stroke-width="2"/>' +
          // 大きな箱
          '<rect x="65" y="75" width="150" height="105" rx="12" fill="#5cb85c" stroke="none"/>' +
          '<rect x="72" y="80" width="136" height="6" rx="3" fill="#82cf7c" stroke="none"/>' +
          '<rect x="72" y="168" width="136" height="7" rx="3" fill="#3f9a44" stroke="none"/>' +
          '<rect x="65" y="75" width="150" height="105" rx="12" fill="none"/>' +
          // 白い縦の帯3本
          '<g fill="#ffffff" stroke-width="2">' +
            '<rect x="92" y="90" width="16" height="72" rx="4"/>' +
            '<rect x="132" y="90" width="16" height="72" rx="4"/>' +
            '<rect x="172" y="90" width="16" height="72" rx="4"/>' +
          '</g>') +
        // ふた（上が丸い、やさしい形）。ちょうつがい (65, 100) が (0, 0)
        part("lid",
          '<g transform="translate(65 100)"><g class="lid-open">' +
            '<path d="M 2 -3 L -14 -3 Q -34 -3 -34 18 L -34 70 Q -34 76 -28 76 L 2 76 Z" fill="#4aa64f"/>' +
            '<path d="M -27 20 Q -27 5 -14 4" fill="none" stroke="#82cf7c" stroke-width="4"/>' +
            '<rect x="-27" y="56" width="18" height="7" rx="3.5" fill="#3f9a44" stroke-width="2"/>' +
            '<circle r="4" fill="#c8ccd0" stroke-width="2"/>' +
          '</g></g>') +
        cab(215, 290, 95, 195, GREEN) +
        lights(285, 161, 34, 170) +
        tire(90) + tire(165) + tire(255);
    },
    css:
      ".kc-garbage.kw-on .lid-open { animation: kuruma-garbage-lid 0.5s ease-in-out; }\n" +
      "@keyframes kuruma-garbage-lid { 0% { transform: rotate(0deg); } 30%, 40% { transform: rotate(20deg); }" +
      " 65%, 100% { transform: rotate(0deg); } }\n",
    // 「パクッ」：やわらかい短い音2つ（開く「パ」・閉じる「クッ」）。0.4秒
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.45, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "triangle", 440, 380, t, 0.1, 0.14, 1400);   // パ（開く）
      S.tone(ctx, "sine", 330, 220, t + 0.3, 0.09, 0.2);       // クッ（閉じる）
      S.noise(ctx, t + 0.3, 0.04, 0.06, 700);                   // クッ（小さな にごり）
    }
  });

  // =====================================================
  // 5. しょうぼうしゃ（fire、横 310）
  //    右に赤い運転席、左に赤い箱の車体（とびらの線、銀色のまいたホース）。屋根に たたんだはしご。
  //    運転席の上に赤いランプ。火・煙・水は描かない
  //    仕事：はしごが、付け根 (215, 85) を中心に 10度 上を向いてから、左へ 25px のびて、戻る。
  //          同時にランプが1回光る。いちばん のびたとき、はしごの左はしは x 12 くらい（枠の中）
  // =====================================================
  // はしごの1段ぶん（付け根が (0, 0)。左へのびる）。x0 … 左はし、len … 長さ
  function ladderSection(x0, len, railColor) {
    var rungs = "";
    for (var x = x0 + 10; x < x0 + len - 4; x += 23) {
      rungs += "M " + x + " -9 L " + x + " -1 ";
    }
    return '<path d="' + rungs + '" fill="none" stroke="#9aa1a8" stroke-width="3"/>' +   // たての段
      '<rect x="' + x0 + '" y="-15" width="' + len + '" height="6" rx="3" fill="' + railColor + '" stroke-width="2.5"/>' + // 上の棒
      '<rect x="' + x0 + '" y="-1" width="' + len + '" height="6" rx="3" fill="' + railColor + '" stroke-width="2.5"/>';   // 下の棒
  }
  add({
    id: "fire",
    name: "しょうぼうしゃ",
    width: 310,
    tip: { x: 150, y: 68 },
    workTime: 600,
    lamp: true,
    draw: function () {
      return shadow(158, 140) +
        part("body",
          // はしごをのせる台（2本）。上のはしは、はしごのうしろにかくれる
          '<rect x="62" y="86" width="8" height="22" rx="2" fill="#9aa1a8"/>' +
          '<rect x="186" y="86" width="8" height="22" rx="2" fill="#9aa1a8"/>' +
          // 箱の車体
          '<rect x="15" y="105" width="214" height="85" rx="10" fill="#e5483c" stroke="none"/>' +
          '<rect x="21" y="110" width="202" height="6" rx="3" fill="#f2705f" stroke="none"/>' +
          '<rect x="21" y="178" width="202" height="7" rx="3" fill="#c4352b" stroke="none"/>' +
          '<rect x="15" y="105" width="214" height="85" rx="10" fill="none"/>' +
          // とびらの線と、道具入れのしま
          '<path d="M 70 112 L 70 182 M 150 112 L 150 182" fill="none" stroke-width="2"/>' +
          '<path d="M 162 126 L 214 126 M 162 138 L 214 138 M 162 150 L 214 150 M 162 162 L 214 162" fill="none" stroke="#c4352b" stroke-width="3"/>' +
          // まいたホース（銀色の丸い輪。水は出さない）
          '<circle cx="110" cy="146" r="20" fill="#d9dde2" stroke-width="2.5"/>' +
          '<circle cx="110" cy="146" r="11" fill="#9aa1a8" stroke-width="2"/>' +
          '<circle cx="110" cy="146" r="4" fill="#d9dde2" stroke="none"/>' +
          '<rect x="296" y="174" width="12" height="12" rx="4" fill="#c8ccd0"/>') +
        // はしご：付け根 (215, 85) を (0, 0) にして回す。中の .extend（うしろの段）が左へのびる
        part("ladder",
          '<g transform="translate(215 85)"><g class="ladder-rot">' +
            '<g class="extend">' + ladderSection(-180, 140, "#c3c8ce") + '</g>' +
            ladderSection(-180, 180, "#d9dde2") +
          '</g></g>') +
        cab(225, 300, 90, 195, RED) +
        glowPart(262, 82) +
        lampPart(262, 82, 10, 10) +
        lights(295, 160, 10, 168) +
        tire(60, 23) + tire(160, 23) + tire(260, 23);
    },
    css:
      ".kuruma-car .ladder-rot, .kuruma-car .extend { transform-origin: 0 0; }\n" +
      ".kc-fire.kw-on .ladder-rot { animation: kuruma-fire-ladder 0.6s ease-in-out; }\n" +
      ".kc-fire.kw-on .extend { animation: kuruma-fire-extend 0.6s ease-in-out; }\n" +
      /* 上を向いてから のびて、ちぢめてから下を向く（左はしに近づきすぎないように） */
      "@keyframes kuruma-fire-ladder { 0% { transform: rotate(0deg); } 25%, 85% { transform: rotate(10deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-fire-extend { 0%, 25% { transform: translateX(0); } 50%, 62% { transform: translateX(-25px); }" +
      " 85%, 100% { transform: translateX(0); } }\n",
    // 「カシャ カシャ」：小さく やわらかい音を3回（キンキンさせないように、高さをおさえる）。0.36秒
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.45, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 3; i++) {
        var s = t + i * 0.14;
        S.tone(ctx, "triangle", 320, 280, s, 0.07, 0.1, 1200);   // カ（やわらかい音）
        S.noise(ctx, s, 0.06, 0.08, 1600);                        // シャ（小さな にごり）
      }
    }
  });

  // =====================================================
  // 6. きゅうきゅうしゃ（ambulance、横 280）
  //    まるみのある白い箱のくるま（運転席と車体がひと続きなので cab は作らず、body と window）。
  //    横に赤いライン、横の面にピンクのハート（白地に赤い十字は描かない）。屋根に赤いランプを前とうしろに2つ
  //    仕事：ランプが1回光る（ほかは動かない）
  // =====================================================
  var AMB_BODY = "M 15 185 L 15 88 Q 15 75 28 75 L 222 75 Q 238 75 244 88 L 262 128 Q 270 140 270 152 " +
    "L 270 185 Q 270 195 260 195 L 25 195 Q 15 195 15 185 Z";
  add({
    id: "ambulance",
    name: "きゅうきゅうしゃ",
    width: 280,
    tip: { x: 140, y: 74 },
    workTime: 0,
    lamp: true,
    draw: function () {
      return shadow(142, 126) +
        part("body",
          '<path d="' + AMB_BODY + '" fill="#ffffff" stroke="none"/>' +
          '<rect x="20" y="178" width="245" height="10" rx="5" fill="#e3e8ee" stroke="none"/>' +   // 下（影）
          '<rect x="17" y="146" width="251" height="8" fill="#e5483c" stroke="none"/>' +           // 赤いライン
          '<path d="' + AMB_BODY + '" fill="none"/>' +
          '<path d="M 218 92 L 218 184" fill="none" stroke-width="2"/>' +                          // とびらの線
          '<rect x="202" y="160" width="12" height="4" rx="2" fill="' + LINE + '" stroke="none"/>' +
          '<rect x="262" y="176" width="13" height="12" rx="4" fill="#c8ccd0"/>') +
        // 窓：前に1枚、横に2枚（中の人は描かない）
        part("window",
          '<path d="M 224 86 Q 234 86 238 94 L 252 123 Q 254 128 249 128 L 228 128 Q 224 128 224 124 Z" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<rect x="160" y="88" width="52" height="34" rx="6" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<rect x="100" y="88" width="52" height="34" rx="6" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<g fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7">' +
            '<path d="M 108 116 L 120 94"/><path d="M 168 116 L 180 94"/><path d="M 230 120 L 236 100"/>' +
          '</g>') +
        // ピンクのハート
        part("heart",
          '<path d="M 70 132 C 52 120 50 104 60 100 C 66 97 70 102 70 106 C 70 102 74 97 80 100 C 90 104 88 120 70 132 Z"' +
          ' fill="#f28ca6" stroke-width="2.5"/>') +
        // ランプと光の輪は、ランプごとに1つずつ
        glowPart(60, 72) + glowPart(235, 72) +
        lampPart(60, 72, 9, 9) + lampPart(235, 72, 9, 9) +
        lights(264, 166, 10, 158) +
        tire(70, 23) + tire(215, 23);
    },
    // 「ピー ポー」：やさしい2つの音（sine。660Hz → 550Hz、それぞれ 0.25秒。「ピポッ♪」の 880Hz より低い）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.55, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "sine", 660, 660, t, 0.25, 0.13);          // ピー
      S.tone(ctx, "sine", 550, 550, t + 0.26, 0.25, 0.13);   // ポー
    }
  });

  // =====================================================
  // 7. クレーンしゃ（crane、横 310）
  //    右に黄色の運転席、左に灰色の台と回る台。ななめに上がった黄色の長いうで（2段）、
  //    うでの先から細いロープと、丸い銀色のフック（とがらせない）
  //    仕事：うでが付け根 (90, 140) を中心に 12度 上がって戻る。フックが小さく左右にゆれる。
  //          上がったとき、うでの上のふちは y 27 くらい（枠の中）
  //    フック（hook）は、うで（boom）の中には入れない。うでと同じ中心・同じ角度で位置だけ動かし、
  //    その中で逆の角度に回して、フックが傾かないようにする
  // =====================================================
  var CRANE_ANGLE = -34.82;   // うでの、ふだんの傾き（付け根 (90, 140) から 先 (205, 60) の向き）
  add({
    id: "crane",
    name: "くれーんしゃ",
    width: 310,
    tip: { x: 130, y: 96 },
    workTime: 600,
    draw: function () {
      return shadow(156, 140) +
        part("body",
          // 灰色の台
          '<rect x="15" y="150" width="281" height="40" rx="8" fill="#8a8f96" stroke="none"/>' +
          '<path d="M 22 182 L 289 182" fill="none" stroke="#6e737a" stroke-width="6"/>' +
          '<rect x="15" y="150" width="281" height="40" rx="8" fill="none"/>' +
          // 回る台（動かない）
          '<rect x="40" y="125" width="80" height="30" rx="8" fill="#8a8f96"/>' +
          '<path d="M 46 147 L 114 147" fill="none" stroke="#6e737a" stroke-width="5"/>' +
          '<rect x="292" y="174" width="13" height="12" rx="4" fill="#c8ccd0"/>') +
        // うで：付け根 (90, 140) を (0, 0) にして回す。中では、うでの向きに沿って描く
        part("boom",
          '<g transform="translate(90 140)"><g class="boom-rot"><g transform="rotate(' + CRANE_ANGLE + ')">' +
            // 先の細い段（うしろ）
            '<rect x="80" y="-8" width="68" height="16" rx="6" fill="#f7c33c"/>' +
            '<path d="M 86 -3 L 142 -3" fill="none" stroke="#ffd96b" stroke-width="3"/>' +
            // 付け根の太い段（手前）
            '<rect x="-8" y="-11" width="98" height="22" rx="8" fill="#f7c33c"/>' +
            '<path d="M 0 -5 L 82 -5" fill="none" stroke="#ffd96b" stroke-width="4"/>' +
            '<path d="M 0 6 L 82 6" fill="none" stroke="#e0a52a" stroke-width="4"/>' +
            // 先の滑車と、付け根のピン
            '<circle cx="140" cy="0" r="7" fill="#c8ccd0" stroke-width="2.5"/>' +
            '<circle cx="140" cy="0" r="2" fill="' + LINE + '" stroke="none"/>' +
            '<circle r="7" fill="#c8ccd0" stroke-width="2.5"/>' +
          '</g></g></g>') +
        // ロープとフック：うでの先 (205, 60) ＝ 付け根から (115, -80) のところから、下へ描く
        part("hook",
          '<g transform="translate(90 140)"><g class="hook-follow">' +
            '<g transform="translate(115 -80)"><g class="hook-upright"><g class="hook-swing">' +
              '<path d="M 0 0 L 0 40" fill="none" stroke-width="2"/>' +
              '<rect x="-7" y="38" width="14" height="10" rx="3" fill="#c8ccd0" stroke-width="2.5"/>' +
              '<path d="M 0 48 L 0 53 Q 9 53 9 61 Q 9 70 0 70 Q -8 70 -8 63" fill="none" stroke-width="8"/>' +
              '<path d="M 0 48 L 0 53 Q 9 53 9 61 Q 9 70 0 70 Q -8 70 -8 63" fill="none" stroke="#c8ccd0" stroke-width="4"/>' +
            '</g></g></g>' +
          '</g></g>') +
        cab(225, 300, 100, 195, YELLOW) +
        lights(295, 166, 10, 160) +
        tire(60) + tire(150) + tire(260);
    },
    css:
      ".kuruma-car .boom-rot, .kuruma-car .hook-follow, .kuruma-car .hook-upright, .kuruma-car .hook-swing { transform-origin: 0 0; }\n" +
      /* うでと、フックの位置は、同じ動き（同じ角度・同じ時間）。フックは逆の角度で回して、まっすぐ下を向いたままにする */
      ".kc-crane.kw-on .boom-rot, .kc-crane.kw-on .hook-follow { animation: kuruma-crane-boom 0.6s ease-in-out; }\n" +
      ".kc-crane.kw-on .hook-upright { animation: kuruma-crane-upright 0.6s ease-in-out; }\n" +
      ".kc-crane.kw-on .hook-swing { animation: kuruma-crane-swing 0.6s ease-in-out; }\n" +
      "@keyframes kuruma-crane-boom { 0% { transform: rotate(0deg); } 40%, 55% { transform: rotate(-12deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-crane-upright { 0% { transform: rotate(0deg); } 40%, 55% { transform: rotate(12deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-crane-swing { 0%, 30% { transform: rotate(0deg); } 55% { transform: rotate(6deg); }" +
      " 78% { transform: rotate(-5deg); } 100% { transform: rotate(0deg); } }\n",
    // 「ウィーン カチャ」：やわらかい上がる音（180→260Hz、0.4秒）と、小さな「カチャ」。0.53秒
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.6, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "triangle", 180, 260, t, 0.4, 0.14, 1000, 0.6);  // ウィーン
      S.tone(ctx, "sine", 180, 260, t, 0.4, 0.05, 0, 0.6);          // ウィーン（まるみ）
      S.noise(ctx, t + 0.45, 0.05, 0.08, 1200);                      // カ
      S.noise(ctx, t + 0.48, 0.05, 0.06, 1800);                      // チャ
    }
  });

  // =====================================================
  // 8. パトカー（police、横 270）
  //    まるみのある乗用車の形。上の半分が白、下の半分（y 155 から下）が黒。窓2枚。
  //    屋根のまん中に赤いランプ（横長）。文字・紋章・マークは描かない。
  //    運転席と車体がひと続きなので cab は作らず、body と window
  //    仕事：ランプが1回光る
  // =====================================================
  var POLICE_BODY = "M 15 182 L 15 152 Q 15 140 28 140 L 60 140 L 78 108 Q 82 100 92 100 L 180 100 " +
    "Q 190 100 196 108 L 218 140 L 238 142 Q 255 145 255 160 L 255 182 Q 255 195 242 195 L 28 195 Q 15 195 15 182 Z";
  var POLICE_LOWER = "M 15 155 L 254 155 Q 255 157 255 160 L 255 182 Q 255 195 242 195 L 28 195 Q 15 195 15 182 Z";
  add({
    id: "police",
    name: "ぱとかー",
    width: 270,
    tip: { x: 110, y: 99 },
    workTime: 0,
    lamp: true,
    draw: function () {
      return shadow(138, 122) +
        part("body",
          '<path d="' + POLICE_BODY + '" fill="#ffffff" stroke="none"/>' +
          '<path d="M 22 150 L 244 150" fill="none" stroke="#e3e8ee" stroke-width="6"/>' +       // 白の下の影
          '<path d="' + POLICE_LOWER + '" fill="#3a3a3a" stroke="none"/>' +                       // 下の半分の黒
          '<path d="' + POLICE_BODY + '" fill="none"/>' +
          '<path d="M 135 140 L 135 186" fill="none" stroke="#8a8f96" stroke-width="2"/>' +       // とびらのさかい目
          '<rect x="110" y="145" width="12" height="4" rx="2" fill="' + LINE + '" stroke="none"/>' +
          '<rect x="186" y="145" width="12" height="4" rx="2" fill="' + LINE + '" stroke="none"/>' +
          '<rect x="248" y="178" width="14" height="11" rx="4" fill="#c8ccd0"/>') +
        part("window",
          '<path d="M 84 136 L 95 112 Q 97 108 102 108 L 130 108 L 130 136 Z" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<path d="M 140 108 L 178 108 Q 184 108 188 113 L 206 136 L 140 136 Z" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<g fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7">' +
            '<path d="M 100 132 L 110 113"/><path d="M 148 132 L 158 113"/><path d="M 159 132 L 169 113"/>' +
          '</g>') +
        glowPart(135, 94) +
        lampPart(135, 94, 11, 6) +
        lights(249, 166, 10, 160) +
        tire(70, 23) + tire(205, 23);
    },
    // 「ウーン」：1回だけ、ゆっくり上がって下がる やさしい音（sine。450 → 600 → 450Hz、0.7秒）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.75, false);
      if (!ctx) return;
      S.glide(ctx, "sine", [450, 600, 450], ctx.currentTime, 0.7, 0.13, 0, 0.1);
    }
  });

  Kuruma.cars = {
    HEIGHT: HEIGHT,
    LAMP_RISE: LAMP_RISE,
    LAMP_HOLD: LAMP_HOLD,
    LAMP_FADE: LAMP_FADE,
    add: add,
    get: function (id) { return defs[id] || null; },
    list: function () { return ids.slice(); },
    create: create,
    // ランプのあるくるまを描くときに使う部品（あとで図鑑に足すくるまでも使えるように）
    parts: { lamp: lampPart, glow: glowPart }
  };
})();
