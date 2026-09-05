import { React, useState, useEffect, UserStore } from "@webpack/common";
import { Icons } from "./Icons";
import { discordApiGet } from "../core/api";
import { activeQuests } from "../core/state";
import { QuestsStore } from "../core/stores";
import { cancelQuest, startQuest } from "../quests/manager";

export function FloatingHud({ onClose }: { onClose: () => void }) {
    const [quests, setQuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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

    // 300ms polling for live real-time % from activeQuests state
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

        const interval = setInterval(poll, 300);
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
        <div className={`quest-pill ${isAllDone ? "completed success" : ""}`} style={{ pointerEvents: "auto" }}>
            <div className="quest-pill-compact" style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", cursor: "pointer" }}>
                {/* Thin SVG Circle Indicator */}
                <div style={{ position: "relative", width: circleSize, height: circleSize, flexShrink: 0 }}>
                    <svg width={circleSize} height={circleSize} style={{ transform: "rotate(-90deg)", display: "block" }}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.2)"
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
                            style={{ transition: "stroke-dashoffset 0.3s ease" }}
                        />
                    </svg>
                </div>

                {/* Quest Title */}
                <span className="quest-pill-title" style={{ textAlign: "left", flex: 1, fontSize: "13px", fontWeight: 600 }}>
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
                <span className="quest-pill-percent" style={{ fontSize: "13px", fontWeight: 700, color: "#43b581", minWidth: "32px", textAlign: "right" }}>
                    {loading ? "..." : isAllDone ? "Done" : runningQuest ? `${Math.round(runningQuest.percent)}%` : `${mins}m`}
                </span>

                {/* Close Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.4)",
                        cursor: "pointer",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                        marginLeft: "4px"
                    }}
                    title="Dismiss"
                >
                    <Icons.Close />
                </button>
            </div>

            {/* Smooth Hover-Expanded Content */}
            <div className="quest-pill-expanded">
                <div className="quest-pill-expanded-inner">
                    <div className="quest-pill-body" style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", marginTop: "6px" }}>
                        {runningQuest ? (
                            runningQuest.taskType.includes("VIDEO") ? (
                                `Fast-forwarding video. Wait ~10 seconds.`
                            ) : (
                                `Auto-completing: ${runningQuest.name}. Wait ~${runningQuest.remainingMins} minutes.`
                            )
                        ) : isAllDone ? (
                            "All rewards claimed. You're fully locked in!"
                        ) : (
                            `${quests.length} active quests in queue. Total time ~${mins} minutes.`
                        )}
                    </div>

                    {/* Thin Progress Bar */}
                    <div className="quest-pill-progress-bar" style={{ height: "3px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", overflow: "hidden", margin: "4px 0" }}>
                        <div
                            className="quest-pill-progress-fill"
                            style={{
                                width: `${percent}%`,
                                height: "100%",
                                background: isAllDone ? "#43b581" : "linear-gradient(90deg, #5865f2, #7289da)",
                                transition: "width 0.3s ease"
                            }}
                        />
                    </div>

                    {/* Actions */}
                    <div className="quest-pill-actions" style={{ display: "flex", justifyContent: "center", marginTop: "4px" }}>
                        {runningQuest ? (
                            <button className="quest-btn danger" onClick={handleCancel} style={{ padding: "4px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>
                                Cancel
                            </button>
                        ) : !isAllDone ? (
                            <button className="quest-btn" onClick={handleStartAll} style={{ padding: "4px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "#5865f2", border: "none" }}>
                                Auto-Complete All
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
