export const emitPrediction = (payload) => {
  if (!globalThis._io) return;

  globalThis._io.emit("prediction:update", payload);
};
