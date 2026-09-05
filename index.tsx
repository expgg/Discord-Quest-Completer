import "./styles.css";
import "./settings.css";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { createRoot, React } from "@webpack/common";
import type { Root } from "react-dom/client";
import { DataStore } from "@api/index";

import { showUpdateModal } from "./components/UpdateModal";
import { compareVersions } from "./core/utils";
import { initializeStores } from "./core/stores";
import {
    activeQuests,
    cleanupFunctions,
    debugLog,
    initDebug,
    parseProgressBarKey,
    progressBars,
    setPluginStopping,
} from "./core/state";
import { cleanupAllPills, notify } from "./ui/notifications";
import { setupQuestButtonObserver, cleanupQuestButtonObserver } from "./ui/questButtons";
import { cancelQuest, checkAndResumeQuests } from "./quests/manager";

import { FloatingHud } from "./components/FloatingHud";
import { QuestToolbar } from "./components/QuestToolbar";

export const PLUGIN_VERSION = "2.2.0";
export const GITHUB_REPO = "BlockTol/Quest-Auto-Complete";
export const UPDATE_CHECK_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export const settings = definePluginSettings({
    showFloatingHud: {
        type: OptionType.BOOLEAN,
        description: "Show the sleek floating HUD pill at the bottom right",
        default: true,
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Display toast notifications for quest events",
        default: true,
    },
    notificationDuration: {
        type: OptionType.SLIDER,
        description: "How long notifications stay on screen (seconds)",
        default: 4,
        markers: [1, 2, 3, 4, 6, 8, 10],
    },
    autoResumeAfterReload: {
        type: OptionType.BOOLEAN,
        description: "Automatically resume quest automation after Discord reload",
        default: true,
    },
    showProgressBar: {
        type: OptionType.BOOLEAN,
        description: "Show a real-time progress bar at the top of the screen",
        default: true,
    },
    autoDismissQuestPopups: {
        type: OptionType.BOOLEAN,
        description: "Automatically dismiss quest video and mobile QR code popups",
        default: true,
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Enable debug logging in the console (useful for troubleshooting)",
        default: false,
    },
});

let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
let hudRoot: HTMLDivElement | null = null;
let hudReactRoot: Root | null = null;
let toolbarReactRoot: Root | null = null;
let toolbarObserver: number | null = null;

async function checkForUpdates(): Promise<void> {
    try {
        debugLog("[QuestCompleter] Checking for updates...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(UPDATE_CHECK_URL, {
            signal: controller.signal,
            headers: {
                Accept: "application/vnd.github.v3+json",
            },
        });
        clearTimeout(timeoutId);
        if (!response.ok) return;

        const data = await response.json();
        let latestVersion = data.tag_name || data.name || "";
        latestVersion = latestVersion.replace(/^v/i, "").trim();
        if (!latestVersion) return;

        const comparison = compareVersions(latestVersion, PLUGIN_VERSION);
        if (comparison > 0) {
            const dismissedVersion = await DataStore.get('QuestCompleter-dismissed-version');
            if (dismissedVersion !== latestVersion) {
                const releaseNotes = data.body || "No release notes available.";
                showUpdateModal(latestVersion, releaseNotes);
            }
        }
    } catch (error: any) {
        if (error.name !== "AbortError") {
            console.error("[QuestCompleter] Update check error:", error);
        }
    }
}

function safeRender(element: React.ReactElement, container: HTMLElement): Root | null {
    try {
        if (typeof createRoot === "function") {
            const root = createRoot(container);
            root.render(element);
            return root;
        }
    } catch (e) {
        console.error("[QuestCompleter] render error:", e);
    }
    return null;
}

function cleanupAll() {
    debugLog("[QuestCompleter] Running full cleanup...");
    setPluginStopping(true);

    if (toolbarObserver) clearInterval(toolbarObserver);
    try { hudReactRoot?.unmount(); } catch {}
    try { toolbarReactRoot?.unmount(); } catch {}
    hudRoot?.remove();
    document.getElementById("quest-toolbar-root")?.remove();

    const questEntries = Array.from(activeQuests.entries());
    questEntries.forEach(([key, _]) => {
        const parsed = parseProgressBarKey(key);
        if (parsed) {
            try {
                cancelQuest(parsed.questId, parsed.userId);
            } catch (error) {}
        }
    });
    activeQuests.clear();
    progressBars.forEach(bar => {
        try { bar.remove(); } catch (error) {}
    });
    progressBars.clear();
    cleanupFunctions.forEach(cleanups => {
        cleanups.forEach(fn => {
            try { fn(); } catch (error) {}
        });
    });
    cleanupFunctions.clear();
    cleanupQuestButtonObserver();
    cleanupAllPills();
    debugLog("[QuestCompleter] Cleanup completed");
}

export default definePlugin({
    name: "QuestCompleter",
    description: "Ultimate native Discord quest completer with spoof engine, live HUD, top progress bar & filters.",
    authors: [
        {
            name: "exploriot",
        },
    ],
    tags: ["Activity", "Utility", "Fun"],
    settings,
    settingsAboutComponent: () => {
        const { QuestSettings } = require("./components/Settings");
        return <QuestSettings />;
    },

    start() {
        initDebug(settings.store);
        console.log("%c[QuestCompleter]%c All engines stolen & armed! 🔥🚀", "color: #5865f2; font-weight: bold", "");
        setPluginStopping(false);

        // 1. Mount Floating HUD (if enabled)
        if (settings.store.showFloatingHud) {
            hudRoot = document.createElement("div");
            hudRoot.id = "quest-hud-root";
            document.body.appendChild(hudRoot);
            hudReactRoot = safeRender(
                <FloatingHud
                    onClose={() => {
                        hudReactRoot?.unmount();
                        hudRoot?.remove();
                    }}
                />,
                hudRoot
            );
        }

        // 2. Mount In-Page Toolbar on Quests page
        const tryMountToolbar = () => {
            const header = Array.from(document.querySelectorAll("h2, [class*='heading']"))
                .find((el) => el.textContent?.trim() === "Available Quests")?.parentElement;

            if (header && !document.getElementById("quest-toolbar-root")) {
                const barMount = document.createElement("div");
                barMount.id = "quest-toolbar-root";
                header.style.display = "flex";
                header.style.alignItems = "center";
                header.style.justifyContent = "space-between";
                header.appendChild(barMount);
                toolbarReactRoot = safeRender(<QuestToolbar />, barMount);
            }
        };

        toolbarObserver = window.setInterval(tryMountToolbar, 1000);
        tryMountToolbar();

        // 3. Initialize background game/stream/video spoofing stores & observers
        setTimeout(() => {
            if (initializeStores()) {
                setupQuestButtonObserver();
                debugLog("[QuestCompleter] Ready!");
                setTimeout(() => {
                    checkAndResumeQuests().catch(err => {
                        console.warn("[QuestCompleter] Resume check failed:", err);
                    });
                }, 3000);
                setTimeout(() => {
                    checkForUpdates().catch(err => {});
                }, 5000);
                updateCheckInterval = setInterval(() => {
                    checkForUpdates().catch(err => {});
                }, 30 * 60 * 1000);
            } else {
                notify("Initialization Failed", "Could not initialize quest stores. Please reload Discord.", "error");
            }
        }, 2000);
    },

    stop() {
        debugLog("[QuestCompleter] Plugin stopping...");
        if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
            updateCheckInterval = null;
        }
        cleanupAll();
    },
});
