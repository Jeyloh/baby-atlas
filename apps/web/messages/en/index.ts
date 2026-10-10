import type nb from "../nb";
import common from "./common.json";

// Typed against Bokmål so a missing English key fails type-check.
const messages: typeof nb = {
  common,
};

export default messages;
