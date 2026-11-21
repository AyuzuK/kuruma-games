/* =====================================================
   はたらくくるま 共通の部品：音（Kuruma.sound）
   ・ブラウザの機能 Web Audio API で、その場で音を作る（音声ファイルは使わない）
   ・全体の音量 0.5、同時に鳴らす音は3つまで、鳴り始めと終わりは ふわっと
   ・全体の音量のあとに「音の上限をおさえる仕組み」を入れて、重なっても割れないようにする
   ・iPhone / iPad のために、さわったとき・指を離したときに、音の道具を動かし直す
   ・音の大きさを数字で測れるように、スピーカーの代わりに「音を作るだけの道具」
     （OfflineAudioContext）へ鳴らす作り方（render）も用意している
   外に出す名前は window.Kuruma だけ。中身はこの関数の中に閉じこめている。
   ===================================================== */
(function () {
  "use strict";

  var Kuruma = window.Kuruma = window.Kuruma || {};

  // ----- 音の設定（1本目と同じ値） -----
  var VOLUME = 0.5;        // 全体の音量（0〜1。0.5 = 最大の半分くらい）
  var MAX_VOICES = 3;      // 同時に鳴らす音の数の上限（連打しても音が重なりすぎないように）
  var HORN_GAP = 200;      // クラクション「プッ」を、次に鳴らせるまでの間隔（ミリ秒）
  var NOISE_SECONDS = 0.8; // 「ザーッ」という音のもとの長さ（秒）。ダンプカーの「ザザー」（0.7秒）が入る長さ
  var POYON_GAP = 200;     // 「ぽよん」を、次に鳴らせるまでの間隔（ミリ秒。「プッ」の HORN_GAP と同じ考え方）

  // 音の上限をおさえる仕組み（DynamicsCompressor）の設定。
  // 全体の音量つまみ（master）のあとに入れて、音が3つ重なっても、割れたり急に大きくなったりしないようにする。
  //   1つの音（いちばん大きいところが 0.3 くらいまで）は、ほとんどそのまま通る。
  //   重なって 0.5（-6dB）をこえたところから、ゆるやかに（6dB の幅で）おさえ始め、こえたぶんを 1/12 にする。
  //   ※ この仕組みは、決まりで「全体を少し持ち上げる」（Edge で測って だいたい 1.27倍）。
  //     全体の音量 0.5 を変えないように、そのあとで同じぶん（LIMIT_UNDO）下げて元の大きさに戻す
  var LIMIT_THRESHOLD = -6;    // おさえ始める大きさ（dB）
  var LIMIT_UNDO = 0.79;       // 持ち上がったぶんを戻す（1 ÷ 1.27）
  var LIMIT_KNEE = 6;          // ゆるやかにおさえ始める幅（dB）
  var LIMIT_RATIO = 12;        // こえたぶんを何分の1にするか
  var LIMIT_ATTACK = 0.003;    // おさえ始めるまでの時間（秒）
  var LIMIT_RELEASE = 0.25;    // おさえるのをやめるまでの時間（秒）

  var audioCtx = null;     // 音を作る道具（最初に画面を触ったときに用意する）
  var master = null;       // 全体の音量つまみ
  var noiseBuffer = null;  // 「シャッ」「ザザー」という音のもとになる「ザーッ」という音
  var voices = 0;          // いま鳴っている音の数
  var muted = false;       // 音を消しているか

  // 部品（tone・noise・rumble）がつなぐ先。ふだんは master。
  // 音の大きさを測るときだけ、計測用の道具の音量つまみに入れかえる
  var out = null;
  var outNoise = null;
  var renderCtx = null;    // 計測中だけ入る「時刻をずらした計測用の道具」

  // 音の上限をおさえる仕組みを作って、from → おさえる仕組み → to とつなぐ。
  // ゲーム（スピーカー）と、大きさを測る道具（render）の両方で、この同じ関数を使う
  function connectLimiter(ctx, from, to) {
    if (!ctx.createDynamicsCompressor) {   // とても古いブラウザでは、そのままつなぐ
      from.connect(to);
      return;
    }
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMIT_THRESHOLD;
    limiter.knee.value = LIMIT_KNEE;
    limiter.ratio.value = LIMIT_RATIO;
    limiter.attack.value = LIMIT_ATTACK;
    limiter.release.value = LIMIT_RELEASE;
    var undo = ctx.createGain();
    undo.gain.value = LIMIT_UNDO;
    from.connect(limiter);
    limiter.connect(undo);
    undo.connect(to);
  }

  // 音を作る道具を用意する（ブラウザの決まりで、画面を触る前は音を出せない）
  function getAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;              // 音に対応していないブラウザでは何もしない
      audioCtx = new AC();

      master = audioCtx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      // 全体の音量つまみ → 音の上限をおさえる仕組み → スピーカー
      connectLimiter(audioCtx, master, audioCtx.destination);

      // 「ザーッ」という音（NOISE_SECONDS 秒分）を作っておく
      var length = Math.floor(audioCtx.sampleRate * NOISE_SECONDS);
      noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    // 動いていなければ動かす。「一時停止（suspended）」のほか、
    // iPhone/iPad ではほかのアプリから戻ったときなどに「中断（interrupted）」になることがある
    if (audioCtx.state !== "running") {
      var resuming = audioCtx.resume();
      // 動かせなかったときも、エラーにしない（次にさわったとき、もう一度ためす）
      if (resuming && resuming.catch) resuming.catch(function () {});
    }
    return audioCtx;
  }

  // 音を鳴らしてよいか確かめて、準備する
  //   seconds   … その音の長さ（秒）
  //   important … true なら、同時に鳴る数の上限に関係なく鳴らす（走りさり・入ってきた音）
  // 鳴らせないとき（音を消している・上限に達している）は null を返す
  function beginSound(seconds, important) {
    if (renderCtx) return renderCtx;      // 大きさを測っているときは、計測用の道具を返す
    if (muted) return null;
    if (!important && voices >= MAX_VOICES) return null;
    var ctx = getAudio();
    if (!ctx) return null;

    out = master;
    outNoise = noiseBuffer;
    voices++;
    setTimeout(function () { voices--; }, seconds * 1000); // 鳴り終わったら数を減らす
    return ctx;
  }

  // 「ポー」のような音を1つ鳴らす部品（1本目と同じ）
  //   type      … 音色（"sine" やわらかい / "triangle" 少し明るい / "sawtooth" ブーッとした音）
  //   freqStart → freqEnd … 音の高さ（だんだん変わる）
  //   start     … 鳴らし始める時刻、length … 長さ（秒）、peak … 大きさ
  //   filterFreq … 指定すると、キンキンする高い音を削ってやわらかくする（使わないときは 0）
  //   holdRatio … 長さのうち、どこまで同じ大きさを保つか（省略すると 0.5 = 半分まで）
  function tone(ctx, type, freqStart, freqEnd, start, length, peak, filterFreq, holdRatio) {
    if (holdRatio === undefined) holdRatio = 0.5;
    var osc = ctx.createOscillator();   // 音のもと
    var gain = ctx.createGain();        // 音の大きさ
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + length);

    // ふわっと始まって（0.02秒）、少し続いて、ふわっと終わる（「ブツッ」という雑音を防ぐ）
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.setValueAtTime(peak, start + Math.max(0.02, length * holdRatio));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    osc.connect(gain);
    var last = gain;
    if (filterFreq) {
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = filterFreq;
      gain.connect(filter);
      last = filter;
    }
    last.connect(out);

    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  // 高さが何段階かに変わる音を1つ鳴らす部品（サイレンの「ウーン」など）。
  // tone とちがい、大きさの形は1つのまま（途中で小さくならない）で、高さだけを変える
  //   freqs  … 高さの並び（例：[450, 600, 450]。長さの中に、同じ間隔で並べて、なめらかに変える）
  //   attack … 鳴り始めに何秒かけて大きくするか（0.02 より短くしない。省略で 0.02）
  //   holdRatio … 長さのうち、どこまで同じ大きさを保つか（省略すると 0.5 = 半分まで）
  function glide(ctx, type, freqs, start, length, peak, filterFreq, attack, holdRatio) {
    attack = Math.max(0.02, attack || 0.02);
    if (holdRatio === undefined) holdRatio = 0.5;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0], start);
    for (var i = 1; i < freqs.length; i++) {
      osc.frequency.linearRampToValueAtTime(freqs[i], start + length * i / (freqs.length - 1));
    }
    // ふわっと始まって、少し続いて、ふわっと終わる
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, start + Math.max(attack, length * holdRatio));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    osc.connect(gain);
    var last = gain;
    if (filterFreq) {
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = filterFreq;
      gain.connect(filter);
      last = filter;
    }
    last.connect(out);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  // 「シャッ」「ザザー」という音を1つ鳴らす部品（1本目と同じ。鳴り始めは 0.01秒）
  //   length は NOISE_SECONDS（0.8秒）まで（もとの「ザーッ」の長さのため）
  //   bandFreq … 残す高さ。キンキンしないように 3200Hz 以下で使う
  //   holdRatio … 長さのうち、どこまで同じ大きさを保つか（省略すると 0 = すぐに小さくなり始める。1本目と同じ）
  function noise(ctx, start, length, peak, bandFreq, holdRatio) {
    var src = ctx.createBufferSource();
    src.buffer = outNoise;
    var filter = ctx.createBiquadFilter();
    filter.type = "bandpass";              // 決まった高さのあたりだけを残す
    filter.frequency.value = bandFreq;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    if (holdRatio) {
      gain.gain.setValueAtTime(peak, start + Math.max(0.01, length * holdRatio));
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(start);
    src.stop(start + length + 0.05);
  }

  // 「ゴロゴロ」したゆれのある低い音を作る部品（1本目の「ブロロッ」と同じ）
  //   wobbleRate  … 1秒に何回ゆらすか
  //   wobbleDepth … ゆれの深さ（0〜0.5）。ゆれは大きさを下げる向きだけなので、peak より大きくならない
  function rumble(ctx, freqStart, freqEnd, start, length, peak, filterFreq, wobbleRate, wobbleDepth, holdRatio) {
    if (holdRatio === undefined) holdRatio = 0.5;
    var osc = ctx.createOscillator();     // 音のもと（ブーッとした音）
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + length);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.setValueAtTime(peak, start + Math.max(0.02, length * holdRatio));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    // ゴロゴロのゆれ：まんなかの大きさ（1 − 深さ）に、ゆっくりの波（± 深さ）を足す
    var wobble = ctx.createGain();
    wobble.gain.value = 1 - wobbleDepth;
    var lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = wobbleRate;
    var lfoAmount = ctx.createGain();
    lfoAmount.gain.value = wobbleDepth;
    lfo.connect(lfoAmount);
    lfoAmount.connect(wobble.gain);       // 音ではなく「大きさのつまみ」につなぐ

    // 高い音を削ってやわらかくする（sawtooth には必ずかける）
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;

    osc.connect(gain);
    gain.connect(wobble);
    wobble.connect(filter);
    filter.connect(out);

    osc.start(start);
    lfo.start(start);
    osc.stop(start + length + 0.05);
    lfo.stop(start + length + 0.05);
  }

  // ===== 共通の音（9台とも同じ。1本目と同じ値） =====
  // 走りさる「ブーーン」は、仕事の音の大きさの基準でもある（聞きくらべのページで、くらべて測る）

  // 入ってきて止まったときの音：「ピポッ♪」
  function playArrive() {
    var ctx = beginSound(0.35, true);
    if (!ctx) return;
    var t = ctx.currentTime;
    tone(ctx, "sine", 880, 880, t, 0.14, 0.4);            // ピ
    tone(ctx, "sine", 1320, 1320, t + 0.15, 0.18, 0.4);   // ポッ
  }

  // 走りさり・入ってくるあいだにさわったときの音：やさしいクラクション「プッ」（0.16秒）
  //   前の「プッ」から HORN_GAP（0.2秒）たっていないときは鳴らさない。同時に3つまでの決まりに入れる
  var lastHornTime = -Infinity;
  function playHorn() {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!renderCtx && now - lastHornTime < HORN_GAP) return;
    var ctx = beginSound(0.2, false);
    if (!ctx) return;
    if (!renderCtx) lastHornTime = now;
    var t = ctx.currentTime;
    tone(ctx, "triangle", 466, 460, t, 0.16, 0.18, 1500); // プ（やわらかい低めの音）
    tone(ctx, "sine", 587, 580, t, 0.16, 0.16);           // ッ（少し高い音を重ねて、クラクションらしく）
  }

  // 右はしから走りさるときの音：「ブーーン」（seconds 秒。走る時間に合わせる）
  function playDrive(seconds) {
    var ctx = beginSound(seconds, true);
    if (!ctx) return;
    tone(ctx, "sawtooth", 80, 160, ctx.currentTime, seconds, 0.5, 700);
  }

  // ===== 3択のゲーム（だれの かげかな？）の音 =====

  // ちがうくるまを さわったときの音：「ぽよん」（0.42秒）
  //   ブブーに聞こえないように、まるい音（sine・triangle）だけで作る。
  //   「ぽ」は 520 → 400Hz、「よん」は 330 → 440 → 392Hz と上がって、はじめの高さ（330Hz）より高いところで終わる。
  //   前の「ぽよん」から POYON_GAP（0.2秒）たっていないときは鳴らさない。同時に3つまでの決まりに入れる
  var lastPoyonTime = -Infinity;
  function playPoyon() {
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!renderCtx && now - lastPoyonTime < POYON_GAP) return;
    var ctx = beginSound(0.45, false);
    if (!ctx) return;
    if (!renderCtx) lastPoyonTime = now;
    var t = ctx.currentTime;
    // 大きさは、計算で見積もって、目安（ブーーン比 0.6〜0.85）のまん中あたりに入る値にしてある
    tone(ctx, "sine", 520, 400, t, 0.12, 0.145);                           // ぽ
    glide(ctx, "triangle", [330, 440, 392], t + 0.10, 0.32, 0.117, 1400);  // よん（やわらかく）
    glide(ctx, "sine", [330, 440, 392], t + 0.10, 0.32, 0.054);            // よん（まるみを足す）
  }

  // 正しいくるまを さわったときの音：「ピポピン♪」（0.61秒）
  //   「ピポッ♪」と同じ やさしい sine で、1音たして上がっていく形。いちばん高い音は 1320Hz まで。
  //   正解の合図なので、同時に3つまでの上限には関係なく鳴らす（「ピポッ♪」と同じ）
  function playCorrect() {
    var ctx = beginSound(0.65, true);
    if (!ctx) return;
    var t = ctx.currentTime;
    tone(ctx, "sine", 880, 880, t, 0.12, 0.223);                  // ピ
    tone(ctx, "sine", 1175, 1175, t + 0.13, 0.12, 0.211);         // ポ
    tone(ctx, "sine", 1320, 1320, t + 0.26, 0.35, 0.211, 0, 0.3); // ピン（はじめの3割は同じ大きさ、あとは ゆっくり小さく）
    tone(ctx, "sine", 660, 660, t + 0.26, 0.35, 0.074, 0, 0.3);   // ピン（細くなりすぎないように、低い音を重ねる）
  }

  // ===== 音を消す・出す =====
  function setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : VOLUME; // 鳴っている音もすぐ消す
  }
  function isMuted() {
    return muted;
  }

  // ===== 音の大きさを測るための作り方 =====
  // 「いまの時刻」だけを start 秒にずらした、計測用の道具の代わり
  function shiftedCtx(real, start) {
    return {
      currentTime: start,
      sampleRate: real.sampleRate,
      createOscillator:   function () { return real.createOscillator(); },
      createGain:         function () { return real.createGain(); },
      createBiquadFilter: function () { return real.createBiquadFilter(); },
      createBufferSource: function () { return real.createBufferSource(); }
    };
  }

  // 測るときの「ザーッ」は、毎回同じものを使う（数字がはかるたびに変わらないように）
  var renderNoiseData = null;
  function getRenderNoise(rate) {
    if (!renderNoiseData || renderNoiseData.rate !== rate) {
      var data = new Float32Array(Math.floor(rate * NOISE_SECONDS));   // ゲームと同じ長さ
      var seed = 12345;                    // 決まった順番の「でたらめな数」を作る
      for (var i = 0; i < data.length; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        data[i] = seed / 1073741824 - 1;
      }
      renderNoiseData = { rate: rate, data: data };
    }
    return renderNoiseData.data;
  }

  // 音を、スピーカーに出さずに作って、波のデータ（Float32Array）を返す
  //   fn   … 鳴らす関数（playArrive や、くるまの仕事の音など）
  //   opts … times（何回鳴らすか。省略で 1）、gap（何秒おきか。省略で 0.25）、
  //           seconds（1回ぶんの長さ。省略で 1.0）、rate（1秒あたりの数。省略で 44100）
  // ゲームと同じく、全体の音量 VOLUME → 音の上限をおさえる仕組み を通して作る
  function render(fn, opts) {
    opts = opts || {};
    var times = opts.times || 1;
    var gap = opts.gap === undefined ? 0.25 : opts.gap;
    var seconds = opts.seconds || 1.0;
    var rate = opts.rate || 44100;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error("OfflineAudioContext がありません"));

    var total = (times - 1) * gap + seconds;
    var off = new OAC(1, Math.ceil(rate * total), rate);
    var offMaster = off.createGain();
    offMaster.gain.value = VOLUME;
    connectLimiter(off, offMaster, off.destination);   // ゲームと同じ形
    var offNoise = off.createBuffer(1, Math.floor(rate * NOISE_SECONDS), rate);
    offNoise.getChannelData(0).set(getRenderNoise(rate));

    var keepOut = out, keepNoise = outNoise;
    out = offMaster;
    outNoise = offNoise;
    try {
      for (var i = 0; i < times; i++) {
        renderCtx = shiftedCtx(off, i * gap);
        fn();
      }
    } finally {
      renderCtx = null;
      out = keepOut;
      outNoise = keepNoise;
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

  // iPhone や iPad では、指を「離したとき」でないと音の準備ができないことがあるので、ここでも準備する
  // （音を消しているときは、道具を作るだけで、音は鳴らさない）
  document.addEventListener("pointerup", function () {
    getAudio();
  });

  Kuruma.sound = {
    VOLUME: VOLUME,
    MAX_VOICES: MAX_VOICES,
    HORN_GAP: HORN_GAP,
    NOISE_SECONDS: NOISE_SECONDS,
    POYON_GAP: POYON_GAP,
    prepare: getAudio,
    beginSound: beginSound,
    tone: tone,
    glide: glide,
    noise: noise,
    rumble: rumble,
    playArrive: playArrive,
    playHorn: playHorn,
    playDrive: playDrive,
    playPoyon: playPoyon,
    playCorrect: playCorrect,
    setMuted: setMuted,
    isMuted: isMuted,
    render: render
  };
})();
