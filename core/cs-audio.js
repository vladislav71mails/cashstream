// КЭШ.СТРИМ — звуки (Web Audio API, без внешних файлов).
var CS = window.CS || (window.CS = {});

CS.DEFAULT_SETTINGS = {
  sound: true,
  volume: 0.45,
  bootAnim: true,
  lang: 'auto'
};

CS.ensureSettings = function (state) {
  if (!state.settings || typeof state.settings !== 'object') {
    state.settings = Object.assign({}, CS.DEFAULT_SETTINGS);
  } else {
    Object.keys(CS.DEFAULT_SETTINGS).forEach(function (k) {
      if (state.settings[k] === undefined) state.settings[k] = CS.DEFAULT_SETTINGS[k];
    });
  }
  return state.settings;
};

CS.Audio = (function () {
  var ctx = null;
  var unlocked = false;

  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function unlock() {
    var c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
  }

  function enabled(state) {
    if (!state || !state.settings) return true;
    return state.settings.sound !== false;
  }

  function vol(state) {
    var v = (state && state.settings && typeof state.settings.volume === 'number')
      ? state.settings.volume : 0.45;
    return Math.max(0, Math.min(1, v));
  }

  /** Простой тон: type, freq, dur, gain, when */
  function tone(opts) {
    var c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    var t0 = c.currentTime + (opts.when || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.freq || 440, t0);
    if (opts.freqEnd) {
      osc.frequency.linearRampToValueAtTime(opts.freqEnd, t0 + (opts.dur || 0.08));
    }
    var peak = (opts.gain != null ? opts.gain : 0.08);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.08));
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (opts.dur || 0.08) + 0.02);
  }

  function play(state, name) {
    if (!enabled(state)) return;
    unlock();
    var v = vol(state);
    if (v <= 0.001) return;

    if (name === 'click') {
      tone({ type: 'square', freq: 880, freqEnd: 660, dur: 0.04, gain: 0.06 * v });
    } else if (name === 'click_fail') {
      tone({ type: 'sawtooth', freq: 220, freqEnd: 110, dur: 0.12, gain: 0.07 * v });
    } else if (name === 'success') {
      tone({ type: 'square', freq: 523, dur: 0.06, gain: 0.07 * v });
      tone({ type: 'square', freq: 659, dur: 0.07, gain: 0.06 * v, when: 0.07 });
      tone({ type: 'square', freq: 784, dur: 0.1, gain: 0.05 * v, when: 0.14 });
    } else if (name === 'open') {
      tone({ type: 'triangle', freq: 400, freqEnd: 700, dur: 0.08, gain: 0.05 * v });
    } else if (name === 'close') {
      tone({ type: 'triangle', freq: 500, freqEnd: 280, dur: 0.07, gain: 0.04 * v });
    } else if (name === 'event') {
      tone({ type: 'square', freq: 330, dur: 0.1, gain: 0.08 * v });
      tone({ type: 'square', freq: 277, dur: 0.12, gain: 0.07 * v, when: 0.1 });
    } else if (name === 'event_lucky') {
      tone({ type: 'square', freq: 523, dur: 0.08, gain: 0.06 * v });
      tone({ type: 'square', freq: 659, dur: 0.1, gain: 0.06 * v, when: 0.09 });
    } else if (name === 'boot') {
      tone({ type: 'square', freq: 200, dur: 0.05, gain: 0.04 * v });
      tone({ type: 'square', freq: 300, dur: 0.05, gain: 0.04 * v, when: 0.08 });
      tone({ type: 'square', freq: 400, dur: 0.08, gain: 0.05 * v, when: 0.16 });
    } else if (name === 'notify') {
      tone({ type: 'sine', freq: 880, dur: 0.06, gain: 0.05 * v });
      tone({ type: 'sine', freq: 1175, dur: 0.08, gain: 0.04 * v, when: 0.07 });
    } else if (name === 'mail') {
      tone({ type: 'triangle', freq: 740, dur: 0.05, gain: 0.04 * v });
      tone({ type: 'triangle', freq: 990, dur: 0.07, gain: 0.035 * v, when: 0.08 });
    } else if (name === 'achievement') {
      tone({ type: 'square', freq: 523, dur: 0.07, gain: 0.06 * v });
      tone({ type: 'square', freq: 659, dur: 0.08, gain: 0.055 * v, when: 0.08 });
      tone({ type: 'square', freq: 784, dur: 0.1, gain: 0.05 * v, when: 0.16 });
      tone({ type: 'square', freq: 1046, dur: 0.12, gain: 0.04 * v, when: 0.26 });
    } else if (name === 'ui') {
      tone({ type: 'square', freq: 600, dur: 0.03, gain: 0.03 * v });
    } else if (name === 'roulette_tick') {
      // Щелчок шарика по сектору
      tone({ type: 'square', freq: 1800 + Math.random() * 400, dur: 0.018, gain: 0.035 * v });
    } else if (name === 'roulette_spin') {
      // Короткий «запуск» колеса
      tone({ type: 'sawtooth', freq: 120, freqEnd: 80, dur: 0.15, gain: 0.05 * v });
      tone({ type: 'square', freq: 900, dur: 0.03, gain: 0.03 * v, when: 0.02 });
    } else if (name === 'roulette_stop') {
      tone({ type: 'triangle', freq: 400, freqEnd: 200, dur: 0.12, gain: 0.06 * v });
      tone({ type: 'sine', freq: 600, dur: 0.08, gain: 0.04 * v, when: 0.1 });
    } else if (name === 'slot_tick') {
      // Тик барабана
      tone({ type: 'square', freq: 280 + Math.random() * 80, dur: 0.025, gain: 0.04 * v });
      tone({ type: 'noise' in {} ? 'square' : 'square', freq: 900, dur: 0.012, gain: 0.02 * v });
    } else if (name === 'slot_spin') {
      tone({ type: 'sawtooth', freq: 150, freqEnd: 90, dur: 0.1, gain: 0.045 * v });
      for (var i = 0; i < 3; i++) {
        tone({ type: 'square', freq: 320 + i * 40, dur: 0.03, gain: 0.03 * v, when: 0.04 + i * 0.05 });
      }
    } else if (name === 'slot_stop') {
      tone({ type: 'triangle', freq: 500, freqEnd: 220, dur: 0.1, gain: 0.05 * v });
    } else if (name === 'casino_win') {
      tone({ type: 'square', freq: 523, dur: 0.06, gain: 0.06 * v });
      tone({ type: 'square', freq: 659, dur: 0.06, gain: 0.055 * v, when: 0.07 });
      tone({ type: 'square', freq: 784, dur: 0.08, gain: 0.05 * v, when: 0.14 });
      tone({ type: 'square', freq: 1046, dur: 0.12, gain: 0.045 * v, when: 0.24 });
    } else if (name === 'casino_lose') {
      tone({ type: 'sawtooth', freq: 300, freqEnd: 120, dur: 0.18, gain: 0.05 * v });
    } else if (name === 'bank') {
      tone({ type: 'sine', freq: 440, dur: 0.05, gain: 0.04 * v });
      tone({ type: 'sine', freq: 554, dur: 0.06, gain: 0.035 * v, when: 0.06 });
    } else if (name === 'invest') {
      tone({ type: 'triangle', freq: 330, freqEnd: 520, dur: 0.1, gain: 0.04 * v });
    }
  }

  /** Повторяющиеся тики (рулетка / барабан). stop() — остановить. */
  function startLoop(state, tickName, intervalMs, maxMs) {
    if (!enabled(state)) return { stop: function () {} };
    unlock();
    var stopped = false;
    var t0 = Date.now();
    var id = setInterval(function () {
      if (stopped) return;
      if (maxMs && Date.now() - t0 > maxMs) {
        stopped = true;
        clearInterval(id);
        return;
      }
      play(state, tickName);
    }, intervalMs || 80);
    // первый тик сразу
    play(state, tickName);
    return {
      stop: function () {
        stopped = true;
        clearInterval(id);
      }
    };
  }

  return { play: play, unlock: unlock, enabled: enabled, vol: vol, startLoop: startLoop };
})();
