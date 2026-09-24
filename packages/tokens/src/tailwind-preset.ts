import { colors } from "./colors";
import { fontFamily, fontSize } from "./typography";
import { spacing, maxWidth, borderRadius } from "./spacing";
import { boxShadow } from "./shadows";
import {
  animation,
  backgroundImage,
  keyframes,
  transitionDuration,
} from "./animation";
import { zIndex } from "./z-index";

export const preset = {
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      spacing,
      maxWidth,
      borderRadius,
      boxShadow,
      backgroundImage,
      transitionDuration,
      animation,
      keyframes,
      zIndex,
    },
  },
};

export default preset;
