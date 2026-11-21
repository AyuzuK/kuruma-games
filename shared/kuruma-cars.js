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
  //   rx, ry … 横長のランプに合わせた楕円にするときの、外がわの輪の半径（省略すると 丸 r 32）
  function glowPart(cx, cy, rx, ry) {
    if (!rx) {
      return '<g data-part="glow">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="32" fill="#ffc4bc" opacity="0.25"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="22" fill="#ff8a80" opacity="0.35"/>' +
        '</g>';
    }
    // 内がわの輪は、外がわより 10 小さく
    return '<g data-part="glow">' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#ffc4bc" opacity="0.25"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (rx - 10) + '" ry="' + (ry - 8) + '" fill="#ff8a80" opacity="0.35"/>' +
      '</g>';
  }

  // =====================================================
  // 仕事の音の大きさ（追加修正1）
  //   基準は、走りさる「ブーーン」（Kuruma.sound.playDrive。sawtooth 80→160Hz、大きさ 0.5、700Hz でやわらかく）。
  //   聞きくらべのページで、どの仕事の音も「ブーーン」に対して
  //     250Hz より下を削ったもの（スマホのスピーカーのまね）の平均の大きさ（RMS）0.8〜1.1、
  //     そのままの いちばん大きいところ（ピーク）1.1 以下、3回連打のピーク 1 未満
  //   になるようにする（そのままの RMS などは参考）。
  //   そのために、次のように作っている。
  //   ・エンジンのような音（sawtooth）は「ブーーン」と同じ形（80〜120Hz くらい、700〜950Hz でやわらかく）にする。
  //     スマホでも聞こえる 250〜1000Hz の倍音が、「ブーーン」と同じくらい入る
  //   ・サイレン（400〜960Hz）は、もともとスマホで聞こえる高さなので、そのまま使う
  //   ・「ザーッ」（noise）は、平均の大きさのわりにピークが大きいので、少しだけ使う
  //   ・1つの音の長さ：サイレンの3台は 1.4秒まで、ほかは 0.8秒まで。beginSound に渡す秒数も同じにする
  // =====================================================

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

  // くるまを図鑑に足す（いまは9台。ゲームでの順番は、ゲームの側で決める）
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
  //    いちばん動いたとき（ドラムが 2px 上がったとき）：ドラムの上のはし y 46、左の口のはし x 16 くらい（枠の中。
  //    しまはドラムの形で切りぬいているので、外には出ない）
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
    // 「ゴロン ゴロン」：低く重い音（追加修正1）。0.75秒
    //   もとの高さを 72→62Hz に下げ、ゆれを ゆっくり（1秒に7回）にした。
    //   高い成分は 800Hz でやわらかく削る（目安の 400Hz まで削ると、スマホで聞こえる 250〜800Hz の倍音が
    //   なくなって、スマホでは小さく聞こえるため。高さそのものは低いので、低く聞こえる）
    //   測った結果（大きさ 0.5 のとき）：「ブーーン」に対して ピーク 1.031、250Hz より下を削ったもの RMS 0.827。
    //   ピークが 1.1 をこえないところまで、1.065倍にした（見込み：ピーク 1.098、削ったもの RMS 0.881）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.75, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 72, 62, t, 0.75, 0.532, 800, 7, 0.15, 0.75);   // ゴロン ゴロン（ゆっくりゆれる低い音）
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
    // 「ザザー」：砂利がすべり落ちる音（追加修正1）。0.75秒
    //   荷台がすべる低い「ゴー」（sawtooth 100→80Hz）の上に、帯の広い にごった音（1100Hz・1700Hz のあたり）を重ね、
    //   小さな「つぶ」（短い にごり 0.05秒）を、ばらばらの時刻に7つ足す。どれも だんだん小さくなる。
    //   荷台が上がる「ウィーン」は外した（「ザザー」を聞きやすくするため）
    //   測った結果（0.38・0.18・0.14・0.12 のとき）：ピーク 0.872、250Hz より下を削ったもの RMS 0.858。
    //   1.11倍にした（見込み：ピーク 0.968、削ったもの RMS 0.952）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.75, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "sawtooth", 100, 80, t, 0.75, 0.422, 750, 0.7);   // ゴー（荷台がすべる低い音）
      S.noise(ctx, t, 0.7, 0.2, 1100, 0.35);                         // ザー
      S.noise(ctx, t + 0.04, 0.62, 0.155, 1700, 0.3);                // ザー（少し高いところ）
      // 「つぶ」の時刻（ばらばらに見えるように決めた並び。毎回同じなので、測った数字も変わらない）
      var grains = [0.08, 0.17, 0.23, 0.34, 0.41, 0.52, 0.6];
      for (var i = 0; i < grains.length; i++) {
        S.noise(ctx, t + grains[i], 0.05, 0.133, i % 2 ? 1400 : 2000);
      }
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
    // 「ズズッ」：低い音に、にごった「ザッ」を小さく重ねる。0.5秒（追加修正1：形はそのまま、大きくした）
    //   大きくするのに合わせて、少しだけ整えた：高さ 70→58Hz を 78→64Hz に、やわらかくする高さ 450Hz を 850Hz に
    //   （スマホでも聞こえるように）。ゆれは 0.3 を 0.15 に、大きさを保つ時間を半分から 7割に
    //   （ピークだけが大きくならないように）
    //   測った結果（0.508・0.194・0.151 のとき）：ピーク 1.031、250Hz より下を削ったもの RMS 0.815。
    //   ピークが 1.1 をこえないところまで、1.065倍にした（見込み：ピーク 1.098、削ったもの RMS 0.868）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.5, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 78, 64, t, 0.5, 0.541, 850, 22, 0.15, 0.7); // ズズ（低い音）
      S.noise(ctx, t + 0.08, 0.28, 0.207, 600);                  // ザッ（にごった音を小さく）
      S.noise(ctx, t + 0.3, 0.12, 0.161, 900);                   // ッ
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
    // 「ガガー」：機械がかみ合って回る音（追加修正1）。0.65秒
    //   ブーッとした音（sawtooth 125→105Hz）を、1秒に26回すばやくゆらし、950Hz でやわらかくする。
    //   その上に、にごり（650Hz のあたり）を小さく重ねる
    //   測った結果（0.48・0.12 のとき）：ピーク 0.987、250Hz より下を削ったもの RMS 0.900。
    //   1.06倍にした（見込み：ピーク 1.046、削ったもの RMS 0.954）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.65, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 125, 105, t, 0.65, 0.509, 950, 26, 0.25, 0.7); // ガガガ（すばやくゆれる音）
      S.noise(ctx, t, 0.6, 0.127, 650, 0.5);                        // ー（にごり）
    }
  });

  // =====================================================
  // 5. しょべるかー（shovel、横 300）追加修正1
  //    1本目（games/01-shovel）のショベルカーの絵を、形・色はそのままに、部品ごとに分けて写したもの。
  //    重なる順番（奥 → 手前）：影 → 奥のキャタピラ → 旋回台・煙突 → アーム → 運転席 → 車体 → ライト → 手前のキャタピラ
  //    仕事：アームが「すくう」（1本目の scoopArm と同じ形。ブーム 9度・スティック 11度・バケット 18度、0.5秒）
  //
  //    枠に入れるため、絵の全体を (150, 200) を中心に 0.97倍 にしている（形は1本目と同じ）。
  //      1本目の座標のままだと、ふだんの形で、スティックの上のはし（丸いところ）が y -3（線をふくめて -4.5）になり、
  //      枠の上から少し出るため。0.97倍にすると：
  //        上のはし：y = 200 - 0.97 × (200 + 3)   = 3.1（線をふくめて 1.6）
  //        下のはし：キャタピラの下 y 215 → 214.6。でこぼこの線の外がわ 220.5 → 219.9
  //        右のはし：バケットの右はし x 290（線をふくめて 291.5）→ 286（287.3）
  //        左のはし：キャタピラのでこぼこの外がわ x 4.5 → 8.9
  //    いちばん動いたとき（すくって 0.2秒、ブーム 9度・スティック 合わせて 20度・バケット 合わせて 38度）：
  //      スティックの関節 (175, 20) → (190.0, 29.8)、バケットの関節 (230, 105) → (212.6, 128.5)
  //      バケットのいちばん下は y 201（0.97倍で 201.5）、いちばん右は x 255 くらい。
  //      スティックの上のはしは、回って下がるので y 14 くらい。どれも枠の中
  //      （ふだんの形がいちばん上・いちばん右になる）
  // =====================================================
  var SHOVEL_TRACK = "M 35 165 L 106.46 165 A 25 25 0 0 1 106.46 215 L 35 215 A 25 25 0 0 1 35 165 Z";
  var SHOVEL_BUCKET = "M -8 -4 L 38 -6 Q 62 10 58 34 Q 54 60 26 64 L 2 64 Q -6 64 -6 58 Q 12 28 -8 -4 Z";
  var SHOVEL_CAB = "M 34 115 L 34 46 Q 34 28 52 28 L 104 28 Q 119 28 121 43 L 126 115 Z";

  // キャタピラの車輪（大）とローラー（小）。1本目と同じ形・色
  //   dark … 奥のキャタピラ用の、少し暗い色にするか
  function shovelWheel(cx, dark) {
    return '<g transform="translate(' + cx + ' 190)"><g class="spin">' +
      '<circle r="18" fill="' + (dark ? "#5e5e5e" : "#6e6e6e") + '" stroke="#3a2614" stroke-width="2.5"/>' +
      '<circle r="7" fill="' + (dark ? "#4a4a4a" : "#555555") + '" stroke="none"/>' +
      '<g fill="' + (dark ? "#7a7a7a" : "#8a8a8a") + '" stroke="none">' +
        '<circle cx="0" cy="-11" r="2.2"/><circle cx="9.5" cy="5.5" r="2.2"/><circle cx="-9.5" cy="5.5" r="2.2"/>' +
      '</g></g></g>';
  }
  function shovelRoller(cx) {
    return '<g transform="translate(' + cx + ' 201)"><g class="spin spin-fast">' +
      '<circle r="5.5" fill="#5e5e5e" stroke="#3a2614" stroke-width="2"/>' +
      '<circle cx="0" cy="-2.6" r="1.4" fill="#8a8a8a" stroke="none"/>' +
      '</g></g>';
  }
  // キャタピラのでこぼこ（太い点線。まわりの長さが 300 = 12 × 25 なので、流れにつなぎ目が出ない）
  function shovelTread(color) {
    return '<path class="tread" d="' + SHOVEL_TRACK + '" fill="none" stroke="' + color + '" stroke-width="11"' +
      ' stroke-dasharray="6 6" stroke-linecap="butt"/>';
  }

  add({
    id: "shovel",
    name: "しょべるかー",
    width: 300,
    // 運転席の屋根の上（横幅の 37% くらい）。屋根 y 28 は、0.97倍で y 33.6
    tip: { x: 112, y: 34 },
    workTime: 500,
    draw: function (uid) {
      var bodyClip = uid + "shovel-body";
      var cabClip = uid + "shovel-cab";
      var bucketClip = uid + "shovel-bucket";
      return shadow(94, 86) +
        // 絵の全体を 0.97倍（中心 (150, 200)）。部品の <g data-part> は、この中に並べる（入れ子にはしない）
        '<g transform="translate(150 200) scale(0.97) translate(-150 -200)">' +
        // 奥のキャタピラ（手前より右に 22・上に 7 ずらし、少し暗く）
        part("track",
          '<g transform="translate(22 -7)">' +
            shovelTread("#2c2c2c") +
            '<path d="' + SHOVEL_TRACK + '" fill="#3a3a3a" stroke="#3a2614"/>' +
            shovelWheel(106.46, true) +
          '</g>') +
        // 旋回台（車体の下の暗い台）と、煙突（煙は出さない）
        part("base",
          '<rect x="36" y="150" width="96" height="18" rx="5" fill="#4a4a4a"/>' +
          '<rect x="20" y="92" width="9" height="24" rx="2.5" fill="#4a4a4a"/>' +
          '<rect x="18" y="88" width="13" height="7" rx="3.5" fill="#4a4a4a"/>') +
        // アーム（ブーム > スティック > バケット）。関節ごとに、関節の場所へ translate した <g> の中で回す
        part("arm",
          // ブームの付け根の関節 (120, 120)
          '<g transform="translate(120 120)"><g class="sv-boom">' +
            // 油圧シリンダー2（ブームの上がわ）
            '<line x1="26.2" y1="-91.9" x2="46.3" y2="-113.4" stroke-width="5"/>' +
            '<line x1="26.2" y1="-91.9" x2="46.3" y2="-113.4" stroke="#c8ccd0" stroke-width="2.5"/>' +
            '<line x1="9.8" y1="-74.4" x2="29.9" y2="-95.9" stroke-width="8"/>' +
            '<line x1="9.8" y1="-74.4" x2="29.9" y2="-95.9" stroke="#4a4a4a" stroke-width="5"/>' +
            // ブーム（「く」の字）と明るいところ
            '<path fill="#f7c33c" d="M 11.5 3.4 L 28 -56.2 Q 29.7 -62 34.1 -66 L 61.1 -93.4 A 9 9 0 0 0 48.9 -106.6' +
              ' L 18.5 -81.5 Q 10.3 -74.1 7.2 -63.4 L -11.5 -3.4 A 12 12 0 0 0 11.5 3.4 Z"/>' +
            '<path d="M -1.8 -14.5 L 12.4 -62 Q 14.7 -71.3 22 -77.5 L 45 -98" fill="none" stroke="#ffd96b" stroke-width="4"/>' +
            '<circle cx="9.8" cy="-74.4" r="3.5" fill="#ffd96b" stroke-width="2"/>' +
            // 油圧シリンダー1（ブームの下がわ）
            '<line x1="22.6" y1="-13" x2="28" y2="-50" stroke-width="5"/>' +
            '<line x1="22.6" y1="-13" x2="28" y2="-50" stroke="#c8ccd0" stroke-width="2.5"/>' +
            '<line x1="18" y1="18" x2="23.6" y2="-20" stroke-width="8"/>' +
            '<line x1="18" y1="18" x2="23.6" y2="-20" stroke="#4a4a4a" stroke-width="5"/>' +
            '<circle cx="28" cy="-50" r="3.5" fill="#ffd96b" stroke-width="2"/>' +
            // スティックの関節（ブームの先）(55, -100)
            '<g transform="translate(55 -100)"><g class="sv-stick">' +
              '<path fill="#f7c33c" d="M -0.7 -18.6 L 61.7 80.7 A 8 8 0 0 1 48.3 89.4 L -16.7 -8.3 A 9.5 9.5 0 0 1 -0.7 -18.6 Z"/>' +
              '<path d="M 3.1 -4.4 L 50.5 69.8" fill="none" stroke="#ffd96b" stroke-width="3.5"/>' +
              // 油圧シリンダー3（スティックの外がわ）
              '<line x1="36.2" y1="33.8" x2="64.4" y2="77.4" stroke-width="5"/>' +
              '<line x1="36.2" y1="33.8" x2="64.4" y2="77.4" stroke="#c8ccd0" stroke-width="2.5"/>' +
              '<line x1="15.5" y1="1.9" x2="40" y2="39.7" stroke-width="8"/>' +
              '<line x1="15.5" y1="1.9" x2="40" y2="39.7" stroke="#4a4a4a" stroke-width="5"/>' +
              '<circle cx="15.5" cy="1.9" r="3.5" fill="#ffd96b" stroke-width="2"/>' +
              // バケットの関節（スティックの先）(55, 85)
              '<g transform="translate(55 85)"><g class="sv-bucket">' +
                '<rect x="-4" y="-12" width="32" height="10" rx="5" fill="#f7c33c"/>' +
                '<circle cx="22" cy="-7" r="3" fill="#ffd96b" stroke-width="2"/>' +
                // バケット：口は左向き。歯は付けず、丸みのある1枚の刃先。切りぬきの型は、この部品の中に置く
                '<clipPath id="' + bucketClip + '"><path d="' + SHOVEL_BUCKET + '"/></clipPath>' +
                '<path fill="#f7c33c" d="' + SHOVEL_BUCKET + '"/>' +
                '<g clip-path="url(#' + bucketClip + ')" stroke="none">' +
                  '<ellipse cx="30" cy="66" rx="42" ry="12" fill="#e0a52a"/>' +
                  '<path d="M -6 58 Q 12 28 -8 -4" fill="none" stroke="#e0a52a" stroke-width="10"/>' +
                  '<path d="M 40 -2 Q 58 12 55 32" fill="none" stroke="#ffd96b" stroke-width="4"/>' +
                '</g>' +
                '<path fill="none" d="' + SHOVEL_BUCKET + '"/>' +
                '<circle r="5" fill="#ffd96b" stroke-width="2.5"/>' +
                '<circle r="1.6" fill="' + LINE + '" stroke="none"/>' +
              '</g></g>' +
              // スティックの関節のピン
              '<circle r="6" fill="#ffd96b" stroke-width="2.5"/>' +
              '<circle r="2" fill="' + LINE + '" stroke="none"/>' +
            '</g></g>' +
            // ブームの付け根のピン
            '<circle r="5" fill="#ffd96b" stroke-width="2.5"/>' +
            '<circle r="1.6" fill="' + LINE + '" stroke="none"/>' +
          '</g></g>') +
        // 運転席（横 34〜126、縦 28〜115）。窓2枚、中の人は描かない
        part("cab",
          '<clipPath id="' + cabClip + '"><path d="' + SHOVEL_CAB + '"/></clipPath>' +
          '<path fill="#f7c33c" d="' + SHOVEL_CAB + '"/>' +
          '<g clip-path="url(#' + cabClip + ')" stroke="none">' +
            '<rect x="30" y="22" width="100" height="12" fill="#ffd96b"/>' +
          '</g>' +
          '<path fill="none" d="' + SHOVEL_CAB + '"/>' +
          '<path d="M 101 30 L 101 112" fill="none" stroke-width="1.5"/>' +
          '<rect x="41" y="37" width="53" height="43" rx="7" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<path d="M 104 37 L 114 37 Q 118 37 118.5 41 L 121 76 Q 121.3 80 117 80 L 104 80 Z" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<g stroke="#ffffff" stroke-width="4" opacity="0.7" fill="none">' +
            '<path d="M 50 74 L 65 44"/><path d="M 61 74 L 76 44"/><path d="M 108 72 L 114 46"/>' +
          '</g>' +
          '<path d="M 39 86 L 39 110" fill="none" stroke-width="1.5"/>' +
          '<rect x="84" y="90" width="12" height="4" rx="2" fill="' + LINE + '" stroke="none"/>') +
        // 車体（下の箱。縦 112〜160）と、うしろの通気口
        part("body",
          '<clipPath id="' + bodyClip + '"><rect x="15" y="112" width="130" height="48" rx="14"/></clipPath>' +
          '<rect x="15" y="112" width="130" height="48" rx="14" fill="#f7c33c" stroke="none"/>' +
          '<g clip-path="url(#' + bodyClip + ')" stroke="none">' +
            '<rect x="15" y="112" width="130" height="7" fill="#ffd96b"/>' +
            '<rect x="15" y="151" width="130" height="9" fill="#e0a52a"/>' +
          '</g>' +
          '<rect x="15" y="112" width="130" height="48" rx="14" fill="none"/>' +
          '<path d="M 121 115 L 121 157" fill="none" stroke-width="1.5"/>' +
          '<g stroke-width="3.5" fill="none">' +
            '<path d="M 24 125 L 38 125"/><path d="M 24 132 L 38 132"/><path d="M 24 139 L 38 139"/>' +
          '</g>') +
        // 前のライト2つ
        part("light",
          '<circle cx="128" cy="140" r="5" fill="#fff3c4" stroke-width="2"/>' +
          '<circle cx="139" cy="140" r="5" fill="#fff3c4" stroke-width="2"/>') +
        // 手前のキャタピラ（車輪・ローラー・カバーもこの中）
        part("track",
          shovelTread("#333333") +
          '<path d="' + SHOVEL_TRACK + '" fill="#454545" stroke="#3a2614"/>' +
          shovelWheel(35, false) + shovelWheel(106.46, false) +
          shovelRoller(58) + shovelRoller(71) + shovelRoller(84) +
          '<rect x="46" y="178" width="50" height="10" rx="5" fill="#f7c33c" stroke-width="2.5"/>') +
        '</g>';
    },
    // 1本目の「ガシャン」と同じ動き（0.5秒。40% = 0.2秒で下がりきる。角度は入れ子なので足し算になる）
    css:
      ".kuruma-car .sv-boom, .kuruma-car .sv-stick, .kuruma-car .sv-bucket { transform-origin: 0 0; }\n" +
      ".kc-shovel.kw-on .sv-boom { animation: kuruma-shovel-boom 0.5s ease-in-out; }\n" +
      ".kc-shovel.kw-on .sv-stick { animation: kuruma-shovel-stick 0.5s ease-in-out; }\n" +
      ".kc-shovel.kw-on .sv-bucket { animation: kuruma-shovel-bucket 0.5s ease-in-out; }\n" +
      "@keyframes kuruma-shovel-boom { 0% { transform: rotate(0deg); } 40% { transform: rotate(9deg); } 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-shovel-stick { 0% { transform: rotate(0deg); } 40% { transform: rotate(11deg); } 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-shovel-bucket { 0% { transform: rotate(0deg); } 40%, 55% { transform: rotate(18deg); }" +
      " 100% { transform: rotate(0deg); } }\n",
    // 「ブロロッ・ガシャン」：1本目のさわったときの音（候補A）と同じ形（追加修正1）。0.8秒まで
    //   1本目：ブロロッ（rumble 80→110Hz、0.7秒、1秒に16回ゆれる）＋ 0.2秒あとに「ガシャン」。
    //   ここでは、大きさを「ブーーン」に合わせるため、次のように整えた。
    //   ・ブロロッ：大きさ 0.36 → 0.44。ゆれの深さ 0.3 → 0.15、大きさを保つ時間を半分から 7割に（平均の大きさを上げるため）
    //   ・ガシャン：ブロロッのゆれが いちばん小さくなる時刻（0.234秒。1秒に16回のゆれの谷）に合わせて鳴らし、
    //     大きさを 1本目の半分くらいにした（重なったところのピークが大きくならないように）
    //   測った結果（下の値の 1/1.025 のとき）：ピーク 1.070、250Hz より下を削ったもの RMS 0.813。
    //   ピークが 1.1 をこえないところまで、1.025倍にした（見込み：ピーク 1.097、削ったもの RMS 0.833）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.8, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.rumble(ctx, 80, 110, t, 0.7, 0.451, 700, 16, 0.15, 0.7);  // ブロロッ（エンジン）
      var g = t + 0.234;                                           // ここから「ガシャン」
      S.tone(ctx, "sawtooth", 110, 75, g, 0.1, 0.102, 500);        // ガ（低い「ゴッ」）
      S.noise(ctx, g, 0.07, 0.184, 900);                           // ガ（にごった「ザッ」）
      S.noise(ctx, g + 0.05, 0.07, 0.113, 2800);                   // シャ
      S.noise(ctx, g + 0.10, 0.07, 0.092, 3200);                   // シャ
      S.noise(ctx, g + 0.15, 0.08, 0.072, 3000);                   // シャ
      S.tone(ctx, "sine", 390, 380, g + 0.19, 0.35, 0.0205, 0, 0); // ン（とても小さい、まるい響き）。0.774秒で終わる
    }
  });

  // =====================================================
  // 6. しょうぼうしゃ（fire、横 310）
  //    右に赤い運転席、左に赤い箱の車体（とびらの線、銀色のまいたホース）。屋根に たたんだはしご。
  //    運転席の上に赤いランプ。火・煙・水は描かない
  //    仕事（追加修正1）：はしごが、うしろのはしの支点 (40, 85) を中心に、前（右）が 18度 上がり、
  //          上がったあと、のびる段が前（右上）へ 25px のびて、ちぢんで、下がって戻る（0.7秒）。
  //          同時にランプが1回光る。
  //    いちばん動いたとき（18度・25px）の計算：はしごの中の座標 (x, y) は、
  //      絵の座標 (40 + x·cos18° + y·sin18°, 85 − x·sin18° + y·cos18°) になる（cos18° = 0.951、sin18° = 0.309）
  //      ・のびる段の右上の角 (200, -15) → (225.6, 8.9)。いちばん上。線をふくめて y 7.6（枠の上 y 5 より下）
  //      ・のびる段の右下の角 (200, 5)   → (231.7, 28.0)。いちばん右。線をふくめて x 233（枠の右 x 305 より左）
  //      ・うしろのはしの左上 (-5, -15)  → (30.6, 72.3)。いちばん左
  //      はしごは、運転席の上のランプ (262, 82) より左・上を通るので、ランプはかくれない
  // =====================================================
  // はしごの1段ぶん（うしろのはしの支点が (0, 0)。右へのびる）。x0 … 左はし、len … 長さ
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
    workTime: 700,
    lamp: true,
    draw: function () {
      return shadow(158, 140) +
        part("body",
          // はしごをのせる台：うしろは支点の台（はば 12）、前は はしごが下りたときに のる台。
          // 上のはしは、はしごのうしろにかくれる
          '<rect x="34" y="86" width="12" height="22" rx="2" fill="#9aa1a8"/>' +
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
        // はしご：うしろのはしの支点 (40, 85) を (0, 0) にして回す。
        // ふだんの場所は、前と同じ x 35〜215。中の .extend（下にかさなった段。x 35〜175）が、前（右）へのびる
        part("ladder",
          '<g transform="translate(40 85)"><g class="ladder-rot">' +
            '<g class="extend">' + ladderSection(35, 140, "#c3c8ce") + '</g>' +
            ladderSection(-5, 180, "#d9dde2") +
            '<circle r="5" fill="#c8ccd0" stroke-width="2.5"/>' +     // 支点のピン
          '</g></g>') +
        cab(225, 300, 90, 195, RED) +
        glowPart(262, 82) +
        lampPart(262, 82, 10, 10) +
        lights(295, 160, 10, 168) +
        tire(60, 23) + tire(160, 23) + tire(260, 23);
    },
    css:
      ".kuruma-car .ladder-rot, .kuruma-car .extend { transform-origin: 0 0; }\n" +
      ".kc-fire.kw-on .ladder-rot { animation: kuruma-fire-ladder 0.7s ease-in-out; }\n" +
      ".kc-fire.kw-on .extend { animation: kuruma-fire-extend 0.7s ease-in-out; }\n" +
      /* 前が上がってから のびて、ちぢめてから下がる（-18deg = 前が上がる向き） */
      "@keyframes kuruma-fire-ladder { 0% { transform: rotate(0deg); } 30%, 82% { transform: rotate(-18deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-fire-extend { 0%, 30% { transform: translateX(0); } 50%, 62% { transform: translateX(25px); }" +
      " 82%, 100% { transform: translateX(0); } }\n",
    // 「ウー・カンカン」（追加修正1）。1.4秒
    //   サイレン「ウー」：triangle 400 → 800 → 400Hz、0.9秒（ゆっくり鳴り始める 0.15秒）。2000Hz でやわらかく
    //   鐘「カン カン」：0.75秒と 1.0秒に。sine 1180Hz に、小さな 1770Hz を重ねた、すぐに小さくなる音（0.4秒）
    //   測った結果（0.18・0.127・0.032 のとき）：ピーク 0.317、250Hz より下を削ったもの RMS 0.800。
    //   1.19倍にした（見込み：ピーク 0.377、削ったもの RMS 0.952）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(1.4, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.glide(ctx, "triangle", [400, 800, 400], t, 0.9, 0.214, 2000, 0.15, 0.67);   // ウー
      var bells = [0.75, 1.0];
      for (var i = 0; i < bells.length; i++) {
        S.tone(ctx, "sine", 1180, 1170, t + bells[i], 0.4, 0.151, 0, 0);            // カン
        S.tone(ctx, "sine", 1770, 1760, t + bells[i], 0.3, 0.038, 0, 0);            // カン（鐘らしい響き）
      }
    }
  });

  // =====================================================
  // 7. きゅうきゅうしゃ（ambulance、横 280）
  //    まるみのある白い箱のくるま（運転席と車体がひと続きなので cab は作らず、body と window）。
  //    横に赤いライン、横の面に青い星の印（白地に赤い十字は描かない）。屋根に赤いランプを前とうしろに2つ
  //    仕事：ランプが1回光る（ほかは動かない）
  //    追加修正1：
  //      ・ハートを外して、青い星の印にした（はばのある棒3本を 60度ずつ回して重ねた6本の腕の星に、白い つえを1本。
  //        へびなどの細かい絵は描かない。形を簡単にした、このゲームだけの印）。中心 (70, 114)、腕の先まで 22。
  //        x 48〜92、y 92〜136（線をふくめても、まどの x 100 と、赤いラインの y 146 にかからない）
  //      ・うしろのランプ（中心 (60, 72)）を、横長の楕円（横の半径 17、縦の半径 7.5）にした。
  //        光の輪も楕円（外がわ 横 38・縦 24）で、x 22〜98、y 48〜96（枠の中）
  // =====================================================
  // 青い星の印（mark）。中心 (cx, cy)。ふちどりは、棒3本の外がわだけに見えるように、
  // こげ茶の太い棒を先に描いてから、青い棒を上に重ねる（棒の重なったところに線が出ない）
  function starMark(cx, cy) {
    var bars = function (fill, sw) {
      var s = "";
      for (var a = 0; a < 180; a += 60) {
        s += '<rect x="-6.5" y="-22" width="13" height="44" rx="4" transform="rotate(' + a + ')" fill="' + fill + '"' +
          (sw ? ' stroke="' + LINE + '" stroke-width="' + sw + '"' : ' stroke="none"') + '/>';
      }
      return s;
    };
    return part("mark",
      '<g transform="translate(' + cx + ' ' + cy + ')">' +
        bars(LINE, 5) +          // ふちどり（太い線の外がわ半分が、ふちに見える）
        bars("#2f6fd0", 0) +     // 青い星
        '<rect x="-1.8" y="-15" width="3.6" height="30" rx="1.8" fill="#ffffff" stroke="none"/>' +   // 白い つえ
        '<circle cx="0" cy="-15" r="2.6" fill="#ffffff" stroke="none"/>' +                           // つえの上の丸
      '</g>');
  }
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
        // 青い星の印
        starMark(70, 114) +
        // ランプと光の輪は、ランプごとに1つずつ（うしろは横長の楕円、前は丸）
        glowPart(60, 72, 38, 24) + glowPart(235, 72) +
        lampPart(60, 72, 17, 7.5) + lampPart(235, 72, 9, 9) +
        lights(264, 166, 10, 158) +
        tire(70, 23) + tire(215, 23);
    },
    // 「ピーポー」：本物に近い高さと長さ（追加修正1）。1.35秒
    //   ピー：triangle 960Hz、0.62秒 → ポー：triangle 770Hz、0.62秒。2200Hz でやわらかく（高い倍音をしぼる）
    //   測った結果（0.145 のとき）：ピーク 0.253、250Hz より下を削ったもの RMS 0.841。
    //   1.13倍にした（見込み：ピーク 0.286、削ったもの RMS 0.950）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(1.35, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "triangle", 960, 960, t, 0.62, 0.164, 2200, 0.75);       // ピー
      S.tone(ctx, "triangle", 770, 770, t + 0.64, 0.62, 0.164, 2200, 0.75); // ポー
    }
  });

  // =====================================================
  // 8. クレーンしゃ（crane、横 310）
  //    右に黄色の運転席、左に灰色の台と回る台。ななめに上がった黄色の長いうで（3段。追加修正1）、
  //    うでの先から細いロープと、丸い銀色のフック（とがらせない）。
  //    回る台の上（うでの付け根の左）に、クレーンを動かす小さな運転席（booth。うすい灰色に黄色の帯、窓1つ）
  //    仕事（追加修正1）：うでが付け根 (90, 140) を中心に 10度 上がり、上がったあと、いちばん先の段が
  //          うでの向きに 25px のびて、ちぢんで、下がって戻る（0.7秒）。フックはうでの先についていき、小さくゆれる。
  //    フック（hook）は、うで（boom）の中には入れない。うでと同じ中心・同じ角度・同じのび方で位置だけ動かし、
  //    その中で逆の角度に回して、フックが傾かないようにする
  //    いちばん動いたとき（傾き 34.82 + 10 = 44.82度、のび 25）の計算：
  //      うでの中の座標 (x, y) は、絵の座標 (90 + x·cos44.82° + y·sin44.82°, 140 − x·sin44.82° + y·cos44.82°)
  //      （cos44.82° = 0.7093、sin44.82° = 0.7049）
  //      ・先の段の右上の角 (175, -6) → (209.9, 12.4)。いちばん上。線をふくめて y 10.9（枠の上 y 5 より下）
  //      ・先の段の右下の角 (175, 6)  → (218.4, 20.9)。いちばん右（線をふくめて x 220。枠の右 x 305 より左）
  //      ・滑車 (170, 0) → (210.6, 20.2)。フックはそこから下へ 70 で、y 94 くらいまで。ゆれても x 200〜224
  //    ふだんの形：滑車は (209, 57.2)、フックの下は y 131 くらい
  // =====================================================
  var CRANE_ANGLE = -34.82;   // うでの、ふだんの傾き（付け根 (90, 140) から 先の向き）
  var CRANE_TIP = 145;        // 付け根から、ふだんの滑車までの長さ（うでの向き）
  add({
    id: "crane",
    name: "くれーんしゃ",
    width: 310,
    tip: { x: 130, y: 96 },
    workTime: 700,
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
        // クレーンを動かす運転席（回る台の上、うでの付け根の左。x 46〜84、y 96〜127）。
        // トラックの運転席（黄色）と見分けがつくように、うすい灰色に黄色の帯。窓1つ（中の人は描かない）。
        // うでは、いちばん上がっても、この運転席の右はし（x 84）より右を通る
        part("booth",
          '<path d="M 46 127 L 46 104 Q 46 96 54 96 L 76 96 Q 84 96 84 104 L 84 127 Z" fill="#dfe3e8" stroke="none"/>' +
          '<rect x="47" y="119" width="36" height="7" fill="#f7c33c" stroke="none"/>' +
          '<path d="M 46 127 L 46 104 Q 46 96 54 96 L 76 96 Q 84 96 84 104 L 84 127 Z" fill="none"/>' +
          '<rect x="52" y="101" width="26" height="14" rx="4" fill="#bfe4f5" stroke-width="2.5"/>' +
          '<path d="M 57 112 L 63 104" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.7"/>') +
        // うで：付け根 (90, 140) を (0, 0) にして回す。中では、うでの向きに沿って描く。
        // 3段：付け根の太い段（-8〜82）、まん中の段（70〜128）、先の細い段（85〜150。.boom-ext で先へのびる）。
        // 先の段は、まん中の段の中に入っている形なので、いちばんうしろに描く
        part("boom",
          '<g transform="translate(90 140)"><g class="boom-rot"><g transform="rotate(' + CRANE_ANGLE + ')">' +
            '<g class="boom-ext">' +
              '<rect x="85" y="-6" width="65" height="12" rx="5" fill="#f7c33c"/>' +
              '<path d="M 90 -2 L 144 -2" fill="none" stroke="#ffd96b" stroke-width="2.5"/>' +
              // 先の滑車
              '<circle cx="' + CRANE_TIP + '" cy="0" r="7" fill="#c8ccd0" stroke-width="2.5"/>' +
              '<circle cx="' + CRANE_TIP + '" cy="0" r="2" fill="' + LINE + '" stroke="none"/>' +
            '</g>' +
            // まん中の段
            '<rect x="70" y="-8.5" width="58" height="17" rx="6" fill="#f7c33c"/>' +
            '<path d="M 76 -3.5 L 122 -3.5" fill="none" stroke="#ffd96b" stroke-width="3"/>' +
            // 付け根の太い段（手前）
            '<rect x="-8" y="-11" width="90" height="22" rx="8" fill="#f7c33c"/>' +
            '<path d="M 0 -5 L 76 -5" fill="none" stroke="#ffd96b" stroke-width="4"/>' +
            '<path d="M 0 6 L 76 6" fill="none" stroke="#e0a52a" stroke-width="4"/>' +
            // 付け根のピン
            '<circle r="7" fill="#c8ccd0" stroke-width="2.5"/>' +
          '</g></g></g>') +
        // ロープとフック：うでと同じように回して（.hook-follow）、うでの向きに同じだけのばし（.hook-ext）、
        // 滑車の場所へ移してから、向きを元に戻して（rotate と .hook-upright）、まっすぐ下へ描く
        part("hook",
          '<g transform="translate(90 140)"><g class="hook-follow"><g transform="rotate(' + CRANE_ANGLE + ')">' +
            '<g class="hook-ext"><g transform="translate(' + CRANE_TIP + ' 0) rotate(' + (-CRANE_ANGLE) + ')">' +
              '<g class="hook-upright"><g class="hook-swing">' +
                '<path d="M 0 0 L 0 40" fill="none" stroke-width="2"/>' +
                '<rect x="-7" y="38" width="14" height="10" rx="3" fill="#c8ccd0" stroke-width="2.5"/>' +
                '<path d="M 0 48 L 0 53 Q 9 53 9 61 Q 9 70 0 70 Q -8 70 -8 63" fill="none" stroke-width="8"/>' +
                '<path d="M 0 48 L 0 53 Q 9 53 9 61 Q 9 70 0 70 Q -8 70 -8 63" fill="none" stroke="#c8ccd0" stroke-width="4"/>' +
              '</g></g>' +
            '</g></g>' +
          '</g></g></g>') +
        cab(225, 300, 100, 195, YELLOW) +
        lights(295, 166, 10, 160) +
        tire(60) + tire(150) + tire(260);
    },
    css:
      ".kuruma-car .boom-rot, .kuruma-car .boom-ext, .kuruma-car .hook-follow, .kuruma-car .hook-ext," +
      " .kuruma-car .hook-upright, .kuruma-car .hook-swing { transform-origin: 0 0; }\n" +
      /* うでと、フックの位置は、同じ動き（同じ角度・同じのび・同じ時間）。フックは逆の角度で回して、まっすぐ下を向いたままにする */
      ".kc-crane.kw-on .boom-rot, .kc-crane.kw-on .hook-follow { animation: kuruma-crane-boom 0.7s ease-in-out; }\n" +
      ".kc-crane.kw-on .boom-ext, .kc-crane.kw-on .hook-ext { animation: kuruma-crane-ext 0.7s ease-in-out; }\n" +
      ".kc-crane.kw-on .hook-upright { animation: kuruma-crane-upright 0.7s ease-in-out; }\n" +
      ".kc-crane.kw-on .hook-swing { animation: kuruma-crane-swing 0.7s ease-in-out; }\n" +
      /* 上がってから のびて、ちぢめてから下がる */
      "@keyframes kuruma-crane-boom { 0% { transform: rotate(0deg); } 30%, 82% { transform: rotate(-10deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-crane-upright { 0% { transform: rotate(0deg); } 30%, 82% { transform: rotate(10deg); }" +
      " 100% { transform: rotate(0deg); } }\n" +
      "@keyframes kuruma-crane-ext { 0%, 30% { transform: translateX(0); } 50%, 62% { transform: translateX(25px); }" +
      " 82%, 100% { transform: translateX(0); } }\n" +
      "@keyframes kuruma-crane-swing { 0%, 45% { transform: rotate(0deg); } 62% { transform: rotate(5deg); }" +
      " 80% { transform: rotate(-4deg); } 100% { transform: rotate(0deg); } }\n",
    // 「ウィーン カチャ」：やわらかい上がる音（180→260Hz）と、小さな「カチャ」。0.7秒
    //   追加修正1：形はそのまま。うでの のびる動きに合わせて「ウィーン」を 0.4秒 → 0.6秒にし、大きくした
    //   （triangle 0.14 → 0.18、まるみ 0.05 → 0.065、カチャ 0.08・0.06 → 0.18・0.14）。
    //   測った結果（0.207・0.075・0.207・0.161 のとき）：ピーク 0.498、250Hz より下を削ったもの RMS 0.806。
    //   1.18倍にした（見込み：ピーク 0.588、削ったもの RMS 0.951）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(0.7, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.tone(ctx, "triangle", 180, 260, t, 0.6, 0.244, 1000, 0.7);  // ウィーン
      S.tone(ctx, "sine", 180, 260, t, 0.6, 0.089, 0, 0.7);         // ウィーン（まるみ）
      S.noise(ctx, t + 0.62, 0.05, 0.244, 1200);                    // カ
      S.noise(ctx, t + 0.65, 0.05, 0.19, 1800);                     // チャ
    }
  });

  // =====================================================
  // 9. パトカー（police、横 270）
  //    まるみのある乗用車の形。上の半分が白、下の半分（y 155 から下）が黒。窓2枚。
  //    屋根のまん中に赤いランプ（横長）。文字・紋章・マークは描かない。
  //    運転席と車体がひと続きなので cab は作らず、body と window
  //    仕事：ランプが1回光る（形は動かない。光の輪は x 103〜167、y 62〜126 で、枠の中）
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
    // 「ウーウー」：本物に近い、上がって下がるサイレンを2回（追加修正1）。1.4秒
    //   ウー：triangle 450 → 850 → 450Hz、0.7秒（鳴り始め 0.08秒、7割まで同じ大きさ）を2回。1800Hz でやわらかく
    //   測った結果（0.15 のとき）：ピーク 0.264、250Hz より下を削ったもの RMS 0.835。
    //   1.14倍にした（見込み：ピーク 0.301、削ったもの RMS 0.952）
    sound: function () {
      var S = Kuruma.sound;
      if (!S) return;
      var ctx = S.beginSound(1.4, false);
      if (!ctx) return;
      var t = ctx.currentTime;
      S.glide(ctx, "triangle", [450, 850, 450], t, 0.7, 0.171, 1800, 0.08, 0.7);         // ウー
      S.glide(ctx, "triangle", [450, 850, 450], t + 0.7, 0.7, 0.171, 1800, 0.08, 0.7);   // ウー
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
