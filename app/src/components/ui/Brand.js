import { Image, Text, View } from 'react-native';

export default function Brand({ className, ...props }) {
  return (
    <View
      className={['flex-row items-center gap-[9px]', className].filter(Boolean).join(' ')}
      {...props}
    >
      <Image
        source={require('../../../assets/logo-mark.png')}
        className="h-[30px] w-[30px]"
        resizeMode="contain"
        accessible={false}
      />
      <Text className="font-display text-wordmark text-paper">Gig Lanka</Text>
    </View>
  );
}
