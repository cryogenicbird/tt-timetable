import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
  Modal,
  TextInput,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import parseTextTimetable, {Course} from '../utils/parseTextTimetable';
import {loadFolderImages} from '../utils/loadFolderImages';

// 默认背景图片
const DEFAULT_BACKGROUND = require('../pic/1.jpg');

/** 午休的空隙 */
const LUNCH_GAP = 20;

/** 每节课高度 */
const CLASS_HEIGHT = 60;

/** 星期显示 */
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

/** 课程颜色 */
const courseColors = [
  '#8BC34A',
  '#03A9F4',
  '#FF9800',
  '#E91E63',
  '#9C27B0',
  '#607D8B',
  '#FF5722',
  '#4CAF50',
];

/** 每节课的开始时间（索引 0 = 第 1 节；7-10 节按本学期实际时间自行修改） */
const SECTION_TIMES = [
  '08:30',
  '09:25',
  '10:30',
  '11:25',
  '13:30',
  '14:25',
  '15:20',
  '16:25',
  '17:20',
  '18:05',
  '19:00',
  '19:55',
];

/** 解析学期开始日期，返回第一周周一 */
const getFirstMonday = (dateStr: string) => {
  if (dateStr) {
    const [year, month, day] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(2026, 8, 7); // 默认：2026 年 9 月 7 日（周一）
};

/** 今天是第几周 */
const getCurrentWeek = (dateStr: string) => {
  const firstMonday = getFirstMonday(dateStr);
  const today = new Date();
  const todayMonday = new Date(today);
  todayMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const diffDays = Math.round(
    (todayMonday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, Math.floor(diffDays / 7) + 1);
};

export default function TimetableScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [semesterStartDate, setSemesterStartDate] = useState('');
  const [selectedBgUri, setSelectedBgUri] = useState<string | null>(null);

  // 加载并随机选择背景图片
  const loadBackgroundImage = async () => {
    const images = await loadFolderImages('bg');
    if (images.length > 0) {
      const randomIndex = Math.floor(Math.random() * images.length);
      const bgUri = images[randomIndex];
      setSelectedBgUri(bgUri);
      console.log('背景URI:', bgUri);
      console.log(`从 ${images.length} 张图片中选择了第 ${randomIndex + 1} 张`);
    } else {
      setSelectedBgUri(null);
      console.log('未找到相册图片，使用默认背景');
    }
  };

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('parsedCourses');
      if (saved) {
        setCourses(JSON.parse(saved));
      }

      // 加载保存的学期开始日期
      const savedDate = await AsyncStorage.getItem('semesterStartDate');
      if (savedDate) {
        setSemesterStartDate(savedDate);
      }
      // 自动定位到今天所在周（未设置日期时用默认开学日）
      setCurrentWeek(getCurrentWeek(savedDate ?? ''));

      // 加载相册背景图片
      await loadBackgroundImage();
    })();
  }, []);

  // 旋转屏幕时会自动触发重渲染，返回新尺寸
  const {width} = useWindowDimensions();
  /** 每日列宽度 */
  const dayWidth = width / 7;

  /** 计算每周日期 */
  const getWeekDates = () => {
    const dates = [];
    const firstMonday = getFirstMonday(semesterStartDate);

    const currentMonday = new Date(firstMonday);
    currentMonday.setDate(firstMonday.getDate() + (currentWeek - 1) * 7);
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  const weekDates = getWeekDates();

  const weekCourses = courses.filter(
    c => currentWeek >= c.startWeek && currentWeek <= c.endWeek,
  );

  // 本周有课的节次 → Set 去重 → 排序 → 时间线数据
  const timeMarkers = [...new Set(weekCourses.map(c => c.startSection))]
    .filter(s => s >= 1 && s <= SECTION_TIMES.length)
    .sort((a, b) => a - b)
    .map(startSection => ({
      time: SECTION_TIMES[startSection - 1],
      top:
        startSection <= 4
          ? (startSection - 1) * CLASS_HEIGHT
          : 4 * CLASS_HEIGHT + LUNCH_GAP + (startSection - 5) * CLASS_HEIGHT,
    }));

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}.${day}`;
  };

  // 横滑切周的跟手位移量（useRef：动画值必须跨渲染保持同一个对象）
  const translateX = useRef(new Animated.Value(0)).current;

  // 松手/被抢时弹回原位
  const springBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  /** 手势切周 */
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => {
      const {dx, dy} = g;

      //水平滑动判断
      const isHorizontal =
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3;

      return isHorizontal;
    },

    // 接管期间：课表实时跟手平移
    onPanResponderMove: (_, g) => {
      translateX.setValue(g.dx);
    },

    onPanResponderRelease: (_, g) => {
      const {dx} = g;

      if (courses.length !== 0) {
        if (dx < -25) {
          const newWeek = currentWeek + 1;
          setCurrentWeek(newWeek);
        } else if (dx > 25 && currentWeek > 1) {
          const newWeek = currentWeek - 1;
          setCurrentWeek(newWeek);
        }
      }
      springBack();
    },

    // 手势被抢走时也弹回，避免课表卡在偏移位置
    onPanResponderTerminate: springBack,
  });

  /** 课程颜色 */
  const getCourseColor = (index: number) => {
    return courseColors[index % courseColors.length];
  };

  /** 清空课表 */
  const clearCourses = async () => {
    await AsyncStorage.removeItem('parsedCourses');
    setCourses([]);
    Alert.alert('已清空', '课表已删除');
  };

  return (
    <ImageBackground
      source={selectedBgUri ? {uri: selectedBgUri} : DEFAULT_BACKGROUND}
      style={styles.container}
      resizeMode="cover">
      {/* 顶部 */}
      <View style={styles.header}>
        <Text style={styles.weekText}>
          {courses.length === 0
            ? '主人目前还没导入课表呢 *-*'
            : `第 ${currentWeek} 周`}
        </Text>

        <TouchableOpacity onPress={() => setSettingsModalVisible(true)}>
          <Text style={styles.gear}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* 星期栏 */}
      <View style={styles.weekRow}>
        {weekdays.map((w, i) => (
          <View key={i} style={[styles.weekItem, {width: dayWidth}]}>
            <Text style={styles.weekName}>{w}</Text>
            <Text style={styles.dateText}>{formatDate(weekDates[i])}</Text>
          </View>
        ))}
      </View>

      {/* 手势在外层捕获，内部 ScrollView 用于竖向滚动 */}
      <Animated.View
        style={{flex: 1, transform: [{translateX}]}}
        {...panResponder.panHandlers}>
        <ScrollView>
          {/* 课程格子的画布 */}
          <View
            style={[
              styles.grid,
              {
                width: dayWidth * 7,
                height: CLASS_HEIGHT * 13,
              },
            ]}>
            {/* 时间虚线（渲染在课程格子下方） */}
            {timeMarkers.map(({time, top}) => (
              <View
                key={time}
                style={[styles.timeMarker, {top, width: dayWidth * 7}]}>
                <View style={styles.timeDash} />
                <Text style={styles.timeText}>{time}</Text>
                <View style={styles.timeDash} />
              </View>
            ))}
            {weekCourses.map((c, index) => {
              /** Y 坐标根据午休调整 */
              let top = 0;
              if (c.startSection <= 4) {
                top = (c.startSection - 1) * CLASS_HEIGHT;
              } else {
                top =
                  4 * CLASS_HEIGHT +
                  LUNCH_GAP +
                  (c.startSection - 5) * CLASS_HEIGHT;
              }

              const height = (c.endSection - c.startSection + 1) * CLASS_HEIGHT;

              return (
                <View
                  key={index}
                  style={[
                    styles.courseBlock,
                    {
                      left: (c.day - 1) * dayWidth,
                      top,
                      width: dayWidth - 6,
                      height,
                      backgroundColor: getCourseColor(index),
                    },
                  ]}>
                  {/*课程名占据剩余空间，尽可能多显示*/}
                  <Text
                    style={[styles.courseName, {flex: 1}]}
                    numberOfLines={Math.max(
                      1,
                      Math.floor((height - 20) / 16 - 3),
                    )} // 减 3 让位
                  >
                    {c.courseName}
                  </Text>
                  {c.teacher ? (
                    <Text style={styles.courseTeacher} numberOfLines={1}>
                      {c.teacher}
                    </Text>
                  ) : null}

                  {/* ★★ 教室号固定在底部，完整显示优先 */}
                  <Text style={styles.courseLocation} numberOfLines={2}>
                    {c.location}
                  </Text>
                </View>
              );
            })}

            {courses.length === 0 && (
              <View style={{padding: 20}}>
                <Text
                  style={{fontSize: 16, textAlign: 'center', color: '#666'}}>
                  点击右上角设置图标导入课表
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      {/* 导入弹窗 */}
      <Modal
        visible={importModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>导入课表（文本）</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, {fontSize: 14}]}>
              请按以下格式粘贴课表文本（可从截图识别）：周一 C语言程序设计
              王老师 1-2节 D1211 3-7周
            </Text>

            <TextInput
              style={styles.textInput}
              value={textContent}
              onChangeText={setTextContent}
              multiline={true}
              placeholder="例如：周一 C语言程序设计 王老师 1-2节 D1211 3-7周"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.importButton}
              onPress={async () => {
                try {
                  if (!textContent.trim()) {
                    Alert.alert('提示', '请输入课表内容');
                    return;
                  }
                  const parsed = parseTextTimetable(textContent);
                  if (parsed.length === 0) {
                    Alert.alert('提示', '未解析到课程数据');
                    return;
                  }
                  await AsyncStorage.setItem(
                    'parsedCourses',
                    JSON.stringify(parsed),
                  );
                  setCourses(parsed);
                  Alert.alert('成功', `共导入 ${parsed.length} 条记录`);
                  setImportModalVisible(false);
                  setTextContent('');
                } catch (err) {
                  console.error(err);
                  Alert.alert(
                    '导入失败',
                    err instanceof Error ? err.message : '解析失败',
                  );
                }
              }}>
              <Text style={styles.importButtonText}>导入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 设置先导窗口 */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>设置</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.settingsButton, {marginTop: 20}]}
              onPress={() => {
                setSettingsModalVisible(false);
                setImportModalVisible(true);
              }}>
              <Text style={styles.settingsButtonText}>导入课表</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setSettingsModalVisible(false);
                setDateModalVisible(true);
              }}>
              <Text style={styles.settingsButtonText}>
                设置第一周周一的日期
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsButton, {backgroundColor: '#FF3B30'}]}
              onPress={() => {
                setSettingsModalVisible(false);
                Alert.alert('提示', '主人要清空课表吗o(=•ェ•=)m', [
                  {
                    text: '算了',
                    style: 'cancel',
                  },
                  {
                    text: '确定',
                    onPress: clearCourses,
                  },
                ]);
              }}>
              <Text style={[styles.settingsButtonText, {color: '#fff'}]}>
                清空课表
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 日期选择窗口 */}
      <Modal
        visible={dateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择学期开始日期</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.modalSubtitle,
                {fontSize: 14, marginTop: 20, marginBottom: 10},
              ]}>
              请输入第一周周一的日期（如2026.3.1）：
            </Text>

            <TextInput
              style={[styles.textInput, {height: 50}]}
              value={semesterStartDate}
              onChangeText={setSemesterStartDate}
              placeholder="如2026.3.1"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity
              style={[styles.importButton, {marginTop: 30}]}
              onPress={async () => {
                try {
                  if (!semesterStartDate.trim()) {
                    Alert.alert('提示', '请输入日期');
                    return;
                  }

                  // 保存学期开始日期
                  await AsyncStorage.setItem(
                    'semesterStartDate',
                    semesterStartDate,
                  );

                  // 设置日期后重置为第1周
                  setCurrentWeek(1);

                  // 重新加载课程数据以更新日期显示
                  const saved = await AsyncStorage.getItem('parsedCourses');
                  if (saved) {
                    setCourses(JSON.parse(saved));
                  }

                  Alert.alert('成功', '学期开始日期已设置');
                  setDateModalVisible(false);
                } catch (error) {
                  console.error(error);
                  Alert.alert('错误', '设置失败');
                }
              }}>
              <Text style={styles.importButtonText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

/* 样式 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'transparent',
  },
  weekText: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: '#000',
  },
  gear: {fontSize: 22},

  weekRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  weekItem: {alignItems: 'center'},
  weekName: {fontSize: 16, fontWeight: '600', color: '#333'},
  dateText: {fontSize: 12, color: '#666'},

  grid: {position: 'relative', backgroundColor: 'transparent'},

  timeMarker: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.35)',
    marginHorizontal: 6,
  },
  timeText: {fontSize: 11, color: '#666'},

  courseBlock: {
    borderRadius: 6,
    padding: 2,
    justifyContent: 'space-between',
    position: 'absolute',
  },
  courseName: {color: '#fff', fontSize: 13, fontWeight: '700'},
  courseTeacher: {color: '#fff', fontSize: 11, opacity: 0.85},
  courseLocation: {color: '#fff', fontSize: 12, marginTop: 2},

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {fontSize: 22, fontWeight: 'bold', flex: 1, textAlign: 'center'},
  closeButton: {fontSize: 28, color: '#666'},
  modalSubtitle: {color: '#666', textAlign: 'center', marginBottom: 20},

  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    height: 200,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },

  importButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  importButtonText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},

  // 设置按钮样式
  settingsButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    fontSize: 16,
    color: '#333',
  },
});
