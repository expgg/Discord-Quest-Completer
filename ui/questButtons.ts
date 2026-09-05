import { Button, React, UserStore } from "@webpack/common";
import { activeQuests, debugLog, getProgressBarKey, isPluginStopping, refreshQuestButtonsRef, setRefreshQuestButtonsRef } from "../core/state";
import { QuestsStore } from "../core/stores";
import { ALL_TASK_TYPES } from "../core/types";
import { startQuest } from "../quests/manager";
import { settings } from "../index";
let questButtonsObserver: MutationObserver | null = null;
let isInjecting = false;
let questVideoObserver: MutationObserver | null = null;
export function QuestButton({ questId }: { questId: string; }) {
    const [isRunning, setIsRunning] = React.useState(false);
    React.useEffect(() => {
        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) return;
        const key = getProgressBarKey(questId, userId);
        const questData = activeQuests.get(key);
        setIsRunning(questData?.isProcessing ?? false);
        const interval = setInterval(() => {
            const questData = activeQuests.get(key);
            setIsRunning(questData?.isProcessing ?? false);
        }, 500);
        return () => clearInterval(interval);
    }, [questId]);
    return React.createElement(Button, {
        color: isRunning ? Button.Colors.RED : Button.Colors.BRAND,
        size: Button.Sizes.MEDIUM,
        style: { width: "100%" },
        onClick: () => startQuest(questId),
    }, isRunning ? "Cancel Automation" : "Auto Complete");
}
function safeGetQuest(questId: string): any {
    if (!QuestsStore) return null;
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = () => { };
    console.warn = () => { };
    console.error = () => { };
    let quest: any = null;
    try {
        quest = QuestsStore.getQuest(questId);
    } catch {
    } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
    }
    return quest;
}
function injectQuestButtons() {
    if (isPluginStopping || isInjecting) return;
    isInjecting = true;
    if (questButtonsObserver) {
        questButtonsObserver.disconnect();
    }
    try {
        const questTiles = document.querySelectorAll('[id^="quest-tile-"]');
        if (questTiles.length === 0) return;
        questTiles.forEach(tile => {
            const questId = (tile.id || "").replace("quest-tile-", "");
            if (!questId || !/^\d+$/.test(questId)) return;
            const existingBtn = tile.querySelector("[data-quest-autocomplete-btn]") as HTMLElement;
            const quest = safeGetQuest(questId);
            if (quest?.userStatus?.completedAt) {
                existingBtn?.remove();
                return;
            }
            if (!quest?.userStatus?.enrolledAt) {
                existingBtn?.remove();
                return;
            }
            if (quest?.config?.expiresAt && new Date(quest.config.expiresAt).getTime() < Date.now()) {
                existingBtn?.remove();
                return;
            }
            const taskCfg = quest?.config?.taskConfigV2 ?? quest?.config?.taskConfig ?? quest?.taskConfigV2 ?? quest?.taskConfig;
            let isSupported = true;
            if (taskCfg && taskCfg.tasks) {
                if ("ACHIEVEMENT_IN_ACTIVITY" in taskCfg.tasks) {
                    isSupported = false;
                } else {
                    isSupported = ALL_TASK_TYPES.some(type => type in taskCfg.tasks);
                }
            }
            if (!isSupported) {
                existingBtn?.remove();
                return;
            }
            const userId = UserStore.getCurrentUser()?.id;
            const key = userId ? getProgressBarKey(questId, userId) : null;
            const questData = key ? activeQuests.get(key) : null;
            const isRunning = questData?.isProcessing ?? false;
            if (existingBtn) {
                const currentState = existingBtn.getAttribute("data-running") === "true";
                if (currentState === isRunning) return;
                existingBtn.remove();
            }
            (tile as HTMLElement).style.position = "relative";
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("data-quest-autocomplete-btn", "true");
            button.setAttribute("data-quest-id", questId);
            button.setAttribute("data-running", isRunning.toString());
            button.style.cssText = `
                position: absolute;
                top: 12px;
                left: 12px;
                z-index: 25;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: ${isRunning ? "linear-gradient(135deg, #ef4444, #b91c1c)" : "linear-gradient(135deg, #5865f2, #7c3aed)"};
                color: #ffffff;
                padding: 6px 13px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 700;
                font-family: inherit;
                letter-spacing: -0.2px;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.22);
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55), 0 0 10px ${isRunning ? "rgba(239, 68, 68, 0.4)" : "rgba(88, 101, 242, 0.4)"};
                backdrop-filter: blur(10px);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                user-select: none;
            `;
            button.onmouseenter = () => {
                button.style.transform = "scale(1.05)";
            };
            button.onmouseleave = () => {
                button.style.transform = "scale(1)";
            };

            const iconSvg = isRunning
                ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;

            button.innerHTML = `${iconSvg}<span>${isRunning ? "Cancel" : "Auto Complete"}</span>`;

            button.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                startQuest(questId);
                setTimeout(() => refreshQuestButtonsRef?.(), 150);
            });

            tile.appendChild(button);
        });
    } catch (error) {
    } finally {
        isInjecting = false;
        if (questButtonsObserver && !isPluginStopping) {
            try {
                questButtonsObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            } catch { }
        }
    }
}
function refreshQuestButtons() {
    document.querySelectorAll("[data-quest-autocomplete-btn]").forEach(el => el.remove());
    if (!isPluginStopping) {
        injectQuestButtons();
    }
}
export function setupQuestButtonObserver() {
    if (questButtonsObserver) {
        questButtonsObserver.disconnect();
    }
    setRefreshQuestButtonsRef(refreshQuestButtons);
    setupQuestVideoAutoDismiss();
    try {
        let debounceTimeout: number | null = null;
        questButtonsObserver = new MutationObserver(mutations => {
            if (isPluginStopping || isInjecting) return;
            const isRelevant = mutations.some(mutation => {
                const target = mutation.target as HTMLElement;
                if (target?.hasAttribute?.("data-quest-autocomplete-btn") ||
                    target?.closest?.("[data-quest-autocomplete-btn]")) {
                    return false;
                }
                if (target?.closest?.('[id^="quest-tile-"]')) {
                    return mutation.type === "childList";
                }
                if (mutation.type === "childList") {
                    return Array.from(mutation.addedNodes).some(node =>
                        node instanceof HTMLElement &&
                        (node.id?.startsWith("quest-tile-") ||
                            node.querySelector?.('[id^="quest-tile-"]'))
                    );
                }
                return false;
            });
            if (isRelevant) {
                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = window.setTimeout(() => {
                    injectQuestButtons();
                    debounceTimeout = null;
                }, 800);
            }
        });
        questButtonsObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
        injectQuestButtons();
        setTimeout(injectQuestButtons, 2000);
        setTimeout(injectQuestButtons, 5000);
    } catch (error) {
        console.error("[QuestAutoComplete] Error setting up observer:", error);
    }
}
export function cleanupQuestButtonObserver() {
    if (questButtonsObserver) {
        try {
            questButtonsObserver.disconnect();
            questButtonsObserver = null;
        } catch (error) { }
    }
    if (questVideoObserver) {
        try {
            questVideoObserver.disconnect();
            questVideoObserver = null;
        } catch (error) { }
    }
    try {
        document.querySelectorAll("[data-quest-autocomplete-btn]").forEach(btn => {
            try { btn.remove(); } catch (error) { }
        });
    } catch (error) { }
}

