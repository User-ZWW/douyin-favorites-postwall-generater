/**
 * 抖音收藏海报墙 - 增强版 (自适应布局 + 视频代理)
 * 功能：CRUD、帧选择、样式定制、数据持久化
 */

// ========================================
// 配置
// ========================================
const CONFIG = {
    metadataUrl: '/data/metadata.json',
    batchSize: 20,
    lazyLoadThreshold: 300,
};

// 默认样式设置
const DEFAULT_SETTINGS = {
    columns: 5,        // 使用列数而不是固定宽度
    gap: 16,
    radius: 12,
    showTitle: true,
    showAuthor: true,
    hero: {
        title: '2026看过影视',
        subtitle: 'DOUYIN WATCHED MEDIA LOG',
        avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='20' fill='%23667'/%3E%3Ccircle cx='50' cy='90' r='35' fill='%23667'/%3E%3C/svg%3E",
        background: ''
    }
};

// ========================================
// 状态管理
// ========================================
const state = {
    allCovers: [],
    currentCard: null,
    masonryInstance: null,
    isLoading: false,
    loadedCount: 0,
    batchSize: 20,
    settings: {
        columns: 5,        // 统一使用 columns
        showStats: true,
        showAuthor: true,
        darkMode: true,
        bgStyle: 'dark',
        hero: {
            title: '2026看过影视',
            subtitle: 'DOUYIN WATCHED MEDIA LOG',
            avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='20' fill='%23667'/%3E%3Ccircle cx='50' cy='90' r='35' fill='%23667'/%3E%3C/svg%3E",
            background: ''
        }
    }
};

// ========================================
// DOM 元素
// ========================================
const $ = id => document.getElementById(id);
const elements = {
    grid: $('poster-grid'),
    loading: $('loading'),
    backToTop: $('back-to-top'),
    lightbox: $('lightbox'),
    lightboxClose: $('lightbox-close'),
    lightboxImg: $('lightbox-img'),
    lightboxTitle: $('lightbox-title'),
    lightboxAuthor: $('lightbox-author'),
    lightboxLink: $('lightbox-link'),
    btnSettings: $('btn-settings'),
    btnAddVideo: $('btn-add-video'),
    btnEditMode: $('btn-edit-mode'),
    btnExport: $('btn-export'),
    btnImport: $('btn-import'),
    importFile: $('import-file'),
    settingsPanel: $('settings-panel'),
    settingsClose: $('settings-close'),
    totalCount: $('hero-count'),
    heroTitle: $('hero-title'),
    heroAvatar: $('hero-avatar'),
    frameSelectorModal: $('frame-selector-modal'),
    frameSelectorClose: $('frame-selector-close'),
    frameVideo: $('frame-video'),
    frameSlider: $('frame-slider'),
    frameTime: $('frame-time'),
    frameCanvas: $('frame-canvas'),
    framePreviewImg: $('frame-preview-img'),
    btnCaptureFrame: $('btn-capture-frame'),
    btnApplyFrame: $('btn-apply-frame'),
    btnChangeCover: $('btn-change-cover'),
    btnChangeBg: $('btn-change-bg'), // 新增
    btnDeleteCard: $('btn-delete-card'),
    btnResetSettings: $('btn-reset-settings'),
    heroSubtitle: $('hero-subtitle'),
    inputAvatar: $('input-hero-avatar'),
    inputBg: $('input-hero-bg'),
};

// ========================================
// 初始化
// ========================================
async function init() {
    loadSettings();
    applySettings();
    loadHeroSettings();

    // 初始化 grid-sizer 用于 Masonry 自适应
    if (!elements.grid.querySelector('.grid-sizer')) {
        const sizer = document.createElement('div');
        sizer.className = 'grid-sizer';
        sizer.style.width = '0px'; // 初始
        elements.grid.appendChild(sizer);
    }

    try {
        await loadMetadata();
        initMasonry();
        loadNextBatch();
    } catch (error) {
        console.error('初始化失败:', error);
        alert('加载数据失败，请检查 metadata.json 是否存在。\n你可以尝试点击右上角 "+" 添加视频。');
        // 即使失败也要移除 loading，否则无法交互
        if (elements.loading) elements.loading.classList.add('hidden');
    }

    // 无论数据是否加载成功，都必须绑定事件监听器
    setupEventListeners();
}

