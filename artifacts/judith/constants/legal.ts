import * as WebBrowser from "expo-web-browser";

/**
 * Public legal pages, served by the `privacy` web artifact (deployed at
 * /privacy). The same single-page site renders both pages via the `?page=`
 * switch, which works on any static host without clean-path rewrite support.
 */
export const PRIVACY_URL = "https://judithforduedates.com/privacy?page=privacy";
export const TERMS_URL = "https://judithforduedates.com/privacy?page=terms";

export function openLegal(url: string): void {
  void WebBrowser.openBrowserAsync(url);
}
