import { CONSOLE_URL_MATCH_PATTERN } from '@/utils/console-url';
import type { PppSettings } from '@/utils/ppp';
import {
  PPP_ABORT,
  PPP_FILL,
  PPP_PROGRESS,
  PPP_SCAN,
  type PppFillResult,
  type PppScanResult,
  type PricingMessage,
} from '@/utils/messages';
import { runFill, scanPrices } from './fill';

// This script injects nothing — no panel, no stylesheet, no toast. The UI is
// the side panel, an extension page, which drives everything from here through
// runtime messages.
export default defineContentScript({
  matches: [CONSOLE_URL_MATCH_PATTERN],
  main(ctx) {
    let aborted = false;
    let filling = false;
    ctx.onInvalidated(() => {
      aborted = true;
    });

    async function fill(
      basePrice: number,
      settings: PppSettings,
    ): Promise<PppFillResult> {
      if (filling) return { filled: 0, gaveUp: false, aborted: true };
      filling = true;
      aborted = false;
      try {
        return await runFill(
          basePrice,
          settings,
          (done, total) => {
            // Fire-and-forget: the side panel may have been closed, and a
            // rejected sendMessage must not abort the walk.
            browser.runtime
              .sendMessage({ type: PPP_PROGRESS, done, total })
              .catch(() => {});
          },
          () => aborted,
        );
      } finally {
        filling = false;
      }
    }

    function onMessage(
      message: PricingMessage,
      _sender: unknown,
      sendResponse: (response: PppScanResult | PppFillResult) => void,
    ) {
      if (message?.type === PPP_SCAN) {
        // A throw here leaves the reply channel hanging, which the sender
        // can't tell apart from "no content script on this tab" — that's how a
        // required-field mistake surfaced as a permanently disabled popup
        // button instead of an error.
        try {
          sendResponse(scanPrices(message.basePrice, message.settings));
        } catch (err) {
          console.error('ConsoleTurbo: price scan failed.', err);
          sendResponse({ scanned: 0, rows: [] });
        }
        return true;
      }
      if (message?.type === PPP_ABORT) {
        aborted = true;
        sendResponse({ filled: 0, gaveUp: false, aborted: true });
        return true;
      }
      if (message?.type === PPP_FILL) {
        void fill(message.basePrice, message.settings).then(sendResponse);
        return true; // async reply
      }
      // Anything else isn't ours — returning true here would hold the reply
      // channel open and hang the sender's promise.
      return false;
    }

    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() =>
      browser.runtime.onMessage.removeListener(onMessage),
    );
  },
});
