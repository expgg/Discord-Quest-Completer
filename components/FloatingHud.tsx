import { React, useState, useEffect } from "@webpack/common";
import { Icons } from "./Icons";
import { discordApiGet } from "../core/api";
import { activeQuests } from "../core/state";
import { QuestsStore } from "../core/stores";

export function FloatingHud({ onClose }: { onClose: () => void }) {
    const [quests, setQuests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [runningQuest, setRunningQuest] = useState<{ id: string; name: string; percent: number; taskType: string } | null>(null);

    // Initial quest count fetch & periodic sync
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
        const listInterval = setInterval(fetchQuestList, 10000);
        return () => clearInterval(listInterval);
    }, []);

    // High frequency ticker to poll activeQuests state for real-time %
    useEffect(() => {
        const pollActive = () => {
            let active: any = null;
            for (const [_, data] of activeQuests.entries()) {
                if (data.isProcessing) {
                    active = data;
                    break;
                }
            }

            if (active) {
                const q = QuestsStore?.getQuest?.(active.questId);
                const name = q?.config?.messages?.questName ?? q?.messages?.questName ?? "Active Quest";
                setRunningQuest({
                    id: active.questId,
                    name,
                    percent: Math.min(100, Math.max(0, active.lastProgress || 0)),
                    taskType: active.taskType || "",
                });
            } else {
                setRunningQuest(null);
            }
        };

        const interval = setInterval(pollActive, 300);
        return () => clearInterval(interval);
    }, []);

    const totalSeconds = quests.reduce((acc: number, q: any) => {
        const tasks = q.config?.task_config?.tasks || q.config?.task_config_v2?.tasks || {};
        const first = Object.values(tasks)[0] as any;
        return acc + (first?.target || 900);
    }, 0);

    const mins = Math.ceil(totalSeconds / 60);
    const isAllDone = quests.length === 0 && !loading;

    // Circular Progress Calculation - Bigger & bolder
    const size = 48;
    const strokeWidth = 4.2;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const percent = runningQuest ? runningQuest.percent : (isAllDone ? 100 : 0);
    const dashoffset = circumference - (percent / 100) * circumference;

    return (
        <div className="q-hud-pill">
            <div className="q-circle-container" style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
                    {/* Background track */}
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.14)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Animated foreground ring */}
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={isAllDone ? "#10b981" : "url(#q-pill-grad)"}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={dashoffset}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 0.35s ease" }}
                    />
                    <defs>
                        <linearGradient id="q-pill-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#5865f2" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Inner Icon or Live Percentage */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: size,
                    height: size,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: runningQuest ? "12px" : "15px",
                    fontWeight: 800,
                    letterSpacing: runningQuest ? "-0.5px" : "normal"
                }}>
                    {isAllDone ? (
                        <Icons.Check />
                    ) : runningQuest ? (
                        <span>{Math.round(runningQuest.percent)}%</span>
                    ) : (
                        <Icons.Quest />
                    )}
                </div>
            </div>

            {/* Quest Details Text */}
            <div className="q-info">
                <span className="q-title">
                    {loading ? (
                        "Scanning..."
                    ) : runningQuest ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Icons.Bolt />
                            <span>{runningQuest.name}</span>
                        </span>
                    ) : isAllDone ? (
                        "All Quests Complete"
                    ) : (
                        `${quests.length} Active Quests`
                    )}
                </span>
                <span className="q-subtitle">
                    {runningQuest ? (
                        <span>{runningQuest.taskType.includes("VIDEO") ? "Fast-forwarding video..." : "Emulating gameplay..."}</span>
                    ) : (
                        <>
                            <Icons.Clock />
                            <span>{loading ? "Syncing..." : isAllDone ? "0m left" : `${mins} mins remaining`}</span>
                        </>
                    )}
                </span>
            </div>

            <button className="q-close-btn" onClick={onClose} title="Close HUD">
                <Icons.Close />
            </button>
        </div>
    );
}
