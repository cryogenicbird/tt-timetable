export interface Course {
  courseName: string;
  teacher: string;
  day: number;
  startSection: number;
  endSection: number;
  startWeek: number;
  endWeek: number;
  location: string;
}
export default function parseTextTimetable(text: string) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l);
  const results: Course[] = [];

  const dayMap: Record<string, number> = {
    周一: 1,
    周二: 2,
    周三: 3,
    周四: 4,
    周五: 5,
    周六: 6,
    周日: 7,
  };

  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(t => t);
    const dayStr = tokens[0];
    if (tokens.length !== 6 || !dayMap[dayStr]) {
      throw new Error(`格式错误：${line}\n请严格按示例格式，每行一个课程`);
    }
    // 1. 星期
    const day = dayMap[dayStr];

    // 2. 课程名（去掉编号和周次等噪声）

    const courseName = tokens[1];

    // 3. 教师名

    const teacher = tokens[2];

    // 4. 节次

    const sectionMatch = tokens[3].match(/\d+/g);
    // 5. 教室
    const location = tokens[4];

    // 6. 周次
    const weekMatch = tokens[5].match(/\d+/g);
    if (!sectionMatch || !weekMatch) {
      throw new Error(`格式错误：${line}\n请严格按示例格式，每行一个课程`);
    }
    const startSection = parseInt(sectionMatch[0], 10);
    const endSection = parseInt(sectionMatch[1] ?? sectionMatch[0], 10);
    const startWeek = parseInt(weekMatch[0], 10);
    const endWeek = parseInt(weekMatch[1] ?? weekMatch[0], 10);

    // 7. 生成课程对象（按每个周段展开）
    results.push({
      courseName,
      teacher,
      day,
      startSection,
      endSection,
      startWeek,
      endWeek,
      location,
    });
  }
  return results;
}
