import type { CSSProperties, ReactNode } from "react";

export interface OverlayLabelConfig {
  title?: string;
  element?: ReactNode;
  style?: {
    label?: CSSProperties;
    wrapper?: CSSProperties;
  };
}

export interface OverlayLabels {
  left?: OverlayLabelConfig;
  right?: OverlayLabelConfig;
  top?: OverlayLabelConfig;
  bottom?: OverlayLabelConfig;
}

export interface SwiperProps<T> {
  cards: T[];
  renderCard: (cardData: T, cardIndex: number) => ReactNode;

  // Card indexing
  cardIndex?: number;
  keyExtractor?: (cardData: T) => string;
  infinite?: boolean;

  // Stack configuration
  stackSize?: number;
  stackSeparation?: number;
  stackScale?: number;
  showSecondCard?: boolean;

  // Swipe behavior
  horizontalSwipe?: boolean;
  verticalSwipe?: boolean;
  horizontalThreshold?: number;
  verticalThreshold?: number;
  disableLeftSwipe?: boolean;
  disableRightSwipe?: boolean;
  disableTopSwipe?: boolean;
  disableBottomSwipe?: boolean;

  // Animation
  swipeAnimationDuration?: number;
  animateCardOpacity?: boolean;
  animateOverlayLabelsOpacity?: boolean;
  topCardResetAnimationFriction?: number;
  topCardResetAnimationTension?: number;
  stackAnimationFriction?: number;
  stackAnimationTension?: number;

  // Interpolation ranges
  inputCardOpacityRangeX?: number[];
  inputCardOpacityRangeY?: number[];
  outputCardOpacityRangeX?: number[];
  outputCardOpacityRangeY?: number[];
  inputRotationRange?: number[];
  outputRotationRange?: string[];
  inputOverlayLabelsOpacityRangeX?: number[];
  inputOverlayLabelsOpacityRangeY?: number[];
  outputOverlayLabelsOpacityRangeX?: number[];
  outputOverlayLabelsOpacityRangeY?: number[];

  // Callbacks
  onSwiped?: (cardIndex: number) => void;
  onSwipedLeft?: (cardIndex: number) => void;
  onSwipedRight?: (cardIndex: number) => void;
  onSwipedTop?: (cardIndex: number) => void;
  onSwipedBottom?: (cardIndex: number) => void;
  onSwipedAll?: () => void;
  onSwipedAborted?: () => void;
  onSwiping?: (x: number, y: number) => void;
  onTapCard?: (cardIndex: number) => void;
  onTapCardDeadZone?: number;
  dragStart?: () => void;
  dragEnd?: () => void;

  // Styling
  containerStyle?: CSSProperties;
  cardStyle?: CSSProperties;
  backgroundColor?: string;
  marginTop?: number;
  marginBottom?: number;
  cardVerticalMargin?: number;
  cardHorizontalMargin?: number;

  // Overlay
  overlayLabels?: OverlayLabels;
  overlayOpacityHorizontalThreshold?: number;
  overlayOpacityVerticalThreshold?: number;
  overlayLabelStyle?: CSSProperties;
  overlayLabelWrapperStyle?: CSSProperties;

  // Go-back configuration
  goBackToPreviousCardOnSwipeLeft?: boolean;
  goBackToPreviousCardOnSwipeRight?: boolean;
  goBackToPreviousCardOnSwipeTop?: boolean;
  goBackToPreviousCardOnSwipeBottom?: boolean;

  // Children
  children?: ReactNode;
  childrenOnTop?: boolean;

  // Overflow clipping — when set, wraps the swiper in a clipping container that
  // prevents card swipes from causing page scrollbars. The value specifies how
  // far the clip boundary extends beyond the swiper container on all sides.
  // Example: "100vw" lets cards animate across the full viewport.
  overflowClipMargin?: string;

  // Pointer events
  pointerEvents?: "auto" | "none";
}

export interface SwiperRef {
  swipeLeft: (mustDecrementCardIndex?: boolean) => void;
  swipeRight: (mustDecrementCardIndex?: boolean) => void;
  swipeTop: (mustDecrementCardIndex?: boolean) => void;
  swipeBottom: (mustDecrementCardIndex?: boolean) => void;
  jumpToCardIndex: (cardIndex: number) => void;
}