// ========================================
// 数据加载与保存
// ========================================
async function loadMetadata() {
    // 优先使用 localStorage 中的数据
    const localData = localStorage.getItem('posterwall_data');
    if (localData) {
        try {
            state.allCovers = JSON.parse(localData);
            state.hasLocalChanges = true;
            console.log('✅ 从本地存储加载了数据');
        } catch (e) {
            console.warn('本地数据解析失败，使用服务器数据');
        }
    }

    // 如果没有本地数据，从服务器加载
    if (!state.allCovers.length) {
        const response = await fetch(CONFIG.metadataUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        state.allCovers = await response.json();
    }

    elements.totalCount.textContent = state.allCovers.length;
}

function saveToLocalStorage() {
    localStorage.setItem('posterwall_data', JSON.stringify(state.allCovers));
    state.hasLocalChanges = true;
    console.log('💾 数据已保存到本地');
}

async function saveToServer() {
    try {
        const response = await fetch('/api/save_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(state.allCovers),
        });
        if (response.ok) {
            console.log('✅ 数据已自动保存到服务器');
        } else {
            console.error('❌ 保存到服务器失败:', response.status);
        }
    } catch (e) {
        console.error('❌ 保存到服务器出错:', e);
    }
}

// ========================================
// 设置管理 (自适应布局核心)
// ========================================
function loadSettings() {
    const saved = localStorage.getItem('posterwall_settings');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            // 迁移旧设置：如果有 cardWidth 但没有 columns，转换为默认列数
            if (loaded.cardWidth && !loaded.columns) {
                loaded.columns = 5;
                delete loaded.cardWidth;
            }
            // 确保 hero 结构存在
            if (!loaded.hero) {
                loaded.hero = { ...DEFAULT_SETTINGS.hero };
            }
            state.settings = { ...state.settings, ...loaded };
        } catch (e) {
            console.error('Settings parse error', e);
        }
    }

    // 设置默认值中的 hero 如果缺失
    if (!state.settings.hero) {
        state.settings.hero = {
            title: '2026看过影视',
            subtitle: 'DOUYIN WATCHED MEDIA LOG',
            avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='35' r='20' fill='%23667'/%3E%3Ccircle cx='50' cy='90' r='35' fill='%23667'/%3E%3C/svg%3E",
            background: ''
        };
    }

    // 同步 UI
    $('setting-columns').value = state.settings.columns;
    $('setting-gap').value = state.settings.gap;
    $('setting-radius').value = state.settings.radius;
    $('setting-show-title').checked = state.settings.showTitle;
    $('setting-show-author').checked = state.settings.showAuthor;
    updateSettingLabels();
}

function loadHeroSettings() {
    if (elements.heroTitle) {
        elements.heroTitle.innerText = state.settings.hero.title;
        elements.heroTitle.dataset.text = state.settings.hero.title;
    }
    if (elements.heroSubtitle) {
        elements.heroSubtitle.innerText = state.settings.hero.subtitle || 'DOUYIN WATCHED MEDIA LOG';
        elements.heroSubtitle.dataset.text = state.settings.hero.subtitle || 'DOUYIN WATCHED MEDIA LOG';
    }
    if (elements.heroAvatar && state.settings.hero.avatar) {
        elements.heroAvatar.src = state.settings.hero.avatar;
    }
    applyHeroBackground();
}

function saveSettings() {
    localStorage.setItem('posterwall_settings', JSON.stringify(state.settings));
}

