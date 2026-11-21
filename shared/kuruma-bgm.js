/* =====================================================
   はたらくくるま 共通の部品：BGM（Kuruma.bgm）
   ・このゲームだけのオリジナルの、明るい行進曲ふうの曲（ハ長調・4/4拍子・テンポ 112・16小節）
   ・ブラウザの機能 Web Audio API で、その場で音を作る（音声ファイルは使わない）
   ・音を作る道具（AudioContext）は、効果音（Kuruma.sound）とは別に、BGM 用に1つ持つ
   ・先読みのタイマー（100ms ごとに、0.3秒先までを予約）で音だけを予約する。
     画面の中身（DOM）は書き換えない
   ・最初に画面をさわったとき（pointerdown・pointerup）から鳴らし始める。ページを開いただけでは鳴らない
   ・音を消すと止まる（タイマーも止める）。画面が見えなくなったら止める
   ・曲の1小節ぶんを作る関数 scheduleBar は、実際に鳴らすときと、大きさを測るとき
     （OfflineAudioContext）の両方で使う
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  // ----- 曲の設定 -----
  var BPM = 112;                   // テンポ（1分間の拍の数）
  var BEAT = 60 / BPM;             // 1拍の長さ（約 0.536秒）
  var BAR_COUNT = 16;              // 1周の小節の数
  var BAR_SECONDS = BEAT * 4;      // 1小節の長さ（約 2.14秒。16小節で約 34秒）

  // ----- 音の大きさ（目安は docs の共通 BGM の書類。聞きくらべのページで測って合わせる） -----
  var LEVEL = 0.195;               // BGM 全体の音量つまみ（Kuruma.bgm.LEVEL で、あとから変えられる）
  var MELODY_PEAK = 0.29;          // 主旋律（triangle）
  var BASS_PEAK = 0.23;            // ベース（sine）
  var BASS_HARMONIC = 0.35;        // ベースに足す、1オクターブ上の音の割合（スマホのスピーカーでも聞こえるように）
  var CHORD_PEAK = 0.08;           // コード（sine）1音ぶん
  var HAT_PEAK = 0.05;             // 打楽器の「チッ」（noise）
  var MELODY_LOWPASS = 3000;       // 主旋律の高い音を丸くする（Hz）
  var HAT_BAND = 4000;             // 「チッ」の高さ（5000Hz 以下）

  // ----- ふるまいの設定 -----
  var LOOKAHEAD = 0.3;             // 何秒先までの音を予約するか
  var TICK_MS = 100;               // 予約のタイマーの間隔（ミリ秒）
  var FADE_FIRST = 1.5;            // 最初に鳴らすとき、ふわっと大きくなる時間（秒）
  var FADE_BACK = 0.5;             // 音を消したあと・戻ってきたあと、ふわっと戻る時間（秒）

  // ----- 音の高さ（ハ長調。MIDI の番号 → 周波数） -----
  var MIDI = { B3: 59, A3: 57, C3: 48, F3: 53, G3: 55,
               C4: 60, D4: 62, E4: 64, F4: 65, G4: 67,
               C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, C6: 84 };
  function hz(name) {
    return 440 * Math.pow(2, (MIDI[name] - 69) / 12);
  }

  // ----- 主旋律（小節ごとに [音名, 拍の数] を並べる。音名が null なら休み） -----
  //   1拍 = 1、半拍 = 0.5、2拍 = 2、付点4分 = 1.5。小節ごとに合計が 4 拍
  var MELODY = [
    [["C5", 1], ["E5", 1], ["G5", 1], ["E5", 1]],                      //  1
    [["A5", 1.5], ["G5", 0.5], ["E5", 2]],                             //  2
    [["F5", 1], ["A5", 1], ["C6", 1], ["A5", 1]],                      //  3
    [["G5", 2], ["E5", 1], ["D5", 1]],                                 //  4
    [["C5", 1], ["E5", 1], ["G5", 1], ["E5", 1]],                      //  5
    [["A5", 1.5], ["G5", 0.5], ["E5", 2]],                             //  6
    [["D5", 1], ["F5", 1], ["E5", 1], ["D5", 1]],                      //  7
    [["C5", 3], [null, 1]],                                            //  8
    [["E5", 0.5], ["E5", 0.5], ["E5", 1], ["G5", 1], ["E5", 1]],       //  9
    [["D5", 0.5], ["D5", 0.5], ["D5", 1], ["F5", 1], ["D5", 1]],       // 10
    [["C5", 0.5], ["E5", 0.5], ["G5", 1], ["C6", 1], ["G5", 1]],       // 11
    [["A5", 2], ["G5", 2]],                                            // 12
    [["E5", 0.5], ["E5", 0.5], ["E5", 1], ["G5", 1], ["E5", 1]],       // 13
    [["D5", 0.5], ["D5", 0.5], ["D5", 1], ["F5", 1], ["A5", 1]],       // 14
    [["G5", 1], ["F5", 1], ["E5", 1], ["D5", 1]],                      // 15
    [["C5", 2], [null, 2]]                                             // 16
  ];

  // ----- コード（小節ごとに [前半2拍, 後半2拍]） -----
  var CHORDS = [
    ["C", "C"], ["F", "C"], ["F", "F"], ["G", "G"],     //  1〜4
    ["C", "C"], ["F", "C"], ["G", "G"], ["C", "C"],     //  5〜8
    ["C", "C"], ["G", "G"], ["C", "C"], ["F", "F"],     //  9〜12
    ["C", "C"], ["G", "G"], ["C", "G"], ["C", "C"]      // 13〜16
  ];
  // コードごとの、ベースの根音と、重ねる3音
  var CHORD_NOTES = {
    C: { root: "C3", notes: ["C4", "E4", "G4"] },
    F: { root: "F3", notes: ["A3", "C4", "F4"] },
    G: { root: "G3", notes: ["B3", "D4", "G4"] }
  };

  // =====================================================
  // 音を作る部品
  // =====================================================

  // 音を1つ鳴らす部品。ふわっと始まって（attack 秒）、hold 秒まで同じ大きさ、そこから ふわっと小さくなる
  // （「ブツッ」という雑音を防ぐ）
  //   dest   … つなぐ先、type … 音色、freq … 高さ、start … 鳴らし始める時刻、length … 長さ（秒）
  function voice(ctx, dest, type, freq, start, length, peak, attack, hold) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + Math.max(attack, hold));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + length + 0.03);
  }

  // 曲の1小節ぶんの音を、時刻 t0 から予約する（実際に鳴らすときと、測るときの両方で使う）
  //   ctx … AudioContext か OfflineAudioContext、out … つなぐ先、barIndex … 何小節目か（0 から）
  function scheduleBar(ctx, out, t0, barIndex) {
    var i = barIndex % BAR_COUNT;
    var n, t, len, hold;

    // --- 主旋律：triangle。高い音を lowpass で丸くする ---
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = MELODY_LOWPASS;
    lp.connect(out);
    t = t0;
    for (n = 0; n < MELODY[i].length; n++) {
      len = MELODY[i][n][1] * BEAT;
      if (MELODY[i][n][0]) {
        // 短い音は 7 割まで保って、あとは小さく（行進曲らしく）。長い音は、終わりの 0.2秒だけ小さく
        hold = Math.max(len * 0.7, len - 0.2);
        voice(ctx, lp, "triangle", hz(MELODY[i][n][0]), t, len, MELODY_PEAK, 0.015, hold);
      }
      t += len;
    }

    // --- ベース：sine。1拍目と3拍目に、コードの根音（8分音符ぶん。やわらかく） ---
    // 根音そのままと、1オクターブ上の小さな音を重ねる（80Hz より下は使わない）
    var half, c, k;
    for (half = 0; half < 2; half++) {
      c = CHORD_NOTES[CHORDS[i][half]];
      t = t0 + half * 2 * BEAT;
      voice(ctx, out, "sine", hz(c.root), t, BEAT * 0.5, BASS_PEAK, 0.02, BEAT * 0.2);
      voice(ctx, out, "sine", hz(c.root) * 2, t, BEAT * 0.5, BASS_PEAK * BASS_HARMONIC, 0.02, BEAT * 0.2);

      // --- コード：sine を3音。2拍目と4拍目の裏（半拍ずらして）に、短く軽く ---
      t = t0 + (half * 2 + 1.5) * BEAT;
      for (k = 0; k < c.notes.length; k++) {
        voice(ctx, out, "sine", hz(c.notes[k]), t, 0.2, CHORD_PEAK, 0.015, 0.05);
      }
    }

    // --- 打楽器：ごく小さな「チッ」（noise を bandpass に通す。0.03秒。裏拍だけ） ---
    // 「ザーッ」のもとは、ふつうの乱数ではなく、決まった順番の数（測るたびに同じになるように）
    var rate = ctx.sampleRate;
    var noiseBuf = ctx.createBuffer(1, Math.floor(rate * 0.1), rate);
    var data = noiseBuf.getChannelData(0);
    var seed = 4321 + i;
    for (n = 0; n < data.length; n++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      data[n] = seed / 1073741824 - 1;
    }
    for (k = 0; k < 4; k++) {
      t = t0 + (k + 0.5) * BEAT;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      var band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = HAT_BAND;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(HAT_PEAK, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(band);
      band.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + 0.05);
    }
  }

  // =====================================================
  // 鳴らすしくみ
  // =====================================================
  var audioCtx = null;     // BGM 用の音を作る道具（最初にさわったときに用意する）
  var master = null;       // BGM 全体の音量つまみ（LEVEL）
  var session = null;      // 鳴らしているあいだだけある、ふわっと出入りする音量つまみ
  var timer = null;        // 先読みのタイマー
  var nextBar = 0;         // 次に予約する小節を始める時刻
  var barIndex = 0;        // 次に予約する小節の番号
  var armed = false;       // 画面をさわったか（さわるまでは鳴らさない）
  var muted = false;       // 音を消しているか
  var playedOnce = false;  // いちど鳴らしたか（最初だけ、ふわっと長めに）

  // 音を消しているか（BGM 自身の印と、効果音の側の印のどちらか）
  function isMutedNow() {
    if (muted) return true;
    return !!(Kuruma.sound && Kuruma.sound.isMuted && Kuruma.sound.isMuted());
  }

  // 音を作る道具を用意する（ブラウザの決まりで、画面を触る前は音を出せない）
  function getAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;                 // 音に対応していないブラウザでは何もしない
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = api.LEVEL;
      master.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  // 動いていなければ動かす（iPhone / iPad では「中断（interrupted）」になることもある）
  function wakeAudio() {
    if (audioCtx && audioCtx.state !== "running") {
      var resuming = audioCtx.resume();
      if (resuming && resuming.catch) resuming.catch(function () {});   // 動かせなくても、エラーにしない
    }
  }

  // 先読み：0.3秒先までに始まる小節を、まとめて予約する
  function tick() {
    if (!audioCtx || !session) return;
    if (isMutedNow() || document.hidden) {   // 音を消した・画面が見えない：止める
      stopPlaying(document.hidden);
      return;
    }
    var now = audioCtx.currentTime;
    if (nextBar < now - 0.05) nextBar = now + 0.05;   // タイマーがひどく遅れたときは、いまから始め直す
    while (nextBar < now + LOOKAHEAD) {
      scheduleBar(audioCtx, session, nextBar, barIndex);
      nextBar += BAR_SECONDS;
      barIndex = (barIndex + 1) % BAR_COUNT;
    }
  }

  // 鳴らし始める（fade 秒かけて、ふわっと大きくなる）
  function beginPlay() {
    var ctx = getAudio();
    if (!ctx) return;
    wakeAudio();
    var fade = playedOnce ? FADE_BACK : FADE_FIRST;
    playedOnce = true;
    master.gain.value = api.LEVEL;
    session = ctx.createGain();
    session.gain.setValueAtTime(0.0001, ctx.currentTime);
    session.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
    session.connect(master);
    nextBar = ctx.currentTime + 0.1;
    clearInterval(timer);
    timer = setInterval(tick, TICK_MS);
    tick();
  }

  // 止める：タイマーを止めて、いま予約している音は、すぐに小さくして外す。
  //   suspend が true なら、音を作る道具も止める（画面が見えなくなったとき）
  function stopPlaying(suspend) {
    clearInterval(timer);
    timer = null;
    if (session && audioCtx) {
      var old = session;
      session = null;
      try {
        var now = audioCtx.currentTime;
        if (old.gain.cancelAndHoldAtTime) {
          old.gain.cancelAndHoldAtTime(now);                   // いまの大きさ（ふわっと大きくなる途中でも）から、そのまま下げる
        } else {
          old.gain.cancelScheduledValues(now);
          old.gain.setValueAtTime(Math.max(0.0001, old.gain.value), now);
        }
        old.gain.linearRampToValueAtTime(0.0001, now + 0.1);   // すっと消す（ブツッを防ぐ）
      } catch (err) { /* 消せなくても、外すだけは行う */ }
      setTimeout(function () {
        try { old.disconnect(); } catch (err) { /* 何もしない */ }
      }, 300);
    }
    if (suspend && audioCtx && audioCtx.state === "running") {
      var p = audioCtx.suspend();
      if (p && p.catch) p.catch(function () {});
    }
  }

  // 鳴らしてよい状態なら、鳴らす（まだ鳴っていなければ始める。鳴っていれば、道具が動いているかだけ確かめる）
  function wake() {
    if (!armed || isMutedNow() || document.hidden) return;
    if (session) {
      wakeAudio();
      return;
    }
    beginPlay();
  }

  // ===== 画面をさわったとき =====
  // 最初の1本目の指（isPrimary）のさわりから、鳴らし始める。
  // 大人用のボタン（音を消す・もどる）をさわっただけでは、鳴らし始めない（音を消したい大人が、鳴らさないように）。
  // ただし、すでに鳴らす用意ができているときは、道具を動かし直す（iPhone / iPad 用）
  function onTouch(e) {
    if (e.isPrimary === false) return;
    var t = e.target;
    var adult = t && t.closest && t.closest(".adult-btn, #muteBtn, #homeBtn");
    // 鳴らす用意（armed）は、指がふれたとき（pointerdown）にだけ決める。
    // 大人用ボタンを押し始めて、外へずらして離したとき（pointerup が、ボタンの外で来る）に、鳴り始めないように
    if (e.type === "pointerdown" && !adult) armed = true;
    wake();
  }
  document.addEventListener("pointerdown", onTouch, true);
  document.addEventListener("pointerup", onTouch, true);

  // ===== 別のページ・アプリに行ったとき・トップ画面へ戻るとき =====
  // 止める。戻ってきたら、次にさわったときに、また鳴らす
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopPlaying(true);
  });
  window.addEventListener("pagehide", function () {
    stopPlaying(true);
  });

  // ===== 音を消す・出す =====
  function setMuted(value) {
    var was = muted;
    muted = !!value;
    if (muted) {
      stopPlaying(false);      // タイマーも止める
    } else if (was) {
      armed = true;            // 音を出すボタンを押したので、さわったことにする
      wake();                  // ふわっと戻る（0.5秒）
    }
  }

  // 効果音の側の音を消すボタン（Kuruma.sound.setMuted）を押したときも、BGM に伝える
  // （ボタンの処理は、ゲームの側で変えなくてよい）
  if (Kuruma.sound && Kuruma.sound.setMuted) {
    var soundSetMuted = Kuruma.sound.setMuted;
    Kuruma.sound.setMuted = function (value) {
      soundSetMuted(value);
      setMuted(value);
    };
  }

  // ===== 大きさを測るための作り方 =====
  // 曲の bars 小節ぶんを、スピーカーに出さずに作って、波のデータ（Float32Array）を返す（Promise）。
  // ゲームと同じ scheduleBar と LEVEL を使う（ふわっと出る部分は入れない）
  function render(bars) {
    bars = bars || BAR_COUNT;
    var rate = 44100;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error("OfflineAudioContext がありません"));
    var total = bars * BAR_SECONDS + 0.6;          // 最後の音の余り（0.6秒）を足す
    var off = new OAC(1, Math.ceil(rate * total), rate);
    var offMaster = off.createGain();
    offMaster.gain.value = api.LEVEL;
    offMaster.connect(off.destination);
    for (var b = 0; b < bars; b++) {
      scheduleBar(off, offMaster, b * BAR_SECONDS, b % BAR_COUNT);
    }
    return new Promise(function (resolve, reject) {
      var done = false;
      function finish(buffer) {
        if (done) return;
        done = true;
        resolve(buffer.getChannelData(0));
      }
      off.oncomplete = function (e) { finish(e.renderedBuffer); };   // 古い Safari 用
      var p = off.startRendering();
      if (p && p.then) p.then(finish, reject);
    });
  }

  var api = Kuruma.bgm = {
    BAR_COUNT: BAR_COUNT,
    BPM: BPM,
    BAR_SECONDS: BAR_SECONDS,
    LEVEL: LEVEL,
    start: function () { armed = true; wake(); },
    stop: function () { armed = false; stopPlaying(false); },
    setMuted: setMuted,
    render: render
  };
})();
