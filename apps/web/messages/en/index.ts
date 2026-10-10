import type nb from "../nb";
import common from "./common.json";
import speech from "./speech.json";
import potty from "./potty.json";
import vaccines from "./vaccines.json";

// Typed against Bokmål so a missing English key fails type-check.
const messages: typeof nb = {
  common,
  speech,
  potty,
  vaccines,
};

export default messages;
