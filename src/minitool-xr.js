// Non-XR adapter for the offline minitool build. Three's normal background
// renderer queries the blend mode even when no XR session is presenting.
export class WebXRManager {
  constructor() {
    this.enabled = false;
    this.isPresenting = false;
    this.cameraAutoUpdate = false;
  }
  getEnvironmentBlendMode() { return undefined; }
  addEventListener() {}
  removeEventListener() {}
  setAnimationLoop() {}
  dispose() {}
}
