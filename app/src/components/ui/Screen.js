import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen({
  children,
  scroll = false,
  className,
  contentClassName,
  ...props
}) {
  const paddedClassName = ['px-4', contentClassName].filter(Boolean).join(' ');

  return (
    <SafeAreaView
      className={['flex-1 bg-bg-main', className].filter(Boolean).join(' ')}
      edges={['top', 'bottom']}
    >
      {scroll ? (
        <ScrollView className="flex-1" contentContainerClassName={paddedClassName} {...props}>
          {children}
        </ScrollView>
      ) : (
        <View className={['flex-1', paddedClassName].filter(Boolean).join(' ')} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
