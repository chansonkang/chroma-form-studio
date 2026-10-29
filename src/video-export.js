/** Supported native encoders, in preferred container order. No remote service. */
export function getVideoFormats() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return [];
  const families = [
    { label: 'MP4', extension: 'mp4', candidates: ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.420028', 'video/mp4'] },
    { label: 'WebM', extension: 'webm', candidates: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] },
  ];
  return families.reduce((formats, { candidates, ...format }) => {
    const mimeType = candidates.find(type => {
      try { return MediaRecorder.isTypeSupported(type); } catch { return false; }
    });
    if (mimeType) formats.push({ ...format, mimeType });
    return formats;
  }, []);
}

const cancelled = () => new DOMException('视频导出已取消', 'AbortError');
// A native encoder can still dispatch queued errors after stop(). Retain only
// this stateless sink after cleanup, never a closure over the recording session.
const ignoreRecorderError = event => { event.preventDefault?.(); };

/** Record real elapsed time; renderFrame receives seconds since recording began. */
export function recordCanvasVideo(canvas, { duration, fps, mimeType, renderFrame, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    let recorder, stream, timer, stopTimer, settled = false, stopping = false, started = 0;
    const chunks = [];
    function cleanup() {
      clearTimeout(timer); clearTimeout(stopTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      signal?.removeEventListener('abort', onAbort);
      if (recorder) {
        recorder.ondataavailable = null; recorder.onerror = ignoreRecorderError; recorder.onstop = null;
        if (recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* Already stopped. */ } }
      }
      // Cleanup must never mask the original failure or leave its Promise pending.
      try { stream?.getTracks().forEach(track => { try { track.stop(); } catch { /* Best effort for an ended native track. */ } }); } catch { /* An invalidated stream owns no usable tracks. */ }
    }
    function fail(error) {
      if (settled) return;
      settled = true; cleanup(); reject(error);
    }
    function onAbort() { fail(cancelled()); }
    function onVisibility() {
      if (document.hidden) fail(new Error('录制已取消：页面进入后台。请保持此页面可见后重新导出视频。'));
    }
    function finish() {
      if (settled || stopping) return;
      stopping = true; clearTimeout(timer);
      stopTimer = setTimeout(() => fail(new Error('视频编码器未能结束录制，请降低分辨率后重试。')), 8000);
      try { recorder.stop(); } catch (error) { fail(error); }
    }
    function tick() {
      if (settled || stopping) return;
      try {
        if (document.hidden) { onVisibility(); return; }
        if (signal?.aborted) { onAbort(); return; }
        const elapsed = Math.min((performance.now() - started) / 1000, duration);
        renderFrame(elapsed);
        stream.getVideoTracks()[0]?.requestFrame?.();
        onProgress?.(Math.min(elapsed / duration, 1));
        if (settled) return;
        if (elapsed >= duration) { finish(); return; }
        // Schedule against the original clock, not render completion, so slow
        // frames do not accumulate drift or turn a 5-second clip into 8 seconds.
        const now = (performance.now() - started) / 1000;
        const next = Math.min((Math.floor(now * fps) + 1) / fps, duration);
        timer = setTimeout(tick, Math.max(0, (next - now) * 1000));
      } catch (error) { fail(error); }
    }
    try {
      if (signal?.aborted) throw cancelled();
      if (document.hidden) throw new Error('请保持此页面可见后开始视频导出。');
      if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持本地视频录制，请使用新版 Chrome 或 Edge。');
      if (!Number.isFinite(duration) || duration <= 0 || duration > 60 || !Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error('视频时长或帧率无效。');
      const selectedType = mimeType || getVideoFormats()[0]?.mimeType;
      if (!selectedType || !selectedType.startsWith('video/') || !MediaRecorder.isTypeSupported(selectedType)) throw new Error('当前浏览器不支持所选视频格式。');
      renderFrame(0);
      stream = canvas.captureStream(0);
      if (!stream.getVideoTracks()[0]) throw new Error('浏览器未能创建视频轨道。');
      if (typeof stream.getVideoTracks()[0].requestFrame !== 'function') {
        stream.getTracks().forEach(track => track.stop());
        stream = canvas.captureStream(fps);
      }
      recorder = new MediaRecorder(stream, { mimeType: selectedType, videoBitsPerSecond: Math.min(24000000, Math.max(6000000, canvas.width * canvas.height * fps * 0.25)) });
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = event => {
        event.preventDefault?.();
        fail(new Error(`视频编码失败：${event.error?.message || '请降低分辨率或切换视频格式后重试。'}`));
      };
      recorder.onstop = () => {
        if (settled) return;
        if (!stopping) { fail(new Error('视频录制意外中断，请重新导出。')); return; }
        try {
          const actualType = recorder.mimeType || selectedType;
          const blob = new Blob(chunks, { type: actualType });
          if (!blob.size) { fail(new Error('未生成有效视频，请更换视频格式后重试。')); return; }
          settled = true; cleanup(); resolve({ blob, mimeType: actualType });
        } catch (error) { fail(error); }
      };
      document.addEventListener('visibilitychange', onVisibility);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) throw cancelled();
      recorder.start(250);
      started = performance.now();
      tick();
    } catch (error) { fail(error); }
  });
}
