import React, { useState } from 'react';
import { TextInput } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../theme/colors';

export default function CustomInput({ onFocus, onBlur, ...props }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={COLORS.textMuted}
      style={[
        styles.input,
        isFocused && styles.inputFocused,
      ]}
      onFocus={(e) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        if (onBlur) onBlur(e);
      }}
      {...props}
    />
  );
}

const styles = ScaledSheet.create({
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    padding: '14@ms',
    borderRadius: '12@ms',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: '15@ms',
    fontSize: '14@ms',
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
});