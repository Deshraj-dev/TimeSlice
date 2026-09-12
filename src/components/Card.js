import React from 'react';
import { View } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../theme/colors';

export default function Card({ children, style, elevated = false, ...props }) {
  return (
    <View
      style={[
        styles.card,
        elevated ? styles.elevated : styles.standard,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = ScaledSheet.create({
  card: {
    borderRadius: '16@ms',
    borderWidth: 1,
    padding: '16@ms',
  },
  standard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  elevated: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.border,
  },
});
