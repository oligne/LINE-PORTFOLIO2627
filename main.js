Loader.load(() => {
  Canvas.draw(0);
  const enableSecondaryVideo = false;
  if (enableSecondaryVideo) {
    VideoScreen.init();
  }
  Scroll.init();
});
