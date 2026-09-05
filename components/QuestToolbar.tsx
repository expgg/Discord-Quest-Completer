import { React, useState } from "@webpack/common";
import { Icons } from "./Icons";
import { startQuest } from "../quests/manager";
import { discordApiGet } from "../core/api";
import { QuestsStore } from "../core/stores";

export function QuestToolbar() {
    const [hideClaimed, setHideClaimed] = useState(false);
    const [sortByOrbs, setSortByOrbs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const toggleHideClaimed = () => {
        const next = !hideClaimed;
        setHideClaimed(next);

        // Target the actual outer quest tiles so the CSS grid reflows with zero gaps
        const tiles = document.querySelectorAll('[id^="quest-tile-"]');
        tiles.forEach((tile) => {
            const questId = tile.id.replace("quest-tile-", "");
            const quest = QuestsStore?.getQuest?.(questId);
            const text = tile.textContent || "";
            const isClaimed = Boolean(
                quest?.userStatus?.completedAt ||
                text.includes("You claimed this reward") ||
                text.includes("View Reward") ||
                text.includes("Claimed") ||
                tile.querySelector('[class*="claimed"], [class*="check"]')
            );

            if (isClaimed) {
                (tile as HTMLElement).style.setProperty("display", next ? "none" : "", "important");
                // If tile has an individual grid cell wrapper div, hide it too
                const parent = tile.parentElement;
                if (parent && parent.children.length === 1 && !parent.id.includes("quest")) {
                    (parent as HTMLElement).style.setProperty("display", next ? "none" : "", "important");
                }
            } else {
                (tile as HTMLElement).style.setProperty("display", "", "important");
                const parent = tile.parentElement;
                if (parent && parent.children.length === 1 && !parent.id.includes("quest")) {
                    (parent as HTMLElement).style.setProperty("display", "", "important");
                }
            }
        });
    };

    const toggleSortByOrbs = () => {
        const next = !sortByOrbs;
        setSortByOrbs(next);
        const tiles = document.querySelectorAll('[id^="quest-tile-"]');
        tiles.forEach((tile) => {
            const text = tile.textContent || "";
            const isHigh = text.includes("840") || text.includes("Nitro") || text.includes("Deco") || text.includes("Hypersonic");
            (tile as HTMLElement).style.opacity = next && !isHigh ? "0.35" : "1";
        });
    };

    const handleAutoComplete = async () => {
        setIsRunning(true);
        try {
            const data = await discordApiGet("/quests/@me");
            const quests = data?.quests || [];
            const active = quests.filter((q: any) => !q.user_status?.completed_at);
            console.log(`[QuestToolbar] Auto-starting ${active.length} quests in sequence...`);
            for (const quest of active) {
                await startQuest(quest.id);
            }
        } catch (e) {
            console.error("[QuestToolbar] Auto-complete error:", e);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="q-toolbar-container">
            <button
                className={`q-tool-btn ${hideClaimed ? "active" : ""}`}
                onClick={toggleHideClaimed}
            >
                <Icons.EyeSlash /> Hide Claimed
            </button>
            <button
                className={`q-tool-btn ${sortByOrbs ? "active" : ""}`}
                onClick={toggleSortByOrbs}
            >
                <Icons.Gem /> High Orbs (840)
            </button>
            <button
                className="q-tool-btn primary"
                onClick={handleAutoComplete}
                disabled={isRunning}
            >
                <Icons.Bolt /> {isRunning ? "⚡ Running Engine..." : "Auto-Complete All"}
            </button>
        </div>
    );
}
