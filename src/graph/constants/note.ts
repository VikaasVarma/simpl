export const NOTE = {
  w: 624,
  minH: 96,
  radius: 10,
  shadowBlur: 22,
  shadowSpread: 34,
  shadowAlpha: 0.16,
  dom: {
    titleSize: 44,
    summaryTitleSize: 30,
    textSize: 17,
    readingCol: 460,
    padX: 46,
    padTop: 28,
    padBottom: 40,
    gap: 10,
    bodyGap: 28,
    fadeH: 34,
  },
  landmarkH: 96,
  readerH: 720,
} as const;

export const NOTE_CARD = {
  background: "bg",
  border: "bg",
  shadow: "shadow",
} as const;

export const NOTE_LAYER = {
  cardZ: 0,
  cardOrder: 10,
  focusedOrderOffset: 100,
} as const;
