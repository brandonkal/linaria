// https://www.w3.org/TR/css-values-4/
export const units = [
  // font relative lengths
  'em',
  'ex',
  'cap',
  'ch',
  'ic',
  'rem',
  'lh',
  'rlh',

  // viewport percentage lengths
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',

  // absolute lengths
  'cm',
  'mm',
  'Q',
  'in',
  'pc',
  'pt',
  'px',

  // angle units
  'deg',
  'grad',
  'rad',
  'turn',

  // duration units
  's',
  'ms',

  // frequency units
  'Hz',
  'kHz',

  // resolution units
  'dpi',
  'dpcm',
  'dppx',
  'x',

  // https://www.w3.org/TR/css-grid-1/#fr-unit
  'fr',

  // percentages
  '%',
];

export const unitless = {
  animation: true,
  animationIterationCount: true,
  baselineShift: true,
  borderImage: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexNegative: true,
  flexOrder: true,
  flexPositive: true,
  flexShrink: true,
  fontSizeAdjust: true,
  fontWeight: true,
  gridArea: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnSpan: true,
  gridColumnStart: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowSpan: true,
  gridRowStart: true,
  lineClamp: true,
  lineHeight: true,
  maskBorder: true,
  maskBorderOutset: true,
  maskBorderSlice: true,
  maskBorderWidth: true,
  maxLines: true,
  opacity: true,
  order: true,
  orphans: true,
  shapeImageThreshold: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true,
};
