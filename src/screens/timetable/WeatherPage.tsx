import {useEffect, useRef} from 'react';
import {
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {dayIconOf, dayLabel, hourIcon} from './weatherIcons';
import type {DayGroup} from './weatherTypes';

/** 天气页：单日详情图（每小时图标+温度）+ 十天行列表 */
export default function WeatherPage({
  groups,
  index,
  onSelect,
  lat,
  lon,
  onOpenManualLoc,
  updatedAt,
}: {
  groups: DayGroup[];
  index: number;
  onSelect: (i: number) => void;
  lat: string;
  lon: string;
  onOpenManualLoc: () => void;
  updatedAt: number | null;
}) {
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
      <TouchableOpacity onPress={onOpenManualLoc}>
        <Text
          style={{
            position: 'absolute',
            top: 8,
            left: 14,
            fontSize: 12,
            color: '#666',
          }}>
          {lat}, {lon}{' '}
          {updatedAt !== null
            ? Math.floor((Date.now() - updatedAt) / 60000)
            : '--'}
          分钟前更新 （数据来源：和风天气）
        </Text>
      </TouchableOpacity>
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
      <View style={{marginTop: 5, flex: 1}}>
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
                paddingVertical: 5,
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
}
