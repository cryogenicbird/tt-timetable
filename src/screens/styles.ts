import {StyleSheet, StatusBar} from 'react-native';

export const styles = StyleSheet.create({
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
