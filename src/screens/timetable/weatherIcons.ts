import type {HourlyForecast} from './weatherTypes';

/** "08:30" → 当天第几分钟 */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** 天气图标：雷暴（看 condition code 302-304）> 雪 > 冰 > 雨/混合 */
export const iconOf = (h: HourlyForecast) => {
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
export const conditionIcon = (code: string) => {
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
export const hourIcon = (h: HourlyForecast) => {
  const p = h.precipitation.probability;
  if (p >= 0.3) {
    return iconOf(h);
  }
  return conditionIcon(h.condition.code);
};

/** 单日代表图标：窗口=早8~晚10；坏天气优先（雪>雷>大雨>小雨，概率≥30%才算报）；无降水看云量 */
export const dayIconOf = (hours: HourlyForecast[]) => {
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
export const dayLabel = (index: number, date: Date) => {
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
