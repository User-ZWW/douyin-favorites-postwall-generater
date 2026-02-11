/**
 * Cyberpunk Music Player - Simplified Local Version
 * 专注本地播放，简化调试
 */

const PLAYLIST = [
    {
        name: "Cyberpunk City",
        artist: "MokkaMusic",
        url: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/win.ogg"
    },
    {
        name: "Ethereal",
        artist: "Pixabay",
        url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3"
    },
    {
        name: "Cyber City",
        artist: "Demo",
        url: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/menu.ogg"
    }
];

class MusicPlayer {
    constructor() {
        console.log('[Player] Constructor started');
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentIndex = 0;
        this.volume = localStorage.getItem('player_volume') || 0.5;
        this.isPanelOpen = false;

        // Playback Mode
        this.playMode = 'loop'; // sequence, loop, one, shuffle
        this.localPlaylist = [];
        this.lastClipboardUrl = ''; // For Shadow Moon auto-play

        this.initUI();
        this.bindEvents();
        this.loadTrack(this.currentIndex);

        // 恢复音量
        this.audio.volume = this.volume;
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.value = this.volume;
        }
        console.log('[Player] Constructor completed');
    }

    initUI() {
        console.log('[Player] Initializing UI');
        const container = document.createElement('div');
        container.className = 'music-player-container';
        container.innerHTML = `
            <div class="music-panel" id="musicPanel">
                <div class="track-info">
                    <div class="track-name" id="trackName">Loading...</div>
                    <div class="track-artist" id="trackArtist">Artist</div>
                </div>
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar" id="progressBar"></div>
                </div>
                <div class="controls">
                    <button class="btn-control" id="prevBtn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button class="btn-play" id="playBtn">
                        <svg id="playIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <svg id="pauseIcon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    </button>
                    <button class="btn-control" id="nextBtn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                    <button class="btn-control" id="modeBtn" title="Play Mode: Loop All">
                        <span id="modeIcon" style="font-size:14px;">🔁</span>
                    </button>
                    <button class="btn-control" id="shadowMoonBtn" title="Shadow Moon Search (Auto-Play)">
                        <span style="font-size:14px;">🌙</span>
                    </button>
                </div>
                <select class="playlist-selector" id="playlistSelect">
                    ${PLAYLIST.map((track, i) => `<option value="${i}">${track.name} - ${track.artist}</option>`).join('')}
                    <option value="custom">🌐 输入 URL...</option>
                    <option value="local">📂 选择多个文件...</option>
                </select>
                <input type="file" id="localFileInput" accept="audio/*" multiple style="display: none;">
                <div class="error-msg" id="playerError" style="color: #ff003c; font-size: 10px; margin-top: 5px; display: none;"></div>
                <div class="volume-control">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.01">
                </div>
            </div>
            <div class="music-toggle" id="musicToggle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
            </div>
        `;
        document.body.appendChild(container);

        this.elements = {
            panel: container.querySelector('#musicPanel'),
            toggle: container.querySelector('#musicToggle'),
            playBtn: container.querySelector('#playBtn'),
            prevBtn: container.querySelector('#prevBtn'),
            nextBtn: container.querySelector('#nextBtn'),
            modeBtn: container.querySelector('#modeBtn'),
            shadowMoonBtn: container.querySelector('#shadowMoonBtn'),
            modeIcon: container.querySelector('#modeIcon'),
            trackName: container.querySelector('#trackName'),
            trackArtist: container.querySelector('#trackArtist'),
            progressBar: container.querySelector('#progressBar'),
            progressContainer: container.querySelector('#progressContainer'),
            playIcon: container.querySelector('#playIcon'),
            pauseIcon: container.querySelector('#pauseIcon'),
            playlistSelect: container.querySelector('#playlistSelect'),
            localFileInput: container.querySelector('#localFileInput'),
            playerError: container.querySelector('#playerError'),
            volumeSlider: container.querySelector('#volumeSlider')
        };
        console.log('[Player] UI initialized, elements:', this.elements);
    }

    bindEvents() {
        console.log('[Player] Binding events');
        const { toggle, panel, playBtn, prevBtn, nextBtn, modeBtn, progressContainer, playlistSelect, volumeSlider, localFileInput } = this.elements;

        // 切换面板
        toggle.addEventListener('click', () => {
            this.isPanelOpen = !this.isPanelOpen;
            panel.classList.toggle('active', this.isPanelOpen);
        });

        // 播放控制
        playBtn.addEventListener('click', () => this.togglePlay());
        prevBtn.addEventListener('click', () => this.prevTrack());
        nextBtn.addEventListener('click', () => this.nextTrack());
        modeBtn.addEventListener('click', () => this.toggleMode());

        // Shadow Moon Button
        if (this.elements.shadowMoonBtn) {
            this.elements.shadowMoonBtn.addEventListener('click', () => {
                window.open('https://s.myhkw.cn/', '_blank');
            });
        }

        // Window Focus - Auto Play from Clipboard
        window.addEventListener('focus', async () => {
            try {
                // Check if player handles clipboard
                if (!navigator.clipboard) return;

                const text = await navigator.clipboard.readText();
                if (!text) return;

                // Simple check for audio URL
                // Valid extensions: mp3, m4a, ogg, wav, aac OR Shadow Moon API
                const isMediaFile = /^https?:\/\/.+\.(mp3|m4a|ogg|wav|aac)(\?.*)?$/i;
                const isShadowMoonApi = /^https?:\/\/s\.myhkw\.cn\/api\.php\?.*$/i;

                const isAudioUrl = text.match(isMediaFile) || text.match(isShadowMoonApi);

                if (isAudioUrl && text !== this.lastClipboardUrl) {
                    console.log('[Player] Detected audio URL from clipboard:', text);
                    this.lastClipboardUrl = text;
                    this.playRemoteUrl(text);
                }
            } catch (err) {
                // Clipboard read failed (permission denied or not focused)
            }
        });

        // 音频事件
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.onTrackEnded());
        this.audio.addEventListener('play', () => this.updatePlayState(true));
        this.audio.addEventListener('pause', () => this.updatePlayState(false));

        // 进度条点击
        progressContainer.addEventListener('click', (e) => {
            const width = progressContainer.clientWidth;
            const clickX = e.offsetX;
            const duration = this.audio.duration;
            if (duration) {
                this.audio.currentTime = (clickX / width) * duration;
            }
        });

        // 播放列表
        playlistSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            console.log('[Player] Playlist changed to:', value);
            this.elements.playerError.style.display = 'none';

            if (value === 'custom') {
                const url = prompt('请输入音乐 URL (MP3/OGG/WAV):');
                if (url) {
                    this.playRemoteUrl(url);
                } else {
                    this.elements.playlistSelect.value = this.currentIndex; // Revert
                }
            } else if (value === 'local') {
                console.log('[Player] User entered URL:', url);
                if (url && url.trim()) {
                    this.loadCustomTrack(url.trim());
                }
                // Reset to current playing
                setTimeout(() => {
                    e.target.value = this.currentIndex;
                }, 100);
            } else if (value === 'local') {
                console.log('[Player] Opening file picker');
                try {
                    localFileInput.click();
                    console.log('[Player] File input clicked');
                } catch (err) {
                    console.error('[Player] Error clicking file input:', err);
                }
                // Don't reset immediately, wait for file selection
            } else {
                this.currentIndex = parseInt(value);
                this.loadTrack(this.currentIndex);
                this.play();
            }
        });

        // 本地文件选择
        localFileInput.addEventListener('change', (e) => {
            console.log('[Player] File input changed, files:', e.target.files);
            this.handleLocalFiles(e.target.files);
            // Reset file input
            e.target.value = '';
        });

        // 音量
        volumeSlider.addEventListener('input', (e) => {
            this.volume = e.target.value;
            this.audio.volume = this.volume;
            localStorage.setItem('player_volume', this.volume);
        });

        console.log('[Player] Events bound');
    }

    handleLocalFiles(files) {
        console.log('[Player] handleLocalFiles called with', files ? files.length : 0, 'files');
        if (!files || files.length === 0) {
            this.elements.playlistSelect.value = this.currentIndex;
            return;
        }

        const audioFiles = Array.from(files).filter(f =>
            f.type.startsWith('audio/') ||
            f.name.match(/\.(mp3|ogg|wav|m4a|aac|flac)$/i)
        );

        console.log('[Player] Filtered to', audioFiles.length, 'audio files');

        if (audioFiles.length === 0) {
            alert('未找到音频文件');
            this.elements.playlistSelect.value = this.currentIndex;
            return;
        }

        // Clear and rebuild playlist
        PLAYLIST.length = 0;
        this.localPlaylist = audioFiles;

        audioFiles.forEach((file) => {
            PLAYLIST.push({
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: 'Local File',
                url: URL.createObjectURL(file),
                isLocal: true
            });
        });

        this.refreshPlaylistUI();
        this.currentIndex = 0;
        this.loadTrack(0);
        this.play();

        alert(`已加载 ${audioFiles.length} 首本地歌曲`);
    }

    refreshPlaylistUI() {
        console.log('[Player] Refreshing playlist UI');
        const select = this.elements.playlistSelect;

        // Clear all options
        select.innerHTML = '';

        // Add track options
        PLAYLIST.forEach((track, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${track.name} - ${track.artist}`;
            select.appendChild(option);
        });

        // Add action options
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '🌐 输入 URL...';
        select.appendChild(customOption);

        const localOption = document.createElement('option');
        localOption.value = 'local';
        localOption.textContent = '📂 选择多个文件...';
        select.appendChild(localOption);

        select.value = this.currentIndex;
    }

    toggleMode() {
        const modes = ['loop', 'one', 'shuffle', 'sequence'];
        const icons = { 'loop': '🔁', 'one': '🔂', 'shuffle': '🔀', 'sequence': '➡️' };

        const currentIdx = modes.indexOf(this.playMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        this.playMode = modes[nextIdx];

        this.elements.modeIcon.textContent = icons[this.playMode];
        this.elements.modeBtn.title = `Play Mode: ${this.playMode.charAt(0).toUpperCase() + this.playMode.slice(1)}`;
    }

    getNextIndex() {
        if (this.playMode === 'one') return this.currentIndex;
        if (this.playMode === 'shuffle') return Math.floor(Math.random() * PLAYLIST.length);

        let next = this.currentIndex + 1;
        if (next >= PLAYLIST.length) {
            if (this.playMode === 'loop') next = 0;
            else return -1;
        }
        return next;
    }

    getPrevIndex() {
        if (this.playMode === 'shuffle') return Math.floor(Math.random() * PLAYLIST.length);

        let prev = this.currentIndex - 1;
        if (prev < 0) {
            if (this.playMode === 'loop') prev = PLAYLIST.length - 1;
            else return -1;
        }
        return prev;
    }

    onTrackEnded() {
        if (this.playMode === 'one') {
            this.audio.currentTime = 0;
            this.play();
            return;
        }

        const next = this.getNextIndex();
        if (next !== -1) {
            this.currentIndex = next;
            this.loadTrack(this.currentIndex);
            this.play();
        } else {
            this.isPlaying = false;
            this.updatePlayState(false);
        }
    }

    loadTrack(index) {
        if (index < 0 || index >= PLAYLIST.length) return;
        const track = PLAYLIST[index];
        this.elements.trackName.textContent = track.name;
        this.elements.trackArtist.textContent = track.artist;
        this.audio.src = track.url;
        this.elements.playlistSelect.value = index;
        this.currentIndex = index;
    }

    loadCustomTrack(url) {
        this.elements.trackName.textContent = "Custom Track";
        this.elements.trackArtist.textContent = "URL";
        this.audio.src = url;
        this.play();
    }

    togglePlay() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        this.audio.play().catch(e => console.log("[Player] Auto-play blocked:", e));
    }

    pause() {
        this.audio.pause();
    }

    nextTrack() {
        const next = this.getNextIndex();
        if (next !== -1) {
            this.currentIndex = next;
            this.loadTrack(this.currentIndex);
            this.play();
        }
    }

    prevTrack() {
        const prev = this.getPrevIndex();
        if (prev !== -1) {
            this.currentIndex = prev;
            this.loadTrack(this.currentIndex);
            this.play();
        }
    }

    updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        const { playIcon, pauseIcon, toggle } = this.elements;

        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            toggle.classList.add('playing');
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            toggle.classList.remove('playing');
        }
    }

    updateProgress() {
        const { duration, currentTime } = this.audio;
        if (duration) {
            const percent = (currentTime / duration) * 100;
            this.elements.progressBar.style.width = `${percent}%`;
        }
    }

    playRemoteUrl(url) {
        if (!url) return;

        // Update UI for custom track
        if (this.elements.trackName) this.elements.trackName.textContent = "Shadow Moon Direct";
        if (this.elements.trackArtist) this.elements.trackArtist.textContent = "Clipboard / URL";

        // Select custom option if exists
        const customOption = this.elements.playlistSelect.querySelector('option[value="custom"]');
        if (customOption) customOption.selected = true;

        this.currentTrack = {
            name: "Shadow Moon Direct",
            artist: "Clipboard",
            url: url
        };

        this.audio.src = url;
        this.audio.play()
            .then(() => {
                this.updatePlayState(true);
            })
            .catch(e => {
                console.error("[Player] Auto-play failed:", e);
                // Try to show error if element exists
                if (this.elements.playerError) {
                    this.elements.playerError.textContent = "播放失败: " + e.message;
                    this.elements.playerError.style.display = 'block';
                }
            });
    }
}

// 初始化
console.log('[Player] Script loaded, waiting for DOM');
window.addEventListener('DOMContentLoaded', () => {
    console.log('[Player] DOMContentLoaded fired');
    setTimeout(() => {
        console.log('[Player] Initializing MusicPlayer...');
        try {
            const player = new MusicPlayer();
            window.musicPlayer = player; // For debugging
            console.log('[Player] MusicPlayer initialized successfully');
        } catch (e) {
            console.error('[Player] Failed to initialize:', e);
        }
    }, 1000);
});
