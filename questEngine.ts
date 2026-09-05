import { RestAPI } from "@webpack/common";

export interface Quest {
    id: string;
    config: {
        messages: { quest_name: string };
        application?: { id: string; name: string };
        task_config?: any;
        task_config_v2?: any;
    };
    user_status: {
        completed_at: string | null;
        enrolled_at: string | null;
        claimed_at: string | null;
        progress: Record<string, { value: number }>;
    } | null;
}

export class QuestEngine {
    private static isRunning = false;
    private static abortController: AbortController | null = null;

    static async fetchQuests(): Promise<Quest[]> {
        try {
            const res = await RestAPI.get({ url: "/quests/@me" });
            return (res.body?.quests || []) as Quest[];
        } catch (err) {
            console.error("[QuestEngine] Error fetching quests:", err);
            return [];
        }
    }

    static async enroll(questId: string): Promise<boolean> {
        try {
            await RestAPI.post({
                url: `/quests/${questId}/enroll`,
                body: { location: 11, is_targeted: false, metadata_raw: null }
            });
            return true;
        } catch (e) {
            console.warn(`[QuestEngine] Enrollment notice for ${questId}:`, e);
            return false;
        }
    }

    static async completeVideoQuest(quest: Quest, onProgress?: (pct: number) => void): Promise<boolean> {
        const taskConfig = quest.config?.task_config ?? quest.config?.task_config_v2;
        const targetSeconds = taskConfig?.tasks?.WATCH_VIDEO?.target || taskConfig?.tasks?.WATCH_VIDEO_ON_MOBILE?.target || 180;
        let currentSeconds = quest.user_status?.progress?.WATCH_VIDEO?.value || 0;

        while (currentSeconds < targetSeconds) {
            if (!this.isRunning) return false;

            currentSeconds = Math.min(targetSeconds, currentSeconds + 7);
            const pct = Math.floor((currentSeconds / targetSeconds) * 100);
            onProgress?.(pct);

            try {
                await RestAPI.post({
                    url: `/quests/${quest.id}/video-progress`,
                    body: { timestamp: currentSeconds }
                });
            } catch {}

            await new Promise((r) => setTimeout(r, 1000));
        }

        return true;
    }

    static async completeGameQuest(quest: Quest, onProgress?: (pct: number) => void): Promise<boolean> {
        const taskConfig = quest.config?.task_config ?? quest.config?.task_config_v2;
        const targetSeconds = taskConfig?.tasks?.PLAY_ON_DESKTOP?.target || 900;
        let currentSeconds = quest.user_status?.progress?.PLAY_ON_DESKTOP?.value || 0;
        const appId = quest.config?.application?.id;

        while (currentSeconds < targetSeconds) {
            if (!this.isRunning) return false;

            try {
                await RestAPI.post({
                    url: `/quests/${quest.id}/heartbeat`,
                    body: { application_id: appId, terminal: false }
                });
            } catch {}

            currentSeconds += 60;
            const pct = Math.min(100, Math.floor((currentSeconds / targetSeconds) * 100));
            onProgress?.(pct);

            if (currentSeconds >= targetSeconds) break;
            await new Promise((r) => setTimeout(r, 60000));
        }

        try {
            await RestAPI.post({
                url: `/quests/${quest.id}/heartbeat`,
                body: { application_id: appId, terminal: true }
            });
        } catch {}

        return true;
    }

    static async claim(questId: string): Promise<boolean> {
        try {
            await RestAPI.post({
                url: `/quests/${questId}/claim`,
                body: { platform: 0 }
            });
            return true;
        } catch {
            return false;
        }
    }

    static stop() {
        this.isRunning = false;
        this.abortController?.abort();
    }
}
