const CONFIG = {
  framesDir: './docs/frames-webp/',
  totalFrames: 501,
  framePath(index) {
    return this.framesDir + String(index).padStart(4, '0') + '.webp';
  }
};
