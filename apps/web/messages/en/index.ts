import type nb from "../nb";
import common from "./common.json";
import insights from "./insights.json";
import premium from "./premium.json";

// Typed against Bokmål so a missing English key fails type-check.
const messages: typeof nb = {
  common,
  insights,
  premium,
};

export default messages;
