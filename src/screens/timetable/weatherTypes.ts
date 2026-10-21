/** 单小时预报（只挑用得上的字段） */
export type HourlyForecast = {
  forecastTime: string;
  condition: {text: string; code: string};
  temperature: {value: number};
  precipitation: {
    probability: number;
    type: string;
    intensity: {value: number};
  };
};

/** 按天分组的预报 */
export type DayGroup = {
  key: string;
  label: string;
  hours: HourlyForecast[];
};
