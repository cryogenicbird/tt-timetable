import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {hasAndroidPermission} from './hasAndroidPermission';

export async function loadFolderImages(
  folderName: string = 'bg',
): Promise<string[]> {
  const hasPermission = await hasAndroidPermission();
  if (!hasPermission) {
    console.log('相册权限被拒绝，使用默认背景');
    return [];
  }

  try {
    const uris: string[] = [];
    let cursor: string | undefined;
    let hasNext = true;

    // 游标分页：一页页翻，直到没有下一页
    while (hasNext) {
      const result = await CameraRoll.getPhotos({
        first: 50,
        ...(cursor ? {after: cursor} : {}),
        assetType: 'Photos',
        groupName: folderName,
      });
      uris.push(...result.edges.map(edge => edge.node.image.uri));
      hasNext =
        result.page_info.has_next_page && result.page_info.end_cursor != null;
      cursor = result.page_info.end_cursor;
    }
    return uris;
  } catch (error) {
    console.error('加载 bg 相册失败:', error);
    return [];
  }
}
