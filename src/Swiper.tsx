import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { AnimationHandle } from "./spring";
import {
  animateSpring,
  animateSpringValue,
  animateTiming,
  animateTimingValue,
  interpolate,
  interpolateString,
} from "./spring";
import type { OverlayLabels, SwiperProps, SwiperRef } from "./types";

const SWIPE_MULTIPLY_FACTOR = 6;

const LABEL_TYPES = {
  NONE: "none",
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
  BOTTOM: "bottom",
} as const;

type LabelType = (typeof LABEL_TYPES)[keyof typeof LABEL_TYPES];

function calculateCardIndexes(firstCardIndex: number, cardsLength: number) {
  firstCardIndex = firstCardIndex || 0;
  const previousCardIndex =
    firstCardIndex === 0 ? cardsLength - 1 : firstCardIndex - 1;
  const secondCardIndex =
    firstCardIndex === cardsLength - 1 ? 0 : firstCardIndex + 1;
  return { firstCardIndex, secondCardIndex, previousCardIndex };
}

function SwiperInner<T>(
  props: SwiperProps<T>,
  ref: React.ForwardedRef<SwiperRef>,
) {
  const {
    cards,
    renderCard,
    cardIndex: initialCardIndex = 0,
    keyExtractor,
    infinite = false,
    stackSize = 1,
    stackSeparation = 10,
    stackScale = 3,
    showSecondCard = true,
    horizontalSwipe = true,
    verticalSwipe = true,
    horizontalThreshold: horizontalThresholdProp,
    verticalThreshold: verticalThresholdProp,
    disableLeftSwipe = false,
    disableRightSwipe = false,
    disableTopSwipe = false,
    disableBottomSwipe = false,
    swipeAnimationDuration = 350,
    animateCardOpacity = false,
    animateOverlayLabelsOpacity = false,
    topCardResetAnimationFriction = 7,
    topCardResetAnimationTension = 40,
    stackAnimationFriction = 7,
    stackAnimationTension = 40,
    inputCardOpacityRangeX: inputOpacityRangeXProp,
    inputCardOpacityRangeY: inputOpacityRangeYProp,
    outputCardOpacityRangeX = [0.8, 1, 1, 1, 0.8],
    outputCardOpacityRangeY = [0.8, 1, 1, 1, 0.8],
    inputRotationRange: inputRotationRangeProp,
    outputRotationRange = ["-10deg", "0deg", "10deg"],
    inputOverlayLabelsOpacityRangeX: inputOverlayOpacityRangeXProp,
    inputOverlayLabelsOpacityRangeY: inputOverlayOpacityRangeYProp,
    outputOverlayLabelsOpacityRangeX = [1, 0, 0, 0, 1],
    outputOverlayLabelsOpacityRangeY = [1, 0, 0, 0, 1],
    onSwiped,
    onSwipedLeft,
    onSwipedRight,
    onSwipedTop,
    onSwipedBottom,
    onSwipedAll,
    onSwipedAborted,
    onSwiping,
    onTapCard,
    onTapCardDeadZone = 5,
    dragStart,
    dragEnd,
    containerStyle,
    cardStyle,
    backgroundColor = "transparent",
    marginTop = 0,
    marginBottom = 0,
    cardVerticalMargin = 0,
    cardHorizontalMargin = 0,
    overlayLabels,
    overlayLabelStyle,
    overlayLabelWrapperStyle,
    overflowClipMargin,
    pointerEvents = "auto",
    goBackToPreviousCardOnSwipeLeft = false,
    goBackToPreviousCardOnSwipeRight = false,
    goBackToPreviousCardOnSwipeTop = false,
    goBackToPreviousCardOnSwipeBottom = false,
  } = props;

  // --- State ---
  const [firstCardIndex, setFirstCardIndex] = useState(initialCardIndex);
  const [swipedAllCards, setSwipedAllCards] = useState(false);
  const [swipedCount, setSwipedCount] = useState(0);
  const [labelType, setLabelType] = useState<LabelType>(LABEL_TYPES.NONE);
  const [, setRenderTrigger] = useState(0);
  const forceRender = useCallback(
    () => setRenderTrigger((c) => c + 1),
    [],
  );

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: stackSize }, () => null),
  );
  const containerSizeRef = useRef({ width: 400, height: 600 });
  const panRef = useRef({ x: 0, y: 0 });
  const panResponderLockedRef = useRef(false);
  const slideGestureRef = useRef(false);
  const mountedRef = useRef(true);
  const activeAnimationsRef = useRef<AnimationHandle[]>([]);
  const stackAnimationsRef = useRef<AnimationHandle[]>([]);

  // Slot system refs
  const slotZIndexesRef = useRef<number[]>(
    Array.from({ length: stackSize }, (_, i) => stackSize - i),
  );
  const slotOpacitiesRef = useRef<number[]>(
    Array.from({ length: stackSize }, () => 1),
  );
  const slotCardIndexesRef = useRef<number[]>(
    Array.from({ length: stackSize }, (_, i) => initialCardIndex + i),
  );
  const slotContentsRef = useRef<ReactNode[]>(
    Array.from({ length: stackSize }, (_, i) => {
      const cardIdx = initialCardIndex + i;
      if (cardIdx < cards.length) {
        return renderCard(cards[cardIdx]!, cardIdx);
      }
      return null;
    }),
  );

  // Stack animation values (position and scale per slot)
  const stackPositionsRef = useRef<number[]>(
    Array.from({ length: stackSize }, (_, i) => stackSeparation * i),
  );
  const stackScalesRef = useRef<number[]>(
    Array.from({ length: stackSize }, (_, i) =>
      (100 - stackScale * i) * 0.01,
    ),
  );

  // Swipe fade-out opacity (1 = fully visible, 0 = faded out)
  const swipeFadeOpacityRef = useRef(1);

  // Pointer tracking
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const activePointerRef = useRef<number | null>(null);

  // Track the firstCardIndex as ref for callbacks
  const firstCardIndexRef = useRef(firstCardIndex);
  firstCardIndexRef.current = firstCardIndex;

  const swipedCountRef = useRef(swipedCount);
  swipedCountRef.current = swipedCount;

  const swipedAllCardsRef = useRef(swipedAllCards);
  swipedAllCardsRef.current = swipedAllCards;

  // --- Computed thresholds ---
  const horizontalThreshold =
    horizontalThresholdProp ?? containerSizeRef.current.width / 4;
  const verticalThreshold =
    verticalThresholdProp ?? containerSizeRef.current.height / 5;

  // Default interpolation ranges based on container size
  const w = containerSizeRef.current.width;
  const h = containerSizeRef.current.height;
  const inputCardOpacityRangeX = inputOpacityRangeXProp ?? [
    -w / 2, -w / 3, 0, w / 3, w / 2,
  ];
  const inputCardOpacityRangeY = inputOpacityRangeYProp ?? [
    -h / 2, -h / 3, 0, h / 3, h / 2,
  ];
  const inputRotationRange = inputRotationRangeProp ?? [-w / 2, 0, w / 2];
  const inputOverlayLabelsOpacityRangeX = inputOverlayOpacityRangeXProp ?? [
    -w / 3, -w / 4, 0, w / 4, w / 3,
  ];
  const inputOverlayLabelsOpacityRangeY = inputOverlayOpacityRangeYProp ?? [
    -h / 4, -h / 5, 0, h / 5, h / 4,
  ];

  // --- Container size observer ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerSizeRef.current = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    });

    observer.observe(el);
    // Initial measurement
    const rect = el.getBoundingClientRect();
    containerSizeRef.current = { width: rect.width, height: rect.height };

    return () => observer.disconnect();
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeAnimationsRef.current.forEach((a) => a.cancel());
    };
  }, []);

  // --- Update slot contents when cards change ---
  useEffect(() => {
    for (let i = 0; i < stackSize; i++) {
      const cardIdx = slotCardIndexesRef.current[i]!;
      if (cardIdx < cards.length && cards[cardIdx]) {
        slotContentsRef.current[i] = renderCard(cards[cardIdx]!, cardIdx);
      }
    }
    forceRender();
  }, [cards, stackSize, renderCard, forceRender]);

  // --- DOM style helpers ---
  const applyTopCardStyle = useCallback(
    (dx: number, dy: number) => {
      const topSlot = swipedCountRef.current % stackSize;
      const el = slotRefs.current[topSlot];
      if (!el) return;

      const rotation = interpolateString(
        dx,
        inputRotationRange,
        outputRotationRange,
      );

      let opacity = 1;
      if (animateCardOpacity) {
        const opacityX = interpolate(
          dx,
          inputCardOpacityRangeX,
          outputCardOpacityRangeX,
        );
        opacity = opacityX;
      }

      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation})`;
      el.style.opacity = String(opacity * slotOpacitiesRef.current[topSlot]! * swipeFadeOpacityRef.current);
    },
    [
      stackSize,
      animateCardOpacity,
      inputRotationRange,
      outputRotationRange,
      inputCardOpacityRangeX,
      outputCardOpacityRangeX,
    ],
  );

  const applyStackCardStyle = useCallback(
    (slot: number, position: number) => {
      const el = slotRefs.current[slot];
      if (!el) return;

      const scale = stackScalesRef.current[position] ?? 1;
      const translateY = stackPositionsRef.current[position] ?? 0;
      const opacity = slotOpacitiesRef.current[slot] ?? 1;
      const zIndex = slotZIndexesRef.current[slot] ?? 0;

      el.style.transform = `scale(${scale}) translateY(${translateY}px)`;
      el.style.opacity = String(opacity);
      el.style.zIndex = String(zIndex);
    },
    [],
  );

  // --- Swipe direction helpers ---
  const getSwipeDirection = useCallback(
    (x: number, y: number) => ({
      isSwipingLeft: x < -horizontalThreshold,
      isSwipingRight: x > horizontalThreshold,
      isSwipingTop: y < -verticalThreshold,
      isSwipingBottom: y > verticalThreshold,
    }),
    [horizontalThreshold, verticalThreshold],
  );

  const validSwipeRelease = useCallback(
    (x: number, y: number) => {
      const { isSwipingLeft, isSwipingRight, isSwipingTop, isSwipingBottom } =
        getSwipeDirection(x, y);

      return (
        (isSwipingLeft && !disableLeftSwipe) ||
        (isSwipingRight && !disableRightSwipe) ||
        (isSwipingTop && !disableTopSwipe) ||
        (isSwipingBottom && !disableBottomSwipe)
      );
    },
    [
      getSwipeDirection,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe,
      disableBottomSwipe,
    ],
  );

  const getOnSwipeDirectionCallback = useCallback(
    (x: number, y: number) => {
      const { isSwipingLeft, isSwipingRight, isSwipingTop, isSwipingBottom } =
        getSwipeDirection(x, y);

      if (isSwipingRight) return onSwipedRight;
      if (isSwipingLeft) return onSwipedLeft;
      if (isSwipingTop) return onSwipedTop;
      if (isSwipingBottom) return onSwipedBottom;
      return undefined;
    },
    [getSwipeDirection, onSwipedRight, onSwipedLeft, onSwipedTop, onSwipedBottom],
  );

  const shouldDecrementCardIndex = useCallback(
    (x: number, y: number) => {
      const { isSwipingLeft, isSwipingRight, isSwipingTop, isSwipingBottom } =
        getSwipeDirection(x, y);

      return (
        (isSwipingLeft && goBackToPreviousCardOnSwipeLeft) ||
        (isSwipingRight && goBackToPreviousCardOnSwipeRight) ||
        (isSwipingTop && goBackToPreviousCardOnSwipeTop) ||
        (isSwipingBottom && goBackToPreviousCardOnSwipeBottom)
      );
    },
    [
      getSwipeDirection,
      goBackToPreviousCardOnSwipeLeft,
      goBackToPreviousCardOnSwipeRight,
      goBackToPreviousCardOnSwipeTop,
      goBackToPreviousCardOnSwipeBottom,
    ],
  );

  // --- Stack animation ---
  const rebuildStackValues = useCallback(() => {
    for (let position = 0; position < stackSize; position++) {
      stackPositionsRef.current[position] = stackSeparation * position;
      stackScalesRef.current[position] =
        (100 - stackScale * position) * 0.01;
    }
  }, [stackSize, stackSeparation, stackScale]);

  const animateStack = useCallback(() => {
    if (swipedAllCardsRef.current || !showSecondCard) return;

    // Cancel any previous stack animations to avoid conflicts
    stackAnimationsRef.current.forEach((a) => a.cancel());
    stackAnimationsRef.current = [];

    // Capture top slot at call time so spring callbacks use the correct value
    const topSlotAtStart = swipedCountRef.current % stackSize;

    for (let position = stackSize - 1; position > 0; position--) {
      const targetSeparation = stackSeparation * (position - 1);
      const targetScale = (100 - stackScale * (position - 1)) * 0.01;

      const currentPosition = stackPositionsRef.current[position] ?? 0;
      const currentScale = stackScalesRef.current[position] ?? 1;

      const positionIdx = position;

      const anim = animateSpring(
        { x: currentPosition, y: currentScale },
        { x: targetSeparation, y: targetScale },
        { friction: stackAnimationFriction, tension: stackAnimationTension },
        (pos) => {
          stackPositionsRef.current[positionIdx] = pos.x;
          stackScalesRef.current[positionIdx] = pos.y;

          // Apply to all non-top slots at this position (using captured topSlot)
          for (let slot = 0; slot < stackSize; slot++) {
            if (slot === topSlotAtStart) continue;
            const slotPosition =
              (slot - topSlotAtStart + stackSize) % stackSize;
            if (slotPosition === positionIdx) {
              applyStackCardStyle(slot, positionIdx);
            }
          }
        },
        () => {},
      );
      stackAnimationsRef.current.push(anim);
      activeAnimationsRef.current.push(anim);
    }
  }, [
    stackSize,
    stackSeparation,
    stackScale,
    stackAnimationFriction,
    stackAnimationTension,
    showSecondCard,
    applyStackCardStyle,
  ]);

  // --- Card index management ---
  const setCardIndex = useCallback(
    (newCardIndex: number, allSwiped: boolean) => {
      if (!mountedRef.current) return;

      // Cancel any in-flight stack animations before rebuilding
      stackAnimationsRef.current.forEach((a) => a.cancel());
      stackAnimationsRef.current = [];

      const currentSwipedCount = swipedCountRef.current;
      const swipedSlot = currentSwipedCount % stackSize;

      // Reset pan position and fade opacity for top card DOM
      panRef.current = { x: 0, y: 0 };
      swipeFadeOpacityRef.current = 1;

      // Update the cached content for the slot going to bottom
      const bottomCardIndex = newCardIndex + stackSize - 1;
      if (bottomCardIndex < cards.length && cards[bottomCardIndex]) {
        slotCardIndexesRef.current[swipedSlot] = bottomCardIndex;
        slotContentsRef.current[swipedSlot] = renderCard(
          cards[bottomCardIndex]!,
          bottomCardIndex,
        );
      } else {
        slotCardIndexesRef.current[swipedSlot] = bottomCardIndex;
        slotContentsRef.current[swipedSlot] = null;
      }

      // Rebuild stack values
      rebuildStackValues();

      const newSwipedCount = currentSwipedCount + 1;

      // Reset the top card element's transform
      const newTopSlot = newSwipedCount % stackSize;
      const newTopEl = slotRefs.current[newTopSlot];
      if (newTopEl) {
        newTopEl.style.transform = "translate(0px, 0px) rotate(0deg)";
      }

      // Batch state updates
      setFirstCardIndex(newCardIndex);
      setSwipedAllCards(allSwiped);
      setSwipedCount(newSwipedCount);
      panResponderLockedRef.current = false;

      // Fade in the recycled slot
      const fadeAnim = animateTimingValue(
        0,
        1,
        250,
        (val) => {
          slotOpacitiesRef.current[swipedSlot] = val;
          const el = slotRefs.current[swipedSlot];
          if (el) el.style.opacity = String(val);
        },
        () => {},
      );
      activeAnimationsRef.current.push(fadeAnim);
    },
    [cards, stackSize, renderCard, rebuildStackValues],
  );

  const incrementCardIndex = useCallback(
    (onSwipedCallback?: (cardIndex: number) => void) => {
      const currentFirst = firstCardIndexRef.current;
      let newCardIndex = currentFirst + 1;
      let allSwiped = false;

      // Fire callbacks
      onSwiped?.(currentFirst);
      onSwipedCallback?.(currentFirst);

      const allSwipedCheck = () => newCardIndex === cards.length;

      if (allSwipedCheck()) {
        if (!infinite) {
          onSwipedAll?.();
          if (allSwipedCheck()) {
            allSwiped = true;
          }
        } else {
          newCardIndex = 0;
        }
      }

      setCardIndex(newCardIndex, allSwiped);
    },
    [cards.length, infinite, onSwiped, onSwipedAll, setCardIndex],
  );

  const decrementCardIndex = useCallback(
    (onSwipedCallback?: (cardIndex: number) => void) => {
      const currentFirst = firstCardIndexRef.current;
      const lastCardIndex = cards.length - 1;
      const newCardIndex =
        currentFirst === 0 ? lastCardIndex : currentFirst - 1;

      onSwiped?.(currentFirst);
      onSwipedCallback?.(currentFirst);

      setCardIndex(newCardIndex, false);
    },
    [cards.length, onSwiped, setCardIndex],
  );

  // --- Reset top card ---
  const resetTopCard = useCallback(() => {
    const anim = animateSpring(
      { x: panRef.current.x, y: panRef.current.y },
      { x: 0, y: 0 },
      {
        friction: topCardResetAnimationFriction,
        tension: topCardResetAnimationTension,
      },
      (pos) => {
        panRef.current = pos;
        applyTopCardStyle(pos.x, pos.y);
      },
      () => {
        panRef.current = { x: 0, y: 0 };
      },
    );
    activeAnimationsRef.current.push(anim);
    onSwipedAborted?.();
  }, [
    topCardResetAnimationFriction,
    topCardResetAnimationTension,
    applyTopCardStyle,
    onSwipedAborted,
  ]);

  // --- Swipe card ---
  const swipeCard = useCallback(
    (
      onSwipedCallback?: (cardIndex: number) => void,
      x?: number,
      y?: number,
      mustDecrement = false,
    ) => {
      const dx = x ?? panRef.current.x;
      const dy = y ?? panRef.current.y;

      panResponderLockedRef.current = true;
      animateStack();

      // Reset fade opacity for this swipe
      swipeFadeOpacityRef.current = 1;

      // Start a delayed fade-out: begins at 20% of duration, ends at 100%
      const fadeDelay = swipeAnimationDuration * 0.2;
      const fadeDuration = swipeAnimationDuration * 0.8;
      const fadeTimeout = setTimeout(() => {
        const fadeAnim = animateTimingValue(
          1,
          0,
          fadeDuration,
          (val) => {
            swipeFadeOpacityRef.current = val;
            // Apply immediately to top card DOM
            const topSlot = swipedCountRef.current % stackSize;
            const el = slotRefs.current[topSlot];
            if (el) {
              el.style.opacity = String(val);
            }
          },
          () => {},
        );
        activeAnimationsRef.current.push(fadeAnim);
      }, fadeDelay);

      const anim = animateTiming(
        { x: panRef.current.x, y: panRef.current.y },
        { x: dx * SWIPE_MULTIPLY_FACTOR, y: dy * SWIPE_MULTIPLY_FACTOR },
        swipeAnimationDuration,
        (pos) => {
          panRef.current = pos;
          applyTopCardStyle(pos.x, pos.y);
        },
        () => {
          // Animation completed - card is off-screen
          clearTimeout(fadeTimeout);
          const currentSwipedCount = swipedCountRef.current;
          const swipedSlot = currentSwipedCount % stackSize;
          const newTopSlot = (currentSwipedCount + 1) % stackSize;

          // Update z-indexes
          for (let i = 0; i < stackSize; i++) {
            const distanceFromTop =
              (i - newTopSlot + stackSize) % stackSize;
            slotZIndexesRef.current[i] = stackSize - distanceFromTop;
          }

          // Set swiped slot opacity to 0
          slotOpacitiesRef.current[swipedSlot] = 0;

          // Apply z-index and opacity changes to DOM
          for (let i = 0; i < stackSize; i++) {
            const el = slotRefs.current[i];
            if (el) {
              el.style.zIndex = String(slotZIndexesRef.current[i]);
              el.style.opacity = String(slotOpacitiesRef.current[i]);
            }
          }

          // Small delay to ensure visual updates before pan reset
          setTimeout(() => {
            const shouldDecrement =
              mustDecrement || shouldDecrementCardIndex(dx, dy);

            if (shouldDecrement) {
              decrementCardIndex(onSwipedCallback);
            } else {
              incrementCardIndex(onSwipedCallback);
            }
          }, 20);
        },
      );
      activeAnimationsRef.current.push(anim);
    },
    [
      swipeAnimationDuration,
      stackSize,
      applyTopCardStyle,
      animateStack,
      shouldDecrementCardIndex,
      incrementCardIndex,
      decrementCardIndex,
    ],
  );

  // --- Imperative API ---
  useImperativeHandle(
    ref,
    () => ({
      swipeLeft: (mustDecrement = false) => {
        swipeCard(onSwipedLeft, -horizontalThreshold, 0, mustDecrement);
      },
      swipeRight: (mustDecrement = false) => {
        swipeCard(onSwipedRight, horizontalThreshold, 0, mustDecrement);
      },
      swipeTop: (mustDecrement = false) => {
        swipeCard(onSwipedTop, 0, -verticalThreshold, mustDecrement);
      },
      swipeBottom: (mustDecrement = false) => {
        swipeCard(onSwipedBottom, 0, verticalThreshold, mustDecrement);
      },
      jumpToCardIndex: (newIndex: number) => {
        if (newIndex >= 0 && newIndex < cards.length) {
          // Reset all slots
          for (let i = 0; i < stackSize; i++) {
            const cardIdx = newIndex + i;
            if (cardIdx < cards.length && cards[cardIdx]) {
              slotCardIndexesRef.current[i] = cardIdx;
              slotContentsRef.current[i] = renderCard(
                cards[cardIdx]!,
                cardIdx,
              );
            } else {
              slotContentsRef.current[i] = null;
            }
            slotZIndexesRef.current[i] = stackSize - i;
            slotOpacitiesRef.current[i] = 1;
          }
          rebuildStackValues();
          panRef.current = { x: 0, y: 0 };
          panResponderLockedRef.current = false;
          setFirstCardIndex(newIndex);
          setSwipedAllCards(false);
          setSwipedCount(0);
        }
      },
    }),
    [
      swipeCard,
      horizontalThreshold,
      verticalThreshold,
      onSwipedLeft,
      onSwipedRight,
      onSwipedTop,
      onSwipedBottom,
      cards,
      stackSize,
      renderCard,
      rebuildStackValues,
    ],
  );

  // --- Pointer event handlers ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (panResponderLockedRef.current || swipedAllCardsRef.current) return;

      activePointerRef.current = e.pointerId;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      slideGestureRef.current = false;
      panRef.current = { x: 0, y: 0 };

      // Capture pointer for tracking outside element
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      dragStart?.();
    },
    [dragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (
        activePointerRef.current !== e.pointerId ||
        panResponderLockedRef.current
      )
        return;

      const rawDx = e.clientX - pointerStartRef.current.x;
      const rawDy = e.clientY - pointerStartRef.current.y;

      const dx = horizontalSwipe ? rawDx : 0;
      const dy = verticalSwipe ? rawDy : 0;

      panRef.current = { x: dx, y: dy };
      applyTopCardStyle(dx, dy);

      onSwiping?.(dx, dy);

      // Determine label type
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) setLabelType(LABEL_TYPES.RIGHT);
        else setLabelType(LABEL_TYPES.LEFT);
      } else if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) setLabelType(LABEL_TYPES.BOTTOM);
        else setLabelType(LABEL_TYPES.TOP);
      }

      // Track if this is a slide gesture (not a tap)
      if (
        Math.abs(dx) > onTapCardDeadZone ||
        Math.abs(dy) > onTapCardDeadZone
      ) {
        slideGestureRef.current = true;
      }
    },
    [
      horizontalSwipe,
      verticalSwipe,
      applyTopCardStyle,
      onSwiping,
      onTapCardDeadZone,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return;

      activePointerRef.current = null;
      dragEnd?.();

      if (panResponderLockedRef.current) {
        panRef.current = { x: 0, y: 0 };
        return;
      }

      const x = panRef.current.x;
      const y = panRef.current.y;

      const isSwiping =
        Math.abs(x) > horizontalThreshold ||
        Math.abs(y) > verticalThreshold;

      if (isSwiping && validSwipeRelease(x, y)) {
        const callback = getOnSwipeDirectionCallback(x, y);
        swipeCard(callback);
      } else {
        resetTopCard();
      }

      if (!slideGestureRef.current) {
        onTapCard?.(firstCardIndexRef.current);
      }

      setLabelType(LABEL_TYPES.NONE);
      slideGestureRef.current = false;
    },
    [
      dragEnd,
      horizontalThreshold,
      verticalThreshold,
      validSwipeRelease,
      getOnSwipeDirectionCallback,
      swipeCard,
      resetTopCard,
      onTapCard,
    ],
  );

  // --- Overlay label rendering ---
  const renderOverlayLabel = useCallback(
    (isTop: boolean) => {
      if (
        !overlayLabels ||
        labelType === LABEL_TYPES.NONE
      )
        return null;

      const labelConfig = overlayLabels[labelType as keyof OverlayLabels];
      if (!labelConfig) return null;

      // Check if direction is disabled
      if (
        (labelType === LABEL_TYPES.LEFT && disableLeftSwipe) ||
        (labelType === LABEL_TYPES.RIGHT && disableRightSwipe) ||
        (labelType === LABEL_TYPES.TOP && disableTopSwipe) ||
        (labelType === LABEL_TYPES.BOTTOM && disableBottomSwipe)
      )
        return null;

      const dx = panRef.current.x;
      const dy = panRef.current.y;

      let overlayOpacity = 1;
      if (animateOverlayLabelsOpacity) {
        if (Math.abs(dx) > Math.abs(dy)) {
          overlayOpacity = interpolate(
            dx,
            inputOverlayLabelsOpacityRangeX,
            outputOverlayLabelsOpacityRangeX,
          );
        } else {
          overlayOpacity = interpolate(
            dy,
            inputOverlayLabelsOpacityRangeY,
            outputOverlayLabelsOpacityRangeY,
          );
        }
      }

      const wrapperStyle: React.CSSProperties = {
        position: "absolute",
        backgroundColor: "transparent",
        zIndex: 2,
        width: "100%",
        height: "100%",
        display: "flex",
        opacity: overlayOpacity,
        ...(overlayLabelWrapperStyle ?? {}),
        ...(labelConfig.style?.wrapper ?? {}),
      };

      const labelStyleMerged: React.CSSProperties = {
        fontSize: 45,
        fontWeight: "bold",
        borderRadius: 10,
        padding: 10,
        overflow: "hidden",
        ...(overlayLabelStyle ?? {}),
        ...(isTop ? (labelConfig.style?.label ?? {}) : { opacity: 0 }),
      };

      return (
        <div style={wrapperStyle}>
          {labelConfig.element
            ? labelConfig.element
            : (
              <span style={labelStyleMerged}>{labelConfig.title}</span>
            )}
        </div>
      );
    },
    [
      overlayLabels,
      labelType,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe,
      disableBottomSwipe,
      animateOverlayLabelsOpacity,
      inputOverlayLabelsOpacityRangeX,
      outputOverlayLabelsOpacityRangeX,
      inputOverlayLabelsOpacityRangeY,
      outputOverlayLabelsOpacityRangeY,
      overlayLabelStyle,
      overlayLabelWrapperStyle,
    ],
  );

  // --- Render stack ---
  const renderStack = () => {
    if (swipedAllCards) return null;

    const topSlot = swipedCount % stackSize;
    const renderedCards: ReactNode[] = [];

    for (let slot = 0; slot < stackSize; slot++) {
      const content = slotContentsRef.current[slot];
      if (!content) continue;

      const isTopCard = slot === topSlot;

      if (!isTopCard && !showSecondCard) continue;

      const position = (slot - topSlot + stackSize) % stackSize;
      const expectedCardIndex = firstCardIndex + position;
      const isValidCard = expectedCardIndex < cards.length;

      const slotZIndex = slotZIndexesRef.current[slot] ?? 0;
      const slotOpacity = slotOpacitiesRef.current[slot] ?? 1;

      if (isTopCard) {
        // Top card: gets pan transform
        const dx = panRef.current.x;
        const dy = panRef.current.y;
        const rotation = interpolateString(
          dx,
          inputRotationRange,
          outputRotationRange,
        );
        let opacity = slotOpacity;
        if (animateCardOpacity) {
          const swipeOpacity = interpolate(
            dx,
            inputCardOpacityRangeX,
            outputCardOpacityRangeX,
          );
          opacity *= swipeOpacity;
        }

        renderedCards.push(
          <div
            key={`slot-${slot}`}
            ref={(el) => {
              slotRefs.current[slot] = el;
            }}
            style={{
              position: "absolute",
              top: cardVerticalMargin,
              left: cardHorizontalMargin,
              right: cardHorizontalMargin,
              bottom: cardVerticalMargin,
              zIndex: slotZIndex,
              opacity,
              transform: `translate(${dx}px, ${dy}px) rotate(${rotation})`,
              willChange: "transform, opacity",
              ...cardStyle,
            }}
          >
            {renderOverlayLabel(true)}
            {content}
          </div>,
        );
      } else {
        // Stack card
        const scale = stackScalesRef.current[position] ?? 1;
        const translateY = stackPositionsRef.current[position] ?? 0;

        renderedCards.push(
          <div
            key={`slot-${slot}`}
            ref={(el) => {
              slotRefs.current[slot] = el;
            }}
            style={{
              position: "absolute",
              top: cardVerticalMargin,
              left: cardHorizontalMargin,
              right: cardHorizontalMargin,
              bottom: cardVerticalMargin,
              zIndex: slotZIndex,
              opacity: isValidCard ? slotOpacity : 0,
              transform: `scale(${scale}) translateY(${translateY}px)`,
              willChange: "transform, opacity",
              ...cardStyle,
            }}
          >
            {content}
          </div>,
        );
      }
    }

    return renderedCards;
  };

  const container = (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        marginTop,
        marginBottom,
        touchAction: "none",
        userSelect: "none",
        pointerEvents,
        ...containerStyle,
      }}
    >
      {renderStack()}
    </div>
  );

  // When overflowClipMargin is set, wrap in a container that prevents card
  // swipes from causing page scrollbars. Negative margins expand the clip
  // boundary, positive padding keeps content positioned correctly,
  // overflow:hidden clips cards at the expanded boundary, and contain:paint
  // prevents the expanded box from affecting page scroll dimensions.
  // Works in all modern browsers (no overflow-clip-margin needed).
  if (overflowClipMargin != null) {
    return (
      <div
        style={{
          margin: `calc(-1 * ${overflowClipMargin})`,
          padding: overflowClipMargin,
          overflow: "hidden",
          contain: "paint",
        }}
      >
        {container}
      </div>
    );
  }

  return container;
}

// Wrapper to support generics with forwardRef
const Swiper = forwardRef(SwiperInner) as <T>(
  props: SwiperProps<T> & { ref?: React.Ref<SwiperRef> },
) => ReturnType<typeof SwiperInner>;

export default Swiper;