function setupQuestVideoAutoDismiss() {
    if (questVideoObserver) {
        questVideoObserver.disconnect();
    }
    questVideoObserver = new MutationObserver(() => {
        if (isPluginStopping) return;
        tryDismissQuestVideo();
    });
    questVideoObserver.observe(document.body, { childList: true, subtree: true });
}

function tryDismissQuestVideo() {
    try {
        if (!settings.store.autoDismissQuestPopups) return;
        const candidates = document.querySelectorAll(
            "[class*='layerContainer'] [class*='layer'], [class*='modal'], [class*='backdrop'], [role='dialog']"
        );

        for (const layer of Array.from(candidates)) {
            const text = (layer as HTMLElement).textContent ?? "";

            const video = layer.querySelector("video");
            if (video) {
                const src = video.src || video.currentSrc || "";
                const isQuestVideo = src.includes("cdn.discordapp.com/quests") ||
                    layer.querySelector("[class*='questContent'], [class*='quest']") !== null;
                if (isQuestVideo) {
                    const closeBtn = findCloseButton(layer);
                    if (closeBtn) {
                        debugLog("[QuestAutoComplete] Auto-dismissing quest video popup");
                        closeBtn.click();
                        return;
                    }
                }
            }

            if (
                text.includes("Continue on your phone") ||
                text.includes("Scan this QR code") ||
                text.includes("continue the Quest on your mobile")
            ) {
                const closeBtn = findCloseButton(layer);
                if (closeBtn) {
                    debugLog("[QuestAutoComplete] Auto-dismissing mobile QR code popup");
                    closeBtn.click();
                    return;
                }
            }
        }
    } catch (e) { }
}

function findCloseButton(container: Element): HTMLElement | null {
    return (
        container.querySelector("[aria-label='Close']") as HTMLElement ||
        container.querySelector("[class*='closeButton']") as HTMLElement ||
        (Array.from(container.querySelectorAll("button")).find(b =>
            b.getAttribute("aria-label")?.toLowerCase().includes("close") ||
            b.textContent?.trim() === "\u2715" ||
            b.textContent?.trim() === "\u00d7" ||
            b.textContent?.trim() === "\u2573"
        ) as HTMLElement | undefined) ||
        null
    );
}
