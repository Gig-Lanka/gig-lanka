import { View } from 'react-native';

export default function Card({ children, className, ...props }) {
  return (
    <View
      className={['rounded-lg border border-border bg-bg-card p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </View>
  );
}
