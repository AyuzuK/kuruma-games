/* =====================================================
   はたらくくるま 共通の部品：さわる操作（Kuruma.touch）
   ・画面にさわった瞬間（pointerdown）を受け取る。1本目の指（isPrimary）だけ
   ・大人用の長押しボタン（音を消す・トップ画面へ戻る）
   ・画面の大きさに合わせた、くるまを縮める率と、回転などのあとの合わせ直し
   ・指マーク「さわってね」（① 絵を作る ② 出す・消す ③ 5秒のタイマー ④ 重ならない場所の計算）
     「どこに出すか」「いつ出すか」は、ゲームの側で決める
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  // ----- 設定（1本目と同じ値） -----
  var HINT_TIME = 5000;        // 最後にさわってから、指マークをもう一度出すまでの時間（ミリ秒）
  var HINT_HEIGHT = 48;        // 指マークの、もともとの高さ（px）。kuruma-base.css の .finger-hint と同じ
  var HINT_WIDTH = 40;         // 指マークの、もともとの横幅（px）
  var HINT_TIP_X = 25.75;      // 指マークの絵の中で、指先のまん中の横の位置
  var HINT_MIN_SCALE = 0.75;   // 低い画面で、指マークをどこまで小さくしてよいか
  var HINT_GAP = 6;            // 避けるもの（上の文字・ボタン）と指マークのあいだに、最低これだけあける（px）
  var LONG_PRESS_TIME = 2000;  // 大人用ボタンの長押しの時間（ミリ秒）
  var FIT_WIDTH = 600;         // くるまを縮める率の計算：横幅がこれより小さいと縮める
  var FIT_HEIGHT = 500;        // くるまを縮める率の計算：高さがこれより小さいと縮める
  var MIN_SCALE = 0.5;         // くるまを、これより小さくしない

  // ===== 大人用ボタンへのタッチか =====
  // 大人用のボタンには class="adult-btn" を付ける。ボタンの中の絵（SVG）をさわったときも、ボタンとみなす
  function isAdultButton(target) {
    return !!(target && target.closest && target.closest(".adult-btn"));
  }

  // ===== 画面にさわった瞬間を受け取る =====
  //   handler(e) … ゲームの側の関数。さわったときの event をそのまま渡す
  // 大人用のボタンへのタッチと、2本目からの指は、ゲームに知らせない
  function onTap(handler) {
    document.addEventListener("pointerdown", function (e) {
      if (isAdultButton(e.target)) return;   // 大人用ボタンを触ったときは、くるまは動かさない
      if (!e.isPrimary) return;              // 手のひらで何本もの指がふれても、1本目の指だけに反応する
      handler(e);
    });
  }

  // ===== 大人用の長押しボタン =====
  //   btn    … ボタンの要素
  //   onDone … 2秒押し続けたときに呼ぶ関数
  // ・押しているあいだは .pressing が付いて、2秒かけて少しずつ大きくなる（見た目は kuruma-base.css）
  // ・2秒たつ前に離す・外にずれる・取り消される（pointerup・pointerleave・pointercancel）と取り消す
  // ・指で触ると、ブラウザは「指を離すまでボタンを触り続けている」とみなす（ポインターキャプチャ）。
  //   それを外して、指がずれたことに気づけるようにする（1本目と同じ）
  // ・iPhone の Safari では、指がずれても pointerleave が来ないことがあるので、
  //   長押しのあいだだけ window で、押した指（pointerId が同じ指）の動き・離した・取り消しを受け取り、
  //   指がボタンの四角の外に出たら取り消す。長押しが終わる・取り消されたら、受け取りを外す
  function longPress(btn, onDone) {
    var timer = null;      // 2秒を数えるタイマー
    var pointerId = null;  // いま押している指の番号（押していないときは null）
    var box = null;        // 押し始めたときのボタンの四角（大きくなる前の形）

    function onWindowMove(e) {
      if (e.pointerId !== pointerId || !box) return;
      if (e.clientX < box.left || e.clientX > box.right ||
          e.clientY < box.top || e.clientY > box.bottom) {
        cancel();
      }
    }
    function onWindowEnd(e) {
      if (e.pointerId !== pointerId) return;
      cancel();
    }
    function watch(on) {
      var method = on ? "addEventListener" : "removeEventListener";
      window[method]("pointermove", onWindowMove);
      window[method]("pointerup", onWindowEnd);
      window[method]("pointercancel", onWindowEnd);
    }

    // 取り消す（押しているあいだの表示も戻す）
    function cancel() {
      clearTimeout(timer);
      timer = null;
      if (pointerId !== null) watch(false);
      pointerId = null;
      box = null;
      btn.classList.remove("pressing");
    }

    btn.addEventListener("pointerdown", function (e) {
      if (!e.isPrimary) return;              // 1本目の指だけ
      if (btn.hasPointerCapture && btn.hasPointerCapture(e.pointerId)) {
        btn.releasePointerCapture(e.pointerId);
      }
      cancel();                              // 前の長押しが残っていたら、いったん消す
      box = btn.getBoundingClientRect();     // 大きくなる前に、ボタンの四角を覚えておく
      pointerId = e.pointerId;
      watch(true);
      btn.classList.add("pressing");
      timer = setTimeout(function () {
        cancel();
        onDone();
      }, LONG_PRESS_TIME);
    });

    // 押した指が離れた・ボタンの外に出た・取り消されたら、取り消す
    function onButtonEnd(e) {
      if (pointerId !== null && e.pointerId === pointerId) cancel();
    }
    btn.addEventListener("pointerup", onButtonEnd);
    btn.addEventListener("pointerleave", onButtonEnd);
    btn.addEventListener("pointercancel", onButtonEnd);

    // 長押ししても、メニューが出ないようにする
    btn.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    // ブラウザの「戻る」でこのページに戻ってきたとき、押しているあいだの表示が残らないようにする
    window.addEventListener("pageshow", cancel);

    return { cancel: cancel };
  }

  // ===== 音を消すボタン =====
  //   btn      … <button class="adult-btn mute-btn" id="muteBtn">
  //   onChange … 切りかえたあとに呼ぶ関数（muted を渡す。ボタンの大きさが変わるので、
  //              ゲームの側で指マークの場所を計算し直すのに使う）
  // 音を消したかどうかは保存しない（ページを開くたびに、音が出る状態から始まる）
  function setupMuteButton(btn, onChange) {
    function show() {
      var muted = Kuruma.sound ? Kuruma.sound.isMuted() : false;
      btn.textContent = muted ? "🔇" : "🔊";
      btn.classList.toggle("muted", muted);
      btn.setAttribute("aria-label",
        muted ? "おとを だす（2びょう ながおし）" : "おとを けす（2びょう ながおし）");
    }
    show();
    longPress(btn, function () {
      if (Kuruma.sound) Kuruma.sound.setMuted(!Kuruma.sound.isMuted());
      show();
      if (onChange) onChange(Kuruma.sound ? Kuruma.sound.isMuted() : false);
    });
  }

  // ===== トップ画面へ戻るボタン =====
  //   btn  … <button class="adult-btn home-btn" id="homeBtn">（<a> にしない。長押しでリンクの見本が出るため）
  //   href … 行き先（例：../../index.html）
  function setupHomeButton(btn, href) {
    longPress(btn, function () {
      window.location.href = href;
    });
  }

  // ===== 画面の大きさに合わせた、くるまを縮める率（1本目と同じ式） =====
  function fitScale() {
    var s = Math.min(1, window.innerWidth / FIT_WIDTH, window.innerHeight / FIT_HEIGHT);
    return Math.max(MIN_SCALE, s);    // 小さくなりすぎないように
  }

  // ===== 画面を回転させたり、アドレスバーが出たり引っこんだりしたときに、合わせ直す =====
  // iPhone / iPad の Safari では、知らせが来た瞬間には、まだ新しい高さ（dvh）が画面に
  // 反映されていないことがある。そこで、すぐに1回、次の描きかえのときに1回、
  // 0.3秒あとにもう1回、fn を呼ぶ（何回知らせが来ても、前の予約は消してから作り直す）
  function onViewportChange(fn) {
    var frame = 0;
    var timer = null;
    function handler() {
      fn();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fn);
      clearTimeout(timer);
      timer = setTimeout(fn, 300);
    }
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handler);
    }
  }

  // ===== 指マーク ① 絵を作る =====
  // 1本目と同じ形（右手の甲、にぎった指の付け根の山3つ、手の甲とひと続きの人さし指、
  // うしろにそわせた親指、クリーム色＋青いそで口＋白いふち）。
  // 白いふちは id を使わずに、同じ形の path をもう1つ書いて描く（同じ絵を何回作っても id がぶつからない）
  var HAND_SLEEVE = '<rect x="8" y="1" width="21" height="8" rx="3"/>';
  var HAND_THUMB = 'M 26 12 C 31 12, 34 15, 34 20 L 34 26 C 34 29, 29.5 29, 29.5 26 L 29 20 Z';
  var HAND_MAIN = 'M 9 8.5 L 28 8.5 C 29.8 8.5, 30.5 9.5, 30.5 11.5 L 30.5 42.25 A 4.75 4.75 0 0 1 21 42.25 ' +
    'L 21 28.5 C 21 31.5, 17.5 31.5, 16.5 30 C 15.5 32, 12 32, 11 30 C 9 31, 6 30, 6 27.5 L 6 12 C 6 9.5, 7 8.5, 9 8.5 Z';

  function createHint() {
    var el = document.createElement("div");
    el.className = "finger-hint";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<svg viewBox="0 0 40 48" focusable="false">' +
        // 白いふち（手全体のかげ絵を、うしろに白く太く敷く）
        '<g fill="#ffffff" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" opacity="0.9">' +
          HAND_SLEEVE +
          '<path d="' + HAND_THUMB + '"/>' +
          '<path d="' + HAND_MAIN + '"/>' +
        '</g>' +
        // ここから手。うしろの部品から順に描く
        '<g stroke="#5a3d1e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' +
          '<rect x="8" y="1" width="21" height="8" rx="3" fill="#4f8fd6"/>' +                 // そで口
          '<path d="' + HAND_THUMB + '" fill="#ffe2bd"/>' +                                   // 親指
          '<path d="' + HAND_MAIN + '" fill="#ffe2bd"/>' +                                    // 手の甲＋人さし指
          '<path d="M 16.5 30 L 16.5 25.5 M 11 30 L 11 26 M 21 28.5 L 21 25.5" fill="none" stroke-width="1.6"/>' + // 指の境目
        '</g>' +
      '</svg>';
    return el;
  }

  // ===== 指マーク ② 出す・消す（出るとき・消えるときは 0.4秒で ふわっと。見た目は kuruma-base.css） =====
  function showHint(el) { el.classList.add("show"); }
  function hideHint(el) { el.classList.remove("show"); }
  function isHintShown(el) { return el.classList.contains("show"); }

  // ===== 指マーク ③ 5秒のタイマー =====
  //   onTime … 5秒（HINT_TIME）たったときに呼ぶ関数（出すかどうかはゲームの側で決める）
  // restart() で数え直し、stop() で止める
  function hintTimer(onTime) {
    var timer = null;
    return {
      restart: function () {
        clearTimeout(timer);
        timer = setTimeout(onTime, HINT_TIME);
      },
      stop: function () {
        clearTimeout(timer);
        timer = null;
      }
    };
  }

  // ===== 指マーク ④ 重ならない場所の計算 =====
  //   tipX, tipY … 指先を置きたい場所（画面の左上からの px）
  //   avoid      … 避けるもの（要素、または {left, right, top, bottom} の四角）の一覧。
  //                上の文字と、大人用のボタンなど
  // 返すもの：{ scale: 指マークを小さくする率, drop: 下げる量（px） }
  // 1本目の placeHint() と同じ考え方：
  //   ① ふつうは、もとの大きさで、指先を (tipX, tipY) に置く
  //   ② 上にある「横に重なるもの」までのすき間が足りないときは、まず小さくする（HINT_MIN_SCALE まで）
  //   ③ それでも足りないときは、足りないぶんだけ下げる
  // 指マークは下へしか動かない（ゆっくり上下は下へ 8px）ので、止まっているときの上のはしだけ見ればよい
  function hintFit(tipX, tipY, avoid) {
    // 指マークがいちばん大きいときの、横のはば（小さくしても、この中におさまる）
    var left = tipX - HINT_TIP_X;
    var right = tipX + (HINT_WIDTH - HINT_TIP_X);
    var limit = -Infinity;   // 指マークの上のはしを、これより下にする（画面の上からの px）
    for (var i = 0; i < avoid.length; i++) {
      var a = avoid[i];
      if (!a) continue;
      var r = a.getBoundingClientRect ? a.getBoundingClientRect() : a;
      if (r.right <= r.left || r.bottom <= r.top) continue;              // 見えていないもの
      if (r.right + HINT_GAP <= left || r.left - HINT_GAP >= right) continue; // 横に重ならない
      if (r.top >= tipY) continue;                                        // 指先より下にあるもの
      limit = Math.max(limit, r.bottom + HINT_GAP);
    }
    var room = tipY - limit;          // 指先から上で、指マークに使える高さ
    var scale = 1;
    var drop = 0;
    if (room < HINT_HEIGHT) {
      scale = Math.max(HINT_MIN_SCALE, room / HINT_HEIGHT);   // ② 小さくする
      var h = HINT_HEIGHT * scale;
      if (room < h) drop = h - room;                          // ③ 下げる
    }
    return { scale: scale, drop: drop };
  }

  Kuruma.touch = {
    HINT_TIME: HINT_TIME,
    HINT_HEIGHT: HINT_HEIGHT,
    HINT_WIDTH: HINT_WIDTH,
    HINT_TIP_X: HINT_TIP_X,
    HINT_MIN_SCALE: HINT_MIN_SCALE,
    HINT_GAP: HINT_GAP,
    LONG_PRESS_TIME: LONG_PRESS_TIME,
    FIT_WIDTH: FIT_WIDTH,
    FIT_HEIGHT: FIT_HEIGHT,
    MIN_SCALE: MIN_SCALE,
    onTap: onTap,
    isAdultButton: isAdultButton,
    longPress: longPress,
    setupMuteButton: setupMuteButton,
    setupHomeButton: setupHomeButton,
    fitScale: fitScale,
    onViewportChange: onViewportChange,
    createHint: createHint,
    showHint: showHint,
    hideHint: hideHint,
    isHintShown: isHintShown,
    hintTimer: hintTimer,
    hintFit: hintFit
  };
})();
