# F1 最新资讯

一个纯静态的 F1 新闻聚合页面。抓取脚本把多家媒体的 RSS 合并成 `data/news.json`，页面读取这个 JSON 展示，支持按来源筛选和关键词搜索。

## 本地运行

需要 Node.js 18+（不依赖第三方包）。

```bash
npm run fetch    # 抓取所有源，生成 data/news.json
npm run serve    # 在 http://localhost:8000 打开页面
```

注意：页面通过 `fetch` 读取 JSON，必须经过 HTTP 服务访问，直接双击 `index.html` 无法加载数据。

## 添加或修改新闻源

编辑 `feeds.json`，每个源包含 `name` 和 `url`（RSS 或 Atom 均可）。单个源失败不影响其他源，页脚会显示各源的状态。

## 自动更新

`.github/workflows/update-news.yml` 每 30 分钟运行一次抓取并提交 `data/news.json`。仓库需要允许 Actions 写入（Settings → Actions → General → Workflow permissions 选择 Read and write）。

## 部署

任何静态托管都可以，例如 GitHub Pages：在仓库设置里把 Pages 的源指向当前分支根目录即可。
