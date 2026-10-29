import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoFormats, recordCanvasVideo } from '../src/video-export.js';

// Native recording is integration-tested in a browser. These tests exercise the
// real recorder wrapper with controllable platform events and track every timer,
// media track and visibility/abort listener owned by it.
async function withPlatform(options, run) {
  const originals = { document: globalThis.document, MediaRecorder: globalThis.MediaRecorder, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const timers = new Set(), tracks = [], recorders = [], signals = [];
  class Page extends EventTarget {
    hidden = Boolean(options.hidden);
    listeners = new Set();
    addEventListener(type, listener, settings) { this.listeners.add(listener); super.addEventListener(type, listener, settings); }
    removeEventListener(type, listener) { this.listeners.delete(listener); super.removeEventListener(type, listener); }
  }
  const page = new Page();
  class Recorder {
    static isTypeSupported(type) { return (options.formats || ['video/webm;codecs=vp8']).includes(type); }
    constructor(stream, settings) {
      if (options.constructorError) throw new Error('encoder allocation failed');
      this.state = 'inactive'; this.mimeType = settings.mimeType; recorders.push(this);
    }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      if (options.stopError) throw new Error('encoder stop failed');
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(options.empty ? [] : ['encoded video']) });
        this.onstop?.();
      });
    }
  }
  globalThis.document = page; globalThis.MediaRecorder = Recorder;
  globalThis.setTimeout = (callback, delay, ...args) => {
    const handle = originals.setTimeout(() => { timers.delete(handle); callback(...args); }, delay);
    timers.add(handle); return handle;
  };
  globalThis.clearTimeout = handle => { timers.delete(handle); originals.clearTimeout(handle); };
  const canvas = { width: 720, height: 1280, captureStream() {
    const track = { stopped: false, requestFrame() {}, stop() { this.stopped = true; } };
    if (options.automaticFrames) delete track.requestFrame;
    tracks.push(track); return { getTracks: () => [track], getVideoTracks: () => [track] };
  } };
  function controller() {
    const control = new AbortController(), listeners = new Set(), signal = control.signal;
    const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = (type, listener, opts) => { listeners.add(listener); add(type, listener, opts); };
    signal.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
    signals.push(listeners); return control;
  }
  const record = overrides => recordCanvasVideo(canvas, { duration: 0.04, fps: 24, renderFrame() {}, ...overrides });
  function assertReleased() {
    assert.ok(tracks.every(track => track.stopped), 'all media tracks stopped');
    assert.equal(timers.size, 0, 'all recording and watchdog timers cleared');
    assert.equal(page.listeners.size, 0, 'visibility listener removed');
    assert.ok(signals.every(listeners => listeners.size === 0), 'abort listeners removed');
    for (const recorder of recorders) {
      assert.equal(recorder.state, 'inactive');
      assert.equal(recorder.ondataavailable, null); assert.equal(recorder.onstop, null);
      // A late platform error must be harmless, including after cancellation.
      let prevented = false;
      assert.doesNotThrow(() => recorder.onerror?.({ error: new Error('late native error'), preventDefault() { prevented = true; } }));
      assert.ok(prevented, 'late recorder errors are safely consumed');
    }
  }
  try { await run({ record, page, tracks, recorders, controller, assertReleased }); }
  finally {
    for (const timer of timers) originals.clearTimeout(timer);
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('formats prefer level-4 H264 MP4, then WebM VP9, and have baseline/generic fallbacks', async () => {
  const all = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.420028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'];
  await withPlatform({ formats: all }, async () => {
    assert.deepEqual(getVideoFormats(), [
      { label: 'MP4', extension: 'mp4', mimeType: all[0] },
      { label: 'WebM', extension: 'webm', mimeType: all[3] },
    ]);
  });
  for (const type of ['video/mp4;codecs=avc1.420028', 'video/mp4', 'video/webm;codecs=vp8']) {
    await withPlatform({ formats: [type] }, async () => assert.equal(getVideoFormats()[0].mimeType, type));
  }
  await withPlatform({ formats: [] }, async () => assert.deepEqual(getVideoFormats(), []));
});

test('successful recording returns encoded data, final frame, and releases every resource', { timeout: 1000 }, async () => {
  await withPlatform({}, async ({ record, controller, assertReleased }) => {
    const frames = [], progress = [], control = controller();
    const result = await record({ signal: control.signal, renderFrame: time => frames.push(time), onProgress: value => progress.push(value) });
    assert.equal(result.mimeType, 'video/webm;codecs=vp8'); assert.ok(result.blob.size > 0);
    assert.equal(frames[0], 0); assert.equal(frames.at(-1), 0.04); assert.equal(progress.at(-1), 1);
    assertReleased();
  });
});

test('AbortSignal cancellation during a progress callback leaves no newly scheduled timer', async () => {
  await withPlatform({}, async ({ record, controller, assertReleased }) => {
    const control = controller();
    await assert.rejects(record({ signal: control.signal, onProgress: () => control.abort() }), { name: 'AbortError' });
    assertReleased();
  });
});

test('hidden-page transition cancels instead of reporting a successful frozen video', async () => {
  await withPlatform({}, async ({ record, page, assertReleased }) => {
    const pending = record(); page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    await assert.rejects(pending, /页面进入后台/); assertReleased();
  });
});

test('starting hidden rejects before allocating any media tracks', async () => {
  await withPlatform({ hidden: true }, async ({ record, tracks, assertReleased }) => {
    await assert.rejects(record(), /保持此页面可见/); assert.equal(tracks.length, 0); assertReleased();
  });
});

test('native encoder errors reject and late encoder events remain harmless', async () => {
  await withPlatform({}, async ({ record, recorders, assertReleased }) => {
    const pending = record(); let prevented = false;
    recorders[0].onerror({ error: new Error('hardware encoder failed'), preventDefault() { prevented = true; } });
    await assert.rejects(pending, /hardware encoder failed/); assert.ok(prevented); assertReleased();
  });
});

test('render failure after recording starts releases native resources', async () => {
  await withPlatform({}, async ({ record, assertReleased }) => {
    let frames = 0;
    await assert.rejects(record({ renderFrame() { if (++frames === 2) throw new Error('render failed'); } }), /render failed/);
    assertReleased();
  });
});

test('allocation failure, stop failure and empty output are errors with cleanup', { timeout: 1000 }, async () => {
  for (const [options, error] of [[{ constructorError: true }, /allocation failed/], [{ stopError: true }, /stop failed/], [{ empty: true }, /未生成有效视频/]]) {
    await withPlatform(options, async ({ record, assertReleased }) => { await assert.rejects(record(), error); assertReleased(); });
  }
});

test('captureStream fps fallback closes both replaced and active tracks', { timeout: 1000 }, async () => {
  await withPlatform({ automaticFrames: true }, async ({ record, tracks, assertReleased }) => {
    await record(); assert.equal(tracks.length, 2); assertReleased();
  });
});
