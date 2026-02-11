"""
抖音收藏海报墙 - 全自动化运行脚本
一键运行：扫码登录 → 自动采集 → 自动下载 → 自动打开浏览器
"""
import os
import sys
import json
import asyncio
import webbrowser
import subprocess
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import time
import re


# 项目路径
PROJECT_DIR = Path(__file__).parent.resolve()
DATA_DIR = PROJECT_DIR / "data"
COVERS_DIR = DATA_DIR / "covers"
METADATA_PATH = DATA_DIR / "metadata.json"

# 配置
MAX_ITEMS = 2000  # 最大采集数量
CONCURRENCY = 10  # 并发下载数
SERVER_PORT = 5000


def check_dependencies():
    """检查并安装依赖"""
    try:
        from playwright.async_api import async_playwright
        import aiohttp
        import aiofiles
        import pyperclip
        import pygetwindow as gw
        print("✅ 依赖检查通过")
        return True
    except ImportError as e:
        print(f"❌ 缺少依赖: {e}")
        print("🔧 正在安装依赖...")
        subprocess.run([sys.executable, "-m", "pip", "install", 
                       "playwright", "aiohttp", "aiofiles", "pyperclip", "pygetwindow", "-q"])
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"])
        return True


async def login_and_scrape_favorites():
    """
    使用 Playwright 登录并直接从页面抓取收藏夹数据
    """
    from playwright.async_api import async_playwright
    
    print("\n" + "="*50)
    print("📱 请使用抖音 APP 扫描二维码登录")
    print("="*50)
    print("\n⚠️  登录后请完成以下步骤：")
    print("   1. 处理所有弹窗（如'保存登录信息'、'身份验证'等）")
    print("   2. 确保能看到你的收藏夹页面")
    print("   3. 回到命令行按 Enter 键继续\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # 打开抖音收藏页面
        await page.goto("https://www.douyin.com/user/self?showTab=favorite_collection")
        
        # 等待用户手动确认登录
        print("⏳ 等待登录...")
        
        import threading
        user_confirmed = threading.Event()
        
        def wait_for_input():
            input("✅ 登录完成后，按 Enter 键继续...")
            user_confirmed.set()
        
        input_thread = threading.Thread(target=wait_for_input, daemon=True)
        input_thread.start()
        
        while not user_confirmed.is_set():
            await asyncio.sleep(0.5)
            if page.is_closed():
                print("❌ 浏览器已关闭")
                return []
        
        print("\n🔄 正在从页面抓取收藏夹数据...")
        print("   （请保持浏览器窗口打开，脚本会自动滚动加载更多）\n")
        
        # 等待页面完全加载
        await asyncio.sleep(3)
        
        all_videos = []
        last_count = 0
        no_new_count = 0
        scroll_count = 0
        
        while len(all_videos) < MAX_ITEMS:
            try:
                # 使用更宽泛的选择器从页面获取视频数据
                videos_data = await page.evaluate('''() => {
                    const videos = [];
                    const seen = new Set();
                    
                    // 策略1: 查找所有带有视频链接的 a 标签
                    document.querySelectorAll('a[href*="/video/"]').forEach(link => {
                        const videoId = link.href.match(/\\/video\\/([\\d]+)/)?.[1];
                        if (!videoId || seen.has(videoId)) return;
                        seen.add(videoId);
                        
                        // 在链接内或附近找封面图
                        const container = link.closest('li, div[class], article') || link;
                        const img = container.querySelector('img[src*="douyinpic"], img[src*="bytedance"], img[src*="tiktokcdn"]') 
                                 || container.querySelector('img')
                                 || link.querySelector('img');
                        
                        if (img && img.src && !img.src.includes('avatar')) {
                            videos.push({
                                id: videoId,
                                cover_url: img.src,
                                title: img.alt || container.textContent?.slice(0, 50) || '无标题',
                                video_url: link.href
                            });
                        }
                    });
                    
                    // 策略2: 如果策略1没找到，尝试找所有可能是封面的图片
                    if (videos.length === 0) {
                        document.querySelectorAll('img').forEach((img, idx) => {
                            // 只要是抖音CDN的图片且尺寸合理
                            if (img.src && 
                                (img.src.includes('douyinpic') || img.src.includes('bytedance') || img.src.includes('tiktokcdn')) &&
                                !img.src.includes('avatar') &&
                                img.width > 50 && img.height > 50) {
                                
                                const container = img.closest('a, li, div[class]');
                                const link = container?.querySelector('a[href*="/video/"]') || container?.closest('a[href*="/video/"]');
                                const videoId = link?.href?.match(/\\/video\\/([\\d]+)/)?.[1] || `img_${idx}`;
                                
                                if (!seen.has(videoId)) {
                                    seen.add(videoId);
                                    videos.push({
                                        id: videoId,
                                        cover_url: img.src,
                                        title: img.alt || '无标题',
                                        video_url: link?.href || ''
                                    });
                                }
                            }
                        });
                    }
                    
                    return videos;
                }''')
                
                if videos_data and len(videos_data) > 0:
                    # 去重添加
                    existing_ids = {v.get('id') for v in all_videos}
                    new_count = 0
                    for video in videos_data:
                        if video.get('id') and video.get('id') not in existing_ids:
                            all_videos.append(video)
                            existing_ids.add(video.get('id'))
                            new_count += 1
                    
                    if new_count > 0:
                        no_new_count = 0
                
                scroll_count += 1
                print(f"\r   📥 已获取 {len(all_videos)} 个视频 (滚动 {scroll_count} 次)...", end="", flush=True)
                
                # 检查是否有新数据
                if len(all_videos) == last_count:
                    no_new_count += 1
                    # 需要更多次无新数据才停止（给页面更多加载时间）
                    if no_new_count >= 15:
                        print()  # 换行
                        debug_info = await page.evaluate('''() => {
                            return {
                                allImages: document.querySelectorAll('img').length,
                                douyinImages: document.querySelectorAll('img[src*="douyinpic"], img[src*="bytedance"]').length,
                                videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
                                url: window.location.href,
                                scrollHeight: document.body.scrollHeight,
                                noMore: document.body.innerText.includes('没有更多') || document.body.innerText.includes('到底了')
                            };
                        }''')
                        print(f"   🔍 调试: {debug_info['videoLinks']} 个视频链接, 页面高度 {debug_info['scrollHeight']}px")
                        if debug_info.get('noMore'):
                            print("   📋 检测到'没有更多'提示，已加载所有收藏")
                        else:
                            print("   📋 连续15次无新数据，停止滚动")
                        break
                else:
                    no_new_count = 0
                    last_count = len(all_videos)
                
                # 使用鼠标滚轮模拟真实用户滚动（触发虚拟滚动加载）
                # 先将鼠标移到页面中央
                await page.mouse.move(500, 400)
                # 模拟多次滚轮滚动
                for _ in range(5):
                    await page.mouse.wheel(0, 800)  # 垂直滚动 800 像素
                    await asyncio.sleep(0.3)
                
                await asyncio.sleep(1.5)  # 给页面时间加载新内容
                
            except Exception as e:
                print(f"   ⚠️ 抓取出错: {e}")
                import traceback
                traceback.print_exc()
                break
        
        await browser.close()
        print(f"✅ 共获取 {len(all_videos)} 个收藏视频")
        return all_videos


def extract_cover_data(videos: list) -> list:
    """提取封面元数据"""
    covers = []
    
    for video in videos:
        try:
            # 获取封面URL
            cover_url = ""
            if video.get("video", {}).get("cover", {}).get("url_list"):
                cover_url = video["video"]["cover"]["url_list"][0]
            elif video.get("video", {}).get("origin_cover", {}).get("url_list"):
                cover_url = video["video"]["origin_cover"]["url_list"][0]
            
            if not cover_url:
                continue
            
            cover_info = {
                "id": video.get("aweme_id", ""),
                "title": video.get("desc", "无标题")[:100],  # 限制长度
                "author": video.get("author", {}).get("nickname", "未知"),
                "author_id": video.get("author", {}).get("sec_uid", ""),
                "cover_url": cover_url,
                "video_url": f"https://www.douyin.com/video/{video.get('aweme_id', '')}",
                "create_time": video.get("create_time", 0),
            }
            covers.append(cover_info)
            
        except Exception as e:
            continue
    
    return covers


async def download_covers(covers: list):
    """并发下载封面图片"""
    import aiohttp
    import aiofiles
    
    print(f"\n📷 开始下载 {len(covers)} 张封面...")
    
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    
    semaphore = asyncio.Semaphore(CONCURRENCY)
    downloaded = 0
    
    async def download_one(session, cover):
        nonlocal downloaded
        async with semaphore:
            url = cover.get("cover_url", "")
            if not url:
                return
            
            video_id = cover.get("id", "unknown")
            save_path = COVERS_DIR / f"{video_id}.jpg"
            
            if save_path.exists():
                cover["local_cover"] = f"data/covers/{video_id}.jpg"
                downloaded += 1
                return
            
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        content = await resp.read()
                        async with aiofiles.open(save_path, "wb") as f:
                            await f.write(content)
                        cover["local_cover"] = f"data/covers/{video_id}.jpg"
                        downloaded += 1
            except:
                pass
    
    connector = aiohttp.TCPConnector(limit=CONCURRENCY)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [download_one(session, cover) for cover in covers]
        await asyncio.gather(*tasks)
    
    print(f"✅ 下载完成: {downloaded}/{len(covers)}")
    return covers


def save_metadata(covers: list):
    """保存元数据"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(covers, f, ensure_ascii=False, indent=2)
    
    print(f"📁 元数据已保存: {METADATA_PATH}")


def start_server_and_open_browser():
    """启动服务器并打开浏览器"""
    os.chdir(PROJECT_DIR)
    
    class ProxyHandler(SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # 静默输出

        def do_GET(self):
            # API: 解析视频信息 /api/resolve_video?url=...
            if self.path.startswith('/api/resolve_video'):
                try:
                    from urllib.parse import urlparse, parse_qs, unquote
                    import urllib.request
                    import urllib.error
                    import re
                    import json
                    
                    query = parse_qs(urlparse(self.path).query)
                    share_url = query.get('url', [None])[0]
                    
                    if not share_url:
                        self.send_error(400, "Missing url parameter")
                        return

                    # 1. 获取HTML (模拟手机UA以获取简单结构)
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                    
                    req = urllib.request.Request(share_url, headers=headers)
                    html = ""
                    final_url = ""
                    
                    # 自动处理重定向
                    with urllib.request.urlopen(req) as response:
                        html = response.read().decode('utf-8', errors='ignore')
                        final_url = response.geturl()
                    
                    # 2. 提取信息
                    result = {
                        'id': '',
                        'title': '未命名视频',
                        'author': '未知作者',
                        'cover_url': '',
                        'video_url': final_url, # 网页链接
                        'real_video_url': ''    # MP4链接
                    }
                    
                    # 尝试从 URL 提取 ID
                    id_match = re.search(r'/video/(\d+)', final_url)
                    if id_match:
                        result['id'] = id_match.group(1)
                    else:
                        result['id'] = f"import_{int(time.time())}"
                        
                    # 提取标题 (title 标签通常包含)
                    title_match = re.search(r'<title>(.*?)</title>', html)
                    if title_match:
                        title_text = title_match.group(1)
                        # 去除后缀
                        result['title'] = re.sub(r' - 抖音.*', '', title_text).strip()
                        
                    # 提取真实视频地址 (JSON 或 src 属性)
                    # 策略1: 查找 RENDER_DATA
                    # 策略2: 正则查找 src
                    
                    # 查找包含 play_addr 或 src 的 URL，通常是 v26 或 aweme 域名
                    # 这里的正则需要宽泛一些
                    # 寻找 "src":"https:..." 结构
                    src_matches = re.findall(r'"src":"(https?://[^"]+?)"', html)
                    for src in src_matches:
                        src = src.replace(r'\u0026', '&')
                        if ('/video/' in src or 'aweme' in src) and '.mp3' not in src and 'avatar' not in src:
                             result['real_video_url'] = src
                             break
                    
                    # 如果没找到，尝试找 playAddr
                    if not result['real_video_url']:
                        play_addr_matches = re.findall(r'"playAddr":\[{"src":"(https?://[^"]+?)"', html)
                        for src in play_addr_matches:
                             src = src.replace(r'\u0026', '&')
                             result['real_video_url'] = src
                             break

                    # 提取封面
                    cover_matches = re.findall(r'"cover":"(https?://[^"]+?)"', html)
                    if cover_matches:
                        result['cover_url'] = cover_matches[0].replace(r'\u0026', '&')

                    # 3. 返回 JSON
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode('utf-8'))
                    
                except Exception as e:
                    self.send_error(500, str(e))
                return

            # 视频代理接口：/proxy_video?url=...
            if self.path.startswith('/proxy_video'):
                try:
                    from urllib.parse import urlparse, parse_qs
                    import urllib.request
                    
                    query = parse_qs(urlparse(self.path).query)
                    video_url = query.get('url', [None])[0]
                    
                    if not video_url:
                        self.send_error(400, "Missing url parameter")
                        return

                    # 转发请求，支持 Range 请求
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.douyin.com/',
                        'Accept': '*/*',
                        'Connection': 'keep-alive',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    }
                    
                    # 透传 Range header（HTML5 video 需要）
                    range_header = self.headers.get('Range')
                    if range_header:
                        headers['Range'] = range_header
                    
                    # print(f"DEBUG: Proxying video: {video_url[:100]}... Range: {range_header}")
                    
                    req = urllib.request.Request(video_url, headers=headers)
                    
                    try:
                        with urllib.request.urlopen(req, timeout=10) as response:
                            # 根据是否有 Range 返回不同状态码
                            if range_header and response.status == 206:
                                self.send_response(206)
                                content_range = response.headers.get('Content-Range')
                                if content_range:
                                    self.send_header('Content-Range', content_range)
                            else:
                                self.send_response(200)
                            
                            # 透传关键响应头
                            self.send_header('Content-Type', response.headers.get('Content-Type', 'video/mp4'))
                            content_length = response.headers.get('Content-Length')
                            if content_length:
                                self.send_header('Content-Length', content_length)
                            self.send_header('Accept-Ranges', 'bytes')
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.end_headers()
                            
                            # 流式传输
                            while True:
                                chunk = response.read(65536)  # 64KB chunks
                                if not chunk: break
                                try:
                                    self.wfile.write(chunk)
                                except (ConnectionResetError, BrokenPipeError):
                                    break
                    except urllib.error.URLError as e:
                        print(f"❌ Proxy URL Error: {e.reason} for {video_url[:100]}")
                        self.send_error(502, f"Target URL error: {e.reason}")
                    except Exception as e:
                        print(f"❌ Proxy request failed: {str(e)}")
                        self.send_error(500, str(e))
                                
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                return

            # 如果是本地文件请求，正常处理
            super().do_GET()
        
        def do_POST(self):
            # API: 保存数据到 metadata.json
            if self.path == '/api/save_data':
                try:
                    import json
                    content_length = int(self.headers.get('Content-Length', 0))
                    post_data = self.rfile.read(content_length)
                    data = json.loads(post_data.decode('utf-8'))
                    
                    # 写入 metadata.json
                    with open(METADATA_PATH, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                    print(f"💾 数据已自动保存到 {METADATA_PATH}")
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
                except Exception as e:
                    self.send_error(500, str(e))
                return
            
            self.send_error(404, "Not Found")
        
        def do_OPTIONS(self):
            # 处理 CORS 预检请求
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
    
    def run_server():
        # 允许地址重用，避免重启频繁时报错
        HTTPServer.allow_reuse_address = True
        server = HTTPServer(("", SERVER_PORT), ProxyHandler)
        server.serve_forever()
    
    # 后台启动服务器
    server_thread = Thread(target=run_server, daemon=True)
    server_thread.start()
    
    url = f"http://localhost:{SERVER_PORT}/frontend/index.html"
    print(f"\n🌐 服务器已启动: {url}")
    print("   按 Ctrl+C 退出\n")
    
    # 打开浏览器
    webbrowser.open(url)
    
    # 保持运行
    import time
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 再见!")


async def main():
    """主流程"""
    print("\n" + "="*50)
    print("🎬 抖音收藏海报墙 - 全自动采集")
    print("="*50)
    
    # 1. 检查依赖
    check_dependencies()
    
    # 2. 登录并抓取收藏夹数据
    videos = await login_and_scrape_favorites()
    if not videos:
        print("❌ 未获取到收藏数据")
        return
    
    # 3. 提取封面信息（页面抓取的数据已经是简化格式）
    # 如果数据已经有 cover_url，直接使用；否则尝试提取
    if videos and 'cover_url' in videos[0]:
        covers = videos  # 页面抓取的数据已经是正确格式
    else:
        covers = extract_cover_data(videos)
    print(f"📊 提取到 {len(covers)} 个有效封面")
    
    # 5. 下载封面
    covers = await download_covers(covers)
    
    # 6. 保存元数据
    save_metadata(covers)
    
    # 7. 启动服务器并打开浏览器
    print("\n" + "="*50)
    print("🎉 采集完成！正在打开海报墙...")
    print("="*50)
    
    start_server_and_open_browser()



def monitor_clipboard():
    """后台监控剪贴板，发现目标链接自动唤醒窗口"""
    import pyperclip
    import pygetwindow as gw
    
    print("📋 剪贴板监控已启动...")
    last_text = ""
    
    # 正则规则
    RULES = [
        r"^https?://s\.myhkw\.cn/api\.php\?.*$",  # Shadow Moon API
        r"^https?://.+\.(mp3|m4a|ogg|wav|aac)(\?.*)?$"  # Direct Audio
    ]
    
    while True:
        try:
            text = pyperclip.paste().strip()
            if text and text != last_text:
                last_text = text
                
                # Check match
                is_match = False
                for rule in RULES:
                    if re.match(rule, text, re.I):
                        is_match = True
                        break
                
                if is_match:
                    print(f"\n[Clipboard] Captured: {text[:50]}...")
                    # Find window
                    target_title = "抖音收藏海报墙"
                    windows = gw.getWindowsWithTitle(target_title)
                    
                    if windows:
                        win = windows[0]
                        if not win.isActive:
                            print(f"[Focus] Bringing '{target_title}' to front...")
                            try:
                                if win.isMinimized:
                                    win.restore()
                                win.activate()
                            except Exception as e:
                                print(f"[Focus Error] {e}")
                    else:
                        print(f"[Focus Warning] Window '{target_title}' not found")
                        
            time.sleep(1)
        except Exception as e:
            print(f"[Clipboard Error] {e}")
            time.sleep(2)


if __name__ == "__main__":
    # Start clipboard monitor in background if dependencies are met
    if check_dependencies():
        try:
            monitor_thread = Thread(target=monitor_clipboard, daemon=True)
            monitor_thread.start()
        except Exception as e:
            print(f"❌ 无法启动剪贴板监控: {e}")

    if len(sys.argv) > 1 and sys.argv[1] == "server":
        print("🚀 仅启动服务器模式")
        start_server_and_open_browser()
    else:
        asyncio.run(main())
