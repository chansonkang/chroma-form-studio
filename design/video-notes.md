# 视频复刻核对记录

参考：https://www.youtube.com/watch?v=o6UY27rjfX4

## 已从视频画面读到的设置

- 03:58：Curve Circle Resolution 15、Radius 1 m；Ico Sphere Radius 0.27 m、Subdivisions 5；Normal 接 Align Rotation to Vector 的 Y 轴。
- 05:57：Instance Scale X 0.750、Y 1、Z 1.790；Rotate Instances 勾选 Local Space，围绕 X 旋转。
- 07:56：原层和约 +1.03、−1.04 的两个副本，共三层。使用正交相机。
- 09:55：Texture Coordinate 的 Object → Mapping → Wave Texture；当时 Wave 为 Bands / X / Sine，Scale 5（尚未调整完成）。Object 引用栏当时为空，后续设置尚待核实。
- 11:54：Wave Scale 0.110、Distortion 0、Phase Offset 80.600；Linear ColorRamp 的五个色标为蓝、灰、绿、橙、红。
- 15:52：合成器使用 Film Grain，Super 8mm、Factor 1、Animated 关闭。
- 17:51：1080 × 1920、200%、24 fps、1–120 帧；背景平面用 Linear Gradient → ColorRamp → Emission。

## 当前实现与尚待核对项

几何、实例局部轴和 Wave 正弦公式已重建。屏幕坐标使用 Three.js 的 Y 作为竖直轴，对应 Blender Z。

以下仍是可调的近似值，不能当成已经逐项验证的教程原值：

- 相机俯角 20°、初始花瓣角度 55°。
- 五个色标的具体 RGB 和位置。
- 最终 Object 坐标所引用对象、Mapping 旋转。当前用统一世界高度场，需继续对照后续视频节点。
- 120 帧对应 5 秒时间轴已设置，但每个周期转 360°仍待确认教程关键帧。
- 胶片颗粒采用 WebGL 稳定噪声，尚未复制教程的 Super 8mm 颗粒插件算法。
- 背景目前是可调纯色，教程背景是渐变平面。

Blender 官方 Wave 源码：https://raw.githubusercontent.com/blender/blender/main/intern/cycles/kernel/svm/wave.h
公式：factor = 0.5 + 0.5 * sin(coordinate * scale * 20 + phase - π/2)。

此记录刻意区分已读到的数字和推断项，不将“相近风格”作为“一样效果”的验收结论。
