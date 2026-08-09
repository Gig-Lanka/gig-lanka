import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

cssInterop(LinearGradient, { className: 'style' });

function EmberGlow() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255, 74, 28, 0.34)', 'rgba(255, 74, 28, 0.08)', 'transparent']}
      locations={[0, 0.46, 0.72]}
      start={{ x: 0.25, y: 0.25 }}
      end={{ x: 0.8, y: 0.8 }}
      className="absolute -right-[110px] -top-[120px] h-[340px] w-[340px] rounded-full"
    />
  );
}

/**
 * Presentational layout shared by the auth screens.
 *
 * `header` is rendered in the dark region. The sheet children are a flex column,
 * which lets a screen use a `flex-1` spacer to align content at the bottom.
 */
export default function AuthShell({
  header,
  children,
  className,
  headerClassName,
  sheetClassName,
  contentClassName,
  keyboardVerticalOffset = 0,
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      className={['flex-1', className].filter(Boolean).join(' ')}
    >
      <View className="flex-1 overflow-hidden bg-ink">
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <EmberGlow />

        <SafeAreaView
          edges={['top']}
          className={['relative px-[26px] pb-[34px]', headerClassName].filter(Boolean).join(' ')}
        >
          {header}
        </SafeAreaView>

        <View
          className={['flex-1 overflow-hidden rounded-t-ds-sheet bg-paper', sheetClassName]
            .filter(Boolean)
            .join(' ')}
        >
          <SafeAreaView edges={['bottom']} className="flex-1">
            <View
              className={['flex-1 flex-col px-[26px] pt-[30px]', contentClassName]
                .filter(Boolean)
                .join(' ')}
            >
              {children}
            </View>
          </SafeAreaView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
