# 🎬 抖音收藏海报墙 (Douyin Poster Wall)

一个高度可定制的、仿电影海报排版的抖音收藏夹展示墙。

![Cyberpunk Style Hero](https://img.shields.io/badge/Style-Cyberpunk-ff003c?style=for-the-badge)
![Python](https://img.shields.io/badge/Backend-Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![JavaScript](https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## ✨ 功能特性

### 核心功能
- 🔐 **扫码登录**：通过 Playwright 自动化浏览器，扫码登录抖音
- 📥 **自动采集**：自动滚动抓取收藏夹中的视频封面和元数据
- 🖼️ **瀑布流展示**：使用 Masonry.js 实现响应式瀑布流布局
- 🎨 **赛博朋克风格**：Glitch 故障特效、霓虹发光边框、Orbitron 字体

### 个性化定制
- 🖼️ **自定义背景**：支持上传本地图片作为 Hero 区域背景
- 👤 **自定义头像**：点击头像即可更换
- ✏️ **可编辑标题**：中英文标题均可实时编辑，Glitch 特效同步更新
- 🎚️ **样式调节**：列数、间距、圆角等参数可自由调整

### 封面管理
- 🎬 **帧选择器**：从视频中截取任意帧作为封面
- 🔄 **拖拽排序**：编辑模式下可拖拽调整海报顺序
- 🗑️ **删除功能**：支持单个删除海报卡片
- 💾 **自动保存**：退出编辑模式时自动保存到服务器 JSON 文件

### 数据管理
- 📤 **导出/导入**：支持 JSON 格式的数据备份和恢复
- 💿 **本地持久化**：设置和数据自动保存到 LocalStorage
- 🔄 **服务器同步**：修改自动同步到 `data/metadata.json`

---

## 🚀 快速开始

### 环境要求
- **Python 3.8+**
- **现代浏览器**（Chrome / Edge / Firefox）

### 安装依赖
```bash
cd douyin-poster-wall
pip install -r requirements.txt
```

> 首次运行时会自动安装 Playwright 的 Chromium 浏览器引擎。如需手动安装：
> ```bash
> playwright install chromium
> ```

### 采集数据
```bash
python run.py
```

按照提示：
1. 使用抖音 APP 扫描二维码登录
2. 处理所有弹窗后按 **Enter** 键继续
3. 程序自动滚动采集收藏夹数据
4. 采集完成后自动打开海报墙页面

### 仅启动服务器（已有数据）
```bash
python -c "from run import start_server_and_open_browser; start_server_and_open_browser()"
```

访问地址：`http://localhost:5000/frontend/index.html`

---

## 📁 项目结构

```
douyin-poster-wall/
├── run.py                 # 主脚本：采集 + 服务器
├── requirements.txt       # Python 依赖
├── data/
│   ├── metadata.json      # 视频元数据
│   └── covers/            # 下载的封面图片
├── frontend/
│   ├── index.html         # 主页面
│   ├── css/
│   │   ├── style.css      # 基础样式
│   │   └── hero.css       # Hero 区域 Cyberpunk 风格
│   └── js/
│       └── app.js         # 前端逻辑
└── external/              # 外部依赖（如有）
```

---

## 🎯 使用场景

| 场景 | 说明 |
|------|------|
| **个人收藏展示** | 将抖音收藏夹可视化，方便回顾和分享 |
| **影视观看记录** | 记录年度观看的影视作品，生成"年度报告"风格的海报墙 |
| **内容创作素材** | 快速浏览收藏的视频封面，寻找创作灵感 |
| **学习项目** | 学习 Playwright 自动化、瀑布流布局、CSS 动画等技术 |

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Vanilla JS + CSS + HTML |
| **布局** | Masonry.js (瀑布流) |
| **交互** | SortableJS (拖拽排序) |
| **后端** | Python (内置 HTTPServer) |
| **自动化** | Playwright (浏览器控制) |
| **异步下载** | aiohttp + aiofiles |
| **字体** | Google Fonts (Orbitron, Rajdhani, Noto Sans SC) |

---

## 📈 开发进度

### Phase 8 (当前)
- [x] 背景图更换功能修复
- [x] 帧选择器视频加载修复
- [x] Glitch 特效实时同步
- [x] Hero 区域持久化修复
- [x] 退出编辑模式自动保存到服务器

### 已完成功能
- [x] 扫码登录 + 自动采集
- [x] 视频代理（支持 Range 请求）
- [x] 瀑布流 + 灯箱预览
- [x] 编辑模式 + 样式设置面板
- [x] 本地数据持久化
- [x] JSON 导入/导出

### 计划中
- [ ] 批量导入：支持一次性粘贴多个抖音分享链接
- [ ] 多平台适配：扩展 B站 和 YouTube 解析
- [ ] 图片压缩：优化 Base64 存储避免 LocalStorage 溢出

---

## ⚠️ 注意事项

1. **登录安全**：扫码登录后 Cookie 仅在内存中使用，不会被保存
2. **防盗链**：封面图片通过后端代理加载，避免防盗链问题
3. **视频代理**：帧选择器使用后端代理播放视频，支持进度条拖动
4. **数据备份**：建议定期使用导出功能备份 `metadata.json`

---

## 📝 License

MIT License - 仅供学习交流使用