function applySettings() {
    const root = document.documentElement;
    const gap = state.settings.gap;
    const cols = state.settings.columns;

    // 计算百分比宽度： (100% - totalGap) / cols
    // CSS calc 自动处理
    const widthCss = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;

    // 将列宽应用到 Masonry 布局元素
    // 注意：Masonry JS 需要数值来进行精确计算，或者使用 element sizing
    // 这里我们使用百分比宽度的 grid-item，并让 Masonry 使用 percentPosition

    // 设置 CSS 变量，供 .grid-item 使用
    // 我们直接修改 style 标签或者元素样式

    // 更新 .grid-item 的样式
    // 动态创建或更新 style 标签
    let styleTag = document.getElementById('dynamic-grid-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-grid-style';
        document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
        .grid-item, .grid-sizer {
            width: ${widthCss};
            margin-bottom: ${gap}px;
        }
        
        /* 最后一列不需要右边距吗？Masonry 处理 gap 的方式是 gutter 选项 */
        /* Masonry 的 gutter 选项会在列之间增加间距 */
    `;

    root.style.setProperty('--radius-md', `${state.settings.radius}px`);

    document.body.classList.toggle('hide-titles', !state.settings.showTitle);
    document.body.classList.toggle('hide-authors', !state.settings.showAuthor);

    // 触发 Masonry 重新布局
    if (state.masonryInstance) {
        // 更新参数
        state.masonryInstance.options.gutter = gap;
        state.masonryInstance.layout();
    }
}

function updateSettingLabels() {
    $('val-columns').textContent = state.settings.columns + '列';
    $('val-gap').textContent = state.settings.gap + 'px';
    $('val-radius').textContent = state.settings.radius + 'px';
}

// ========================================
// Masonry 初始化
// ========================================
function initMasonry() {
    // 销毁旧实例
    if (state.masonryInstance) {
        state.masonryInstance.destroy();
    }

    state.masonryInstance = new Masonry(elements.grid, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',  // 使用元素尺寸作为列宽
        gutter: state.settings.gap,
        percentPosition: true,       // 启用百分比布局
        transitionDuration: '0s',    // 禁用动画以提高调整性能
        initLayout: false,           // 手动触发布局
    });

    // 初始布局
    state.masonryInstance.layout();
}

// ========================================
// 分批加载
// ========================================
function loadNextBatch() {
    if (state.isLoading || state.loadedCount >= state.allCovers.length) {
        return;
    }

    state.isLoading = true;

    const startIndex = state.loadedCount;
    const endIndex = Math.min(startIndex + CONFIG.batchSize, state.allCovers.length);
    const batch = state.allCovers.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();

    batch.forEach((cover, idx) => {
        const item = createPosterCard(cover, startIndex + idx);
        fragment.appendChild(item);
    });

    elements.grid.appendChild(fragment);

    const newItems = elements.grid.querySelectorAll('.grid-item:not(.loaded)');

    imagesLoaded(newItems, () => {
        newItems.forEach(item => item.classList.add('loaded'));
        state.masonryInstance.appended(newItems);
        state.masonryInstance.layout();

        state.loadedCount = endIndex;
        state.isLoading = false;

        if (startIndex === 0) {
            elements.loading.classList.add('hidden');
        }

        // 自动检测：如果加载后页面高度不足以滚动，且还有数据，则继续加载
        if (document.body.scrollHeight <= window.innerHeight + 100 && state.loadedCount < state.allCovers.length) {
            loadNextBatch();
        }
    });
}

// ========================================
// 创建海报卡片
// ========================================
function createPosterCard(cover, index) {
    const item = document.createElement('div');
    item.className = 'grid-item';
    item.dataset.index = index;

    const coverSrc = cover.local_cover
        ? `/${cover.local_cover}`
        : (cover.cover_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="280" height="500"><rect fill="%231a1a25" width="100%" height="100%"/><text x="50%" y="50%" fill="%23666" text-anchor="middle">无封面</text></svg>');

    item.innerHTML = `
        <article class="poster-card" data-id="${cover.id}" data-url="${cover.video_url || ''}" data-index="${index}">
            <img 
                class="poster-image" 
                src="${coverSrc}" 
                alt="${escapeHtml(cover.title)}"
                loading="lazy"
            >
            <div class="play-icon">
                <svg viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21"></polygon>
                </svg>
            </div>
            <div class="poster-info">
                <h3 class="poster-title">${escapeHtml(cover.title)}</h3>
                <p class="poster-author">${escapeHtml(cover.author || '')}</p>
            </div>
            <div class="edit-overlay">
                <button class="btn btn-icon btn-edit" title="编辑">✏️</button>
                <button class="btn btn-icon btn-delete-quick" title="删除">🗑️</button>
            </div>
        </article>
    `;

    return item;
}

// ========================================
// 事件监听
// ========================================
function setupEventListeners() {
    // 窗口调整重新布局
    window.addEventListener('resize', throttle(() => {
        if (state.masonryInstance) state.masonryInstance.layout();
    }, 100));

    // 无限滚动
    window.addEventListener('scroll', throttle(() => {
        const scrollBottom = window.innerHeight + window.scrollY;
        const triggerPoint = document.body.offsetHeight - CONFIG.lazyLoadThreshold;

        if (scrollBottom >= triggerPoint) {
            loadNextBatch();
        }

        if (elements.backToTop) {
            if (window.scrollY > 500) {
                elements.backToTop.classList.add('visible');
            } else {
                elements.backToTop.classList.remove('visible');
            }
        }
    }, 100));

    // 回到顶部
    if (elements.backToTop) {
        elements.backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 点击海报卡片逻辑
    if (elements.grid) {
        elements.grid.addEventListener('click', (e) => {
            // 删除按钮
            const deleteBtn = e.target.closest('.btn-delete-quick');
            if (deleteBtn) {
                e.stopPropagation();
                const card = deleteBtn.closest('.poster-card');
                if (confirm('确定删除这张海报？')) {
                    deleteCard(parseInt(card.dataset.index));
                }
                return;
            }

            // 编辑按钮
            const editBtn = e.target.closest('.btn-edit');
            if (editBtn) {
                e.stopPropagation();
                const card = editBtn.closest('.poster-card');
                openLightbox(card);
                return;
            }

            // 打开灯箱
            const card = e.target.closest('.poster-card');
            if (card) {
                openLightbox(card);
            }
        });
    }

    // 灯箱 UI
    if (elements.lightboxClose) elements.lightboxClose.addEventListener('click', closeLightbox);
    if (elements.lightbox) {
        elements.lightbox.addEventListener('click', (e) => {
            if (e.target === elements.lightbox) {
                closeLightbox();
            }
        });
    }

    // 设置面板
    if (elements.btnSettings) elements.btnSettings.addEventListener('click', openSettings);
    if (elements.settingsClose) elements.settingsClose.addEventListener('click', closeSettings);

    // 列数调节
    const colInput = $('setting-columns');
    if (colInput) {
        colInput.addEventListener('input', (e) => {
            state.settings.columns = parseInt(e.target.value);
            updateSettingLabels();
            applySettings();
            saveSettings();
        });
    }

    ['setting-gap', 'setting-radius'].forEach(id => {
        const el = $(id);
        if (el) {
            el.addEventListener('input', (e) => {
                const key = id.replace('setting-', '');
                state.settings[key] = parseInt(e.target.value);
                updateSettingLabels();
                applySettings();
                saveSettings();
            });
        }
    });

    ['setting-show-title', 'setting-show-author'].forEach(id => {
        const el = $(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const key = id.replace('setting-', '').replace(/-(.)/g, (m, c) => c.toUpperCase());
                state.settings[key] = e.target.checked;
                applySettings();
                saveSettings();
            });
        }
    });

    if (elements.btnResetSettings) {
        elements.btnResetSettings.addEventListener('click', () => {
            state.settings = { ...DEFAULT_SETTINGS };
            loadSettings();
            applySettings();
            saveSettings();
        });
    }

    // 顶部工具栏
    if (elements.btnAddVideo) elements.btnAddVideo.addEventListener('click', addVideoByUrl);
    if (elements.btnEditMode) elements.btnEditMode.addEventListener('click', toggleEditMode);
    if (elements.btnExport) elements.btnExport.addEventListener('click', exportData);
    if (elements.btnImport) {
        elements.btnImport.addEventListener('click', () => {
            if (elements.importFile) elements.importFile.click();
        });
    }
    if (elements.importFile) elements.importFile.addEventListener('change', importData);

    // 灯箱内操作
    if (elements.btnDeleteCard) {
        elements.btnDeleteCard.addEventListener('click', () => {
            if (state.currentCard && confirm('确定删除这张海报？')) {
                deleteCard(state.currentCard.index);
                closeLightbox();
            }
        });
    }
    if (elements.btnChangeCover) elements.btnChangeCover.addEventListener('click', openFrameSelector);

    // 帧选择器
    if (elements.frameSelectorClose) elements.frameSelectorClose.addEventListener('click', closeFrameSelector);
    if (elements.frameVideo) elements.frameVideo.addEventListener('timeupdate', updateFrameSlider);
    if (elements.frameSlider) elements.frameSlider.addEventListener('input', seekVideo);

    if (elements.btnCaptureFrame) elements.btnCaptureFrame.addEventListener('click', captureFrame);
    if (elements.btnApplyFrame) elements.btnApplyFrame.addEventListener('click', applyFrameAsCover);

    // 全局快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
            closeFrameSelector();
            closeSettings();
        }
    });

    // 初始化 Hero 区域交互（头像更换、标题编辑）
    setupHeroInteractions();
}

// ========================================
// 视频解析 & 添加
// ========================================
async function addVideoByUrl() {
    const input = prompt('请粘贴抖音分享链接（可包含其他文字）：');
    if (!input) return;

    // 从分享文本中提取有效 URL
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) {
        alert('未找到有效链接，请重新粘贴包含 https://v.douyin.com/... 的分享文本');
        return;
    }
    const url = urlMatch[0].replace(/[。，！？、）】}]/g, ''); // 移除可能的中文标点

    // 显示 loading
    const originalText = elements.btnAddVideo.innerHTML;
    elements.btnAddVideo.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;border-width:2px;border-radius:50%;border:2px solid #ccc;border-top-color:#fff;animation:spin 1s linear infinite;"></div>';

    try {
        const res = await fetch(`/api/resolve_video?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('解析失败');
        const data = await res.json();

        if (!data.real_video_url && !data.id) {
            throw new Error('未找到视频信息');
        }

        // 构造新卡片数据
        const newCard = {
            id: data.id,
            title: data.title || '新添加视频',
            author: data.author || '未知',
            video_url: data.video_url,         // 网页链接
            real_video_url: data.real_video_url, // MP4链接
            cover_url: data.cover_url || '',
            local_cover: ''
        };

        // 添加到列表最前
        state.allCovers.unshift(newCard);
        saveToLocalStorage();

        // 刷新显示
        refreshGrid();
        elements.totalCount.textContent = state.allCovers.length;

        alert(`成功添加：${newCard.title}`);

    } catch (e) {
        alert('添加失败：' + e.message);
        console.error(e);
    } finally {
        elements.btnAddVideo.innerHTML = originalText;
    }
}

