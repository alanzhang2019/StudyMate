[OPEN] preview-3003-start

- Symptom: 运行 `launch-558a3c9-preview.ps1` 后终端没有可见输出，`http://localhost:3003/` 无法访问。
- Expected: 脚本切到 `558a3c9`，安装依赖，生成 Prisma client，启动 `next dev --webpack -p 3003`，最后输出 `READY:http://localhost:3003/`。
- Scope: `D:\AItrade\AI-MATH-MISTAKE\scripts\launch-558a3c9-preview.ps1` 与 `D:\AItrade\StudyMate-clean`。
- Status: collecting evidence

## Hypotheses

1. 脚本实际没有进入主体，仍被 PowerShell 执行策略或调用方式拦截。
2. 脚本进入后在 `git fetch` 或 `git checkout` 阶段失败，但当前没有把阶段性信息打印出来。
3. 脚本进入后在 `pnpm install` 或 `prisma generate` 阶段挂起或失败，且输出只被重定向到不存在的日志文件路径。
4. `next dev` 没有成功监听 `3003`，而脚本轮询阶段没有把监听状态和 HTTP 探测结果输出到终端。
5. `StudyMate-clean` 的仓库状态或环境与脚本假设不一致，导致脚本提前退出。

## Evidence Log

- Added stage-by-stage instrumentation to `scripts/launch-558a3c9-preview.ps1`.
- Script now writes terminal output and a persistent stage log to `D:\AItrade\StudyMate-clean\.trae-launch-3003.debug.log`.
- `StudyMate-clean` currently declares `pnpm@10.28.0`, `next@16.1.2`, and `prisma@6.19.3`.
- `D:\AItrade\StudyMate-clean\.git\HEAD` now points directly to `558a3c904c4947bda49c56478298b835b9a6c7ee`.
- `D:\AItrade\StudyMate-clean\.trae-install-3003.out.log` shows `pnpm install` completed successfully.
- `D:\AItrade\StudyMate-clean\.trae-prisma-3003.out.log` shows `prisma generate` completed successfully.
- `D:\AItrade\StudyMate-clean\.next-dev-3003.out.log` shows:
  - `http://localhost:3003` ready
  - `GET / 200`
  - `GET /auth/login 200`
  - `GET /AUTH/LOGIN 404`

## Interim Conclusion

- Hypothesis 1 rejected: script did enter the startup flow.
- Hypothesis 3 rejected: dependency install and Prisma generation completed.
- Hypothesis 4 refined: Next is listening on `3003`; the observed `404` is for uppercase path `/AUTH/LOGIN`, not for the server being down.
- New runtime evidence from `generation-preview`:
  - `POST /api/generate/tts` returns `500`
  - server logs show `provider=siliconflow-tts, voice=vivian`
  - server error is `OpenAI TTS API error: Bad Request`
- Working reference in `_pushrepo/app/api/generate/tts/route.ts` already normalizes SiliconFlow voices to `FunAudioLLM/CosyVoice2-0.5B:<voice>`.
- Applied the same minimal normalization in `app/api/generate/tts/route.ts` for the active `558a3c9` workspace.
- Additional runtime evidence:
  - recognize flow reaches `POST /api/mistake/session 201` and `GET /generation-preview 200`
  - user-facing page can still show "未找到生成会话"
  - `/api/auth/session` intermittently returns `500`, which correlates with client-side instability during the handoff
- Added a storage fallback so `generationSession` is saved to both `sessionStorage` and `localStorage`, and `generation-preview` can recover from `localStorage` if the tab session state is missing.

## Next Step

- Re-run the generation preview and compare post-fix `POST /api/generate/tts` results against the previous 500 logs.
