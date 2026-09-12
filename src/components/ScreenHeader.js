import React from 'react';
import { View, Text, StatusBar, Platform } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { COLORS } from '../theme/colors';

export default function ScreenHeader({ title, rightAction, subtitle }) {
  const topPadding = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24);

  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <View style={styles.titleContainer}>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );
}

const styles = ScaledSheet.create({
  header: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: '20@ms',
    paddingBottom: '16@ms',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  titleContainer: {
    flex: 1,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: '12@ms',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: '2@ms',
  },
  title: {
    color: COLORS.text,
    fontSize: '26@ms',
    fontWeight: '800',
  },
  rightAction: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginLeft: '10@ms',
  },
});