// ========================================
// 帧选择器 (Backend Proxy Integration)
// ========================================
async function openFrameSelector() {
    if (!state.currentCard) return;

    closeLightbox();

    let videoUrl = state.currentCard.real_video_url; // 优先用解析出的真实地址
    const shareUrl = state.currentCard.video_url || '';

    // 如果没有真实地址，尝试解析
    if (!videoUrl && shareUrl) {
        // 显示加载提示
        const btnText = elements.btnChangeCover.innerText;
        elements.btnChangeCover.innerText = '解析中...';

        try {
            const res = await fetch(`/api/resolve_video?url=${encodeURIComponent(shareUrl)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.real_video_url) {
                    videoUrl = data.real_video_url;
                    // 保存下来，下次不用再解析
                    state.currentCard.real_video_url = videoUrl;
                    state.allCovers[state.currentCard.index].real_video_url = videoUrl;
                    saveToLocalStorage();
                }
            }
        } catch (e) {
            console.error('自动解析失败', e);
        } finally {
            elements.btnChangeCover.innerText = btnText;
        }
    }

    if (!videoUrl) {
        // 仍然没有地址，尝试手动输入
        const hint = '无法自动解析视频地址，请输入真实 MP4 链接：';
        videoUrl = prompt(hint, shareUrl);
    }

    if (videoUrl) {
        // 使用后端代理播放该 URL
        const proxyUrl = `/proxy_video?url=${encodeURIComponent(videoUrl)}`;
        elements.frameVideo.src = proxyUrl;
        elements.frameSelectorModal.classList.add('active');
        elements.frameVideo.play().catch(e => console.error(e));
    } else {
        alert('无法获取可播放的视频地址');
    }
}

function closeFrameSelector() {
    elements.frameSelectorModal.classList.remove('active');
    elements.frameVideo.pause();
    elements.frameVideo.src = '';
}

function updateFrameSlider() {
    const video = elements.frameVideo;
    if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100;
        elements.frameSlider.value = percent;

        const mins = Math.floor(video.currentTime / 60);
        const secs = Math.floor(video.currentTime % 60).toString().padStart(2, '0');
        elements.frameTime.textContent = `${mins}:${secs}`;
    }
}

function seekVideo() {
    const video = elements.frameVideo;
    if (video.duration) {
        const percent = parseFloat(elements.frameSlider.value);
        video.currentTime = (percent / 100) * video.duration;
    }
}

function captureFrame() {
    const video = elements.frameVideo;
    const canvas = elements.frameCanvas;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    try {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        elements.framePreviewImg.src = dataUrl;
        elements.framePreviewImg.style.display = 'block';
    } catch (e) {
        alert('无法截取画面：可能是跨域限制或视频未加载\n请尝试使用本地文件');
        console.error(e);
    }
}

function applyFrameAsCover() {
    const dataUrl = elements.framePreviewImg.src;
    if (!dataUrl || dataUrl.length < 100) {
        alert('请先截取帧');
        return;
    }

    const index = state.currentCard.index;
    const cover = state.allCovers[index];

    cover.cover_url = dataUrl;
    cover.local_cover = ''; // 清除旧的本地封面引用

    saveToLocalStorage();

    // 刷新界面
    // 找到对应的 DOM 元素更新图片，避免全量刷新
    const card = document.querySelector(`.poster-card[data-index="${index}"]`);
    if (card) {
        const img = card.querySelector('.poster-image');
        img.src = dataUrl;
    }

    closeFrameSelector();
    alert('封面已更新');
}

// ... (其他通用函数保持不变)

// ... (UI Helper functions)
function openLightbox(card) {
    const index = parseInt(card.dataset.index);
    const cover = state.allCovers[index];
    state.currentCard = { ...cover, index };

    const img = card.querySelector('.poster-image');
    elements.lightboxImg.src = img.src;
    elements.lightboxTitle.textContent = cover.title || '无标题';
    elements.lightboxAuthor.textContent = state.settings.showAuthor ? `@${cover.author || '未知'}` : '';
    elements.lightboxLink.href = cover.video_url || '#';

    elements.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    elements.lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function openSettings() {
    elements.settingsPanel.classList.add('active');
}

function closeSettings() {
    elements.settingsPanel.classList.remove('active');
}

function toggleEditMode() {
    document.body.classList.toggle('edit-mode');
    const isEditing = document.body.classList.contains('edit-mode');

    // 切换 Header 可编辑状态
    if (elements.heroTitle) {
        elements.heroTitle.contentEditable = isEditing;
    }
    if (elements.heroSubtitle) {
        elements.heroSubtitle.contentEditable = isEditing;
    }

    if (elements.btnEditMode) {
        elements.btnEditMode.classList.toggle('active', isEditing);
    }

    // 如果退出编辑模式，保存所有修改
    if (!isEditing) {
        if (state.masonryInstance) state.masonryInstance.layout();
        // 保存 Header 修改
        if (elements.heroTitle) {
            const newTitle = elements.heroTitle.innerText;
            state.settings.hero.title = newTitle;
            elements.heroTitle.dataset.text = newTitle;
        }
        if (elements.heroSubtitle) {
            const newSubtitle = elements.heroSubtitle.innerText;
            state.settings.hero.subtitle = newSubtitle;
            elements.heroSubtitle.dataset.text = newSubtitle;
        }
        saveSettings();
        // 自动保存到服务器 JSON 文件
        saveToServer();
    }
}

// ========================================
// Hero 区域交互
// ========================================
function setupHeroInteractions() {
    // 标题输入监听 (实时实时同步故障特效)
    if (elements.heroTitle) {
        elements.heroTitle.addEventListener('input', () => {
            const newTitle = elements.heroTitle.innerText;
            elements.heroTitle.dataset.text = newTitle; // 实时同步故障特效属性
        });
        elements.heroTitle.addEventListener('blur', () => {
            state.settings.hero.title = elements.heroTitle.innerText;
            saveSettings();
        });
    }

    // 副标题/描述输入监听 (实时同步故障特效)
    if (elements.heroSubtitle) {
        elements.heroSubtitle.addEventListener('input', () => {
            const newSubtitle = elements.heroSubtitle.innerText;
            elements.heroSubtitle.dataset.text = newSubtitle; // 实时同步故障特效属性
        });
        elements.heroSubtitle.addEventListener('blur', () => {
            state.settings.hero.subtitle = elements.heroSubtitle.innerText;
            saveSettings();
        });
    }

    // 头像点击更换 -> 改为触发文件选择
    if (elements.heroAvatar) {
        const avatarBtn = elements.heroAvatar.closest('.hero-avatar-wrapper') || elements.heroAvatar;
        avatarBtn.addEventListener('click', (e) => {
            if (!document.body.classList.contains('edit-mode')) return;
            e.stopPropagation();
            if (elements.inputAvatar) elements.inputAvatar.click();
        });
    }

    // 头像文件选择处理
    if (elements.inputAvatar) {
        elements.inputAvatar.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64 = e.target.result;
                    state.settings.hero.avatar = base64;
                    if (elements.heroAvatar) elements.heroAvatar.src = base64;
                    saveSettings();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 背景更换按钮 -> 触发文件选择
    if (elements.btnChangeBg) {
        elements.btnChangeBg.addEventListener('click', (e) => {
            e.stopPropagation();
            if (elements.inputBg) elements.inputBg.click();
        });
    }

    // 背景文件选择处理
    if (elements.inputBg) {
        elements.inputBg.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64 = e.target.result;
                    state.settings.hero.background = base64;
                    applyHeroBackground();
                    saveSettings();
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function applyHeroBackground() {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return;

    if (state.settings.hero.background) {
        heroSection.style.backgroundImage = `url('${state.settings.hero.background}')`;
    } else {
        heroSection.style.backgroundImage = ''; // 恢复 CSS 默认渐变
    }
}

function deleteCard(index) {
    // 实际上 splice 会改变后续元素的 index，所以需要谨慎
    // 最好的方式是给每个 item 一个唯一 id，通过 id 查找删除
    // 但简单起见，我们只能全量刷新
    state.allCovers.splice(index, 1);
    saveToLocalStorage();
    refreshGrid();
    elements.totalCount.textContent = state.allCovers.length;
}

function refreshGrid() {
    elements.grid.innerHTML = '';
    // 重新添加 grid-sizer
    const sizer = document.createElement('div');
    sizer.className = 'grid-sizer';
    elements.grid.appendChild(sizer);

    // 重置状态
    state.loadedCount = 0;
    state.isLoading = false; // 强制重置 loading 状态

    if (state.masonryInstance) {
        state.masonryInstance.destroy();
    }

    initMasonry();
    loadNextBatch();
    applySettings(); // 重新应用样式
}

function exportData() {
    const dataStr = JSON.stringify(state.allCovers, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poster-wall-export.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (Array.isArray(data)) {
                state.allCovers = data;
                saveToLocalStorage();
                refreshGrid();
                elements.totalCount.textContent = state.allCovers.length;
                alert('导入成功');
            }
        } catch (err) {
            alert('导入失败');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function showError(message) {
    elements.loading.innerHTML = `<div style="text-align: center; padding: 20px;">${message}</div>`;
}

// 启动
document.addEventListener('DOMContentLoaded', init);
