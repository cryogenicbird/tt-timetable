import {request} from './client';

export interface LocalFile {
  uri: string;
  fileCopyUri?: string | null;
  name?: string | null;
  type?: string | null;
}

export interface ConvertData {
  code: number;
  text?: string;
  message?: string;
}

export const timetableApi = {
  convertXlsx(file: LocalFile) {
    const form = new FormData();

    // RN 的 FormData 支持 {uri, name, type} 形态上传本地文件
    form.append('file', {
      uri: file.fileCopyUri ?? file.uri,
      name: file.name ?? 'timetable.xlsx',
      type:
        file.type ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);

    return request<ConvertData>('/timetable/convert', {
      method: 'POST',
      body: form,
    });
  },
};
