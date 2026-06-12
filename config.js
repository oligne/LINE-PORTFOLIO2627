const CONFIG = {
  framesDir: './docs/RENDU_windowwebrotation/',
  totalFrames: 501,
  framePath(index) {
    return this.framesDir + String(index).padStart(4, '0') + '.png';
    // produit : .../0000.png, .../0001.png, ..., .../0500.png
  }
};
