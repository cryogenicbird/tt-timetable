# TimetableApp 课表 App

一款 React Native 安卓课表应用：导入文本课表 → 按周展示课程，支持手势切周、相册背景、时段/外观自定义、课程管理，以及基于自建后端的天气预警与十天天气页。

## 功能

### 课表核心

- **文本课表导入**：按固定格式粘贴课表文本（支持格式校验，错误行会明确提示）
- **周视图课表**：7 列 × 13 节网格，课程格子按节次绝对定位，午休自动留空
- **手势切周**：左右滑动切换周数（PanResponder 横向手势），拖动时课表跟手平移，松手弹簧回弹
- **自动定位当前周**：启动时按"第一周周一 + 今天日期"计算当前周
- **相册背景**：读取手机 "bg" 相册随机选图做背景，无图时使用纯色背景
- **时间线**：本周有课的节次自动绘制虚线时间标记（Set 去重，同节次多课程只画一条）

### 自定义

- **时段设置**：11 个时段开始时间与课时长度全自定义，AsyncStorage 持久化，重启恢复
- **外观设置**：课程格透明度、时间标记显隐、天气页底衬透明度（滑块实时预览）

### 课程管理

- **详情 / 编辑**：点击课程格查看详情，编辑课程名/教师/地点（副本编辑，保存才写回）
- **删除**：整门删除（同名同时间所有分段一起删）或"只删这一格"（跨周课程按周拆分为前后两段，适配老师临时放假）

### 天气（依赖自建后端，见 [weather-server](https://github.com/cryogenicbird/weather-server)）

- **定位**：Android 定位权限申请，成功后经纬度本地记忆（AsyncStorage），定位失败回退上次坐标
- **课程格天气预警**：按课程时间窗（±20 分钟）匹配逐小时预报，降水概率 >60% 显示"图标！"、30~60% 显示"图标？"（雷暴/雨/雪/冰区分图标）
- **天气页**：下滑进入。十天列表每行 = 日期 + 单日代表图标 + 全天温度极值（单日图标算法：早 8~晚 10 窗口、坏天气优先、无降水看云量）；上方单日 24 小时图标详情图可横向滑动，点击日期行切换查看天

## 技术栈

- React Native 0.74.3 + React 18.2.0 + TypeScript
- @react-native-async-storage/async-storage（持久化）
- @react-native-camera-roll/camera-roll（相册背景）
- @react-native-community/slider（透明度滑块；4.5.7 兼容旧架构）
- @react-native-community/geolocation（定位）
- Jest + react-test-renderer（冒烟测试，原生模块 mock）
- 后端：Java 21 / Spring Boot（独立仓库 [weather-server](https://github.com/cryogenicbird/weather-server)：Ed25519 私钥签名 JWT 调用和风天气 API、响应裁剪，已部署腾讯云轻量 + systemd 守护，App 直连公网）

## 运行

```bash
npm install
npm run android        # 需要连接设备或模拟器
```

天气接口默认指向公网后端（`src/screens/TimetableScreen.tsx` 顶部 `WEATHER_BASE` 常量）。本地联调后端时改为 `http://localhost:8080` 并执行 `adb reverse tcp:8080 tcp:8080`。

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
    │   └── TimetableScreen.tsx  # 主页面（状态中枢 + 课表渲染 + 天气页）
    ├── component/
    │   └── BaseModal.tsx        # 通用弹窗组件
    ├── utils/
    │   ├── parseTextTimetable.ts  # 课表文本解析（token 分类 + 格式校验）
    │   ├── loadFolderImages.ts    # 相册读取（游标分页）
    │   └── hasAndroidPermission.ts# 相册权限（Android 版本分支）
```

## 测试

```bash
npm test          # Jest 冒烟测试（__mocks__ 提供原生模块假实现）
npx tsc --noEmit  # TypeScript 类型检查
npx eslint .      # 代码风格检查
```
