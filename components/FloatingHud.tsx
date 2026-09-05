import { React, useState, useEffect, UserStore } from "@webpack/common";
import { Icons } from "./Icons";
import { discordApiGet } from "../core/api";
import { activeQuests } from "../core/state";
import { QuestsStore } from "../core/stores";
import { cancelQuest, startQuest } from "../quests/manager";

export function FloatingHud({ onClose }: { onClose: () => void }) {
    const [quests, setQuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [runningQuest, setRunningQuest] = useState<{
        id: string;
        name: string;
        percent: number;
        taskType: string;
        remainingMins: number;
    } | null>(null);

    const fetchQuestList = () => {
        discordApiGet("/quests/@me")
            .then((data: any) => {
                const qList = data?.quests || [];
                setQuests(qList.filter((q: any) => !q.user_status?.completed_at));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchQuestList();
        const listInterval = setInterval(fetchQuestList, 8000);
        return () => clearInterval(listInterval);
    }, []);

    // 250ms polling for live real-time % from activeQuests state
    useEffect(() => {
        const poll = () => {
            let active: any = null;
            for (const [_, data] of activeQuests.entries()) {
                if (data.isProcessing) {
                    active = data;
                    break;
                }
            }

            if (active) {
                const q = QuestsStore?.getQuest?.(active.questId);
                const name = q?.config?.messages?.questName ?? q?.messages?.questName ?? "Quest";
                const target = active.targetProgress || 900;
                const current = (active.lastProgress || 0) * (target / 100);
                const remMins = Math.max(1, Math.ceil((target - current) / 60));

                setRunningQuest({
                    id: active.questId,
                    name,
                    percent: Math.min(100, Math.max(0, active.lastProgress || 0)),
                    taskType: active.taskType || "",
                    remainingMins: remMins,
                });
            } else {
                setRunningQuest(null);
            }
        };

        const interval = setInterval(poll, 250);
        return () => clearInterval(interval);
    }, []);

    const totalSeconds = quests.reduce((acc: number, q: any) => {
        const tasks = q.config?.task_config?.tasks || q.config?.task_config_v2?.tasks || {};
        const first = Object.values(tasks)[0] as any;
        return acc + (first?.target || 900);
    }, 0);

    const mins = Math.ceil(totalSeconds / 60);
    const isAllDone = quests.length === 0 && !loading;

    // SVG Circular Progress Ring (Exact clone of Discord quest ring)
    const circleSize = 20;
    const strokeWidth = 2.4;
    const center = circleSize / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const percent = runningQuest ? runningQuest.percent : (isAllDone ? 100 : 0);
    const dashoffset = circumference - (percent / 100) * circumference;

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (runningQuest) {
            const userId = UserStore?.getCurrentUser()?.id;
            if (userId) cancelQuest(runningQuest.id, userId);
        }
    };

    const handleStartAll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const data = await discordApiGet("/quests/@me");
            const qList = (data?.quests || []).filter((q: any) => !q.user_status?.completed_at);
            for (const q of qList) {
                await startQuest(q.id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className={`q-bottom-hud ${previewOpen ? "is-expanded" : ""} ${isAllDone ? "is-done" : ""}`}>
            {/* Sleek Compact Pill Row */}
            <div
                className="q-hud-header"
                onClick={() => setPreviewOpen(!previewOpen)}
            >
                {/* Thin SVG Circle Indicator */}
                <div style={{ position: "relative", width: circleSize, height: circleSize, flexShrink: 0 }}>
                    <svg width={circleSize} height={circleSize} style={{ transform: "rotate(-90deg)", display: "block" }}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.18)"
                            strokeWidth={strokeWidth}
                        />
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={isAllDone ? "#43b581" : "#5865f2"}
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
                        />
                    </svg>
                </div>

                {/* Quest Title */}
                <span className="q-hud-title">
                    {loading ? (
                        "Scanning quests..."
                    ) : runningQuest ? (
                        runningQuest.name
                    ) : isAllDone ? (
                        "All Quests Complete"
                    ) : (
                        `${quests.length} Active Quests`
                    )}
                </span>

                {/* Live Percentage */}
                <span className="q-hud-percent">
                    {loading ? "..." : isAllDone ? "Done" : runningQuest ? `${Math.round(runningQuest.percent)}%` : `${mins}m`}
                </span>

                {/* Eye Button to toggle preview */}
                <button
                    className={`q-hud-btn ${previewOpen ? "active" : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setPreviewOpen(!previewOpen);
                    }}
                    title={previewOpen ? "Hide quest preview" : "Show quest preview"}
                    aria-label="Toggle quest preview"
                >
                    {previewOpen ? <Icons.EyeSlash /> : <Icons.Eye />}
                </button>

                {/* Close Button */}
                <button
                    className="q-hud-btn close-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    title="Dismiss"
                    aria-label="Dismiss HUD"
                >
                    <Icons.Close />
                </button>
            </div>

            {/* Butter-Smooth Collapsible Preview Card */}
            <div className="q-hud-body-wrapper">
                <div className="q-hud-body-content">
                    <div className="q-hud-desc">
                        {runningQuest ? (
                            runningQuest.taskType.includes("VIDEO") ? (
                                "Fast-forwarding video. Wait ~10s."
                            ) : (
                                `Auto-completing: ${runningQuest.name}. Wait ~${runningQuest.remainingMins}m.`
                            )
                        ) : isAllDone ? (
                            "All quest rewards claimed! You're fully locked in."
                        ) : (
                            `${quests.length} active quests in queue. Est. total time: ~${mins}m.`
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="q-hud-bar-bg">
                        <div
                            className={`q-hud-bar-fill ${isAllDone ? "success" : ""}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>

                    {/* Actions */}
                    <div className="q-hud-actions">
                        {runningQuest ? (
                            <button className="q-hud-action-btn cancel" onClick={handleCancel}>
                                Cancel
                            </button>
                        ) : !isAllDone ? (
                            <button className="q-hud-action-btn primary" onClick={handleStartAll}>
                                Auto-Complete All
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
