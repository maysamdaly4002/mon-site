/** Réglages du module (snapify.module.json → settings). */
export interface Settings {
  enabled: boolean;
  message: string;
  showOnPages: string[];
}

/** Options du widget « message » (snapify.module.json → widgets[].fields). */
export interface MessageOptions {
  title: string;
  text: string;
  buttonLabel: string;
  buttonLink: string;
}

export interface Stats {
  clicks: number;
  lastClickAt: string | null;
}
