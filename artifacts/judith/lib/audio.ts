import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

let counter = 0;

/** Writes base64 mp3 to cache and plays it, resolving when playback finishes. */
export async function playBase64Mp3(base64: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}judith-${Date.now()}-${counter++}.mp3`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await setAudioModeAsync({ playsInSilentMode: true });

  const player = createAudioPlayer(uri);
  player.play();

  return new Promise<void>((resolve) => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        sub.remove();
        player.remove();
        resolve();
      }
    });
  });
}

/** Reads a recorded file URI and returns its base64 contents. */
export async function fileToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
