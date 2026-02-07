"""
抖音收藏夹采集脚本
Derived from: erma0/douyin CLI模式
"""
import sys
import os
import json
import asyncio
from pathlib import Path

# 获取脚本所在目录
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_DIR = SCRIPT_DIR.parent

# 添加外部依赖路径
sys.path.insert(0, str(PROJECT_DIR / "external/douyin"))

from config import COOKIE, MAX_ITEMS

# 使用绝对路径解析输出目录
OUTPUT_DIR = PROJECT_DIR / "data"


async def collect_favorites(cookie: str = None) -> list:
    """
    采集当前用户的收藏夹
    
    Args:
        cookie: 抖音Cookie，如果为空则从config读取
        
    Returns:
        视频数据列表
    """
    cookie = cookie or COOKIE
    if not cookie:
        print("❌ 请先在 config.py 中配置 COOKIE")
        print("   获取方法：登录抖音网页版 -> F12 -> Application -> Cookies")
        return []
    
    # 调用erma0/douyin的CLI接口
    # 注意：需要根据实际API调整
    try:
        from backend.api import DouyinAPI
        
        api = DouyinAPI(cookie=cookie)
        
        # 获取当前用户收藏
        print("🔄 正在获取收藏夹数据...")
        favorites = await api.get_user_favorites(max_count=MAX_ITEMS)
        
        # 保存原始数据
        output_path = Path(OUTPUT_DIR) / "raw_favorites.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(favorites, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 采集完成，共 {len(favorites)} 个视频")
        print(f"📁 原始数据已保存至: {output_path}")
        
        return favorites
        
    except ImportError as e:
        print(f"❌ 依赖导入失败: {e}")
        print("   请确保已正确克隆 erma0/douyin 到 external/douyin")
        return []
    except Exception as e:
        print(f"❌ 采集失败: {e}")
        return []


def extract_cover_data(videos: list) -> list:
    """
    从视频数据中提取封面信息
    
    Args:
        videos: 原始视频数据列表
        
    Returns:
        封面元数据列表
    """
    covers = []
    
    for video in videos:
        try:
            cover_info = {
                "id": video.get("aweme_id", ""),
                "title": video.get("desc", "无标题"),
                "author": video.get("author", {}).get("nickname", "未知"),
                "author_id": video.get("author", {}).get("sec_uid", ""),
                "cover_url": video.get("video", {}).get("cover", {}).get("url_list", [""])[0],
                "dynamic_cover": video.get("video", {}).get("dynamic_cover", {}).get("url_list", [""])[0],
                "video_url": f"https://www.douyin.com/video/{video.get('aweme_id', '')}",
                "create_time": video.get("create_time", 0),
            }
            
            if cover_info["cover_url"]:
                covers.append(cover_info)
                
        except Exception as e:
            print(f"⚠️ 解析视频数据失败: {e}")
            continue
    
    return covers


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="抖音收藏夹采集")
    parser.add_argument("--cookie", type=str, help="抖音Cookie")
    parser.add_argument("--test", action="store_true", help="测试模式")
    args = parser.parse_args()
    
    if args.test:
        print("🧪 测试模式：使用模拟数据")
        # 生成测试数据
        test_data = [
            {
                "aweme_id": f"test_{i}",
                "desc": f"测试视频标题 {i}",
                "author": {"nickname": f"作者{i}", "sec_uid": f"uid_{i}"},
                "video": {
                    "cover": {"url_list": [f"https://picsum.photos/seed/{i}/300/400"]},
                    "dynamic_cover": {"url_list": [""]}
                },
                "create_time": 1700000000 + i * 86400
            }
            for i in range(50)
        ]
        covers = extract_cover_data(test_data)
        
        output_path = Path(OUTPUT_DIR) / "metadata.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(covers, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 测试数据已生成: {output_path}")
    else:
        videos = asyncio.run(collect_favorites(args.cookie))
        if videos:
            covers = extract_cover_data(videos)
            
            output_path = Path(OUTPUT_DIR) / "metadata.json"
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(covers, f, ensure_ascii=False, indent=2)
            
            print(f"📁 元数据已保存至: {output_path}")
