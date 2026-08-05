import * as NavigationBar from "expo-navigation-bar";
import { Platform } from "react-native";

export function setAndroidNavigationBar(theme: "light" | "dark") {
  if (Platform.OS !== "android") return;
  // SDK 57 is edge-to-edge only: the bar is transparent (no background color
  // API anymore) and setStyle controls the button color for the active theme
  NavigationBar.setStyle(theme === "dark" ? "light" : "dark");
}
