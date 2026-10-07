# TimetableApp 课表 App

一款 React Native 写的安卓课表应用：导入文本课表 → 按周展示课程，支持手势切周、相册背景、时间线标记。

## 功能

- **文本课表导入**：按固定格式粘贴课表文本（支持格式校验，错误行会明确提示）
- **周视图课表**：7 列 × 13 节网格，课程格子按节次绝对定位，午休自动留空
- **手势切周**：左右滑动切换周数（PanResponder 横向手势 + 竖向滚动共存），拖动时课表跟手平移，松手弹簧回弹
- **自动定位当前周**：启动时按"第一周周一 + 今天日期"计算当前周（毫秒差算法，跨月跨年免疫）
- **相册背景**：读取手机 "bg" 相册随机选图做背景（游标分页拉取全相册），无图时使用内置默认图
- **时间线**：本周有课的节次自动绘制虚线时间标记（Set 去重，同节次多课程只画一条）
- **横屏适配**：useWindowDimensions 响应旋转，课表自动铺满

## 技术栈

- React Native 0.74.3 + React 18.2.0 + TypeScript 5.0.4
- @react-native-async-storage/async-storage（课表/设置持久化）
- @react-native-camera-roll/camera-roll（相册背景）
- Jest + react-test-renderer（冒烟测试，原生模块 mock）

## 运行

```bash
npm install
npm run android        # 需要连接设备或模拟器
```

## 打包（release APK）

```bash
cd android
./gradlew.bat assembleRelease
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

> 签名信息在 `android/keystore.properties` 中（不入库）；需自行准备 `android/app/my-release-key.keystore`。

## 课表文本格式

每行一个课程，空格分隔，共 6 段：

```
周一 C语言程序设计 王老师 1-2节 D1211 3-7周
```

| 段 | 含义 | 示例 |
|---|---|---|
| 1 | 星期（周一~周日） | 周一 |
| 2 | 课程名 | C语言程序设计 |
| 3 | 教师 | 王老师 |
| 4 | 节次范围 | 1-2节 |
| 5 | 教室 | D1211 |
| 6 | 周次范围 | 3-7周 |

## 目录结构

```
├── App.tsx                      # 根组件
├── index.js                     # RN 入口（AppRegistry 注册）
└── src/
    ├── screens/
    │   └── TimetableScreen.tsx  # 主页面（状态中枢 + 课表渲染）
    ├── utils/
    │   ├── parseTextTimetable.ts  # 课表文本解析（token 分类 + 格式校验）
    │   ├── loadFolderImages.ts    # 相册读取（游标分页）
    │   └── hasAndroidPermission.ts# 相册权限（Android 版本分支）
    └── pic/                     # 内置默认背景图
```

## 测试

```bash
npm test          # Jest 冒烟测试（__mocks__ 提供原生模块假实现）
npx tsc --noEmit  # TypeScript 类型检查
npx eslint .      # 代码风格检查
```
