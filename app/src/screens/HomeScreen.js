import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../components/ui/Button';

export default function HomeScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text>Home screen placeholder</Text>
      {__DEV__ ? (
        <Button
          className="mt-4"
          variant="outline"
          onPress={() => navigation.navigate('ComponentDemo')}
        >
          Dev: Component Kit
        </Button>
      ) : null}
      {__DEV__ ? (
        <Button
          className="mt-4"
          variant="outline"
          onPress={() => navigation.navigate('RoleSelect')}
        >
          Dev: Auth Screens
        </Button>
      ) : null}
    </View>
  );
}
