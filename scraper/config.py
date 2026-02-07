# 抖音收藏夹海报墙爬虫配置

# Cookie配置（登录后从浏览器复制）
# 打开抖音网页版 -> F12 -> Application -> Cookies -> 复制全部Cookie
COOKIE = ""

# 输出目录
OUTPUT_DIR = "../data"
COVERS_DIR = "../data/covers"

# 采集配置
MAX_ITEMS = 2000  # 最大采集数量
DOWNLOAD_COVERS = True  # 是否下载封面

# 外部依赖路径
DOUYIN_CRAWLER_PATH = "../external/douyin"
