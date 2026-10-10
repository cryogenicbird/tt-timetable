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
  TextInput,
  ImageBackground,
  NativeModules,
  useWindowDimensions,
  StatusBar,
  Switch,
  FlatList,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import parseTextTimetable, {Course} from '../utils/parseTextTimetable';
import {loadFolderImages} from '../utils/loadFolderImages';
import BaseModal from '../component/BaseModal';
import SliderBase from '@react-native-community/slider';

const Slider = SliderBase as unknown as React.ComponentType<any>;

// 默认坐标（重庆大学）：没有历史定位时的兜底
const DEFAULT_LAT = '29.36';
const DEFAULT_LON = '106.18';

// 天气后端地址（腾讯云轻量服务器）
const WEATHER_BASE = 'http://124.223.162.5:8080/weather/hourly';

/** 午休的空隙 */
const LUNCH_GAP = 2;

/** 每节课高度 */
const CLASS_HEIGHT = 57;

/** 星期显示 */
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

/** 0~1 的透明度 → 两位十六进制（FF=完全不透明） */
const alphaToHex = (alpha: number) =>
  Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

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

/** 单小时预报（只挑用得上的字段） */
type HourlyForecast = {
  forecastTime: string;
  condition: {text: string; code: string};
  temperature: {value: number};
  precipitation: {
    probability: number;
    type: string;
    intensity: {value: number};
  };
};

/** "08:30" → 当天第几分钟 */
const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** 天气图标：雷暴（看 condition code 302-304）> 雪 > 冰 > 雨/混合 */
const iconOf = (h: HourlyForecast) => {
  const code = Number(h.condition.code);
  if (code >= 302 && code <= 304) {
    return '⛈';
  }
  const t = h.precipitation.type;
  if (t === 'snow') {
    return '🌨';
  }
  if (t === 'ice') {
    return '🧊';
  }
  if (t === 'rain' || t === 'mixed') {
    return '🌧';
  }
  return '❓';
};

/** 小时天气图标（按 condition code） */
const conditionIcon = (code: string) => {
  const n = Number(code);
  if (n >= 302 && n <= 304) {
    return '⛈';
  }
  if (n >= 300 && n < 400) {
    return '🌧';
  }
  if (n >= 400 && n < 500) {
    return '🌨';
  }
  if (n === 104) {
    return '☁️';
  }
  if (n === 101) {
    return '⛅';
  }
  if (n === 100) {
    return '☀️';
  }
  return '🌤';
};

/** 小时图标（概率分档）：≥30% 显示降水图标，否则实际现象；后缀 !/? 由渲染处单独上色 */
const hourIcon = (h: HourlyForecast) => {
  const p = h.precipitation.probability;
  if (p >= 0.3) {
    return iconOf(h);
  }
  return conditionIcon(h.condition.code);
};

/** 单日代表图标：窗口=早8~晚10；坏天气优先（雪>雷>大雨>小雨，概率≥30%才算报）；无降水看云量 */
const dayIconOf = (hours: HourlyForecast[]) => {
  const windowHours = hours.filter(h => {
    const hr = new Date(h.forecastTime).getHours();
    return hr >= 8 && hr <= 21;
  });
  let hasSnow = false,
    hasRain = false,
    hasThunder = false,
    maxIntensity = 0;
  for (const h of windowHours) {
    const t = h.precipitation.type;
    if (t === 'snow' && h.precipitation.probability >= 0.3) {
      hasSnow = true;
    }
    if (
      (t === 'rain' || t === 'mixed' || t === 'ice') &&
      h.precipitation.probability >= 0.3
    ) {
      hasRain = true;
      maxIntensity = Math.max(
        maxIntensity,
        h.precipitation.intensity?.value ?? 0,
      );
    }
    const n = Number(h.condition.code);
    if (n >= 302 && n <= 304) {
      hasThunder = true;
    }
  }
  if (hasSnow) {
    return '🌨';
  }
  if (hasThunder) {
    return '⛈';
  }
  if (hasRain) {
    return maxIntensity >= 8 ? '🌧' : '🌦';
  }
  let sunny = 0,
    cloudy = 0;
  for (const h of windowHours) {
    const n = Number(h.condition.code);
    if (n === 100 || n === 102 || n === 103) {
      sunny++;
    } else {
      cloudy++;
    }
  }
  return cloudy > sunny ? '⛅' : '☀️';
};

