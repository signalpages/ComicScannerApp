import { Preferences } from "@capacitor/preferences";

const KEY = "comicscan_install_id";

// CS-303: Strict Install ID Persistence
export async function getInstallId() {
    const { value } = await Preferences.get({ key: KEY });
    return value || null;
}

export async function setInstallId(id) {
    if (!id) return;
    await Preferences.set({ key: KEY, value: id });
}
