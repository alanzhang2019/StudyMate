import fs from 'fs';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('config');

const CONFIG_FILE_PATH = path.join(process.cwd(), 'config', 'app-config.json');

// OpenAI 实例配置
export interface OpenAIInstance {
    id: string;           // 唯一标识 (UUID)
    name: string;         // 用户自定义名称
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface AppConfig {
    aiProvider: 'gemini' | 'openai' | 'azure';
    allowRegistration?: boolean;
    openai?: {
        instances?: OpenAIInstance[];
        activeInstanceId?: string;
    };
    gemini?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    };
    azure?: {
        apiKey?: string;
        endpoint?: string;       // Azure 资源端点 (https://xxx.openai.azure.com)
        deploymentName?: string; // 部署名称
        apiVersion?: string;     // API 版本
        model?: string;          // 显示用模型名
    };
    prompts?: {
        analyze?: string;
        similar?: string;
    };
    timeouts?: {
        analyze?: number; // 毫秒
    };
}

// 旧版 OpenAI 配置格式（用于迁移检测）
interface LegacyOpenAIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

// 检测是否为旧版配置格式
function isLegacyOpenAIConfig(config: unknown): config is LegacyOpenAIConfig {
    if (!config || typeof config !== 'object') return false;
    // 旧版配置包含 apiKey 直接字段，而新版包含 instances 数组
    return 'apiKey' in config && !('instances' in config);
}

// 生成唯一 ID
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 迁移旧版 OpenAI 配置到新版多实例格式
function migrateOpenAIConfig(legacy: LegacyOpenAIConfig): AppConfig['openai'] {
    if (!legacy.apiKey) {
        // 没有有效配置，返回空实例数组
        return { instances: [], activeInstanceId: undefined };
    }

    const defaultInstance: OpenAIInstance = {
        id: generateId(),
        name: 'Default',
        apiKey: legacy.apiKey,
        baseUrl: legacy.baseUrl || 'https://api.openai.com/v1',
        model: legacy.model || 'gpt-4o',
    };

    return {
        instances: [defaultInstance],
        activeInstanceId: defaultInstance.id,
    };
}

const DEFAULT_CONFIG: AppConfig = {
    aiProvider: (process.env.AI_PROVIDER as 'gemini' | 'openai' | 'azure') || 'gemini',
    allowRegistration: true,
    openai: {
        instances: process.env.OPENAI_API_KEY ? [{
            id: 'env-default',
            name: 'Default (ENV)',
            apiKey: process.env.OPENAI_API_KEY,
            baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            model: process.env.OPENAI_MODEL || 'gpt-4o',
        }] : [],
        activeInstanceId: process.env.OPENAI_API_KEY ? 'env-default' : undefined,
    },
    gemini: {
        apiKey: process.env.GOOGLE_API_KEY,
        baseUrl: process.env.GEMINI_BASE_URL,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    azure: {
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
        model: process.env.AZURE_OPENAI_MODEL || 'gpt-4o',
    },
    prompts: {
        analyze: '',
        similar: '',
    },
    timeouts: {
        // ★★★ 2026-11-12（用户报障「拍照识别为什么这么慢」）：180000 → 300000。
        //   线上真日志（wrong-notebook 容器 11:50~11:57 三次真实拍照分析）：
        //     30.5s / 75.4s / **184.3s** —— 全都成功，但第三次超过前端 180s 上限，
        //     前端先 abort ⇒ 学生看到「请求超时，请稍后重试」，而后端其实已经把结果算完了
        //     （白跑一次、白等三分钟）。上游模型耗时波动 6 倍，这不是"卡死"，是"慢但会成"，
        //     把上限提到 5 分钟就能把这一类捞回来；真失败（网关 5xx / 无可用渠道）会在
        //     几十秒内就报错，不会拖到这个上限。
        analyze: 300000,
    },
};

export function getAppConfig(): AppConfig {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
        try {
            const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
            const userConfig = JSON.parse(fileContent);

            // 检测并迁移旧版 OpenAI 配置
            let openaiConfig = userConfig.openai;
            if (isLegacyOpenAIConfig(userConfig.openai)) {
                logger.info('Detected legacy OpenAI config, migrating to multi-instance format...');
                openaiConfig = migrateOpenAIConfig(userConfig.openai);
                // 持久化迁移结果
                const migratedConfig = {
                    ...userConfig,
                    openai: openaiConfig,
                };
                fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(migratedConfig, null, 2));
                logger.info('Legacy OpenAI config migrated successfully');
            }

            // Merge with default to ensure all fields exist
            return {
                ...DEFAULT_CONFIG,
                ...userConfig,
                openai: {
                    instances: openaiConfig?.instances || DEFAULT_CONFIG.openai?.instances || [],
                    activeInstanceId: openaiConfig?.activeInstanceId || DEFAULT_CONFIG.openai?.activeInstanceId,
                },
                gemini: { ...DEFAULT_CONFIG.gemini, ...userConfig.gemini },
                azure: { ...DEFAULT_CONFIG.azure, ...userConfig.azure },
                prompts: { ...DEFAULT_CONFIG.prompts, ...userConfig.prompts },
                timeouts: { ...DEFAULT_CONFIG.timeouts, ...userConfig.timeouts },
            };
        } catch (error) {
            logger.error({ error }, 'Failed to read config file');
            return DEFAULT_CONFIG;
        }
    }
    return DEFAULT_CONFIG;
}

export function updateAppConfig(newConfig: Partial<AppConfig>) {
    const currentConfig = getAppConfig();
    const updatedConfig = {
        ...currentConfig,
        ...newConfig,
        openai: {
            instances: newConfig.openai?.instances ?? currentConfig.openai?.instances ?? [],
            activeInstanceId: newConfig.openai?.activeInstanceId ?? currentConfig.openai?.activeInstanceId,
        },
        gemini: { ...currentConfig.gemini, ...newConfig.gemini },
        azure: { ...currentConfig.azure, ...newConfig.azure },
        prompts: { ...currentConfig.prompts, ...newConfig.prompts },
        timeouts: { ...currentConfig.timeouts, ...newConfig.timeouts },
    };

    try {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updatedConfig, null, 2));
        return updatedConfig;
    } catch (error) {
        logger.error({ error }, 'Failed to write config file');
        throw error;
    }
}

// 获取当前激活的 OpenAI 实例配置
export function getActiveOpenAIConfig(): OpenAIInstance | undefined {
    const config = getAppConfig();
    const instances = config.openai?.instances || [];
    const activeId = config.openai?.activeInstanceId;

    if (!activeId || instances.length === 0) {
        return undefined;
    }

    return instances.find(i => i.id === activeId);
}

// 最大实例数限制
export const MAX_OPENAI_INSTANCES = 10;

