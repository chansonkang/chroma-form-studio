// Platform contract: downloaded online-doc.html, 2026-10-29. No bridge or SDK import.
const VIDEO_INDEX = 'chroma-videos-v1';
function errorMessage(error, context) {
  return new Error(context + '：' + (error && (error.message || error.errMsg) || '操作未完成，请重试'));
}
function readDataURL(blob, env) {
  return new Promise((resolve, reject) => {
    if (typeof env.FileReader !== 'function') { reject(new Error('当前环境无法读取媒体文件')); return; }
    const reader = new env.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('媒体文件读取失败'));
    reader.onabort = () => reject(new Error('媒体读取已取消'));
    reader.readAsDataURL(blob);
  });
}
export async function createPlatform(env = window) {
  const xhs = env.xhs, api = xhs && xhs.miniTool;
  const has = name => !!api && typeof api[name] === 'function';
  let launch = xhs && xhs.launchOptions;
  let info = launch && launch.miniToolEnv || {};
  if ((!Number(info.buildVersion) || !info.userDataPath) && has('getLaunchOptions')) {
    try {
      const asyncLaunch = await api.getLaunchOptions();
      const asyncInfo = asyncLaunch && asyncLaunch.miniToolEnv || {};
      info = Object.assign({}, asyncInfo, info);
      if (!Number(info.buildVersion)) info.buildVersion = asyncInfo.buildVersion;
      if (!info.userDataPath) info.userDataPath = asyncInfo.userDataPath;
    } catch (_) { /* Missing environment is an unsupported capability, never a guessed version. */ }
  }
  const version = Math.floor((Number(info.buildVersion) || 0) / 1000);
  const nativeStorage = version >= 9460;
  const queues = new Map();
  function serial(key, action) {
    const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(action);
    queues.set(key, next);
    next.then(() => { if (queues.get(key) === next) queues.delete(key); }, () => { if (queues.get(key) === next) queues.delete(key); });
    return next;
  }
  async function readRaw(key) {
    try {
      let data;
      if (nativeStorage) {
        if (!has('getStorage')) throw new Error('平台缓存接口尚未就绪');
        const result = await api.getStorage({ key });
        data = result && result.data;
      } else data = env.localStorage.getItem(key);
      return data == null || data === '' ? null : JSON.parse(data);
    } catch (error) { throw errorMessage(error, '读取本地数据失败'); }
  }
  async function writeRaw(key, data) {
    try {
      if (nativeStorage) {
        if (!has('setStorage')) throw new Error('平台缓存接口尚未就绪');
        await api.setStorage({ key, data });
      } else env.localStorage.setItem(key, data);
      return true;
    } catch (error) { throw errorMessage(error, '保存本地数据失败'); }
  }
  function write(key, value) {
    // Snapshot at invocation, before a queued write can observe subsequent mutations.
    let data;
    try {
      data = JSON.stringify(value);
      if (typeof data !== 'string' || new Blob([data]).size > 1000000) throw new Error('参数超过单项缓存容量');
    } catch (error) { return Promise.reject(errorMessage(error, '保存本地数据失败')); }
    return serial(key, () => writeRaw(key, data));
  }
  const read = key => serial(key, () => readRaw(key));
  const canSaveImage = version >= 9420 && has('saveImageToPhotosAlbum');
  const canSaveVideo = version >= 9490 && typeof info.userDataPath === 'string' && !!info.userDataPath &&
    ['writeFile', 'appendFile', 'unlink', 'getFileStorageInfo', 'getStorage', 'setStorage'].every(has);
  async function saveImage(blob) {
    if (!canSaveImage) throw new Error('保存相册需要小红书 9.42 或更高版本');
    try {
      if (!blob || !/^image\/(png|jpeg|webp|gif)$/.test(blob.type)) throw new Error('图片格式不支持');
      let filePath = await readDataURL(blob, env);
      if (has('writeTempFile')) {
        const result = await api.writeTempFile({ data: filePath });
        if (!result || typeof result.filePath !== 'string' || !result.filePath) throw new Error('未获取到临时图片');
        filePath = result.filePath;
      }
      await api.saveImageToPhotosAlbum({ filePath });
    } catch (error) { throw errorMessage(error, '保存图片失败'); }
  }
  async function videoListRaw() {
    const rows = await read(VIDEO_INDEX);
    if (rows == null) return [];
    if (!Array.isArray(rows)) throw new Error('视频索引损坏，请先备份参数');
    return rows.filter(row => row && typeof row.path === 'string' && typeof row.name === 'string');
  }
  const listVideos = () => !canSaveVideo ? Promise.resolve([]) : serial('video-files', videoListRaw);
  const saveVideo = blob => serial('video-files', async () => {
    if (!canSaveVideo) throw new Error('保存视频需要小红书 9.49 或更高版本的文件系统');
    if (!blob || !/^video\/mp4(?:;|$)/i.test(blob.type) || !blob.size) throw new Error('当前容器仅保存 MP4 视频');
    let path, started = false;
    try {
      const rows = await videoListRaw();
      if (rows.length >= 30) throw new Error('最多保留 30 个视频，请先删除旧作品');
      const quota = await api.getFileStorageInfo();
      const chunk = Math.floor(Number(quota.writeChunkMaxBytes) / 3) * 3;
      if (!Number.isFinite(chunk) || chunk < 3) throw new Error('平台未提供有效分片大小');
      if (!Number.isFinite(quota.limitBytes) || !Number.isFinite(quota.usedBytes) || quota.limitBytes - quota.usedBytes < blob.size) throw new Error('视频存储空间不足，请删除旧作品');
      const name = 'chroma-video-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.mp4';
      path = info.userDataPath + '/' + name;
      for (let position = 0; position < blob.size; position += chunk) {
        const part = blob.slice(position, Math.min(blob.size, position + chunk));
        const dataURL = await readDataURL(part, env);
        const data = dataURL.slice(dataURL.indexOf(',') + 1);
        started = true;
        const result = await api[position === 0 ? 'writeFile' : 'appendFile']({ filePath: path, data, encoding: 'base64' });
        if (!result || result.writtenBytes !== part.size) throw new Error('视频文件未完整写入');
      }
      const entry = { path, name, size: blob.size, createdAt: Date.now() };
      await write(VIDEO_INDEX, rows.concat([entry]));
      return entry;
    } catch (error) {
      if (path && started) {
        try { await api.unlink({ filePath: path }); }
        catch (_) { throw errorMessage(error, '保存失败，未完成文件清理'); }
      }
      throw errorMessage(error, '保存视频失败');
    }
  });
  const deleteVideo = path => serial('video-files', async () => {
    if (!canSaveVideo) throw new Error('当前环境不支持视频文件管理');
    try {
      const rows = await videoListRaw();
      if (!rows.some(row => row.path === path)) throw new Error('视频不在当前作品列表中');
      // Commit the index first: a rejected write leaves the existing file untouched.
      await write(VIDEO_INDEX, rows.filter(row => row.path !== path));
      try {
        await api.unlink({ filePath: path });
      } catch (deleteError) {
        try { await write(VIDEO_INDEX, rows); }
        catch (rollbackError) {
          throw new Error('文件删除失败且列表恢复失败；文件可能仍占空间，请保留此路径：' + path + '。' + (rollbackError.message || ''));
        }
        throw deleteError;
      }
    } catch (error) { throw errorMessage(error, '删除视频失败'); }
  });
  let observing = false, windowTimer;
  async function applyWindowInfo() {
    if (version < 9490 || !has('getWindowInfo')) return null;
    if (!observing && env.addEventListener) {
      observing = true;
      env.addEventListener('resize', () => {
        clearTimeout(windowTimer);
        windowTimer = setTimeout(() => { applyWindowInfo(); }, 150);
      });
    }
    try {
      const data = await api.getWindowInfo();
      const style = env.document && env.document.documentElement.style;
      if (style && data) {
        const safe = data.safeArea;
        const set = (key, value) => { if (Number.isFinite(value)) style.setProperty(key, Math.max(0, value) + 'px'); };
        if (safe) {
          set('--safe-area-inset-top', safe.top); set('--safe-area-inset-left', safe.left);
          set('--safe-area-inset-right', data.windowWidth - safe.right);
          set('--safe-area-inset-bottom', data.windowHeight - safe.bottom);
        }
        const menu = data.menuButtons || {};
        set('--native-menu-bottom', Math.max(0, safe && Number(safe.top) || 0, ...Object.keys(menu).map(key => menu[key] && Number(menu[key].bottom) || 0)));
      }
      return data;
    } catch (_) { return null; } // CSS env() and container-injected variables remain the fallback.
  }
  return { read, write, saveImage, canSaveImage, canSaveVideo, saveVideo, listVideos, deleteVideo, applyWindowInfo, version };
}