/** 第几天 → 今天/明天/后天/周x */
const dayLabel = (index: number, date: Date) => {
  if (index === 0) {
    return '今天';
  }
  if (index === 1) {
    return '明天';
  }
  if (index === 2) {
    return '后天';
  }
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
    date.getDay()
  ];
};

/** 天气页：单日详情图（每小时图标+温度）+ 十天行列表 */
const WeatherPage = ({
  groups,
  index,
  onSelect,
  lat,
  lon,
}: {
  groups: {key: string; label: string; hours: HourlyForecast[]}[];
  index: number;
  onSelect: (i: number) => void;
  lat: string;
  lon: string;
}) => {
  const day = groups[index];
  const chartRef = useRef<ScrollView>(null);
  useEffect(() => {
    chartRef.current?.scrollTo({x: 0, animated: false});
  }, [index]);
  // 详情图区域只响应横向滑动：竖向手势直接接管并按死，父级翻页列表抢不走
  const chartLock = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  if (!day) {
    return null;
  }
  const temps = day.hours.map(h => h.temperature.value);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  return (
    <View style={{flex: 1}}>
      {/* 左上角：当前天气所属经纬度 */}
      <Text
        style={{
          position: 'absolute',
          top: 8,
          left: 14,
          fontSize: 12,
          color: '#666',
        }}>
        {lat}, {lon} 天气数据来源：和风天气
      </Text>
      {/* 标题下移、贴近详情图 */}
      <Text
        style={{
          textAlign: 'center',
          fontSize: 16,
          color: '#333',
          fontWeight: '600',
          marginTop: 30,
        }}>
        {day.label}（{dayLabel(index, new Date(day.hours[0].forecastTime))}）
      </Text>
      <Text
        style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#666',
          marginTop: 2,
        }}>
        {Math.round(min)}° ~ {Math.round(max)}°
      </Text>
      {/* 单日详情图：只横向滑 */}
      <View {...chartLock.panHandlers}>
        <ScrollView
          ref={chartRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{marginTop: 2, flexGrow: 0}}>
          {day.hours.map(h => (
            <View
              key={h.forecastTime}
              style={{width: 42, alignItems: 'center', paddingVertical: 4}}>
              <View
                style={{
                  width: 42,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{fontSize: 20}}>
                  {hourIcon(h)}
                  {h.precipitation.probability > 0.6 && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#E53935',
                        fontWeight: 'bold',
                      }}>
                      !
                    </Text>
                  )}
                  {h.precipitation.probability >= 0.3 &&
                    h.precipitation.probability <= 0.6 && (
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#E53935',
                          fontWeight: 'bold',
                        }}>
                        ?
                      </Text>
                    )}
                </Text>
              </View>
              <Text style={{fontSize: 13, color: '#666', marginTop: 2}}>
                {Math.round(h.temperature.value)}°
              </Text>
              <Text style={{fontSize: 12, color: '#666', marginTop: 2}}>
                {new Date(h.forecastTime).getHours()}时
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      {/* 十天列表：点行切换，当前行高亮 */}
      <View style={{marginTop: 8, flex: 1}}>
        {groups.map((g, i) => {
          const gTemps = g.hours.map(h => h.temperature.value);
          const gMin = Math.min(...gTemps);
          const gMax = Math.max(...gTemps);
          return (
            <TouchableOpacity
              key={g.key}
              onPress={() => onSelect(i)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor:
                  i === index ? 'rgba(255,255,255,0.55)' : 'transparent',
              }}>
              <Text style={{fontSize: 14, color: '#333', width: 110}}>
                {g.label}（{dayLabel(i, new Date(g.hours[0].forecastTime))}）
              </Text>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{fontSize: 18}}>{dayIconOf(g.hours)}</Text>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: '#666',
                  width: 70,
                  textAlign: 'right',
                }}>
                {Math.round(gMin)}°~{Math.round(gMax)}°
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

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
  const [textContent, setTextContent] = useState('');
  const [semesterStartDate, setSemesterStartDate] = useState('');
  const [selectedBgUri, setSelectedBgUri] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    | 'settings'
    | 'import'
    | 'date'
    | 'period'
    | 'appearance'
    | 'detail'
    | 'confirmDelete'
    | null
  >(null);
  const [Section_start_times, setSection_start_times] = useState([
    '08:30',
    '09:25',
    '10:30',
    '11:25',
    '13:30',
    '14:25',
    '15:20',
    '16:25',
    '17:20',
    '19:00',
    '19:55',
  ]);
  const [class_Duration, setClass_Duration] = useState(45);
  const [blockAlpha, setBlockAlpha] = useState(0.5);
  const [backdropAlpha, setBackdropAlpha] = useState(0.4);
  const [markerVisible, setMarkerVisible] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [weather, setWeather] = useState<{hours: HourlyForecast[]} | null>(
    null,
  );
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [weatherPageH, setWeatherPageH] = useState(0);
  const [dayIndex, setDayIndex] = useState(0);
  const [myLat, setMyLat] = useState(DEFAULT_LAT);
  const [myLon, setMyLon] = useState(DEFAULT_LON);
  const [weatherMsg, setWeatherMsg] = useState('');
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
  //计算top
  const get_top = (startSection: number) =>
    startSection <= 4
      ? (startSection - 1) * CLASS_HEIGHT
      : (startSection - 5) * CLASS_HEIGHT + LUNCH_GAP + 4 * CLASS_HEIGHT;
  //计算结束时间
  const get_end_time = (start_time: string, duration: number) => {
    const [h, m] = start_time.split(':').map(Number);
    const remainder = Math.floor((m + duration) / 60);
    const hour = (h + remainder) % 24;
    const minute = (m + duration) % 60;
    return `${hour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}`;
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
      //加载保存的时段设置
      const savedSetionStartTimes = await AsyncStorage.getItem(
        'section_start_times',
      );
      if (savedSetionStartTimes) {
        setSection_start_times(JSON.parse(savedSetionStartTimes));
      }

      const savedClassDuration = await AsyncStorage.getItem('class_Duration');
      if (savedClassDuration) {
        setClass_Duration(JSON.parse(savedClassDuration));
      }
      // 加载格子透明度
      const savedAlpha = await AsyncStorage.getItem('block_alpha');
      if (savedAlpha) {
        setBlockAlpha(JSON.parse(savedAlpha));
      }
      // 加载天气页底衬透明度
      const savedBackdrop = await AsyncStorage.getItem('backdrop_alpha');
      if (savedBackdrop) {
        setBackdropAlpha(JSON.parse(savedBackdrop));
      }
      //加载时间标记可见性
      const savedMarkerVisible = await AsyncStorage.getItem('markerVisible');
      if (savedMarkerVisible) {
        setMarkerVisible(JSON.parse(savedMarkerVisible));
      }
    })();
  }, []);
  // 拉天气数据
  const fetchWeather = async (lat: string, lon: string) => {
    try {
      const res = await fetch(`${WEATHER_BASE}/${lat}/${lon}`);
      const data = await res.json();
      setWeather(data);
    } catch (err) {
      console.error('天气获取失败:', err);
      setWeatherFailed(true);
    }
  };

  // 进 App：权限 → 定位（失败回退上次坐标）→ 拉天气
  useEffect(() => {
    (async () => {
      try {
        const already = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        const granted =
          already ||
          (await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          )) === PermissionsAndroid.RESULTS.GRANTED;
        if (!granted) {
          setWeatherMsg('请授予应用定位权限并打开定位以获得天气服务');
          return;
        }
        Geolocation.getCurrentPosition(
          pos => {
            const lat = pos.coords.latitude.toFixed(2);
            const lon = pos.coords.longitude.toFixed(2);
            setMyLat(lat);
            setMyLon(lon);
            AsyncStorage.setItem('last_lat', lat); // 每次成功定位都更新本地坐标
            AsyncStorage.setItem('last_lon', lon);
            fetchWeather(lat, lon);
          },
          async () => {
            // 同意过权限但定位失败（如 GPS 没开）→ 用上次的经纬度
            const lastLat = await AsyncStorage.getItem('last_lat');
            const lastLon = await AsyncStorage.getItem('last_lon');
            if (lastLat && lastLon) {
              setMyLat(lastLat);
              setMyLon(lastLon);
              fetchWeather(lastLat, lastLon);
            } else {
              setWeatherMsg('请授予应用定位权限并打开定位以获得天气服务');
            }
          },
          {enableHighAccuracy: false, timeout: 10000, maximumAge: 300000},
        );
      } catch (err) {
        console.error('定位流程异常:', err);
        setWeatherMsg('请授予应用定位权限并打开定位以获得天气服务');
      }
      // 定位权限弹窗尘埃落定后，再申请相册权限：Android 系统权限弹窗一次只能
      // 弹一个，并发申请会撞车——相册的请求被静默吞掉，只能等下次启动才出现
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

  /** 某门课的天气预警：null=无需提示；strong=true 用 !，false 用 ? */
  const getWeatherWarning = (
    c: Course,
  ): {icon: string; strong: boolean} | null => {
    if (!weather?.hours?.length) {
      return null;
    }
    // 按课程所在的具体日期匹配预报（预报只覆盖未来 10 天，翻到更远的周自然无提示）
    const courseDate = weekDates[c.day - 1];
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateKey = `${courseDate.getFullYear()}-${pad(
      courseDate.getMonth() + 1,
    )}-${pad(courseDate.getDate())}`;
    // 上课时间窗口：课前 20 分钟 ~ 课后 20 分钟
    const startTime = Section_start_times[c.startSection - 1];
    const endTime = Section_start_times[c.endSection - 1];
    if (!startTime || !endTime) {
      return null;
    } // 超出已定义时段（第12节之后）的课不提示
    const from = toMinutes(startTime) - 20;
    const to = toMinutes(get_end_time(endTime, class_Duration)) + 20;
    let best: {icon: string; prob: number} | null = null;
    for (const h of weather.hours) {
      if (!h.forecastTime.startsWith(dateKey)) {
        continue;
      }
      const d = new Date(h.forecastTime);
      const mins = d.getHours() * 60 + d.getMinutes();
      if (mins >= from && mins <= to) {
        const p = h.precipitation.probability;
        if (!best || p > best.prob) {
          best = {icon: iconOf(h), prob: p};
        } // 窗口内取最大概率
      }
    }
    if (!best) {
      return null;
    }
    if (best.prob > 0.6) {
      return {icon: best.icon, strong: true};
    }
    if (best.prob >= 0.3) {
      return {icon: best.icon, strong: false};
    }
    return null;
  };

  // 按天分组：每天一页温度曲线
  const dayGroups: {key: string; label: string; hours: HourlyForecast[]}[] = [];
  for (const h of weather?.hours ?? []) {
    const key = h.forecastTime.slice(0, 10);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.key === key) {
      last.hours.push(h);
    } else {
      const d = new Date(h.forecastTime);
      dayGroups.push({
        key,
        label: `${d.getMonth() + 1}月${d.getDate()}日`,
        hours: [h],
      });
    }
  }

  const weekCourses = courses.filter(
    c => currentWeek >= c.startWeek && currentWeek <= c.endWeek,
  );

  // 本周有课的节次 → Set 去重 → 排序 → 时间线数据
  const timeMarkers = [...new Set(weekCourses.map(c => c.startSection))]
    .filter(s => s >= 1 && s <= Section_start_times.length)
    .sort((a, b) => a - b)
    .map(startSection => ({
      time: Section_start_times[startSection - 1],
      top: get_top(startSection),
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
          NativeModules.VibrationModule.vibrate(100); // 切周成功：短震动反馈
        } else if (dx > 25 && currentWeek > 1) {
          const newWeek = currentWeek - 1;
          setCurrentWeek(newWeek);
          NativeModules.VibrationModule.vibrate(100);
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

  /** 判断两段是否属于同一门课（同名+同天+同节次；分段导入会产生多个对象） */
  const isSameCourse = (a: Course, b: Course) =>
    a.courseName === b.courseName &&
    a.day === b.day &&
    a.startSection === b.startSection &&
    a.endSection === b.endSection;

  /** 删除课程：deleteAll=true 删整门课；false 只删当前周这一格（跨周课拆成前后两段） */
  const deleteCourse = (deleteAll: boolean) => {
    if (!selectedCourse) {
      return;
    }
    let next: Course[];
    if (deleteAll) {
      next = courses.filter(c => !isSameCourse(c, selectedCourse));
    } else {
      next = courses.flatMap(c => {
        if (c !== selectedCourse) {
          return [c];
        }
        const parts: Course[] = [];
        if (currentWeek > c.startWeek) {
          parts.push({...c, endWeek: currentWeek - 1});
        }
        if (currentWeek < c.endWeek) {
          parts.push({...c, startWeek: currentWeek + 1});
        }
        return parts; // 前后都不剩（单周课）= 整门消失
      });
    }
    setCourses(next);
    AsyncStorage.setItem('parsedCourses', JSON.stringify(next));
    setSelectedCourse(null);
    setActiveModal(null);
  };

  // 同一门课的所有分段（用于"整门课删除"的匹配和真实周数范围显示）
  const sameCourseSegments = selectedCourse
    ? courses.filter(c => isSameCourse(c, selectedCourse))
    : [];
  const courseWeekSpan = sameCourseSegments.length
    ? `${Math.min(...sameCourseSegments.map(s => s.startWeek))}-${Math.max(
        ...sameCourseSegments.map(s => s.endWeek),
      )}`
    : '';

  return (
    <View style={[styles.container, {backgroundColor: '#ECEFF1'}]}>
      {selectedBgUri ? (
        <ImageBackground
          source={{uri: selectedBgUri}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="light-content"
      />
      {/* 顶部 */}
      <View style={styles.header}>
        <Text style={styles.weekText}>
          {courses.length === 0
            ? '目前还没导入课表呢 *-*'
            : `       第 ${currentWeek} 周`}
        </Text>

        <TouchableOpacity onPress={() => setActiveModal('settings')}>
          <Text style={styles.gear}>🔧</Text>
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

      {/* 课表页 + 天气曲线页：纵向翻页列表 */}
      <FlatList
        style={{flex: 1}}
        data={['weather']}
        keyExtractor={(_, i) => String(i)}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onLayout={e => setWeatherPageH(e.nativeEvent.layout.height)}
        ListHeaderComponent={
          <View style={weatherPageH > 0 ? {height: weatherPageH} : undefined}>
            {/* 手势在外层捕获*/}
            <Animated.View
              style={{transform: [{translateX}]}}
              {...panResponder.panHandlers}>
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
                {markerVisible &&
                  timeMarkers.map(({time, top}) => (
                    <View
                      key={time}
                      style={[
                        styles.timeMarker,
                        {top: top - 8, width: dayWidth * 7},
                      ]}>
                      <View style={styles.timeDash} />
                      <Text style={styles.timeText}>{time}</Text>
                      <View style={styles.timeDash} />
                    </View>
                  ))}
                {weekCourses.map((c, index) => {
                  const height =
                    (c.endSection - c.startSection + 1) * CLASS_HEIGHT;
                  const warning = getWeatherWarning(c);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.courseBlock,
                        {
                          left: (c.day - 1) * dayWidth,
                          top: get_top(c.startSection),
                          width: dayWidth - 6,
                          height,
                          backgroundColor:
                            getCourseColor(index) + alphaToHex(blockAlpha),
                        },
                      ]}
                      onPress={() => {
                        setSelectedCourse(c);
                        setActiveModal('detail');
                      }}>
                      <View style={{flex: 1}}>
                        {/*课程名占据剩余空间，尽可能多显示*/}
                        <Text
                          style={styles.courseName}
                          numberOfLines={Math.max(
                            1,
                            Math.floor((height - 20) / 16 - 3),
                          )} // 减 3 让位
                        >
                          {c.courseName}
                        </Text>
                        {warning && (
                          <Text style={styles.courseWeatherIcon}>
                            {warning.icon}
                            {warning.strong ? '!' : '?'}
                          </Text>
                        )}
                      </View>
                      {c.teacher ? (
                        <Text style={styles.courseTeacher} numberOfLines={1}>
                          {c.teacher}
                        </Text>
                      ) : null}

                      {/* ★★ 教室号固定在底部，完整显示优先 */}
                      <Text style={styles.courseLocation} numberOfLines={2}>
                        {c.location}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {courses.length === 0 && (
                  <View style={{padding: 20}}>
                    <Text
                      style={{
                        fontSize: 16,
                        textAlign: 'center',
                        color: '#666',
                      }}>
                      点击右上角设置图标导入课表
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
            <Text style={{fontSize: 14, textAlign: 'center', color: '#666'}}>
              {weather?.hours?.length
                ? `${weather.hours[0].condition.text} ${Math.round(
                    weather.hours[0].temperature.value,
                  )}°C`
                : weatherFailed
                ? '天气加载失败'
                : '暂无天气信息'}
            </Text>
          </View>
        }
        renderItem={() => (
          <View
            style={
              weatherPageH > 0 ? {height: weatherPageH, padding: 8} : undefined
            }>
            <View
              style={{
                flex: 1,
                borderRadius: 14,
                backgroundColor: '#FFFFFF' + alphaToHex(backdropAlpha),
              }}>
              {dayGroups.length > 0 ? (
                <WeatherPage
                  groups={dayGroups}
                  index={dayIndex}
                  onSelect={setDayIndex}
                  lat={myLat}
                  lon={myLon}
                />
              ) : (
                <Text
                  style={{
                    textAlign: 'center',
                    marginTop: 60,
                    color: '#666',
                    fontSize: 15,
                  }}>
                  {weatherMsg || '天气加载中…'}
                </Text>
              )}
            </View>
          </View>
        )}
      />

      {/* 导入弹窗 */}
      <BaseModal
        visible={activeModal === 'import'}
        title="导入课表"
        onClose={() => setActiveModal(null)}>
        <Text style={[styles.modalSubtitle, {fontSize: 14}]}>
          请按以下格式粘贴课表文本（可从截图识别）：周一 C语言程序设计 王老师
          1-2节 D1211 3-7周
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
              setActiveModal(null);
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
      </BaseModal>

      {/* 设置弹窗 */}
      <BaseModal
        title="设置"
        visible={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}>
        <Text>
          {' '}
          自定义课表背景的方法{'\n'}
          前往相册,创建一个名为“bg”的相册，往里面放入图片即可（多张图片将随机选取），确保课表有读取相册权限
        </Text>
        <TouchableOpacity
          style={[styles.settingsButton, {marginTop: 20}]}
          onPress={() => setActiveModal('import')}>
          <Text style={styles.settingsButtonText}>导入课表</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setActiveModal('date')}>
          <Text style={styles.settingsButtonText}>设置第一周周一的日期</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setActiveModal('period')}>
          <Text style={styles.settingsButtonText}>时段设置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setActiveModal('appearance')}>
          <Text style={styles.settingsButtonText}>外观设置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsButton, {backgroundColor: '#FF3B30'}]}
          onPress={() => {
            setActiveModal(null);
            Alert.alert('提示', '主人要清空课表吗o(=•ェ•=)m', [
              {text: '算了', style: 'cancel'},
              {text: '确定', onPress: clearCourses},
            ]);
          }}>
          <Text style={[styles.settingsButtonText, {color: '#fff'}]}>
            清空课表
          </Text>
        </TouchableOpacity>
      </BaseModal>

      {/* 日期弹窗 */}
      <BaseModal
        title="选择学期开始日期"
        visible={activeModal === 'date'}
        onClose={() => setActiveModal(null)}>
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
          placeholder={semesterStartDate || '2026.9.7'}
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
              setActiveModal(null);
            } catch (error) {
              console.error(error);
              Alert.alert('错误', '设置失败');
            }
          }}>
          <Text style={styles.importButtonText}>确定</Text>
        </TouchableOpacity>
      </BaseModal>

      {/* 时段设置弹窗 */}
      <BaseModal
        title="时段设置"
        visible={activeModal === 'period'}
        onClose={() => setActiveModal(null)}>
        <View style={[{flexDirection: 'row', alignItems: 'center'}]}>
          <Text style={styles.periodText}>每节课时长</Text>
          <TouchableOpacity
            style={styles.periodButtonBox}
            onPress={() => {
              setClass_Duration(Math.max(1, class_Duration - 1));
              AsyncStorage.setItem(
                'class_Duration',
                JSON.stringify(Math.max(1, class_Duration - 1)),
              );
            }}>
            <Text style={styles.periodButton}>-</Text>
          </TouchableOpacity>
          <Text style={styles.periodText}>{class_Duration} </Text>
          <TouchableOpacity
            style={styles.periodButtonBox}
            onPress={() => {
              setClass_Duration(class_Duration + 1);
              AsyncStorage.setItem(
                'class_Duration',
                JSON.stringify(class_Duration + 1),
              );
            }}>
            <Text style={styles.periodButton}>+</Text>
          </TouchableOpacity>
        </View>
        {Section_start_times.map((time, i) => (
          <View key={i} style={[{flexDirection: 'row', alignItems: 'center'}]}>
            <Text style={styles.periodLabel}>第{i + 1}节:</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  height: 40,
                  width: 70,
                  padding: 4,
                  fontSize: 13,
                  marginBottom: 0,
                },
              ]}
              value={Section_start_times[i]}
              onEndEditing={() => {
                AsyncStorage.setItem(
                  'section_start_times',
                  JSON.stringify(Section_start_times),
                );
              }}
              onChangeText={newTime => {
                setSection_start_times(prev =>
                  prev.map((t, index) => (i === index ? newTime : t)),
                );
              }}
            />
            <Text style={styles.periodLabel}>~</Text>

            <Text style={styles.periodLabel}>
              {get_end_time(Section_start_times[i], class_Duration)}
            </Text>
          </View>
        ))}
      </BaseModal>
      {/* 外观设置弹窗 */}
      <BaseModal
        visible={activeModal === 'appearance'}
        title="外观设置"
        onClose={() => setActiveModal(null)}>
        {/* 透明度滑块 */}
        <View style={{paddingHorizontal: 20}}>
          <Text style={styles.periodLabel}>
            课程格子透明度：{Math.round(blockAlpha * 100)}%
          </Text>
          <Slider
            style={{width: '100%', height: 40}}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={blockAlpha}
            onValueChange={setBlockAlpha}
            onSlidingComplete={(value: number) => {
              AsyncStorage.setItem('block_alpha', JSON.stringify(value));
            }}
          />
        </View>
        <View>
          <Text style={styles.periodLabel}>时间标记可见性：</Text>
          <Switch
            value={markerVisible}
            onValueChange={v => {
              setMarkerVisible(v);
              AsyncStorage.setItem('markerVisible', JSON.stringify(v));
            }}
          />
        </View>
        <View style={{paddingHorizontal: 20, marginTop: 12}}>
          <Text style={styles.periodLabel}>
            天气页面底衬透明度：{Math.round(backdropAlpha * 100)}%
          </Text>
          <Slider
            style={{width: '100%', height: 40}}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={backdropAlpha}
            onValueChange={setBackdropAlpha}
            onSlidingComplete={(value: number) => {
              AsyncStorage.setItem('backdrop_alpha', JSON.stringify(value));
            }}
          />
        </View>
      </BaseModal>
      <BaseModal
        visible={activeModal === 'detail'}
        title="课程详情"
        onClose={() => {
          setActiveModal(null);
          setSelectedCourse(null);
        }}>
        <View style={{flexDirection: 'row'}}>
          <Text>课程：</Text>
          <TextInput
            defaultValue={selectedCourse?.courseName}
            onChangeText={newName => {
              const next = courses.map(c =>
                c === selectedCourse ? {...c, courseName: newName} : c,
              ); // 定位 + 替换
              setCourses(next); // 写回课表
              AsyncStorage.setItem('parsedCourses', JSON.stringify(next)); // 落盘
            }}
          />
        </View>
        <View style={{flexDirection: 'row'}}>
          <Text>老师：</Text>
          <TextInput value={selectedCourse?.teacher} />
        </View>
        <View style={{flexDirection: 'row'}}>
          <Text>地点：</Text>
          <TextInput value={selectedCourse?.location} />
        </View>
        <TouchableOpacity
          style={[
            styles.settingsButton,
            {backgroundColor: '#FF3B30', marginTop: 20},
          ]}
          onPress={() => setActiveModal('confirmDelete')}>
          <Text style={[styles.settingsButtonText, {color: '#fff'}]}>删除</Text>
        </TouchableOpacity>
      </BaseModal>

      {/* 删除确认弹窗 */}
      <BaseModal
        visible={activeModal === 'confirmDelete'}
        title="删除课程"
        onClose={() => setActiveModal('detail')}>
        <Text style={styles.modalSubtitle}>
          删除《{selectedCourse?.courseName}》？
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => deleteCourse(false)}>
          <Text style={styles.settingsButtonText}>
            只删第 {currentWeek} 周这一节课
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsButton, {backgroundColor: '#FF3B30'}]}
          onPress={() => deleteCourse(true)}>
          <Text style={[styles.settingsButtonText, {color: '#fff'}]}>
            整门课删除（{courseWeekSpan} 周全删）
          </Text>
        </TouchableOpacity>
      </BaseModal>
    </View>
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
    padding: 1,
    paddingTop: StatusBar.currentHeight ?? 5,
    paddingHorizontal: 5,
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
    zIndex: 1,
  },
  timeDash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.35)',
    marginHorizontal: 1,
  },
  timeText: {fontSize: 11, color: '#666'},

  courseBlock: {
    borderRadius: 6,
    padding: 2,
    justifyContent: 'space-between',
    position: 'absolute',
    zIndex: 2,
  },
  courseName: {color: '#fff', fontSize: 13, fontWeight: '700'},
  courseTeacher: {color: '#fff', fontSize: 11, opacity: 0.85},
  courseLocation: {color: '#fff', fontSize: 12, marginTop: 2},
  courseWeatherIcon: {
    alignSelf: 'flex-end',
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 2,
  },

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
  periodText: {fontSize: 20, color: '#333', marginBottom: 0},
  periodLabel: {color: '#333', fontSize: 14},
  periodButton: {fontSize: 30, color: '#333', marginBottom: 0, lineHeight: 29},
  periodButtonBox: {
    borderWidth: 1,
    borderColor: '#333',
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
});
