# GESP 8 级 · 练习卷 · 黄祺皓

> **适用学员**：黄祺皓（D 队，AC 27，初一）
> **用途**：9/13 GESP 8 级临阵 + 课后补强
> **现实目标**：**保 1 题过级 (≥60)**。3h 内不追求现场 AC 真题，重点是 4 个模板默写。
> **难度分布**：🟥 L1–L2 入门 · 🟨 L2–L3 普及 · 🟧 L3–L4 提高 · 🟪 L4–L5 冲刺

---

## 一、客观题 25 道（60 min · 闭卷）

> 单选 15 + 判断 5 + 多选 5 = 30 分。**每题 ≤ 2 min**，不确定先跳。
> **祺皓目标**：18+/30（保 18 分）。

| # | 考点 | 题面（精简） | 难度 |
|---|---|---|---|
| 1 | 堆 | `priority_queue<int>` 默认？ A. 小根 B. 大根 C. 双端 D. 报错 | 🟥 |
| 2 | 小根堆 | 改为小根堆的正确写法？ A. `priority_queue<int, vector<int>, less<int>>` B. `priority_queue<int, vector<int>, greater<int>>` C. `priority_queue<int, less<int>>` D. 改不了 | 🟨 |
| 3 | 并查集 | `find` 不路径压缩会？ A. WA B. TLE C. RE D. 没事 | 🟧 |
| 4 | union 按秩 | 不按秩合并只影响？ A. 正确性 B. 时间 C. 空间 D. 编译 | 🟧 |
| 5 | Dijkstra 前提 | 边权？ A. 正 B. 任意 C. 0/1 D. 1 | 🟨 |
| 6 | 优先队列 Dijkstra | `pair<int,int>` 默认？ A. 大根 B. 小根 C. 双端 D. 不支持 | 🟧 |
| 7 | Dijkstra 关键 | 弹出节点时 `if (d > dis[u]) continue;` 作用？ A. 跳过过期节点 B. 跳过未访问 C. 跳过起点 D. 防 TLE | 🟨 |
| 8 | Floyd 限制 | `O(n³)` 适用 n ≤ ? A. 100 B. 400 C. 1000 D. 5000 | 🟨 |
| 9 | 0/1 vs 完全 | 0/1 背包内层？ A. 正序 B. 倒序 C. 任意 D. 二分 | 🟥 |
| 10 | 完全背包 | 完全背包内层？ A. 正序 B. 倒序 C. 任意 D. 二分 | 🟨 |
| 11 | 区间 DP | `dp[l][r]` 表示？ A. 区间 [l,r] 最优解 B. 区间长度 C. 区间和 D. 区间端点 | 🟧 |
| 12 | 二叉树 | 已知前序+中序，能否唯一确定二叉树？ A. 能 B. 不能 C. 看情况 D. 只有满二叉树 | 🟥 |
| 13 | 后 + 中 | 已知后序+中序？ A. 能 B. 不能 C. 看情况 D. 满二叉树 | 🟨 |
| 14 | 前 + 后 | 已知前序+后序？ A. 能 B. 不能 C. 看情况 D. 满二叉树 | 🟨 |
| 15 | Trie | 26 字母 Trie 节点 `int next[26]` 表示？ A. 子节点指针 B. 子节点计数 C. 子节点深度 D. 子节点字符串 | 🟧 |
| 16–25 | 判断 5 + 多选 5 | （教练口述 12 考点变体） | 🟧🟪 |

> **答案教练现场给**（在 9/13 加课 9:00 开课时先口述 16-25 变体题，再统一对答案），先闭卷做完再对。
> 学员请勿提前要求看答案，避免被答案干扰思考过程。

---

## 二、模板题 4 道（60 min · 默写 + 实战）

> **核心目标**：4 个模板各手写 1 遍，能在考试中**默写**。
> 祺皓现实目标：4 道题 AC 2 道（堆 + 并查集），Dijkstra / 背包 2 道看着写。

### 2.1 堆（priority_queue）

