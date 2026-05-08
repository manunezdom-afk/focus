// Fallback para usar MaterialIcons en Android/web. En iOS se usa
// `icon-symbol.ios.tsx` que renderiza SF Symbols nativos via expo-symbols.
// Si agregás un símbolo nuevo, mapealo acá Y revisá que el SF Symbol exista.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  'sun.max.fill': 'wb-sunny',
  'calendar': 'event',
  'checklist': 'checklist',
  'gearshape.fill': 'settings',
  'arrow.right.square': 'logout',
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'sparkles': 'auto-awesome',
  'arrow.up': 'arrow-upward',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'xmark': 'close',
  'trash.fill': 'delete',
  'trash': 'delete-outline',
  'checkmark': 'check',
  'pencil': 'edit',
  'square.and.arrow.down': 'file-download',
  'square.and.arrow.up': 'share',
  'sun.max': 'wb-sunny',
  'camera': 'photo-camera',
  'camera.fill': 'photo-camera',
  'tray.fill': 'inbox',
  'bell.fill': 'notifications',
  'person.crop.circle.fill': 'account-circle',
  'arrow.clockwise': 'refresh',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
