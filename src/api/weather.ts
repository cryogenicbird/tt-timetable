import {request} from './client';
import type {HourlyForecast} from '../screens/timetable/weatherTypes';

export interface WeatherData {
  hours: HourlyForecast[];
}

export const weatherApi = {
  getHourly(lat: string, lon: string) {
    return request<WeatherData>(
      `/weather/hourly/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`,
    );
  },
};
