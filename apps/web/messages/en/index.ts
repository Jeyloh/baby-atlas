import type nb from "../nb";
import activities from "./activities.json";
import auth from "./auth.json";
import chat from "./chat.json";
import child from "./child.json";
import common from "./common.json";
import dashboard from "./dashboard.json";
import enums from "./enums.json";
import format from "./format.json";
import household from "./household.json";
import logModal from "./logModal.json";
import nav from "./nav.json";
import reports from "./reports.json";
import settings from "./settings.json";
import tracking from "./tracking.json";
import ui from "./ui.json";

// Typed against Bokmål so a missing English key fails type-check.
const messages: typeof nb = {
  activities,
  auth,
  chat,
  child,
  common,
  dashboard,
  enums,
  format,
  household,
  logModal,
  nav,
  reports,
  settings,
  tracking,
  ui,
};

export default messages;
