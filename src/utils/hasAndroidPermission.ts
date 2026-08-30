import {PermissionsAndroid, Platform} from 'react-native';

export async function hasAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version >= 33) {
    // Android 13+
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } else {
    // Android 12 及以下
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
}