- [P3378 堆](https://www.luogu.com.cn/problem/P3378) 🟨
- **目标**：默写 5 行模板
- **验收**：10 min 内 AC；闭眼口述 3 遍模板

```cpp
priority_queue<int, vector<int>, greater<int>> pq;  // 小根堆
pq.push(x);          // O(log n)
int t = pq.top(); pq.pop();  // O(log n)
int n = pq.size();
```

### 2.2 并查集（路径压缩）

- [P3367 并查集](https://www.luogu.com.cn/problem/P3367) 🟨
- **目标**：默写 `find` 路径压缩三元表达式
- **验收**：10 min 内 AC

```cpp
int fa[10005];
int find(int x) { return fa[x] == x ? x : fa[x] = find(fa[x]); }
void unite(int x, int y) {
    x = find(x); y = find(y);
    if (x != y) fa[x] = y;
}
```

### 2.3 Dijkstra 最短路

- [P4779 单源最短路](https://www.luogu.com.cn/problem/P4779) 🟨
- **目标**：邻接表 + 优先队列版本
- **验收**：20 min 内 AC（重点防漏 `if (d > dis[u]) continue;`）

```cpp
struct Edge { int to, w; };
vector<Edge> g[MAXN];
priority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> pq;
vector<int> dis(n+1, INT_MAX);
dis[s] = 0; pq.push({0, s});
while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dis[u]) continue;  // 关键：过期节点跳过
    for (auto& e : g[u])
        if (dis[e.to] > dis[u] + e.w) {
            dis[e.to] = dis[u] + e.w;
            pq.push({dis[e.to], e.to});
        }
}
```

### 2.4 0/1 背包

- [P1048 采药](https://www.luogu.com.cn/problem/P1048) 🟨
- **目标**：1 维 DP 内层**倒序**
- **验收**：15 min 内 AC

```cpp
vector<int> dp(V+1, 0);
for (int i = 1; i <= N; i++)
    for (int v = V; v >= w[i]; v--)
        dp[v] = max(dp[v], dp[v-w[i]] + v[i]);
cout << dp[V];
```

---

## 三、真题模拟 3 道（90 min · 限时）

### 3.1 GESP 2024-09 8 级 T1 · 公交线路（必做，30 min）

- [B4001 公交线路](https://www.luogu.com.cn/problem/B4001) 🟧
- **思路**：Dijkstra 模板题
- **祺皓目标**：**主拿分题** — 30 min 内 AC
- **复盘重点**：建图、初始化 `dis[] = INT_MAX`、`dis[s] = 0`、pq 起始 push

### 3.2 GESP 2024-12 8 级 T1 · 闯关（选做，20 min）

- [B4044 闯关](https://www.luogu.com.cn/problem/B4044) 🟧
- **思路**：状态压缩 DP / 简单 DP，`dp[s][v]` 表示已访问景点集合 s + 当前在 v 的最短路径
- **祺皓目标**：**看题 5 min 决定是否放弃**。D 队学员**不推荐死磕**
- **保底**：写一个暴力 dfs 拿部分分

### 3.3 GESP 2024-12 8 级 T3 · 进阶（放弃）

- **目标**：**不浪费时间**，直接放弃
- **时间分配**：剩下 40 min 用于回头检查 3.1 / 3.2 的边界

---

## 四、应试节奏（针对 D 队学员）

1. **客观题先做单选（15 题 30 min）**，不确定先跳，回头再涂卡
2. **编程题先读 3 题 5 min**，选最容易的 1 题先 AC（**目标：1 题保底 35+ 分**）
3. **第二题部分分**：把样例过了就交，不强求满分
4. **第三题放弃**：8 级 T3 难度大，**别死磕**，回头检查 T1 T2
5. **提交前必须测样例**：D 队学员最常见翻车 = 没测边界（n=1、空输入、k=0）

---

## 五、错题归档（课后）

> 做完每题后立刻在此节追加：

| 题号 | 错点 | 正确写法 | 教训 |
|---|---|---|---|
| （空） | | | |

---

## 附录 A：考前 1 页纸（4 模板）

### A.1 堆

```cpp
priority_queue<int, vector<int>, greater<int>> pq;  // 小根堆
pq.push(x); int t = pq.top(); pq.pop(); int n = pq.size();
```

### A.2 并查集

```cpp
int fa[10005];
int find(int x) { return fa[x] == x ? x : fa[x] = find(fa[x]); }
void unite(int x, int y) { x = find(x); y = find(y); if (x != y) fa[x] = y; }
```

### A.3 Dijkstra

```cpp
vector<Edge> g[MAXN];
priority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> pq;
vector<int> dis(n+1, INT_MAX);
dis[s] = 0; pq.push({0, s});
while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dis[u]) continue;
    for (auto& e : g[u])
        if (dis[e.to] > dis[u] + e.w) {
            dis[e.to] = dis[u] + e.w;
            pq.push({dis[e.to], e.to});
        }
}
```

### A.4 0/1 背包

```cpp
vector<int> dp(V+1, 0);
for (int i = 1; i <= N; i++)
    for (int v = V; v >= w[i]; v--)
        dp[v] = max(dp[v], dp[v-w[i]] + v[i]);
cout << dp[V];
```
