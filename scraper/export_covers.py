"""
封面图片批量下载脚本
"""
import os
import json
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from urllib.parse import urlparse

from config import COVERS_DIR, OUTPUT_DIR


async def download_cover(session: aiohttp.ClientSession, url: str, save_path: Path) -> bool:
    """
    下载单张封面图片
    
    Args:
        session: aiohttp会话
        url: 图片URL
        save_path: 保存路径
        
    Returns:
        是否成功
    """
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 200:
                content = await resp.read()
                async with aiofiles.open(save_path, "wb") as f:
                    await f.write(content)
                return True
            else:
                print(f"⚠️ 下载失败 [{resp.status}]: {url}")
                return False
    except Exception as e:
        print(f"❌ 下载异常: {e}")
        return False


async def batch_download_covers(metadata_path: str = None, concurrency: int = 10):
    """
    批量下载封面图片
    
    Args:
        metadata_path: 元数据JSON路径
        concurrency: 并发下载数
    """
    metadata_path = metadata_path or str(Path(OUTPUT_DIR) / "metadata.json")
    
    if not os.path.exists(metadata_path):
        print(f"❌ 元数据文件不存在: {metadata_path}")
        print("   请先运行 collect.py 采集数据")
        return
    
    with open(metadata_path, "r", encoding="utf-8") as f:
        covers = json.load(f)
    
    print(f"📷 准备下载 {len(covers)} 张封面...")
    
    covers_dir = Path(COVERS_DIR)
    covers_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建信号量控制并发
    semaphore = asyncio.Semaphore(concurrency)
    
    async def download_with_semaphore(session, cover):
        async with semaphore:
            url = cover.get("cover_url", "")
            if not url:
                return None
            
            # 生成文件名
            video_id = cover.get("id", "unknown")
            ext = urlparse(url).path.split(".")[-1] or "jpg"
            if len(ext) > 5:  # 防止URL没有扩展名
                ext = "jpg"
            save_path = covers_dir / f"{video_id}.{ext}"
            
            # 跳过已存在的文件
            if save_path.exists():
                return cover
            
            success = await download_cover(session, url, save_path)
            if success:
                cover["local_cover"] = str(save_path.relative_to(Path(OUTPUT_DIR).parent))
                return cover
            return None
    
    # 并发下载
    connector = aiohttp.TCPConnector(limit=concurrency)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [download_with_semaphore(session, cover) for cover in covers]
        results = await asyncio.gather(*tasks)
    
    # 更新元数据（添加本地路径）
    updated_covers = [r for r in results if r is not None]
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(updated_covers, f, ensure_ascii=False, indent=2)
    
    success_count = len([r for r in results if r is not None])
    print(f"✅ 下载完成: {success_count}/{len(covers)}")
    print(f"📁 封面保存于: {covers_dir}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="批量下载封面")
    parser.add_argument("--input", type=str, help="元数据JSON路径")
    parser.add_argument("--concurrency", type=int, default=10, help="并发数")
    args = parser.parse_args()
    
    asyncio.run(batch_download_covers(args.input, args.concurrency))
