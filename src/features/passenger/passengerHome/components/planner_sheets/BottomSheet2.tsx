import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  View,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Text,
  LayoutChangeEvent,
} from 'react-native'
import { appColors } from '../../../../../theme/colors'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SWIPE_TRACK_HEIGHT = 58
const SWIPE_THUMB_SIZE = 50
const SWIPE_TRACK_INSET = 4

type ButtonType = 'pressable button' | 'swipe action button'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  height?: number
  closeThresholdPercent?: number
  allowSheetDrag?: boolean
  maxHeightPercent?: number
  snapPoints?: number[]
  showButton?: boolean
  buttonType?: ButtonType
  buttonLabel?: string
  onPressAction?: () => void
  buttonOnSwipe?: () => void
}

export const BottomSheet2: React.FC<BottomSheetProps> = ({
  visible,
  onClose: _onClose,
  children,
  height,
  allowSheetDrag = true,
  maxHeightPercent = 0.9,
  snapPoints = [0],
  showButton,
  buttonType = 'swipe action button',
  buttonLabel = 'Swipe right to confirm',
  onPressAction,
  buttonOnSwipe,
}) => {
  const [contentHeight, setContentHeight] = useState(0)
  const maxHeight = SCREEN_HEIGHT * maxHeightPercent

  const sheetHeight = height
    ? Math.min(height, maxHeight)
    : Math.min(contentHeight, maxHeight)

  const translateY = useRef(new Animated.Value(sheetHeight || maxHeight)).current
  const offsetY = useRef(0)
  const swipeX = useRef(new Animated.Value(0)).current
  const [swipeMaxDistance, setSwipeMaxDistance] = useState(1)
  const swipeTrackWidthRef = useRef(0)
  const swipeCompletedRef = useRef(false)
  const swipeActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ✅ Keep refs in sync so PanResponder closures always read fresh values
  const sheetHeightRef = useRef(sheetHeight)
  const snapPointsRef = useRef(snapPoints)
  const swipeMaxDistanceRef = useRef(0)
  const shouldShowButtonRef = useRef(false)
  const buttonTypeRef = useRef<ButtonType>('swipe action button')
  const swipeActionRef = useRef<(() => void) | undefined>(undefined)

  const shouldShowButton = showButton ?? Boolean(buttonOnSwipe || onPressAction)
  const swipeAction = buttonOnSwipe ?? onPressAction

  const swipeLabelOpacity = swipeX.interpolate({
    inputRange: [0, swipeMaxDistance],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  })

  useEffect(() => {
    sheetHeightRef.current = sheetHeight
  }, [sheetHeight])

  useEffect(() => {
    snapPointsRef.current = snapPoints
  }, [snapPoints])

  useEffect(() => {
    shouldShowButtonRef.current = shouldShowButton
    buttonTypeRef.current = buttonType
    swipeActionRef.current = swipeAction
  }, [shouldShowButton, buttonType, swipeAction])

  useEffect(() => {
    return () => {
      if (swipeActionTimeoutRef.current) {
        clearTimeout(swipeActionTimeoutRef.current)
      }
    }
  }, [])

  const resetSwipeThumb = () => {
    Animated.spring(swipeX, {
      toValue: 0,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  const completeSwipe = () => {
    if (swipeCompletedRef.current) return
    swipeCompletedRef.current = true
    swipeActionRef.current?.()

    swipeActionTimeoutRef.current = setTimeout(() => {
      resetSwipeThumb()
      swipeCompletedRef.current = false
    }, 280)
  }

  const handleSwipeTrackLayout = (e: LayoutChangeEvent) => {
    swipeTrackWidthRef.current = e.nativeEvent.layout.width
    swipeMaxDistanceRef.current = Math.max(
      0,
      swipeTrackWidthRef.current - SWIPE_THUMB_SIZE - SWIPE_TRACK_INSET * 2
    )
    setSwipeMaxDistance(Math.max(1, swipeMaxDistanceRef.current))
  }

  const swipeButtonResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        shouldShowButtonRef.current && buttonTypeRef.current === 'swipe action button',
      onMoveShouldSetPanResponder: (_, g) =>
        shouldShowButtonRef.current &&
        buttonTypeRef.current === 'swipe action button' &&
        Math.abs(g.dx) > 3 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const maxX = swipeMaxDistanceRef.current
        const nextX = Math.min(Math.max(g.dx, 0), maxX)
        swipeX.setValue(nextX)
      },
      onPanResponderRelease: (_, g) => {
        const maxX = swipeMaxDistanceRef.current
        const movedX = Math.min(Math.max(g.dx, 0), maxX)
        const shouldComplete =
          movedX >= maxX * 0.75 || (g.vx > 0.65 && movedX >= maxX * 0.4)

        if (!maxX) {
          resetSwipeThumb()
          return
        }

        if (shouldComplete) {
          Animated.timing(swipeX, {
            toValue: maxX,
            duration: 120,
            useNativeDriver: true,
          }).start(completeSwipe)
          return
        }

        resetSwipeThumb()
      },
      onPanResponderTerminate: resetSwipeThumb,
    })
  ).current

  // Open / close animation
  useEffect(() => {
    if (!sheetHeight) return
    if (visible) {
      const initialSnap = snapPointsRef.current[0] ?? 0
      offsetY.current = initialSnap
      Animated.spring(translateY, {
        toValue: initialSnap,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 250,
        useNativeDriver: true,
      }).start()
      offsetY.current = sheetHeight
    }
  }, [visible, sheetHeight, translateY])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        allowSheetDrag && Math.abs(g.dy) > 5,

      onPanResponderMove: (_, g) => {
        if (!allowSheetDrag) return
        const sorted = [...snapPointsRef.current].sort((a, b) => a - b)
        const minY = sorted[0]
        const maxY = sorted[sorted.length - 1]
        const newY = Math.min(Math.max(offsetY.current + g.dy, minY), maxY)
        translateY.setValue(newY)
      },

      onPanResponderRelease: (_, g) => {
        if (!allowSheetDrag) return
        const currentY = offsetY.current + g.dy
        const sorted = [...snapPointsRef.current].sort((a, b) => a - b)

        let targetSnap: number

        if (g.vy > 0.5) {
          // Fast swipe down → next point below
          targetSnap = sorted.find((p) => p > currentY) ?? sorted[sorted.length - 1]
        } else if (g.vy < -0.5) {
          // Fast swipe up → next point above
          targetSnap = [...sorted].reverse().find((p) => p < currentY) ?? sorted[0]
        } else {
          // Slow drag → nearest point
          targetSnap = sorted.reduce((nearest, point) =>
            Math.abs(point - currentY) < Math.abs(nearest - currentY)
              ? point
              : nearest
          )
        }

        // ✅ Update offset BEFORE animating
        offsetY.current = targetSnap

        Animated.spring(translateY, {
          toValue: targetSnap,
          useNativeDriver: true,
          bounciness: 4,
        }).start()
      },
    })
  ).current

  if (!visible) return null

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight || maxHeight,
            maxHeight,
            transform: [{ translateY }],
          },
        ]}
        {...(allowSheetDrag ? panResponder.panHandlers : {})}
      >
        {allowSheetDrag && <View style={styles.handle} />}
        <View
          style={styles.contentContainer}
          onLayout={(e) => {
            if (height) return
            const h = e.nativeEvent.layout.height
            if (h !== contentHeight) setContentHeight(h)
          }}
        >
          {children}
        </View>
      </Animated.View>

      {shouldShowButton && (
        <View style={styles.bottomActionArea}>
          {buttonType === 'pressable button' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onPressAction}
              style={styles.pressableActionButton}
            >
              <Text style={styles.pressableActionLabel}>{buttonLabel}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.swipeTrack} onLayout={handleSwipeTrackLayout}>
              <Animated.Text style={[styles.swipeLabel, { opacity: swipeLabelOpacity }]}>
                {buttonLabel}
              </Animated.Text>

              <Animated.View
                style={[
                  styles.swipeThumb,
                  {
                    transform: [{ translateX: swipeX }],
                  },
                ]}
                {...swipeButtonResponder.panHandlers}
              >
                <Text style={styles.swipeThumbArrow}>››</Text>
              </Animated.View>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    // backgroundColor:'transparent'
  },
  sheet: {
    backgroundColor: appColors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#777',
    alignSelf: 'center',
    marginBottom: 10,
  },
  contentContainer: {
    flex: 1,
  },
  bottomActionArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: appColors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 10,
  },
  pressableActionButton: {
    height: SWIPE_TRACK_HEIGHT,
    // borderRadius: 30,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth:1,
    borderColor:'teal'
  },
  pressableActionLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  swipeTrack: {
    height: SWIPE_TRACK_HEIGHT,
    borderRadius: 30,
    backgroundColor: appColors.secondary,
    borderWidth: 1,
    borderColor: appColors.borderDark,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SWIPE_THUMB_SIZE + 8,
  },
  swipeThumb: {
    position: 'absolute',
    top: SWIPE_TRACK_INSET,
    left: SWIPE_TRACK_INSET,
    width: SWIPE_THUMB_SIZE,
    height: SWIPE_TRACK_HEIGHT - SWIPE_TRACK_INSET * 2,
    borderRadius: 30,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeThumbArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
})
