import React, { useRef } from 'react';
import { Pressable, Text, Animated } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../theme/colors';

export default function AppButton({
  title,
  onPress,
  style,
  textStyle,
  variant = 'primary', // 'primary' | 'secondary' | 'danger'
  disabled = false,
  children,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryButton;
      case 'danger':
        return styles.dangerButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        disabled && styles.disabled,
      ]}
      {...props}
    >
      <Animated.View style={[styles.button, getButtonStyle(), { transform: [{ scale }] }, style]}>
        {children ? children : <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const styles = ScaledSheet.create({
  pressable: {
    marginVertical: '4@ms',
  },
  button: {
    height: '48@vs',
    borderRadius: '14@ms',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '16@ms',
    borderWidth: 1,
    flexDirection: 'row',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.border,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderColor: COLORS.danger,
  },
  text: {
    fontSize: '14@ms',
    fontWeight: '700',
  },
  primaryText: {
    color: '#06101D',
  },
  secondaryText: {
    color: COLORS.text,
  },
  dangerText: {
    color: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
});
