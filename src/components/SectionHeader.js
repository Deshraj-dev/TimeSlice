import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../theme/colors';

export default function SectionHeader({ title, actionText, onActionPress, style }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {actionText && onActionPress && (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24@ms',
    marginBottom: '12@ms',
  },
  title: {
    color: COLORS.text,
    fontSize: '17@ms',
    fontWeight: '700',
  },
  actionText: {
    color: COLORS.primary,
    fontSize: '13@ms',
    fontWeight: '600',
  },
});
